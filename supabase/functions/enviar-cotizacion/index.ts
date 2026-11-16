// supabase/functions/enviar-cotizacion/index.ts
//
// Envío de cotización por correo — Aquatrisq (una empresa Quantrex)
// Se llama desde la app (botón "Emitir y enviar" en Cotizaciones), solo por
// usuarios admin/operador. La app guarda la cotización, genera el PDF (jsPDF,
// el mismo que "Descargar PDF") y lo manda en base64 junto al destinatario.
// El cuerpo del correo se arma con los datos guardados en la base (folio,
// ítems, total, vigencia), no con lo que venga del navegador.
//
// Envía a través del mismo relay de correo que usan los avisos de factura y
// pedido (aviso_factura_config.relay_url / relay_token), con copia a quien
// envía y reply-to a la casilla de siempre. Al enviarse, la cotización pasa a
// "enviada" y queda registrada la fecha, el destinatario y quién la envió.
//
// Color propio (verde azulado) para distinguirla del celeste de pedidos y del
// azul marino de facturas/boletas.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOGO = `${SUPABASE_URL}/functions/v1/logo-aquatrisq`;

const COLOR = "#0D9488";   // verde azulado: cotizaciones
const SUAVE = "#CCFBF1";
const AZUL = "#4472C4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

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
function esc(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const clp = (n: unknown) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
function fechaCL(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return y && m && d ? `${d}-${m}-${y}` : String(iso);
}

const rutNorm = (r: unknown) => String(r || "").replace(/[.\-\s]/g, "").toUpperCase();

// Condición especial del cliente (tabla condiciones_cotizacion, por RUT).
async function condicionPorRut(rut: string) {
  if (!rut) return null;
  const r = await sb(`condiciones_cotizacion?rut=eq.${encodeURIComponent(rut)}&activo=eq.true&select=titulo,texto`);
  return r?.[0] || null;
}

function buildHtml(c: any, items: any[], nombre: string, link: string, condicion: any = null) {
  const filas = items.map((it) => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #E2E8F0;font-size:13px;color:#0D1F3C;font-family:Arial,sans-serif;">${esc(it.nombre_producto)}</td>
        <td align="center" style="padding:9px 6px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#3F4E63;font-family:Arial,sans-serif;">${esc(it.cantidad)}</td>
        <td align="right" style="padding:9px 0;border-bottom:1px solid #E2E8F0;font-size:13px;color:#3F4E63;font-family:Arial,sans-serif;white-space:nowrap;">${clp(it.precio_unit)}</td>
        <td align="right" style="padding:9px 0 9px 8px;border-bottom:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#0D1F3C;font-family:Arial,sans-serif;white-space:nowrap;">${clp(it.subtotal)}</td>
      </tr>`).join("");

  const bloqueLink = link ? `
    <div style="font-size:13px;color:#3F4E63;line-height:1.6;margin:10px 0 12px;font-family:Arial,sans-serif;">Si decides avanzar, tambi&eacute;n puedes pagar en l&iacute;nea con tarjeta de d&eacute;bito o cr&eacute;dito a trav&eacute;s de <b>SumUp</b>, indicando el folio <b>${esc(c.folio)}</b> como referencia:</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 6px;">
      <tr><td align="center" bgcolor="${AZUL}" style="background:${AZUL};border-radius:10px;">
        <a href="${esc(link)}" target="_blank" style="display:inline-block;padding:12px 28px;color:#FFFFFF;font-size:14px;font-weight:800;text-decoration:none;font-family:Arial,sans-serif;">Pagar en l&iacute;nea &rarr;</a>
      </td></tr>
    </table>` : "";

  const notas = String(c.notas || "").trim();

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>:root { color-scheme: light; supported-color-schemes: light; }</style>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <tr><td align="center" style="padding:4px 0 18px;">
    <img src="${LOGO}" width="96" height="120" alt="Aquatrisq" style="display:block;width:96px;height:120px;border:0;">
  </td></tr>

  <tr><td align="center" bgcolor="${COLOR}" style="background:${COLOR};border-radius:16px;padding:24px 20px;">
    <div style="color:${SUAVE};font-size:11px;font-weight:800;letter-spacing:2px;font-family:Arial,sans-serif;">COTIZACI&Oacute;N</div>
    <div style="color:#FFFFFF;font-size:22px;font-weight:900;margin-top:8px;font-family:Arial,sans-serif;">Folio ${esc(c.folio)}</div>
    <div style="color:#F0FDFA;font-size:13px;margin-top:6px;font-family:Arial,sans-serif;">Emitida el ${esc(fechaCL(c.fecha_emision))}${c.fecha_vigencia ? ` &middot; V&aacute;lida hasta el ${esc(fechaCL(c.fecha_vigencia))}` : ""}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 0;">
      <tr><td bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:12px;padding:10px 22px;">
        <div style="font-size:10px;color:#64748B;letter-spacing:1px;text-transform:uppercase;font-weight:800;font-family:Arial,sans-serif;text-align:center;">Total cotizado</div>
        <div style="font-size:26px;font-weight:900;color:${COLOR};font-family:Arial,sans-serif;text-align:center;">${clp(c.total)}</div>
        <div style="font-size:10px;color:#64748B;font-family:Arial,sans-serif;text-align:center;">IVA incluido</div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="height:16px;line-height:16px;font-size:0;">&nbsp;</td></tr>

  <tr><td bgcolor="#F8FAFC" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;padding:20px;">
    <p style="color:#0D1F3C;font-size:14px;margin:0 0 8px;font-family:Arial,sans-serif;">Hola ${esc(nombre)},</p>
    <p style="color:#3F4E63;font-size:13px;line-height:1.6;margin:0 0 14px;font-family:Arial,sans-serif;">
      Te enviamos adjunta la cotizaci&oacute;n <b style="color:#0D1F3C;">${esc(c.folio)}</b> de Aquatrisq${c.fecha_vigencia ? `, v&aacute;lida hasta el <b style="color:#0D1F3C;">${esc(fechaCL(c.fecha_vigencia))}</b>` : ""}. A continuaci&oacute;n va el resumen; el detalle completo est&aacute; en el PDF.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:0 0 6px;font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:1px;font-weight:800;font-family:Arial,sans-serif;">Producto</td>
        <td align="center" style="padding:0 6px 6px;font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:1px;font-weight:800;font-family:Arial,sans-serif;">Cant.</td>
        <td align="right" style="padding:0 0 6px;font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:1px;font-weight:800;font-family:Arial,sans-serif;">Precio</td>
        <td align="right" style="padding:0 0 6px 8px;font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:1px;font-weight:800;font-family:Arial,sans-serif;">Subtotal</td>
      </tr>
      ${filas}
      <tr>
        <td colspan="3" style="padding:12px 0 0;font-size:13px;font-weight:800;color:${COLOR};font-family:Arial,sans-serif;">Total <span style="font-weight:400;color:#64748B;font-size:11px;">(IVA incluido)</span></td>
        <td align="right" style="padding:12px 0 0;font-size:15px;font-weight:900;color:${COLOR};font-family:Arial,sans-serif;white-space:nowrap;">${clp(c.total)}</td>
      </tr>
    </table>
    ${condicion ? `<div style="margin-top:14px;background:#F0FDFA;border:1px solid ${COLOR};border-radius:10px;padding:12px 14px;font-family:Arial,sans-serif;"><div style="font-size:12px;font-weight:800;color:${COLOR};margin-bottom:4px;">${esc(condicion.titulo)}</div><div style="font-size:12px;color:#3F4E63;line-height:1.6;">${esc(condicion.texto)}</div></div>` : ""}
    ${notas ? `<div style="margin-top:14px;font-size:12px;color:#3F4E63;line-height:1.6;white-space:pre-line;font-family:Arial,sans-serif;"><b style="color:#0D1F3C;">Notas / condiciones:</b><br/>${esc(notas)}</div>` : ""}
  </td></tr>

  <tr><td style="height:16px;line-height:16px;font-size:0;">&nbsp;</td></tr>

  <tr><td bgcolor="#F0FDFA" style="background:#F0FDFA;border:2px solid ${COLOR};border-radius:14px;padding:16px 20px;">
    <div style="font-size:10px;color:${COLOR};letter-spacing:1px;text-transform:uppercase;font-weight:800;margin-bottom:6px;font-family:Arial,sans-serif;">&#128179; Medios de pago</div>
    <div style="font-size:13px;color:#0D1F3C;line-height:1.6;font-family:Arial,sans-serif;">Transferencia bancaria o pago en l&iacute;nea.</div>
    ${bloqueLink}
    <div style="font-size:12px;color:#64748B;line-height:1.5;margin-top:10px;font-family:Arial,sans-serif;">Pagos a 30 d&iacute;as tienen un recargo del 30% sobre el valor cotizado (v&aacute;lido para clientes con antig&uuml;edad superior a un a&ntilde;o).</div>
  </td></tr>

  <tr><td align="center" style="padding:18px 8px 0;color:#3F4E63;font-size:13px;line-height:1.6;font-family:Arial,sans-serif;">
    Quedamos atentos a cualquier consulta para avanzar. Puedes responder directamente este correo.
  </td></tr>

  <tr><td align="center" style="padding-top:22px;color:#94A3B8;font-size:11px;font-family:Arial,sans-serif;line-height:1.6;">
    <b style="color:${COLOR};">Aquatrisq es una empresa Quantrex.</b><br/>
    Distribuci&oacute;n de agua purificada &middot; Regi&oacute;n Metropolitana &middot; Instagram @aquatrisq
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// Muestra interna: llamada desde la base con el token de avisos (x-aviso-token)
// y { muestra: { cotizacion, items }, pdf_base64 }. Usa datos de ejemplo, va
// SOLO a correo_prueba y no toca ninguna cotización real.
async function enviarMuestra(req: Request, body: any) {
  const cfg = (await sb("aviso_factura_config?id=eq.1&select=trigger_token,relay_url,relay_token,reply_to,link_pago,correo_prueba"))?.[0];
  if (!cfg || (req.headers.get("x-aviso-token") || "") !== cfg.trigger_token) return json({ ok: false, error: "no autorizado" }, 401);
  const c = body.muestra?.cotizacion || {};
  const items = body.muestra?.items || [];
  const pdf = String(body.pdf_base64 || "").replace(/^data:[^,]+,/, "");
  if (!items.length || !pdf || !emailOk(cfg.correo_prueba)) return json({ ok: false, error: "muestra incompleta" }, 400);
  const res = await fetch(cfg.relay_url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-relay-token": cfg.relay_token },
    body: JSON.stringify({
      to: [cfg.correo_prueba], cc: [], reply_to: [cfg.reply_to].filter(Boolean),
      subject: `🧪 [MUESTRA] Aquatrisq · Cotización ${c.folio} · Total ${clp(c.total)}`,
      html: buildHtml(c, items, String(c.contacto_nombre || c.razon_social || "cliente"), String(cfg.link_pago || "").trim(), await condicionPorRut(rutNorm(c.rut_empresa))),
      attachments: [{ filename: `Cotizacion_${c.folio}_Aquatrisq.pdf`, content: pdf }],
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) return json({ ok: false, error: `relay: ${out.error || res.status}` }, 502);
  return json({ ok: true, muestra: true, para: cfg.correo_prueba });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.muestra) return await enviarMuestra(req, body);

    // 1) Usuario y rol (solo admin/operador pueden enviar cotizaciones).
    const auth = req.headers.get("Authorization") || "";
    const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: auth } });
    if (!ur.ok) return json({ ok: false, error: "Sesión no válida. Vuelve a iniciar sesión." }, 401);
    const user = await ur.json();
    const perfiles = await sb(`perfiles?id=eq.${user.id}&select=nombre,rol,activo`);
    const perfil = perfiles?.[0];
    if (!perfil || perfil.activo === false || !["admin", "operador"].includes(perfil.rol)) {
      return json({ ok: false, error: "Tu usuario no tiene permiso para enviar cotizaciones." }, 403);
    }

    // 2) Datos de la llamada.
    const cotizId = String(body.cotizacion_id || "");
    const para = String(body.para || "").trim();
    const pdf = String(body.pdf_base64 || "").replace(/^data:[^,]+,/, "");
    if (!cotizId) return json({ ok: false, error: "Falta la cotización." }, 400);
    if (!emailOk(para)) return json({ ok: false, error: "El correo del destinatario no es válido." }, 400);
    if (!pdf) return json({ ok: false, error: "No llegó el PDF de la cotización." }, 400);

    // 3) Cotización e ítems desde la base.
    const [cs, items, cfgs] = await Promise.all([
      sb(`cotizaciones?id=eq.${cotizId}&select=*`),
      sb(`cotizacion_items?cotizacion_id=eq.${cotizId}&select=nombre_producto,cantidad,precio_unit,subtotal,orden&order=orden.asc`),
      sb("aviso_factura_config?id=eq.1&select=relay_url,relay_token,reply_to,link_pago"),
    ]);
    const c = cs?.[0];
    if (!c) return json({ ok: false, error: "La cotización no existe." }, 404);
    if (!items?.length) return json({ ok: false, error: "La cotización no tiene productos." }, 400);
    const cfg = cfgs?.[0];
    if (!cfg?.relay_url) return json({ ok: false, error: "Falta la configuración de correo." }, 500);

    let nombre = String(c.contacto_nombre || "").trim();
    let rutCli = rutNorm(c.rut_empresa);
    if (c.cliente_id) {
      const cli = (await sb(`clientes?id=eq.${c.cliente_id}&select=nombre,razon_social,rut`))?.[0];
      if (cli?.rut) rutCli = rutNorm(cli.rut);
      const rs = String(cli?.razon_social || "").trim();
      nombre = nombre || (/[a-záéíóúñ]/i.test(rs) ? rs : String(cli?.nombre || "")).split("/")[0].trim();
    }
    nombre = nombre || String(c.razon_social || "").trim() || "cliente";

    // 4) Envío: al cliente, copia a quien envía, respuesta a la casilla habitual.
    const copia = emailOk(user.email) && user.email.toLowerCase() !== para.toLowerCase() ? [user.email] : [];
    const asunto = `Aquatrisq · Cotización ${c.folio} · Total ${clp(c.total)}`;
    const res = await fetch(cfg.relay_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-relay-token": cfg.relay_token },
      body: JSON.stringify({
        to: [para],
        cc: copia,
        reply_to: [cfg.reply_to || user.email].filter(Boolean),
        subject: asunto,
        html: buildHtml(c, items, nombre, String(cfg.link_pago || "").trim(), await condicionPorRut(rutCli)),
        attachments: [{ filename: `Cotizacion_${c.folio}_Aquatrisq.pdf`, content: pdf }],
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) return json({ ok: false, error: `No se pudo enviar el correo (${out.error || res.status}).` }, 502);

    // 5) Registro: pasa a "enviada" (salvo que ya esté aceptada/procesada).
    const patch: Record<string, unknown> = {
      enviada_at: new Date().toISOString(),
      enviada_a: [para, ...copia],
      enviada_por: perfil.nombre || user.email,
      envios_count: (Number(c.envios_count) || 0) + 1,
    };
    if (["borrador", "enviada", "vencida"].includes(c.estado)) patch.estado = "enviada";
    await sb(`cotizaciones?id=eq.${cotizId}`, { method: "PATCH", body: JSON.stringify(patch) });

    return json({ ok: true, folio: c.folio, para, cc: copia, estado: patch.estado || c.estado });
  } catch (e) {
    console.error("enviar-cotizacion error:", e);
    return json({ ok: false, error: String(e) }, 500);
  }
});
