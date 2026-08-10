import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { PUENTE_URL, SUPABASE_URL } from "./config.js";

// ── Valores de enums (tal cual están en Postgres) ────────────
const TIPOS_PAGO = ["Efectivo", "Transferencia / Medio Digital", "Tarjeta", "Plan PrePago", "Por Cobrar", "Pedido Pagado"];
const TIPOS_DOC = ["boleta", "factura", "sin_documento"];
const MARCAS = ["TrisQ"];
const CHOFERES = ["Italo Loiza", "César Ortiz"];
// Origen de un descuento manual en pedido_descuentos (texto libre, pero acotamos).
const ORIGENES_DESC = ["cliente", "volumen", "plan", "combo", "manual"];

// Estados del ciclo de vida de una cotización.
const ESTADOS_COTIZ = ["borrador", "enviada", "aceptada", "rechazada", "vencida", "procesada"];
const ESTADO_COTIZ_LABEL = {
  borrador: "Borrador", enviada: "Enviada", aceptada: "Aceptada",
  rechazada: "Rechazada", vencida: "Vencida", procesada: "Procesada",
};

// Logo Aquatrisq embebido en base64 (JPEG) para no depender de assets externos
// al generar el PDF de cotización con jsPDF.
const LOGO_AQUATRISQ_B64 = "data:image/jpeg;base64,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";

// Medios de pago y condiciones comerciales fijas que se imprimen en toda
// cotización emitida.
const MEDIOS_PAGO_COTIZ = ["Transferencia bancaria", "Pago online"];
const RECARGO_PAGO_30_DIAS = {
  porcentaje: 30,
  texto: "Pagos a 30 días tienen un recargo del 30% sobre el valor cotizado (válido para clientes con antigüedad superior a un año).",
};

// Catálogo de equipos y planes que SOLO se cotizan (no viven en la tabla
// `productos` de Supabase porque no forman parte del flujo operativo de
// pedidos/DispatchTrack). ids con prefijo "eq-" para no chocar con las UUID
// reales de `productos`. Actualiza precios aquí cuando cambien.
const CATALOGO_EQUIPOS_COTIZ = [
  // Planes Equipos Eléctricos Aqua TrisQ: arriendo 18 meses, opción de compra
  // cuota 19, término anticipado acelera cuotas + costo pre-pago.
  { id: "eq-plan-2", codigo: "PLAN-R2", nombre: "Plan Recarga 2 — 2 Bidones 20L/mes (arriendo 18 meses)", precio_lista: 13990, grupo: "Planes equipos eléctricos" },
  { id: "eq-plan-3", codigo: "PLAN-R3", nombre: "Plan Recarga 3 — 3 Bidones 20L/mes (arriendo 18 meses)", precio_lista: 16990, grupo: "Planes equipos eléctricos" },
  { id: "eq-plan-4", codigo: "PLAN-R4", nombre: "Plan Recarga 4 — 4 Bidones 20L/mes (arriendo 18 meses)", precio_lista: 20990, grupo: "Planes equipos eléctricos" },
  { id: "eq-plan-5", codigo: "PLAN-R5", nombre: "Plan Recarga 5 — 5 Bidones 20L/mes (arriendo 18 meses)", precio_lista: 24490, grupo: "Planes equipos eléctricos" },
  { id: "eq-plan-6", codigo: "PLAN-R6", nombre: "Plan Recarga 6 — 6 Bidones 20L/mes (arriendo 18 meses)", precio_lista: 27990, grupo: "Planes equipos eléctricos" },
  { id: "eq-plan-7", codigo: "PLAN-R7", nombre: "Plan Recarga 7 — 7 Bidones 20L/mes (arriendo 18 meses)", precio_lista: 31490, grupo: "Planes equipos eléctricos" },
  { id: "eq-plan-8", codigo: "PLAN-R8", nombre: "Plan Recarga 8 — 8 Bidones 20L/mes (arriendo 18 meses)", precio_lista: 34990, grupo: "Planes equipos eléctricos" },
  { id: "eq-plan-9", codigo: "PLAN-R9", nombre: "Plan Recarga 9 — 9 Bidones 20L/mes (arriendo 18 meses)", precio_lista: 38490, grupo: "Planes equipos eléctricos" },
  { id: "eq-plan-10", codigo: "PLAN-R10", nombre: "Plan Recarga 10 — 10 Bidones 20L/mes (arriendo 18 meses)", precio_lista: 41990, grupo: "Planes equipos eléctricos" },

  // Equipos y kits
  { id: "eq-bomba-usb", codigo: "BOMBA-USB", nombre: "Bomba de agua USB", precio_lista: 14990, grupo: "Equipos y kits" },
  { id: "eq-disp-pedestal-compresor", codigo: "DISP-PED-COMP", nombre: "Dispensador Pedestal Compresor (negro)", precio_lista: 129990, grupo: "Equipos y kits" },
  { id: "eq-disp-pie-lb07b", codigo: "LB-07B", nombre: "Dispensador de Pie Compresor LB-07B (gris)", precio_lista: 109990, grupo: "Equipos y kits" },
  { id: "eq-disp-bidon-oculto", codigo: "DISP-BIDON-OCULTO", nombre: "Dispensador Pedestal Bidón Oculto + 2 Bidones 20L", precio_lista: 189990, grupo: "Equipos y kits" },
  { id: "eq-kit-hogar-2", codigo: "KH2", nombre: "Kit Hogar 2 — Dispensador básico + 2 Bidones PET 20L (agua incluida)", precio_lista: 13490, grupo: "Equipos y kits" },
];

// RUT chileno: valida formato y dígito verificador (acepta con o sin puntos, con guion).
function rutValido(rutSucio) {
  const r = String(rutSucio || "").replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(r)) return false;
  const cuerpo = r.slice(0, -1);
  const dv = r.slice(-1);
  let suma = 0, mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const resto = 11 - (suma % 11);
  const dvEsperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
  return dv === dvEsperado;
}

// Comunas de la Región Metropolitana (52), con la grafía canónica. Se usa como
// lista fija en el formulario de domicilio para evitar variantes ("providencia"
// vs "Providencia") en el origen.
const COMUNAS_RM = [
  "Alhué", "Buin", "Calera de Tango", "Cerrillos", "Cerro Navia", "Colina",
  "Conchalí", "Curacaví", "El Bosque", "El Monte", "Estación Central",
  "Huechuraba", "Independencia", "Isla de Maipo", "La Cisterna", "La Florida",
  "La Granja", "La Pintana", "La Reina", "Lampa", "Las Condes", "Lo Barnechea",
  "Lo Espejo", "Lo Prado", "Macul", "Maipú", "María Pinto", "Melipilla", "Ñuñoa",
  "Padre Hurtado", "Paine", "Pedro Aguirre Cerda", "Peñaflor", "Peñalolén",
  "Pirque", "Providencia", "Pudahuel", "Puente Alto", "Quilicura",
  "Quinta Normal", "Recoleta", "Renca", "San Bernardo", "San Joaquín",
  "San José de Maipo", "San Miguel", "San Pedro", "San Ramón", "Santiago",
  "Talagante", "Tiltil", "Vitacura",
];

// Centroides aproximados (lat, lng) de las comunas de la RM, para los PIN del mapa.
const COMUNA_COORDS = {
  "Alhué": [-34.029, -71.101], "Buin": [-33.733, -70.741], "Calera de Tango": [-33.636, -70.761],
  "Cerrillos": [-33.496, -70.718], "Cerro Navia": [-33.422, -70.737], "Colina": [-33.202, -70.675],
  "Conchalí": [-33.385, -70.675], "Curacaví": [-33.409, -71.139], "El Bosque": [-33.562, -70.675],
  "El Monte": [-33.680, -70.983], "Estación Central": [-33.461, -70.696], "Huechuraba": [-33.368, -70.639],
  "Independencia": [-33.417, -70.665], "Isla de Maipo": [-33.751, -70.899], "La Cisterna": [-33.538, -70.662],
  "La Florida": [-33.523, -70.599], "La Granja": [-33.540, -70.627], "La Pintana": [-33.583, -70.634],
  "La Reina": [-33.445, -70.538], "Lampa": [-33.287, -70.880], "Las Condes": [-33.409, -70.550],
  "Lo Barnechea": [-33.350, -70.518], "Lo Espejo": [-33.523, -70.688], "Lo Prado": [-33.444, -70.727],
  "Macul": [-33.492, -70.598], "Maipú": [-33.511, -70.758], "María Pinto": [-33.516, -71.139],
  "Melipilla": [-33.687, -71.215], "Ñuñoa": [-33.457, -70.598], "Padre Hurtado": [-33.574, -70.816],
  "Paine": [-33.808, -70.741], "Pedro Aguirre Cerda": [-33.487, -70.675], "Peñaflor": [-33.609, -70.877],
  "Peñalolén": [-33.489, -70.551], "Pirque": [-33.639, -70.549], "Providencia": [-33.431, -70.609],
  "Pudahuel": [-33.442, -70.747], "Puente Alto": [-33.611, -70.576], "Quilicura": [-33.367, -70.729],
  "Quinta Normal": [-33.428, -70.700], "Recoleta": [-33.403, -70.642], "Renca": [-33.404, -70.729],
  "San Bernardo": [-33.592, -70.700], "San Joaquín": [-33.497, -70.628], "San José de Maipo": [-33.644, -70.354],
  "San Miguel": [-33.497, -70.651], "San Pedro": [-33.897, -71.460], "San Ramón": [-33.538, -70.645],
  "Santiago": [-33.449, -70.669], "Talagante": [-33.664, -70.928], "Tiltil": [-33.088, -70.929],
  "Vitacura": [-33.390, -70.576],
};

// Normaliza un nombre de comuna para buscar sus coordenadas (sin acentos / minúsculas).
function claveComuna(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
const COORDS_POR_CLAVE = Object.fromEntries(
  Object.entries(COMUNA_COORDS).map(([nom, xy]) => [claveComuna(nom), xy])
);

// Convierte cualquier error capturado (Error normal, PostgrestError de Supabase,
// fallo de red, u objeto/array inesperado) en un texto corto y legible para la UI.
// Nunca debe mostrarse JSON crudo ni datos de tablas al usuario, así que si el
// mensaje no es un string razonable, se descarta y se usa el texto de respaldo.
function mensajeError(e, fallback) {
  if (!e) return fallback;
  if (typeof e === "string") return e.length < 200 ? e : fallback;
  const msg = e.message || e.details || e.hint || "";
  if (typeof msg === "string" && msg && msg.length < 200 && !/^[\[{]/.test(msg.trim())) {
    return msg;
  }
  return fallback;
}

// Mapa de la Región Metropolitana con un PIN por comuna, dimensionado por nº de pedidos.
// Carga Leaflet desde CDN en tiempo de ejecución (sin dependencias en el repo).
function MapaComunasRM({ comunas }) {
  const cont = useRef(null);
  const mapRef = useRef(null);
  const [listo, setListo] = useState(typeof window !== "undefined" && !!window.L);

  // Carga de Leaflet (CSS + JS) una sola vez.
  useEffect(() => {
    if (typeof window === "undefined" || window.L) { setListo(!!(typeof window !== "undefined" && window.L)); return; }
    if (!document.getElementById("leaflet-css")) {
      const css = document.createElement("link");
      css.id = "leaflet-css"; css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
    }
    let js = document.getElementById("leaflet-js");
    const onReady = () => setListo(true);
    if (!js) {
      js = document.createElement("script");
      js.id = "leaflet-js"; js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      js.onload = onReady;
      document.head.appendChild(js);
    } else {
      js.addEventListener("load", onReady);
      if (window.L) onReady();
    }
    return () => { js && js.removeEventListener && js.removeEventListener("load", onReady); };
  }, []);

  // Dibujo / actualización de los marcadores.
  useEffect(() => {
    if (!listo || !window.L || !cont.current) return;
    const L = window.L;
    if (!mapRef.current) {
      mapRef.current = L.map(cont.current, { scrollWheelZoom: false }).setView([-33.55, -70.66], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18, attribution: "© OpenStreetMap",
      }).addTo(mapRef.current);
    }
    const map = mapRef.current;
    // Limpia marcadores previos.
    if (map._aqLayer) { map.removeLayer(map._aqLayer); }
    const grupo = L.layerGroup().addTo(map);
    map._aqLayer = grupo;

    const conCoords = (comunas || [])
      .map((c) => ({ ...c, xy: COORDS_POR_CLAVE[claveComuna(c.comuna)] }))
      .filter((c) => c.xy);
    const maxK = Math.max(1, ...conCoords.map((c) => c.count));
    const puntos = [];
    conCoords.forEach((c) => {
      const r = 8 + Math.round((Math.sqrt(c.count) / Math.sqrt(maxK)) * 22); // 8–30 px
      const mk = L.circleMarker(c.xy, {
        radius: r, color: "#1f3b73", weight: 2, fillColor: "#34a07a", fillOpacity: 0.7,
      }).addTo(grupo);
      mk.bindTooltip(`${c.comuna} · ${c.count} ped.`, { direction: "top" });
      mk.bindPopup(`<strong>${c.comuna}</strong><br/>${c.count} pedido(s)`);
      puntos.push(c.xy);
    });
    if (puntos.length) {
      try { map.fitBounds(L.latLngBounds(puntos).pad(0.2)); } catch { /* noop */ }
    }
    setTimeout(() => map.invalidateSize(), 80);
  }, [listo, comunas]);

  return (
    <div>
      <div ref={cont} className="aq-mapa" />
      {!listo && <p className="aq-muted" style={{ marginTop: 8 }}>Cargando mapa…</p>}
    </div>
  );
}

const CLP = (n) =>
  "$" + (Number(n) || 0).toLocaleString("es-CL", { maximumFractionDigits: 0 });

// Mensaje que ve el operador y que se envía por correo al cliente.
function mensajeConfirmacion(guia, nombreCliente) {
  const nombre = (nombreCliente || "").trim();
  return `¡Hola! 👋
Tu Pedido N° ${guia} ha sido ingresado a nuestra agenda y se encuentra programado para despacho el día de mañana. 🚚💧

📲 Síguenos en Instagram @aquatrisq y no olvides etiquetarnos cuando recibas tu pedido. ¡Nos encanta conocer tu experiencia y ver cómo disfrutas nuestros productos! 💦💙

🟡 Información Importante:
• Si solicitaste recargas, recuerda tener disponibles para intercambio la misma cantidad de bidones.
• Las fechas de despacho podrían sufrir modificaciones por motivos operacionales. En caso de cualquier cambio, te informaremos oportunamente por este mismo medio.

💳 Para tu comodidad, también puedes realizar el pago de forma rápida y segura a través de nuestro enlace de pago:
https://pay.sumup.com/b2c/Q4EFMRBM

📝 Importante al momento de pagar:
• Ingresa el monto correspondiente a tu pedido.
• En el campo "Tu nombre completo", por favor escribe tu nombre junto con el número de pedido o factura (${nombre} - N° ${guia}).

Una vez realizado el pago, agradeceremos nos envíes el comprobante por este mismo medio para actualizar nuestros registros.

¡Muchas gracias por preferirnos!
Saludos, Equipo TrisQ 💧`;
}

// Email válido (mismo criterio que la normalización de la base).
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;
const emailValido = (e) => !!e && EMAIL_RE.test(String(e).trim());

// Precio sugerido de un producto según su modo de descuento por volumen.
function precioSugerido(prod, cantidad, tramos) {
  if (!prod) return 0;
  const base = prod.precio_lista || 0;
  const modo = prod.modo_descuento_volumen || "ninguno";
  if (modo === "tramos") {
    const delProd = tramos
      .filter((t) => t.producto_id === prod.id)
      .sort((a, b) => Number(a.cantidad_min) - Number(b.cantidad_min));
    const m = delProd.find(
      (t) =>
        cantidad >= Number(t.cantidad_min) &&
        (t.cantidad_max == null || cantidad <= Number(t.cantidad_max))
    );
    return m ? m.precio_unit : base;
  }
  if (modo === "porcentaje") {
    const umbral = prod.desc_volumen_umbral;
    const pct = prod.desc_volumen_pct;
    if (umbral != null && pct != null && cantidad >= Number(umbral)) {
      return Math.round(base * (1 - Number(pct) / 100));
    }
    return base;
  }
  return base;
}

// Estado de entrega legible a partir del retorno de DispatchTrack (fila dt_entregas).
// status: 1 = pendiente/en ruta, 2 = gestionado. El substatus indica el resultado
// (p.ej. "Venta" = entregado con venta, o un motivo de no entrega). Si no hay fila
// de entrega, caemos al estado de sincronización del pedido.
function estadoEntregaDT(entrega, pedido) {
  if (entrega) {
    const sub = (entrega.substatus || "").toString();
    const gestionado = !!entrega.gestionado_en || Number(entrega.status) >= 2;
    if (gestionado) {
      const noEntrega = /no entreg|fallid|rechaz|sin morador|sin moradores|error|ausente|fuera horario/i.test(sub);
      if (noEntrega) return { label: "No entregado" + (sub ? " · " + sub : ""), cls: "bad" };
      return { label: "Entregado" + (sub ? " · " + sub : ""), cls: "ok" };
    }
    return { label: "En ruta / pendiente", cls: "warn" };
  }
  if (pedido && pedido.estado_sync === "enviado_dt") return { label: "En DT", cls: "warn" };
  return { label: "Pendiente", cls: "warn" };
}

// Respuestas del formulario del chofer, extraídas del payload crudo (raw.evaluation_answers
// o raw.form_answers). Defensivo ante el nombre de la llave del valor.
function answersFromRaw(entrega) {
  if (!entrega || !entrega.raw) return [];
  const raw = entrega.raw;
  const arr = raw.evaluation_answers || raw.form_answers || raw.end_form_answers || [];
  if (!Array.isArray(arr)) return [];
  return arr
    .map((a) => {
      const name = a.name || a.question || a.label || "";
      let val = a.value;
      if (val === undefined || val === null || val === "") val = a.answer ?? a.text ?? a.option ?? a.selected ?? a.url ?? "";
      if (Array.isArray(val)) val = val.join(", ");
      if (val && typeof val === "object") val = val.url || val.name || JSON.stringify(val);
      return { name, val: val == null ? "" : String(val) };
    })
    .filter((x) => x.name && x.val !== "");
}

// ¿El chofer marcó "Pago = No" en el formulario de entrega? (= entregado sin pagar)
function respPago(entrega) {
  const a = answersFromRaw(entrega).find((x) => x.name.trim().toLowerCase() === "pago");
  return a ? a.val : null;
}
function esPagoNo(entrega) {
  const v = respPago(entrega);
  return v != null && /^\s*no\s*$/i.test(String(v));
}
function montoEntrega(entrega) {
  const a = answersFromRaw(entrega).find((x) => /monto venta/i.test(x.name));
  if (!a) return 0;
  const n = Number(String(a.val).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
// Compra Proveedor: substatus = "Compra Proveedor", campo "Prooveedor" contiene "Aguas Altas"
// Monto: campo "Monto Factura"
function esCompraProveedor(entrega) {
  if (!entrega) return false;
  const sub = (entrega.substatus || "").trim();
  return sub === "Compra Proveedor";
}
function montoCompraProveedor(entrega) {
  const a = answersFromRaw(entrega).find((x) => /monto factura/i.test(x.name));
  if (!a) return 0;
  const n = Number(String(a.val).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
// Rendición Efectivo: substatus = "Compra", campo "Tipo Compra" = "Rendición Efectivo"
// Monto: campo "Monto Compra"
function esRendicionEfectivo(entrega) {
  if (!entrega) return false;
  const sub = (entrega.substatus || "").trim();
  if (sub !== "Compra") return false;
  const a = answersFromRaw(entrega).find((x) => /tipo compra/i.test(x.name));
  return a ? /rendici[oó]n efectivo/i.test(a.val) : false;
}
function montoRendicion(entrega) {
  const a = answersFromRaw(entrega).find((x) => /monto compra/i.test(x.name));
  if (!a) return 0;
  const n = Number(String(a.val).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
// Efectivo Recaudado: substatus = "Venta", Pago = "Sí", Medio Pago = "Efectivo"
// Monto: campo "Monto Venta"
function esEfectivoRecaudado(entrega) {
  if (!entrega) return false;
  if ((entrega.substatus || "").trim() !== "Venta") return false;
  const ans = answersFromRaw(entrega);
  const pago = ans.find((x) => /^pago$/i.test(x.name.trim()));
  if (!pago || !/^\s*s[íi]\s*$/i.test(String(pago.val))) return false;
  const medio = ans.find((x) => /medio.*pago/i.test(x.name));
  return medio ? /efectivo/i.test(String(medio.val)) : false;
}
function montoEfectivoRecaudado(entrega) {
  const a = answersFromRaw(entrega).find((x) => /monto venta/i.test(x.name));
  if (!a) return 0;
  const n = Number(String(a.val).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
// ── Caja del chofer: Compra operativa, Estado de factura y Proveedor ──
// "Tipo Compra" de una compra (substatus = "Compra"). Ej.: "Combustible", "Insumos", "Rendición Efectivo".
function tipoCompra(entrega) {
  const a = answersFromRaw(entrega).find((x) => /tipo compra/i.test(x.name));
  return a && a.val ? String(a.val).trim() : "";
}
// Compra operativa (substatus = "Compra") que NO es Rendición Efectivo. Monto: campo "Monto Compra".
function esCompraNoRendicion(entrega) {
  if (!entrega) return false;
  if ((entrega.substatus || "").trim() !== "Compra") return false;
  return !esRendicionEfectivo(entrega);
}
function montoCompra(entrega) {
  const a = answersFromRaw(entrega).find((x) => /monto compra/i.test(x.name));
  if (!a) return 0;
  const n = Number(String(a.val).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
// Estado de pago de una "Compra Proveedor": en DispatchTrack el campo se llama
// "Estado de Pago" (a veces "Estado De Pago") y toma "Pagado" | "Pendiente".
// Toleramos también la grafía "Estado Factura" por si conviviera en formularios antiguos.
function estadoPagoProveedor(entrega) {
  const a = answersFromRaw(entrega).find((x) => /estado\s*(de\s*)?(pago|factura)/i.test(x.name));
  return a && a.val ? String(a.val).trim() : "";
}
function esCompraProvPagada(entrega) {
  return esCompraProveedor(entrega) && /pagad/i.test(estadoPagoProveedor(entrega));
}
function esCompraProvPendiente(entrega) {
  return esCompraProveedor(entrega) && /pendient/i.test(estadoPagoProveedor(entrega));
}
// Nombre del proveedor (campo "Proveedor" / "Prooveedor" — toleramos ambas grafías).
function nombreProveedor(entrega) {
  const a = answersFromRaw(entrega).find((x) => /pro+veedor/i.test(x.name));
  return a && a.val ? String(a.val).trim() : "Proveedor sin nombre";
}

// ── Gestión de facturas y bidones pendientes (formulario "Recepción Pedido", substatus Venta) ──
// ¿La fila de dt_entregas ya fue cerrada por el chofer? (mismo criterio que estadoEntregaDT).
function entregaGestionada(entrega) {
  return !!entrega && (!!entrega.gestionado_en || Number(entrega.status) >= 2);
}
// Campo "Tipo de Documento" (obligatorio en substatus Venta). Alternativas configuradas en DT:
// "Boleta / Voucher" | "Factura / Guia Despacho".
function tipoDocumentoEntregaDT(entrega) {
  const a = answersFromRaw(entrega).find((x) => /^tipo\s*de\s*documento$/i.test(x.name.trim()));
  return a && a.val ? String(a.val).trim() : "";
}
// Pedido cerrado con subestado "Venta" cuyo Tipo de Documento indica Factura (requiere emisión).
function esVentaConFactura(entrega) {
  if (!entrega || !entregaGestionada(entrega)) return false;
  if ((entrega.substatus || "").trim() !== "Venta") return false;
  return /factura/i.test(tipoDocumentoEntregaDT(entrega));
}
// Campo "N° Boleta/Factura/Voucher" — número referencial que el chofer puede dejar en terreno
// (no es necesariamente el folio tributario final, por eso la app permite registrar el propio).
function numeroDocRefDT(entrega) {
  const a = answersFromRaw(entrega).find((x) => /n.?\s*boleta.*factura.*voucher/i.test(x.name));
  return a && a.val ? String(a.val).trim() : "";
}
// Bidones vacíos pendientes de retiro, según el campo numeral "Bidón Pendiente de Entrega".
function bidonesPendientesDT(entrega) {
  if (!entrega || !entregaGestionada(entrega)) return 0;
  const n = Number(entrega.bidon_pendiente);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ── Reglas de caja compartidas (panel gerencial + mantenedor de deudas) ──
const normGuia = (g) => String(g || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
// Guías excluidas de todo cálculo de caja.
const EXCLUIR_GUIAS = new Set(["AQ00015", "AQ00012", "AQ00006"]);
// Chofer real cuando DispatchTrack dejó el campo vacío. Clave = guía sin guiones.
const CHOFER_OVERRIDE = { "AQ00043": "Felipe Hernandez" };
// Compras Proveedor mal marcadas "Pagado" en DispatchTrack y que están PENDIENTES.
const FORZAR_PENDIENTE = new Set(["AQ00013", "AQ00193", "AQ00249"]);

// Lee del formulario de "Compra Proveedor" (DispatchTrack) las unidades por
// formato. Tolerante a la grafía del nombre del campo: busca 20/12/10 + "lt".
function numFrom(v) {
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function unidadesCompraProveedor(entrega) {
  let u20 = 0, u12 = 0, u10 = 0;
  answersFromRaw(entrega).forEach((a) => {
    const nm = (a.name || "").toLowerCase();
    if (/20\s*l/.test(nm)) u20 += numFrom(a.val);
    else if (/12\s*l/.test(nm)) u12 += numFrom(a.val);
    else if (/10\s*l/.test(nm)) u10 += numFrom(a.val);
  });
  return { u20, u12, u10 };
}

// ── Resumen ejecutivo de caja (Excel, una hoja por chofer) ──────────
// Carga SheetJS desde CDN bajo demanda: NO requiere tocar package.json ni
// instalar nada en Vercel. Arma un libro con: Resumen general · una hoja por
// chofer (con su detalle) · Pendiente de pago a proveedor.
let _sheetJsPromise = null;
function cargarSheetJS() {
  if (typeof window !== "undefined" && window.XLSX) return Promise.resolve(window.XLSX);
  if (_sheetJsPromise) return _sheetJsPromise;
  _sheetJsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error("No se pudo cargar SheetJS"));
    document.head.appendChild(s);
  });
  return _sheetJsPromise;
}
function nombreHojaUnico(s, usados) {
  let base = String(s || "Chofer").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Chofer";
  let n = base, i = 2;
  while (usados.has(n.toLowerCase())) { n = base.slice(0, 26) + " " + i; i++; }
  usados.add(n.toLowerCase());
  return n;
}
async function descargarResumenEjecutivo(ger) {
  const ef = ger?.efectivo;
  if (!ef) return;
  const XLSX = await cargarSheetJS();
  const wb = XLSX.utils.book_new();
  const usados = new Set();
  const hoy = new Date();
  const corteTxt = hoy.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });

  // 1) Resumen general
  const resumen = [
    ["Resumen ejecutivo de caja", ""],
    ["Corte al", corteTxt],
    ["Generado", hoy.toLocaleString("es-CL")],
    ["", ""],
    ["Concepto", "Monto"],
    ["Recaudación de efectivo", ef.recaudacion],
    ["(−) Compras (Tipo ≠ Rendición Efectivo)", -ef.comprasNoRend],
    ["(−) Compra Proveedor pagada", -ef.compraProvPagado],
    ["(−) Rendición de efectivo entregada", -ef.rendicion],
    ["= Efectivo a Rendir", ef.aRendir],
    ["", ""],
    ["Pendiente de pago a proveedor", ger.provPendiente?.total || 0],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), nombreHojaUnico("Resumen", usados));

  // 2) Una hoja por chofer
  (ef.choferes || []).forEach((c) => {
    const filas = [
      ["Chofer", c.chofer],
      ["Corte al", corteTxt],
      ["", ""],
      ["Concepto", "Monto"],
      ["Recaudación", c.recaudacion],
      ["Compras (≠ rendición)", -c.comprasNoRend],
      ["Compra proveedor pagada", -c.compraProvPagado],
      ["Rendición entregada", -c.rendicion],
      ["A Rendir", c.aRendir],
      ["", ""],
    ];
    const recCh = (ef.recaudaciones || []).filter((x) => x.chofer === c.chofer);
    if (recCh.length) {
      filas.push(["Detalle recaudación", ""], ["Guía", "Monto"]);
      recCh.forEach((x) => filas.push([x.guide || "", x.monto]));
      filas.push(["", ""]);
    }
    const comprasCh = (ef.compras || []).filter((x) => x.chofer === c.chofer);
    if (comprasCh.length) {
      filas.push(["Detalle compras (≠ rendición)", "", ""], ["Tipo", "Guía", "Monto"]);
      comprasCh.forEach((x) => filas.push([x.tipo, x.guide || "", x.monto]));
      filas.push(["", "", ""]);
    }
    const provCh = (ef.compraProvPagadoDet || []).filter((x) => x.chofer === c.chofer);
    if (provCh.length) {
      filas.push(["Detalle compra proveedor pagada", "", ""], ["Proveedor", "Guía", "Monto"]);
      provCh.forEach((x) => filas.push([x.proveedor, x.guide || "", x.monto]));
      filas.push(["", "", ""]);
    }
    const rendCh = (ef.rendiciones || []).filter((x) => x.chofer === c.chofer);
    if (rendCh.length) {
      filas.push(["Detalle rendiciones de efectivo", ""], ["Guía", "Monto"]);
      rendCh.forEach((x) => filas.push([x.guide || "", x.monto]));
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), nombreHojaUnico(c.chofer, usados));
  });

  // 3) Pendiente de pago a proveedor
  const pend = [
    ["Pendiente de pago a proveedor", "", "", ""],
    ["Corte al", corteTxt, "", ""],
    ["", "", "", ""],
    ["Proveedor", "Guía", "Chofer", "Monto"],
  ];
  (ger.provPendiente?.proveedores || []).forEach((p) => {
    (p.facturas || []).forEach((f) => pend.push([p.proveedor, f.guide || "", f.chofer || "", f.monto]));
  });
  pend.push(["", "", "Total", ger.provPendiente?.total || 0]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pend), nombreHojaUnico("Pendiente proveedor", usados));

  XLSX.writeFile(wb, `Resumen_ejecutivo_caja_${hoy.toISOString().slice(0, 10)}.xlsx`);
}

// ── Caja del mes (Efectivo a Rendir + Pendiente proveedor) para un mesKey ──
// Reutilizable por el panel gerencial y por el dashboard admin/operador.
//
// IMPORTANTE: "Efectivo a Rendir" y "Pendiente pago proveedor" son SALDOS (estado actual),
// no flujos del mes — por eso se calculan de forma ACUMULATIVA (todas las guías hasta el
// fin del mes consultado), para que lo pendiente de un mes que se resuelve (rendición o
// pago de factura) en un mes posterior se refleje correctamente y no quede "perdido".
// "Costo recargas del mes" en cambio SÍ es un flujo y se mantiene acotado al mes exacto.
async function calcularCajaMes(mesKey) {
  const efectivo = {
    recaudacion: 0, comprasNoRend: 0, compraProvPagado: 0, rendicion: 0, aRendir: 0,
    compras: [], rendiciones: [], compraProvPagadoDet: [], recaudaciones: [], choferes: [],
  };
  let provPendiente = { total: 0, count: 0, proveedores: [] };
  let provResumen = { generado: 0, pagado: 0, pendiente: 0 };
  let costo = { total: 0, u20: 0, u12: 0, u10: 0, porDia: [] };
  try {
    // Límite superior EXCLUSIVO = primer día del mes siguiente a mesKey.
    const [ay, am] = mesKey.split("-").map(Number);
    const limiteSup = new Date(ay, am, 1).toISOString().slice(0, 10);

    // Todas las guías creadas hasta el fin de mesKey (acumulado, sin límite inferior).
    const { data: peds } = await supabase
      .from("pedidos").select("created_at, numero_guia").lt("created_at", limiteSup);
    const guiasDelMesSet = new Set(); // sólo para "costo recargas": flujo exacto del mes.
    const guiasHasta = [];
    const vistos = new Set();
    (peds || []).forEach((p) => {
      if (!p.numero_guia) return;
      if ((p.created_at || "").slice(0, 7) === mesKey) guiasDelMesSet.add(p.numero_guia);
      if (!vistos.has(p.numero_guia)) { vistos.add(p.numero_guia); guiasHasta.push(p.numero_guia); }
    });
    let entsMes = [];
    for (let i = 0; i < guiasHasta.length; i += 200) {
      const lote = guiasHasta.slice(i, i + 200);
      if (!lote.length) break;
      const { data } = await supabase.from("dt_entregas").select("*").in("guide", lote);
      entsMes = entsMes.concat(data || []);
    }
    const porGuia = {};
    entsMes.forEach((e) => {
      if (!e.guide) return;
      const t = e.gestionado_en ? new Date(e.gestionado_en).getTime() : 0;
      const prev = porGuia[e.guide];
      const tp = prev?.gestionado_en ? new Date(prev.gestionado_en).getTime() : -1;
      if (!prev || t >= tp) porGuia[e.guide] = e;
    });
    // Pagos a proveedor: acumulado (sin filtrar por mes) — un pago hecho en cualquier
    // momento debe reflejarse siempre, sin importar en qué mes se generó la factura.
    // Traemos TODOS los registros (no solo pagado=true) para poder restar los
    // abonos parciales del saldo pendiente — si no, el dashboard mostraba el
    // monto completo de la factura aunque ya tuviera un abono registrado.
    const pagadosSet = new Set();
    const abonadoMap = {};
    try {
      const { data: pgs } = await supabase
        .from("pagos_proveedor").select("numero_guia, pagado, abonado");
      (pgs || []).forEach((p) => {
        if (p.pagado) pagadosSet.add(normGuia(p.numero_guia));
        if (Number(p.abonado) > 0) abonadoMap[normGuia(p.numero_guia)] = Number(p.abonado);
      });
    } catch { /* tabla aún no creada */ }
    let generadoProv = 0, pagadoProvTotal = 0;
    const diasCosto = {};
    const chofMap = {};
    const slotChofer = (nombre) => {
      if (!chofMap[nombre]) chofMap[nombre] = { chofer: nombre, recaudacion: 0, comprasNoRend: 0, compraProvPagado: 0, rendicion: 0, aRendir: 0 };
      return chofMap[nombre];
    };
    Object.values(porGuia).forEach((e) => {
      const gN = normGuia(e.guide);
      if (EXCLUIR_GUIAS.has(gN)) return;
      const chofer = CHOFER_OVERRIDE[gN] || (e.chofer || "").trim() || "Sin chofer";
      const sc = slotChofer(chofer);
      if (esEfectivoRecaudado(e)) {
        const m = montoEfectivoRecaudado(e);
        efectivo.recaudacion += m; sc.recaudacion += m;
        efectivo.recaudaciones.push({ guide: e.guide, monto: m, chofer });
      }
      if (esCompraNoRendicion(e)) {
        const m = montoCompra(e);
        efectivo.comprasNoRend += m; sc.comprasNoRend += m;
        efectivo.compras.push({ guide: e.guide, monto: m, tipo: tipoCompra(e) || "Compra", chofer });
      }
      if (esRendicionEfectivo(e)) {
        const m = montoRendicion(e);
        efectivo.rendicion += m; sc.rendicion += m;
        efectivo.rendiciones.push({ guide: e.guide, monto: m, chofer });
      }
      const esProv = esCompraProveedor(e);
      if (esProv) {
        // Costo real por unidades del formulario (20L $600 · 12/10L $300).
        // Flujo del mes exacto: sólo cuenta si la guía se creó dentro de mesKey.
        if (guiasDelMesSet.has(e.guide)) {
          const un = unidadesCompraProveedor(e);
          if (un.u20 || un.u12 || un.u10) {
            const c = un.u20 * 600 + (un.u12 + un.u10) * 300;
            costo.total += c; costo.u20 += un.u20; costo.u12 += un.u12; costo.u10 += un.u10;
            const dia = (e.gestionado_en || "").slice(0, 10) || mesKey;
            if (!diasCosto[dia]) diasCosto[dia] = { dia, total: 0, u20: 0, u12: 0, u10: 0, items: [] };
            const d = diasCosto[dia];
            d.total += c; d.u20 += un.u20; d.u12 += un.u12; d.u10 += un.u10;
            d.items.push({ guide: e.guide, proveedor: nombreProveedor(e), u20: un.u20, u12: un.u12, u10: un.u10, costo: c });
          }
        }
        const m = montoCompraProveedor(e);
        generadoProv += m;
        const abonado = abonadoMap[gN] || 0;
        const saldo = Math.max(0, m - abonado);
        const pagadoApp = pagadosSet.has(gN);
        const pagadoDT = !FORZAR_PENDIENTE.has(gN) && esCompraProvPagada(e);
        const pagada = pagadoApp || pagadoDT;
        if (pagada) pagadoProvTotal += m;
        else pagadoProvTotal += abonado; // abono parcial también cuenta como "pagado/abonado" acumulado
        if (pagadoDT) {
          efectivo.compraProvPagado += m; sc.compraProvPagado += m;
          efectivo.compraProvPagadoDet.push({ guide: e.guide, monto: m, proveedor: nombreProveedor(e), chofer });
        }
        if (!pagada && saldo > 0) {
          provPendiente.total += saldo;
          provPendiente.count += 1;
          const nom = nombreProveedor(e);
          const slot = provPendiente.proveedores.find((x) => x.proveedor === nom);
          if (slot) {
            slot.monto += saldo; slot.count += 1; slot.guias.push(e.guide);
            if (!slot.choferes.includes(chofer)) slot.choferes.push(chofer);
            slot.facturas.push({ guide: e.guide, monto: saldo, chofer });
          } else {
            provPendiente.proveedores.push({
              proveedor: nom, monto: saldo, count: 1, guias: [e.guide],
              choferes: [chofer], facturas: [{ guide: e.guide, monto: saldo, chofer }],
            });
          }
        }
      }
    });
    efectivo.aRendir = efectivo.recaudacion - efectivo.comprasNoRend - efectivo.compraProvPagado - efectivo.rendicion;
    efectivo.choferes = Object.values(chofMap).map((c) => ({
      ...c, aRendir: c.recaudacion - c.comprasNoRend - c.compraProvPagado - c.rendicion,
    })).sort((a, b) => b.aRendir - a.aRendir);
    provPendiente.proveedores.sort((a, b) => b.monto - a.monto);
    provResumen = { generado: generadoProv, pagado: pagadoProvTotal, pendiente: provPendiente.total };
    costo.porDia = Object.values(diasCosto).sort((a, b) => a.dia.localeCompare(b.dia));
  } catch { /* si falla, caja en cero */ }
  return { efectivo, provPendiente, provResumen, costo };
}

export default function App() {
  const credsListas =
    SUPABASE_URL && !SUPABASE_URL.startsWith("PEGA_");

  // Catálogos
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [tramos, setTramos] = useState([]);
  const [todosDomicilios, setTodosDomicilios] = useState([]); // índice para buscar por identificador_dt (215-1)
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  // Selección de cliente / domicilio / plan
  const [buscarCliente, setBuscarCliente] = useState("");
  const [cliente, setCliente] = useState(null);
  const [domicilios, setDomicilios] = useState([]);
  const [domicilioId, setDomicilioId] = useState("");
  const [planPrepago, setPlanPrepago] = useState(null);
  const [descCliente, setDescCliente] = useState([]);
  const [consumePlan, setConsumePlan] = useState(false);

  // Líneas y descuentos
  const [items, setItems] = useState([]);
  const [descuentos, setDescuentos] = useState([]);

  // Cabecera
  const [tipoDocumento, setTipoDocumento] = useState("boleta");
  const [tipoPago, setTipoPago] = useState("Por Cobrar");
  const [rutFactura, setRutFactura] = useState("");
  const [marca, setMarca] = useState("TrisQ");
  // Fecha de entrega: mañana 09:00 → 17:00 por defecto
  function fechaManana(hora) {
    const d = new Date(); d.setDate(d.getDate() + 1);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${hora}`;
  }
  const [fechaMin, setFechaMin] = useState(() => fechaManana("09:00"));
  const [fechaMax, setFechaMax] = useState(() => fechaManana("17:00"));
  // Fecha de entrega: hoy (usada por el perfil distribuidor)
  function fechaHoy(hora) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${hora}`;
  }
  const [observacion, setObservacion] = useState("");
  const [creadoPor, setCreadoPor] = useState("");
  const [nroDte, setNroDte] = useState("");

  // Nº de pedido reservado al iniciar la toma (correlativo atómico desde la base).
  const [numeroReservado, setNumeroReservado] = useState(null);
  const [reservandoNum, setReservandoNum] = useState(false);
  const [errorReserva, setErrorReserva] = useState("");

  // Guardado
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok, guia, sync, msg }

  // Navegación entre vistas: inicio (dashboard) | nuevo | mantenedor | confirmacion
  const [vista, setVista] = useState("inicio");
  const [confirma, setConfirma] = useState(null); // { guia, mensaje, emailEnviado, emailDestino, sync }

  // ── Autenticación (Supabase Auth) ──────────────────────────
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [rol, setRol] = useState(null);           // admin | operador | gerencial | distribuidor
  const [perfilNombre, setPerfilNombre] = useState("");
  // Datos duros del distribuidor (de su fila en `perfiles`): nombre de chofer e
  // identificador_dt de su propio domicilio (ej. "215-1"). Quedan fijos al login.
  const [distChofer, setDistChofer] = useState("");
  const [distIdentDt, setDistIdentDt] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [logueando, setLogueando] = useState(false);

  // ── Dashboard gerencial (solo lectura, con gráficos) ───────
  const [ger, setGer] = useState(null);
  const [cargandoGer, setCargandoGer] = useState(false);
  const [errorGer, setErrorGer] = useState("");
  const [popEfectivo, setPopEfectivo] = useState(false);   // pop-up "Efectivo a Rendir"
  const [popProveedor, setPopProveedor] = useState(false); // pop-up "Pendiente pago proveedor"
  const [mixVista, setMixVista] = useState("torta");       // "torta" | "barras"

  // ── Mantenedor de deudas a proveedor (admin/operador) ──────
  const [deudasProv, setDeudasProv] = useState(null);       // [{guide, proveedor, monto, chofer, pagado, ...}]
  const [cargandoDeudas, setCargandoDeudas] = useState(false);
  const [errorDeudas, setErrorDeudas] = useState("");
  const [pagoModal, setPagoModal] = useState(null);         // factura en proceso de pago
  const [pagoFoto, setPagoFoto] = useState(null);           // File del respaldo bancario
  const [subiendoPago, setSubiendoPago] = useState(false);
  const [errorPago, setErrorPago] = useState("");
  const [seleccionPago, setSeleccionPago] = useState({});   // numero_guia -> bool (marca masiva, solo admin)
  const [guardandoPagoMasivo, setGuardandoPagoMasivo] = useState(false);
  // ── Abonos parciales (cobro a cliente + deuda proveedor) ──
  const [abonoModal, setAbonoModal] = useState(null);       // { tipo:"cobro"|"proveedor", ...datos, saldo }
  const [abonoMonto, setAbonoMonto] = useState("");         // input monto del abono
  const [abonoHist, setAbonoHist] = useState([]);           // historial de abonos del ítem abierto
  const [guardandoAbono, setGuardandoAbono] = useState(false);
  const [errorAbono, setErrorAbono] = useState("");

  // ── Caja y costo del mes para el dashboard admin/operador ──
  const [cajaMes, setCajaMes] = useState(null);     // {efectivo, provPendiente, provResumen, costo}
  const [popCosto, setPopCosto] = useState(false);  // pop-up de detalle de costo
  // Fuente de la caja para los pop-ups: gerencial usa su panel; admin/operador el dashboard.
  const cajaView = rol === "gerencial" ? ger : cajaMes;

  // Agregar email faltante al cliente desde el formulario
  const [emailNuevo, setEmailNuevo] = useState("");
  const [guardandoEmail, setGuardandoEmail] = useState(false);

  // Dashboard por mes calendario
  const hoyPeriodo = () => new Date().toISOString().slice(0, 7); // YYYY-MM
  const [periodo, setPeriodo] = useState(hoyPeriodo());
  const [pedidosMes, setPedidosMes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("todos"); // todos | enviados | pendientes
  const [buscarPedido, setBuscarPedido] = useState("");
  const [cargandoDash, setCargandoDash] = useState(false);
  const [errorDash, setErrorDash] = useState("");

  // Evolución mensual (últimos 6 meses) para el dashboard admin/operador —
  // misma lógica y componente visual que usa el panel gerencial.
  const [evolucion, setEvolucion] = useState(null);
  const [cargandoEvo, setCargandoEvo] = useState(false);
  const [errorEvo, setErrorEvo] = useState("");

  // Mantenedor de bloqueo
  const [buscarMant, setBuscarMant] = useState("");
  const [clienteMant, setClienteMant] = useState(null);
  const [domMant, setDomMant] = useState(null);
  const [bloqMant, setBloqMant] = useState(false);
  const [motivoMant, setMotivoMant] = useState("");
  const [operadorMant, setOperadorMant] = useState("");
  const [guardandoMant, setGuardandoMant] = useState(false);
  const [okMant, setOkMant] = useState("");

  // ── Cotizaciones (admin/operador) ───────────────────────────
  // Para clientes existentes y potenciales (persona/empresa aún no ingresada,
  // solo con RUT de empresa). Al "procesar" una cotización de un potencial se
  // crea recién ahí la ficha en `clientes` (es_empresa=true) y queda enlazada.
  const [cotizaciones, setCotizaciones] = useState([]);
  const [cargandoCotiz, setCargandoCotiz] = useState(false);
  const [errorCotiz, setErrorCotiz] = useState("");
  const [buscarCotiz, setBuscarCotiz] = useState("");
  const [filtroEstadoCotiz, setFiltroEstadoCotiz] = useState("todas"); // todas | borrador | enviada | aceptada | rechazada | vencida | procesada
  const [cotizEdit, setCotizEdit] = useState(null); // cotización en edición/alta (null = listado)
  const [itemsCotiz, setItemsCotiz] = useState([]);
  const [cotizClienteTipo, setCotizClienteTipo] = useState("existente"); // existente | potencial
  const [buscarCotizCliente, setBuscarCotizCliente] = useState("");
  const [guardandoCotiz, setGuardandoCotiz] = useState(false);
  const [okCotiz, setOkCotiz] = useState("");
  const [procesandoCotiz, setProcesandoCotiz] = useState(false);
  const [generandoPdfCotiz, setGenerandoPdfCotiz] = useState(false);

  // Fichas técnicas de producto (opcionales, se anexan a la cotización por
  // línea). Cache en memoria por clave de producto: "id:<uuid>" para
  // productos reales, "nom:<nombre>" para ítems del catálogo fijo de
  // equipos/planes (sin FK a `productos`).
  const [fichasProducto, setFichasProducto] = useState({}); // clave -> fila de fichas_producto | null (null = ya se buscó y no existe)
  const [fichaEditKey, setFichaEditKey] = useState(null); // key del ítem (it.key) cuya ficha se está editando, o null
  const [fichaEditDraft, setFichaEditDraft] = useState(null); // borrador { producto_id, producto_nombre, descripcion, imagen_url, garantia, specs: [{label,value}] }
  const [guardandoFicha, setGuardandoFicha] = useState(false);
  const [okFicha, setOkFicha] = useState("");

  // ── Bloque 4: mantenedores (sub-pestañas) ──────────────────
  const [mantTab, setMantTab] = useState("clientes"); // clientes | productos | perfiles

  // Mantenedor de clientes (alta / edición)
  const [cliEdit, setCliEdit] = useState(null);   // objeto cliente en edición (null = ninguno)
  const [guardandoCli, setGuardandoCli] = useState(false);
  const [okCli, setOkCli] = useState("");
  const [semaforoCli, setSemaforoCli] = useState(null);
  const [domEdit, setDomEdit] = useState(null);    // domicilio en edición { id?, cliente_id, identificador_dt, etiqueta, direccion, comuna, es_principal, _nuevo }
  const [guardandoDom, setGuardandoDom] = useState(false);
  const [okDom, setOkDom] = useState("");
  const [errDom, setErrDom] = useState(""); // { cls, dias, label } o null
  // Historial de pedidos del cliente
  const [histPedidos, setHistPedidos] = useState(null); // null = no cargado
  const [cargandoHist, setCargandoHist] = useState(false);
  const [errorHist, setErrorHist] = useState("");
  const [histItems, setHistItems] = useState({});       // pedido_id -> items[]
  const [histAbierto, setHistAbierto] = useState(null);  // pedido_id expandido
  const [histEntregas, setHistEntregas] = useState({});  // numero_guia -> fila dt_entregas (retorno DispatchTrack)

  // ── Facturas por emitir (Venta + Tipo de Documento = Factura) ──
  const [facturasPend, setFacturasPend] = useState(null);
  const [cargandoFact, setCargandoFact] = useState(false);
  const [errorFact, setErrorFact] = useState("");
  const [facturaInputs, setFacturaInputs] = useState({});     // clave (guías separadas por coma) -> texto en edición
  const [facturaArchivos, setFacturaArchivos] = useState({}); // clave -> File (PDF) opcional
  const [guardandoFacturaGuia, setGuardandoFacturaGuia] = useState(null);
  const [grupoAbierto, setGrupoAbierto] = useState({});       // "fact-<clienteId>" | "bid-<clienteId>" -> bool

  // ── Bidones pendientes de retiro (campo "Bidón Pendiente de Entrega") ──
  const [bidonesPend, setBidonesPend] = useState(null);
  const [cargandoBid, setCargandoBid] = useState(false);
  const [errorBid, setErrorBid] = useState("");
  const [guardandoBidonGuia, setGuardandoBidonGuia] = useState(null);
  const [bidonesCorrelativo, setBidonesCorrelativo] = useState({}); // clienteId -> texto correlativo de retiro

  // Aviso en "Nuevo pedido": el cliente elegido tiene bidones marcados para
  // retirar en su próximo pedido.
  const [avisoBidones, setAvisoBidones] = useState(null); // { cantidad, guias }

  // ── Cobranza / gestión de cobro (Pago = No en el formulario de entrega) ──
  const [entregasMap, setEntregasMap] = useState({});   // guide -> dt_entregas (pedidos del dashboard)
  const [pedidoModal, setPedidoModal] = useState(null);  // { pedido, entrega } para el popup de detalle
  const [pedidoEdit, setPedidoEdit] = useState(null);
  const [itemsModal, setItemsModal] = useState([]);      // items editables en el modal
  const [guardandoPed, setGuardandoPed] = useState(false);
  const [okPed, setOkPed] = useState("");
  const [errPed, setErrPed] = useState("");
  const [enviandoDT, setEnviandoDT] = useState(false);
  const [cobranzas, setCobranzas] = useState(null);      // lista de gestión de cobro (null = no cargado)
  const [cargandoCob, setCargandoCob] = useState(false);
  const [errorCob, setErrorCob] = useState("");
  const [okCob, setOkCob] = useState("");
  const [filtroCob, setFiltroCob] = useState("pendientes"); // pendientes | gestionados | todos
  const [buscarCob, setBuscarCob] = useState("");           // texto de búsqueda en gestión de cobro
  const [guardandoCob, setGuardandoCob] = useState("");  // id del pedido en proceso
  const [avisoDeuda, setAvisoDeuda] = useState(null);    // { guias:[], monto } alerta en Nuevo pedido
  const [cobExpand, setCobExpand] = useState({});        // cliente_id -> grupo expandido en Cobranzas
  const [cobroRespaldoPedido, setCobroRespaldoPedido] = useState(null); // id de pedido con panel de respaldo abierto
  const [cobroRespaldoArchivo, setCobroRespaldoArchivo] = useState(null); // File del comprobante (opcional)

  // Mantenedor de productos (admin)
  const [productosAll, setProductosAll] = useState([]);
  const [cargandoProd, setCargandoProd] = useState(false);
  const [errorProd, setErrorProd] = useState("");
  const [buscarProd, setBuscarProd] = useState("");
  const [prodEdit, setProdEdit] = useState(null); // producto en edición (con _nuevo:true si es alta)
  const [guardandoProd, setGuardandoProd] = useState(false);
  const [okProd, setOkProd] = useState("");

  // Mantenedor de perfiles (admin)
  const [perfiles, setPerfiles] = useState([]);
  const [cargandoPerf, setCargandoPerf] = useState(false);
  const [errorPerf, setErrorPerf] = useState("");
  const [perfEdit, setPerfEdit] = useState(null); // perfil en edición
  const [guardandoPerf, setGuardandoPerf] = useState(false);
  const [okPerf, setOkPerf] = useState("");

  // ── Bloque 5: repetir última compra ────────────────────────
  const [repitiendo, setRepitiendo] = useState(false);
  const [avisoRepetir, setAvisoRepetir] = useState("");

  // ── Carga inicial de catálogos ─────────────────────────────
  useEffect(() => {
    if (!credsListas) {
      setCargando(false);
      return;
    }
    if (!session) {
      // Con RLS activo, los datos se leen autenticado: esperamos al login.
      setCargando(false);
      return;
    }
    setCargando(true);
    (async () => {
      // Supabase devuelve máximo 1000 filas por consulta. clientes y
      // domicilios superan eso, así que los traemos paginando en bloques.
      const traerTodo = async (tabla, columnas) => {
        const PAGE = 1000;
        let desde = 0;
        let acumulado = [];
        for (;;) {
          const { data, error } = await supabase
            .from(tabla)
            .select(columnas)
            .range(desde, desde + PAGE - 1);
          if (error) throw error;
          acumulado = acumulado.concat(data || []);
          if (!data || data.length < PAGE) break;
          desde += PAGE;
        }
        return acumulado;
      };

      const intentarCarga = async () => {
        const [cli, dom, p, t] = await Promise.all([
          traerTodo("clientes", "*"),
          traerTodo("domicilios", "id,cliente_id,identificador_dt,etiqueta,direccion,comuna,es_principal"),
          supabase.from("productos").select("*").eq("activo", true).order("nombre"),
          supabase.from("precio_tramos").select("*"),
        ]);
        if (p.error) throw p.error;
        if (t.error) throw t.error;
        cli.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
        setClientes(cli);
        setProductos(p.data || []);
        setTramos(t.data || []);
        setTodosDomicilios(dom);
      };

      // La carga inicial hace varias llamadas en paralelo; un hipo de red
      // intermitente puede tumbar una sola de ellas. Antes de mostrarle un
      // error al usuario, reintentamos un par de veces (lo mismo que lograba
      // recargar la página a mano, pero automático).
      const REINTENTOS = 2;
      for (let intento = 0; intento <= REINTENTOS; intento++) {
        try {
          await intentarCarga();
          setErrorCarga("");
          break;
        } catch (e) {
          if (intento === REINTENTOS) {
            setErrorCarga(mensajeError(e, "No se pudieron cargar los catálogos. Verifica tu conexión e intenta de nuevo."));
          } else {
            await new Promise((res) => setTimeout(res, 800 * (intento + 1)));
          }
        }
      }
      setCargando(false);
    })();
  }, [credsListas, session]);

  // ── Dashboard: pedidos del mes calendario seleccionado ─────
  async function cargarDashboard(per) {
    if (!credsListas || !session) return;
    setCargandoDash(true);
    setErrorDash("");
    try {
      const [y, m] = per.split("-").map(Number);
      const desde = new Date(y, m - 1, 1).toISOString();
      const hasta = new Date(y, m, 1).toISOString();
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .gte("created_at", desde)
        .lt("created_at", hasta)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const peds = data || [];
      setPedidosMes(peds);
      // Entregas DT del período (para el popup y el estado de cobro en el listado)
      const guias = peds.map((p) => p.numero_guia).filter(Boolean);
      if (guias.length) {
        const mapa = {};
        const CH = 200;
        for (let i = 0; i < guias.length; i += CH) {
          const lote = guias.slice(i, i + CH);
          const { data: ents } = await supabase.from("dt_entregas").select("*").in("guide", lote);
          (ents || []).forEach((e) => { if (e.guide) mapa[e.guide] = e; });
        }
        setEntregasMap(mapa);
      } else {
        setEntregasMap({});
      }

      // Caja del mes (Efectivo a Rendir + Pendiente proveedor + Costo recargas).
      try { setCajaMes(await calcularCajaMes(per)); } catch { setCajaMes(null); }
    } catch (e) {
      setErrorDash(mensajeError(e, "No se pudo cargar el período."));
      setPedidosMes([]);
    } finally {
      setCargandoDash(false);
    }
  }
  useEffect(() => {
    if (vista === "inicio" && rol !== "distribuidor" && rol !== "gerencial") cargarDashboard(periodo);
    if (vista === "inicio" && (rol === "admin" || rol === "operador") && session && credsListas) cargarEvolucion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, periodo, credsListas, session, rol]);

  // ── Carga del dashboard gerencial (últimos 6 meses) ────────
  // Evolución mensual (últimos 6 meses) — versión liviana para admin/operador,
  // misma agregación que la sección "Evolución" del panel gerencial, más la
  // sumatoria de Compras (operativa) + Compra Proveedor por mes (línea, en vez
  // de conteo de pedidos).
  async function cargarEvolucion() {
    if (!credsListas || !session) return;
    setCargandoEvo(true); setErrorEvo("");
    try {
      const ahora = new Date();
      const ini = new Date(ahora.getFullYear(), ahora.getMonth() - 5, 1);
      const desde = ini.toISOString();
      const { data: peds, error: ePed } = await supabase
        .from("pedidos")
        .select("created_at, monto_total, numero_guia")
        .gte("created_at", desde);
      if (ePed) throw ePed;
      const pedidos = peds || [];
      const meses = [];
      for (let k = 5; k >= 0; k--) {
        const d = new Date(ahora.getFullYear(), ahora.getMonth() - k, 1);
        const key = d.toISOString().slice(0, 7);
        const lab = d.toLocaleDateString("es-CL", { month: "short" });
        meses.push({ key, label: lab.charAt(0).toUpperCase() + lab.slice(1, 3), count: 0, monto: 0, compras: 0 });
      }
      const idxMes = Object.fromEntries(meses.map((m, i) => [m.key, i]));
      pedidos.forEach((p) => {
        const key = (p.created_at || "").slice(0, 7);
        if (key in idxMes) {
          meses[idxMes[key]].count += 1;
          meses[idxMes[key]].monto += Number(p.monto_total) || 0;
        }
      });
      // Compras (operativa) + Compra Proveedor por mes, según la fecha en que el
      // chofer gestionó la entrega en DispatchTrack.
      const guias = [...new Set(pedidos.map((p) => p.numero_guia).filter(Boolean))];
      let ents = [];
      for (let i = 0; i < guias.length; i += 200) {
        const lote = guias.slice(i, i + 200);
        if (!lote.length) break;
        const { data } = await supabase.from("dt_entregas").select("*").in("guide", lote);
        ents = ents.concat(data || []);
      }
      const porGuia = {};
      ents.forEach((e) => {
        if (!e.guide) return;
        const t = e.gestionado_en ? new Date(e.gestionado_en).getTime() : 0;
        const prev = porGuia[e.guide];
        const tp = prev?.gestionado_en ? new Date(prev.gestionado_en).getTime() : -1;
        if (!prev || t >= tp) porGuia[e.guide] = e;
      });
      Object.values(porGuia).forEach((e) => {
        if (!e.gestionado_en) return;
        const key = new Date(e.gestionado_en).toISOString().slice(0, 7);
        if (!(key in idxMes)) return;
        let m = 0;
        if (esCompraNoRendicion(e)) m += montoCompra(e);
        if (esCompraProveedor(e)) m += montoCompraProveedor(e);
        if (m) meses[idxMes[key]].compras += m;
      });
      const mesActual = meses[meses.length - 1] || { count: 0, monto: 0, compras: 0 };
      setEvolucion({ meses, mesActual });
    } catch (e) {
      setErrorEvo(mensajeError(e, "No se pudo cargar la evolución mensual."));
      setEvolucion(null);
    } finally {
      setCargandoEvo(false);
    }
  }
  async function cargarGerencial() {
    if (!credsListas || !session) return;
    setCargandoGer(true);
    setErrorGer("");
    try {
      const ahora = new Date();
      const ini = new Date(ahora.getFullYear(), ahora.getMonth() - 5, 1);
      const desde = ini.toISOString();

      const { data: peds, error: ePed } = await supabase
        .from("pedidos")
        .select("id, created_at, monto_total, por_cobrar, domicilio_id, numero_guia")
        .gte("created_at", desde)
        .order("created_at", { ascending: true });
      if (ePed) throw ePed;
      const pedidos = peds || [];

      // Ítems de esos pedidos (para el mix de productos)
      let itemsMix = [];
      const ids = pedidos.map((p) => p.id);
      if (ids.length) {
        const CHUNK = 200;
        for (let i = 0; i < ids.length; i += CHUNK) {
          const lote = ids.slice(i, i + CHUNK);
          const { data: it, error: eIt } = await supabase
            .from("pedido_items")
            .select("nombre, codigo, cantidad, subtotal, pedido_id")
            .in("pedido_id", lote);
          if (eIt) throw eIt;
          itemsMix = itemsMix.concat(it || []);
        }
      }

      // 1) Evolución mensual: últimos 6 meses
      const meses = [];
      for (let k = 5; k >= 0; k--) {
        const d = new Date(ahora.getFullYear(), ahora.getMonth() - k, 1);
        const key = d.toISOString().slice(0, 7);
        const lab = d.toLocaleDateString("es-CL", { month: "short" });
        meses.push({ key, label: lab.charAt(0).toUpperCase() + lab.slice(1, 3), count: 0, monto: 0 });
      }
      const idxMes = Object.fromEntries(meses.map((m, i) => [m.key, i]));
      pedidos.forEach((p) => {
        const key = (p.created_at || "").slice(0, 7);
        if (key in idxMes) {
          meses[idxMes[key]].count += 1;
          meses[idxMes[key]].monto += Number(p.monto_total) || 0;
        }
      });

      // 2) Mix de productos (por cantidad y valor)
      const mapProd = {};
      itemsMix.forEach((it) => {
        const nom = it.nombre || it.codigo || "—";
        if (!mapProd[nom]) mapProd[nom] = { nombre: nom, cantidad: 0, valor: 0 };
        mapProd[nom].cantidad += Number(it.cantidad) || 0;
        mapProd[nom].valor += Number(it.subtotal) || 0;
      });
      const mix = Object.values(mapProd).sort((a, b) => b.cantidad - a.cantidad).slice(0, 7);

      // 3) Pedidos por comuna (vía domicilio → comuna)
      // Pedidos por comuna — normalizamos para fusionar variantes ("Providencia"
      // y "providencia" cuentan como una). La etiqueta visible es la variante más
      // frecuente (y, a igualdad, la mejor capitalizada).
      const normComuna = (s) => String(s || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
        .toLowerCase().replace(/\s+/g, " ").trim();
      const mapCom = {};
      pedidos.forEach((p) => {
        const dom = domPorId[p.domicilio_id];
        const raw = (dom && dom.comuna && String(dom.comuna).trim()) ? String(dom.comuna).trim() : "Sin comuna";
        const key = normComuna(raw) || "sin comuna";
        if (!mapCom[key]) mapCom[key] = { count: 0, labels: {} };
        mapCom[key].count += 1;
        mapCom[key].labels[raw] = (mapCom[key].labels[raw] || 0) + 1;
      });
      const empiezaMayus = (s) => /^[A-ZÁÉÍÓÚÑ]/.test(s) ? 0 : 1;
      const comunas = Object.values(mapCom)
        .map((g) => {
          const label = Object.entries(g.labels)
            .sort((a, b) => b[1] - a[1] || empiezaMayus(a[0]) - empiezaMayus(b[0]) || a[0].localeCompare(b[0]))[0][0];
          return { comuna: label, count: g.count };
        })
        .sort((a, b) => b.count - a.count);

      // KPIs del mes actual
      const mesActual = meses[meses.length - 1] || { count: 0, monto: 0 };
      const porCobrarMes = pedidos
        .filter((p) => (p.created_at || "").slice(0, 7) === hoyPeriodo() && p.por_cobrar)
        .reduce((s, p) => s + (Number(p.monto_total) || 0), 0);
      const ticket = mesActual.count ? Math.round(mesActual.monto / mesActual.count) : 0;

      // Deuda vencida +30 días (histórico): entregas Pago=No no cobradas, gestionadas hace +30 días
      let venc30 = { monto: 0, count: 0 };
      try {
        const { data: ents } = await supabase
          .from("dt_entregas").select("*")
          .not("gestionado_en", "is", null)
          .order("gestionado_en", { ascending: false })
          .limit(1000);
        const pagoNo = (ents || []).filter((e) => esPagoNo(e));
        const guias = [...new Set(pagoNo.map((e) => e.guide).filter(Boolean))];
        const entByGuide = {};
        pagoNo.forEach((e) => { if (e.guide) entByGuide[e.guide] = e; });
        let pp = [];
        for (let i = 0; i < guias.length; i += 200) {
          const lote = guias.slice(i, i + 200);
          if (!lote.length) break;
          const { data } = await supabase.from("pedidos").select("numero_guia, monto_total, cobro_cobrado").in("numero_guia", lote);
          pp = pp.concat(data || []);
        }
        const ahora = Date.now();
        pp.forEach((p) => {
          if (p.cobro_cobrado) return;
          const e = entByGuide[p.numero_guia];
          const g = e?.gestionado_en ? new Date(e.gestionado_en).getTime() : null;
          if (g && (ahora - g) > 30 * 86400000) { venc30.monto += Number(p.monto_total) || 0; venc30.count += 1; }
        });
      } catch { /* si falla, dejamos venc30 en cero */ }

      // ── Caja del mes: Efectivo a Rendir y Pendiente de pago a proveedor ──
      const { efectivo, provPendiente, provResumen } = await calcularCajaMes(hoyPeriodo());

      setGer({ meses, mix, comunas, mesActual, porCobrarMes, ticket, venc30, efectivo, provPendiente, provResumen });
    } catch (e) {
      setErrorGer(mensajeError(e, "No se pudo cargar el panel gerencial."));
      setGer(null);
    } finally {
      setCargandoGer(false);
    }
  }
  useEffect(() => {
    if (rol === "gerencial" && vista === "inicio") cargarGerencial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol, vista, session, todosDomicilios]);

  // ── Mantenedor de deudas a proveedor (admin/operador) ──────
  // Muestra TODAS las facturas de proveedor pendientes, sin importar el mes en que se
  // generaron (antes sólo mostraba las del mes en curso y las deudas de meses anteriores
  // "desaparecían" de esta pantalla al cambiar de mes aunque siguieran sin pagarse).
  // Ventana: últimos 12 meses hacia atrás desde hoy, para acotar el volumen de datos
  // sin perder facturas pendientes recientes.
  async function cargarDeudasProv() {
    setCargandoDeudas(true); setErrorDeudas("");
    try {
      const hoy = new Date();
      const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1).toISOString().slice(0, 10);
      const { data: peds, error: ePed } = await supabase
        .from("pedidos")
        .select("created_at, numero_guia")
        .gte("created_at", desde);
      if (ePed) throw ePed;
      const mesPorGuia = {}; // guía → mes de origen (mes del pedido, no el mes actual)
      const guias = [];
      const vistos = new Set();
      (peds || []).forEach((p) => {
        if (!p.numero_guia) return;
        const m = (p.created_at || "").slice(0, 7);
        if (!mesPorGuia[p.numero_guia]) mesPorGuia[p.numero_guia] = m;
        if (!vistos.has(p.numero_guia)) { vistos.add(p.numero_guia); guias.push(p.numero_guia); }
      });
      let entsMes = [];
      for (let i = 0; i < guias.length; i += 200) {
        const lote = guias.slice(i, i + 200);
        if (!lote.length) break;
        const { data } = await supabase.from("dt_entregas").select("*").in("guide", lote);
        entsMes = entsMes.concat(data || []);
      }
      const porGuia = {};
      entsMes.forEach((e) => {
        if (!e.guide) return;
        const t = e.gestionado_en ? new Date(e.gestionado_en).getTime() : 0;
        const prev = porGuia[e.guide];
        const tp = prev?.gestionado_en ? new Date(prev.gestionado_en).getTime() : -1;
        if (!prev || t >= tp) porGuia[e.guide] = e;
      });
      // Pagos ya registrados en la app (fuente de verdad del "pagado") — sin filtrar por
      // mes: un pago o abono registrado en cualquier momento debe reflejarse siempre.
      const pagosMap = {};
      try {
        const { data: pgs } = await supabase.from("pagos_proveedor").select("*");
        (pgs || []).forEach((p) => { pagosMap[normGuia(p.numero_guia)] = p; });
      } catch { /* tabla aún no creada */ }
      const lista = [];
      Object.values(porGuia).forEach((e) => {
        const gN = normGuia(e.guide);
        if (EXCLUIR_GUIAS.has(gN)) return;
        if (!esCompraProveedor(e)) return;
        const pago = pagosMap[gN];
        const pagadoApp = !!(pago && pago.pagado);
        const pagadoDT = !FORZAR_PENDIENTE.has(gN) && esCompraProvPagada(e);
        const monto = montoCompraProveedor(e);
        const abonado = Number(pago?.abonado) || 0;
        lista.push({
          numero_guia: e.guide,
          proveedor: nombreProveedor(e),
          monto,
          abonado,
          saldo: Math.max(0, monto - abonado),
          chofer: CHOFER_OVERRIDE[gN] || (e.chofer || "").trim() || "Sin chofer",
          mes: mesPorGuia[e.guide] || pago?.mes || hoyPeriodo(),
          pagado: pagadoApp || pagadoDT,
          origenPago: pagadoApp ? "app" : (pagadoDT ? "dispatchtrack" : null),
          fecha_pago: pago?.fecha_pago || null,
          pagado_por: pago?.pagado_por || null,
          respaldo_path: pago?.respaldo_path || null,
        });
      });
      lista.sort((a, b) => Number(a.pagado) - Number(b.pagado) || (a.mes < b.mes ? 1 : a.mes > b.mes ? -1 : 0) || b.monto - a.monto);
      setDeudasProv(lista);
    } catch (e) {
      setErrorDeudas(mensajeError(e, "No se pudieron cargar las deudas."));
      setDeudasProv(null);
    } finally {
      setCargandoDeudas(false);
    }
  }
  // ── Facturas por emitir: pedidos cerrados subestado "Venta" con Tipo de Documento = Factura ──
  // Facturas por emitir: filtro server-side por substatus="Venta" y por fecha,
  // en vez de traer TODAS las entregas de 12 meses (causa principal de la lentitud).
  async function cargarFacturasPend() {
    setCargandoFact(true); setErrorFact("");
    try {
      const hoy = new Date();
      const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 8, 1).toISOString().slice(0, 10);
      const { data: peds, error: ePed } = await supabase
        .from("pedidos")
        .select("id, numero_guia, cliente_id, domicilio_id, monto_total, rut_factura, numero_documento_emitido, documento_emitido_en, documento_emitido_url, factura_no_requerida, factura_diferida")
        .gte("created_at", desde);
      if (ePed) throw ePed;
      const pedPorGuia = {};
      const guias = [];
      (peds || []).forEach((p) => {
        if (!p.numero_guia) return;
        pedPorGuia[p.numero_guia] = p;
        guias.push(p.numero_guia);
      });
      // Solo pedimos las columnas que necesitamos (evitamos "select *" con el
      // JSON completo de respuestas para todo lo que no sea Venta con factura).
      let ents = [];
      for (let i = 0; i < guias.length; i += 200) {
        const lote = guias.slice(i, i + 200);
        if (!lote.length) break;
        const { data } = await supabase
          .from("dt_entregas")
          .select("guide, substatus, gestionado_en, raw")
          .in("guide", lote);
        ents = ents.concat(data || []);
      }
      const entPorGuia = {};
      ents.forEach((e) => {
        if (!e.guide) return;
        const prev = entPorGuia[e.guide];
        const t = e.gestionado_en ? new Date(e.gestionado_en).getTime() : 0;
        const tp = prev?.gestionado_en ? new Date(prev.gestionado_en).getTime() : -1;
        if (!prev || t >= tp) entPorGuia[e.guide] = e;
      });
      const lista = [];
      Object.values(entPorGuia).forEach((e) => {
        if (!esVentaConFactura(e)) return;
        const p = pedPorGuia[e.guide];
        if (!p) return;
        const gestionadoEn = e.gestionado_en ? new Date(e.gestionado_en) : null;
        const dias = gestionadoEn ? Math.floor((Date.now() - gestionadoEn.getTime()) / 86400000) : 0;
        lista.push({
          numero_guia: p.numero_guia,
          pedidoId: p.id,
          cliente_id: p.cliente_id,
          domicilio_id: p.domicilio_id,
          monto: montoEntrega(e) || Number(p.monto_total) || 0,
          numeroRef: numeroDocRefDT(e),
          rutFactura: p.rut_factura || "",
          gestionadoEn,
          dias,
          numero_documento_emitido: p.numero_documento_emitido || "",
          documento_emitido_en: p.documento_emitido_en || null,
          documento_emitido_url: p.documento_emitido_url || null,
          factura_no_requerida: !!p.factura_no_requerida,
          factura_diferida: !!p.factura_diferida,
        });
      });
      lista.sort((a, b) => b.dias - a.dias);
      setFacturasPend(lista);
    } catch (e) {
      setErrorFact(mensajeError(e, "No se pudieron cargar las facturas por emitir."));
      setFacturasPend(null);
    } finally {
      setCargandoFact(false);
    }
  }
  // Guarda el N° de documento (y opcionalmente el PDF emitido) para todas las
  // guías indicadas de una sola vez — cubre el caso de un cliente que acumula
  // varios pedidos y recibe una sola factura consolidada. El archivo es opcional.
  async function guardarDocumentoEmitidoGrupo(guias, valor, archivo) {
    const v = (valor || "").trim();
    if (!v || !guias.length) return;
    const clave = guias.join(",");
    setGuardandoFacturaGuia(clave);
    try {
      let url = null;
      if (archivo) {
        const ext = (archivo.name.split(".").pop() || "pdf").toLowerCase();
        const path = `${guias[0]}-${Date.now()}.${ext}`;
        const up = await supabase.storage
          .from("documentos-facturas")
          .upload(path, archivo, { upsert: false, contentType: archivo.type || "application/pdf" });
        if (up.error) throw up.error;
        url = path;
      }
      const patch = { numero_documento_emitido: v, documento_emitido_en: new Date().toISOString() };
      if (url) patch.documento_emitido_url = url;
      const { error } = await supabase.from("pedidos").update(patch).in("numero_guia", guias);
      if (error) throw error;
      await cargarFacturasPend();
      setFacturaInputs((prev) => { const n = { ...prev }; delete n[clave]; return n; });
      setFacturaArchivos((prev) => { const n = { ...prev }; delete n[clave]; return n; });
    } catch (e) {
      setErrorFact(mensajeError(e, "No se pudo guardar el número de documento."));
    } finally {
      setGuardandoFacturaGuia(null);
    }
  }
  async function deshacerDocumentoEmitido(guia) {
    if (!window.confirm("¿Marcar esta factura nuevamente como pendiente de emitir?")) return;
    setGuardandoFacturaGuia(guia);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ numero_documento_emitido: null, documento_emitido_en: null, documento_emitido_url: null })
        .eq("numero_guia", guia);
      if (error) throw error;
      await cargarFacturasPend();
    } catch (e) {
      setErrorFact(mensajeError(e, "No se pudo actualizar."));
    } finally {
      setGuardandoFacturaGuia(null);
    }
  }
  // "Emitir al cierre de mes": queda pendiente pero deja de contar como atrasada.
  async function marcarFacturaDiferidaGrupo(guias) {
    const clave = guias.join(",");
    setGuardandoFacturaGuia(clave);
    try {
      const { error } = await supabase.from("pedidos").update({ factura_diferida: true }).in("numero_guia", guias);
      if (error) throw error;
      await cargarFacturasPend();
    } catch (e) {
      setErrorFact(mensajeError(e, "No se pudo actualizar."));
    } finally {
      setGuardandoFacturaGuia(null);
    }
  }
  async function deshacerFacturaDiferida(guia) {
    setGuardandoFacturaGuia(guia);
    try {
      const { error } = await supabase.from("pedidos").update({ factura_diferida: false }).eq("numero_guia", guia);
      if (error) throw error;
      await cargarFacturasPend();
    } catch (e) {
      setErrorFact(mensajeError(e, "No se pudo actualizar."));
    } finally {
      setGuardandoFacturaGuia(null);
    }
  }
  async function marcarFacturaNoRequeridaGrupo(guias) {
    if (!window.confirm(`¿Marcar ${guias.length} pedido(s) como "no requiere factura"? Dejarán de contar como pendientes.`)) return;
    const clave = guias.join(",");
    setGuardandoFacturaGuia(clave);
    try {
      const { error } = await supabase.from("pedidos").update({ factura_no_requerida: true }).in("numero_guia", guias);
      if (error) throw error;
      await cargarFacturasPend();
    } catch (e) {
      setErrorFact(mensajeError(e, "No se pudo actualizar."));
    } finally {
      setGuardandoFacturaGuia(null);
    }
  }
  async function deshacerFacturaNoRequerida(guia) {
    setGuardandoFacturaGuia(guia);
    try {
      const { error } = await supabase.from("pedidos").update({ factura_no_requerida: false }).eq("numero_guia", guia);
      if (error) throw error;
      await cargarFacturasPend();
    } catch (e) {
      setErrorFact(mensajeError(e, "No se pudo actualizar."));
    } finally {
      setGuardandoFacturaGuia(null);
    }
  }
  async function verDocumentoEmitido(path) {
    try {
      const { data, error } = await supabase.storage.from("documentos-facturas").createSignedUrl(path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      alert("No se pudo abrir el documento: " + mensajeError(e, "error desconocido"));
    }
  }

  // ── Bidones pendientes de retiro (filtro server-side por bidon_pendiente>0) ──
  async function cargarBidonesPend() {
    setCargandoBid(true); setErrorBid("");
    try {
      const hoy = new Date();
      const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 8, 1).toISOString().slice(0, 10);
      const { data: peds, error: ePed } = await supabase
        .from("pedidos")
        .select("id, numero_guia, cliente_id, domicilio_id, bidones_retirados_en, bidones_proximo_pedido, bidones_retiro_guia")
        .gte("created_at", desde);
      if (ePed) throw ePed;
      const pedPorGuia = {};
      const guias = [];
      (peds || []).forEach((p) => {
        if (!p.numero_guia) return;
        pedPorGuia[p.numero_guia] = p;
        guias.push(p.numero_guia);
      });
      // No necesitamos la columna "raw" (JSON completo) para bidones — el dato
      // vive en su propia columna, así que el fetch es mucho más liviano.
      let ents = [];
      for (let i = 0; i < guias.length; i += 200) {
        const lote = guias.slice(i, i + 200);
        if (!lote.length) break;
        const { data } = await supabase
          .from("dt_entregas")
          .select("guide, status, gestionado_en, chofer, bidon_pendiente")
          .in("guide", lote);
        ents = ents.concat(data || []);
      }
      const entPorGuia = {};
      ents.forEach((e) => {
        if (!e.guide) return;
        const prev = entPorGuia[e.guide];
        const t = e.gestionado_en ? new Date(e.gestionado_en).getTime() : 0;
        const tp = prev?.gestionado_en ? new Date(prev.gestionado_en).getTime() : -1;
        if (!prev || t >= tp) entPorGuia[e.guide] = e;
      });
      const lista = [];
      Object.values(entPorGuia).forEach((e) => {
        const cant = bidonesPendientesDT(e);
        if (!cant) return;
        const p = pedPorGuia[e.guide];
        if (!p) return;
        const gestionadoEn = e.gestionado_en ? new Date(e.gestionado_en) : null;
        const dias = gestionadoEn ? Math.floor((Date.now() - gestionadoEn.getTime()) / 86400000) : 0;
        lista.push({
          numero_guia: p.numero_guia,
          pedidoId: p.id,
          cliente_id: p.cliente_id,
          domicilio_id: p.domicilio_id,
          chofer: (e.chofer || "").trim() || "Sin chofer",
          cantidad: cant,
          gestionadoEn,
          dias,
          bidones_retirados_en: p.bidones_retirados_en || null,
          bidones_proximo_pedido: !!p.bidones_proximo_pedido,
          bidones_retiro_guia: p.bidones_retiro_guia || "",
        });
      });
      lista.sort((a, b) => b.dias - a.dias);
      setBidonesPend(lista);
    } catch (e) {
      setErrorBid(mensajeError(e, "No se pudieron cargar los bidones pendientes."));
      setBidonesPend(null);
    } finally {
      setCargandoBid(false);
    }
  }
  async function marcarBidonesProximoPedidoGrupo(guias, valor) {
    setGuardandoBidonGuia(guias.join(","));
    try {
      const { error } = await supabase.from("pedidos").update({ bidones_proximo_pedido: valor }).in("numero_guia", guias);
      if (error) throw error;
      await cargarBidonesPend();
    } catch (e) {
      setErrorBid(mensajeError(e, "No se pudo actualizar."));
    } finally {
      setGuardandoBidonGuia(null);
    }
  }
  async function marcarBidonesRetiradosGrupo(guias, correlativo) {
    const c = (correlativo || "").trim();
    if (!c) { setErrorBid("Indica el pedido o correlativo usado para el retiro."); return; }
    setGuardandoBidonGuia(guias.join(","));
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ bidones_retirados_en: new Date().toISOString(), bidones_retiro_guia: c, bidones_proximo_pedido: false })
        .in("numero_guia", guias);
      if (error) throw error;
      await cargarBidonesPend();
      setBidonesCorrelativo((prev) => { const n = { ...prev }; guias.forEach((g) => delete n[g]); return n; });
    } catch (e) {
      setErrorBid(mensajeError(e, "No se pudo actualizar."));
    } finally {
      setGuardandoBidonGuia(null);
    }
  }
  async function deshacerBidonRetirado(guia) {
    if (!window.confirm("¿Marcar los bidones de este pedido nuevamente como pendientes de retiro?")) return;
    setGuardandoBidonGuia(guia);
    try {
      const { error } = await supabase.from("pedidos").update({ bidones_retirados_en: null, bidones_retiro_guia: null }).eq("numero_guia", guia);
      if (error) throw error;
      await cargarBidonesPend();
    } catch (e) {
      setErrorBid(mensajeError(e, "No se pudo actualizar."));
    } finally {
      setGuardandoBidonGuia(null);
    }
  }

  useEffect(() => {
    if ((rol === "admin" || rol === "operador") && vista === "deudasprov" && session) cargarDeudasProv();
    if ((rol === "admin" || rol === "operador") && vista === "cotizaciones" && session) cargarCotizaciones();
    if ((rol === "admin" || rol === "operador") && vista === "facturas" && session) cargarFacturasPend();
    if ((rol === "admin" || rol === "operador") && vista === "bidones" && session) cargarBidonesPend();
    // KPIs de Inicio: precargamos ambos conteos aunque el usuario no visite las pantallas.
    if ((rol === "admin" || rol === "operador") && vista === "inicio" && session && facturasPend === null) cargarFacturasPend();
    if ((rol === "admin" || rol === "operador") && vista === "inicio" && session && bidonesPend === null) cargarBidonesPend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol, vista, session]);

  // Registrar pago de una deuda con respaldo bancario (foto → Storage privado).
  async function confirmarPago() {
    if (!pagoModal) return;
    if (!pagoFoto) { setErrorPago("Adjunta la foto del respaldo bancario."); return; }
    setSubiendoPago(true); setErrorPago("");
    try {
      const gN = normGuia(pagoModal.numero_guia);
      const ext = (pagoFoto.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${pagoModal.mes}/${gN}-${Date.now()}.${ext}`;
      const up = await supabase.storage
        .from("respaldos-pago-proveedor")
        .upload(path, pagoFoto, { upsert: false, contentType: pagoFoto.type || "image/jpeg" });
      if (up.error) throw up.error;
      const ins = await supabase.from("pagos_proveedor").upsert({
        numero_guia: pagoModal.numero_guia,
        proveedor: pagoModal.proveedor,
        chofer: pagoModal.chofer,
        monto: pagoModal.monto,
        abonado: pagoModal.monto,
        mes: pagoModal.mes,
        origen: "dispatchtrack",
        pagado: true,
        fecha_pago: new Date().toISOString(),
        pagado_por: perfilNombre || null,
        respaldo_path: path,
      }, { onConflict: "numero_guia" });
      if (ins.error) throw ins.error;
      setPagoModal(null); setPagoFoto(null);
      await cargarDeudasProv();
    } catch (e) {
      setErrorPago(mensajeError(e, "No se pudo registrar el pago."));
    } finally {
      setSubiendoPago(false);
    }
  }

  // Marca varias deudas a proveedor como pagadas de una vez, sin exigir
  // respaldo (solo admin — para cierres masivos ya conciliados por otra vía).
  async function marcarPagadasMasivo(items) {
    if (!items.length) return;
    if (!window.confirm(`¿Marcar ${items.length} pago(s) a proveedor como pagados, sin respaldo adjunto, por un total de ${CLP(items.reduce((s, d) => s + (d.saldo ?? d.monto), 0))}?`)) return;
    setGuardandoPagoMasivo(true); setErrorDeudas("");
    try {
      for (const d of items) {
        const { error } = await supabase.from("pagos_proveedor").upsert({
          numero_guia: d.numero_guia,
          proveedor: d.proveedor,
          chofer: d.chofer,
          monto: d.monto,
          abonado: d.monto,
          mes: d.mes,
          origen: "dispatchtrack",
          pagado: true,
          fecha_pago: new Date().toISOString(),
          pagado_por: perfilNombre || null,
        }, { onConflict: "numero_guia" });
        if (error) throw error;
      }
      setSeleccionPago({});
      await cargarDeudasProv();
    } catch (e) {
      setErrorDeudas(mensajeError(e, "No se pudo completar la marca masiva."));
    } finally {
      setGuardandoPagoMasivo(false);
    }
  }

  // Abrir el respaldo bancario (bucket privado → URL firmada temporal).
  async function verRespaldo(path) {
    try {
      const { data, error } = await supabase.storage
        .from("respaldos-pago-proveedor").createSignedUrl(path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      alert("No se pudo abrir el respaldo: " + mensajeError(e, "error desconocido"));
    }
  }

  // ── Abonos parciales (cobro a cliente + deuda proveedor) ──
  // Abre el modal de abono y carga el historial del ítem.
  async function abrirAbono(tipo, data) {
    setAbonoModal({ tipo, ...data });
    setAbonoMonto("");
    setErrorAbono("");
    setAbonoHist([]);
    try {
      const tabla = tipo === "cobro" ? "abonos_cobro" : "abonos_proveedor";
      const { data: hs } = await supabase
        .from(tabla).select("*").eq("numero_guia", data.numero_guia)
        .order("fecha", { ascending: false });
      setAbonoHist(hs || []);
    } catch { /* tabla aún no creada */ }
  }

  // Registra un abono. Cuando el saldo llega a 0, marca cobrado/pagado.
  async function confirmarAbono() {
    if (!abonoModal) return;
    const monto = Math.round(Number(abonoMonto) || 0);
    if (monto <= 0) { setErrorAbono("Ingresa un monto mayor a 0."); return; }
    if (monto > abonoModal.saldo) { setErrorAbono(`El abono supera el saldo (${CLP(abonoModal.saldo)}).`); return; }
    setGuardandoAbono(true); setErrorAbono("");
    try {
      if (abonoModal.tipo === "cobro") {
        const ins = await supabase.from("abonos_cobro").insert({
          numero_guia: abonoModal.numero_guia,
          monto,
          registrado_por: perfilNombre || null,
        });
        if (ins.error) throw ins.error;
        const nuevoAbonado = (Number(abonoModal.cobro_abonado) || 0) + monto;
        const total = Number(abonoModal.monto_total) || 0;
        const completo = total > 0 && nuevoAbonado >= total;
        const patch = {
          cobro_abonado: nuevoAbonado,
          cobro_at: new Date().toISOString(),
          cobro_por: perfilNombre || null,
          ...(completo ? { cobro_cobrado: true } : {}),
        };
        const { error } = await supabase.from("pedidos").update(patch).eq("id", abonoModal.pedidoId);
        if (error) throw error;
        actualizarCobranzaLocal(abonoModal.pedidoId, patch);
        setOkCob(`${abonoModal.numero_guia || ""}: abono de ${CLP(monto)} registrado.${completo ? " Saldo saldado → marcado Cobrado." : ` Saldo: ${CLP(total - nuevoAbonado)}.`}`);
      } else {
        const ins = await supabase.from("abonos_proveedor").insert({
          numero_guia: abonoModal.numero_guia,
          mes: abonoModal.mes,
          monto,
          registrado_por: perfilNombre || null,
        });
        if (ins.error) throw ins.error;
        const nuevoAbonado = (Number(abonoModal.abonado) || 0) + monto;
        const total = Number(abonoModal.monto) || 0;
        const completo = total > 0 && nuevoAbonado >= total;
        const up = await supabase.from("pagos_proveedor").upsert({
          numero_guia: abonoModal.numero_guia,
          proveedor: abonoModal.proveedor,
          chofer: abonoModal.chofer,
          monto: total,
          mes: abonoModal.mes,
          origen: "abono",
          abonado: nuevoAbonado,
          pagado: completo,
          ...(completo ? { fecha_pago: new Date().toISOString(), pagado_por: perfilNombre || null } : {}),
        }, { onConflict: "numero_guia" });
        if (up.error) throw up.error;
        await cargarDeudasProv();
      }
      setAbonoModal(null); setAbonoMonto("");
    } catch (e) {
      setErrorAbono(mensajeError(e, "No se pudo registrar el abono."));
    } finally {
      setGuardandoAbono(false);
    }
  }


  // ── Bloque 4: cargar datos del mantenedor según sub-pestaña ─
  useEffect(() => {
    if (vista !== "mantenedor" || !session) return;
    if (mantTab === "productos" && rol === "admin") cargarProductosAll();
    if (mantTab === "perfiles" && rol === "admin") cargarPerfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, mantTab, rol, session]);

  // El operador no tiene mantenedores de productos ni perfiles.
  useEffect(() => {
    if (rol !== "admin" && (mantTab === "productos" || mantTab === "perfiles")) setMantTab("clientes");
  }, [rol, mantTab]);

  // ── Sesión: detectar login, cargar rol del perfil ──────────
  useEffect(() => {
    if (!credsListas) { setAuthReady(true); return; }
    let activo = true;
    async function cargarPerfil(sess) {
      if (!sess) { setRol(null); setPerfilNombre(""); setDistChofer(""); setDistIdentDt(""); return; }
      const { data } = await supabase
        .from("perfiles")
        .select("rol, nombre, activo, chofer_nombre, identificador_dt")
        .eq("id", sess.user.id)
        .maybeSingle();
      if (!activo) return;
      if (data && data.activo) {
        setRol(data.rol);
        setPerfilNombre(data.nombre || sess.user.email);
        setDistChofer(data.chofer_nombre || "");
        setDistIdentDt(data.identificador_dt || "");
        setVista("inicio");
      } else {
        setRol(null);
      }
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!activo) return;
      setSession(data.session);
      cargarPerfil(data.session).finally(() => activo && setAuthReady(true));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      cargarPerfil(sess);
    });
    return () => { activo = false; sub.subscription.unsubscribe(); };
  }, [credsListas]);

  async function iniciarSesion() {
    setLoginError("");
    setLogueando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPass,
      });
      if (error) setLoginError("Email o contraseña incorrectos.");
      else setLoginPass("");
    } catch (e) {
      setLoginError(mensajeError(e, "No se pudo iniciar sesión."));
    } finally {
      setLogueando(false);
    }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    setRol(null);
    setPerfilNombre("");
    setVista("inicio");
  }

  // El perfil gerencial no opera pedidos ni mantiene clientes.
  useEffect(() => {
    if (rol === "gerencial" && (vista === "nuevo" || vista === "mantenedor" || vista === "cobranzas" || vista === "deudasprov" || vista === "cotizaciones" || vista === "facturas" || vista === "bidones")) {
      setVista("inicio");
    }
    // El distribuidor solo crea pedidos: nada de mantenedores ni cobranzas.
    if (rol === "distribuidor" && (vista === "mantenedor" || vista === "cobranzas" || vista === "deudasprov" || vista === "cotizaciones" || vista === "facturas" || vista === "bidones")) {
      setVista("inicio");
    }
  }, [rol, vista]);

  // Mantener emailNuevo sincronizado con el cliente elegido
  useEffect(() => {
    setEmailNuevo(cliente?.email || "");
  }, [cliente]);

  // Guardar email que el operador agrega a un cliente sin correo
  async function guardarEmailCliente() {
    if (!cliente) return;
    const e = emailNuevo.trim();
    if (!emailValido(e)) return;
    setGuardandoEmail(true);
    try {
      const { error } = await supabase
        .from("clientes")
        .update({ email: e, email_status: "ok", email_original: cliente.email_original || null })
        .eq("id", cliente.id);
      if (error) throw error;
      const actualizado = { ...cliente, email: e, email_status: "ok" };
      setCliente(actualizado);
      setClientes((prev) => prev.map((c) => (c.id === cliente.id ? actualizado : c)));
    } catch (err) {
      setResultado({ ok: false, msg: "No se pudo guardar el email: " + (err.message || err) });
    } finally {
      setGuardandoEmail(false);
    }
  }

  // ── Mantenedor de bloqueo ──────────────────────────────────
  // Busca igual que el formulario: por cliente (nombre/RUT/código) y por
  // domicilio (identificador_dt como 0004-1, o dirección), resolviendo al cliente dueño.
  const resultadosMant = useMemo(() => {
    const q = buscarMant.trim().toLowerCase();
    if (!q) return [];
    const porCliente = clientes
      .filter(
        (c) =>
          (c.nombre || "").toLowerCase().includes(q) ||
          (c.rut || "").toLowerCase().includes(q) ||
          (c.codigo_cliente || "").toLowerCase().includes(q)
      )
      .map((c) => ({ cliente: c, dom: null }));

    const porDomicilio = todosDomicilios
      .filter(
        (d) =>
          (d.identificador_dt || "").toLowerCase().includes(q) ||
          (d.direccion || "").toLowerCase().includes(q) ||
          (d.etiqueta || "").toLowerCase().includes(q)
      )
      .map((d) => ({ cliente: clientes.find((c) => c.id === d.cliente_id), dom: d }))
      .filter((r) => r.cliente);

    const vistos = new Set();
    return [...porDomicilio, ...porCliente]
      .filter((r) => {
        const k = r.cliente.id + "|" + (r.dom?.id || "");
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      })
      .slice(0, 8);
  }, [buscarMant, clientes, todosDomicilios]);

  function elegirMant(r) {
    setClienteMant(r.cliente);
    setDomMant(r.dom || null);
    setBuscarMant("");
    setBloqMant(!!r.cliente.bloqueado);
    setMotivoMant(r.cliente.motivo_bloqueo || "");
    setOkMant("");
  }

  async function guardarBloqueo() {
    if (!clienteMant) return;
    setGuardandoMant(true);
    setOkMant("");
    try {
      const patch = {
        bloqueado: bloqMant,
        motivo_bloqueo: bloqMant ? motivoMant.trim() || "Bloqueado (sin motivo)" : null,
        bloqueado_por: bloqMant ? operadorMant.trim() || null : null,
        bloqueado_at: bloqMant ? new Date().toISOString() : null,
      };
      const { error } = await supabase.from("clientes").update(patch).eq("id", clienteMant.id);
      if (error) throw error;
      const actualizado = { ...clienteMant, ...patch };
      setClienteMant(actualizado);
      setClientes((prev) => prev.map((c) => (c.id === clienteMant.id ? actualizado : c)));
      if (cliente && cliente.id === clienteMant.id) setCliente(actualizado);
      setOkMant(bloqMant ? "Cliente bloqueado." : "Cliente desbloqueado.");
    } catch (err) {
      setOkMant("Error: " + (err.message || err));
    } finally {
      setGuardandoMant(false);
    }
  }

  // ── Bloque 4: recargar el catálogo activo (Nuevo pedido) ───
  // Tras pausar/activar/editar productos refrescamos lo que ve Nuevo pedido.
  async function recargarProductosActivos() {
    const { data } = await supabase.from("productos").select("*").eq("activo", true).order("nombre");
    setProductos(data || []);
  }

  // ── Mantenedor de clientes: alta / edición ─────────────────
  // Código de cliente correlativo: NNNN-1 (el "-1" es fijo). Arranca en 2212-1.
  function siguienteCodigoCliente() {
    let max = 2211; // de modo que el primero generado sea 2212
    clientes.forEach((c) => {
      const m = String(c.codigo_cliente || "").match(/^0*(\d+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n > max) max = n;
      }
    });
    return String(max + 1) + "-1";
  }

  // ── Cotizaciones ─────────────────────────────────────────────
  async function cargarCotizaciones() {
    setCargandoCotiz(true);
    setErrorCotiz("");
    try {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      setCotizaciones(data || []);
    } catch (e) {
      setErrorCotiz(mensajeError(e, "No se pudieron cargar las cotizaciones."));
    } finally {
      setCargandoCotiz(false);
    }
  }

  function fechaHoyISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function sumarDias(iso, dias) {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + dias);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function nuevaCotizacion() {
    setOkCotiz("");
    setCotizClienteTipo("existente");
    setBuscarCotizCliente("");
    setItemsCotiz([]);
    setCotizEdit({
      _nuevo: true,
      cliente_id: null,
      cliente_nombre: "",
      es_potencial: false,
      rut_empresa: "",
      razon_social: "",
      contacto_nombre: "",
      contacto_email: "",
      contacto_telefono: "",
      fecha_emision: fechaHoyISO(),
      fecha_vigencia: sumarDias(fechaHoyISO(), 15),
      estado: "borrador",
      notas: "",
    });
  }

  async function abrirCotizacion(c) {
    setOkCotiz("");
    setCotizClienteTipo(c.cliente_id ? "existente" : "potencial");
    setBuscarCotizCliente("");
    const cli = c.cliente_id ? clientes.find((x) => x.id === c.cliente_id) : null;
    setCotizEdit({ ...c, _nuevo: false, cliente_nombre: cli ? cli.nombre : "" });
    const { data } = await supabase.from("cotizacion_items").select("*").eq("cotizacion_id", c.id).order("orden");
    setItemsCotiz(
      (data || []).map((l) => {
        // Los ítems del catálogo de equipos/planes se guardan con producto_id
        // null (no tienen FK a productos); se re-vincula por nombre para que
        // el <select> quede bien seleccionado al reabrir.
        let producto_id = l.producto_id;
        if (!producto_id) {
          const match = CATALOGO_EQUIPOS_COTIZ.find((p) => p.nombre === l.nombre_producto);
          if (match) producto_id = match.id;
        }
        return {
          key: l.id,
          producto_id,
          nombre: l.nombre_producto,
          cantidad: l.cantidad,
          precio_unit: l.precio_unit,
          incluir_ficha: !!l.incluir_ficha,
        };
      })
    );
  }

  function elegirClienteCotiz(c) {
    setCotizEdit((prev) => ({
      ...prev,
      cliente_id: c.id,
      cliente_nombre: c.nombre,
      es_potencial: false,
      rut_empresa: c.rut || "",
      razon_social: c.razon_social || "",
      contacto_email: c.email || "",
      contacto_telefono: c.telefono || "",
    }));
    setBuscarCotizCliente("");
  }

  const resultadosCotizCliente = useMemo(() => {
    const q = buscarCotizCliente.trim().toLowerCase();
    if (!q) return [];
    return clientes
      .filter((c) => c.activo !== false)
      .filter(
        (c) =>
          (c.nombre || "").toLowerCase().includes(q) ||
          (c.rut || "").toLowerCase().includes(q) ||
          (c.codigo_cliente || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [buscarCotizCliente, clientes]);

  // Catálogo del selector de "Productos" en Cotizaciones: los productos reales
  // (recargas/despacho, tal como en Nuevo pedido) + el catálogo de equipos y
  // planes que solo se cotizan (CATALOGO_EQUIPOS_COTIZ, no vive en Supabase).
  const catalogoCotiz = useMemo(() => {
    const reales = productos.map((p) => ({ ...p, grupo: p.familia || "Recargas y despacho" }));
    return [...reales, ...CATALOGO_EQUIPOS_COTIZ];
  }, [productos]);
  const catalogoCotizPorGrupo = useMemo(() => {
    const mapa = {};
    catalogoCotiz.forEach((p) => {
      const g = p.grupo || "Otros";
      if (!mapa[g]) mapa[g] = [];
      mapa[g].push(p);
    });
    return mapa;
  }, [catalogoCotiz]);

  function agregarLineaCotiz() {
    const prod = catalogoCotiz[0];
    setItemsCotiz((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        producto_id: prod ? prod.id : null,
        nombre: prod ? prod.nombre : "",
        cantidad: 1,
        precio_unit: prod ? precioSugerido(prod, 1, tramos) : 0,
        incluir_ficha: false,
      },
    ]);
  }
  function quitarLineaCotiz(key) {
    setItemsCotiz((prev) => prev.filter((it) => it.key !== key));
  }
  function cambiarProductoCotizLinea(key, producto_id) {
    setItemsCotiz((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const prod = catalogoCotiz.find((p) => p.id === producto_id);
        return {
          ...it,
          producto_id,
          nombre: prod ? prod.nombre : "",
          precio_unit: prod ? precioSugerido(prod, it.cantidad, tramos) : it.precio_unit,
          // Cambió el producto: la ficha técnica marcada correspondía al anterior.
          incluir_ficha: false,
        };
      })
    );
  }
  function cambiarCantidadCotizLinea(key, cantidad) {
    setItemsCotiz((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const prod = catalogoCotiz.find((p) => p.id === it.producto_id);
        return { ...it, cantidad, precio_unit: prod ? precioSugerido(prod, cantidad, tramos) : it.precio_unit };
      })
    );
  }
  function cambiarPrecioCotizLinea(key, precio_unit) {
    setItemsCotiz((prev) => prev.map((it) => (it.key === key ? { ...it, precio_unit } : it)));
  }

  const totalCotiz = itemsCotiz.reduce((s, it) => s + Math.round((Number(it.cantidad) || 0) * (Number(it.precio_unit) || 0)), 0);

  // ── Fichas técnicas de producto (opcionales por línea) ─────────
  // Productos reales (con FK válida a `productos`) se identifican por
  // producto_id; los ítems del catálogo fijo de equipos/planes ("eq-…", sin
  // fila en `productos`) se identifican por nombre — mismo criterio que ya
  // usa guardarCotizacion() para decidir qué producto_id persistir.
  function refProductoFicha(it) {
    const esCatalogoFijo = !it.producto_id || String(it.producto_id).startsWith("eq-");
    return esCatalogoFijo
      ? { producto_id: null, producto_nombre: it.nombre || "" }
      : { producto_id: it.producto_id, producto_nombre: null };
  }
  function keyFicha(it) {
    const { producto_id, producto_nombre } = refProductoFicha(it);
    return producto_id ? "id:" + producto_id : "nom:" + producto_nombre;
  }

  async function cargarFichaProducto(it) {
    const k = keyFicha(it);
    if (fichasProducto[k] !== undefined) return fichasProducto[k];
    const { producto_id, producto_nombre } = refProductoFicha(it);
    try {
      let q = supabase.from("fichas_producto").select("*").eq("activa", true);
      q = producto_id ? q.eq("producto_id", producto_id) : q.eq("producto_nombre", producto_nombre);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      setFichasProducto((prev) => ({ ...prev, [k]: data || null }));
      return data || null;
    } catch (e) {
      setFichasProducto((prev) => ({ ...prev, [k]: null }));
      return null;
    }
  }

  function toggleFichaCotizLinea(key, incluir) {
    setItemsCotiz((prev) => prev.map((it) => (it.key === key ? { ...it, incluir_ficha: incluir } : it)));
    if (incluir) {
      const it = itemsCotiz.find((x) => x.key === key);
      if (it) cargarFichaProducto(it);
    }
  }

  async function abrirEditorFicha(it) {
    setOkFicha("");
    const existente = await cargarFichaProducto(it);
    const { producto_id, producto_nombre } = refProductoFicha(it);
    setFichaEditDraft(
      existente
        ? { ...existente, specs: Array.isArray(existente.specs) ? existente.specs : [] }
        : { id: null, producto_id, producto_nombre: producto_nombre || it.nombre, descripcion: "", imagen_url: "", garantia: "", specs: [] }
    );
    setFichaEditKey(it.key);
  }
  function cerrarEditorFicha() {
    setFichaEditKey(null);
    setFichaEditDraft(null);
  }
  function agregarSpecFicha() {
    setFichaEditDraft((prev) => ({ ...prev, specs: [...(prev.specs || []), { label: "", value: "" }] }));
  }
  function cambiarSpecFicha(i, campo, val) {
    setFichaEditDraft((prev) => ({
      ...prev,
      specs: prev.specs.map((s, idx) => (idx === i ? { ...s, [campo]: val } : s)),
    }));
  }
  function quitarSpecFicha(i) {
    setFichaEditDraft((prev) => ({ ...prev, specs: prev.specs.filter((_, idx) => idx !== i) }));
  }

  // Imagen de la ficha técnica se guarda localmente (base64 en la propia
  // fila de fichas_producto), sin depender de Storage externo: se lee el
  // archivo elegido, se redimensiona a un máximo razonable con canvas para
  // no inflar la base de datos, y se comprime a JPEG.
  function elegirImagenFichaLocal(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo si se quita y se re-agrega
    if (!file) return;
    setOkFicha("");
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 640;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setFichaEditDraft((prev) => ({ ...prev, imagen_url: dataUrl }));
      };
      img.onerror = () => setOkFicha("Error: no se pudo leer la imagen elegida.");
      img.src = lector.result;
    };
    lector.onerror = () => setOkFicha("Error: no se pudo leer el archivo.");
    lector.readAsDataURL(file);
  }
  function quitarImagenFicha() {
    setFichaEditDraft((prev) => ({ ...prev, imagen_url: "" }));
  }

  async function guardarFicha() {
    if (!fichaEditDraft) return;
    setGuardandoFicha(true);
    setOkFicha("");
    try {
      const specsLimpias = (fichaEditDraft.specs || []).filter((s) => (s.label || "").trim() || (s.value || "").trim());
      const patch = {
        producto_id: fichaEditDraft.producto_id || null,
        producto_nombre: fichaEditDraft.producto_id ? null : (fichaEditDraft.producto_nombre || null),
        descripcion: fichaEditDraft.descripcion || null,
        imagen_url: fichaEditDraft.imagen_url || null,
        garantia: fichaEditDraft.garantia || null,
        specs: specsLimpias,
        activa: true,
      };
      let row;
      if (fichaEditDraft.id) {
        const { data, error } = await supabase.from("fichas_producto").update(patch).eq("id", fichaEditDraft.id).select().single();
        if (error) throw error;
        row = data;
      } else {
        // Ya se comprobó al abrir el editor (cargarFichaProducto) que no
        // existía ficha previa para este producto_id/nombre, así que un
        // insert directo es correcto; un upsert con onConflict no calza
        // aquí porque los índices únicos son parciales (WHERE … IS NOT
        // NULL) y Postgres no lo resuelve vía ON CONFLICT(columna).
        const { data, error } = await supabase.from("fichas_producto").insert(patch).select().single();
        if (error) throw error;
        row = data;
      }
      const it = itemsCotiz.find((x) => x.key === fichaEditKey);
      if (it) setFichasProducto((prev) => ({ ...prev, [keyFicha(it)]: row }));
      setOkFicha("Ficha técnica guardada.");
      cerrarEditorFicha();
    } catch (e) {
      setOkFicha("Error: " + mensajeError(e, "No se pudo guardar la ficha técnica."));
    } finally {
      setGuardandoFicha(false);
    }
  }

  function validarCotiz() {
    if (!cotizEdit) return "";
    if (cotizClienteTipo === "existente" && !cotizEdit.cliente_id) return "Elige un cliente existente.";
    if (cotizClienteTipo === "potencial") {
      if (!cotizEdit.rut_empresa || !rutValido(cotizEdit.rut_empresa)) return "Ingresa un RUT de empresa válido.";
      if (!(cotizEdit.razon_social || "").trim()) return "Ingresa la razón social del potencial cliente.";
    }
    if (itemsCotiz.length === 0) return "Agrega al menos un producto.";
    if (itemsCotiz.some((it) => !it.producto_id || Number(it.cantidad) <= 0)) return "Revisa cantidades y productos de las líneas.";
    return "";
  }

  async function guardarCotizacion() {
    if (!cotizEdit) return;
    const err = validarCotiz();
    if (err) { setOkCotiz("Error: " + err); return; }
    setGuardandoCotiz(true);
    setOkCotiz("");
    try {
      let folio = cotizEdit.folio;
      if (cotizEdit._nuevo) {
        const { data: f, error: eFolio } = await supabase.rpc("siguiente_folio_cotizacion");
        if (eFolio) throw eFolio;
        folio = typeof f === "string" ? f : Array.isArray(f) ? f[0] : null;
        if (!folio) throw new Error("La base no devolvió un folio.");
      }
      const patch = {
        folio,
        cliente_id: cotizClienteTipo === "existente" ? cotizEdit.cliente_id : null,
        es_potencial: cotizClienteTipo === "potencial",
        rut_empresa: cotizEdit.rut_empresa || null,
        razon_social: cotizEdit.razon_social || null,
        contacto_nombre: cotizEdit.contacto_nombre || null,
        contacto_email: cotizEdit.contacto_email || null,
        contacto_telefono: cotizEdit.contacto_telefono || null,
        fecha_emision: cotizEdit.fecha_emision,
        fecha_vigencia: cotizEdit.fecha_vigencia || null,
        estado: cotizEdit.estado || "borrador",
        notas: cotizEdit.notas || null,
        subtotal: totalCotiz,
        descuento_total: 0,
        total: totalCotiz,
        creado_por: perfilNombre || null,
      };
      let cotizId = cotizEdit.id;
      if (cotizEdit._nuevo) {
        const { data, error } = await supabase.from("cotizaciones").insert(patch).select().single();
        if (error) throw error;
        cotizId = data.id;
      } else {
        const { error } = await supabase.from("cotizaciones").update(patch).eq("id", cotizEdit.id);
        if (error) throw error;
      }
      await supabase.from("cotizacion_items").delete().eq("cotizacion_id", cotizId);
      const filas = itemsCotiz.map((it, i) => ({
        cotizacion_id: cotizId,
        // El catálogo de equipos/planes usa ids "eq-…" que no existen en la
        // tabla productos (no tienen FK válida): se guarda null y el nombre
        // queda igual como snapshot en nombre_producto.
        producto_id: it.producto_id && !String(it.producto_id).startsWith("eq-") ? it.producto_id : null,
        nombre_producto: it.nombre,
        cantidad: Number(it.cantidad) || 0,
        precio_unit: Number(it.precio_unit) || 0,
        subtotal: Math.round((Number(it.cantidad) || 0) * (Number(it.precio_unit) || 0)),
        incluir_ficha: !!it.incluir_ficha,
        orden: i,
      }));
      if (filas.length) {
        const { error: eItems } = await supabase.from("cotizacion_items").insert(filas);
        if (eItems) throw eItems;
      }
      setOkCotiz("Cotización " + folio + " guardada.");
      setCotizEdit((prev) => ({ ...prev, _nuevo: false, id: cotizId, folio }));
      await cargarCotizaciones();
    } catch (e) {
      setOkCotiz("Error: " + mensajeError(e, "No se pudo guardar la cotización."));
    } finally {
      setGuardandoCotiz(false);
    }
  }

  async function cambiarEstadoCotiz(c, estado) {
    try {
      const { error } = await supabase.from("cotizaciones").update({ estado }).eq("id", c.id);
      if (error) throw error;
      setCotizaciones((prev) => prev.map((x) => (x.id === c.id ? { ...x, estado } : x)));
      if (cotizEdit && cotizEdit.id === c.id) setCotizEdit((prev) => ({ ...prev, estado }));
    } catch (e) {
      setOkCotiz("Error: " + mensajeError(e, "No se pudo cambiar el estado."));
    }
  }

  // Al procesar: si la cotización era de un potencial (sin cliente_id), recién
  // aquí se crea la ficha real en `clientes` y queda enlazada; si ya tenía
  // cliente existente, solo se marca como procesada.
  async function procesarCotizacion(c) {
    setProcesandoCotiz(true);
    setOkCotiz("");
    try {
      let clienteId = c.cliente_id;
      if (!clienteId) {
        if (!c.rut_empresa || !c.razon_social) throw new Error("Falta RUT o razón social del potencial cliente.");
        const nuevoCli = {
          nombre: c.razon_social,
          rut: c.rut_empresa,
          codigo_cliente: siguienteCodigoCliente(),
          telefono: c.contacto_telefono || null,
          email: c.contacto_email || null,
          es_empresa: true,
          razon_social: c.razon_social,
          activo: true,
          notas: c.contacto_nombre ? "Contacto: " + c.contacto_nombre + " (desde cotización " + c.folio + ")" : ("Creado desde cotización " + c.folio),
        };
        const { data, error } = await supabase.from("clientes").insert(nuevoCli).select().single();
        if (error) throw error;
        clienteId = data.id;
        setClientes((prev) => [...prev, data]);
      }
      const { error: eUp } = await supabase
        .from("cotizaciones")
        .update({ estado: "procesada", cliente_id: clienteId, procesada_at: new Date().toISOString() })
        .eq("id", c.id);
      if (eUp) throw eUp;
      setCotizaciones((prev) => prev.map((x) => (x.id === c.id ? { ...x, estado: "procesada", cliente_id: clienteId } : x)));
      if (cotizEdit && cotizEdit.id === c.id) setCotizEdit((prev) => ({ ...prev, estado: "procesada", cliente_id: clienteId, _nuevo: false }));
      setOkCotiz("Cotización procesada" + (c.cliente_id ? "." : ": cliente creado en la ficha de Clientes."));
    } catch (e) {
      setOkCotiz("Error: " + mensajeError(e, "No se pudo procesar la cotización."));
    } finally {
      setProcesandoCotiz(false);
    }
  }

  // Carga jsPDF desde CDN una sola vez (mismo patrón que el mapa con Leaflet).
  function cargarJsPDF() {
    return new Promise((resolve, reject) => {
      if (window.jspdf && window.jspdf.jsPDF) return resolve(window.jspdf.jsPDF);
      const existente = document.getElementById("jspdf-js");
      if (existente) {
        existente.addEventListener("load", () => resolve(window.jspdf.jsPDF));
        existente.addEventListener("error", reject);
        return;
      }
      const s = document.createElement("script");
      s.id = "jspdf-js";
      s.src = "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js";
      s.onload = () => resolve(window.jspdf.jsPDF);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Descarga una imagen (URL pública, ej. Supabase Storage) y la convierte a
  // data URL base64 para poder insertarla con doc.addImage(). Si la URL no
  // es accesible (CORS, 404, red), retorna null y la ficha se imprime sin
  // imagen en vez de romper la generación del PDF completo.
  function imagenUrlABase64(url) {
    return new Promise((resolve) => {
      fetch(url)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("fetch imagen falló"))))
        .then(
          (blob) =>
            new Promise((res, rej) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result);
              reader.onerror = rej;
              reader.readAsDataURL(blob);
            })
        )
        .then(resolve)
        .catch(() => resolve(null));
    });
  }

  async function descargarPdfCotizacion(c, items) {
    setGenerandoPdfCotiz(true);
    try {
      const jsPDF = await cargarJsPDF();
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const M = 48;
      let y = 56;

      // Total real: se recalcula desde las líneas vigentes en pantalla, no
      // desde c.total (que puede venir vacío/desactualizado si la cotización
      // no se ha guardado con las líneas actuales). Esto era la causa del
      // bug "Total: $0" al emitir.
      const totalPdf = items.reduce((s, it) => s + Math.round((Number(it.cantidad) || 0) * (Number(it.precio_unit) || 0)), 0);

      const LOGO_W = 48, LOGO_H = 48;
      try {
        doc.addImage(LOGO_AQUATRISQ_B64, "JPEG", M, y - 34, LOGO_W, LOGO_H);
      } catch (eLogo) { /* si falla el logo, se sigue igual con el texto */ }
      const textX = M + LOGO_W + 10;

      doc.setFont("helvetica", "bold"); doc.setFontSize(18);
      doc.text("Aquatrisq", textX, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90);
      y += 16;
      doc.text("Distribución de agua purificada · Región Metropolitana", textX, y);
      y += 12;
      doc.text("Instagram @aquatrisq", textX, y);
      doc.setTextColor(0);

      doc.setFont("helvetica", "bold"); doc.setFontSize(14);
      doc.text("COTIZACIÓN " + (c.folio || ""), 595 - M, 56, { align: "right" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text("Fecha emisión: " + (c.fecha_emision || "-"), 595 - M, 74, { align: "right" });
      doc.text("Válida hasta: " + (c.fecha_vigencia || "-"), 595 - M, 88, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text("Estado: " + (ESTADO_COTIZ_LABEL[c.estado] || c.estado || ""), 595 - M, 102, { align: "right" });

      y = 128;
      doc.setDrawColor(210); doc.line(M, y, 595 - M, y);
      y += 22;

      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text("Cliente", M, y);
      y += 16;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      const nombreCli = c.cliente_id ? (c.cliente_nombre || c.razon_social || "") : (c.razon_social || "");
      doc.text(nombreCli || "-", M, y); y += 14;
      if (c.rut_empresa) { doc.text("RUT: " + c.rut_empresa, M, y); y += 14; }
      if (c.contacto_nombre) { doc.text("Contacto: " + c.contacto_nombre, M, y); y += 14; }
      if (c.contacto_email) { doc.text("Email: " + c.contacto_email, M, y); y += 14; }
      if (c.contacto_telefono) { doc.text("Teléfono: " + c.contacto_telefono, M, y); y += 14; }

      y += 12;
      doc.setDrawColor(210); doc.line(M, y, 595 - M, y);
      y += 24;

      // Tabla de ítems (dibujada a mano: sin dependencias extra).
      const colX = { desc: M, cant: 330, precio: 400, sub: 490 };
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text("Producto", colX.desc, y);
      doc.text("Cant.", colX.cant, y);
      doc.text("Precio unit.", colX.precio, y);
      doc.text("Subtotal", colX.sub, y);
      y += 8;
      doc.setDrawColor(150); doc.line(M, y, 595 - M, y);
      y += 16;

      doc.setFont("helvetica", "normal");
      items.forEach((it) => {
        if (y > 720) { doc.addPage(); y = 56; }
        const sub = Math.round((Number(it.cantidad) || 0) * (Number(it.precio_unit) || 0));
        doc.text(String(it.nombre || ""), colX.desc, y, { maxWidth: 270 });
        doc.text(String(it.cantidad), colX.cant, y);
        doc.text(CLP(it.precio_unit), colX.precio, y);
        doc.text(CLP(sub), colX.sub, y);
        y += 18;
      });

      y += 10;
      doc.setDrawColor(210); doc.line(M, y, 595 - M, y);
      y += 22;
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text("Total: " + CLP(totalPdf), 595 - M, y, { align: "right" });

      // Medios de pago (fijo, se imprime en toda cotización).
      y += 26;
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text("Medios de pago", M, y); y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text(MEDIOS_PAGO_COTIZ.join(" · "), M, y);
      y += 16;

      // Condición de recargo por pago a 30 días (fija, política comercial).
      doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(90);
      const lineasRecargo = doc.splitTextToSize(RECARGO_PAGO_30_DIAS.texto, 595 - M * 2);
      doc.text(lineasRecargo, M, y);
      doc.setTextColor(0);
      y += lineasRecargo.length * 11 + 8;

      if (c.notas) {
        y += 12;
        if (y > 720) { doc.addPage(); y = 56; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
        doc.text("Notas / condiciones", M, y); y += 14;
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        const lineas = doc.splitTextToSize(c.notas, 595 - M * 2);
        doc.text(lineas, M, y);
      }

      // Fichas técnicas opcionales: una página por cada línea marcada con
      // "Incluir ficha técnica en el PDF". Se buscan en fichas_producto (no
      // se asume que ya estén en caché, por si la cotización se abrió y se
      // descargó el PDF sin pasar por el checkbox en esta sesión).
      const itemsConFicha = items.filter((it) => it.incluir_ficha);
      for (const it of itemsConFicha) {
        const ficha = await cargarFichaProducto(it);
        if (!ficha) continue;

        doc.addPage();
        let fy = 56;
        doc.setFont("helvetica", "bold"); doc.setFontSize(16);
        doc.text("Ficha técnica", M, fy);
        fy += 8;
        doc.setDrawColor(210); doc.line(M, fy, 595 - M, fy);
        fy += 24;

        doc.setFont("helvetica", "bold"); doc.setFontSize(13);
        doc.text(String(it.nombre || ficha.producto_nombre || ""), M, fy);
        fy += 20;

        // Imagen (opcional, mejor esfuerzo). La ficha guarda la imagen
        // localmente como data URL base64 (elegida desde el computador), así
        // que normalmente no hace falta red; si en algún caso quedó una URL
        // http (ficha antigua), se intenta descargar igual.
        if (ficha.imagen_url) {
          try {
            const esDataUrl = ficha.imagen_url.startsWith("data:");
            const b64Img = esDataUrl ? ficha.imagen_url : await imagenUrlABase64(ficha.imagen_url);
            if (b64Img) {
              const formato = /^data:image\/png/i.test(b64Img) ? "PNG" : "JPEG";
              doc.addImage(b64Img, formato, M, fy, 160, 160);
            }
          } catch (eImg) { /* se omite la imagen si no se puede cargar */ }
        }
        const specX = ficha.imagen_url ? M + 176 : M;
        const specW = ficha.imagen_url ? 595 - M - specX : 595 - M * 2;
        let sy = fy;

        if (ficha.descripcion) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
          const lineasDesc = doc.splitTextToSize(ficha.descripcion, specW);
          doc.text(lineasDesc, specX, sy);
          sy += lineasDesc.length * 12 + 10;
        }
        if (ficha.garantia) {
          doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
          doc.text("Garantía: ", specX, sy);
          doc.setFont("helvetica", "normal");
          doc.text(String(ficha.garantia), specX + 52, sy);
          sy += 16;
        }
        if (Array.isArray(ficha.specs) && ficha.specs.length) {
          sy += 4;
          doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
          doc.text("Especificaciones", specX, sy); sy += 4;
          doc.setDrawColor(210); doc.line(specX, sy + 4, specX + specW, sy + 4);
          sy += 18;
          doc.setFont("helvetica", "normal"); doc.setFontSize(9);
          ficha.specs.forEach((s) => {
            if (!s.label && !s.value) return;
            if (sy > 760) { doc.addPage(); sy = 56; }
            doc.setFont("helvetica", "bold");
            doc.text(String(s.label || ""), specX, sy);
            doc.setFont("helvetica", "normal");
            doc.text(String(s.value || ""), specX + 130, sy, { maxWidth: specW - 130 });
            sy += 15;
          });
        }
        fy = Math.max(fy + (ficha.imagen_url ? 172 : 0), sy);
      }

      doc.save("Cotizacion-" + (c.folio || "sin-folio") + ".pdf");
    } catch (e) {
      setOkCotiz("Error: " + mensajeError(e, "No se pudo generar el PDF."));
    } finally {
      setGenerandoPdfCotiz(false);
    }
  }

  // dd-mm-aaaa a partir del input type="date" (yyyy-mm-dd), para que calce
  // con el formato que ya usa César al redactar los correos a mano.
  function formatearFechaCL(iso) {
    if (!iso) return "-";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    return d + "-" + m + "-" + y;
  }

  // Texto de envío por correo para una cotización: mismo formato que el
  // redactado manualmente (estimados + adjunto cotización + vigencia +
  // medios de pago + recargo 30 días + cierre), pero armado con los datos
  // reales de la cotización para copiar/pegar sin reescribirlo cada vez.
  function textoEnvioCotiz(c, items) {
    const nombreCli = c.cliente_id ? (c.cliente_nombre || c.razon_social || "") : (c.razon_social || "");
    const productos = items.map((it) => it.nombre).filter(Boolean).join(", ");
    const asunto = "Cotización " + (c.folio || "") + " – Aquatrisq";
    const cuerpo =
      "Estimados " + (nombreCli || "-") + "\n" +
      "Adjunto cotización " + (c.folio || "") + " por " + (productos || "los productos cotizados") + ", válida hasta " + formatearFechaCL(c.fecha_vigencia) + ".\n" +
      "Medios de pago: transferencia bancaria o pago online. Pagos a 30 días tienen un recargo del 30% sobre el valor cotizado (aplica a clientes con antigüedad superior a un año).\n" +
      "Quedamos atentos a cualquier consulta para avanzar.\n" +
      "Saludos,\n" +
      "Aquatrisq";
    return { asunto, cuerpo };
  }

  async function copiarTextoEnvioCotiz() {
    if (!cotizEdit) return;
    const { asunto, cuerpo } = textoEnvioCotiz(cotizEdit, itemsCotiz);
    try {
      await navigator.clipboard.writeText(cuerpo);
      setOkCotiz('Texto copiado al portapapeles. Asunto sugerido: "' + asunto + '"');
    } catch (e) {
      setOkCotiz("Error: no se pudo copiar el texto (revisa permisos del navegador).");
    }
  }

  function nuevoCliente() {
    setOkCli("");
    setHistPedidos(null);
    setHistAbierto(null);
    setCliEdit({
      _nuevo: true,
      nombre: "", rut: "", codigo_cliente: siguienteCodigoCliente(), telefono: "", email: "",
      es_empresa: false, razon_social: "", giro: "", marca: "", notas: "",
      activo: true, bloqueado: false, motivo_bloqueo: "",
    });
  }
  function editarCliente(c) {
    setOkCli("");
    setHistPedidos(null);
    setHistAbierto(null);
    setHistItems({});
    setHistEntregas({});
    setSemaforoCli(null);
    setDomEdit(null);
    setOkDom("");
    setErrDom("");
    setCliEdit({ ...c, _nuevo: false });
    calcSemaforo(c);
  }

  // Semáforo de pago: solo si el cliente alguna vez entró en no-pago (Pago = No).
  // Color por la antigüedad de su deuda actual sin cobrar (días desde la entrega).
  async function calcSemaforo(c) {
    try {
      const { data: pp } = await supabase
        .from("pedidos")
        .select("numero_guia, cobro_cobrado, cobro_at")
        .eq("cliente_id", c.id);
      const guias = (pp || []).map((x) => x.numero_guia).filter(Boolean);
      if (!guias.length) return;
      const { data: ents } = await supabase.from("dt_entregas").select("*").in("guide", guias);
      const pagoNoMap = {};
      (ents || []).forEach((e) => { if (e.guide && esPagoNo(e)) pagoNoMap[e.guide] = e; });
      const conNoPago = (pp || []).filter((x) => pagoNoMap[x.numero_guia]);
      if (!conNoPago.length) return; // nunca entró en no-pago → sin semáforo
      // Días que tardó/lleva en pagar: si está cobrado, entrega→cobro; si no, entrega→hoy.
      let diasMax = 0, hayDeuda = false;
      conNoPago.forEach((x) => {
        const e = pagoNoMap[x.numero_guia];
        const g = e?.gestionado_en ? new Date(e.gestionado_en).getTime() : null;
        if (!g) return;
        let d;
        if (x.cobro_cobrado) {
          const fin = x.cobro_at ? new Date(x.cobro_at).getTime() : g;
          d = Math.max(0, Math.floor((fin - g) / 86400000));
        } else {
          hayDeuda = true;
          d = Math.floor((Date.now() - g) / 86400000);
        }
        if (d > diasMax) diasMax = d;
      });
      let cls;
      if (diasMax >= 16) cls = "rojo"; else if (diasMax >= 6) cls = "amarillo"; else cls = "verde";
      let label;
      if (hayDeuda) {
        label = cls === "rojo" ? `Moroso · ${diasMax} días sin pagar`
              : cls === "amarillo" ? `Pago lento · ${diasMax} días sin pagar`
              : `Al día · ${diasMax} días`;
      } else {
        label = cls === "rojo" ? `Historial moroso · pagó hasta en ${diasMax} días`
              : cls === "amarillo" ? `Pago lento · pagó hasta en ${diasMax} días`
              : `Buen pagador · pagó en ${diasMax} día(s)`;
      }
      setSemaforoCli({ cls, dias: diasMax, label, moroso: cls === "rojo", hayDeuda });
    } catch { /* sin semáforo si falla */ }
  }

  // Historial de pedidos del cliente en edición
  async function verHistorial(c) {
    if (!c) return;
    setCargandoHist(true);
    setErrorHist("");
    setHistAbierto(null);
    setHistEntregas({});
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("cliente_id", c.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const peds = data || [];
      setHistPedidos(peds);

      // Retorno de DispatchTrack: cruzamos dt_entregas por guide = numero_guia
      const guias = peds.map((p) => p.numero_guia).filter(Boolean);
      if (guias.length) {
        const { data: ents, error: eEnt } = await supabase
          .from("dt_entregas")
          .select("*")
          .in("guide", guias);
        if (!eEnt && ents) {
          const mapa = {};
          ents.forEach((e) => { if (e.guide) mapa[e.guide] = e; });
          setHistEntregas(mapa);
        }
        // Si eEnt existe (p.ej. RLS), no rompemos el historial: solo no se muestra el estado de entrega.
      }
    } catch (e) {
      setErrorHist(mensajeError(e, "No se pudo cargar el historial."));
      setHistPedidos([]);
    } finally {
      setCargandoHist(false);
    }
  }
  async function toggleHistItems(pedidoId) {
    if (histAbierto === pedidoId) { setHistAbierto(null); return; }
    setHistAbierto(pedidoId);
    if (!histItems[pedidoId]) {
      const { data } = await supabase.from("pedido_items").select("*").eq("pedido_id", pedidoId);
      setHistItems((prev) => ({ ...prev, [pedidoId]: data || [] }));
    }
  }
  // ── Cobranza / gestión de cobro ────────────────────────────
  async function abrirPedidoModal(p) {
    const entrega = p.numero_guia ? entregasMap[p.numero_guia] : null;
    setPedidoModal({ pedido: p, entrega });
    setPedidoEdit({
      tipo_pago:      p.tipo_pago || "Transferencia / Medio Digital",
      por_cobrar:     !!p.por_cobrar,
      tipo_documento: p.tipo_documento || "boleta",
      observacion:    p.observacion || "",
    });
    setItemsModal([]);
    setOkPed(""); setErrPed("");
    // Cargar items del pedido
    try {
      const { data: its } = await supabase.from("pedido_items").select("*").eq("pedido_id", p.id);
      setItemsModal((its || []).map((l) => ({ ...l, _key: l.id })));
    } catch { /* sin items */ }
  }

  async function guardarPedidoEdit() {
    if (!pedidoModal || !pedidoEdit) return;
    setGuardandoPed(true); setErrPed(""); setOkPed("");
    try {
      // Recalcular total desde los items editados
      const nuevoTotal = itemsModal.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.precio_unit) || 0), 0);
      const patch = {
        tipo_pago:      pedidoEdit.tipo_pago,
        por_cobrar:     pedidoEdit.tipo_pago === "Por Cobrar",
        tipo_documento: pedidoEdit.tipo_documento,
        observacion:    pedidoEdit.observacion || null,
        monto_total:    nuevoTotal,
      };
      const { error } = await supabase.from("pedidos").update(patch).eq("id", pedidoModal.pedido.id);
      if (error) throw error;

      // Reemplazar items: borrar los viejos e insertar los nuevos
      await supabase.from("pedido_items").delete().eq("pedido_id", pedidoModal.pedido.id);
      const itemsLimpios = itemsModal
        .filter((l) => (Number(l.cantidad) || 0) > 0)
        .map((l) => ({
          pedido_id:   pedidoModal.pedido.id,
          producto_id: l.producto_id || null,
          nombre:      l.nombre || "",
          codigo:      l.codigo || null,
          cantidad:    Number(l.cantidad) || 0,
          precio_unit: Number(l.precio_unit) || 0,
        }));
      if (itemsLimpios.length) await supabase.from("pedido_items").insert(itemsLimpios);

      const pedActualizado = { ...pedidoModal.pedido, ...patch };
      setPedidoModal((prev) => ({ ...prev, pedido: pedActualizado }));
      setPedidosMes((prev) => prev.map((p) => p.id === pedActualizado.id ? pedActualizado : p));
      setOkPed("Pedido e items actualizados.");
    } catch (e) {
      setErrPed(mensajeError(e, "No se pudo guardar."));
    } finally {
      setGuardandoPed(false);
    }
  }

  async function forzarEnvioDT() {
    if (!pedidoModal) return;
    setEnviandoDT(true); setErrPed(""); setOkPed("");
    try {
      const p = pedidoModal.pedido;
      // Traer items del pedido para reenviar
      const { data: itemsRaw } = await supabase
        .from("pedido_items").select("*").eq("pedido_id", p.id);
      const lineas = (itemsRaw || []).map((l) => ({
        ...l,
        subtotal: Math.round((Number(l.cantidad) || 0) * (Number(l.precio_unit) || 0)),
      }));
      const r = await fetch(`${PUENTE_URL}/api/dispatches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido: p, items: lineas }),
      });
      if (!r.ok) throw new Error(`Error ${r.status} al enviar a DT`);
      const data = await r.json();
      const dispatchId = data?.dispatchtrack?.dispatch_id || null;
      await supabase.from("pedidos").update({
        estado_sync: "enviado_dt",
        dt_dispatch_id: dispatchId,
        enviado_at: new Date().toISOString(),
      }).eq("id", p.id);
      const pedActualizado = { ...p, estado_sync: "enviado_dt", dt_dispatch_id: dispatchId };
      setPedidoModal((prev) => ({ ...prev, pedido: pedActualizado }));
      setPedidosMes((prev) => prev.map((x) => x.id === p.id ? pedActualizado : x));
      setOkPed("Enviado a DispatchTrack correctamente.");
    } catch (e) {
      setErrPed(mensajeError(e, "No se pudo enviar a DispatchTrack."));
    } finally {
      setEnviandoDT(false);
    }
  }

  async function abrirCobranzas() {
    setVista("cobranzas");
    setCargandoCob(true);
    setErrorCob("");
    setOkCob("");
    try {
      // Dos consultas en vez de una sola con .limit(1000) ordenada por
      // gestionado_en: una entrega puede estar "gestionada" (status >= 2)
      // sin tener aún gestionado_en seteado, y al ordenar con nulos al final
      // esas filas quedaban fuera del límite y desaparecían de Cobranzas aun
      // cuando en DispatchTrack sí figuraban como no pagadas (caso AQ-00526).
      const { data: conFecha, error: e1 } = await supabase
        .from("dt_entregas")
        .select("*")
        .not("gestionado_en", "is", null)
        .order("gestionado_en", { ascending: false })
        .limit(3000);
      if (e1) throw e1;
      const { data: sinFecha, error: e2 } = await supabase
        .from("dt_entregas")
        .select("*")
        .is("gestionado_en", null)
        .limit(3000);
      if (e2) throw e2;
      const ents = [...(conFecha || []), ...(sinFecha || [])];
      const gestionadas = ents.filter((e) => !!e.gestionado_en || Number(e.status) >= 2);
      const pagoNo = gestionadas.filter((e) => esPagoNo(e));
      const guias = [...new Set(pagoNo.map((e) => e.guide).filter(Boolean))];
      let peds = [];
      if (guias.length) {
        const CH = 200;
        for (let i = 0; i < guias.length; i += CH) {
          const lote = guias.slice(i, i + CH);
          const { data: pp } = await supabase.from("pedidos").select("*").in("numero_guia", lote);
          peds = peds.concat(pp || []);
        }
      }
      const mapEnt = {};
      pagoNo.forEach((e) => { if (e.guide) mapEnt[e.guide] = e; });
      const lista = peds
        .map((p) => ({ pedido: p, entrega: mapEnt[p.numero_guia] || null }))
        .sort((a, b) => new Date(b.entrega?.gestionado_en || 0) - new Date(a.entrega?.gestionado_en || 0));
      setCobranzas(lista);
    } catch (e) {
      setErrorCob(mensajeError(e, "No se pudo cargar la gestión de cobro."));
      setCobranzas([]);
    } finally {
      setCargandoCob(false);
    }
  }

  function actualizarCobranzaLocal(id, patch) {
    setCobranzas((prev) => (prev ? prev.map((x) => (x.pedido.id === id ? { ...x, pedido: { ...x.pedido, ...patch } } : x)) : prev));
    setPedidosMes((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setPedidoModal((prev) => (prev && prev.pedido.id === id ? { ...prev, pedido: { ...prev.pedido, ...patch } } : prev));
  }

  // Marca/desmarca Cobrado o Recuperado (estados independientes).
  async function marcarCobroCampo(pedido, campo) {
    // Al marcar "Cobrado" abrimos el panel de respaldo (comprobante opcional)
    // en vez de guardar directo — misma lógica de respaldos que Pagos a
    // proveedor / Facturas por emitir. Desmarcar sigue siendo directo.
    if (campo === "cobro_cobrado" && !pedido.cobro_cobrado) {
      setCobroRespaldoPedido(pedido.id);
      setCobroRespaldoArchivo(null);
      setErrorCob("");
      return;
    }
    setGuardandoCob(pedido.id);
    setErrorCob("");
    setOkCob("");
    try {
      const nuevo = !pedido[campo];
      const patch = { [campo]: nuevo, cobro_at: new Date().toISOString(), cobro_por: perfilNombre || null };
      if (campo === "cobro_cobrado" && !nuevo) patch.cobro_respaldo_path = null;
      const { error } = await supabase.from("pedidos").update(patch).eq("id", pedido.id);
      if (error) throw error;
      actualizarCobranzaLocal(pedido.id, patch);
      setOkCob(`${pedido.numero_guia || ""}: ${campo === "cobro_cobrado" ? "Cobrado" : "Recuperado"} ${nuevo ? "marcado" : "desmarcado"}.`);
    } catch (e) {
      setErrorCob(mensajeError(e, "No se pudo actualizar."));
    } finally {
      setGuardandoCob("");
    }
  }
  // Confirma el cobro, subiendo opcionalmente el comprobante (transferencia,
  // voucher, etc.) a un bucket privado. Permite guardar sin adjuntar archivo.
  async function marcarCobradoConRespaldo(pedido, archivo) {
    setGuardandoCob(pedido.id);
    setErrorCob(""); setOkCob("");
    try {
      let path = null;
      if (archivo) {
        const ext = (archivo.name.split(".").pop() || "jpg").toLowerCase();
        path = `${pedido.numero_guia || pedido.id}-${Date.now()}.${ext}`;
        const up = await supabase.storage
          .from("respaldos-cobro")
          .upload(path, archivo, { upsert: false, contentType: archivo.type || "application/octet-stream" });
        if (up.error) throw up.error;
      }
      const patch = {
        cobro_cobrado: true,
        cobro_at: new Date().toISOString(),
        cobro_por: perfilNombre || null,
        ...(path ? { cobro_respaldo_path: path } : {}),
      };
      const { error } = await supabase.from("pedidos").update(patch).eq("id", pedido.id);
      if (error) throw error;
      actualizarCobranzaLocal(pedido.id, patch);
      setOkCob(`${pedido.numero_guia || ""}: Cobrado marcado${archivo ? " con comprobante adjunto" : ""}.`);
      setCobroRespaldoPedido(null);
      setCobroRespaldoArchivo(null);
    } catch (e) {
      setErrorCob(mensajeError(e, "No se pudo actualizar."));
    } finally {
      setGuardandoCob("");
    }
  }
  async function verRespaldoCobro(path) {
    try {
      const { data, error } = await supabase.storage.from("respaldos-cobro").createSignedUrl(path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      alert("No se pudo abrir el comprobante: " + mensajeError(e, "error desconocido"));
    }
  }

  // Registra un intento de cobro. Más de 3 intentos sin cobrar → bloquea al cliente.
  async function registrarIntento(pedido) {
    setGuardandoCob(pedido.id);
    setErrorCob("");
    setOkCob("");
    try {
      const intentos = (Number(pedido.cobro_intentos) || 0) + 1;
      const patch = { cobro_intentos: intentos, cobro_at: new Date().toISOString(), cobro_por: perfilNombre || null };
      const { error } = await supabase.from("pedidos").update(patch).eq("id", pedido.id);
      if (error) throw error;
      actualizarCobranzaLocal(pedido.id, patch);
      setOkCob(`${pedido.numero_guia || ""}: intento de cobro registrado (${intentos}).`);

      if (intentos > 3 && !pedido.cobro_cobrado) {
        const cli = clientePorId[pedido.cliente_id];
        if (cli && !cli.bloqueado) {
          const motivo = `Deuda pendiente: ${intentos} intentos de cobro sin éxito (guía ${pedido.numero_guia || ""})`;
          const bpatch = { bloqueado: true, motivo_bloqueo: motivo, bloqueado_por: perfilNombre || null, bloqueado_at: new Date().toISOString() };
          const { error: eCli } = await supabase.from("clientes").update(bpatch).eq("id", cli.id);
          if (!eCli) {
            setClientes((prev) => prev.map((c) => (c.id === cli.id ? { ...c, ...bpatch } : c)));
            setOkCob(`⚠ ${cli.nombre} fue bloqueado automáticamente por ${intentos} intentos de cobro sin éxito.`);
          }
        }
      }
    } catch (e) {
      setErrorCob(mensajeError(e, "No se pudo registrar el intento."));
    } finally {
      setGuardandoCob("");
    }
  }

  // Bloque de detalle de entrega (reutilizado en popup). Devuelve JSX o null.
  function renderEntregaDT(entrega) {
    if (!entrega) return <p className="aq-muted">Este pedido aún no tiene retorno de DispatchTrack (no gestionado).</p>;
    const answers = answersFromRaw(entrega);
    const ent = estadoEntregaDT(entrega, null);
    return (
      <div className="aq-hist-pod" style={{ marginTop: 0 }}>
        <strong>Entrega (DispatchTrack)</strong>
        <div>Estado: {ent.label}</div>
        {entrega.gestionado_en && <div>Gestionado: {new Date(entrega.gestionado_en).toLocaleString("es-CL")}</div>}
        {entrega.contact_name && <div>Recibe / domicilio: {entrega.contact_name}</div>}
        {(entrega.bidon_pendiente !== null && entrega.bidon_pendiente !== undefined) && <div>Bidón pendiente: {entrega.bidon_pendiente}</div>}
        {entrega.ruta && <div>Ruta: {entrega.ruta}</div>}
        {(entrega.latitude && entrega.longitude) && (
          <div><a className="aq-link" href={`https://maps.google.com/?q=${entrega.latitude},${entrega.longitude}`} target="_blank" rel="noreferrer">Ver ubicación de entrega</a></div>
        )}
        {answers.length > 0 && (
          <div className="aq-hist-form">
            {answers.map((a, idx) => (
              <div key={idx}><em>{a.name}:</em> {/^https?:\/\//.test(a.val) ? <a className="aq-link" href={a.val} target="_blank" rel="noreferrer">ver archivo</a> : a.val}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  async function guardarDomicilio() {
    if (!domEdit) return;
    setGuardandoDom(true); setErrDom(""); setOkDom("");
    try {
      const payload = {
        cliente_id:      cliEdit.id,
        identificador_dt: (domEdit.identificador_dt || "").trim() || null,
        etiqueta:        (domEdit.etiqueta || "").trim() || null,
        direccion:       (domEdit.direccion || "").trim() || null,
        comuna:          (domEdit.comuna || "").trim() || null,
        es_principal:    !!domEdit.es_principal,
      };
      if (!payload.identificador_dt) { setErrDom("El identificador (ej: 0215-2) es obligatorio."); return; }
      if (!payload.direccion)        { setErrDom("La dirección es obligatoria."); return; }
      if (domEdit._nuevo) {
        const { error } = await supabase.from("domicilios").insert(payload);
        if (error) throw error;
        setOkDom("Domicilio agregado.");
      } else {
        const { error } = await supabase.from("domicilios").update(payload).eq("id", domEdit.id);
        if (error) throw error;
        setOkDom("Domicilio actualizado.");
      }
      // Refresca índice global de domicilios
      const { data: nuevos } = await supabase.from("domicilios").select("*").eq("cliente_id", cliEdit.id);
      setTodosDomicilios((prev) => {
        const sinEste = prev.filter((d) => d.cliente_id !== cliEdit.id);
        return [...sinEste, ...(nuevos || [])];
      });
      setDomEdit(null);
    } catch (e) {
      setErrDom(mensajeError(e, "No se pudo guardar el domicilio."));
    } finally {
      setGuardandoDom(false);
    }
  }

  async function guardarCliente() {
    if (!cliEdit) return;
    const nombre = (cliEdit.nombre || "").trim();
    if (!nombre) { setOkCli("Error: el nombre es obligatorio."); return; }
    const email = (cliEdit.email || "").trim();
    if (email && !emailValido(email)) { setOkCli("Error: el email no tiene un formato válido."); return; }
    setGuardandoCli(true);
    setOkCli("");
    try {
      const patch = {
        nombre,
        rut: (cliEdit.rut || "").trim() || null,
        codigo_cliente: (cliEdit.codigo_cliente || "").trim() || null,
        telefono: (cliEdit.telefono || "").trim() || null,
        email: email || null,
        email_status: email ? "ok" : (cliEdit.email_status || null),
        es_empresa: !!cliEdit.es_empresa,
        razon_social: cliEdit.es_empresa ? ((cliEdit.razon_social || "").trim() || null) : null,
        giro: cliEdit.es_empresa ? ((cliEdit.giro || "").trim() || null) : null,
        marca: (cliEdit.marca || "").trim() || null,
        notas: (cliEdit.notas || "").trim() || null,
        bloqueado: !!cliEdit.bloqueado,
        motivo_bloqueo: cliEdit.bloqueado ? ((cliEdit.motivo_bloqueo || "").trim() || "Bloqueado (sin motivo)") : null,
        bloqueado_por: cliEdit.bloqueado ? ((cliEdit.bloqueado_por || perfilNombre || "").trim() || null) : null,
        bloqueado_at: cliEdit.bloqueado ? (cliEdit.bloqueado_at || new Date().toISOString()) : null,
      };

      let guardado;
      if (cliEdit._nuevo) {
        const { data, error } = await supabase
          .from("clientes")
          .insert({ ...patch, activo: true })
          .select()
          .single();
        if (error) throw error;
        guardado = data;
        setClientes((prev) => [...prev, guardado].sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
      } else {
        const { error } = await supabase.from("clientes").update(patch).eq("id", cliEdit.id);
        if (error) throw error;
        guardado = { ...cliEdit, ...patch };
        delete guardado._nuevo;
        setClientes((prev) => prev.map((c) => (c.id === guardado.id ? guardado : c)));
        if (cliente && cliente.id === guardado.id) setCliente(guardado);
      }
      setCliEdit(null);
      setOkCli(cliEdit._nuevo ? "Cliente creado." : "Cambios guardados.");
    } catch (err) {
      setOkCli("Error: " + (err.message || err));
    } finally {
      setGuardandoCli(false);
    }
  }
  // Desactivar = baja lógica (no borrado físico, para no romper pedidos/domicilios).
  async function desactivarCliente(c) {
    if (!c) return;
    if (!window.confirm(`¿Desactivar a "${c.nombre}"? Dejará de aparecer en búsquedas de Nuevo pedido. Sus pedidos históricos se conservan.`)) return;
    try {
      const { error } = await supabase.from("clientes").update({ activo: false }).eq("id", c.id);
      if (error) throw error;
      const actualizado = { ...c, activo: false };
      setClientes((prev) => prev.map((x) => (x.id === c.id ? actualizado : x)));
      setCliEdit(null);
      setOkCli("Cliente desactivado.");
    } catch (err) {
      setOkCli("Error: " + (err.message || err));
    }
  }
  // Reactivar = volver a la baja lógica. Vuelve a aparecer en Nuevo pedido.
  async function reactivarCliente(c) {
    if (!c) return;
    try {
      const { error } = await supabase.from("clientes").update({ activo: true }).eq("id", c.id);
      if (error) throw error;
      const actualizado = { ...c, activo: true };
      setClientes((prev) => prev.map((x) => (x.id === c.id ? actualizado : x)));
      setCliEdit(actualizado);
      setOkCli("Cliente reactivado.");
    } catch (err) {
      setOkCli("Error: " + (err.message || err));
    }
  }

  // ── Mantenedor de productos (admin) ────────────────────────
  async function cargarProductosAll() {
    setCargandoProd(true);
    setErrorProd("");
    try {
      const { data, error } = await supabase.from("productos").select("*").order("nombre");
      if (error) throw error;
      setProductosAll(data || []);
    } catch (e) {
      setErrorProd(mensajeError(e, "No se pudieron cargar los productos."));
    } finally {
      setCargandoProd(false);
    }
  }
  function nuevoProducto() {
    setOkProd("");
    setProdEdit({
      _nuevo: true,
      codigo: "", nombre: "", familia: "", descripcion: "",
      precio_lista: 0, activo: true, precio_variable: false, requiere_factura: false,
      modo_descuento_volumen: "ninguno", desc_volumen_umbral: null, desc_volumen_pct: null,
    });
  }
  function editarProducto(p) {
    setOkProd("");
    setProdEdit({ ...p, _nuevo: false });
  }
  async function guardarProducto() {
    if (!prodEdit) return;
    const nombre = (prodEdit.nombre || "").trim();
    const codigo = (prodEdit.codigo || "").trim();
    if (!nombre) { setOkProd("Error: el nombre es obligatorio."); return; }
    if (!codigo) { setOkProd("Error: el código (SKU) es obligatorio."); return; }
    setGuardandoProd(true);
    setOkProd("");
    try {
      const modo = prodEdit.modo_descuento_volumen || "ninguno";
      const patch = {
        codigo,
        nombre,
        familia: (prodEdit.familia || "").trim() || null,
        descripcion: (prodEdit.descripcion || "").trim() || null,
        precio_lista: Number(prodEdit.precio_lista) || 0,
        activo: !!prodEdit.activo,
        precio_variable: !!prodEdit.precio_variable,
        requiere_factura: !!prodEdit.requiere_factura,
        modo_descuento_volumen: modo,
        desc_volumen_umbral: modo === "porcentaje" ? (Number(prodEdit.desc_volumen_umbral) || null) : null,
        desc_volumen_pct: modo === "porcentaje" ? (Number(prodEdit.desc_volumen_pct) || null) : null,
      };
      if (prodEdit._nuevo) {
        const { error } = await supabase.from("productos").insert(patch);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("productos").update(patch).eq("id", prodEdit.id);
        if (error) throw error;
      }
      await cargarProductosAll();
      await recargarProductosActivos();
      setProdEdit(null);
      setOkProd(prodEdit._nuevo ? "Producto creado." : "Cambios guardados.");
    } catch (err) {
      setOkProd("Error: " + (err.message || err));
    } finally {
      setGuardandoProd(false);
    }
  }
  // Pausar / activar SKU: pausado (activo=false) deja de aparecer en Nuevo pedido.
  async function togglePausaProducto(p) {
    setOkProd("");
    try {
      const nuevo = !p.activo;
      const { error } = await supabase.from("productos").update({ activo: nuevo }).eq("id", p.id);
      if (error) throw error;
      setProductosAll((prev) => prev.map((x) => (x.id === p.id ? { ...x, activo: nuevo } : x)));
      await recargarProductosActivos();
      setOkProd(nuevo ? `"${p.nombre}" reactivado.` : `"${p.nombre}" pausado (no aparece en Nuevo pedido).`);
    } catch (err) {
      setOkProd("Error: " + (err.message || err));
    }
  }

  // ── Mantenedor de perfiles (admin) ─────────────────────────
  async function cargarPerfiles() {
    setCargandoPerf(true);
    setErrorPerf("");
    try {
      const { data, error } = await supabase.from("perfiles").select("*").order("nombre");
      if (error) throw error;
      setPerfiles(data || []);
    } catch (e) {
      setErrorPerf(mensajeError(e, "No se pudieron cargar los perfiles."));
    } finally {
      setCargandoPerf(false);
    }
  }
  function editarPerfil(p) {
    setOkPerf("");
    setPerfEdit({ ...p });
  }
  async function guardarPerfil() {
    if (!perfEdit) return;
    const esYo = session && perfEdit.id === session.user.id;
    // Salvaguarda: no permitir que el admin se quite a sí mismo el rol o se desactive (evita quedar sin acceso).
    if (esYo && (perfEdit.rol !== "admin" || !perfEdit.activo)) {
      setOkPerf("Error: no puedes quitarte tu propio rol admin ni desactivarte (evita bloqueo de acceso).");
      return;
    }
    setGuardandoPerf(true);
    setOkPerf("");
    try {
      const patch = {
        nombre: (perfEdit.nombre || "").trim() || null,
        rol: perfEdit.rol,
        activo: !!perfEdit.activo,
      };
      const { error } = await supabase.from("perfiles").update(patch).eq("id", perfEdit.id);
      if (error) throw error;
      setPerfiles((prev) => prev.map((x) => (x.id === perfEdit.id ? { ...x, ...patch } : x)));
      setPerfEdit(null);
      setOkPerf("Perfil actualizado.");
    } catch (err) {
      setOkPerf("Error: " + (err.message || err));
    } finally {
      setGuardandoPerf(false);
    }
  }

  // ── Al elegir cliente: domicilios + plan + descuentos ──────
  async function elegirCliente(c, domPreseleccionarId) {
    setCliente(c);
    setBuscarCliente("");
    setDomicilioId("");
    setPlanPrepago(null);
    setConsumePlan(false);
    setAvisoRepetir("");
    setAvisoDeuda(null);
    setAvisoBidones(null);
    setSemaforoCli(null);
    setMarca(c.marca || "TrisQ");
    setRutFactura(c.rut || "");
    setTipoDocumento(c.es_empresa ? "factura" : "boleta");

    const [dom, plan, dc] = await Promise.all([
      supabase.from("domicilios").select("*").eq("cliente_id", c.id).order("es_principal", { ascending: false }),
      supabase.from("planes_contratados").select("*").eq("cliente_id", c.id).eq("tipo", "prepago").eq("estado", "activo"),
      supabase.from("descuentos_cliente").select("*").eq("cliente_id", c.id).eq("activo", true),
    ]);

    const doms = dom.data || [];
    setDomicilios(doms);
    // Si se buscó por un identificador de domicilio (215-1), preseleccionar ese;
    // si no, el principal o el primero.
    const elegido =
      (domPreseleccionarId && doms.find((d) => d.id === domPreseleccionarId)) ||
      doms.find((d) => d.es_principal) ||
      doms[0];
    if (elegido) setDomicilioId(elegido.id);

    // Plan prepago con saldo disponible
    const conSaldo = (plan.data || []).find((p) => (p.unidades_saldo ?? 0) > 0);
    setPlanPrepago(conSaldo || null);

    setDescCliente(dc.data || []);

    // Alerta de deuda: entregas con Pago=No que aún no están cobradas
    try {
      const { data: pp } = await supabase
        .from("pedidos")
        .select("numero_guia, monto_total, cobro_cobrado")
        .eq("cliente_id", c.id);
      const guias = (pp || []).filter((x) => x.numero_guia && !x.cobro_cobrado).map((x) => x.numero_guia);
      if (guias.length) {
        const { data: ents } = await supabase.from("dt_entregas").select("*").in("guide", guias);
        const deudaGuias = (ents || []).filter((e) => esPagoNo(e)).map((e) => e.guide);
        if (deudaGuias.length) {
          const monto = (pp || [])
            .filter((x) => deudaGuias.includes(x.numero_guia))
            .reduce((s, x) => s + (Number(x.monto_total) || 0), 0);
          setAvisoDeuda({ guias: deudaGuias, monto });
        }
      }
    } catch { /* si falla (RLS), no bloqueamos el flujo */ }

    // Aviso de bidones pendientes marcados para retirar en el próximo pedido.
    setAvisoBidones(null);
    try {
      const { data: pp2 } = await supabase
        .from("pedidos")
        .select("numero_guia")
        .eq("cliente_id", c.id)
        .eq("bidones_proximo_pedido", true)
        .is("bidones_retirados_en", null);
      const guiasBid = (pp2 || []).map((x) => x.numero_guia).filter(Boolean);
      if (guiasBid.length) {
        const { data: entsBid } = await supabase
          .from("dt_entregas").select("guide, bidon_pendiente").in("guide", guiasBid).gt("bidon_pendiente", 0);
        const total = (entsBid || []).reduce((s, e) => s + (Number(e.bidon_pendiente) || 0), 0);
        if (total > 0) setAvisoBidones({ cantidad: total, guias: guiasBid });
      }
    } catch { /* si falla (RLS), no bloqueamos el flujo */ }

    calcSemaforo(c);
  }

  // ── Bloque 5: repetir última compra ────────────────────────
  // Precarga productos, cantidades, domicilio y forma de pago del último
  // pedido del cliente. El operador revisa y confirma. Los precios se
  // recalculan a la lista vigente (un pedido nuevo se cobra a precio de hoy).
  async function repetirUltimaCompra() {
    if (!cliente) return;
    setRepitiendo(true);
    setAvisoRepetir("");
    setResultado(null);
    try {
      const { data: peds, error: ePed } = await supabase
        .from("pedidos")
        .select("*")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (ePed) throw ePed;
      const ult = (peds || [])[0];
      if (!ult) { setAvisoRepetir("Este cliente no tiene pedidos anteriores."); return; }

      const { data: lineas, error: eIt } = await supabase
        .from("pedido_items")
        .select("*")
        .eq("pedido_id", ult.id);
      if (eIt) throw eIt;

      // Mapear líneas a productos ACTIVOS. Los pausados/eliminados se omiten.
      const nuevas = [];
      const omitidos = [];
      (lineas || []).forEach((l) => {
        const prod = productos.find((p) => p.id === l.producto_id);
        if (!prod) {
          omitidos.push(l.nombre || l.codigo || "producto");
          return;
        }
        const cantidad = Number(l.cantidad) || 1;
        nuevas.push({
          key: crypto.randomUUID(),
          producto_id: prod.id,
          cantidad,
          precio_unit: precioSugerido(prod, cantidad, tramos),
          precio_editado: false,
        });
      });

      if (nuevas.length === 0) {
        setAvisoRepetir("La última compra no tiene productos disponibles hoy (todos pausados o eliminados).");
        return;
      }

      setItems(nuevas);
      setDescuentos([]); // los descuentos no se arrastran: se re-evalúan en el pedido nuevo

      // Domicilio del último pedido, si todavía existe entre los del cliente
      if (ult.domicilio_id && domicilios.some((d) => d.id === ult.domicilio_id)) {
        setDomicilioId(ult.domicilio_id);
      }
      // Documento y forma de pago del último pedido
      if (ult.tipo_documento && TIPOS_DOC.includes(ult.tipo_documento)) setTipoDocumento(ult.tipo_documento);
      if (ult.tipo_pago && TIPOS_PAGO.includes(ult.tipo_pago) && ult.tipo_pago !== "Plan PrePago") {
        setTipoPago(ult.tipo_pago);
      }

      const fecha = ult.created_at ? new Date(ult.created_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) : "";
      let msg = `Cargada la última compra${ult.numero_guia ? " (guía " + ult.numero_guia + ")" : ""}${fecha ? " del " + fecha : ""}: ${nuevas.length} línea(s). Precios actualizados a lista vigente. Revisa y confirma.`;
      if (omitidos.length) msg += ` ⚠ No se cargaron (pausados/sin stock): ${omitidos.join(", ")}.`;
      setAvisoRepetir(msg);
    } catch (e) {
      setAvisoRepetir("Error al repetir la compra: " + mensajeError(e, "error desconocido"));
    } finally {
      setRepitiendo(false);
    }
  }

  // Resultados de búsqueda: por datos del cliente (nombre/RUT/código) y
  // también por el identificador del domicilio (ej. 215-1).
  const resultadosBusqueda = useMemo(() => {
    const q = buscarCliente.trim().toLowerCase();
    if (!q) return [];
    const porCliente = clientes
      .filter(
        (c) =>
          c.activo !== false &&
          ((c.nombre || "").toLowerCase().includes(q) ||
          (c.rut || "").toLowerCase().includes(q) ||
          (c.codigo_cliente || "").toLowerCase().includes(q))
      )
      .map((c) => ({ cliente: c, dom: null }));

    // Coincidencias por identificador_dt del domicilio (215-1)
    const porDomicilio = todosDomicilios
      .filter((d) => (d.identificador_dt || "").toLowerCase().includes(q))
      .map((d) => ({ cliente: clientes.find((c) => c.id === d.cliente_id), dom: d }))
      .filter((r) => r.cliente && r.cliente.activo !== false);

    // Unir evitando duplicar el mismo par cliente+domicilio
    const vistos = new Set();
    const todo = [...porDomicilio, ...porCliente].filter((r) => {
      const k = r.cliente.id + "|" + (r.dom?.id || "");
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
    return todo.slice(0, 8);
  }, [buscarCliente, clientes, todosDomicilios]);

  // ── Líneas de producto ─────────────────────────────────────
  function agregarItem() {
    const prod = productos[0];
    if (!prod) return;
    const cantidad = 1;
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        producto_id: prod.id,
        cantidad,
        precio_unit: precioSugerido(prod, cantidad, tramos),
        precio_editado: false,
      },
    ]);
  }

  function cambiarProducto(key, producto_id) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const prod = productos.find((p) => p.id === producto_id);
        return {
          ...it,
          producto_id,
          precio_editado: false,
          precio_unit: precioSugerido(prod, it.cantidad, tramos),
        };
      })
    );
  }

  function cambiarCantidad(key, cantidad) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const prod = productos.find((p) => p.id === it.producto_id);
        return {
          ...it,
          cantidad,
          precio_unit: it.precio_editado ? it.precio_unit : precioSugerido(prod, cantidad, tramos),
        };
      })
    );
  }

  function cambiarPrecio(key, precio_unit) {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, precio_unit, precio_editado: true } : it))
    );
  }

  function quitarItem(key) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  // ── Descuentos ─────────────────────────────────────────────
  function agregarDescuento(base) {
    setDescuentos((prev) => [
      ...prev,
      { key: crypto.randomUUID(), origen: base?.origen || "manual", descripcion: base?.descripcion || "", monto: base?.monto || 0 },
    ]);
  }
  function cambiarDescuento(key, campo, valor) {
    setDescuentos((prev) => prev.map((d) => (d.key === key ? { ...d, [campo]: valor } : d)));
  }
  function quitarDescuento(key) {
    setDescuentos((prev) => prev.filter((d) => d.key !== key));
  }

  // ── Totales ────────────────────────────────────────────────
  const subtotal = items.reduce((s, it) => s + Math.round((Number(it.cantidad) || 0) * (Number(it.precio_unit) || 0)), 0);
  const totalDesc = descuentos.reduce((s, d) => s + (Number(d.monto) || 0), 0);
  const montoTotal = Math.max(0, subtotal - totalDesc);

  // Unidades que consume el plan prepago = recargas R20 del pedido.
  const unidadesPlan = items.reduce((s, it) => {
    const prod = productos.find((p) => p.id === it.producto_id);
    return prod && prod.codigo === "R20" ? s + (Number(it.cantidad) || 0) : s;
  }, 0);

  // Si consume plan, el medio de pago es Plan PrePago.
  useEffect(() => {
    if (consumePlan) setTipoPago("Plan PrePago");
  }, [consumePlan]);

  // ── Validación ─────────────────────────────────────────────
  function validar() {
    if (!cliente) return "Elige un cliente.";
    if (cliente.bloqueado)
      return "Cliente bloqueado" + (cliente.motivo_bloqueo ? ": " + cliente.motivo_bloqueo : "") + ". No se puede generar el pedido.";
    if (!domicilioId) return "Elige un domicilio de entrega.";
    if (items.length === 0) return "Agrega al menos un producto.";
    if (items.some((it) => !it.producto_id || Number(it.cantidad) <= 0)) return "Revisa cantidades y productos de las líneas.";
    if (tipoDocumento === "factura" && !rutFactura.trim()) return "Para factura necesitas el RUT de facturación.";
    if (consumePlan && planPrepago && unidadesPlan > (planPrepago.unidades_saldo ?? 0))
      return `El plan tiene ${planPrepago.unidades_saldo} recargas de saldo y el pedido consume ${unidadesPlan}.`;
    return "";
  }
  const errorValidacion = validar();

  // ── Guardar pedido ─────────────────────────────────────────
  // ── Reserva del Nº de pedido al iniciar la toma ────────────
  // Llama al correlativo atómico de la base (siguiente_numero_aq) y lo guarda
  // en este navegador para que sobreviva a un refresco mientras no se guarde.
  const LS_NUM_RESERVADO = "aq_numero_reservado";

  async function reservarNumero({ forzar = false } = {}) {
    if (numeroReservado && !forzar) return numeroReservado;
    setReservandoNum(true);
    setErrorReserva("");
    try {
      const { data, error } = await supabase.rpc("siguiente_numero_aq");
      if (error) throw error;
      const num = typeof data === "string" ? data : (Array.isArray(data) ? data[0] : null);
      if (!num) throw new Error("La base no devolvió un número.");
      setNumeroReservado(num);
      try { localStorage.setItem(LS_NUM_RESERVADO, num); } catch { /* noop */ }
      return num;
    } catch (e) {
      setErrorReserva(mensajeError(e, "No se pudo reservar el número."));
      return null;
    } finally {
      setReservandoNum(false);
    }
  }

  // Recupera una reserva pendiente de este navegador al cargar la app.
  useEffect(() => {
    try {
      const n = localStorage.getItem(LS_NUM_RESERVADO);
      if (n) setNumeroReservado(n);
    } catch { /* noop */ }
  }, []);

  // Reserva automática al entrar a "Nuevo pedido" si no hay una pendiente.
  useEffect(() => {
    if (vista === "nuevo" && credsListas && rol !== "gerencial" && !numeroReservado && !reservandoNum) {
      reservarNumero();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, credsListas, rol]);

  // Distribuidor: al entrar a "Nuevo pedido", fija su propio cliente/domicilio
  // (resuelto por su identificador_dt) y lo deja no editable. Sus correlativos
  // siempre salen con SUS datos duros como contacto destino en DispatchTrack.
  useEffect(() => {
    if (rol !== "distribuidor" || vista !== "nuevo" || !credsListas) return;
    if (cliente) return; // ya fijado
    const ident = (distIdentDt || "").trim().toLowerCase();
    if (!ident) return;
    const dom = todosDomicilios.find((d) => (d.identificador_dt || "").toLowerCase() === ident);
    if (!dom) return;
    const c = clientes.find((x) => x.id === dom.cliente_id);
    if (c) elegirCliente(c, dom.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol, vista, credsListas, distIdentDt, todosDomicilios, clientes, cliente]);

  // Distribuidor: su nombre de chofer es SIEMPRE el autor del pedido.
  useEffect(() => {
    if (rol === "distribuidor" && distChofer) setCreadoPor(distChofer);
  }, [rol, distChofer]);

  // Distribuidor: valores duros del pedido (no edita el formulario):
  // 1 línea CP1·Compra, cantidad 1, precio 0, y entrega = hoy.
  useEffect(() => {
    if (rol !== "distribuidor" || vista !== "nuevo") return;
    const cp1 = productos.find((p) => (p.codigo || "").toUpperCase() === "CP1");
    if (cp1 && items.length === 0) {
      setItems([{
        key: crypto.randomUUID(),
        producto_id: cp1.id,
        cantidad: 1,
        precio_unit: 0,
        precio_editado: true,
      }]);
    }
    setFechaMin(fechaHoy("09:00"));
    setFechaMax(fechaHoy("17:00"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol, vista, productos, items.length]);

  async function guardarPedido() {
    const err = validar();
    if (err) {
      setResultado({ ok: false, msg: err });
      return;
    }
    setGuardando(true);
    setResultado(null);

    try {
      // 1) Cabecera. Si reservamos un número al iniciar, lo insertamos explícito
      // (la base NO consume otro, porque numero_guia se asigna por DEFAULT, no por trigger).
      const cabecera = {
        cliente_id: cliente.id,
        domicilio_id: domicilioId,
        ...(numeroReservado ? { numero_guia: numeroReservado } : {}),
        fecha_min_entrega: fechaMin ? new Date(fechaMin).toISOString() : null,
        fecha_max_entrega: fechaMax ? new Date(fechaMax).toISOString() : null,
        marca: marca || null,
        tipo_pago: tipoPago,
        por_cobrar: tipoPago === "Por Cobrar",
        tipo_documento: tipoDocumento,
        rut_factura: tipoDocumento === "factura" ? rutFactura.trim() : null,
        monto_total: montoTotal,
        origen: rol === "distribuidor" ? "distribuidor" : "formulario",
        observacion: observacion.trim() || null,
        estado_sync: "pendiente",
        creado_por: (rol === "distribuidor" ? (distChofer || creadoPor) : creadoPor).trim() || null,
        nro_jumpseller: nroDte.trim() || null,
        plan_contratado_id: consumePlan && planPrepago ? planPrepago.id : null,
        consume_plan: consumePlan && !!planPrepago,
      };

      const { data: pedido, error: ePed } = await supabase
        .from("pedidos")
        .insert(cabecera)
        .select()
        .single();
      if (ePed) throw ePed;

      // 2) Líneas
      const lineas = items.map((it) => {
        const prod = productos.find((p) => p.id === it.producto_id);
        const cant = Number(it.cantidad) || 0;
        const pu = Number(it.precio_unit) || 0;
        return {
          pedido_id: pedido.id,
          producto_id: it.producto_id,
          nombre: prod ? prod.nombre : "",
          codigo: prod ? prod.codigo : null,
          cantidad: cant,
          precio_unit: pu,
        };
      });
      const { error: eItems } = await supabase.from("pedido_items").insert(lineas);
      if (eItems) throw eItems;

      // 3) Descuentos
      if (descuentos.length) {
        const ds = descuentos
          .filter((d) => Number(d.monto) > 0)
          .map((d) => ({
            pedido_id: pedido.id,
            origen: d.origen || "manual",
            descripcion: d.descripcion || null,
            monto: Number(d.monto) || 0,
            aplicado_por: creadoPor.trim() || null,
          }));
        if (ds.length) {
          const { error: eDesc } = await supabase.from("pedido_descuentos").insert(ds);
          if (eDesc) throw eDesc;
        }
      }

      // 4) Consumo de saldo del plan prepago
      let avisoPlan = "";
      if (cabecera.consume_plan && unidadesPlan > 0) {
        const nuevoConsumo = (planPrepago.unidades_consumidas || 0) + unidadesPlan;
        const { error: ePlan } = await supabase
          .from("planes_contratados")
          .update({ unidades_consumidas: nuevoConsumo })
          .eq("id", planPrepago.id);
        if (ePlan) avisoPlan = " (no se pudo descontar el saldo del plan: revisar permisos)";
      }

      // 5) Envío a DispatchTrack vía el puente (best-effort).
      let sync = "pendiente";
      let avisoSync = "Envío a DispatchTrack pendiente.";
      try {
        const r = await fetch(`${PUENTE_URL}/api/dispatches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pedido, items: lineas }),
        });
        if (r.ok) {
          const data = await r.json();
          const dispatchId = data?.dispatchtrack?.dispatch_id || null;
          await supabase
            .from("pedidos")
            .update({
              estado_sync: "enviado_dt",
              dt_dispatch_id: dispatchId,
              enviado_at: new Date().toISOString(),
            })
            .eq("id", pedido.id);
          sync = "enviado_dt";
          avisoSync = "Enviado a DispatchTrack.";
        }
      } catch {
        /* el puente puede no tener aún el mapeo; el pedido queda guardado igual */
      }

      // 6) Mensaje de confirmación + correo al cliente (best-effort)
      const guia = pedido.numero_guia;
      const mensaje = mensajeConfirmacion(guia, cliente?.nombre);
      const emailDestino = emailValido(cliente?.email) ? cliente.email.trim() : null;

      const detalle = lineas
        .map((l) => `${l.cantidad} x ${l.nombre}${l.codigo ? " (" + l.codigo + ")" : ""} — ${CLP((Number(l.cantidad) || 0) * (Number(l.precio_unit) || 0))}`)
        .join("\n");

      let emailEnviado = false;
      if (emailDestino) {
        try {
          const re = await fetch(`${PUENTE_URL}/api/notificar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: emailDestino,
              cliente: cliente?.nombre || "",
              guia,
              mensaje,
              detalle,
              total: montoTotal,
            }),
          });
          emailEnviado = re.ok;
        } catch {
          /* el endpoint de correo puede no estar aún en el puente */
        }
      }

      setConfirma({ guia, mensaje, emailEnviado, emailDestino, sync });
      setVista("confirmacion");

      // Reset completo: volvemos al inicio en una pantalla limpia.
      setItems([]);
      setDescuentos([]);
      setObservacion("");
      setNroDte("");
      setCliente(null);
      setDomicilioId("");
      setPlanPrepago(null);
      setConsumePlan(false);
      setResultado(null);
      setNumeroReservado(null);
      try { localStorage.removeItem(LS_NUM_RESERVADO); } catch { /* noop */ }
    } catch (e) {
      setResultado({ ok: false, msg: "No se pudo guardar: " + mensajeError(e, "error desconocido") });
    } finally {
      setGuardando(false);
    }
  }

  // ── Métricas del dashboard (mes seleccionado) ──────────────
  // Mapas para resolver cliente y domicilio sin consultas nuevas.
  const clientePorId = useMemo(() => {
    const m = {};
    clientes.forEach((c) => { m[c.id] = c; });
    return m;
  }, [clientes]);
  const domPorId = useMemo(() => {
    const m = {};
    todosDomicilios.forEach((d) => { m[d.id] = d; });
    return m;
  }, [todosDomicilios]);

  const infoPedido = (p) => {
    const c = clientePorId[p.cliente_id];
    const d = domPorId[p.domicilio_id];
    return {
      nombre: c?.nombre || "Cliente",
      comuna: d?.comuna || d?.direccion || "",
      ident: d?.identificador_dt || c?.codigo_cliente || "",
    };
  };

  const dash = (() => {
    const ped = pedidosMes;
    const est = (p) => String(p.estado_entrega || p.estado || "").toLowerCase();
    const hoy = new Date().toISOString().slice(0, 10);
    // Cobro: deuda real = entrega con Pago=No y aún no cobrado (en el período)
    const conDeuda = ped.filter((p) => {
      const e = p.numero_guia ? entregasMap[p.numero_guia] : null;
      return e && esPagoNo(e) && !p.cobro_cobrado;
    });
    return {
      ingresados: ped.length,
      enviados: ped.filter((p) => p.estado_sync === "enviado_dt").length,
      pendientes: ped.filter((p) => p.estado_sync !== "enviado_dt").length,
      entregados: ped.filter((p) => est(p).includes("entreg")).length,
      paraHoy: ped.filter((p) => (p.fecha_min_entrega || "").slice(0, 10) === hoy).length,
      monto: ped.reduce((s, p) => s + (Number(p.monto_total) || 0), 0),
      porCobrar: ped.filter((p) => p.por_cobrar).reduce((s, p) => s + (Number(p.monto_total) || 0), 0),
      tieneEstado: ped.some((p) => p.estado_entrega != null || p.estado != null),
      // Gestión de cobro
      deudaCount: conDeuda.length,
      deudaMonto: conDeuda.reduce((s, p) => s + (Number(p.monto_total) || 0), 0),
      cobrados: ped.filter((p) => p.cobro_cobrado).length,
      recuperados: ped.filter((p) => p.cobro_recuperado).length,
      // Compra Proveedor (Aguas Altas) y Rendición Efectivo
      compraProveedor: ped.reduce((s, p) => {
        const e = p.numero_guia ? entregasMap[p.numero_guia] : null;
        return s + (esCompraProveedor(e) ? montoCompraProveedor(e) : 0);
      }, 0),
      rendicionEfectivo: ped.reduce((s, p) => {
        const e = p.numero_guia ? entregasMap[p.numero_guia] : null;
        return s + (esRendicionEfectivo(e) ? montoRendicion(e) : 0);
      }, 0),
      efectivoRecaudado: ped.reduce((s, p) => {
        const e = p.numero_guia ? entregasMap[p.numero_guia] : null;
        return s + (esEfectivoRecaudado(e) ? montoEfectivoRecaudado(e) : 0);
      }, 0),
    };
  })();

  // Estado de cobro de un pedido (para badge en el listado).
  const cobroDePedido = (p) => {
    const e = p.numero_guia ? entregasMap[p.numero_guia] : null;
    if (!e || !esPagoNo(e)) return null;
    if (p.cobro_cobrado) return { label: "Cobrado", cls: "ok" };
    return { label: "Deuda", cls: "bad" };
  };

  // Resumen e índices de la ventana Cobranzas (histórico completo).
  const DIA_MS = 86400000;
  const montoCob = (o) => Number(o.pedido.monto_total) || montoEntrega(o.entrega) || 0;
  const abonadoCob = (o) => Number(o.pedido.cobro_abonado) || 0;
  // Saldo pendiente real de un pedido: monto − abonado (0 si ya está cobrado).
  const saldoCob = (o) => (o.pedido.cobro_cobrado ? 0 : Math.max(0, montoCob(o) - abonadoCob(o)));
  // Dinero efectivamente recaudado de un pedido (cobro total o suma de abonos).
  const recaudadoCob = (o) => (o.pedido.cobro_cobrado ? montoCob(o) : abonadoCob(o));
  const diasDesdeEntrega = (o) => {
    const g = o.entrega?.gestionado_en ? new Date(o.entrega.gestionado_en).getTime() : null;
    return g ? Math.floor((Date.now() - g) / DIA_MS) : null;
  };

  const cobResumen = useMemo(() => {
    const items = cobranzas || [];
    let generada = 0, cobrado = 0, pend = 0, pendCount = 0, venc = 0, vencCount = 0, recCount = 0;
    items.forEach((o) => {
      generada += montoCob(o);
      cobrado += recaudadoCob(o);
      const saldo = saldoCob(o);
      if (saldo > 0) {
        pend += saldo; pendCount++;
        const d = diasDesdeEntrega(o);
        if (d != null && d > 30) { venc += saldo; vencCount++; }
      }
      if (o.pedido.cobro_recuperado) recCount++;
    });
    return { generada, cobrado, pend, pendCount, venc, vencCount, recCount, total: items.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobranzas]);

  const cobGrupos = useMemo(() => {
    const items = (cobranzas || []).filter((x) => {
      if (filtroCob === "pendientes") return !x.pedido.cobro_cobrado;
      if (filtroCob === "gestionados") return !!x.pedido.cobro_cobrado;
      if (filtroCob === "vencidos") return !x.pedido.cobro_cobrado;
      return true;
    });
    const map = {};
    items.forEach((o) => {
      const cid = o.pedido.cliente_id || "—";
      if (!map[cid]) map[cid] = { clienteId: cid, orders: [] };
      map[cid].orders.push(o);
    });
    const q = buscarCob.trim().toLowerCase();
    return Object.values(map)
      .map((g) => {
        const deuda = g.orders.reduce((s, o) => s + saldoCob(o), 0);
        const diasMax = g.orders.filter((o) => saldoCob(o) > 0).reduce((mx, o) => { const d = diasDesdeEntrega(o); return d != null && d > mx ? d : mx; }, 0);
        return { ...g, deuda, count: g.orders.length, diasMax };
      })
      .filter((g) => {
        if (filtroCob === "vencidos" && !(g.diasMax > 30)) return false;
        if (!q) return true;
        const cli = clientePorId[g.clienteId];
        if ((cli?.nombre || "").toLowerCase().includes(q)) return true;
        if ((cli?.rut || "").toLowerCase().includes(q)) return true;
        return g.orders.some((o) => {
          const dom = domPorId[o.pedido.domicilio_id];
          return (
            (o.pedido.numero_guia || "").toLowerCase().includes(q) ||
            (dom?.comuna || "").toLowerCase().includes(q) ||
            (o.entrega?.contact_name || "").toLowerCase().includes(q)
          );
        });
      })
      .sort((a, b) => b.deuda - a.deuda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobranzas, filtroCob, buscarCob, clientePorId, domPorId]);

  const pedidosFiltrados = useMemo(() => {
    const q = buscarPedido.trim().toLowerCase();
    const hoyStr = new Date().toISOString().slice(0, 10);
    return pedidosMes.filter((p) => {
      if (filtroEstado === "enviados" && p.estado_sync !== "enviado_dt") return false;
      if (filtroEstado === "pendientes" && p.estado_sync === "enviado_dt") return false;
      if (filtroEstado === "hoy" && (p.fecha_min_entrega || "").slice(0, 10) !== hoyStr) return false;
      if (!q) return true;
      const i = infoPedido(p);
      return (
        (p.numero_guia || "").toLowerCase().includes(q) ||
        i.nombre.toLowerCase().includes(q) ||
        i.comuna.toLowerCase().includes(q) ||
        i.ident.toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidosMes, filtroEstado, buscarPedido, clientePorId, domPorId]);

  const periodoLabel = (() => {
    const [y, m] = periodo.split("-").map(Number);
    const s = new Date(y, m - 1, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();
  function cambiarPeriodo(delta) {
    const [y, m] = periodo.split("-").map(Number);
    setPeriodo(new Date(y, m - 1 + delta, 1).toISOString().slice(0, 7));
  }

  // ── Render ─────────────────────────────────────────────────
  // Pantalla de login (si hay credenciales de Supabase pero no hay sesión válida)
  if (credsListas && !authReady) {
    return (
      <div className="aq aq-login-wrap">
        <style>{css}</style>
        <div className="aq-card">Cargando…</div>
      </div>
    );
  }
  if (credsListas && (!session || !rol)) {
    return (
      <div className="aq aq-login-wrap">
        <style>{css}</style>
        <div className="aq-login">
          <img src="/logo-aquatrisq.png" className="aq-logo-big" alt="Aquatrisq" />
          <h1>Aquatrisq</h1>
          <p className="aq-login-sub">Gestión de pedidos</p>
          {session && !rol && (
            <div className="aq-result bad" style={{ marginBottom: 12 }}>
              Tu usuario no tiene un perfil asignado o está inactivo. Contacta al administrador.
            </div>
          )}
          <label className="aq-full">
            Email
            <input
              type="email"
              value={loginEmail}
              autoComplete="username"
              onChange={(e) => setLoginEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && iniciarSesion()}
            />
          </label>
          <label className="aq-full">
            Contraseña
            <input
              type="password"
              value={loginPass}
              autoComplete="current-password"
              onChange={(e) => setLoginPass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && iniciarSesion()}
            />
          </label>
          {loginError && <div className="aq-result bad">{loginError}</div>}
          <button className="aq-btn" disabled={logueando || !loginEmail || !loginPass} onClick={iniciarSesion}>
            {logueando ? "Entrando…" : "Entrar"}
          </button>
          {session && !rol && (
            <button className="aq-link" style={{ marginTop: 12 }} onClick={cerrarSesion}>Cerrar sesión</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="aq">
      <style>{css}</style>

      <header className="aq-header">
        <div className="aq-brand">
          <img src="/logo-aquatrisq.png" className="aq-logo" alt="Aquatrisq" />
          <div>
            <h1>Aquatrisq</h1>
            <p>Gestión de pedidos</p>
          </div>
        </div>
        {credsListas && rol && (
          <nav className="aq-nav">
            <button className={vista === "inicio" ? "on" : ""} onClick={() => setVista("inicio")}>Inicio</button>
            {rol !== "gerencial" && (
              <button className={vista === "nuevo" ? "on" : ""} onClick={() => setVista("nuevo")}>Nuevo pedido</button>
            )}
            {rol !== "gerencial" && rol !== "distribuidor" && (
              <button className={vista === "mantenedor" ? "on" : ""} onClick={() => setVista("mantenedor")}>{rol === "admin" ? "Mantenedores" : "Clientes"}</button>
            )}
            {rol !== "gerencial" && rol !== "distribuidor" && (
              <button className={vista === "cobranzas" ? "on" : ""} onClick={abrirCobranzas}>Cobranzas</button>
            )}
            {(rol === "admin" || rol === "operador") && (
              <button className={vista === "deudasprov" ? "on" : ""} onClick={() => setVista("deudasprov")}>Pagos proveedor</button>
            )}
            {(rol === "admin" || rol === "operador") && (
              <button className={vista === "cotizaciones" ? "on" : ""} onClick={() => { setVista("cotizaciones"); setCotizEdit(null); }}>Cotizaciones</button>
            )}
            {(rol === "admin" || rol === "operador") && (
              <button className={vista === "facturas" ? "on" : ""} onClick={() => setVista("facturas")}>
                Facturas
                {facturasPend && facturasPend.filter((f) => !f.numero_documento_emitido && !f.factura_no_requerida && !f.factura_diferida).length > 0 && (
                  <span className="aq-nav-alert">{facturasPend.filter((f) => !f.numero_documento_emitido && !f.factura_no_requerida && !f.factura_diferida).length}</span>
                )}
              </button>
            )}
            {(rol === "admin" || rol === "operador") && (
              <button className={vista === "bidones" ? "on" : ""} onClick={() => setVista("bidones")}>
                Bidones
                {bidonesPend && bidonesPend.filter((b) => !b.bidones_retirados_en).reduce((s, b) => s + b.cantidad, 0) > 0 && (
                  <span className="aq-nav-alert">{bidonesPend.filter((b) => !b.bidones_retirados_en).reduce((s, b) => s + b.cantidad, 0)}</span>
                )}
              </button>
            )}
            <span className="aq-user" title={rol}>
              {perfilNombre} · {rol}
              <button className="aq-logout" onClick={cerrarSesion} aria-label="Cerrar sesión">Salir</button>
            </span>
          </nav>
        )}
      </header>

      <main className="aq-main">
        {!credsListas && (
          <div className="aq-card aq-warn">
            Falta conectar la base de datos. Pega tu URL y anon key de Supabase en <code>src/config.js</code> o
            configúralas como variables <code>VITE_</code> en Vercel.
          </div>
        )}

        {credsListas && cargando && <div className="aq-card">Cargando catálogos…</div>}
        {errorCarga && <div className="aq-card aq-error">No se pudieron cargar los datos: {errorCarga}</div>}

        {/* ===================== INICIO DISTRIBUIDOR ===================== */}
        {credsListas && vista === "inicio" && rol === "distribuidor" && (
          <section className="aq-card">
            <h2>Hola, {distChofer || perfilNombre}</h2>
            <p className="aq-muted">
              Genera un nuevo correlativo con tus datos ({distIdentDt || "sin identificador"}).
              Úsalo como referencia para gestionar la entrega en DispatchTrack: al asignarlo allá,
              quedará bajo tus credenciales para cierre como <strong>Entregado/Compra</strong> o <strong>Entregado/Compra Proveedor</strong>.
            </p>
            <button className="aq-btn" onClick={() => setVista("nuevo")}>+ Nuevo correlativo</button>
          </section>
        )}

        {/* ===================== INICIO / DASHBOARD ===================== */}
        {credsListas && vista === "inicio" && rol !== "gerencial" && rol !== "distribuidor" && (
          <>
            <section className="aq-card aq-period">
              <button className="aq-per-nav" onClick={() => cambiarPeriodo(-1)} aria-label="Mes anterior">‹</button>
              <div className="aq-per-label">
                <span>Período</span>
                <strong>{periodoLabel}</strong>
              </div>
              <button
                className="aq-per-nav"
                onClick={() => cambiarPeriodo(1)}
                aria-label="Mes siguiente"
                disabled={periodo >= hoyPeriodo()}
              >›</button>
            </section>

            {errorDash && <div className="aq-card aq-error">No se pudo cargar el período: {errorDash}</div>}
            {cargandoDash ? (
              <div className="aq-card">Cargando período…</div>
            ) : (
              <>
                <div className="aq-kpis">
                  <button
                    className={"aq-kpi aq-kpi-btn" + (filtroEstado === "todos" ? " on" : "")}
                    onClick={() => setFiltroEstado("todos")}
                  >
                    <span>Ingresados</span><strong>{dash.ingresados}</strong>
                  </button>
                  <button
                    className={"aq-kpi aq-kpi-btn" + (filtroEstado === "enviados" ? " on" : "")}
                    onClick={() => setFiltroEstado("enviados")}
                  >
                    <span>Enviados a DT</span><strong>{dash.enviados}</strong>
                  </button>
                  <button
                    className={"aq-kpi aq-kpi-btn" + (filtroEstado === "pendientes" ? " on" : "")}
                    onClick={() => setFiltroEstado("pendientes")}
                  >
                    <span>Pendientes</span><strong>{dash.pendientes}</strong>
                  </button>
                  <button
                    className={"aq-kpi aq-kpi-btn" + (filtroEstado === "hoy" ? " on" : "")}
                    onClick={() => setFiltroEstado(filtroEstado === "hoy" ? "todos" : "hoy")}
                  >
                    <span>Para hoy</span><strong>{dash.paraHoy}</strong>
                  </button>
                </div>

                <div className="aq-money">
                  <div className="aq-money-card navy">
                    <span>Monto del mes</span>
                    <strong>{CLP(dash.monto)}</strong>
                  </div>
                  <button className="aq-money-card deuda" onClick={abrirCobranzas} title="Abrir gestión de cobro">
                    <span>Deuda por cobrar del mes</span>
                    <strong>{CLP(dash.deudaMonto)}</strong>
                    <em className="aq-money-sub">{dash.deudaCount} pedido(s) · cobrados {dash.cobrados} · recuperados {dash.recuperados} · histórico en Cobranzas</em>
                  </button>
                  <button
                    className={"aq-money-card proveedor" + ((cajaMes?.efectivo?.aRendir || 0) < 0 ? " neg" : "")}
                    onClick={() => setPopEfectivo(true)}
                    title="Ver desglose"
                  >
                    <span>Efectivo libre / a Rendir 🔎</span>
                    <strong>{CLP(cajaMes?.efectivo?.aRendir || 0)}</strong>
                    <em className="aq-money-sub">Recaudado {CLP(cajaMes?.efectivo?.recaudacion || 0)} − compras − prov. pagado − rendición</em>
                  </button>
                  <button
                    className="aq-money-card rendicion"
                    onClick={() => setPopProveedor(true)}
                    title="Ver desglose por proveedor"
                  >
                    <span>Pendiente pago proveedor 🔎</span>
                    <strong>{CLP(cajaMes?.provPendiente?.total || 0)}</strong>
                    <em className="aq-money-sub">{cajaMes?.provPendiente?.count || 0} factura(s) por pagar</em>
                  </button>
                  <button
                    className="aq-money-card efectivo"
                    onClick={() => setPopCosto(true)}
                    title="Ver detalle por día"
                  >
                    <span>Costo recargas del mes 🔎</span>
                    <strong>{CLP(cajaMes?.costo?.total || 0)}</strong>
                    <em className="aq-money-sub">Unidades Compra Proveedor (DT): 20L $600 · 12/10L $300</em>
                  </button>
                </div>

                {errorEvo && <div className="aq-card aq-error">No se pudo cargar la evolución: {errorEvo}</div>}
                {cargandoEvo && !evolucion ? (
                  <div className="aq-card">Cargando evolución…</div>
                ) : evolucion && (
                  <>
                    {/* Evolución mensual — solo administración (idéntico al panel gerencial, línea = Compras + Compra Proveedor) */}
                    {rol === "admin" && (
                      <section className="aq-card">
                        <h2>Evolución (últimos 6 meses)</h2>
                        {(() => {
                          const M = evolucion.meses;
                          const n = Math.max(1, M.length);
                          const W = 560, H = 220, padL = 10, padR = 10, padT = 24, padB = 42;
                          const plotW = W - padL - padR, plotH = H - padT - padB;
                          const band = plotW / n, barW = Math.min(46, band * 0.5);
                          const maxM = Math.max(1, ...M.map((m) => m.monto));
                          const maxC = Math.max(1, ...M.map((m) => m.compras));
                          const cx = (i) => padL + band * i + band / 2;
                          const yBar = (v) => padT + plotH - (v / maxM) * plotH;
                          const yLine = (v) => padT + plotH - (v / maxC) * plotH;
                          const corto = (v) => v >= 1000000
                            ? "$" + (v / 1e6).toFixed(1).replace(".", ",") + "M"
                            : v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + v;
                          const linea = M.map((m, i) => `${cx(i)},${yLine(m.compras)}`).join(" ");
                          return (
                            <div className="aq-evol">
                              <div className="aq-evol-leg">
                                <span className="aq-evol-leg-i"><span className="aq-evol-sw bar" /> Ingresos (barras)</span>
                                <span className="aq-evol-leg-i"><span className="aq-evol-sw line" /> Compras + Compra proveedor (línea)</span>
                              </div>
                              <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="aq-evol-svg" role="img"
                                aria-label="Evolución de ingresos (barras) y de compras más compra proveedor (línea) en los últimos 6 meses.">
                                <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} className="aq-evol-axis" />
                                {M.map((m, i) => (
                                  <g key={m.key}>
                                    <rect x={cx(i) - barW / 2} y={yBar(m.monto)} width={barW}
                                      height={Math.max(0, padT + plotH - yBar(m.monto))} rx="4" className="aq-evol-bar">
                                      <title>{m.label}: {CLP(m.monto)} · Compras {CLP(m.compras)}</title>
                                    </rect>
                                    <text x={cx(i)} y={yBar(m.monto) - 6} className="aq-evol-vbar">{m.monto ? corto(m.monto) : ""}</text>
                                    <text x={cx(i)} y={padT + plotH + 17} className="aq-evol-xlab">{m.label}</text>
                                    <text x={cx(i)} y={padT + plotH + 31} className="aq-evol-xsub">{CLP(m.compras)}</text>
                                  </g>
                                ))}
                                <polyline points={linea} className="aq-evol-pline" />
                                {M.map((m, i) => (
                                  <circle key={"p" + m.key} cx={cx(i)} cy={yLine(m.compras)} r="3.6" className="aq-evol-dot">
                                    <title>{m.label}: Compras + Compra proveedor {CLP(m.compras)}</title>
                                  </circle>
                                ))}
                              </svg>
                            </div>
                          );
                        })()}
                      </section>
                    )}

                    {/* Mejor mes como meta (idéntico al panel gerencial) */}
                    {(() => {
                      const todosM = evolucion.meses;
                      const mejor = todosM.reduce((mx, m) => m.monto > mx.monto ? m : mx, { monto: 0, label: "—" });
                      const actual = evolucion.mesActual;
                      const meta = mejor.monto;
                      const pct = meta > 0 ? Math.min(100, Math.round((actual.monto / meta) * 100)) : 0;
                      const superada = actual.monto >= meta && meta > 0;
                      return (
                        <section className="aq-card aq-meta-card">
                          <div className="aq-meta-head">
                            <div>
                              <h2>Meta del año</h2>
                              <p className="aq-muted" style={{ margin: "2px 0 0" }}>Mejor mes histórico como referencia: <strong>{mejor.label}</strong> · {CLP(meta)}</p>
                            </div>
                            <div className="aq-meta-badge" style={{ background: superada ? "#e7f6ee" : "#fff7e6", color: superada ? "#1a7a45" : "#8a6400", border: "1px solid " + (superada ? "#9bd5b4" : "#f0d8a0") }}>
                              {superada ? "🏆 Meta superada" : pct + "% de la meta"}
                            </div>
                          </div>
                          <div className="aq-meta-row">
                            <span className="aq-meta-label">Este mes</span>
                            <span className="aq-meta-val">{CLP(actual.monto)}</span>
                            <span className="aq-meta-label">Meta</span>
                            <span className="aq-meta-val">{CLP(meta)}</span>
                            <span className="aq-meta-label">Diferencia</span>
                            <span className="aq-meta-val" style={{ color: superada ? "#1a7a45" : "#b42318" }}>
                              {superada ? "+" : ""}{CLP(actual.monto - meta)}
                            </span>
                          </div>
                          <div className="aq-bullet">
                            <div className="aq-bullet-track">
                              <div className="aq-bullet-fill" style={{ width: pct + "%", background: superada ? "#1a9a52" : pct >= 75 ? "#00aeef" : pct >= 50 ? "#e0a400" : "#d92d20" }} />
                              <div className="aq-bullet-goal" title={"Meta: " + CLP(meta)} />
                            </div>
                            <div className="aq-bullet-labels">
                              <span>$0</span>
                              <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>{CLP(meta / 2)}</span>
                              <span>{CLP(meta)}</span>
                            </div>
                          </div>
                          <p className="aq-mini" style={{ marginTop: 6, color: "var(--muted)" }}>
                            La meta se actualiza automáticamente con el mes de mayor ingreso registrado. {superada ? "¡Nuevo récord este mes!" : `Faltan ${CLP(meta - actual.monto)} para superarla.`}
                          </p>
                        </section>
                      );
                    })()}
                  </>
                )}

                {(() => {
                  const factPend = (facturasPend || []).filter((f) => !f.numero_documento_emitido && !f.factura_no_requerida && !f.factura_diferida);
                  const bidPend = (bidonesPend || []).filter((b) => !b.bidones_retirados_en);
                  const bidTotal = bidPend.reduce((s, b) => s + b.cantidad, 0);
                  if (!factPend.length && !bidTotal) return null;
                  const factCrit = factPend.filter((f) => f.dias >= 5).length;
                  return (
                    <div className="aq-gestion-alerts">
                      {factPend.length > 0 && (
                        <button className="aq-alert-card bad" onClick={() => setVista("facturas")}>
                          <span>Facturas por emitir</span>
                          <strong>{factPend.length}</strong>
                          <em className="aq-money-sub">{factCrit > 0 ? `${factCrit} con 5+ días de atraso` : "Dentro de plazo"}</em>
                        </button>
                      )}
                      {bidTotal > 0 && (
                        <button className="aq-alert-card warn" onClick={() => setVista("bidones")}>
                          <span>Bidones pendientes de retiro</span>
                          <strong>{bidTotal}</strong>
                          <em className="aq-money-sub">En poder de {new Set(bidPend.map((b) => b.cliente_id)).size} cliente(s)</em>
                        </button>
                      )}
                    </div>
                  );
                })()}

                {rol === "operador" && (
                <section className="aq-card">
                  <div className="aq-row-head">
                    <h2>Pedidos del período</h2>
                    <button className="aq-btn-sec" onClick={() => setVista("nuevo")}>+ Nuevo pedido</button>
                  </div>

                  <input
                    className="aq-buscar-ped"
                    placeholder="Buscar por guía, cliente o comuna…"
                    value={buscarPedido}
                    onChange={(e) => setBuscarPedido(e.target.value)}
                  />

                  {pedidosFiltrados.length === 0 ? (
                    <p className="aq-muted">
                      {pedidosMes.length === 0
                        ? `Sin pedidos en ${periodoLabel}.`
                        : "Ningún pedido coincide con el filtro."}
                    </p>
                  ) : (
                    <div className="aq-tabla">
                      {pedidosFiltrados.slice(0, 80).map((p) => {
                        const i = infoPedido(p);
                        const cobro = cobroDePedido(p);
                        return (
                          <div className="aq-tr aq-tr-click" key={p.id} onClick={() => abrirPedidoModal(p)} title="Ver detalle de entrega">
                            <div className="aq-tr-main">
                              <strong>{i.nombre}</strong>
                              <span className="aq-tr-sub">
                                {p.numero_guia || "—"}{i.comuna ? " · " + i.comuna : ""}
                              </span>
                            </div>
                            <span className="aq-tr-fecha">
                              {p.fecha_min_entrega
                                ? new Date(p.fecha_min_entrega).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
                                : p.created_at
                                ? new Date(p.created_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
                                : ""}
                            </span>
                            <span className="aq-tr-monto">
                              {CLP(p.monto_total)}
                              {p.por_cobrar && <em className="aq-pc" onClick={(e) => { e.stopPropagation(); abrirPedidoModal(p); }} title="Ver formulario de entrega / cobro">PC</em>}
                            </span>
                            {cobro
                              ? <span className={"aq-badge " + cobro.cls}>{cobro.label}</span>
                              : <span className={"aq-badge " + (p.estado_sync === "enviado_dt" ? "ok" : "warn")}>{p.estado_sync === "enviado_dt" ? "En DT" : "Pend."}</span>}
                          </div>
                        );
                      })}
                      {pedidosFiltrados.length > 80 && (
                        <p className="aq-muted" style={{ marginTop: 10 }}>
                          Mostrando 80 de {pedidosFiltrados.length}. Usa el buscador para acotar.
                        </p>
                      )}
                    </div>
                  )}
                </section>
                )}

                {!dash.tieneEstado && (
                  <p className="aq-muted">
                    El estado “Entregado” se activará cuando conectemos el retorno de DispatchTrack.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {/* ===================== DASHBOARD GERENCIAL ===================== */}
        {credsListas && vista === "inicio" && rol === "gerencial" && (
          <>
            {errorGer && <div className="aq-card aq-error">No se pudo cargar el panel: {errorGer}</div>}
            {cargandoGer && !ger ? (
              <div className="aq-card">Cargando panel…</div>
            ) : ger ? (
              <>
                <div className="aq-kpis">
                  <div className="aq-kpi">
                    <span>Ingresos del mes</span><strong>{CLP(ger.mesActual.monto)}</strong>
                  </div>
                  <div className="aq-kpi">
                    <span>Pedidos del mes</span><strong>{ger.mesActual.count}</strong>
                  </div>
                  <div className="aq-kpi">
                    <span>Ticket promedio</span><strong>{CLP(ger.ticket)}</strong>
                  </div>
                  <div className={"aq-kpi" + (ger.venc30 && ger.venc30.monto > 0 ? " aq-kpi-venc" : "")}>
                    <span>Deuda +30 días</span><strong>{CLP(ger.venc30 ? ger.venc30.monto : 0)}</strong>
                  </div>
                </div>

                {/* Caja del mes: operaciones de efectivo del chofer */}
                <div className="aq-kpis aq-kpis-2">
                  <button
                    className={"aq-kpi aq-kpi-btn aq-kpi-cash" + ((ger.efectivo?.aRendir || 0) < 0 ? " neg" : "")}
                    onClick={() => setPopEfectivo(true)}
                    title="Ver desglose"
                  >
                    <span>Efectivo libre / a Rendir 🔎</span>
                    <strong>{CLP(ger.efectivo ? ger.efectivo.aRendir : 0)}</strong>
                    <em className="aq-kpi-sub">
                      Recaudado {CLP(ger.efectivo?.recaudacion || 0)} − compras − prov. pagado − rendición
                    </em>
                  </button>
                  <button
                    className={"aq-kpi aq-kpi-btn aq-kpi-prov" + ((ger.provPendiente?.total || 0) > 0 ? " on-warn" : "")}
                    onClick={() => setPopProveedor(true)}
                    title="Ver desglose por proveedor"
                  >
                    <span>Pendiente pago proveedor 🔎</span>
                    <strong>{CLP(ger.provPendiente ? ger.provPendiente.total : 0)}</strong>
                    <em className="aq-kpi-sub">{ger.provPendiente?.count || 0} factura(s) por pagar</em>
                  </button>
                </div>

                {/* Evolución mensual */}
                <section className="aq-card">
                  <h2>Evolución (últimos 6 meses)</h2>
                  {(() => {
                    const M = ger.meses;
                    const n = Math.max(1, M.length);
                    const W = 560, H = 220, padL = 10, padR = 10, padT = 24, padB = 42;
                    const plotW = W - padL - padR, plotH = H - padT - padB;
                    const band = plotW / n, barW = Math.min(46, band * 0.5);
                    const maxM = Math.max(1, ...M.map((m) => m.monto));
                    const maxC = Math.max(1, ...M.map((m) => m.count));
                    const cx = (i) => padL + band * i + band / 2;
                    const yBar = (v) => padT + plotH - (v / maxM) * plotH;
                    const yLine = (v) => padT + plotH - (v / maxC) * plotH;
                    const corto = (v) => v >= 1000000
                      ? "$" + (v / 1e6).toFixed(1).replace(".", ",") + "M"
                      : v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + v;
                    const linea = M.map((m, i) => `${cx(i)},${yLine(m.count)}`).join(" ");
                    return (
                      <div className="aq-evol">
                        <div className="aq-evol-leg">
                          <span className="aq-evol-leg-i"><span className="aq-evol-sw bar" /> Ingresos (barras)</span>
                          <span className="aq-evol-leg-i"><span className="aq-evol-sw line" /> Pedidos (línea)</span>
                        </div>
                        <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="aq-evol-svg" role="img"
                          aria-label="Evolución de ingresos (barras) y pedidos (línea) en los últimos 6 meses.">
                          <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} className="aq-evol-axis" />
                          {M.map((m, i) => (
                            <g key={m.key}>
                              <rect x={cx(i) - barW / 2} y={yBar(m.monto)} width={barW}
                                height={Math.max(0, padT + plotH - yBar(m.monto))} rx="4" className="aq-evol-bar">
                                <title>{m.label}: {CLP(m.monto)} · {m.count} ped.</title>
                              </rect>
                              <text x={cx(i)} y={yBar(m.monto) - 6} className="aq-evol-vbar">{m.monto ? corto(m.monto) : ""}</text>
                              <text x={cx(i)} y={padT + plotH + 17} className="aq-evol-xlab">{m.label}</text>
                              <text x={cx(i)} y={padT + plotH + 31} className="aq-evol-xsub">{m.count} ped.</text>
                            </g>
                          ))}
                          <polyline points={linea} className="aq-evol-pline" />
                          {M.map((m, i) => (
                            <circle key={"p" + m.key} cx={cx(i)} cy={yLine(m.count)} r="3.6" className="aq-evol-dot">
                              <title>{m.label}: {m.count} pedido(s)</title>
                            </circle>
                          ))}
                        </svg>
                      </div>
                    );
                  })()}
                </section>

                {/* Mejor mes como meta */}
                {(() => {
                  const todosM = ger.meses;
                  const mejor = todosM.reduce((mx, m) => m.monto > mx.monto ? m : mx, { monto: 0, label: "—" });
                  const actual = ger.mesActual;
                  const meta = mejor.monto;
                  const pct = meta > 0 ? Math.min(100, Math.round((actual.monto / meta) * 100)) : 0;
                  const superada = actual.monto >= meta && meta > 0;
                  return (
                    <section className="aq-card aq-meta-card">
                      <div className="aq-meta-head">
                        <div>
                          <h2>Meta del año</h2>
                          <p className="aq-muted" style={{ margin: "2px 0 0" }}>Mejor mes histórico como referencia: <strong>{mejor.label}</strong> · {CLP(meta)}</p>
                        </div>
                        <div className="aq-meta-badge" style={{ background: superada ? "#e7f6ee" : "#fff7e6", color: superada ? "#1a7a45" : "#8a6400", border: "1px solid " + (superada ? "#9bd5b4" : "#f0d8a0") }}>
                          {superada ? "🏆 Meta superada" : pct + "% de la meta"}
                        </div>
                      </div>
                      <div className="aq-meta-row">
                        <span className="aq-meta-label">Este mes</span>
                        <span className="aq-meta-val">{CLP(actual.monto)}</span>
                        <span className="aq-meta-label">Meta</span>
                        <span className="aq-meta-val">{CLP(meta)}</span>
                        <span className="aq-meta-label">Diferencia</span>
                        <span className="aq-meta-val" style={{ color: superada ? "#1a7a45" : "#b42318" }}>
                          {superada ? "+" : ""}{CLP(actual.monto - meta)}
                        </span>
                      </div>
                      {/* Bullet chart */}
                      <div className="aq-bullet">
                        <div className="aq-bullet-track">
                          <div className="aq-bullet-fill" style={{ width: pct + "%", background: superada ? "#1a9a52" : pct >= 75 ? "#00aeef" : pct >= 50 ? "#e0a400" : "#d92d20" }} />
                          <div className="aq-bullet-goal" title={"Meta: " + CLP(meta)} />
                        </div>
                        <div className="aq-bullet-labels">
                          <span>$0</span>
                          <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>{CLP(meta / 2)}</span>
                          <span>{CLP(meta)}</span>
                        </div>
                      </div>
                      <p className="aq-mini" style={{ marginTop: 6, color: "var(--muted)" }}>
                        La meta se actualiza automáticamente con el mes de mayor ingreso registrado. {superada ? "¡Nuevo récord este mes!" : `Faltan ${CLP(meta - actual.monto)} para superarla.`}
                      </p>
                    </section>
                  );
                })()}

                <div className="aq-grid2">
                  {/* Mix de productos */}
                  <section className="aq-card">
                    <div className="aq-card-head">
                      <h2>Mix de productos</h2>
                      <div className="aq-toggle">
                        <button className={mixVista === "torta" ? "on" : ""} onClick={() => setMixVista("torta")}>Torta</button>
                        <button className={mixVista === "barras" ? "on" : ""} onClick={() => setMixVista("barras")}>Barras</button>
                      </div>
                    </div>
                    {ger.mix.length === 0 ? (
                      <p className="aq-muted">Sin ventas en el período.</p>
                    ) : mixVista === "barras" ? (() => {
                      const maxC = Math.max(1, ...ger.mix.map((p) => p.cantidad));
                      return (
                        <div className="aq-hbars">
                          {ger.mix.map((p) => (
                            <div className="aq-hbar" key={p.nombre}>
                              <div className="aq-hbar-head">
                                <span className="aq-hbar-name">{p.nombre}</span>
                                <span className="aq-hbar-num">{p.cantidad} un · {CLP(p.valor)}</span>
                              </div>
                              <div className="aq-hbar-track">
                                <div className="aq-hbar-fill" style={{ width: Math.round((p.cantidad / maxC) * 100) + "%" }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })() : (() => {
                      const COLORS = ["#1f3b73", "#0fae8e", "#378add", "#ef9f27", "#7f77dd", "#d85a30", "#888780"];
                      const total = ger.mix.reduce((s, p) => s + p.cantidad, 0) || 1;
                      const r = 54, C = 2 * Math.PI * r;
                      let acc = 0;
                      const segs = ger.mix.map((p, i) => {
                        const frac = p.cantidad / total;
                        const len = frac * C;
                        const seg = { ...p, color: COLORS[i % COLORS.length], len, off: -acc, pct: Math.round(frac * 100) };
                        acc += len;
                        return seg;
                      });
                      return (
                        <div className="aq-torta">
                          <div className="aq-torta-svg">
                            <svg viewBox="0 0 140 140" width="140" height="140" role="img"
                              aria-label="Distribución del mix de productos por unidades.">
                              <circle cx="70" cy="70" r={r} fill="none" stroke="var(--line)" strokeWidth="24" />
                              {segs.map((s) => (
                                <circle key={s.nombre} cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="24"
                                  strokeDasharray={`${s.len.toFixed(2)} ${(C - s.len).toFixed(2)}`}
                                  strokeDashoffset={s.off.toFixed(2)} transform="rotate(-90 70 70)">
                                  <title>{s.nombre}: {s.cantidad} un ({s.pct}%)</title>
                                </circle>
                              ))}
                            </svg>
                            <div className="aq-torta-centro">
                              <strong>{total}</strong>
                              <span>unidades</span>
                            </div>
                          </div>
                          <div className="aq-torta-leg">
                            {segs.map((s) => (
                              <div className="aq-torta-leg-i" key={s.nombre}>
                                <span className="aq-torta-pt" style={{ background: s.color }} />
                                <span className="aq-torta-nom">{s.nombre}</span>
                                <span className="aq-torta-pct">{s.pct}%</span>
                                <span className="aq-torta-det">{s.cantidad} un · {CLP(s.valor)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </section>

                  {/* Pedidos por comuna (mapa RM) */}
                  <section className="aq-card">
                    <h2>Pedidos por comuna</h2>
                    {ger.comunas.length === 0 ? (
                      <p className="aq-muted">Sin pedidos en el período.</p>
                    ) : (
                      <>
                        <MapaComunasRM comunas={ger.comunas} />
                        <div className="aq-comuna-list">
                          {ger.comunas.slice(0, 10).map((c) => (
                            <span className="aq-comuna-chip" key={c.comuna}>
                              {c.comuna} <strong>{c.count}</strong>
                            </span>
                          ))}
                        </div>
                        {(() => {
                          const sinUbic = ger.comunas.filter((c) => !COORDS_POR_CLAVE[claveComuna(c.comuna)]);
                          return sinUbic.length ? (
                            <p className="aq-muted" style={{ marginTop: 8 }}>
                              Sin ubicación en el mapa: {sinUbic.map((c) => `${c.comuna} (${c.count})`).join(", ")}
                            </p>
                          ) : null;
                        })()}
                      </>
                    )}
                  </section>
                </div>

                <p className="aq-muted">
                  Datos de los últimos 6 meses. Cumplimiento de entrega y cobranza por antigüedad se sumarán al conectar el retorno de DispatchTrack.
                </p>

              </>
            ) : (
              <div className="aq-card aq-muted">Sin datos para mostrar todavía.</div>
            )}
          </>
        )}

                {/* ── Pop-up: Efectivo libre / a Rendir ── */}
                {popEfectivo && cajaView?.efectivo && (
                  <div className="aq-modal-ov" onClick={() => setPopEfectivo(false)}>
                    <div className="aq-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="aq-modal-head">
                        <div>
                          <strong>Efectivo libre / a Rendir</strong>
                          <span className="aq-muted">Saldo acumulado a la fecha · incluye meses anteriores no resueltos</span>
                        </div>
                        <button className="aq-link" onClick={() => setPopEfectivo(false)}>Cerrar ✕</button>
                      </div>

                      <div style={{ margin: "0 0 12px" }}>
                        <button
                          className="aq-btn-sec"
                          onClick={() => descargarResumenEjecutivo(cajaView).catch(() => alert("No se pudo generar el Excel. Reintenta con conexión."))}
                        >
                          ⬇ Descargar resumen ejecutivo (Excel · una hoja por chofer)
                        </button>
                      </div>

                      <div className="aq-desglose">
                        <div className="aq-desglose-row">
                          <span>Recaudación de efectivo</span>
                          <strong className="pos">{CLP(cajaView.efectivo.recaudacion)}</strong>
                        </div>
                        <div className="aq-desglose-row">
                          <span>(−) Compras (Tipo ≠ Rendición Efectivo)</span>
                          <strong className="neg">−{CLP(cajaView.efectivo.comprasNoRend)}</strong>
                        </div>
                        <div className="aq-desglose-row">
                          <span>(−) Compra Proveedor pagada</span>
                          <strong className="neg">−{CLP(cajaView.efectivo.compraProvPagado)}</strong>
                        </div>
                        <div className="aq-desglose-row">
                          <span>(−) Rendición de efectivo entregada</span>
                          <strong className="neg">−{CLP(cajaView.efectivo.rendicion)}</strong>
                        </div>
                        <div className="aq-desglose-row total">
                          <span>= Efectivo a Rendir</span>
                          <strong>{CLP(cajaView.efectivo.aRendir)}</strong>
                        </div>
                      </div>

                      {cajaView.efectivo.choferes && cajaView.efectivo.choferes.length > 0 && (
                        <div className="aq-modal-edit">
                          <strong>A rendir por chofer</strong>
                          {cajaView.efectivo.choferes.map((c, i) => (
                            <div className="aq-chofer-box" key={"ch" + i}>
                              <div className="aq-det-line aq-chofer-cab">
                                <span>👤 {c.chofer}</span>
                                <span className={c.aRendir < 0 ? "neg" : ""}>{CLP(c.aRendir)}</span>
                              </div>
                              <div className="aq-chofer-detalle">
                                Recaudado {CLP(c.recaudacion)} − compras {CLP(c.comprasNoRend)} − prov. pagado {CLP(c.compraProvPagado)} − rendición {CLP(c.rendicion)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {cajaView.efectivo.recaudaciones && cajaView.efectivo.recaudaciones.length > 0 && (
                        <div className="aq-modal-edit">
                          <strong>Recaudación de efectivo</strong>
                          {cajaView.efectivo.recaudaciones.map((c, i) => (
                            <div className="aq-det-line" key={"rec" + i}>
                              <span>{c.guide ? "Guía " + c.guide : "Recaudación"}<em className="aq-det-chofer">{c.chofer}</em></span>
                              <span>{CLP(c.monto)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {cajaView.efectivo.compras.length > 0 && (
                        <div className="aq-modal-edit">
                          <strong>Compras (≠ Rendición Efectivo)</strong>
                          {cajaView.efectivo.compras.map((c, i) => (
                            <div className="aq-det-line" key={"c" + i}>
                              <span>{c.tipo}{c.guide ? " · guía " + c.guide : ""}<em className="aq-det-chofer">{c.chofer}</em></span>
                              <span>{CLP(c.monto)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {cajaView.efectivo.compraProvPagadoDet.length > 0 && (
                        <div className="aq-modal-edit">
                          <strong>Compra Proveedor pagada</strong>
                          {cajaView.efectivo.compraProvPagadoDet.map((c, i) => (
                            <div className="aq-det-line" key={"p" + i}>
                              <span>{c.proveedor}{c.guide ? " · guía " + c.guide : ""}<em className="aq-det-chofer">{c.chofer}</em></span>
                              <span>{CLP(c.monto)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {cajaView.efectivo.rendiciones.length > 0 && (
                        <div className="aq-modal-edit">
                          <strong>Rendiciones de efectivo</strong>
                          {cajaView.efectivo.rendiciones.map((c, i) => (
                            <div className="aq-det-line" key={"r" + i}>
                              <span>{c.guide ? "Guía " + c.guide : "Rendición"}<em className="aq-det-chofer">{c.chofer}</em></span>
                              <span>{CLP(c.monto)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Pop-up: Pendiente de pago a proveedor ── */}
                {popProveedor && cajaView?.provPendiente && (
                  <div className="aq-modal-ov" onClick={() => setPopProveedor(false)}>
                    <div className="aq-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="aq-modal-head">
                        <div>
                          <strong>Pendiente de pago a proveedor</strong>
                          <span className="aq-muted">Facturas con Estado = Pendiente · saldo acumulado (todos los meses)</span>
                        </div>
                        <button className="aq-link" onClick={() => setPopProveedor(false)}>Cerrar ✕</button>
                      </div>

                      <div className="aq-desglose">
                        <div className="aq-desglose-row total">
                          <span>Total por pagar</span>
                          <strong>{CLP(cajaView.provPendiente.total)}</strong>
                        </div>
                      </div>

                      {cajaView.provResumen && (
                        <div className="aq-desglose" style={{ marginTop: 8 }}>
                          <div className="aq-desglose-row">
                            <span>Generado (acumulado)</span>
                            <strong>{CLP(cajaView.provResumen.generado)}</strong>
                          </div>
                          <div className="aq-desglose-row">
                            <span>Pagado</span>
                            <strong className="pos">{CLP(cajaView.provResumen.pagado)}</strong>
                          </div>
                          <div className="aq-desglose-row total">
                            <span>Pendiente</span>
                            <strong className="neg">{CLP(cajaView.provResumen.pendiente)}</strong>
                          </div>
                        </div>
                      )}

                      {cajaView.provPendiente.proveedores.length === 0 ? (
                        <p className="aq-muted">Sin facturas pendientes.</p>
                      ) : (
                        <div className="aq-modal-edit">
                          <strong>Desglose por proveedor</strong>
                          {cajaView.provPendiente.proveedores.map((p, i) => (
                            <div className="aq-prov-grupo" key={"pp" + i}>
                              <div className="aq-det-line aq-prov-cab">
                                <span>{p.proveedor} · {p.count} fact.<em className="aq-det-chofer">{p.choferes.join(", ")}</em></span>
                                <span>{CLP(p.monto)}</span>
                              </div>
                              {p.facturas.map((f, j) => (
                                <div className="aq-det-line aq-prov-fact" key={"f" + i + "_" + j}>
                                  <span>{f.guide ? "Guía " + f.guide : "Factura"}<em className="aq-det-chofer">{f.chofer}</em></span>
                                  <span>{CLP(f.monto)}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

        {/* ── Pop-up: Costo de recargas del mes (detalle por día contraíble) ── */}
        {popCosto && (
          <div className="aq-modal-ov" onClick={() => setPopCosto(false)}>
            <div className="aq-modal" onClick={(e) => e.stopPropagation()}>
              <div className="aq-modal-head">
                <div>
                  <strong>Costo recargas del mes</strong>
                  <span className="aq-muted">Unidades de Compra Proveedor (DispatchTrack) · 20L $600 · 12/10L $300</span>
                </div>
                <button className="aq-link" onClick={() => setPopCosto(false)}>Cerrar ✕</button>
              </div>

              <div className="aq-desglose">
                <div className="aq-desglose-row total">
                  <span>Costo total</span>
                  <strong>{CLP(cajaMes?.costo?.total || 0)}</strong>
                </div>
              </div>

              {cajaMes?.costo && (
                <div className="aq-modal-edit">
                  <strong>Por formato</strong>
                  <div className="aq-det-line">
                    <span>20 lts<em className="aq-det-chofer">{cajaMes.costo.u20} u · $600 c/u</em></span>
                    <span>{CLP(cajaMes.costo.u20 * 600)}</span>
                  </div>
                  <div className="aq-det-line">
                    <span>12 lts<em className="aq-det-chofer">{cajaMes.costo.u12} u · $300 c/u</em></span>
                    <span>{CLP(cajaMes.costo.u12 * 300)}</span>
                  </div>
                  <div className="aq-det-line">
                    <span>10 lts<em className="aq-det-chofer">{cajaMes.costo.u10} u · $300 c/u</em></span>
                    <span>{CLP(cajaMes.costo.u10 * 300)}</span>
                  </div>
                </div>
              )}

              {cajaMes?.costo && cajaMes.costo.porDia.length > 0 ? (
                <div className="aq-modal-edit">
                  <strong>Detalle por día</strong>
                  {cajaMes.costo.porDia.map((d, i) => (
                    <details key={"cd" + i}>
                      <summary className="aq-det-line aq-prov-cab" style={{ cursor: "pointer", listStyle: "revert" }}>
                        <span>{d.dia}<em className="aq-det-chofer">{d.u20}×20L · {d.u12}×12L · {d.u10}×10L</em></span>
                        <span>{CLP(d.total)}</span>
                      </summary>
                      {d.items.map((it, j) => (
                        <div className="aq-det-line aq-prov-fact" key={"cdi" + i + "_" + j}>
                          <span>{it.guide ? "Guía " + it.guide : "Registro"}<em className="aq-det-chofer">{it.proveedor} · {it.u20}×20L {it.u12}×12L {it.u10}×10L</em></span>
                          <span>{CLP(it.costo)}</span>
                        </div>
                      ))}
                    </details>
                  ))}
                </div>
              ) : (
                <p className="aq-muted">Sin unidades de Compra Proveedor en el período.</p>
              )}
            </div>
          </div>
        )}

        {/* ===================== PAGOS A PROVEEDOR (admin/operador) ===================== */}
        {credsListas && vista === "deudasprov" && (rol === "admin" || rol === "operador") && (
          <section className="aq-card">
            <div className="aq-modal-head" style={{ marginBottom: 8 }}>
              <div>
                <h2 style={{ margin: 0 }}>Pagos a proveedor</h2>
                <span className="aq-muted">Compras a proveedor pendientes (últimos 12 meses) · marca cada una como pagada con su respaldo bancario.</span>
              </div>
              <button className="aq-btn-sec" onClick={cargarDeudasProv} disabled={cargandoDeudas}>↻ Actualizar</button>
            </div>

            {errorDeudas && <div className="aq-error" style={{ marginBottom: 8 }}>{errorDeudas}</div>}
            {cargandoDeudas && <p className="aq-muted">Cargando deudas…</p>}
            {!cargandoDeudas && deudasProv && deudasProv.length === 0 && (
              <p className="aq-muted">No hay compras a proveedor registradas.</p>
            )}

            {!cargandoDeudas && deudasProv && deudasProv.length > 0 && (() => {
              const totGen = deudasProv.reduce((s, d) => s + d.monto, 0);
              const totSaldo = deudasProv.filter((d) => !d.pagado).reduce((s, d) => s + (d.saldo ?? d.monto), 0);
              const totPagado = totGen - totSaldo; // pagos completos + abonos parciales

              const grupos = {};
              deudasProv.forEach((d) => {
                const key = d.proveedor || "Proveedor sin nombre";
                if (!grupos[key]) grupos[key] = { proveedor: key, items: [] };
                grupos[key].items.push(d);
              });
              const listaProv = Object.values(grupos).map((g) => {
                const pendientes = g.items.filter((d) => !d.pagado);
                const pagadas = g.items.filter((d) => d.pagado);
                const gen = g.items.reduce((s, d) => s + d.monto, 0);
                const pend = pendientes.reduce((s, d) => s + (d.saldo ?? d.monto), 0);
                const pag = gen - pend;
                const pct = gen > 0 ? Math.round((pag / gen) * 100) : 0;
                return { proveedor: g.proveedor, pendientes, pagadas, gen, pend, pag, pct };
              });
              listaProv.sort((a, b) => b.pend - a.pend || b.gen - a.gen);

              return (
                <>
                  <div className="aq-desglose" style={{ marginBottom: 16 }}>
                    <div className="aq-desglose-row"><span>Generado (12 meses)</span><strong>{CLP(totGen)}</strong></div>
                    <div className="aq-desglose-row"><span>Pagado / abonado</span><strong className="pos">{CLP(totPagado)}</strong></div>
                    <div className="aq-desglose-row total"><span>Saldo pendiente</span><strong className="neg">{CLP(totSaldo)}</strong></div>
                  </div>

                  {listaProv.map((g) => {
                    const claveG = "prov-" + g.proveedor;
                    const abierto = !!grupoAbierto[claveG];
                    const seleccionadas = g.pendientes.filter((d) => seleccionPago[d.numero_guia]);
                    const totalSel = seleccionadas.reduce((s, d) => s + (d.saldo ?? d.monto), 0);
                    const todasMarcadas = g.pendientes.length > 0 && g.pendientes.every((d) => seleccionPago[d.numero_guia]);
                    const rDona = 26, cDona = 2 * Math.PI * rDona;
                    const largoPago = (g.pct / 100) * cDona;
                    return (
                      <div className="aq-prov-tarjeta" key={g.proveedor}>
                        <div className="aq-prov-tarjeta-head" onClick={() => setGrupoAbierto((prev) => ({ ...prev, [claveG]: !prev[claveG] }))}>
                          <div className="aq-prov-dona">
                            <svg viewBox="0 0 64 64" width="52" height="52" role="img" aria-label={`${g.proveedor}: ${g.pct}% pagado`}>
                              <circle cx="32" cy="32" r={rDona} fill="none" stroke="var(--bad)" strokeWidth="10" />
                              <circle cx="32" cy="32" r={rDona} fill="none" stroke="var(--ok)" strokeWidth="10"
                                strokeDasharray={`${largoPago.toFixed(2)} ${(cDona - largoPago).toFixed(2)}`}
                                transform="rotate(-90 32 32)">
                                <title>{g.proveedor}: pagado {CLP(g.pag)} · pendiente {CLP(g.pend)}</title>
                              </circle>
                            </svg>
                            <span className="aq-prov-dona-pct">{g.pct}%</span>
                          </div>
                          <div className="aq-prov-tarjeta-info">
                            <strong>{g.proveedor}</strong>
                            <span className="aq-muted">
                              {g.pendientes.length} pendiente(s) · {g.pagadas.length} pagada(s) · {CLP(g.gen)} generado
                            </span>
                          </div>
                          <div className="aq-prov-tarjeta-nums">
                            <span className="aq-prov-num pos">{CLP(g.pag)}</span>
                            <span className="aq-prov-num neg">{CLP(g.pend)}</span>
                            <span className="aq-muted" style={{ marginLeft: 4 }}>{abierto ? "▲" : "▼"}</span>
                          </div>
                        </div>

                        {abierto && (
                          <div className="aq-prov-detalle">
                            {g.pendientes.length > 0 && <strong>Pendientes</strong>}
                            {rol === "admin" && g.pendientes.length > 0 && (
                              <div className="aq-fact-acciones" style={{ margin: "8px 0" }}>
                                <label className="aq-check-inline" style={{ marginTop: 0 }}>
                                  <input
                                    type="checkbox"
                                    checked={todasMarcadas}
                                    onChange={(e) => {
                                      const on = e.target.checked;
                                      setSeleccionPago((prev) => {
                                        const n = { ...prev };
                                        g.pendientes.forEach((d) => { n[d.numero_guia] = on; });
                                        return n;
                                      });
                                    }}
                                  />
                                  Seleccionar todas ({g.pendientes.length})
                                </label>
                                {seleccionadas.length > 0 && (
                                  <button
                                    className="aq-btn-sec"
                                    disabled={guardandoPagoMasivo}
                                    onClick={() => marcarPagadasMasivo(seleccionadas)}
                                  >
                                    {guardandoPagoMasivo ? "Guardando…" : `Marcar ${seleccionadas.length} pagadas (${CLP(totalSel)}) sin respaldo`}
                                  </button>
                                )}
                              </div>
                            )}
                            {g.pendientes.map((d, i) => {
                              const ab = Number(d.abonado) || 0;
                              const saldo = d.saldo ?? d.monto;
                              return (
                                <div className="aq-det-line aq-prov-cab" key={"pend" + i} style={{ alignItems: "center", gap: 8 }}>
                                  {rol === "admin" && (
                                    <input
                                      type="checkbox"
                                      checked={!!seleccionPago[d.numero_guia]}
                                      onChange={(e) => setSeleccionPago((prev) => ({ ...prev, [d.numero_guia]: e.target.checked }))}
                                      style={{ width: "auto", flex: "0 0 auto", padding: 0 }}
                                    />
                                  )}
                                  <span style={{ flex: 1 }}>
                                    Guía {d.numero_guia}<em className="aq-det-chofer">{d.mes} · {d.chofer}{ab > 0 ? ` · Abonado ${CLP(ab)} · Saldo ${CLP(saldo)}` : ""}</em>
                                  </span>
                                  <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                    {CLP(d.monto)}
                                    <button className="aq-btn-sec" onClick={() => abrirAbono("proveedor", { numero_guia: d.numero_guia, mes: d.mes, proveedor: d.proveedor, chofer: d.chofer, monto: d.monto, abonado: ab, saldo, titulo: d.proveedor })}>Abonar</button>
                                    <button className="aq-btn-sec" onClick={() => { setPagoModal(d); setPagoFoto(null); setErrorPago(""); }}>Marcar pagado</button>
                                  </span>
                                </div>
                              );
                            })}

                            {g.pagadas.length > 0 && <strong style={{ display: "block", marginTop: 14 }}>Pagadas</strong>}
                            {g.pagadas.map((d, i) => (
                              <div className="aq-det-line aq-prov-fact" key={"pag" + i}>
                                <span>Guía {d.numero_guia}
                                  <em className="aq-det-chofer">
                                    {d.mes} · {d.origenPago === "app"
                                      ? `Pagado por ${d.pagado_por || "—"}${d.fecha_pago ? " · " + new Date(d.fecha_pago).toLocaleDateString("es-CL") : ""}`
                                      : "Pagado (DispatchTrack)"}
                                  </em>
                                </span>
                                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                  {CLP(d.monto)}
                                  {d.respaldo_path && (
                                    <button className="aq-link" onClick={() => verRespaldo(d.respaldo_path)}>Ver respaldo</button>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </section>
        )}

        {/* ===================== FACTURAS POR EMITIR (admin/operador) ===================== */}
        {credsListas && vista === "facturas" && (rol === "admin" || rol === "operador") && (
          <section className="aq-card">
            <div className="aq-modal-head" style={{ marginBottom: 8 }}>
              <div>
                <h2 style={{ margin: 0 }}>Facturas por emitir</h2>
                <span className="aq-muted">Agrupado por cliente · pedidos cerrados subestado Venta con Tipo de Documento = Factura (últimos 6 meses).</span>
              </div>
              <button className="aq-btn-sec" onClick={cargarFacturasPend} disabled={cargandoFact}>↻ Actualizar</button>
            </div>

            {errorFact && <div className="aq-error" style={{ marginBottom: 8 }}>{errorFact}</div>}
            {cargandoFact && <p className="aq-muted">Cargando facturas…</p>}
            {!cargandoFact && facturasPend && facturasPend.length === 0 && (
              <p className="aq-muted">No hay pedidos con Factura pendiente en el período.</p>
            )}

            {!cargandoFact && facturasPend && facturasPend.length > 0 && (() => {
              const grupos = {};
              facturasPend.forEach((f) => {
                const cid = f.cliente_id || "sin-cliente";
                if (!grupos[cid]) grupos[cid] = { cliente_id: f.cliente_id, guias: [] };
                grupos[cid].guias.push(f);
              });
              const lista = Object.values(grupos).map((g) => {
                const cli = clientePorId[g.cliente_id];
                const pend = g.guias.filter((f) => !f.numero_documento_emitido && !f.factura_no_requerida && !f.factura_diferida);
                const dif = g.guias.filter((f) => !f.numero_documento_emitido && !f.factura_no_requerida && f.factura_diferida);
                const noReq = g.guias.filter((f) => f.factura_no_requerida);
                const emit = g.guias.filter((f) => f.numero_documento_emitido);
                const maxDias = pend.length ? Math.max(...pend.map((f) => f.dias)) : 0;
                const totalPend = [...pend, ...dif].reduce((s, f) => s + f.monto, 0);
                const rut = g.guias.find((f) => f.rutFactura)?.rutFactura || cli?.rut || "";
                return { cliente_id: g.cliente_id, nombre: cli?.nombre || "Cliente", rut, pend, dif, noReq, emit, maxDias, totalPend };
              });
              lista.sort((a, b) => (b.pend.length > 0) - (a.pend.length > 0) || b.maxDias - a.maxDias);
              const conPendientes = lista.filter((g) => g.pend.length || g.dif.length);
              const soloResueltos = lista.filter((g) => !g.pend.length && !g.dif.length && (g.emit.length || g.noReq.length));

              if (!conPendientes.length && !soloResueltos.length) {
                return <p className="aq-muted">No hay pedidos con Factura pendiente en el período.</p>;
              }
              return (
                <>
                  {conPendientes.map((g) => {
                    const claveG = "fact-" + (g.cliente_id || "sc");
                    const abierto = !!grupoAbierto[claveG];
                    const guiasPend = g.pend.map((f) => f.numero_guia);
                    const guiasAccion = [...guiasPend, ...g.dif.map((f) => f.numero_guia)];
                    const clave = guiasAccion.join(",");
                    const cls = g.maxDias >= 5 ? "bad" : g.maxDias >= 2 ? "warn" : "ok";
                    return (
                      <div className="aq-fact-grupo" key={g.cliente_id || "sc"}>
                        <div className="aq-det-line aq-prov-cab aq-fact-head" onClick={() => setGrupoAbierto((prev) => ({ ...prev, [claveG]: !prev[claveG] }))}>
                          <span>
                            {g.nombre}{g.rut ? " · " + g.rut : ""}
                            <em className="aq-det-chofer">
                              {g.pend.length + g.dif.length} pedido(s){g.dif.length ? ` · ${g.dif.length} a cierre de mes` : ""} · {CLP(g.totalPend)}
                            </em>
                          </span>
                          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {g.pend.length > 0 && <span className={"aq-badge " + cls}>{g.maxDias} día(s)</span>}
                            <span className="aq-muted">{abierto ? "▲" : "▼"}</span>
                          </span>
                        </div>

                        {abierto && (
                          <div className="aq-fact-detalle">
                            {[...g.pend, ...g.dif].map((f) => (
                              <div className="aq-det-line aq-prov-fact" key={f.numero_guia}>
                                <span>
                                  Guía {f.numero_guia}{f.factura_diferida ? " · A cierre de mes" : ""}
                                  <em className="aq-det-chofer">{f.dias} día(s){f.numeroRef ? ` · Ref. chofer: ${f.numeroRef}` : ""}</em>
                                </span>
                                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                  {CLP(f.monto)}
                                  {f.factura_diferida && (
                                    <button className="aq-link" onClick={() => deshacerFacturaDiferida(f.numero_guia)}>Deshacer diferido</button>
                                  )}
                                </span>
                              </div>
                            ))}

                            <div className="aq-fact-acciones">
                              <input
                                type="text"
                                placeholder="N° documento"
                                value={facturaInputs[clave] ?? ""}
                                onChange={(e) => setFacturaInputs((prev) => ({ ...prev, [clave]: e.target.value }))}
                                style={{ width: 130 }}
                              />
                              <input
                                type="file"
                                accept="application/pdf"
                                title="PDF del documento emitido (opcional)"
                                onChange={(e) => setFacturaArchivos((prev) => ({ ...prev, [clave]: e.target.files?.[0] || null }))}
                              />
                              <button
                                className="aq-btn-sec"
                                disabled={guardandoFacturaGuia === clave || !(facturaInputs[clave] || "").trim()}
                                onClick={() => guardarDocumentoEmitidoGrupo(guiasAccion, facturaInputs[clave], facturaArchivos[clave])}
                              >
                                {guardandoFacturaGuia === clave ? "Guardando…" : "Guardar"}
                              </button>
                              {guiasPend.length > 0 && (
                                <button className="aq-link" onClick={() => marcarFacturaDiferidaGrupo(guiasPend)}>Emitir al cierre de mes</button>
                              )}
                              <button className="aq-link" onClick={() => marcarFacturaNoRequeridaGrupo(guiasAccion)}>No requiere factura</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {soloResueltos.length > 0 && <strong style={{ display: "block", marginTop: 14 }}>Resueltas ({soloResueltos.length})</strong>}
                  {soloResueltos.map((g) => {
                    const claveG = "fact-r-" + (g.cliente_id || "sc");
                    const abierto = !!grupoAbierto[claveG];
                    return (
                      <div className="aq-fact-grupo" key={"r" + (g.cliente_id || "sc")}>
                        <div className="aq-det-line aq-prov-fact aq-fact-head" onClick={() => setGrupoAbierto((prev) => ({ ...prev, [claveG]: !prev[claveG] }))}>
                          <span>
                            {g.nombre}{g.rut ? " · " + g.rut : ""}
                            <em className="aq-det-chofer">
                              {g.emit.length > 0 ? `${g.emit.length} emitida(s)` : ""}{g.noReq.length > 0 ? `${g.emit.length ? " · " : ""}${g.noReq.length} sin factura requerida` : ""}
                            </em>
                          </span>
                          <span className="aq-muted">{abierto ? "▲" : "▼"}</span>
                        </div>
                        {abierto && (
                          <div className="aq-fact-detalle">
                            {g.emit.map((f) => (
                              <div className="aq-det-line aq-prov-fact" key={f.numero_guia}>
                                <span>
                                  Guía {f.numero_guia}
                                  <em className="aq-det-chofer">Doc. {f.numero_documento_emitido}{f.documento_emitido_en ? " · " + new Date(f.documento_emitido_en).toLocaleDateString("es-CL") : ""}</em>
                                </span>
                                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                  {CLP(f.monto)}
                                  {f.documento_emitido_url && <button className="aq-link" onClick={() => verDocumentoEmitido(f.documento_emitido_url)}>Ver PDF</button>}
                                  <button className="aq-link" onClick={() => deshacerDocumentoEmitido(f.numero_guia)}>Deshacer</button>
                                </span>
                              </div>
                            ))}
                            {g.noReq.map((f) => (
                              <div className="aq-det-line aq-prov-fact" key={"nr" + f.numero_guia}>
                                <span>Guía {f.numero_guia}<em className="aq-det-chofer">Marcada sin factura requerida</em></span>
                                <button className="aq-link" onClick={() => deshacerFacturaNoRequerida(f.numero_guia)}>Deshacer</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </section>
        )}

        {/* ===================== BIDONES PENDIENTES DE RETIRO (admin/operador) ===================== */}
        {credsListas && vista === "bidones" && (rol === "admin" || rol === "operador") && (
          <section className="aq-card">
            <div className="aq-modal-head" style={{ marginBottom: 8 }}>
              <div>
                <h2 style={{ margin: 0 }}>Bidones pendientes de retiro</h2>
                <span className="aq-muted">Agrupado por cliente · lo relevante es la cantidad en su poder, no los días (últimos 6 meses).</span>
              </div>
              <button className="aq-btn-sec" onClick={cargarBidonesPend} disabled={cargandoBid}>↻ Actualizar</button>
            </div>

            {errorBid && <div className="aq-error" style={{ marginBottom: 8 }}>{errorBid}</div>}
            {cargandoBid && <p className="aq-muted">Cargando bidones pendientes…</p>}
            {!cargandoBid && bidonesPend && bidonesPend.length === 0 && (
              <p className="aq-muted">No hay bidones pendientes de retiro en el período.</p>
            )}

            {!cargandoBid && bidonesPend && bidonesPend.length > 0 && (() => {
              const grupos = {};
              bidonesPend.forEach((b) => {
                const cid = b.cliente_id || "sin-cliente";
                if (!grupos[cid]) grupos[cid] = { cliente_id: b.cliente_id, guias: [] };
                grupos[cid].guias.push(b);
              });
              const lista = Object.values(grupos).map((g) => {
                const cli = clientePorId[g.cliente_id];
                const pend = g.guias.filter((b) => !b.bidones_retirados_en);
                const resueltos = g.guias.filter((b) => b.bidones_retirados_en);
                const totalPend = pend.reduce((s, b) => s + b.cantidad, 0);
                const proximoPedido = pend.length > 0 && pend.every((b) => b.bidones_proximo_pedido);
                const maxDias = pend.length ? Math.max(...pend.map((b) => b.dias)) : 0;
                return { cliente_id: g.cliente_id, nombre: cli?.nombre || "Cliente", pend, resueltos, totalPend, proximoPedido, maxDias };
              });
              lista.sort((a, b) => (b.pend.length > 0) - (a.pend.length > 0) || b.totalPend - a.totalPend);
              const conPend = lista.filter((g) => g.pend.length > 0);
              const soloResueltos = lista.filter((g) => !g.pend.length && g.resueltos.length > 0);

              if (!conPend.length && !soloResueltos.length) {
                return <p className="aq-muted">No hay bidones pendientes de retiro en el período.</p>;
              }
              return (
                <>
                  {conPend.map((g) => {
                    const claveG = "bid-" + (g.cliente_id || "sc");
                    const abierto = !!grupoAbierto[claveG];
                    const guiasPend = g.pend.map((b) => b.numero_guia);
                    const clave = guiasPend.join(",");
                    const cls = g.totalPend >= 10 ? "bad" : g.totalPend >= 4 ? "warn" : "ok";
                    return (
                      <div className="aq-fact-grupo" key={g.cliente_id || "sc"}>
                        <div className="aq-det-line aq-prov-cab aq-fact-head" onClick={() => setGrupoAbierto((prev) => ({ ...prev, [claveG]: !prev[claveG] }))}>
                          <span>
                            {g.nombre}
                            <em className="aq-det-chofer">{g.pend.length} pedido(s) con bidones · hasta {g.maxDias} día(s) de antigüedad{g.proximoPedido ? " · retiro agendado" : ""}</em>
                          </span>
                          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span className={"aq-badge " + cls}>{g.totalPend} bidón(es)</span>
                            <span className="aq-muted">{abierto ? "▲" : "▼"}</span>
                          </span>
                        </div>

                        {abierto && (
                          <div className="aq-fact-detalle">
                            {g.pend.map((b) => (
                              <div className="aq-det-line aq-prov-fact" key={b.numero_guia}>
                                <span>
                                  Guía {b.numero_guia}
                                  <em className="aq-det-chofer">Chofer {b.chofer} · {b.dias} día(s)</em>
                                </span>
                                <span>{b.cantidad} bidón(es)</span>
                              </div>
                            ))}

                            <label className="aq-check-inline">
                              <input
                                type="checkbox"
                                checked={g.proximoPedido}
                                disabled={guardandoBidonGuia === clave}
                                onChange={(e) => marcarBidonesProximoPedidoGrupo(guiasPend, e.target.checked)}
                              />
                              Se retiran en el próximo pedido que realicen (avisa al tomar el pedido)
                            </label>

                            <div className="aq-fact-acciones">
                              <input
                                type="text"
                                placeholder="Pedido / correlativo del retiro"
                                value={bidonesCorrelativo[g.cliente_id] ?? ""}
                                onChange={(e) => setBidonesCorrelativo((prev) => ({ ...prev, [g.cliente_id]: e.target.value }))}
                                style={{ width: 190 }}
                              />
                              <button
                                className="aq-btn-sec"
                                disabled={guardandoBidonGuia === clave || !(bidonesCorrelativo[g.cliente_id] || "").trim()}
                                onClick={() => marcarBidonesRetiradosGrupo(guiasPend, bidonesCorrelativo[g.cliente_id])}
                              >
                                {guardandoBidonGuia === clave ? "Guardando…" : "Marcar retirado"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {soloResueltos.length > 0 && <strong style={{ display: "block", marginTop: 14 }}>Retirados ({soloResueltos.length})</strong>}
                  {soloResueltos.map((g) => {
                    const claveG = "bid-r-" + (g.cliente_id || "sc");
                    const abierto = !!grupoAbierto[claveG];
                    return (
                      <div className="aq-fact-grupo" key={"r" + (g.cliente_id || "sc")}>
                        <div className="aq-det-line aq-prov-fact aq-fact-head" onClick={() => setGrupoAbierto((prev) => ({ ...prev, [claveG]: !prev[claveG] }))}>
                          <span>{g.nombre}<em className="aq-det-chofer">{g.resueltos.length} retiro(s) registrado(s)</em></span>
                          <span className="aq-muted">{abierto ? "▲" : "▼"}</span>
                        </div>
                        {abierto && (
                          <div className="aq-fact-detalle">
                            {g.resueltos.map((b) => (
                              <div className="aq-det-line aq-prov-fact" key={b.numero_guia}>
                                <span>
                                  Guía {b.numero_guia}
                                  <em className="aq-det-chofer">
                                    {b.cantidad} bidón(es) · Retirado {new Date(b.bidones_retirados_en).toLocaleDateString("es-CL")}{b.bidones_retiro_guia ? " · Con pedido " + b.bidones_retiro_guia : ""}
                                  </em>
                                </span>
                                <button className="aq-link" onClick={() => deshacerBidonRetirado(b.numero_guia)}>Deshacer</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </section>
        )}

        {/* ===================== COTIZACIONES ===================== */}
        {credsListas && vista === "cotizaciones" && (rol === "admin" || rol === "operador") && (
          <section className="aq-card">
            {!cotizEdit ? (
              <>
                <div className="aq-row-head">
                  <h2>Cotizaciones</h2>
                  <button className="aq-btn-sec" onClick={nuevaCotizacion}>+ Nueva cotización</button>
                </div>
                <div className="aq-search" style={{ marginBottom: 8 }}>
                  <input
                    placeholder="Buscar por folio, cliente o RUT…"
                    value={buscarCotiz}
                    onChange={(e) => setBuscarCotiz(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <button className={filtroEstadoCotiz === "todas" ? "aq-btn" : "aq-btn-sec"} onClick={() => setFiltroEstadoCotiz("todas")}>Todas</button>
                  {ESTADOS_COTIZ.map((e) => (
                    <button key={e} className={filtroEstadoCotiz === e ? "aq-btn" : "aq-btn-sec"} onClick={() => setFiltroEstadoCotiz(e)}>
                      {ESTADO_COTIZ_LABEL[e]}
                    </button>
                  ))}
                </div>

                {errorCotiz && <div className="aq-error" style={{ marginBottom: 8 }}>{errorCotiz}</div>}
                {cargandoCotiz && <p className="aq-muted">Cargando cotizaciones…</p>}

                {!cargandoCotiz && (() => {
                  const q = buscarCotiz.trim().toLowerCase();
                  const lista = cotizaciones
                    .filter((c) => filtroEstadoCotiz === "todas" || c.estado === filtroEstadoCotiz)
                    .filter((c) => {
                      if (!q) return true;
                      const cli = c.cliente_id ? clientes.find((x) => x.id === c.cliente_id) : null;
                      const nombre = (cli?.nombre || c.razon_social || "").toLowerCase();
                      const rut = (c.rut_empresa || cli?.rut || "").toLowerCase();
                      return (c.folio || "").toLowerCase().includes(q) || nombre.includes(q) || rut.includes(q);
                    });
                  if (lista.length === 0) return <p className="aq-muted">No hay cotizaciones para este filtro.</p>;
                  return (
                    <div className="aq-items">
                      {lista.map((c) => {
                        const cli = c.cliente_id ? clientes.find((x) => x.id === c.cliente_id) : null;
                        const nombre = cli?.nombre || c.razon_social || "(sin nombre)";
                        return (
                          <div className="aq-det-line" key={c.id} style={{ cursor: "pointer" }} onClick={() => abrirCotizacion(c)}>
                            <span>
                              <strong>{c.folio}</strong> · {nombre}{!c.cliente_id ? " · potencial" : ""}
                              <em className="aq-det-chofer">{c.fecha_emision} · {ESTADO_COTIZ_LABEL[c.estado] || c.estado}</em>
                            </span>
                            <span>{CLP(c.total)}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="aq-row-head">
                  <h2>{cotizEdit._nuevo ? "Nueva cotización" : "Cotización " + cotizEdit.folio}</h2>
                  <button className="aq-link" onClick={() => { setCotizEdit(null); setOkCotiz(""); }}>Volver</button>
                </div>

                {okCotiz && <div className={"aq-result " + (okCotiz.startsWith("Error") ? "bad" : "ok")}>{okCotiz}</div>}
                {!cotizEdit._nuevo && (
                  <p className="aq-muted">Estado actual: <strong>{ESTADO_COTIZ_LABEL[cotizEdit.estado] || cotizEdit.estado}</strong></p>
                )}

                <div className="aq-row-head" style={{ marginTop: 4 }}>
                  <strong className="aq-mini">Cliente</strong>
                  {cotizEdit.estado !== "procesada" && (
                    <span style={{ display: "flex", gap: 8 }}>
                      <button className={cotizClienteTipo === "existente" ? "aq-btn" : "aq-btn-sec"} onClick={() => setCotizClienteTipo("existente")}>Cliente existente</button>
                      <button className={cotizClienteTipo === "potencial" ? "aq-btn" : "aq-btn-sec"} onClick={() => setCotizClienteTipo("potencial")}>Potencial (solo RUT empresa)</button>
                    </span>
                  )}
                </div>

                {cotizClienteTipo === "existente" ? (
                  <div className="aq-search" style={{ marginBottom: 8 }}>
                    {cotizEdit.cliente_id ? (
                      <p>
                        <strong>{cotizEdit.cliente_nombre}</strong>{" "}
                        {cotizEdit.estado !== "procesada" && (
                          <button className="aq-link" onClick={() => setCotizEdit((prev) => ({ ...prev, cliente_id: null, cliente_nombre: "" }))}>cambiar</button>
                        )}
                      </p>
                    ) : (
                      <>
                        <input
                          placeholder="Buscar por nombre, RUT o código…"
                          value={buscarCotizCliente}
                          onChange={(e) => setBuscarCotizCliente(e.target.value)}
                          autoFocus
                        />
                        {resultadosCotizCliente.length > 0 && (
                          <ul className="aq-results">
                            {resultadosCotizCliente.map((c) => (
                              <li key={c.id} onClick={() => elegirClienteCotiz(c)}>
                                <strong>{c.nombre}</strong>
                                <span>{c.rut || c.codigo_cliente}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="aq-grid-2">
                    <label>RUT empresa
                      <input
                        value={cotizEdit.rut_empresa || ""}
                        disabled={cotizEdit.estado === "procesada"}
                        onChange={(e) => setCotizEdit((prev) => ({ ...prev, rut_empresa: e.target.value }))}
                        placeholder="76.123.456-7"
                      />
                    </label>
                    <label>Razón social
                      <input
                        value={cotizEdit.razon_social || ""}
                        disabled={cotizEdit.estado === "procesada"}
                        onChange={(e) => setCotizEdit((prev) => ({ ...prev, razon_social: e.target.value }))}
                      />
                    </label>
                    <label>Contacto (nombre)
                      <input
                        value={cotizEdit.contacto_nombre || ""}
                        disabled={cotizEdit.estado === "procesada"}
                        onChange={(e) => setCotizEdit((prev) => ({ ...prev, contacto_nombre: e.target.value }))}
                      />
                    </label>
                    <label>Contacto (email)
                      <input
                        type="email"
                        value={cotizEdit.contacto_email || ""}
                        disabled={cotizEdit.estado === "procesada"}
                        onChange={(e) => setCotizEdit((prev) => ({ ...prev, contacto_email: e.target.value }))}
                      />
                    </label>
                    <label>Contacto (teléfono)
                      <input
                        value={cotizEdit.contacto_telefono || ""}
                        disabled={cotizEdit.estado === "procesada"}
                        onChange={(e) => setCotizEdit((prev) => ({ ...prev, contacto_telefono: e.target.value }))}
                      />
                    </label>
                  </div>
                )}

                <div className="aq-grid-2" style={{ marginTop: 12 }}>
                  <label>Fecha emisión
                    <input type="date" value={cotizEdit.fecha_emision || ""} onChange={(e) => setCotizEdit((prev) => ({ ...prev, fecha_emision: e.target.value }))} />
                  </label>
                  <label>Válida hasta
                    <input type="date" value={cotizEdit.fecha_vigencia || ""} onChange={(e) => setCotizEdit((prev) => ({ ...prev, fecha_vigencia: e.target.value }))} />
                  </label>
                </div>

                <div className="aq-row-head" style={{ marginTop: 16 }}>
                  <h2>Productos</h2>
                  <button className="aq-btn-sec" onClick={agregarLineaCotiz}>+ Agregar línea</button>
                </div>
                {itemsCotiz.length === 0 ? (
                  <p className="aq-muted">Agrega los productos a cotizar.</p>
                ) : (
                  <div className="aq-items">
                    {itemsCotiz.map((it) => (
                      <div key={it.key}>
                        <div className="aq-item">
                          <select value={it.producto_id || ""} onChange={(e) => cambiarProductoCotizLinea(it.key, e.target.value)}>
                            {Object.entries(catalogoCotizPorGrupo).map(([grupo, lista]) => (
                              <optgroup key={grupo} label={grupo}>
                                {lista.map((p) => (
                                  <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <input
                            className="aq-num"
                            type="number"
                            min="0"
                            step="1"
                            value={it.cantidad}
                            onChange={(e) => cambiarCantidadCotizLinea(it.key, Number(e.target.value))}
                            aria-label="Cantidad"
                          />
                          <input
                            className="aq-num"
                            type="number"
                            min="0"
                            value={it.precio_unit}
                            onChange={(e) => cambiarPrecioCotizLinea(it.key, Number(e.target.value))}
                            aria-label="Precio unitario"
                          />
                          <span className="aq-sub">{CLP(Math.round((it.cantidad || 0) * (it.precio_unit || 0)))}</span>
                          <button className="aq-x" onClick={() => quitarLineaCotiz(it.key)} aria-label="Quitar">×</button>
                        </div>
                        <div className="aq-item-ficha">
                          <label className="aq-check">
                            <input
                              type="checkbox"
                              checked={!!it.incluir_ficha}
                              onChange={(e) => toggleFichaCotizLinea(it.key, e.target.checked)}
                            />
                            Incluir ficha técnica en el PDF
                          </label>
                          {it.incluir_ficha && (
                            <button type="button" className="aq-link" onClick={() => abrirEditorFicha(it)}>
                              {fichasProducto[keyFicha(it)] ? "Editar ficha" : "Crear ficha"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p style={{ textAlign: "right", marginTop: 8 }}><strong>Total: {CLP(totalCotiz)}</strong></p>

                <label className="aq-full" style={{ marginTop: 8 }}>Notas / condiciones
                  <textarea rows="3" value={cotizEdit.notas || ""} onChange={(e) => setCotizEdit((prev) => ({ ...prev, notas: e.target.value }))} placeholder="Ej: precios no incluyen IVA · válido para despacho en RM · forma de pago…" />
                </label>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                  <button className="aq-btn" onClick={guardarCotizacion} disabled={guardandoCotiz}>
                    {guardandoCotiz ? "Guardando…" : "Guardar cotización"}
                  </button>
                  {!cotizEdit._nuevo && (
                    <button className="aq-btn-sec" disabled={generandoPdfCotiz} onClick={() => descargarPdfCotizacion(cotizEdit, itemsCotiz)}>
                      {generandoPdfCotiz ? "Generando PDF…" : "Descargar PDF"}
                    </button>
                  )}
                  {!cotizEdit._nuevo && (
                    <button className="aq-btn-sec" onClick={copiarTextoEnvioCotiz}>Copiar texto de envío</button>
                  )}
                  {!cotizEdit._nuevo && cotizEdit.estado !== "procesada" && (
                    <>
                      <select value={cotizEdit.estado} onChange={(e) => cambiarEstadoCotiz(cotizEdit, e.target.value)}>
                        {ESTADOS_COTIZ.filter((e) => e !== "procesada").map((e) => (
                          <option key={e} value={e}>{ESTADO_COTIZ_LABEL[e]}</option>
                        ))}
                      </select>
                      <button className="aq-btn-sec" disabled={procesandoCotiz} onClick={() => procesarCotizacion(cotizEdit)}>
                        {procesandoCotiz ? "Procesando…" : "Procesar cotización"}
                      </button>
                    </>
                  )}
                </div>
                {cotizClienteTipo === "potencial" && cotizEdit.estado !== "procesada" && (
                  <p className="aq-muted" style={{ marginTop: 8 }}>
                    Este cliente aún no existe en la ficha de Clientes: se crea automáticamente al presionar "Procesar cotización".
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {/* Modal: crear/editar ficha técnica de producto (se anexa opcionalmente al PDF de cotización) */}
        {fichaEditKey && fichaEditDraft && (
          <div className="aq-modal-ov" onClick={() => !guardandoFicha && cerrarEditorFicha()}>
            <div className="aq-modal" onClick={(e) => e.stopPropagation()}>
              <div className="aq-modal-head">
                <div>
                  <strong>Ficha técnica</strong>
                  <span className="aq-muted">{fichaEditDraft.producto_nombre || "Producto"}</span>
                </div>
                <button className="aq-link" disabled={guardandoFicha} onClick={cerrarEditorFicha}>Cerrar ✕</button>
              </div>

              {okFicha && <div className={"aq-result " + (okFicha.startsWith("Error") ? "bad" : "ok")}>{okFicha}</div>}

              <div className="aq-modal-edit">
                <label className="aq-full">Descripción
                  <textarea
                    rows="2"
                    value={fichaEditDraft.descripcion || ""}
                    onChange={(e) => setFichaEditDraft((prev) => ({ ...prev, descripcion: e.target.value }))}
                    placeholder="Descripción breve del producto/equipo"
                  />
                </label>
                <div className="aq-grid-2">
                  <label>Imagen
                    <input type="file" accept="image/*" onChange={elegirImagenFichaLocal} />
                  </label>
                  <label>Garantía
                    <input
                      value={fichaEditDraft.garantia || ""}
                      onChange={(e) => setFichaEditDraft((prev) => ({ ...prev, garantia: e.target.value }))}
                      placeholder="Ej: 12 meses"
                    />
                  </label>
                </div>
                {fichaEditDraft.imagen_url && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <img src={fichaEditDraft.imagen_url} alt="Vista previa" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                    <button type="button" className="aq-link" onClick={quitarImagenFicha}>Quitar imagen</button>
                  </div>
                )}
              </div>

              <div className="aq-modal-edit">
                <div className="aq-row-head">
                  <strong>Especificaciones</strong>
                  <button className="aq-btn-sec" type="button" onClick={agregarSpecFicha}>+ Agregar</button>
                </div>
                {(fichaEditDraft.specs || []).length === 0 ? (
                  <p className="aq-muted">Sin especificaciones aún (ej: Capacidad, Dimensiones, Voltaje…).</p>
                ) : (
                  fichaEditDraft.specs.map((s, i) => (
                    <div className="aq-items-edit-row" key={i}>
                      <input
                        style={{ flex: 1 }}
                        value={s.label}
                        onChange={(e) => cambiarSpecFicha(i, "label", e.target.value)}
                        placeholder="Ej: Capacidad"
                      />
                      <input
                        style={{ flex: 1 }}
                        value={s.value}
                        onChange={(e) => cambiarSpecFicha(i, "value", e.target.value)}
                        placeholder="Ej: 20 litros"
                      />
                      <button className="aq-x" type="button" onClick={() => quitarSpecFicha(i)} aria-label="Quitar">×</button>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="aq-btn" onClick={guardarFicha} disabled={guardandoFicha}>
                  {guardandoFicha ? "Guardando…" : "Guardar ficha"}
                </button>
                <button className="aq-btn-sec" disabled={guardandoFicha} onClick={cerrarEditorFicha}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: marcar pagado con respaldo bancario */}
        {pagoModal && (
          <div className="aq-modal-ov" onClick={() => !subiendoPago && setPagoModal(null)}>
            <div className="aq-modal" onClick={(e) => e.stopPropagation()}>
              <div className="aq-modal-head">
                <div>
                  <strong>Registrar pago</strong>
                  <span className="aq-muted">{pagoModal.proveedor} · Guía {pagoModal.numero_guia} · {CLP(pagoModal.monto)}</span>
                </div>
                <button className="aq-link" disabled={subiendoPago} onClick={() => setPagoModal(null)}>Cerrar ✕</button>
              </div>
              <div className="aq-modal-edit">
                <label className="aq-mini">Respaldo bancario (foto del comprobante)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { setPagoFoto(e.target.files?.[0] || null); setErrorPago(""); }}
                />
                {pagoFoto && <p className="aq-mini">Archivo: {pagoFoto.name}</p>}
                {errorPago && <div className="aq-error" style={{ marginTop: 8 }}>{errorPago}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button className="aq-btn" style={{ marginTop: 0 }} disabled={subiendoPago || !pagoFoto} onClick={confirmarPago}>
                    {subiendoPago ? "Registrando…" : "Confirmar pago"}
                  </button>
                  <button className="aq-btn-sec" disabled={subiendoPago} onClick={() => setPagoModal(null)}>Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: registrar abono parcial (cobro cliente o deuda proveedor) */}
        {abonoModal && (
          <div className="aq-modal-ov" onClick={() => !guardandoAbono && setAbonoModal(null)}>
            <div className="aq-modal" onClick={(e) => e.stopPropagation()}>
              <div className="aq-modal-head">
                <div>
                  <strong>Registrar abono</strong>
                  <span className="aq-muted">
                    {abonoModal.titulo || abonoModal.numero_guia} · Guía {abonoModal.numero_guia}
                  </span>
                </div>
                <button className="aq-link" disabled={guardandoAbono} onClick={() => setAbonoModal(null)}>Cerrar ✕</button>
              </div>
              <div className="aq-modal-edit">
                <div className="aq-desglose" style={{ marginBottom: 10 }}>
                  <div className="aq-desglose-row"><span>Monto total</span><strong>{CLP(abonoModal.tipo === "cobro" ? abonoModal.monto_total : abonoModal.monto)}</strong></div>
                  <div className="aq-desglose-row"><span>Abonado</span><strong className="pos">{CLP(abonoModal.tipo === "cobro" ? abonoModal.cobro_abonado : abonoModal.abonado)}</strong></div>
                  <div className="aq-desglose-row total"><span>Saldo pendiente</span><strong className="neg">{CLP(abonoModal.saldo)}</strong></div>
                </div>
                <label className="aq-mini">Monto del abono (CLP)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={abonoModal.saldo}
                  value={abonoMonto}
                  onChange={(e) => { setAbonoMonto(e.target.value); setErrorAbono(""); }}
                  placeholder={`Máx. ${abonoModal.saldo}`}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="aq-link" type="button" onClick={() => setAbonoMonto(String(abonoModal.saldo))}>Abonar saldo completo</button>
                </div>
                {errorAbono && <div className="aq-error" style={{ marginTop: 8 }}>{errorAbono}</div>}

                {abonoHist.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <strong className="aq-mini">Historial de abonos</strong>
                    {abonoHist.map((h) => (
                      <div className="aq-det-line" key={h.id}>
                        <span className="aq-tr-sub">
                          {h.fecha ? new Date(h.fecha).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" }) : ""}
                          {h.registrado_por ? " · " + h.registrado_por : ""}
                        </span>
                        <span>{CLP(h.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button className="aq-btn" style={{ marginTop: 0 }} disabled={guardandoAbono || !(Number(abonoMonto) > 0)} onClick={confirmarAbono}>
                    {guardandoAbono ? "Registrando…" : "Confirmar abono"}
                  </button>
                  <button className="aq-btn-sec" disabled={guardandoAbono} onClick={() => setAbonoModal(null)}>Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== CONFIRMACIÓN ===================== */}
        {credsListas && vista === "confirmacion" && confirma && (
          <section className="aq-card aq-confirm">
            <div className="aq-confirm-head">
              <span className="aq-check-ico" aria-hidden>✓</span>
              <h2>Pedido {confirma.guia} ingresado</h2>
            </div>
            <pre className="aq-confirm-msg">{confirma.mensaje}</pre>
            <div className={"aq-email-line " + (confirma.emailEnviado ? "ok" : confirma.emailDestino ? "warn" : "muted")}>
              {confirma.emailEnviado
                ? `Correo enviado a ${confirma.emailDestino}.`
                : confirma.emailDestino
                ? `No se pudo enviar el correo a ${confirma.emailDestino} (revisar el puente). El pedido quedó guardado igual.`
                : "El cliente no tiene email registrado, no se envió correo."}
            </div>
            {confirma.sync !== "enviado_dt" && (
              <p className="aq-muted">Envío a DispatchTrack pendiente; el pedido quedó guardado.</p>
            )}
            <div className="aq-confirm-acts">
              <button className="aq-btn" onClick={() => { setConfirma(null); setVista("inicio"); }}>Volver al inicio</button>
              <button className="aq-btn-sec" onClick={() => { setConfirma(null); setVista("nuevo"); }}>Otro pedido</button>
            </div>
          </section>
        )}

        {/* ===================== MANTENEDORES (Bloque 4) ===================== */}
        {credsListas && !cargando && !errorCarga && vista === "mantenedor" && (
          <>
            {/* Sub-pestañas */}
            <div className="aq-subtabs">
              <button className={mantTab === "clientes" ? "on" : ""} onClick={() => { setMantTab("clientes"); setCliEdit(null); setOkCli(""); }}>Clientes</button>
              {rol === "admin" && (
                <button className={mantTab === "productos" ? "on" : ""} onClick={() => { setMantTab("productos"); setProdEdit(null); setOkProd(""); }}>Productos</button>
              )}
              {rol === "admin" && (
                <button className={mantTab === "perfiles" ? "on" : ""} onClick={() => { setMantTab("perfiles"); setPerfEdit(null); setOkPerf(""); }}>Perfiles</button>
              )}
            </div>

            {/* ---------- CLIENTES (operador agrega/edita · admin full) ---------- */}
            {mantTab === "clientes" && (
              <section className="aq-card">
                {!cliEdit ? (
                  <>
                    <div className="aq-row-head">
                      <h2>Clientes</h2>
                      <button className="aq-btn-sec" onClick={nuevoCliente}>+ Nuevo cliente</button>
                    </div>
                    <div className="aq-search">
                      <input
                        placeholder="Buscar por nombre, RUT, código o domicilio (0004-1)"
                        value={buscarMant}
                        onChange={(e) => setBuscarMant(e.target.value)}
                        autoFocus
                      />
                      {resultadosMant.length > 0 && (
                        <ul className="aq-results">
                          {resultadosMant.map((r) => (
                            <li
                              key={r.cliente.id + "|" + (r.dom?.id || "")}
                              onClick={() => { editarCliente(r.cliente); setBuscarMant(""); }}
                              className={r.cliente.bloqueado ? "aq-li-alerta" : ""}
                            >
                              <strong>{r.cliente.bloqueado ? "⚠ " : ""}{r.cliente.nombre}{r.cliente.activo === false ? " · inactivo" : ""}</strong>
                              <span>
                                {r.dom?.identificador_dt
                                  ? r.dom.identificador_dt + " · " + (r.dom.etiqueta || r.dom.direccion || "")
                                  : (r.cliente.codigo_cliente || r.cliente.rut || "")}
                                {r.cliente.bloqueado ? " · bloqueado" : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {okCli && <div className={"aq-result " + (okCli.startsWith("Error") ? "bad" : "ok")}>{okCli}</div>}
                    <p className="aq-muted">
                      Busca un cliente para editarlo o crea uno nuevo.
                      {rol === "operador" ? " Como operador puedes crear y editar; la baja la realiza un administrador." : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="aq-row-head">
                      <h2>{cliEdit._nuevo ? "Nuevo cliente" : "Editar cliente"}</h2>
                      <button className="aq-link" onClick={() => { setCliEdit(null); setOkCli(""); }}>Volver</button>
                    </div>
                    {!cliEdit._nuevo && semaforoCli && (
                      <div className={"aq-semaforo " + semaforoCli.cls}>
                        <span className="aq-sem-dot" />
                        Comportamiento de pago: {semaforoCli.label}
                      </div>
                    )}
                    {!cliEdit._nuevo && semaforoCli && semaforoCli.moroso && (
                      <p className="aq-mini" style={{ color: "#b42318", fontWeight: 600, margin: "-6px 0 10px" }}>
                        Cliente moroso: exigir pago anticipado en próximos pedidos.
                      </p>
                    )}
                    {!cliEdit._nuevo && (() => {
                      const doms = todosDomicilios.filter((d) => d.cliente_id === cliEdit.id);
                      return (
                        <div className="aq-contactos">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <strong>Domicilios ({doms.length})</strong>
                            {!domEdit && (
                              <button className="aq-link" onClick={() => { setDomEdit({ _nuevo: true, cliente_id: cliEdit.id, identificador_dt: "", etiqueta: "", direccion: "", comuna: "", es_principal: false }); setOkDom(""); setErrDom(""); }}>
                                + Agregar domicilio
                              </button>
                            )}
                          </div>

                          {/* Editor de domicilio */}
                          {domEdit && (
                            <div className="aq-dom-edit">
                              <strong style={{ display: "block", marginBottom: 8, color: "var(--navy)" }}>{domEdit._nuevo ? "Nuevo domicilio" : "Editar domicilio"}</strong>
                              <div className="aq-grid" style={{ gap: 8 }}>
                                <label>
                                  Identificador (NNNN-N) *
                                  <input value={domEdit.identificador_dt || ""} readOnly={!domEdit._nuevo} onChange={(e) => setDomEdit({ ...domEdit, identificador_dt: e.target.value })} placeholder="Ej: 0215-2" />
                                  {domEdit._nuevo && <span className="aq-mini">Debe ser único (ej: 0215-2, 0215-3…)</span>}
                                </label>
                                <label>
                                  Nombre contacto
                                  <input value={domEdit.etiqueta || ""} onChange={(e) => setDomEdit({ ...domEdit, etiqueta: e.target.value })} placeholder="Ej: Juan Pérez / Dpto 5" />
                                </label>
                                <label className="aq-full">
                                  Dirección *
                                  <input value={domEdit.direccion || ""} onChange={(e) => setDomEdit({ ...domEdit, direccion: e.target.value })} placeholder="Ej: Av. Providencia 1234, Dpto 5" />
                                </label>
                                <label>
                                  Comuna
                                  <select value={domEdit.comuna || ""} onChange={(e) => setDomEdit({ ...domEdit, comuna: e.target.value })}>
                                    <option value="">— Selecciona comuna —</option>
                                    {domEdit.comuna && !COMUNAS_RM.includes(domEdit.comuna) && (
                                      <option value={domEdit.comuna}>{domEdit.comuna} (actual)</option>
                                    )}
                                    {COMUNAS_RM.map((c) => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </label>
                              </div>
                              <label className="aq-check" style={{ marginTop: 10 }}>
                                <input type="checkbox" checked={!!domEdit.es_principal} onChange={(e) => setDomEdit({ ...domEdit, es_principal: e.target.checked })} />
                                Domicilio principal
                              </label>
                              {errDom && <div className="aq-result bad" style={{ marginTop: 8 }}>{errDom}</div>}
                              {okDom && <div className="aq-result ok" style={{ marginTop: 8 }}>{okDom}</div>}
                              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                <button className="aq-btn" style={{ flex: 1 }} disabled={guardandoDom} onClick={guardarDomicilio}>
                                  {guardandoDom ? "Guardando…" : (domEdit._nuevo ? "Agregar" : "Guardar cambios")}
                                </button>
                                <button className="aq-btn-sec" onClick={() => { setDomEdit(null); setErrDom(""); setOkDom(""); }}>Cancelar</button>
                              </div>
                            </div>
                          )}

                          {/* Lista de domicilios */}
                          {!domEdit && (
                            <ul>
                              {doms.length === 0 && <li><span className="aq-muted">Sin domicilios registrados.</span></li>}
                              {doms.map((d) => (
                                <li key={d.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                                  <div>
                                    <span className="aq-cont-nom">{d.etiqueta || "(sin nombre)"}{d.es_principal ? " · principal" : ""}</span>
                                    <span className="aq-cont-sub">{d.identificador_dt}{d.direccion ? " · " + d.direccion : ""}{d.comuna ? ", " + d.comuna : ""}</span>
                                  </div>
                                  <button className="aq-link" style={{ whiteSpace: "nowrap", fontSize: 12, marginTop: 2 }} onClick={() => { setDomEdit({ ...d, _nuevo: false }); setOkDom(""); setErrDom(""); }}>
                                    Editar
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}

                          {okDom && !domEdit && <div className="aq-result ok" style={{ marginTop: 8 }}>{okDom}</div>}
                          {doms.length > 0 && !domEdit && <span className="aq-mini" style={{ marginTop: 6, display: "block" }}>En Nuevo pedido puedes elegir a qué domicilio va el despacho.</span>}
                        </div>
                      );
                    })()}
                    <div className="aq-grid">
                      <label>Nombre<input value={cliEdit.nombre || ""} readOnly={rol !== "admin"} onChange={(e) => rol === "admin" && setCliEdit({ ...cliEdit, nombre: e.target.value })} /></label>
                      <label>RUT<input value={cliEdit.rut || ""} readOnly={rol !== "admin"} onChange={(e) => rol === "admin" && setCliEdit({ ...cliEdit, rut: e.target.value })} placeholder="12.345.678-9" /></label>
                      <label>Código cliente
                        <input value={cliEdit.codigo_cliente || ""} disabled readOnly title="Código correlativo, no editable" />
                        <span className="aq-mini">{cliEdit._nuevo ? "Se genera automático (formato 2212-1)" : "Correlativo, no editable"}</span>
                      </label>
                      <label>Teléfono<input value={cliEdit.telefono || ""} readOnly={rol !== "admin"} onChange={(e) => rol === "admin" && setCliEdit({ ...cliEdit, telefono: e.target.value })} /></label>
                      <label>Email<input type="email" value={cliEdit.email || ""} readOnly={rol !== "admin"} onChange={(e) => rol === "admin" && setCliEdit({ ...cliEdit, email: e.target.value })} placeholder="correo@cliente.cl" /></label>
                      <label>Marca
                        <select value={cliEdit.marca || ""} disabled={rol !== "admin"} onChange={(e) => rol === "admin" && setCliEdit({ ...cliEdit, marca: e.target.value })}>
                          <option value="">—</option>
                          {MARCAS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </label>
                    </div>
                    <label className="aq-check" style={{ marginTop: 14 }}>
                      <input type="checkbox" checked={!!cliEdit.es_empresa} disabled={rol !== "admin"} onChange={(e) => rol === "admin" && setCliEdit({ ...cliEdit, es_empresa: e.target.checked })} />
                      Es empresa (factura)
                    </label>
                    {cliEdit.es_empresa && (
                      <div className="aq-grid" style={{ marginTop: 10 }}>
                        <label>Razón social<input value={cliEdit.razon_social || ""} readOnly={rol !== "admin"} onChange={(e) => rol === "admin" && setCliEdit({ ...cliEdit, razon_social: e.target.value })} /></label>
                        <label>Giro<input value={cliEdit.giro || ""} readOnly={rol !== "admin"} onChange={(e) => rol === "admin" && setCliEdit({ ...cliEdit, giro: e.target.value })} /></label>
                      </div>
                    )}
                    <label className="aq-full">Notas<textarea rows="2" readOnly={rol !== "admin"} value={cliEdit.notas || ""} onChange={(e) => rol === "admin" && setCliEdit({ ...cliEdit, notas: e.target.value })} /></label>
                    <label className="aq-check" style={{ marginTop: 12 }}>
                      <input type="checkbox" checked={!!cliEdit.bloqueado} onChange={(e) => setCliEdit({ ...cliEdit, bloqueado: e.target.checked })} />
                      Cliente bloqueado para comprar
                    </label>
                    {cliEdit.bloqueado && (
                      <label className="aq-full">Motivo del bloqueo
                        <textarea rows="2" value={cliEdit.motivo_bloqueo || ""} readOnly={rol !== "admin"} onChange={(e) => rol === "admin" && setCliEdit({ ...cliEdit, motivo_bloqueo: e.target.value })} placeholder="Ej: Bloqueo por no pago" />
                      </label>
                    )}
                    {rol !== "admin" && !cliEdit._nuevo && (
                      <p className="aq-mini" style={{ color: "var(--muted)", marginTop: 8 }}>Solo el administrador puede editar los datos del cliente.</p>
                    )}
                    <div className="aq-mant-acts">
                      {rol === "admin" && (
                        <button className="aq-btn" disabled={guardandoCli} onClick={guardarCliente}>
                          {guardandoCli ? "Guardando…" : (cliEdit._nuevo ? "Crear cliente" : "Guardar cambios")}
                        </button>
                      )}
                      {!cliEdit._nuevo && (
                        <button className="aq-btn-sec" disabled={cargandoHist} onClick={() => verHistorial(cliEdit)}>
                          {cargandoHist ? "Cargando…" : "Ver pedidos"}
                        </button>
                      )}
                      {rol === "admin" && !cliEdit._nuevo && cliEdit.activo !== false && (
                        <button className="aq-btn-danger" onClick={() => desactivarCliente(cliEdit)}>Desactivar</button>
                      )}
                      {rol === "admin" && !cliEdit._nuevo && cliEdit.activo === false && (
                        <button className="aq-btn-sec" onClick={() => reactivarCliente(cliEdit)}>Activar</button>
                      )}
                    </div>
                    {okCli && <div className={"aq-result " + (okCli.startsWith("Error") ? "bad" : "ok")}>{okCli}</div>}

                    {/* Historial de pedidos del cliente */}
                    {errorHist && <div className="aq-result bad" style={{ marginTop: 12 }}>{errorHist}</div>}
                    {histPedidos !== null && (
                      <div className="aq-hist">
                        <div className="aq-hist-head">
                          <h3>Historial de pedidos {histPedidos.length ? `(${histPedidos.length})` : ""}</h3>
                          <button className="aq-link" onClick={() => { setHistPedidos(null); setHistAbierto(null); }}>Ocultar</button>
                        </div>
                        {histPedidos.length === 0 ? (
                          <p className="aq-muted">Este cliente no tiene pedidos registrados.</p>
                        ) : (
                          <div className="aq-tabla">
                            {histPedidos.map((p) => {
                              const entrega = p.numero_guia ? histEntregas[p.numero_guia] : null;
                              const ent = estadoEntregaDT(entrega, p);
                              const dom = domPorId[p.domicilio_id];
                              const abierto = histAbierto === p.id;
                              const its = histItems[p.id] || [];
                              const answers = answersFromRaw(entrega);
                              return (
                                <div key={p.id} className="aq-hist-ped">
                                  <div className="aq-hist-row" onClick={() => toggleHistItems(p.id)}>
                                    <div className="aq-hist-main">
                                      <strong>{p.numero_guia || "—"}</strong>
                                      <span className="aq-tr-sub">
                                        {(p.created_at ? new Date(p.created_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" }) : "")}
                                        {dom?.comuna ? " · " + dom.comuna : ""}
                                        {p.tipo_pago ? " · " + p.tipo_pago : ""}
                                      </span>
                                    </div>
                                    <span className="aq-tr-monto">{CLP(p.monto_total)}{p.por_cobrar && <em className="aq-pc">PC</em>}</span>
                                    <span className={"aq-badge " + ent.cls}>{ent.label}</span>
                                    <span className="aq-hist-caret">{abierto ? "▾" : "▸"}</span>
                                  </div>
                                  {abierto && (
                                    <div className="aq-hist-det">
                                      {its.length === 0 ? (
                                        <p className="aq-muted">Cargando detalle…</p>
                                      ) : (
                                        <ul className="aq-hist-items">
                                          {its.map((l) => (
                                            <li key={l.id}>
                                              <span>{l.cantidad} × {l.nombre}{l.codigo ? " (" + l.codigo + ")" : ""}</span>
                                              <span>{CLP((Number(l.cantidad) || 0) * (Number(l.precio_unit) || 0))}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                      {/* Retorno de DispatchTrack (entrega del chofer) */}
                                      {entrega && (
                                        <div className="aq-hist-pod">
                                          <strong>Entrega (DispatchTrack)</strong>
                                          {entrega.gestionado_en && <div>Gestionado: {new Date(entrega.gestionado_en).toLocaleString("es-CL")}</div>}
                                          {entrega.contact_name && <div>Recibe / domicilio: {entrega.contact_name}</div>}
                                          {entrega.substatus && <div>Resultado: {entrega.substatus}</div>}
                                          {(entrega.bidon_pendiente !== null && entrega.bidon_pendiente !== undefined) && <div>Bidón pendiente: {entrega.bidon_pendiente}</div>}
                                          {entrega.chofer && <div>Chofer: {entrega.chofer}</div>}
                                          {entrega.ruta && <div>Ruta: {entrega.ruta}</div>}
                                          {(entrega.latitude && entrega.longitude) && (
                                            <div><a className="aq-link" href={`https://maps.google.com/?q=${entrega.latitude},${entrega.longitude}`} target="_blank" rel="noreferrer">Ver ubicación de entrega</a></div>
                                          )}
                                          {answers.length > 0 && (
                                            <div className="aq-hist-form">
                                              {answers.map((a, idx) => (
                                                <div key={idx}><em>{a.name}:</em> {/^https?:\/\//.test(a.val) ? <a className="aq-link" href={a.val} target="_blank" rel="noreferrer">ver archivo</a> : a.val}</div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {(p.cobro_cobrado || p.cobro_recuperado || (Number(p.cobro_intentos) || 0) > 0 || esPagoNo(entrega)) && (
                                        <div className="aq-hist-pago">
                                          <strong>Cobro</strong>
                                          {p.cobro_cobrado ? (
                                            <div>✓ Pagado{p.cobro_at ? " el " + new Date(p.cobro_at).toLocaleDateString("es-CL") : ""}{p.cobro_por ? " · " + p.cobro_por : ""} · {CLP(p.monto_total)}</div>
                                          ) : esPagoNo(entrega) ? (
                                            (Number(p.cobro_abonado) || 0) > 0
                                              ? <div>Abonado {CLP(p.cobro_abonado)} · Saldo {CLP(Math.max(0, (Number(p.monto_total) || 0) - (Number(p.cobro_abonado) || 0)))}</div>
                                              : <div>Pendiente de cobro · {CLP(p.monto_total)}</div>
                                          ) : null}
                                          {p.cobro_recuperado && <div>✓ Bidón recuperado</div>}
                                          {(Number(p.cobro_intentos) || 0) > 0 && <div>Intentos de cobro: {p.cobro_intentos}</div>}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {/* ---------- PRODUCTOS (admin · pausar SKU) ---------- */}
            {mantTab === "productos" && rol === "admin" && (
              <section className="aq-card">
                {!prodEdit ? (
                  <>
                    <div className="aq-row-head">
                      <h2>Productos</h2>
                      <button className="aq-btn-sec" onClick={nuevoProducto}>+ Nuevo producto</button>
                    </div>
                    <input
                      className="aq-buscar-ped"
                      placeholder="Buscar por nombre o código (SKU)"
                      value={buscarProd}
                      onChange={(e) => setBuscarProd(e.target.value)}
                    />
                    {errorProd && <div className="aq-result bad">{errorProd}</div>}
                    {okProd && <div className={"aq-result " + (okProd.startsWith("Error") ? "bad" : "ok")}>{okProd}</div>}
                    {cargandoProd ? (
                      <p className="aq-muted">Cargando productos…</p>
                    ) : (
                      <div className="aq-list">
                        {productosAll
                          .filter((p) => {
                            const q = buscarProd.trim().toLowerCase();
                            return !q || (p.nombre || "").toLowerCase().includes(q) || (p.codigo || "").toLowerCase().includes(q);
                          })
                          .map((p) => (
                            <div className={"aq-list-row" + (p.activo ? "" : " off")} key={p.id}>
                              <div className="aq-list-main">
                                <strong>{p.nombre}</strong>
                                <span>{p.codigo}{p.familia ? " · " + p.familia : ""} · {CLP(p.precio_lista)}{p.precio_variable ? " · variable" : ""}</span>
                              </div>
                              <span className={"aq-badge " + (p.activo ? "ok" : "warn")}>{p.activo ? "Activo" : "Pausado"}</span>
                              <button className="aq-btn-sec" onClick={() => togglePausaProducto(p)}>{p.activo ? "Pausar" : "Activar"}</button>
                              <button className="aq-btn-sec" onClick={() => editarProducto(p)}>Editar</button>
                            </div>
                          ))}
                        {productosAll.length === 0 && <p className="aq-muted">Sin productos.</p>}
                      </div>
                    )}
                    <p className="aq-muted">Pausar un SKU lo deja fuera de “Nuevo pedido” sin borrarlo. Reactívalo cuando vuelva a haber stock.</p>
                  </>
                ) : (
                  <>
                    <div className="aq-row-head">
                      <h2>{prodEdit._nuevo ? "Nuevo producto" : "Editar producto"}</h2>
                      <button className="aq-link" onClick={() => { setProdEdit(null); setOkProd(""); }}>Volver</button>
                    </div>
                    <div className="aq-grid">
                      <label>Código (SKU)<input value={prodEdit.codigo || ""} onChange={(e) => setProdEdit({ ...prodEdit, codigo: e.target.value })} /></label>
                      <label>Nombre<input value={prodEdit.nombre || ""} onChange={(e) => setProdEdit({ ...prodEdit, nombre: e.target.value })} /></label>
                      <label>Familia<input value={prodEdit.familia || ""} onChange={(e) => setProdEdit({ ...prodEdit, familia: e.target.value })} /></label>
                      <label>Precio lista<input type="number" min="0" value={prodEdit.precio_lista ?? 0} onChange={(e) => setProdEdit({ ...prodEdit, precio_lista: Number(e.target.value) })} /></label>
                    </div>
                    <label className="aq-full">Descripción<textarea rows="2" value={prodEdit.descripcion || ""} onChange={(e) => setProdEdit({ ...prodEdit, descripcion: e.target.value })} /></label>
                    <div className="aq-checks">
                      <label className="aq-check"><input type="checkbox" checked={!!prodEdit.activo} onChange={(e) => setProdEdit({ ...prodEdit, activo: e.target.checked })} /> Activo (aparece en Nuevo pedido)</label>
                      <label className="aq-check"><input type="checkbox" checked={!!prodEdit.precio_variable} onChange={(e) => setProdEdit({ ...prodEdit, precio_variable: e.target.checked })} /> Precio variable</label>
                      <label className="aq-check"><input type="checkbox" checked={!!prodEdit.requiere_factura} onChange={(e) => setProdEdit({ ...prodEdit, requiere_factura: e.target.checked })} /> Requiere factura</label>
                    </div>
                    <div className="aq-grid" style={{ marginTop: 10 }}>
                      <label>Descuento por volumen
                        <select value={prodEdit.modo_descuento_volumen || "ninguno"} onChange={(e) => setProdEdit({ ...prodEdit, modo_descuento_volumen: e.target.value })}>
                          <option value="ninguno">Ninguno</option>
                          <option value="porcentaje">Porcentaje</option>
                          <option value="tramos">Tramos (se gestionan aparte)</option>
                        </select>
                      </label>
                      {prodEdit.modo_descuento_volumen === "porcentaje" && (
                        <>
                          <label>Umbral (cant.)<input type="number" min="0" value={prodEdit.desc_volumen_umbral ?? ""} onChange={(e) => setProdEdit({ ...prodEdit, desc_volumen_umbral: e.target.value })} /></label>
                          <label>% descuento<input type="number" min="0" max="100" value={prodEdit.desc_volumen_pct ?? ""} onChange={(e) => setProdEdit({ ...prodEdit, desc_volumen_pct: e.target.value })} /></label>
                        </>
                      )}
                    </div>
                    {prodEdit.modo_descuento_volumen === "tramos" && (
                      <p className="aq-muted">Los tramos de precio se cargan en la tabla <code>precio_tramos</code> (no editable en este mantenedor todavía).</p>
                    )}
                    <button className="aq-btn" disabled={guardandoProd} onClick={guardarProducto}>
                      {guardandoProd ? "Guardando…" : (prodEdit._nuevo ? "Crear producto" : "Guardar cambios")}
                    </button>
                    {okProd && <div className={"aq-result " + (okProd.startsWith("Error") ? "bad" : "ok")}>{okProd}</div>}
                  </>
                )}
              </section>
            )}

            {/* ---------- PERFILES (admin) ---------- */}
            {mantTab === "perfiles" && rol === "admin" && (
              <section className="aq-card">
                {!perfEdit ? (
                  <>
                    <div className="aq-row-head"><h2>Perfiles de acceso</h2></div>
                    {errorPerf && <div className="aq-result bad">{errorPerf}</div>}
                    {okPerf && <div className={"aq-result " + (okPerf.startsWith("Error") ? "bad" : "ok")}>{okPerf}</div>}
                    {cargandoPerf ? (
                      <p className="aq-muted">Cargando perfiles…</p>
                    ) : (
                      <div className="aq-list">
                        {perfiles.map((p) => (
                          <div className={"aq-list-row" + (p.activo ? "" : " off")} key={p.id}>
                            <div className="aq-list-main">
                              <strong>{p.nombre || "(sin nombre)"}{session && p.id === session.user.id ? " · tú" : ""}</strong>
                              <span>rol: {p.rol}{p.activo ? "" : " · inactivo"}</span>
                            </div>
                            <span className={"aq-badge " + (p.activo ? "ok" : "warn")}>{p.activo ? "Activo" : "Inactivo"}</span>
                            <button className="aq-btn-sec" onClick={() => editarPerfil(p)}>Editar</button>
                          </div>
                        ))}
                        {perfiles.length === 0 && (
                          <p className="aq-muted">No se ven perfiles. Si esperabas ver más, falta la política RLS de lectura de admin en <code>perfiles</code> (te dejo el SQL en el chat).</p>
                        )}
                      </div>
                    )}
                    <p className="aq-muted">
                      Para <strong>crear</strong> un acceso nuevo: primero crea el usuario en Supabase (Authentication → Add user) y luego asígnale rol aquí. La creación de logins no se hace desde la app por seguridad.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="aq-row-head">
                      <h2>Editar perfil</h2>
                      <button className="aq-link" onClick={() => { setPerfEdit(null); setOkPerf(""); }}>Volver</button>
                    </div>
                    <div className="aq-grid">
                      <label>Nombre<input value={perfEdit.nombre || ""} onChange={(e) => setPerfEdit({ ...perfEdit, nombre: e.target.value })} /></label>
                      <label>Rol
                        <select value={perfEdit.rol} onChange={(e) => setPerfEdit({ ...perfEdit, rol: e.target.value })}>
                          <option value="admin">admin</option>
                          <option value="operador">operador</option>
                          <option value="gerencial">gerencial</option>
                        </select>
                      </label>
                    </div>
                    <label className="aq-check" style={{ marginTop: 12 }}>
                      <input type="checkbox" checked={!!perfEdit.activo} onChange={(e) => setPerfEdit({ ...perfEdit, activo: e.target.checked })} />
                      Perfil activo
                    </label>
                    {session && perfEdit.id === session.user.id && (
                      <p className="aq-muted">Es tu propio usuario: no puedes quitarte el rol admin ni desactivarte.</p>
                    )}
                    <button className="aq-btn" disabled={guardandoPerf} onClick={guardarPerfil}>
                      {guardandoPerf ? "Guardando…" : "Guardar cambios"}
                    </button>
                    {okPerf && <div className={"aq-result " + (okPerf.startsWith("Error") ? "bad" : "ok")}>{okPerf}</div>}
                  </>
                )}
              </section>
            )}
          </>
        )}

        {/* ===================== COBRANZAS (gestión de cobro) ===================== */}
        {credsListas && vista === "cobranzas" && rol !== "gerencial" && (
          <section className="aq-card">
            <div className="aq-row-head">
              <h2>Gestión de cobro</h2>
              <button className="aq-link" onClick={() => setVista("inicio")}>Volver</button>
            </div>
            <p className="aq-muted">Pedidos entregados con <strong>Pago = No</strong> en el formulario del chofer. Marca Cobrado y/o Recuperado, o registra un intento. Más de 3 intentos sin cobrar bloquea al cliente.</p>

            <div className="aq-subtabs" style={{ marginTop: 4 }}>
              <button className={filtroCob === "pendientes" ? "on" : ""} onClick={() => setFiltroCob("pendientes")}>Pendientes</button>
              <button className={filtroCob === "gestionados" ? "on" : ""} onClick={() => setFiltroCob("gestionados")}>Cobrados</button>
              <button className={filtroCob === "vencidos" ? "on" : ""} onClick={() => setFiltroCob("vencidos")}>+30 días</button>
              <button className={filtroCob === "todos" ? "on" : ""} onClick={() => setFiltroCob("todos")}>Todos</button>
            </div>

            <input
              className="aq-buscar-ped"
              style={{ marginTop: 8 }}
              placeholder="Buscar por cliente, RUT, guía o comuna…"
              value={buscarCob}
              onChange={(e) => setBuscarCob(e.target.value)}
            />

            {errorCob && <div className="aq-result bad" style={{ marginTop: 10 }}>{errorCob}</div>}
            {okCob && <div className="aq-result ok" style={{ marginTop: 10 }}>{okCob}</div>}

            {!cargandoCob && (cobranzas || []).length > 0 && (
              <div className="aq-cob-resumen">
                <div className="aq-cob-rcard">
                  <span>Deuda generada</span>
                  <strong>{CLP(cobResumen.generada)}</strong>
                  <em>{cobResumen.total} pedido(s) impagos</em>
                </div>
                <div className="aq-cob-rcard ok">
                  <span>Recuperado (cobrado)</span>
                  <strong>{CLP(cobResumen.cobrado)}</strong>
                  <em>{cobResumen.recCount} con bidón recuperado</em>
                </div>
                <div className="aq-cob-rcard pend">
                  <span>Pendiente</span>
                  <strong>{CLP(cobResumen.pend)}</strong>
                  <em>{cobResumen.pendCount} pedido(s)</em>
                </div>
                <div className={"aq-cob-rcard" + (cobResumen.venc > 0 ? " venc" : "")}>
                  <span>Deuda +30 días</span>
                  <strong>{CLP(cobResumen.venc)}</strong>
                  <em>{cobResumen.vencCount} pedido(s) vencidos</em>
                </div>
              </div>
            )}

            {cargandoCob ? (
              <p className="aq-muted" style={{ marginTop: 12 }}>Cargando…</p>
            ) : (cobranzas || []).length === 0 ? (
              <p className="aq-muted" style={{ marginTop: 12 }}>No hay entregas con Pago = No.</p>
            ) : cobGrupos.length === 0 ? (
              <p className="aq-muted" style={{ marginTop: 12 }}>Nada en este filtro.</p>
            ) : (
              <div className="aq-tabla" style={{ marginTop: 6 }}>
                {cobGrupos.map((g) => {
                  const cli = clientePorId[g.clienteId];
                  const abierto = !!cobExpand[g.clienteId];
                  const vencido = g.diasMax > 30;
                  return (
                    <div className="aq-cob-grupo" key={g.clienteId}>
                      <div className="aq-cob-grow" onClick={() => setCobExpand((prev) => ({ ...prev, [g.clienteId]: !prev[g.clienteId] }))}>
                        <div className="aq-cob-main">
                          <strong>{cli?.nombre || "Cliente"}{cli?.bloqueado ? " · ⚠ bloqueado" : ""}</strong>
                          <span className="aq-tr-sub">
                            {g.count} pedido(s) impago(s)
                            {g.diasMax > 0 ? " · más antiguo " + g.diasMax + " días" : ""}
                          </span>
                        </div>
                        <span className="aq-tr-monto">{CLP(g.deuda)}</span>
                        {vencido && <span className="aq-badge bad">+30 días</span>}
                        <span className="aq-hist-caret">{abierto ? "▾" : "▸"}</span>
                      </div>
                      {abierto && (
                        <div className="aq-cob-orders">
                          {g.orders.map(({ pedido: p, entrega: e }) => {
                            const dom = domPorId[p.domicilio_id];
                            const intentos = Number(p.cobro_intentos) || 0;
                            const enProceso = guardandoCob === p.id;
                            const dias = e?.gestionado_en ? Math.floor((Date.now() - new Date(e.gestionado_en).getTime()) / 86400000) : null;
                            const montoP = Number(p.monto_total) || montoEntrega(e) || 0;
                            const abonadoP = Number(p.cobro_abonado) || 0;
                            const saldoP = p.cobro_cobrado ? 0 : Math.max(0, montoP - abonadoP);
                            return (
                              <div className="aq-cob" key={p.id}>
                                <div className="aq-cob-head">
                                  <div className="aq-cob-main">
                                    <strong>{p.numero_guia || "—"}</strong>
                                    <span className="aq-tr-sub">
                                      {(dom?.comuna || e?.contact_name) ? (dom?.comuna || e?.contact_name) : ""}
                                      {e?.gestionado_en ? " · " + new Date(e.gestionado_en).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) : ""}
                                      {dias != null ? " · " + dias + " días" : ""}
                                    </span>
                                  </div>
                                  <div style={{ textAlign: "right" }}>
                                    <span className="aq-tr-monto">{CLP(montoP)}</span>
                                    {abonadoP > 0 && !p.cobro_cobrado && (
                                      <div className="aq-tr-sub">Abonado {CLP(abonadoP)} · Saldo {CLP(saldoP)}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="aq-cob-badges">
                                  <span className={"aq-badge " + (p.cobro_cobrado ? "ok" : "warn")}>{p.cobro_cobrado ? "Cobrado" : "No cobrado"}</span>
                                  {abonadoP > 0 && !p.cobro_cobrado && <span className="aq-badge">Saldo {CLP(saldoP)}</span>}
                                  <span className={"aq-badge " + (p.cobro_recuperado ? "ok" : "warn")}>{p.cobro_recuperado ? "Recuperado" : "No recuperado"}</span>
                                  <span className={"aq-badge " + (intentos > 3 ? "bad" : "")}>Intentos: {intentos}</span>
                                </div>
                                {cobroRespaldoPedido === p.id && (
                                  <div className="aq-fact-acciones" style={{ marginTop: 8 }}>
                                    <input
                                      type="file"
                                      accept="image/*,application/pdf"
                                      title="Comprobante de pago (opcional)"
                                      onChange={(e) => setCobroRespaldoArchivo(e.target.files?.[0] || null)}
                                    />
                                    <button className="aq-btn-sec" disabled={enProceso} onClick={() => marcarCobradoConRespaldo(p, cobroRespaldoArchivo)}>
                                      {enProceso ? "Guardando…" : "Confirmar cobrado"}
                                    </button>
                                    <button className="aq-link" onClick={() => { setCobroRespaldoPedido(null); setCobroRespaldoArchivo(null); }}>Cancelar</button>
                                  </div>
                                )}
                                <div className="aq-cob-acts">
                                  <button className={"aq-btn-sec" + (p.cobro_cobrado ? " on" : "")} disabled={enProceso} onClick={() => marcarCobroCampo(p, "cobro_cobrado")}>
                                    {p.cobro_cobrado ? "✓ Cobrado" : "Marcar cobrado"}
                                  </button>
                                  {p.cobro_cobrado && p.cobro_respaldo_path && (
                                    <button className="aq-link" onClick={() => verRespaldoCobro(p.cobro_respaldo_path)}>Ver comprobante</button>
                                  )}
                                  <button className="aq-btn-sec" disabled={enProceso || p.cobro_cobrado || saldoP <= 0} onClick={() => abrirAbono("cobro", { numero_guia: p.numero_guia, pedidoId: p.id, monto_total: montoP, cobro_abonado: abonadoP, saldo: saldoP, titulo: clientePorId[p.cliente_id]?.nombre || p.numero_guia })}>
                                    + Abono
                                  </button>
                                  <button className={"aq-btn-sec" + (p.cobro_recuperado ? " on" : "")} disabled={enProceso} onClick={() => marcarCobroCampo(p, "cobro_recuperado")}>
                                    {p.cobro_recuperado ? "✓ Recuperado" : "Marcar recuperado"}
                                  </button>
                                  <button className="aq-btn-sec" disabled={enProceso || p.cobro_cobrado} onClick={() => registrarIntento(p)}>
                                    + Intento de cobro
                                  </button>
                                  <button className="aq-link" onClick={() => abrirPedidoModal(p)}>Ver detalle</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ===================== NUEVO PEDIDO ===================== */}
        {credsListas && !cargando && !errorCarga && vista === "nuevo" && (
          <>
            {/* Nº de pedido reservado */}
            <section className="aq-card aq-num-reserva">
              <div className="aq-num-main">
                <span className="aq-num-label">Nº de pedido</span>
                <strong className={"aq-num-valor" + (numeroReservado ? "" : " aq-num-pend")}>
                  {numeroReservado || (reservandoNum ? "Reservando…" : "—")}
                </strong>
              </div>
              <div className="aq-num-side">
                {errorReserva
                  ? <span className="aq-num-err">{errorReserva}</span>
                  : <span className="aq-mini">Reservado al iniciar. Úsalo como referencia para emitir el DTE antes de guardar.</span>}
                <button className="aq-link" disabled={reservandoNum} onClick={() => reservarNumero({ forzar: true })}>
                  {errorReserva ? "Reintentar" : (numeroReservado ? "Reservar otro" : "Reservar")}
                </button>
              </div>
            </section>

            {/* Cliente */}
            <section className="aq-card">
              <h2>Cliente</h2>
              {!cliente ? (
                <div className="aq-search">
                  <input
                    placeholder="Buscar por nombre, RUT o código"
                    value={buscarCliente}
                    onChange={(e) => setBuscarCliente(e.target.value)}
                    autoFocus
                  />
                  {resultadosBusqueda.length > 0 && (
                    <ul className="aq-results">
                      {resultadosBusqueda.map((r) => (
                        <li
                          key={r.cliente.id + "|" + (r.dom?.id || "")}
                          onClick={() => elegirCliente(r.cliente, r.dom?.id)}
                          className={r.cliente.bloqueado ? "aq-li-alerta" : ""}
                        >
                          <strong>{r.cliente.bloqueado ? "⚠ " : ""}{r.cliente.nombre}</strong>
                          <span>
                            {r.dom?.identificador_dt
                              ? r.dom.identificador_dt + " · " + (r.dom.etiqueta || r.dom.direccion || "")
                              : (r.cliente.rut || r.cliente.codigo_cliente)}
                            {r.cliente.es_empresa ? " · empresa" : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <>
                  <div className="aq-chosen">
                    <div>
                      <strong>{cliente.nombre}</strong>
                      <span>{cliente.rut || cliente.codigo_cliente}{cliente.es_empresa ? " · empresa" : ""}</span>
                      {rol === "distribuidor" && (
                        <span className="aq-mini">Datos fijos del distribuidor · {distChofer}{distIdentDt ? " · " + distIdentDt : ""}</span>
                      )}
                    </div>
                    {rol !== "distribuidor" && (
                      <button className="aq-link" onClick={() => { setCliente(null); setItems([]); setDescuentos([]); setAvisoRepetir(""); setAvisoDeuda(null); setSemaforoCli(null); setAvisoBidones(null); }}>
                        Cambiar
                      </button>
                    )}
                  </div>
                  {!emailValido(cliente.email) && (
                    <div className="aq-email-alert">
                      <strong>⚠ Sin email registrado</strong>
                      <p>Agrega un correo para enviarle la confirmación del pedido.</p>
                      <div className="aq-email-add">
                        <input
                          type="email"
                          placeholder="correo@cliente.cl"
                          value={emailNuevo}
                          onChange={(e) => setEmailNuevo(e.target.value)}
                        />
                        <button className="aq-btn-sec" disabled={!emailValido(emailNuevo) || guardandoEmail} onClick={guardarEmailCliente}>
                          {guardandoEmail ? "…" : "Guardar email"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            {cliente && cliente.bloqueado && (
              <div className="aq-alerta-cliente">
                <strong>⚠ Cliente con alerta</strong>
                <p>{cliente.motivo_bloqueo || "Cliente marcado para revisión."}</p>
                <span>Revisa antes de continuar con el pedido.</span>
              </div>
            )}

            {cliente && !cliente.bloqueado && avisoDeuda && (
              <div className="aq-alerta-deuda">
                <strong>⚠ Deuda pendiente</strong>
                <p>Este cliente tiene {avisoDeuda.guias.length} entrega(s) sin pagar por {CLP(avisoDeuda.monto)} (guía(s): {avisoDeuda.guias.join(", ")}).</p>
                <span>Puedes continuar, pero conviene gestionarlo en Cobranzas.</span>
              </div>
            )}

            {cliente && avisoBidones && (
              <div className="aq-alerta-bidon">
                <strong>🧴 Bidones pendientes de retiro</strong>
                <p>Este cliente tiene {avisoBidones.cantidad} bidón(es) vacío(s) marcados para retirar en su próximo pedido (guía(s): {avisoBidones.guias.join(", ")}).</p>
                <span>Coordina el retiro con el chofer en esta entrega.</span>
              </div>
            )}

            {cliente && semaforoCli && (
              <div className={"aq-semaforo " + semaforoCli.cls} style={{ marginBottom: 14 }}>
                <span className="aq-sem-dot" />
                Comportamiento de pago: {semaforoCli.label}
              </div>
            )}

            {cliente && semaforoCli && semaforoCli.moroso && (
              <div className="aq-alerta-cliente" style={{ marginTop: -4 }}>
                <strong>⚠ Cliente moroso — exigir pago anticipado</strong>
                <p>Este cliente tiene historial de mora (más de 15 días en pagar). Se recomienda cobrar por adelantado antes de despachar.</p>
              </div>
            )}

            {cliente && (
              <>
                {/* Repetir última compra (Bloque 5) */}
                <section className="aq-card aq-repetir">
                  <div className="aq-repetir-row">
                    <div>
                      <strong>Repetir última compra</strong>
                      <p className="aq-muted">Carga productos, cantidades, domicilio y forma de pago del último pedido de este cliente.</p>
                    </div>
                    <button className="aq-btn-sec" disabled={repitiendo} onClick={repetirUltimaCompra}>
                      {repitiendo ? "Cargando…" : "↻ Repetir"}
                    </button>
                  </div>
                  {avisoRepetir && (
                    <div className={"aq-result " + (avisoRepetir.startsWith("Error") ? "bad" : "ok")} style={{ marginTop: 10 }}>
                      {avisoRepetir}
                    </div>
                  )}
                </section>

                {/* Domicilio */}
                <section className="aq-card">
                  <h2>Domicilio de entrega</h2>
                  {domicilios.length === 0 ? (
                    <p className="aq-muted">Este cliente no tiene domicilios cargados.</p>
                  ) : (
                    <select value={domicilioId} onChange={(e) => setDomicilioId(e.target.value)}>
                      {domicilios.map((d) => (
                        <option key={d.id} value={d.id}>
                          {(d.etiqueta ? d.etiqueta + " · " : "") + (d.identificador_dt ? d.identificador_dt + " · " : "") + d.direccion + (d.comuna ? ", " + d.comuna : "")}
                          {d.es_principal ? " (principal)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </section>

                {/* Plan prepago */}
                {planPrepago && (
                  <section className="aq-card aq-plan">
                    <h2>Plan prepago activo</h2>
                    <p>
                      Saldo disponible: <strong>{planPrepago.unidades_saldo} recargas</strong>
                      {planPrepago.fecha_vencimiento ? ` · vence ${planPrepago.fecha_vencimiento}` : ""}
                    </p>
                    <label className="aq-check">
                      <input type="checkbox" checked={consumePlan} onChange={(e) => setConsumePlan(e.target.checked)} />
                      Consumir saldo del plan en este pedido
                    </label>
                    {consumePlan && (
                      <p className="aq-muted">
                        Este pedido descuenta <strong>{unidadesPlan}</strong> recarga(s) R20 del saldo.
                      </p>
                    )}
                  </section>
                )}

                {/* Productos */}
                {rol !== "distribuidor" && (
                <section className="aq-card">
                  <div className="aq-row-head">
                    <h2>Productos</h2>
                    <button className="aq-btn-sec" onClick={agregarItem}>+ Agregar línea</button>
                  </div>
                  {items.length === 0 ? (
                    <p className="aq-muted">Agrega los productos del pedido.</p>
                  ) : (
                    <div className="aq-items">
                      {items.map((it) => {
                        const prod = productos.find((p) => p.id === it.producto_id);
                        const variable = prod?.precio_variable;
                        return (
                          <div className="aq-item" key={it.key}>
                            <select value={it.producto_id} onChange={(e) => cambiarProducto(it.key, e.target.value)}>
                              {productos.map((p) => (
                                <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>
                              ))}
                            </select>
                            <input
                              className="aq-num"
                              type="number"
                              min="0"
                              step="1"
                              value={it.cantidad}
                              onChange={(e) => cambiarCantidad(it.key, Number(e.target.value))}
                              aria-label="Cantidad"
                            />
                            <input
                              className="aq-num"
                              type="number"
                              min="0"
                              value={it.precio_unit}
                              onChange={(e) => cambiarPrecio(it.key, Number(e.target.value))}
                              aria-label="Precio unitario"
                              title={variable ? "Precio editable" : "Precio sugerido (editable)"}
                            />
                            <span className="aq-sub">{CLP(Math.round((it.cantidad || 0) * (it.precio_unit || 0)))}</span>
                            <button className="aq-x" onClick={() => quitarItem(it.key)} aria-label="Quitar">×</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
                )}

                {/* Descuentos */}
                {rol !== "distribuidor" && (
                <section className="aq-card">
                  <div className="aq-row-head">
                    <h2>Descuentos</h2>
                    <button className="aq-btn-sec" onClick={() => agregarDescuento()}>+ Agregar</button>
                  </div>
                  {descCliente.length > 0 && (
                    <div className="aq-suggest">
                      <span className="aq-muted">Sugeridos del cliente:</span>
                      {descCliente.map((d) => (
                        <button
                          key={d.id}
                          className="aq-chip"
                          onClick={() => agregarDescuento({ origen: "cliente", descripcion: d.motivo || d.tipo, monto: d.valor })}
                        >
                          {(d.motivo || d.tipo)} · {CLP(d.valor)}
                        </button>
                      ))}
                    </div>
                  )}
                  {descuentos.map((d) => (
                    <div className="aq-desc" key={d.key}>
                      <select value={d.origen} onChange={(e) => cambiarDescuento(d.key, "origen", e.target.value)}>
                        {ORIGENES_DESC.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <input
                        placeholder="Descripción"
                        value={d.descripcion}
                        onChange={(e) => cambiarDescuento(d.key, "descripcion", e.target.value)}
                      />
                      <input
                        className="aq-num"
                        type="number"
                        min="0"
                        value={d.monto}
                        onChange={(e) => cambiarDescuento(d.key, "monto", Number(e.target.value))}
                        aria-label="Monto"
                      />
                      <button className="aq-x" onClick={() => quitarDescuento(d.key)} aria-label="Quitar">×</button>
                    </div>
                  ))}
                </section>
                )}

                {/* Documento y pago */}
                {rol !== "distribuidor" && (
                <section className="aq-card">
                  <h2>Documento y pago</h2>
                  <div className="aq-grid">
                    <label>
                      Documento
                      <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)}>
                        {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    <label>
                      Forma de pago
                      <select value={tipoPago} onChange={(e) => setTipoPago(e.target.value)} disabled={consumePlan}>
                        {TIPOS_PAGO.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    {tipoDocumento === "factura" && (
                      <label>
                        RUT facturación
                        <input value={rutFactura} onChange={(e) => setRutFactura(e.target.value)} placeholder="76.123.456-7" />
                      </label>
                    )}
                    <label>
                      Marca
                      <select value={marca} onChange={(e) => setMarca(e.target.value)}>
                        <option value="">—</option>
                        {MARCAS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </label>
                  </div>
                </section>
                )}

                {/* Entrega y notas */}
                {rol !== "distribuidor" && (
                <section className="aq-card">
                  <h2>Entrega</h2>
                  <div className="aq-grid">
                    <label>
                      Desde
                      <input type="datetime-local" value={fechaMin} onChange={(e) => setFechaMin(e.target.value)} />
                    </label>
                    <label>
                      Hasta
                      <input type="datetime-local" value={fechaMax} onChange={(e) => setFechaMax(e.target.value)} />
                    </label>
                    <label>
                      Chofer
                      <select value={creadoPor} onChange={(e) => setCreadoPor(e.target.value)} disabled={rol === "distribuidor"}>
                        <option value="">— Sin asignar —</option>
                        {(rol === "distribuidor" && distChofer && !CHOFERES.includes(distChofer)
                          ? [distChofer, ...CHOFERES]
                          : CHOFERES).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label>
                      N° DTE
                      <input value={nroDte} onChange={(e) => setNroDte(e.target.value)} placeholder="Ej: 1234" />
                    </label>
                  </div>
                  <label className="aq-full">
                    Observación
                    <textarea rows="2" value={observacion} onChange={(e) => setObservacion(e.target.value)} />
                  </label>
                </section>
                )}

                {/* Resumen */}
                <section className="aq-card aq-resumen">
                  {rol !== "distribuidor" && (
                    <>
                      <div className="aq-tot">
                        <span>Subtotal</span><span>{CLP(subtotal)}</span>
                      </div>
                      {totalDesc > 0 && (
                        <div className="aq-tot aq-tot-desc">
                          <span>Descuentos</span><span>−{CLP(totalDesc)}</span>
                        </div>
                      )}
                      <div className="aq-tot aq-tot-total">
                        <span>Total</span><span>{CLP(montoTotal)}</span>
                      </div>
                    </>
                  )}

                  {errorValidacion && <p className="aq-hint">{errorValidacion}</p>}

                  <button className="aq-btn" disabled={!!errorValidacion || guardando} onClick={guardarPedido}>
                    {guardando
                      ? (rol === "distribuidor" ? "Generando…" : "Guardando…")
                      : (rol === "distribuidor" ? "Generar Correlativo DT" : "Guardar pedido")}
                  </button>

                  {resultado && (
                    <div className={"aq-result " + (resultado.ok ? "ok" : "bad")}>
                      {resultado.msg}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
        {/* ===================== POPUP DETALLE / EDITAR PEDIDO ===================== */}
        {pedidoModal && (
          <div className="aq-modal-ov" onClick={() => setPedidoModal(null)}>
            <div className="aq-modal" onClick={(e) => e.stopPropagation()}>
              <div className="aq-modal-head">
                <div>
                  <strong>{pedidoModal.pedido.numero_guia || "Pedido"}</strong>
                  <span className="aq-tr-sub">
                    {(clientePorId[pedidoModal.pedido.cliente_id]?.nombre || "")}
                    {" · "}{CLP(pedidoModal.pedido.monto_total)}
                    {pedidoModal.pedido.por_cobrar ? " · Por cobrar" : ""}
                  </span>
                </div>
                <button className="aq-link" onClick={() => setPedidoModal(null)}>Cerrar ✕</button>
              </div>

              {/* Entrega DT */}
              {renderEntregaDT(pedidoModal.entrega)}

              {/* Editor de pedido (admin y operador) */}
              {pedidoEdit && (
                <div className="aq-modal-edit">
                  <strong>Editar pedido</strong>
                  <div className="aq-grid" style={{ marginTop: 10, gap: 8 }}>
                    <label>
                      Tipo de pago
                      <select value={pedidoEdit.tipo_pago} onChange={(e) => setPedidoEdit({ ...pedidoEdit, tipo_pago: e.target.value })}>
                        {TIPOS_PAGO.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    <label>
                      Tipo de documento
                      <select value={pedidoEdit.tipo_documento} onChange={(e) => setPedidoEdit({ ...pedidoEdit, tipo_documento: e.target.value })}>
                        {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    <label className="aq-full">
                      Observación
                      <input type="text" value={pedidoEdit.observacion} onChange={(e) => setPedidoEdit({ ...pedidoEdit, observacion: e.target.value })} placeholder="Ej: cliente pagó con transferencia el 15/06" />
                    </label>
                  </div>

                  {/* Items editables */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <strong style={{ fontSize: 13, color: "var(--navy)" }}>Productos / items</strong>
                      <button className="aq-link" style={{ fontSize: 12 }} onClick={() => setItemsModal((prev) => [...prev, { _key: Date.now(), nombre: "", codigo: "", cantidad: 1, precio_unit: 0, producto_id: null }])}>
                        + Agregar ítem
                      </button>
                    </div>
                    {itemsModal.map((l, idx) => (
                      <div key={l._key} className="aq-items-edit-row">
                        <input
                          value={l.nombre} placeholder="Nombre del producto"
                          style={{ flex: 2 }}
                          onChange={(e) => setItemsModal((prev) => prev.map((x, i) => i === idx ? { ...x, nombre: e.target.value } : x))}
                        />
                        <input
                          type="number" min="0" value={l.cantidad} placeholder="Qty"
                          style={{ width: 54 }}
                          onChange={(e) => setItemsModal((prev) => prev.map((x, i) => i === idx ? { ...x, cantidad: Number(e.target.value) } : x))}
                        />
                        <input
                          type="number" min="0" value={l.precio_unit} placeholder="$ unit"
                          style={{ width: 90 }}
                          onChange={(e) => setItemsModal((prev) => prev.map((x, i) => i === idx ? { ...x, precio_unit: Number(e.target.value) } : x))}
                        />
                        <span style={{ fontSize: 13, color: "var(--mid)", minWidth: 70, textAlign: "right" }}>
                          {CLP((l.cantidad || 0) * (l.precio_unit || 0))}
                        </span>
                        <button className="aq-link" style={{ color: "var(--bad)", fontSize: 20, lineHeight: 1, padding: "0 4px" }} onClick={() => setItemsModal((prev) => prev.filter((_, i) => i !== idx))}>×</button>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 15, fontWeight: 700, color: "var(--navy)", marginTop: 8, gap: 8 }}>
                      <span>Total:</span>
                      <span>{CLP(itemsModal.reduce((s, l) => s + (l.cantidad || 0) * (l.precio_unit || 0), 0))}</span>
                    </div>
                  </div>

                  {errPed && <div className="aq-result bad" style={{ marginTop: 8 }}>{errPed}</div>}
                  {okPed && <div className="aq-result ok" style={{ marginTop: 8 }}>{okPed}</div>}
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button className="aq-btn" style={{ flex: 1 }} disabled={guardandoPed} onClick={guardarPedidoEdit}>
                      {guardandoPed ? "Guardando…" : "Guardar cambios"}
                    </button>
                    <button className="aq-btn-sec" style={{ flex: 1 }} disabled={enviandoDT} onClick={forzarEnvioDT} title="Reenvía a DispatchTrack con los datos actualizados">
                      {enviandoDT ? "Enviando…" : "🔄 Forzar envío a DT"}
                    </button>
                  </div>
                  <p className="aq-mini" style={{ marginTop: 6 }}>
                    {pedidoModal.pedido.estado_sync === "enviado_dt"
                      ? "✓ Ya enviado a DT" + (pedidoModal.pedido.enviado_at ? " · " + new Date(pedidoModal.pedido.enviado_at).toLocaleString("es-CL") : "")
                      : "⚠ Pendiente de envío a DispatchTrack"}
                  </p>
                </div>
              )}

              {/* Gestión de cobro si corresponde */}
              {esPagoNo(pedidoModal.entrega) && (
                <div className="aq-modal-cobro">
                  <strong>{pedidoModal.pedido.cobro_cobrado ? "✓ Deuda cobrada" : "⚠ Entregado sin pago — por cobrar"}</strong>
                  <div className="aq-cob-badges" style={{ marginTop: 6 }}>
                    <span className={"aq-badge " + (pedidoModal.pedido.cobro_cobrado ? "ok" : "warn")}>{pedidoModal.pedido.cobro_cobrado ? "Cobrado" : "No cobrado"}</span>
                    <span className={"aq-badge " + (pedidoModal.pedido.cobro_recuperado ? "ok" : "warn")}>{pedidoModal.pedido.cobro_recuperado ? "Recuperado" : "No recuperado"}</span>
                    <span className="aq-badge">Intentos: {Number(pedidoModal.pedido.cobro_intentos) || 0}</span>
                  </div>
                  <button className="aq-btn-sec" style={{ marginTop: 10 }} onClick={() => { setPedidoModal(null); abrirCobranzas(); }}>
                    Ir a gestión de cobro →
                  </button>
                  {pedidoModal.pedido.cobro_cobrado && pedidoModal.pedido.cobro_respaldo_path && (
                    <button className="aq-link" style={{ marginTop: 6, display: "block" }} onClick={() => verRespaldoCobro(pedidoModal.pedido.cobro_respaldo_path)}>Ver comprobante</button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap');
* { box-sizing: border-box; }
.aq { --navy:#1B2F6E; --blue:#5B8DB8; --ink:#1d2433; --muted:#6b7686; --line:#e3e8f0; --bg:#f4f6fb; --ok:#1f7a4d; --bad:#b3261e;
  font-family:'Hanken Grotesk',system-ui,sans-serif; color:var(--ink); background:var(--bg); min-height:100vh; }
.aq-header { background:var(--navy); color:#fff; padding:18px 20px; }
.aq-brand { display:flex; align-items:center; gap:14px; }
.aq-mark { font-size:30px; color:var(--blue); line-height:1; }
.aq-header h1 { font-family:'Fraunces',serif; font-weight:600; font-size:22px; margin:0; letter-spacing:.2px; }
.aq-header p { margin:0; font-size:13px; color:#c5d2e8; }
.aq-main { max-width:1200px; margin:0 auto; padding:18px 24px 60px; display:flex; flex-direction:column; gap:14px; }
.aq-card { background:#fff; border:1px solid var(--line); border-radius:14px; padding:16px 18px; }
.aq-card h2 { font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--navy); margin:0 0 12px; font-weight:700; }
.aq-row-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
.aq-row-head h2 { margin:0; }
.aq-muted { color:var(--muted); font-size:14px; margin:4px 0 0; }
input, select, textarea { font-family:inherit; font-size:15px; width:100%; padding:10px 12px; border:1px solid var(--line);
  border-radius:9px; background:#fff; color:var(--ink); }
input:focus, select:focus, textarea:focus { outline:2px solid var(--blue); outline-offset:0; border-color:var(--blue); }
.aq-search { position:relative; }
.aq-results { list-style:none; margin:6px 0 0; padding:6px; border:1px solid var(--line); border-radius:10px; background:#fff;
  position:absolute; left:0; right:0; z-index:5; box-shadow:0 8px 24px rgba(27,47,110,.12); }
.aq-results li { padding:9px 10px; border-radius:7px; cursor:pointer; display:flex; flex-direction:column; }
.aq-results li:hover { background:var(--bg); }
.aq-results li span { font-size:12px; color:var(--muted); }
.aq-li-alerta strong { color:var(--bad); }
.aq-alerta-cliente { background:#fdecea; border:1px solid #f3b4ad; border-left:4px solid var(--bad); border-radius:12px; padding:14px 16px; }
.aq-alerta-cliente strong { color:var(--bad); display:block; font-size:14px; }
.aq-alerta-cliente p { margin:6px 0 4px; color:var(--ink); font-size:15px; font-weight:600; }
.aq-alerta-cliente span { font-size:13px; color:var(--muted); }
.aq-chosen { display:flex; justify-content:space-between; align-items:center; }
.aq-chosen strong { display:block; }
.aq-chosen span { font-size:13px; color:var(--muted); }
.aq-link { background:none; border:none; color:var(--blue); font:inherit; cursor:pointer; text-decoration:underline; }
.aq-plan { border-color:var(--blue); background:#f3f8fc; }
.aq-plan p { margin:0 0 10px; font-size:14px; }
.aq-check { display:flex; align-items:center; gap:8px; font-size:14px; cursor:pointer; }
.aq-check input { width:auto; }
.aq-items { display:flex; flex-direction:column; gap:8px; }
.aq-item { display:grid; grid-template-columns: 1fr 70px 92px 84px 28px; gap:8px; align-items:center; }
.aq-item-ficha { display:flex; align-items:center; gap:10px; font-size:12px; color:var(--muted); margin:2px 0 6px; }
.aq-item-ficha .aq-check { font-size:12px; }
.aq-item-ficha .aq-link { font-size:12px; }
.aq-num { text-align:right; }
.aq-sub { font-size:14px; font-weight:600; text-align:right; }
.aq-x { width:28px; height:28px; border-radius:7px; border:1px solid var(--line); background:#fff; color:var(--bad);
  font-size:18px; line-height:1; cursor:pointer; padding:0; }
.aq-x:hover { background:#fdecea; }
.aq-btn-sec { background:#fff; border:1px solid var(--blue); color:var(--navy); font:inherit; font-weight:600; font-size:13px;
  padding:7px 12px; border-radius:9px; cursor:pointer; }
.aq-btn-sec:hover { background:#eef4fa; }
.aq-suggest { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:10px; }
.aq-chip { border:1px dashed var(--blue); background:#f3f8fc; color:var(--navy); font:inherit; font-size:12px; padding:5px 10px;
  border-radius:20px; cursor:pointer; }
.aq-desc { display:grid; grid-template-columns: 120px 1fr 100px 28px; gap:8px; align-items:center; margin-top:8px; }
.aq-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.aq-grid label, .aq-full { display:flex; flex-direction:column; gap:5px; font-size:13px; color:var(--muted); font-weight:500; }
.aq-full { margin-top:12px; }
.aq-resumen { position:sticky; bottom:0; }
.aq-tot { display:flex; justify-content:space-between; font-size:15px; padding:4px 0; }
.aq-tot-desc { color:var(--bad); }
.aq-tot-total { font-size:19px; font-weight:700; color:var(--navy); border-top:1px solid var(--line); margin-top:6px; padding-top:10px; }
.aq-hint { color:var(--bad); font-size:13px; margin:8px 0 0; }
.aq-btn { width:100%; margin-top:14px; background:var(--navy); color:#fff; border:none; font:inherit; font-weight:700; font-size:16px;
  padding:14px; border-radius:11px; cursor:pointer; }
.aq-btn:hover:not(:disabled) { background:#16265a; }
.aq-btn:disabled { opacity:.5; cursor:not-allowed; }
.aq-result { margin-top:12px; padding:11px 13px; border-radius:9px; font-size:14px; }
.aq-result.ok { background:#e8f5ee; color:var(--ok); }
.aq-result.bad { background:#fdecea; color:var(--bad); }
.aq-warn { background:#fff7e6; border-color:#f0d8a0; color:#7a5a00; }
.aq-error { background:#fdecea; border-color:#f3c4bf; color:var(--bad); }
code { background:#eef1f7; padding:1px 5px; border-radius:5px; font-size:13px; }

/* Logo + navegación */
.aq-logo { width:42px; height:42px; border-radius:10px; background:#fff; object-fit:contain; padding:3px; }
.aq-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:14px 24px; }
.aq-nav { display:flex; gap:6px; max-width:760px; }
.aq-nav button { background:rgba(255,255,255,.12); color:#dce6f6; border:none; font:inherit; font-weight:600; font-size:13px;
  padding:7px 13px; border-radius:9px; cursor:pointer; }
.aq-nav button:hover { background:rgba(255,255,255,.2); }
.aq-nav button.on { background:#fff; color:var(--navy); }
.aq-user { display:flex; align-items:center; gap:8px; color:#c5d2e8; font-size:12px; margin-left:6px; }
.aq-logout { background:rgba(255,255,255,.12); color:#fff; border:none; font:inherit; font-size:12px; font-weight:600;
  padding:6px 11px; border-radius:8px; cursor:pointer; }
.aq-logout:hover { background:rgba(255,255,255,.24); }

/* Login */
.aq-login-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
.aq-login { background:#fff; border:1px solid var(--line); border-radius:16px; padding:28px 26px; width:100%; max-width:360px;
  display:flex; flex-direction:column; text-align:center; }
.aq-logo-big { width:84px; height:84px; object-fit:contain; margin:0 auto 8px; }
.aq-login h1 { font-family:'Fraunces',serif; font-weight:600; font-size:24px; color:var(--navy); margin:0; }
.aq-login-sub { color:var(--muted); font-size:14px; margin:2px 0 18px; }
.aq-login label { text-align:left; margin-top:0; margin-bottom:12px; }
.aq-login .aq-btn { margin-top:4px; }

/* Período */
.aq-period { display:flex; align-items:center; justify-content:space-between; }
.aq-per-nav { width:38px; height:38px; border-radius:9px; border:1px solid var(--line); background:#fff; color:var(--navy);
  font-size:22px; line-height:1; cursor:pointer; }
.aq-per-nav:disabled { opacity:.4; cursor:not-allowed; }
.aq-per-label { text-align:center; }
.aq-per-label span { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
.aq-per-label strong { font-family:'Fraunces',serif; font-size:20px; color:var(--navy); }

/* KPIs (clicables = filtro) */
.aq-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
.aq-kpi { background:#fff; border:1px solid var(--line); border-radius:14px; padding:14px; text-align:left; }
.aq-kpi span { display:block; font-size:12px; color:var(--muted); margin-bottom:2px; }
.aq-kpi strong { font-family:'Fraunces',serif; font-size:26px; color:var(--navy); line-height:1; }
.aq-kpi-btn { cursor:pointer; font:inherit; transition:border-color .12s, box-shadow .12s; }
.aq-kpi-btn:hover { border-color:var(--blue); }
.aq-kpi-btn.on { border-color:var(--navy); box-shadow:inset 0 0 0 1px var(--navy); }
.aq-kpi-btn.on::after { content:""; display:block; height:3px; width:24px; background:var(--navy); border-radius:2px; margin-top:8px; }

/* Tarjetas de monto */
.aq-money { display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-top:10px; }
.aq-money-card { border-radius:14px; padding:16px 18px; }
.aq-money-card span { display:block; font-size:12px; margin-bottom:2px; }
.aq-money-card strong { font-family:'Fraunces',serif; font-size:28px; line-height:1; }
.aq-money-card.navy { background:var(--navy); }
.aq-money-card.navy span { color:#c5d2e8; }
.aq-money-card.navy strong { color:#fff; }
.aq-money-card.cobrar { background:#fff7e6; border:1px solid #f0d8a0; }
.aq-money-card.cobrar span { color:#7a5a00; }
.aq-money-card.cobrar strong { color:#8a6400; }

/* Dashboard gerencial: grilla y gráficos de barras */
.aq-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.aq-bars { display:flex; align-items:flex-end; gap:10px; height:200px; padding-top:8px; }
.aq-bar-col { flex:1; display:flex; flex-direction:column; align-items:center; height:100%; }
.aq-bar-val { font-size:11px; color:var(--muted); height:16px; white-space:nowrap; }
.aq-bar-track { flex:1; width:100%; display:flex; align-items:flex-end; }
.aq-bar-fill { width:100%; background:var(--navy); border-radius:7px 7px 0 0; min-height:3px; transition:height .3s; }
.aq-bar-lab { font-size:12px; font-weight:600; color:var(--ink); margin-top:6px; }
.aq-bar-sub { font-size:11px; color:var(--muted); }
/* Evolución combinada (barras de ingresos + línea de pedidos) */
.aq-evol-leg { display:flex; gap:18px; font-size:12px; color:var(--muted); margin-bottom:8px; }
.aq-evol-leg-i { display:flex; align-items:center; gap:6px; }
.aq-evol-sw { width:12px; height:12px; display:inline-block; }
.aq-evol-sw.bar { background:var(--navy); border-radius:3px; }
.aq-evol-sw.line { background:#0fae8e; border-radius:50%; }
.aq-evol-svg { display:block; width:100%; height:auto; }
.aq-evol-axis { stroke:var(--line); stroke-width:1; }
.aq-evol-bar { fill:var(--navy); }
.aq-evol-vbar { fill:var(--navy); font-size:10px; font-weight:600; text-anchor:middle; }
.aq-evol-xlab { fill:var(--ink); font-size:11px; font-weight:600; text-anchor:middle; }
.aq-evol-xsub { fill:var(--muted); font-size:10px; text-anchor:middle; }
.aq-evol-pline { fill:none; stroke:#0fae8e; stroke-width:2.5; stroke-linejoin:round; }
.aq-evol-dot { fill:#0fae8e; stroke:#fff; stroke-width:1.5; }
/* Encabezado de tarjeta con control y toggle torta/barras */
.aq-card-head { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px; }
.aq-card-head h2 { margin:0; }
.aq-toggle { display:inline-flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
.aq-toggle button { border:none; background:#fff; color:var(--muted); font-size:12px; padding:5px 11px; cursor:pointer; }
.aq-toggle button.on { background:var(--navy); color:#fff; }
/* Mix como dona */
.aq-torta { display:flex; gap:18px; align-items:center; flex-wrap:wrap; }
.aq-torta-svg { position:relative; width:140px; height:140px; flex:0 0 auto; }
.aq-torta-centro { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; }
.aq-torta-centro strong { font-family:'Fraunces',serif; font-size:24px; color:var(--navy); line-height:1; }
.aq-torta-centro span { font-size:11px; color:var(--muted); }
.aq-torta-leg { flex:1 1 220px; min-width:200px; display:flex; flex-direction:column; }
.aq-torta-leg-i { display:flex; align-items:center; gap:8px; font-size:13px; padding:5px 0; border-bottom:0.5px solid var(--line); }
.aq-torta-leg-i:last-child { border-bottom:none; }
.aq-torta-pt { width:11px; height:11px; border-radius:3px; flex:0 0 auto; }
.aq-torta-nom { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.aq-torta-pct { font-weight:600; color:var(--navy); }
.aq-torta-det { color:var(--muted); font-size:12px; white-space:nowrap; }
.aq-hbars { display:flex; flex-direction:column; gap:11px; }
.aq-hbar-head { display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:4px; }
.aq-hbar-name { font-size:13px; color:var(--ink); font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.aq-hbar-num { font-size:12px; color:var(--muted); white-space:nowrap; }
.aq-hbar-track { background:var(--bg); border-radius:6px; height:12px; overflow:hidden; }
.aq-hbar-fill { height:100%; background:var(--blue); border-radius:6px; min-width:3px; transition:width .3s; }
.aq-hbar-fill.alt { background:#5dbf9e; }
/* Mapa de comunas (Leaflet) */
.aq-mapa { height:340px; width:100%; border-radius:12px; overflow:hidden; border:1px solid var(--line); z-index:0; }
.aq-mapa .leaflet-container { font:inherit; }
.aq-comuna-list { display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; }
.aq-comuna-chip { font-size:12px; background:#f0f7ff; border:1px solid var(--line); border-radius:999px; padding:3px 10px; color:var(--ink); }
.aq-comuna-chip strong { color:var(--navy); margin-left:2px; }
/* Encabezado del Nº de pedido reservado */
.aq-num-reserva { display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap; background:#f0f7ff; border:1px solid #cfe2ff; }
.aq-num-main { display:flex; flex-direction:column; }
.aq-num-label { font-size:12px; color:var(--muted); }
.aq-num-valor { font-family:'Fraunces',serif; font-size:30px; color:var(--navy); line-height:1.1; letter-spacing:.5px; }
.aq-num-valor.aq-num-pend { color:var(--muted); }
.aq-num-side { display:flex; flex-direction:column; align-items:flex-end; gap:4px; text-align:right; }
.aq-num-err { color:var(--bad); font-size:12px; max-width:280px; }
@media (max-width:700px) { .aq-grid2 { grid-template-columns:1fr; } }

/* Buscador de pedidos */
.aq-buscar-ped { margin-bottom:10px; }

/* Tabla de pedidos */
.aq-tabla { display:flex; flex-direction:column; }
.aq-tr { display:grid; grid-template-columns:1fr auto 110px 70px; gap:10px; align-items:center; padding:11px 4px;
  border-bottom:1px solid var(--line); font-size:14px; }
.aq-tr:last-child { border-bottom:none; }
.aq-tr:hover { background:var(--bg); }
.aq-tr-main { min-width:0; }
.aq-tr-main strong { display:block; color:var(--ink); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.aq-tr-sub { font-size:12px; color:var(--muted); }
.aq-tr-fecha { font-size:13px; color:var(--muted); white-space:nowrap; }
.aq-tr-monto { font-weight:600; text-align:right; white-space:nowrap; }
.aq-pc { font-style:normal; font-size:10px; font-weight:700; color:#8a6400; background:#fff7e6; border:1px solid #f0d8a0;
  padding:1px 4px; border-radius:5px; margin-left:5px; }
.aq-badge { font-size:11px; font-weight:700; text-align:center; padding:3px 8px; border-radius:20px; }
.aq-badge.ok { background:#e8f5ee; color:var(--ok); }
.aq-badge.warn { background:#fff7e6; color:#7a5a00; }

/* Confirmación */
.aq-confirm-head { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
.aq-check-ico { width:34px; height:34px; border-radius:50%; background:var(--ok); color:#fff; display:flex; align-items:center;
  justify-content:center; font-size:18px; font-weight:700; }
.aq-confirm h2 { margin:0; color:var(--navy); font-size:18px; text-transform:none; letter-spacing:0; }
.aq-confirm-msg { font-family:inherit; font-size:14px; line-height:1.5; white-space:pre-wrap; background:#f3f8fc;
  border:1px solid var(--line); border-radius:11px; padding:14px; color:var(--ink); margin:0; }
.aq-email-line { margin-top:12px; font-size:14px; padding:9px 12px; border-radius:9px; }
.aq-email-line.ok { background:#e8f5ee; color:var(--ok); }
.aq-email-line.warn { background:#fff7e6; color:#7a5a00; }
.aq-email-line.muted { background:var(--bg); color:var(--muted); }
.aq-confirm-acts { display:flex; gap:10px; margin-top:16px; }
.aq-confirm-acts .aq-btn { width:auto; flex:1; margin-top:0; }
.aq-confirm-acts .aq-btn-sec { flex:1; }

/* Alerta de email faltante */
.aq-email-alert { margin-top:12px; background:#fff7e6; border:1px solid #f0d8a0; border-left:4px solid #e0a300; border-radius:11px; padding:12px 14px; }
.aq-email-alert strong { color:#7a5a00; display:block; font-size:14px; }
.aq-email-alert p { margin:4px 0 10px; font-size:13px; color:#7a5a00; }
.aq-email-add { display:flex; gap:8px; }
.aq-email-add input { flex:1; }
.aq-email-add .aq-btn-sec { white-space:nowrap; }

@media (max-width:560px) {
  .aq-grid { grid-template-columns:1fr; }
  .aq-item { grid-template-columns: 1fr 56px 80px 28px; }
  .aq-item .aq-sub { display:none; }
  .aq-desc { grid-template-columns: 1fr 80px 28px; }
  .aq-desc select { grid-column:1 / -1; }
  .aq-kpis { grid-template-columns:repeat(2,1fr); }
  .aq-money { grid-template-columns:1fr; }
  .aq-tr { grid-template-columns:1fr 70px 60px; row-gap:2px; }
  .aq-tr-fecha { display:none; }
  .aq-tr-monto { grid-column:2 / 3; }
}
/* Mantenedores (Bloque 4) */
.aq-subtabs { display:flex; gap:6px; flex-wrap:wrap; }
.aq-subtabs button { background:#fff; border:1px solid var(--line); color:var(--muted); font:inherit; font-weight:600; font-size:13px;
  padding:8px 16px; border-radius:10px; cursor:pointer; }
.aq-subtabs button:hover { border-color:var(--blue); color:var(--navy); }
.aq-subtabs button.on { background:var(--navy); color:#fff; border-color:var(--navy); }
.aq-list { display:flex; flex-direction:column; margin-top:4px; }
.aq-list-row { display:grid; grid-template-columns:1fr auto auto auto; gap:10px; align-items:center; padding:11px 4px;
  border-bottom:1px solid var(--line); }
.aq-list-row:last-child { border-bottom:none; }
.aq-list-row.off { opacity:.62; }
.aq-list-main { min-width:0; }
.aq-list-main strong { display:block; color:var(--ink); font-weight:600; }
.aq-list-main span { font-size:12px; color:var(--muted); }
.aq-list-row .aq-btn-sec { padding:6px 11px; }
.aq-mant-acts { display:flex; gap:10px; align-items:center; margin-top:14px; flex-wrap:wrap; }
.aq-mant-acts .aq-btn { width:auto; flex:1; min-width:180px; margin-top:0; }
.aq-btn-danger { background:#fff; border:1px solid #f3b4ad; color:var(--bad); font:inherit; font-weight:600; font-size:14px;
  padding:13px 18px; border-radius:11px; cursor:pointer; }
.aq-btn-danger:hover { background:#fdecea; }
.aq-checks { display:flex; flex-wrap:wrap; gap:18px; margin-top:12px; }

/* Repetir última compra (Bloque 5) */
.aq-repetir { border-color:var(--blue); background:#f3f8fc; }
.aq-repetir-row { display:flex; justify-content:space-between; align-items:center; gap:12px; }
.aq-repetir-row strong { color:var(--navy); }
.aq-repetir-row p { margin:2px 0 0; }
.aq-repetir-row .aq-btn-sec { white-space:nowrap; }

@media (max-width:560px) {
  .aq-list-row { grid-template-columns:1fr auto; row-gap:8px; }
  .aq-list-row .aq-badge { grid-column:2; }
  .aq-list-row .aq-btn-sec { grid-column:span 1; }
  .aq-repetir-row { flex-direction:column; align-items:stretch; }
}
.aq-mini { font-size:11px; color:var(--muted); font-weight:500; margin-top:3px; }
.aq-badge.bad { background:#fdecea; color:var(--bad); }
input:disabled { background:#f1f3f8; color:var(--muted); cursor:not-allowed; }

/* Historial de pedidos del cliente */
.aq-hist { margin-top:16px; border-top:1px solid var(--line); padding-top:14px; }
.aq-hist-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
.aq-hist-head h3 { margin:0; font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--navy); font-weight:700; }
.aq-hist-ped { border-bottom:1px solid var(--line); }
.aq-hist-ped:last-child { border-bottom:none; }
.aq-hist-row { display:grid; grid-template-columns:1fr auto 92px 18px; gap:10px; align-items:center; padding:11px 4px; cursor:pointer; }
.aq-hist-row:hover { background:var(--bg); }
.aq-hist-main { min-width:0; }
.aq-hist-main strong { display:block; color:var(--ink); }
.aq-hist-caret { color:var(--muted); font-size:12px; text-align:center; }
.aq-hist-det { padding:4px 6px 14px; }
.aq-hist-items { list-style:none; margin:0 0 8px; padding:0; }
.aq-hist-items li { display:flex; justify-content:space-between; gap:10px; font-size:14px; padding:4px 0; border-bottom:1px dashed var(--line); }
.aq-hist-items li:last-child { border-bottom:none; }
.aq-hist-pod { background:#f3f8fc; border:1px solid var(--line); border-radius:10px; padding:10px 12px; font-size:13px; color:var(--ink); }
.aq-hist-pod strong { display:block; color:var(--navy); margin-bottom:4px; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
.aq-hist-pod > div { margin:2px 0; }
.aq-hist-form { margin-top:6px; }
.aq-hist-form em { color:var(--muted); font-style:normal; }
@media (max-width:560px) { .aq-hist-row { grid-template-columns:1fr auto 18px; } .aq-hist-row .aq-badge { display:none; } }

/* Cobranza / gestión de cobro */
.aq-money-card.deuda { background:#fff7e6; border:1px solid #f0d8a0; color:#8a6400; text-align:left; cursor:pointer; font:inherit; display:flex; flex-direction:column; gap:2px; }
.aq-money-card.deuda:hover { background:#fdeecb; }
.aq-money-card.deuda strong { color:#8a6400; }
.aq-money-sub { font-style:normal; font-size:11px; color:#a07a2a; font-weight:500; }
.aq-tr-click { cursor:pointer; }
.aq-tr-click:hover { background:var(--bg); }
.aq-pc { cursor:pointer; }
.aq-cob { border-bottom:1px solid var(--line); padding:12px 4px; }
.aq-cob:last-child { border-bottom:none; }
.aq-cob-head { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
.aq-cob-main strong { display:block; color:var(--ink); }
.aq-cob-badges { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.aq-cob-acts { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; align-items:center; }
.aq-cob-acts .aq-btn-sec { padding:7px 12px; font-size:13px; }
.aq-btn-sec.on { background:#e7f6ee; border-color:#9bd5b4; color:#1a7a45; }

/* Alerta de deuda en Nuevo pedido */
.aq-alerta-deuda { background:#fff7e6; border:1px solid #f0d8a0; border-radius:12px; padding:14px 16px; margin-bottom:14px; }
.aq-alerta-deuda strong { color:#8a6400; display:block; }
.aq-alerta-deuda p { margin:4px 0; color:var(--ink); }
.aq-alerta-deuda span { font-size:13px; color:#a07a2a; }
.aq-alerta-bidon { background:#e6f1fb; border:1px solid #85b7eb; border-radius:12px; padding:14px 16px; margin-bottom:14px; }
.aq-alerta-bidon strong { color:#0c447c; display:block; }
.aq-alerta-bidon p { margin:4px 0; color:var(--ink); }
.aq-alerta-bidon span { font-size:13px; color:#185fa5; }

/* Popup detalle de entrega */
.aq-modal-ov { position:fixed; inset:0; background:rgba(15,23,42,.45); display:flex; align-items:center; justify-content:center; padding:18px; z-index:50; }
.aq-modal { background:#fff; border-radius:16px; max-width:560px; width:100%; max-height:86vh; overflow:auto; padding:18px 20px; box-shadow:0 18px 50px rgba(0,0,0,.25); }
.aq-modal-head { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:14px; }
.aq-modal-head strong { display:block; font-size:17px; color:var(--navy); }
.aq-modal-cobro { margin-top:14px; background:#fff7e6; border:1px solid #f0d8a0; border-radius:12px; padding:12px 14px; }
.aq-modal-cobro > strong { color:#8a6400; }

/* Resumen de cobranzas */
.aq-cob-resumen { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin:14px 0 8px; }
.aq-cob-rcard { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px 14px; display:flex; flex-direction:column; gap:2px; }
.aq-cob-rcard span { font-size:12px; color:var(--muted); }
.aq-cob-rcard strong { font-size:20px; color:var(--navy); }
.aq-cob-rcard em { font-style:normal; font-size:11px; color:var(--muted); }
.aq-cob-rcard.ok strong { color:#1a7a45; }
.aq-cob-rcard.pend strong { color:#8a6400; }
.aq-cob-rcard.venc { background:#fdecea; border-color:#f3b4ad; }
.aq-cob-rcard.venc strong, .aq-cob-rcard.venc span { color:var(--bad); }

/* Grupos por cliente en cobranzas */
.aq-cob-grupo { border:1px solid var(--line); border-radius:12px; margin-bottom:10px; overflow:hidden; }
.aq-cob-grow { display:grid; grid-template-columns:1fr auto auto auto; gap:10px; align-items:center; padding:12px 14px; cursor:pointer; background:#fff; }
.aq-cob-grow:hover { background:var(--bg); }
.aq-cob-grow .aq-tr-monto { font-size:16px; color:var(--bad); }
.aq-cob-orders { background:var(--bg); padding:4px 12px 8px; }
.aq-cob-orders .aq-cob { border-bottom:1px solid var(--line); }
.aq-cob-orders .aq-cob:last-child { border-bottom:none; }

.aq-kpi-venc { border-color:#f3b4ad !important; background:#fdecea; }
.aq-kpi-venc strong { color:var(--bad); }
/* Segunda fila de tarjetas (operaciones de caja) */
.aq-kpis-2 { grid-template-columns:repeat(2,1fr); margin-top:10px; }
.aq-kpi-sub { display:block; font-size:11px; color:var(--muted); margin-top:6px; font-style:normal; }
.aq-kpi-cash { display:flex; flex-direction:column; align-items:flex-start; }
.aq-kpi-cash strong { color:var(--navy); }
.aq-kpi-cash.neg strong { color:var(--bad); }
.aq-kpi-prov { display:flex; flex-direction:column; align-items:flex-start; }
.aq-kpi-prov.on-warn { border-color:#f0d8a0; background:#fff7e6; }
.aq-kpi-prov.on-warn strong { color:#8a6400; }
/* Desglose dentro de los pop-ups */
.aq-desglose { border:1px solid var(--line); border-radius:12px; overflow:hidden; }
.aq-desglose-row { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid var(--line); font-size:14px; }
.aq-desglose-row:last-child { border-bottom:none; }
.aq-desglose-row span { color:var(--ink); }
.aq-desglose-row strong { font-family:'Fraunces',serif; }
.aq-desglose-row strong.pos { color:var(--navy); }
.aq-desglose-row strong.neg { color:var(--bad); }
.aq-desglose-row.total { background:#f0f7ff; }
.aq-desglose-row.total strong { color:var(--navy); font-size:18px; }
.aq-desglose-row.ref { background:#f8fafc; }
.aq-desglose-row.ref span, .aq-desglose-row.ref strong { color:var(--muted); }
.aq-det-line { display:flex; justify-content:space-between; gap:10px; font-size:13px; padding:5px 0; border-bottom:1px dashed var(--line); }
.aq-det-line:last-child { border-bottom:none; }
.aq-det-line span:first-child { color:var(--ink); }
.aq-det-line span:last-child { font-variant-numeric:tabular-nums; color:var(--navy); }
/* Chofer asignado dentro de una línea de detalle */
.aq-det-chofer { display:block; font-size:11px; font-style:normal; color:var(--muted); margin-top:1px; }
.aq-det-chofer::before { content:"👤 "; }
/* Agrupación por proveedor (cabecera + facturas) */
.aq-prov-grupo { padding:4px 0; border-bottom:1px dashed var(--line); }
.aq-prov-grupo:last-child { border-bottom:none; }
.aq-prov-cab { border-bottom:none; font-weight:600; }
.aq-prov-cab span:last-child { font-weight:700; }
.aq-prov-fact { border-bottom:none; padding:2px 0 2px 12px; opacity:.85; }
.aq-prov-fact span:first-child { font-size:12px; }
/* Tarjetas de Pagos a proveedor agrupadas por proveedor */
.aq-prov-tarjeta { border:1px solid var(--line); border-radius:12px; padding:14px 16px; margin-bottom:10px; }
.aq-prov-tarjeta-head { display:flex; align-items:center; gap:14px; flex-wrap:wrap; cursor:pointer; }
.aq-prov-tarjeta-head strong { display:block; color:var(--navy); font-size:15px; }
.aq-prov-tarjeta-info { flex:1; min-width:160px; }
.aq-prov-dona { position:relative; width:52px; height:52px; flex:0 0 auto; }
.aq-prov-dona-pct { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  font-size:11px; font-weight:700; color:var(--ink); }
.aq-prov-tarjeta-nums { display:flex; align-items:center; gap:12px; font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap; }
.aq-prov-num.pos { color:var(--ok); }
.aq-prov-num.neg { color:var(--bad); }
.aq-prov-detalle { margin-top:14px; padding-top:12px; border-top:1px dashed var(--line); cursor:default; }
/* Subtotal a rendir por chofer */
.aq-chofer-box { padding:6px 0; border-bottom:1px dashed var(--line); }
/* Agrupación por cliente (Facturas por emitir / Bidones pendientes) */
.aq-fact-grupo { border-bottom:1px solid var(--line); padding:6px 0; }
.aq-fact-grupo:last-child { border-bottom:none; }
.aq-fact-head { cursor:pointer; align-items:center; flex-wrap:wrap; }
.aq-fact-detalle { padding:6px 0 10px 12px; }
.aq-fact-acciones { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:10px; }
.aq-fact-acciones input[type="text"] { font-size:13px; padding:7px 10px; }
.aq-fact-acciones input[type="file"] { font-size:12px; max-width:180px; }
.aq-check-inline { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ink); margin-top:10px; cursor:pointer; }
.aq-check-inline input { width:auto; margin:0; }
.aq-chofer-box:last-child { border-bottom:none; }
.aq-chofer-cab { border-bottom:none; font-weight:600; }
.aq-chofer-cab span:last-child { font-family:'Fraunces',serif; font-size:16px; color:var(--navy); }
.aq-chofer-cab span:last-child.neg { color:var(--bad); }
.aq-chofer-detalle { font-size:11px; color:var(--muted); margin-top:2px; }

/* Semáforo de pago del cliente */
.aq-semaforo { display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:600; padding:7px 12px; border-radius:10px; margin-bottom:12px; border:1px solid; }
.aq-semaforo .aq-sem-dot { width:11px; height:11px; border-radius:50%; flex:none; }
.aq-semaforo.verde { background:#e7f6ee; border-color:#9bd5b4; color:#1a7a45; }
.aq-semaforo.verde .aq-sem-dot { background:#1a9a52; }
.aq-semaforo.amarillo { background:#fff7e6; border-color:#f0d8a0; color:#8a6400; }
.aq-semaforo.amarillo .aq-sem-dot { background:#e0a400; }
.aq-semaforo.rojo { background:#fdecea; border-color:#f3b4ad; color:#b42318; }
.aq-semaforo.rojo .aq-sem-dot { background:#d92d20; }

.aq-hist-pago { margin-top:8px; background:#e7f6ee; border:1px solid #9bd5b4; border-radius:10px; padding:8px 12px; font-size:13px; color:#1a5a36; }
.aq-hist-pago strong { display:block; color:#1a7a45; margin-bottom:3px; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
.aq-hist-pago > div { margin:2px 0; }

.aq-contactos { background:#f3f8fc; border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin-bottom:14px; }
.aq-contactos > strong { display:block; color:var(--navy); font-size:13px; margin-bottom:8px; }
.aq-contactos ul { list-style:none; margin:0 0 6px; padding:0; }
.aq-contactos li { padding:6px 0; border-bottom:1px solid var(--line); }
.aq-contactos li:last-child { border-bottom:none; }
.aq-cont-nom { display:block; font-weight:600; color:var(--ink); }
.aq-cont-sub { display:block; font-size:12px; color:var(--muted); }

.aq-money-card.proveedor { background:#eef6ff; border:1px solid #b3d4f5; color:#1a4a8a; }
.aq-money-card.proveedor strong { color:#1a4a8a; }
.aq-money-card.rendicion { background:#fff7e6; border:1px solid #f0d8a0; color:#8a6400; }
.aq-money-card.rendicion strong { color:#8a6400; }
.aq-money-card.efectivo { background:#e7f6ee; border:1px solid #9bd5b4; color:#1a5a36; }
.aq-money-card.efectivo strong { color:#1a7a45; }

/* Gráfico de meta (bullet chart) */
.aq-meta-card { }
.aq-meta-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:14px; flex-wrap:wrap; }
.aq-meta-head h2 { margin:0; }
.aq-meta-badge { padding:6px 14px; border-radius:20px; font-size:13px; font-weight:700; white-space:nowrap; }
.aq-meta-row { display:grid; grid-template-columns:auto 1fr auto 1fr auto 1fr; gap:4px 10px; align-items:baseline; margin-bottom:14px; }
.aq-meta-label { font-size:12px; color:var(--muted); }
.aq-meta-val { font-size:16px; font-weight:700; color:var(--navy); }
.aq-bullet { margin-bottom:4px; }
.aq-bullet-track { position:relative; height:22px; background:#eef0f5; border-radius:11px; overflow:hidden; }
.aq-bullet-fill { position:absolute; left:0; top:0; height:100%; border-radius:11px; transition:width .6s cubic-bezier(.4,0,.2,1); }
.aq-bullet-goal { position:absolute; right:0; top:0; width:3px; height:100%; background:var(--navy); opacity:.7; }
.aq-bullet-labels { position:relative; display:flex; justify-content:space-between; font-size:11px; color:var(--muted); margin-top:3px; }

.aq-dom-edit { background:#f0f7ff; border:1px solid #bdd7f5; border-radius:10px; padding:12px 14px; margin-bottom:10px; }
.aq-dom-edit .aq-grid { grid-template-columns:1fr 1fr; }
.aq-dom-edit input { font-size:13px; }

.aq-modal-edit { margin-top:14px; background:#f8fafc; border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
.aq-modal-edit > strong { color:var(--navy); display:block; margin-bottom:2px; }
.aq-modal-edit .aq-grid { grid-template-columns:1fr 1fr; }
.aq-modal-edit input, .aq-modal-edit select { font-size:13px; }

.aq-items-edit-row { display:flex; align-items:center; gap:6px; padding:5px 0; border-bottom:1px solid var(--line); }
.aq-items-edit-row:last-of-type { border-bottom:none; }
.aq-items-edit-row input { padding:6px 8px; border:1px solid var(--line); border-radius:7px; font-family:inherit; font-size:13px; background:var(--white); color:var(--ink); }
.aq-items-edit-row input:focus { outline:none; border-color:var(--cyan); }

/* Badge de alerta en botones de navegación (facturas / bidones pendientes) */
.aq-nav button { position:relative; }
.aq-nav-alert { display:inline-block; margin-left:6px; background:var(--bad); color:#fff; font-size:10px; font-weight:700;
  padding:1px 6px; border-radius:20px; vertical-align:2px; }
.aq-nav button.on .aq-nav-alert { background:var(--bad); color:#fff; }

/* Tarjetas de alerta de gestión en el dashboard de Inicio (motivan a resolver pendientes) */
.aq-gestion-alerts { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px,1fr)); gap:10px; margin-top:10px; }
.aq-alert-card { border-radius:14px; padding:16px 18px; text-align:left; cursor:pointer; font:inherit; display:flex;
  flex-direction:column; gap:2px; border:1px solid; transition:transform .15s ease; }
.aq-alert-card:hover { transform:translateY(-1px); }
.aq-alert-card span { display:block; font-size:12px; margin-bottom:2px; font-weight:600; }
.aq-alert-card strong { font-family:'Fraunces',serif; font-size:28px; line-height:1; }
.aq-alert-card.bad { background:#fdecea; border-color:#f3b4ad; color:var(--bad); }
.aq-alert-card.bad strong { color:var(--bad); }
.aq-alert-card.warn { background:#fff7e6; border-color:#f0d8a0; color:#8a6400; }
.aq-alert-card.warn strong { color:#8a6400; }

@media (prefers-reduced-motion: reduce) { * { animation:none !important; transition:none !important; } }
`;

