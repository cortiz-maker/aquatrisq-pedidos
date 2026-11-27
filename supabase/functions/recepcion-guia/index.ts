// supabase/functions/recepcion-guia/index.ts
//
// Comprobante de recepción con guía de despacho — Aquatrisq (una empresa Quantrex)
//
// Se dispara desde la base (trigger trg_recepcion_guia en dt_entregas) cuando el chofer
// cierra en DispatchTrack una entrega con subestado "Venta con Guía". Envía un resumen
// de la entrega a los destinatarios configurados en el pedido (recepcion_correos; si no
// hay, el correo del cliente), siempre con copia a info@quantrex.cl, con:
//   - datos de quien recibe (nombre, RUT, firma y observación del formulario DT),
//   - detalle de lo entregado, bidones en préstamo y estado de pago (pendiente),
//   - trazabilidad (llegada y entrega, chofer y patente),
//   - la guía de despacho electrónica adjunta (si está cargada en el pedido) y la firma.
//
// Llamada manual: { pedido_id, prueba: true } → va solo a correo_prueba, con PRUEBA en el asunto,
// y no marca el pedido como enviado. { pedido_id, reenviar: true } permite reenviar.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "documentos-facturas";
const LOGO = `${SUPABASE_URL}/functions/v1/logo-aquatrisq`;
const INFO = "info@quantrex.cl";

const ACENTO = "#0EA5E9"; // celeste
const TEXTO = "#0F172A";
const SUAVE = "#64748B";
const BORDE = "#E2E8F0";

async function sb(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${init.method || "GET"} ${path} -> ${res.status}: ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

const emailOk = (x: unknown) => typeof x === "string" && /^[^@\s,;]+@[^@\s,;]+\.[a-z]{2,}$/i.test(x.trim());
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clp = (n: unknown) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
function fechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
  } catch { return String(iso); }
}
function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function nombreEmpresa(c: any): string {
  const rs = String(c?.razon_social || "").trim();
  const base = /[a-záéíóúñ]/i.test(rs) ? rs : String(c?.nombre || "cliente");
  return base.split("/")[0].trim() || "cliente";
}

type Resp = { name: string; val: string };
function respuestas(e: any): Resp[] {
  const ea = e?.raw?.evaluation_answers;
  if (!Array.isArray(ea)) return [];
  return ea.map((x: any) => ({ name: String(x?.name || ""), val: x?.value == null ? "" : String(x.value) }));
}
const busca = (rs: Resp[], re: RegExp) => rs.find((x) => re.test(x.name.trim()))?.val?.trim() || "";

async function leerObjeto(path: string): Promise<Uint8Array | null> {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
}

async function procesar(pedidoId: string, cfg: any, prueba: boolean, reenviar: boolean) {
  const ps = await sb(`pedidos?id=eq.${pedidoId}&select=*`);
  const p = ps?.[0];
  if (!p) throw new Error("pedido no encontrado");
  if (p.recepcion_enviada_at && !prueba && !reenviar) return { pedido_id: pedidoId, omitido: "ya enviado" };

  const [cs, ds, items, ents] = await Promise.all([
    sb(`clientes?id=eq.${p.cliente_id}&select=id,nombre,razon_social,rut,email`),
    p.domicilio_id ? sb(`domicilios?id=eq.${p.domicilio_id}&select=direccion,comuna,etiqueta`) : Promise.resolve([]),
    sb(`pedido_items?pedido_id=eq.${pedidoId}&select=nombre,codigo,cantidad,precio_unit,subtotal`),
    sb(`dt_entregas?guide=eq.${encodeURIComponent(p.numero_guia)}&select=*&order=actualizado_en.desc`),
  ]);
  const c = cs?.[0] || {};
  const d = ds?.[0] || null;
  const e = (ents || []).find((x: any) => Number(x.status) === 2) || (ents || [])[0];
  if (!e) throw new Error("la entrega aún no está cerrada en DispatchTrack");

  const rs = respuestas(e);
  const nombre = busca(rs, /nombre.*recibe/i) || String(e.recibido_por || "").trim();
  const rut = busca(rs, /rut/i);
  const firma = busca(rs, /firma/i);
  const obs = busca(rs, /^comentarios?$/i);
  const bidPend = busca(rs, /bid[oó]n.*pendiente/i);
  const fotos = rs.filter((x) => /foto/i.test(x.name) && /^https?:\/\//i.test(x.val)).map((x) => x.val);

  // Destinatarios
  const vistos = new Set<string>();
  const para: string[] = [];
  const add = (x: unknown) => { const s = String(x || "").trim(); if (emailOk(s) && !vistos.has(s.toLowerCase())) { vistos.add(s.toLowerCase()); para.push(s); } };
  (Array.isArray(p.recepcion_correos) && p.recepcion_correos.length ? p.recepcion_correos : [c.email]).forEach(add);
  let to: string[]; let cc: string[];
  if (prueba) { to = [cfg.correo_prueba]; cc = []; }
  else if (para.length) { to = para; cc = [INFO]; }
  else { to = [INFO]; cc = []; }

  // Adjuntos: guía de despacho + firma
  const adjuntos: any[] = [];
  if (p.guia_despacho_url) {
    const g = await leerObjeto(p.guia_despacho_url);
    if (g) adjuntos.push({ filename: `Guia_Despacho_${p.guia_despacho_numero || p.numero_guia}.pdf`, content: b64(g) });
  }
  let firmaImg = "";
  if (/^https?:\/\//i.test(firma)) {
    firmaImg = firma;
    try {
      const rf = await fetch(firma);
      if (rf.ok) adjuntos.push({ filename: `Firma_${p.numero_guia}.png`, content: b64(new Uint8Array(await rf.arrayBuffer())) });
    } catch { /* la firma igual va enlazada en el correo */ }
  } else if (/^data:image|^[A-Za-z0-9+/=]{200,}$/.test(firma)) {
    const data = firma.replace(/^data:image\/\w+;base64,/, "");
    adjuntos.push({ filename: `Firma_${p.numero_guia}.png`, content: data });
  }

  const empresa = nombreEmpresa(c);
  const direccion = d ? [d.direccion, d.comuna].filter(Boolean).join(", ") : String(e.contact_address || "");
  const totalBidones = (items || []).filter((i: any) => /^R|^B/i.test(String(i.codigo || "")) || /recarga|bid[oó]n/i.test(i.nombre)).reduce((s: number, i: any) => s + (Number(i.cantidad) || 0), 0);

  const fila = (l: string, v: string) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid ${BORDE};color:${SUAVE};font-size:12px;width:150px;vertical-align:top;font-family:Arial,sans-serif;">${l}</td>
      <td style="padding:8px 0;border-bottom:1px solid ${BORDE};color:${TEXTO};font-size:13px;font-weight:700;font-family:Arial,sans-serif;">${v}</td>
    </tr>`;
  const tarjeta = (titulo: string, cuerpo: string) => `
  <tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid ${BORDE};border-radius:14px;padding:16px 20px;">
    <div style="font-size:10px;color:${ACENTO};letter-spacing:1px;text-transform:uppercase;font-weight:800;margin-bottom:8px;font-family:Arial,sans-serif;">${titulo}</div>
    ${cuerpo}
  </td></tr>`;

  const filasItems = (items || []).map((i: any) => `
      <tr>
        <td style="padding:7px 0;border-bottom:1px solid ${BORDE};font-size:13px;color:${TEXTO};font-family:Arial,sans-serif;">${esc(i.nombre)}</td>
        <td align="right" style="padding:7px 0;border-bottom:1px solid ${BORDE};font-size:13px;font-weight:700;color:${TEXTO};font-family:Arial,sans-serif;">${esc(i.cantidad)}</td>
        <td align="right" style="padding:7px 0 7px 12px;border-bottom:1px solid ${BORDE};font-size:13px;color:${TEXTO};font-family:Arial,sans-serif;white-space:nowrap;">${clp(i.subtotal ?? (Number(i.cantidad) || 0) * (Number(i.precio_unit) || 0))}</td>
      </tr>`).join("");

  const paso = (titulo: string, cuando: string, ultimo = false) => `
      <tr>
        <td width="22" valign="top" style="padding-top:3px;"><div style="width:12px;height:12px;border-radius:6px;background:${ACENTO};"></div>${ultimo ? "" : `<div style="width:2px;height:26px;background:#BAE6FD;margin-left:5px;"></div>`}</td>
        <td valign="top" style="font-size:13px;color:${TEXTO};font-family:Arial,sans-serif;"><b>${titulo}</b><br/><span style="color:${SUAVE};font-size:12px;">${cuando}</span></td>
      </tr>`;

  const bannerPrueba = prueba ? `
  <tr><td style="background:#F0F9FF;border:2px dashed ${ACENTO};border-radius:12px;padding:12px 16px;font-size:12px;color:#075985;text-align:center;font-family:Arial,sans-serif;">
    <b>CORREO DE PRUEBA</b> &middot; No fue enviado al cliente.${para.length ? ` En real ir&iacute;a a <b>${esc(para.join(", "))}</b> con copia a ${INFO}.` : ""}
  </td></tr><tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>` : "";

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td align="center" style="padding:4px 0 18px;"><img src="${LOGO}" width="80" height="100" alt="Aquatrisq" style="display:block;width:80px;height:100px;border:0;"></td></tr>
  ${bannerPrueba}
  <tr><td align="center" style="background:#FFFFFF;border:1px solid ${BORDE};border-top:4px solid ${ACENTO};border-radius:16px;padding:22px 20px;">
    <div style="color:${ACENTO};font-size:11px;font-weight:800;letter-spacing:2px;font-family:Arial,sans-serif;">RECEPCI&Oacute;N CONFORME</div>
    <div style="color:${TEXTO};font-size:21px;font-weight:900;margin-top:8px;font-family:Arial,sans-serif;">Pedido ${esc(p.numero_guia)}${p.guia_despacho_numero ? ` &middot; Gu&iacute;a N&deg; ${esc(p.guia_despacho_numero)}` : ""}</div>
    <div style="color:${SUAVE};font-size:13px;margin-top:6px;font-family:Arial,sans-serif;">Entregado el ${esc(fechaHora(e.gestionado_en || e.arrived_at))}</div>
  </td></tr>
  <tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid ${BORDE};border-radius:14px;padding:18px 20px;">
    <p style="color:${TEXTO};font-size:14px;margin:0 0 8px;font-family:Arial,sans-serif;">Hola,</p>
    <p style="color:#334155;font-size:13px;line-height:1.6;margin:0;font-family:Arial,sans-serif;">
      Un integrante de nuestro equipo de distribuci&oacute;n hizo entrega del pedido de <b>${esc(empresa)}</b> en ${esc(d?.etiqueta?.split("/")[0]?.trim() || "su bodega")}${direccion ? `, ${esc(direccion)}` : ""}.
      Te dejamos el resumen de la recepci&oacute;n${p.guia_despacho_url ? " y la gu&iacute;a de despacho electr&oacute;nica adjunta" : ""}.
    </p>
  </td></tr>
  ${tarjeta("Recibido por", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${fila("Nombre", esc(nombre || "—"))}
      ${fila("RUT", esc(rut || "—"))}
      ${obs ? fila("Observaci&oacute;n", esc(obs)) : ""}
    </table>
    ${firmaImg ? `<div style="margin-top:12px;font-size:12px;color:${SUAVE};font-family:Arial,sans-serif;">Firma</div><img src="${esc(firmaImg)}" alt="Firma" style="display:block;max-width:260px;max-height:120px;border:1px solid ${BORDE};border-radius:8px;margin-top:6px;background:#FFFFFF;">` : (adjuntos.some((a) => a.filename.startsWith("Firma")) ? `<div style="margin-top:10px;font-size:12px;color:${SUAVE};font-family:Arial,sans-serif;">Firma adjunta a este correo.</div>` : "")}`)}
  ${tarjeta("Detalle entregado", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:11px;color:${SUAVE};padding-bottom:4px;font-family:Arial,sans-serif;">Producto</td><td align="right" style="font-size:11px;color:${SUAVE};font-family:Arial,sans-serif;">Cant.</td><td align="right" style="font-size:11px;color:${SUAVE};font-family:Arial,sans-serif;">Subtotal</td></tr>
      ${filasItems}
      <tr><td style="padding-top:10px;font-size:13px;font-weight:800;color:${TEXTO};font-family:Arial,sans-serif;">Total</td><td></td><td align="right" style="padding-top:10px;font-size:15px;font-weight:900;color:${TEXTO};font-family:Arial,sans-serif;">${clp(p.monto_total)}</td></tr>
    </table>`)}
  ${tarjeta("Condiciones", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${fila("Estado de pago", "Pendiente &middot; se emitir&aacute; la factura correspondiente")}
      ${totalBidones ? fila("Bidones en pr&eacute;stamo", `${totalBidones} bidones de 20 L, a devolver al t&eacute;rmino de la temporada`) : ""}
      ${bidPend && Number(bidPend) > 0 ? fila("Bidones pendientes", esc(bidPend)) : ""}
    </table>`)}
  ${tarjeta("Trazabilidad", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${paso("Llegada al destino", esc(fechaHora(e.arrived_at)))}
      ${paso("Entrega y recepci&oacute;n", esc(fechaHora(e.gestionado_en)), true)}
    </table>`)}
  ${fotos.length ? tarjeta("Registro fotogr&aacute;fico", fotos.slice(0, 3).map((u) => `<a href="${esc(u)}" style="color:${ACENTO};font-size:13px;font-family:Arial,sans-serif;">Ver foto</a>`).join(" &middot; ")) : ""}
  <tr><td align="center" style="padding-top:22px;color:#94A3B8;font-size:11px;line-height:1.6;font-family:Arial,sans-serif;">
    <b style="color:${TEXTO};">Aquatrisq es una empresa Quantrex.</b><br/>
    Comprobante autom&aacute;tico generado al cerrar la entrega. Para consultas, responde este correo.
  </td></tr>
</table></td></tr></table></body></html>`;

  let asunto = `Aquatrisq · Recepción pedido ${p.numero_guia}${p.guia_despacho_numero ? ` · Guía N° ${p.guia_despacho_numero}` : ""} · ${empresa}`;
  if (prueba) asunto = `🧪 [PRUEBA] ${asunto}`;

  const res = await fetch(cfg.relay_url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-relay-token": cfg.relay_token },
    body: JSON.stringify({ to, cc, reply_to: [cfg.reply_to || INFO], subject: asunto, html, attachments: adjuntos }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) throw new Error(`relay: ${out.error || res.status}`);

  if (!prueba) {
    await sb(`pedidos?id=eq.${pedidoId}`, { method: "PATCH", body: JSON.stringify({ recepcion_enviada_at: new Date().toISOString(), recepcion_estado: para.length ? "enviado" : "sin_correo", recepcion_error: null }) });
  }
  return { pedido_id: pedidoId, estado: prueba ? "prueba" : "enviado", to, cc, adjuntos: adjuntos.map((a) => a.filename), nombre, rut, firma: !!firma };
}

Deno.serve(async (req) => {
  let pedidoId = "";
  try {
    const cfgs = await sb("aviso_factura_config?id=eq.1&select=*");
    const cfg = cfgs?.[0];
    if (!cfg) return Response.json({ ok: false, error: "sin configuración" }, { status: 500 });
    if ((req.headers.get("x-aviso-token") || "") !== cfg.trigger_token) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    pedidoId = String(body.pedido_id || "");
    if (!pedidoId) return Response.json({ ok: false, error: "falta pedido_id" }, { status: 400 });
    const r = await procesar(pedidoId, cfg, !!body.prueba, !!body.reenviar);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    console.error("recepcion-guia error:", e);
    if (pedidoId) await sb(`pedidos?id=eq.${pedidoId}`, { method: "PATCH", body: JSON.stringify({ recepcion_estado: "error", recepcion_error: String(e).slice(0, 500) }) }).catch(() => {});
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
