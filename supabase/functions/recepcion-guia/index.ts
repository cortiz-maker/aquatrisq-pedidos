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
//   - la guía de despacho adjunta con el sello de recepción al pie (nombre, RUT, fecha/hora,
//     observación, firma y línea de tiempo), igual que el e-Docs de Quantrex. La firma va en el PDF,
//     no en el correo. Se guarda una copia en pedidos.guia_recepcion_url.
//
// Llamada manual: { pedido_id, prueba: true } → va solo a correo_prueba, con PRUEBA en el asunto,
// y no marca el pedido como enviado. { pedido_id, reenviar: true } permite reenviar.

import * as PDFLib from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "documentos-facturas";
const LOGO = `${SUPABASE_URL}/functions/v1/logo-aquatrisq`;
const INFO = "info@quantrex.cl";
// Firma de muestra solo para correos de prueba sin entrega cerrada.
const FIRMA_EJEMPLO = "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";

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

// ---------- Sello de recepción sobre la guía (formato e-Docs Quantrex) ----------
async function conRecepcion(PDFLib: any, bytes: Uint8Array, datos: any, firmaBytes: Uint8Array | null): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const TEXTO = rgb(0.06, 0.09, 0.16), GRIS = rgb(0.39, 0.45, 0.55), LINEA = rgb(0.80, 0.88, 0.93);
  const CELESTE = rgb(0.05, 0.65, 0.91), VERDE = rgb(0.02, 0.59, 0.41), FONDO = rgb(0.94, 0.98, 1);
  const src = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  const f = await out.embedFont(StandardFonts.Helvetica);
  const fb = await out.embedFont(StandardFonts.HelveticaBold);
  let firma: any = null;
  if (firmaBytes && firmaBytes.length) {
    const esPng = firmaBytes[0] === 0x89 && firmaBytes[1] === 0x50;
    try { firma = esPng ? await out.embedPng(firmaBytes) : await out.embedJpg(firmaBytes); } catch { firma = null; }
  }
  const pags = src.getPages();
  const emb = await out.embedPages(pags);
  const S = 0.78;
  const corta = (t: any, fo: any, sz: number, max: number) => {
    let s = String(t || "");
    if (fo.widthOfTextAtSize(s, sz) <= max) return s;
    while (s.length > 3 && fo.widthOfTextAtSize(s + "…", sz) > max) s = s.slice(0, -1);
    return s + "…";
  };
  emb.forEach((ep: any, i: number) => {
    const { width: w, height: h } = pags[i].getSize();
    const p = out.addPage([w, h]);
    const dw = w * S, dh = h * S, x0 = (w - dw) / 2, y0 = h - dh - 10;
    p.drawPage(ep, { x: x0, y: y0, width: dw, height: dh });
    p.drawRectangle({ x: x0, y: y0, width: dw, height: dh, borderColor: LINEA, borderWidth: 0.6 });

    const mx = 28, ancho = w - mx * 2;
    const top = y0 - 8;
    // Encabezado del sello
    p.drawText("RECEPCIÓN CONFORME · REGISTRO DIGITAL DE ENTREGA", { x: mx, y: top - 10, size: 7.5, font: fb, color: CELESTE });
    p.drawText(`Pág. ${i + 1}/${pags.length}`, { x: w - mx - 38, y: top - 10, size: 7, font: f, color: GRIS });

    // Caja de recepción
    const cajaH = 78, cajaY = top - 16 - cajaH;
    p.drawRectangle({ x: mx, y: cajaY, width: ancho, height: cajaH, color: FONDO, borderColor: LINEA, borderWidth: 0.6 });
    const colDatos = ancho * 0.58;
    const filas = [
      ["Recibido por", datos.nombre || "—"],
      ["RUT", datos.rut || "—"],
      ["Fecha y hora", datos.fechaHora || "—"],
      ["Observación", datos.observacion || "—"],
    ];
    filas.forEach(([k, v], j) => {
      const yy = cajaY + cajaH - 16 - j * 16;
      p.drawText(k, { x: mx + 10, y: yy, size: 7.2, font: f, color: GRIS });
      p.drawText(corta(v, fb, 8.4, colDatos - 90), { x: mx + 80, y: yy, size: 8.4, font: fb, color: TEXTO });
    });
    // Firma
    const fx = mx + colDatos + 10, fw = ancho - colDatos - 20, fy = cajaY + 18, fh = cajaH - 26;
    if (firma) {
      const r = Math.min(fw / firma.width, fh / firma.height);
      const iw = firma.width * r, ih = firma.height * r;
      p.drawImage(firma, { x: fx + (fw - iw) / 2, y: fy + (fh - ih) / 2, width: iw, height: ih });
    } else {
      const t = "Sin firma digital (respaldo físico)";
      p.drawText(t, { x: fx + (fw - f.widthOfTextAtSize(t, 7)) / 2, y: fy + fh / 2, size: 7, font: f, color: GRIS });
    }
    p.drawLine({ start: { x: fx + 10, y: cajaY + 15 }, end: { x: fx + fw - 10, y: cajaY + 15 }, thickness: 0.6, color: GRIS });
    const tf = "Firma de quien recibe";
    p.drawText(tf, { x: fx + (fw - f.widthOfTextAtSize(tf, 6.5)) / 2, y: cajaY + 6, size: 6.5, font: f, color: GRIS });

    // Línea de tiempo
    const nodos = datos.nodos || [];
    const yl = cajaY - 16, paso = ancho / Math.max(nodos.length, 1);
    if (nodos.length > 1) p.drawLine({ start: { x: mx + paso / 2, y: yl }, end: { x: mx + paso * (nodos.length - 0.5), y: yl }, thickness: 1.4, color: LINEA });
    nodos.forEach((n: any, k: number) => {
      const cx = mx + paso * k + paso / 2, col = n.final ? VERDE : CELESTE;
      p.drawCircle({ x: cx, y: yl, size: 4.2, color: col });
      const ln = (t: string, dy: number, sz: number, fo: any, c: any) => {
        if (!t) return; const s = corta(t, fo, sz, paso - 10);
        p.drawText(s, { x: cx - fo.widthOfTextAtSize(s, sz) / 2, y: yl - dy, size: sz, font: fo, color: c });
      };
      ln(n.titulo, 13, 6.8, fb, col); ln(n.linea1, 22, 6.8, fb, TEXTO); ln(n.linea2, 30.5, 6.3, f, GRIS);
    });
    const nota = corta(datos.nota || "", f, 5.8, ancho);
    p.drawText(nota, { x: mx, y: Math.max(yl - 44, 8), size: 5.8, font: f, color: GRIS });
  });
  out.setTitle(`Guía de despacho con recepción · ${datos.pedido || ""}`);
  out.setProducer("Aquatrisq · plataforma Quantrex");
  return await out.save();
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
  const cerrada = (ents || []).find((x: any) => Number(x.status) === 2);
  // En prueba, si la entrega aún no se cierra, se muestran datos de recepción de ejemplo.
  const ejemplo = prueba && !cerrada;
  const ahora = new Date().toISOString();
  const e = cerrada || (ejemplo ? { ...(ents?.[0] || {}), arrived_at: ahora, gestionado_en: ahora, raw: { evaluation_answers: [
    { name: "Nombre Quien Recibe", value: "Nombre de ejemplo" },
    { name: "RUT Quien Recibe", value: "12.345.678-9" },
    { name: "Comentarios", value: "Observación de ejemplo (opcional)" },
  ] } } : null);
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

  const empresa = nombreEmpresa(c);
  // Firma (URL o base64 desde el formulario DT): va estampada en la guía, no en el correo.
  let firmaBytes: Uint8Array | null = null;
  if (/^https?:\/\//i.test(firma)) {
    try { const rf = await fetch(firma); if (rf.ok) firmaBytes = new Uint8Array(await rf.arrayBuffer()); } catch { /* sin firma */ }
  } else if (/^data:image|^[A-Za-z0-9+/=]{200,}$/.test(firma)) {
    try { firmaBytes = Uint8Array.from(atob(firma.replace(/^data:image\/\w+;base64,/, "")), (ch) => ch.charCodeAt(0)); } catch { /* sin firma */ }
  }
  if (!firmaBytes && ejemplo) firmaBytes = Uint8Array.from(atob(FIRMA_EJEMPLO), (ch) => ch.charCodeAt(0));
  // Guía: la cargada en el pedido; en prueba sin guía, una hoja de muestra para ver el formato.
  let guiaBytes: Uint8Array | null = p.guia_despacho_url ? await leerObjeto(p.guia_despacho_url) : null;
  const guiaMuestra = !guiaBytes && prueba;
  if (guiaMuestra) {
    const doc = await PDFLib.PDFDocument.create(); const pg = doc.addPage([612, 792]);
    const fb = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    pg.drawText("AQUÍ VA LA GUÍA DE DESPACHO ELECTRÓNICA", { x: 120, y: 420, size: 16, font: fb, color: PDFLib.rgb(0.6, 0.65, 0.72) });
    guiaBytes = await doc.save();
  }
  const hm = (iso: string | null | undefined) => { const t = fechaHora(iso); return (t.match(/(\d{2}:\d{2})/) || [])[1] || "—"; };
  const chofer = [String(e.chofer || p.creado_por || "").trim(), String(e.truck_identifier || "").trim()].filter(Boolean).join(" · ");
  const adjuntos: any[] = [];
  let guiaSellada: Uint8Array | null = null;
  if (guiaBytes) {
    guiaSellada = await conRecepcion(PDFLib, guiaBytes, {
      pedido: p.numero_guia,
      nombre, rut, observacion: obs,
      fechaHora: fechaHora(e.gestionado_en || e.arrived_at),
      nodos: [
        { titulo: "LLEGADA A DESTINO", linea1: `${hm(e.arrived_at)} hrs`, linea2: [d?.etiqueta?.split("/")[0]?.trim(), d?.comuna].filter(Boolean).join(", ") || String(e.contact_address || "") },
        { titulo: "ENTREGA Y RECEPCIÓN", linea1: `${hm(e.gestionado_en)} hrs`, linea2: [nombre, rut ? "RUT " + rut : ""].filter(Boolean).join(" · ") || "—", final: true },
        { titulo: "TRANSPORTE", linea1: "Aquatrisq", linea2: chofer || "—" },
      ],
      nota: `Pedido ${p.numero_guia} · ${empresa} · Registro de recepción generado por la plataforma Aquatrisq al cerrar la entrega (nombre, RUT, firma y hora). Aquatrisq es una empresa Quantrex.`,
    }, firmaBytes);
    adjuntos.push({ filename: `Guia_Despacho_${p.guia_despacho_numero || p.numero_guia}_recepcion.pdf`, content: b64(guiaSellada) });
  }
  // Copia de la guía con recepción en la plataforma (no en prueba).
  if (guiaSellada && !prueba) {
    const path = `GUIA-REC-${p.numero_guia}-${Date.now()}.pdf`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST", headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/pdf" }, body: guiaSellada,
    });
    if (up.ok) await sb(`pedidos?id=eq.${pedidoId}`, { method: "PATCH", body: JSON.stringify({ guia_recepcion_url: path }) }).catch(() => {});
  }

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
    <b>CORREO DE PRUEBA</b> &middot; No fue enviado al cliente.${ejemplo ? ` La entrega a&uacute;n no se cierra: nombre, RUT, observaci&oacute;n y horas son de ejemplo${guiaMuestra ? ", y el PDF adjunto usa una hoja de muestra en lugar de la gu&iacute;a" : ""}. La firma real queda estampada en la gu&iacute;a.` : ""}${para.length ? ` En real ir&iacute;a a <b>${esc(para.join(", "))}</b> con copia a ${INFO}.` : ""}
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
      Te dejamos el resumen de la recepci&oacute;n${guiaSellada ? " y la gu&iacute;a de despacho electr&oacute;nica adjunta, con el registro de recepci&oacute;n y la trazabilidad al pie" : ""}.
    </p>
  </td></tr>
  ${tarjeta("Recibido por", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${fila("Nombre", esc(nombre || "—"))}
      ${fila("RUT", esc(rut || "—"))}
      ${obs ? fila("Observaci&oacute;n", esc(obs)) : ""}
    </table>
    <div style="margin-top:10px;font-size:12px;color:${SUAVE};font-family:Arial,sans-serif;">${guiaSellada ? "La firma y el registro de recepci&oacute;n van estampados en la gu&iacute;a de despacho adjunta." : "Registro de recepci&oacute;n digital."}</div>`)}
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
  return { pedido_id: pedidoId, estado: prueba ? "prueba" : "enviado", to, cc, adjuntos: adjuntos.map((a) => a.filename), nombre, rut, firma: !!firmaBytes };
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
