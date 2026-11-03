// CRM Aquatrisq — ficha de cliente con historial de compra, valor del cliente
// y seguimiento comercial. Primer paso hacia el CRM propio (nov 2026).
//
// Datos:
//  - vista crm_clientes  : métricas por cliente (excluye despachos Fine).
//  - pedidos / pedido_items / pedido_descuentos : historial de la ficha.
//  - cliente_seguimiento : notas, llamadas, visitas y próximos contactos.
// Roles: admin, operador y gerencial (el gerencial también registra seguimiento).

import { Fragment, useEffect, useMemo, useState } from "react";

const CLP = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
const NUM = (n) => (Number(n) || 0).toLocaleString("es-CL", { maximumFractionDigits: 1 });
const DIA = 86400000;

function fecha(d, conAnio = true) {
  if (!d) return "—";
  const x = new Date(d);
  return x.toLocaleDateString("es-CL", { day: "2-digit", month: "short", ...(conAnio ? { year: "numeric" } : {}), timeZone: "America/Santiago" });
}
function hoyISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}
function sumarDias(iso, n) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
}
function haceDias(n) {
  if (n == null) return "—";
  if (n <= 0) return "hoy";
  if (n === 1) return "ayer";
  if (n < 60) return `hace ${n} días`;
  const m = Math.round(n / 30);
  return `hace ${m} meses`;
}
// "Empresa / Local 3 / Contacto: Ana" -> { principal: "Empresa", detalle: "Local 3 · Contacto: Ana" }
function partesNombre(nombre) {
  const p = String(nombre || "").split("/").map((s) => s.trim()).filter(Boolean);
  return { principal: p[0] || "Cliente", detalle: p.slice(1).join(" · ") };
}

// Segmento por recencia, relativo a la frecuencia propia de cada cliente.
export function segmento(m) {
  if (!m || !m.pedidos) return { key: "sin", label: "Sin compras", orden: 5 };
  const d = m.dias_desde_ultimo ?? 0;
  if (m.pedidos === 1 && d <= 30) return { key: "nuevo", label: "Nuevo", orden: 1 };
  if (d > 90) return { key: "inactivo", label: "Inactivo", orden: 4 };
  const umbral = m.frecuencia_dias ? Math.max(Math.round(m.frecuencia_dias * 1.5), 14) : 45;
  if (d > umbral) return { key: "riesgo", label: "En riesgo", orden: 3 };
  return { key: "activo", label: "Activo", orden: 2 };
}

const TIPOS = [
  { key: "nota", label: "Nota", icon: "📝" },
  { key: "llamada", label: "Llamada", icon: "📞" },
  { key: "whatsapp", label: "WhatsApp", icon: "💬" },
  { key: "correo", label: "Correo", icon: "✉️" },
  { key: "visita", label: "Visita", icon: "📍" },
  { key: "tarea", label: "Tarea", icon: "✅" },
];
const tipoInfo = (k) => TIPOS.find((t) => t.key === k) || TIPOS[0];

const ORDENES = [
  { key: "total", label: "Mayor compra total" },
  { key: "reciente", label: "Compra más reciente" },
  { key: "pedidos", label: "Más pedidos" },
  { key: "ticket", label: "Mayor ticket promedio" },
  { key: "riesgo", label: "Más días sin comprar" },
];

export default function Crm({ supabase, rol, perfilNombre, clientes, todosDomicilios, onNuevoPedido, onEditarCliente }) {
  const [metricas, setMetricas] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [error, setError] = useState("");
  const [buscar, setBuscar] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [orden, setOrden] = useState("total");
  const [limite, setLimite] = useState(40);
  const [fichaId, setFichaId] = useState(() => {
    try { return sessionStorage.getItem("aq_crm_ficha") || null; } catch { return null; }
  });

  useEffect(() => {
    try { fichaId ? sessionStorage.setItem("aq_crm_ficha", fichaId) : sessionStorage.removeItem("aq_crm_ficha"); } catch { /* noop */ }
  }, [fichaId]);

  async function cargar() {
    setError("");
    try {
      const [{ data: m, error: e1 }, { data: s, error: e2 }] = await Promise.all([
        supabase.from("crm_clientes").select("*"),
        supabase.from("cliente_seguimiento").select("*").eq("completado", false).not("proximo_contacto", "is", null).order("proximo_contacto").limit(200),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setMetricas(m || []);
      setPendientes(s || []);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar los datos del CRM.");
      setMetricas([]);
    }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  const cliPorId = useMemo(() => Object.fromEntries((clientes || []).map((c) => [c.id, c])), [clientes]);
  const metPorId = useMemo(() => Object.fromEntries((metricas || []).map((m) => [m.cliente_id, m])), [metricas]);

  // Ranking por compra total (para mostrar "#3 de 310")
  const ranking = useMemo(() => {
    const r = {};
    [...(metricas || [])].sort((a, b) => b.total_comprado - a.total_comprado).forEach((m, i) => { r[m.cliente_id] = i + 1; });
    return r;
  }, [metricas]);

  const filas = useMemo(() => {
    if (!metricas) return [];
    const q = buscar.trim().toLowerCase();
    let base;
    if (q) {
      // Al buscar, se incluyen también clientes sin compras (prospectos).
      const domsPorCli = {};
      (todosDomicilios || []).forEach((d) => { (domsPorCli[d.cliente_id] ||= []).push(d); });
      base = (clientes || []).filter((c) => {
        const txt = [c.nombre, c.razon_social, c.rut, c.codigo_cliente, c.email, c.telefono,
          ...(domsPorCli[c.id] || []).flatMap((d) => [d.direccion, d.comuna, d.identificador_dt])].join(" ").toLowerCase();
        return txt.includes(q);
      }).map((c) => ({ c, m: metPorId[c.id] || null }));
    } else {
      base = metricas.map((m) => ({ c: cliPorId[m.cliente_id], m })).filter((x) => x.c);
    }
    base = base.map((x) => ({ ...x, seg: segmento(x.m) }));
    if (filtro !== "todos") base = base.filter((x) => x.seg.key === filtro);
    const v = (x, k) => (x.m ? x.m[k] ?? 0 : -1);
    const cmp = {
      total: (a, b) => v(b, "total_comprado") - v(a, "total_comprado"),
      reciente: (a, b) => (a.m?.dias_desde_ultimo ?? 1e9) - (b.m?.dias_desde_ultimo ?? 1e9),
      pedidos: (a, b) => v(b, "pedidos") - v(a, "pedidos"),
      ticket: (a, b) => v(b, "ticket_promedio") - v(a, "ticket_promedio"),
      riesgo: (a, b) => (b.m?.dias_desde_ultimo ?? -1) - (a.m?.dias_desde_ultimo ?? -1),
    }[orden];
    return base.sort(cmp);
  }, [metricas, clientes, todosDomicilios, buscar, filtro, orden, cliPorId, metPorId]);

  const resumen = useMemo(() => {
    const r = { activo: 0, nuevo: 0, riesgo: 0, inactivo: 0, total90: 0, ped90: 0, clientes90: 0 };
    (metricas || []).forEach((m) => {
      r[segmento(m).key] = (r[segmento(m).key] || 0) + 1;
      r.total90 += Number(m.total_90d) || 0;
      r.ped90 += m.pedidos_90d || 0;
      if (m.pedidos_90d > 0) r.clientes90++;
    });
    const hoy = hoyISO();
    r.vencidos = pendientes.filter((p) => p.proximo_contacto < hoy).length;
    r.hoy = pendientes.filter((p) => p.proximo_contacto === hoy).length;
    return r;
  }, [metricas, pendientes]);

  if (fichaId) {
    return (
      <Ficha
        supabase={supabase}
        rol={rol}
        perfilNombre={perfilNombre}
        cliente={cliPorId[fichaId]}
        metrica={metPorId[fichaId]}
        rank={ranking[fichaId]}
        totalRank={(metricas || []).length}
        domicilios={(todosDomicilios || []).filter((d) => d.cliente_id === fichaId)}
        onVolver={() => { setFichaId(null); cargar(); }}
        onNuevoPedido={onNuevoPedido}
        onEditarCliente={onEditarCliente}
      />
    );
  }

  const hoy = hoyISO();
  const chips = [
    { key: "todos", label: "Todos", n: (metricas || []).length },
    { key: "activo", label: "Activos", n: resumen.activo },
    { key: "nuevo", label: "Nuevos", n: resumen.nuevo },
    { key: "riesgo", label: "En riesgo", n: resumen.riesgo },
    { key: "inactivo", label: "Inactivos", n: resumen.inactivo },
  ];

  return (
    <>
      <style>{crmCss}</style>
      <section className="crm-hero">
        <div>
          <div className="crm-eyebrow">CRM · Clientes</div>
          <h2 className="crm-title">Conoce a tus clientes</h2>
          <p className="crm-sub">Historial de compra, valor de cada cliente y seguimiento comercial en un solo lugar.</p>
        </div>
        <div className="crm-kpis">
          <Kpi label="Ventas últimos 90 días" valor={CLP(resumen.total90)} nota={`${resumen.ped90} pedidos · ${resumen.clientes90} clientes`} />
          <Kpi label="Clientes activos" valor={NUM(resumen.activo + resumen.nuevo)} nota={`${resumen.nuevo} nuevos este mes`} />
          <Kpi label="En riesgo" valor={NUM(resumen.riesgo)} nota="atrasados vs. su frecuencia" tono="warn" onClick={() => setFiltro("riesgo")} />
          <Kpi label="Contactos pendientes" valor={NUM(resumen.vencidos + resumen.hoy)} nota={`${resumen.vencidos} vencidos · ${resumen.hoy} hoy`} tono={resumen.vencidos ? "bad" : ""} />
        </div>
      </section>

      {error && <div className="aq-card aq-error">{error}</div>}

      {pendientes.length > 0 && (
        <section className="aq-card">
          <div className="aq-row-head"><h2>Próximos contactos</h2><span className="crm-muted">{pendientes.length} pendientes</span></div>
          <div className="crm-agenda">
            {pendientes.slice(0, 8).map((s) => {
              const c = cliPorId[s.cliente_id];
              const estado = s.proximo_contacto < hoy ? "bad" : s.proximo_contacto === hoy ? "warn" : "";
              return (
                <button key={s.id} className={"crm-agenda-item " + estado} onClick={() => setFichaId(s.cliente_id)}>
                  <span className="crm-agenda-fecha">{s.proximo_contacto === hoy ? "Hoy" : fecha(s.proximo_contacto, false)}</span>
                  <span className="crm-agenda-txt">
                    <strong>{partesNombre(c?.nombre).principal}</strong>
                    <span>{tipoInfo(s.tipo).icon} {s.texto}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="aq-card">
        <div className="crm-toolbar">
          <input className="crm-search" placeholder="Buscar cliente por nombre, RUT, correo, teléfono o dirección…" value={buscar} onChange={(e) => { setBuscar(e.target.value); setLimite(40); }} />
          <select value={orden} onChange={(e) => setOrden(e.target.value)} className="crm-select">
            {ORDENES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <div className="crm-chips">
          {chips.map((ch) => (
            <button key={ch.key} className={"crm-chip " + (filtro === ch.key ? "on" : "") + " seg-" + ch.key} onClick={() => { setFiltro(ch.key); setLimite(40); }}>
              {ch.label} <b>{ch.n}</b>
            </button>
          ))}
        </div>

        {metricas === null ? (
          <p className="crm-muted">Cargando clientes…</p>
        ) : filas.length === 0 ? (
          <p className="crm-muted">No hay clientes que coincidan.</p>
        ) : (
          <div className="crm-tabla-wrap">
            <table className="crm-tabla">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th className="r">Pedidos</th>
                  <th className="r">Compra total</th>
                  <th className="r">Ticket prom.</th>
                  <th>Frecuencia</th>
                  <th>Último pedido</th>
                </tr>
              </thead>
              <tbody>
                {filas.slice(0, limite).map(({ c, m, seg }) => {
                  const n = partesNombre(c.nombre);
                  return (
                    <tr key={c.id} onClick={() => setFichaId(c.id)}>
                      <td>
                        <div className="crm-cli">
                          <Avatar nombre={n.principal} />
                          <div>
                            <strong>{n.principal}</strong>
                            {n.detalle && <span>{n.detalle}</span>}
                          </div>
                        </div>
                      </td>
                      <td><span className={"crm-seg seg-" + seg.key}>{seg.label}</span></td>
                      <td className="r">{m ? m.pedidos : "—"}</td>
                      <td className="r strong">{m ? CLP(m.total_comprado) : "—"}</td>
                      <td className="r">{m?.ticket_promedio ? CLP(m.ticket_promedio) : "—"}</td>
                      <td>{m?.frecuencia_dias ? `cada ${m.frecuencia_dias} días` : "—"}</td>
                      <td>{m ? haceDias(m.dias_desde_ultimo) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filas.length > limite && (
              <button className="aq-btn-sec crm-mas" onClick={() => setLimite((l) => l + 40)}>Ver más ({filas.length - limite} restantes)</button>
            )}
          </div>
        )}
      </section>
    </>
  );
}

function Kpi({ label, valor, nota, tono = "", onClick }) {
  return (
    <div className={"crm-kpi " + tono + (onClick ? " click" : "")} onClick={onClick}>
      <span className="crm-kpi-label">{label}</span>
      <span className="crm-kpi-valor">{valor}</span>
      {nota && <span className="crm-kpi-nota">{nota}</span>}
    </div>
  );
}

function Avatar({ nombre, grande }) {
  const ini = String(nombre || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  let h = 0; for (const ch of String(nombre)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return <span className={"crm-avatar" + (grande ? " xl" : "")} style={{ background: `hsl(${(h % 60) + 190} 45% 92%)`, color: `hsl(${(h % 60) + 190} 50% 30%)` }}>{ini}</span>;
}

// ───────────────────────────── FICHA ─────────────────────────────
function Ficha({ supabase, rol, perfilNombre, cliente, metrica, rank, totalRank, domicilios, onVolver, onNuevoPedido, onEditarCliente }) {
  const [peds, setPeds] = useState(null);
  const [items, setItems] = useState({});
  const [descs, setDescs] = useState({});
  const [seg, setSeg] = useState([]);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  // Formulario de seguimiento
  const [tipo, setTipo] = useState("llamada");
  const [texto, setTexto] = useState("");
  const [prox, setProx] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [okSeg, setOkSeg] = useState("");

  const id = cliente?.id;

  async function cargar() {
    if (!id) return;
    setError("");
    try {
      const [{ data: p, error: e1 }, { data: s, error: e2 }] = await Promise.all([
        supabase.from("pedidos")
          .select("id,numero_guia,created_at,monto_total,tipo_pago,tipo_documento,numero_documento_emitido,documento_emitido_en,cobro_cobrado,cobro_abonado,es_fine,fine_minimarket,observacion,domicilio_id,creado_por")
          .eq("cliente_id", id).order("created_at", { ascending: false }),
        supabase.from("cliente_seguimiento").select("*").eq("cliente_id", id).order("created_at", { ascending: false }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const lista = p || [];
      setPeds(lista);
      setSeg(s || []);
      const ids = lista.map((x) => x.id);
      if (ids.length) {
        const trozos = [];
        for (let i = 0; i < ids.length; i += 150) trozos.push(ids.slice(i, i + 150));
        const res = await Promise.all(trozos.flatMap((t) => [
          supabase.from("pedido_items").select("pedido_id,nombre,codigo,cantidad,precio_unit,subtotal").in("pedido_id", t),
          supabase.from("pedido_descuentos").select("pedido_id,descripcion,monto").in("pedido_id", t),
        ]));
        const it = {}, ds = {};
        res.forEach((r, i) => (r.data || []).forEach((row) => { const m = i % 2 === 0 ? it : ds; (m[row.pedido_id] ||= []).push(row); }));
        setItems(it); setDescs(ds);
      }
    } catch (e) {
      setError(e?.message || "No se pudo cargar la ficha.");
      setPeds([]);
    }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [id]);

  const ventas = useMemo(() => (peds || []).filter((p) => !p.es_fine && !p.fine_minimarket), [peds]);

  // Productos que compra
  const productos = useMemo(() => {
    const acc = {};
    ventas.forEach((p) => (items[p.id] || []).forEach((it) => {
      const k = it.codigo || it.nombre;
      acc[k] ||= { nombre: it.nombre, unidades: 0, monto: 0, veces: 0 };
      acc[k].unidades += Number(it.cantidad) || 0;
      acc[k].monto += Number(it.subtotal) || 0;
      acc[k].veces += 1;
    }));
    return Object.values(acc).sort((a, b) => b.unidades - a.unidades);
  }, [ventas, items]);

  // Compras por mes (últimos 12 meses)
  const meses = useMemo(() => {
    const out = [];
    const d = new Date();
    for (let i = 11; i >= 0; i--) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push({ k: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`, label: x.toLocaleDateString("es-CL", { month: "short" }).replace(".", ""), monto: 0, n: 0 });
    }
    const idx = Object.fromEntries(out.map((m, i) => [m.k, i]));
    ventas.forEach((p) => {
      const k = new Date(p.created_at).toLocaleDateString("en-CA", { timeZone: "America/Santiago" }).slice(0, 7);
      if (idx[k] != null) { out[idx[k]].monto += Number(p.monto_total) || 0; out[idx[k]].n += 1; }
    });
    return out;
  }, [ventas]);
  const maxMes = Math.max(1, ...meses.map((m) => m.monto));

  const pendienteCobro = useMemo(
    () => ventas.filter((p) => p.tipo_pago === "Por Cobrar" && !p.cobro_cobrado && Number(p.monto_total) > 0)
      .reduce((s, p) => s + (Number(p.monto_total) - (Number(p.cobro_abonado) || 0)), 0),
    [ventas],
  );

  if (!cliente) {
    return (
      <section className="aq-card">
        <style>{crmCss}</style>
        <p className="crm-muted">No encontré este cliente.</p>
        <button className="aq-link" onClick={onVolver}>Volver al CRM</button>
      </section>
    );
  }

  const n = partesNombre(cliente.nombre);
  const sg = segmento(metrica);
  const m = metrica || {};
  const proxCompra = m.frecuencia_dias && m.ultimo_pedido ? new Date(new Date(m.ultimo_pedido).getTime() + m.frecuencia_dias * DIA) : null;
  const proxCompraDias = proxCompra ? Math.round((proxCompra.getTime() - Date.now()) / DIA) : null;
  const tel = String(cliente.telefono || "").replace(/[^\d+]/g, "");
  const wa = tel ? "https://wa.me/" + tel.replace(/^\+/, "").replace(/^(9\d{8})$/, "56$1") : null;
  const hoy = hoyISO();

  async function guardarSeg() {
    if (!texto.trim()) return;
    setGuardando(true); setOkSeg("");
    const { error: e } = await supabase.from("cliente_seguimiento").insert({
      cliente_id: id, tipo, texto: texto.trim(), proximo_contacto: prox || null, creado_por: perfilNombre || null,
    });
    setGuardando(false);
    if (e) { setOkSeg("Error: " + e.message); return; }
    setTexto(""); setProx(""); setOkSeg("Registrado.");
    const { data } = await supabase.from("cliente_seguimiento").select("*").eq("cliente_id", id).order("created_at", { ascending: false });
    setSeg(data || []);
  }
  async function completar(s) {
    const { error: e } = await supabase.from("cliente_seguimiento")
      .update({ completado: true, completado_en: new Date().toISOString(), completado_por: perfilNombre || null }).eq("id", s.id);
    if (!e) setSeg((prev) => prev.map((x) => (x.id === s.id ? { ...x, completado: true, completado_en: new Date().toISOString(), completado_por: perfilNombre } : x)));
  }

  const domPorId = Object.fromEntries((domicilios || []).map((d) => [d.id, d]));
  const listaPeds = verTodos ? (peds || []) : (peds || []).slice(0, 15);
  const puedeOperar = rol === "admin" || rol === "operador";

  return (
    <>
      <style>{crmCss}</style>
      <button className="crm-volver" onClick={onVolver}>← Volver al CRM</button>

      <section className="crm-ficha-head">
        <div className="crm-ficha-id">
          <Avatar nombre={n.principal} grande />
          <div>
            <div className="crm-ficha-tags">
              <span className={"crm-seg seg-" + sg.key}>{sg.label}</span>
              {rank && rank <= 20 && <span className="crm-tag-top">★ Top {rank} de {totalRank}</span>}
              {cliente.bloqueado && <span className="crm-seg seg-inactivo">Bloqueado</span>}
            </div>
            <h2 className="crm-ficha-nombre">{n.principal}</h2>
            {n.detalle && <p className="crm-ficha-detalle">{n.detalle}</p>}
            <div className="crm-contacto">
              {cliente.rut && <span>RUT {cliente.rut}</span>}
              {cliente.telefono && <a href={"tel:" + tel}>📞 {cliente.telefono}</a>}
              {wa && <a href={wa} target="_blank" rel="noreferrer">💬 WhatsApp</a>}
              {cliente.email && <a href={"mailto:" + cliente.email}>✉️ {cliente.email}</a>}
            </div>
          </div>
        </div>
        <div className="crm-ficha-acciones">
          {puedeOperar && <button className="crm-btn" onClick={() => onNuevoPedido(cliente)}>+ Nuevo pedido</button>}
          {puedeOperar && <button className="aq-btn-sec" onClick={() => onEditarCliente(cliente)}>Editar datos</button>}
        </div>
      </section>

      {error && <div className="aq-card aq-error">{error}</div>}

      <section className="crm-kpis crm-kpis-ficha">
        <Kpi label="Compra total" valor={CLP(m.total_comprado)} nota={rank ? `#${rank} de ${totalRank} clientes` : "sin compras aún"} />
        <Kpi label="Pedidos" valor={NUM(m.pedidos)} nota={m.primer_pedido ? `cliente desde ${fecha(m.primer_pedido)}` : ""} />
        <Kpi label="Ticket promedio" valor={m.ticket_promedio ? CLP(m.ticket_promedio) : "—"} nota={`${NUM(m.unidades)} unidades en total`} />
        <Kpi label="Frecuencia" valor={m.frecuencia_dias ? `cada ${m.frecuencia_dias} días` : "—"} nota={m.ultimo_pedido ? `último ${haceDias(m.dias_desde_ultimo)}` : ""} />
        <Kpi
          label="Próxima compra estimada"
          valor={proxCompra ? fecha(proxCompra, false) : "—"}
          nota={proxCompraDias == null ? "necesita 2+ compras" : proxCompraDias < 0 ? `atrasado ${-proxCompraDias} días` : proxCompraDias === 0 ? "hoy" : `en ${proxCompraDias} días`}
          tono={proxCompraDias != null && proxCompraDias < 0 ? (sg.key === "riesgo" || sg.key === "inactivo" ? "bad" : "warn") : ""}
        />
        <Kpi label="Descuentos otorgados" valor={CLP(m.descuentos)} nota={m.total_comprado ? `${((Number(m.descuentos) / (Number(m.total_comprado) + Number(m.descuentos))) * 100).toFixed(1)}% de la venta bruta` : ""} />
      </section>

      <div className="crm-cols">
        <div className="crm-col-main">
          <section className="aq-card">
            <div className="aq-row-head"><h2>Compras últimos 12 meses</h2>{m.total_90d > 0 && <span className="crm-muted">{CLP(m.total_90d)} en los últimos 90 días</span>}</div>
            <div className="crm-barras">
              {meses.map((x) => (
                <div key={x.k} className="crm-barra" title={`${x.label}: ${CLP(x.monto)} · ${x.n} pedido(s)`}>
                  <span className="crm-barra-val">{x.monto ? (x.monto >= 1000 ? Math.round(x.monto / 1000) + "k" : x.monto) : ""}</span>
                  <div className="crm-barra-fill" style={{ height: `${(x.monto / maxMes) * 100}%` }} />
                  <span className="crm-barra-mes">{x.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="aq-card">
            <div className="aq-row-head">
              <h2>Historial de compras {peds ? `(${peds.length})` : ""}</h2>
              {pendienteCobro > 0 && <span className="crm-pill-bad">Por cobrar {CLP(pendienteCobro)}</span>}
            </div>
            {peds === null ? <p className="crm-muted">Cargando…</p> : peds.length === 0 ? <p className="crm-muted">Este cliente aún no tiene pedidos.</p> : (
              <div className="crm-tabla-wrap">
                <table className="crm-tabla crm-hist">
                  <thead>
                    <tr><th>Fecha</th><th>Pedido</th><th>Productos</th><th>Pago</th><th>Documento</th><th className="r">Monto</th></tr>
                  </thead>
                  <tbody>
                    {listaPeds.map((p) => {
                      const its = items[p.id] || [];
                      const dsc = descs[p.id] || [];
                      const fine = p.es_fine || p.fine_minimarket;
                      const cobrado = p.tipo_pago !== "Por Cobrar" || p.cobro_cobrado;
                      return (
                        <Fragment key={p.id}>
                          <tr onClick={() => setAbierto(abierto === p.id ? null : p.id)} className={abierto === p.id ? "open" : ""}>
                            <td>{fecha(p.created_at)}</td>
                            <td><span className="crm-guia">{p.numero_guia || "—"}</span>{fine && <span className="crm-tag-fine">Fine</span>}</td>
                            <td className="crm-prods">{its.length ? its.map((i) => `${NUM(i.cantidad)}× ${i.nombre}`).join(", ") : "—"}</td>
                            <td>
                              <span className={"crm-pago " + (cobrado ? "ok" : "pend")}>{p.tipo_pago === "Por Cobrar" ? (p.cobro_cobrado ? "Cobrado" : "Por cobrar") : p.tipo_pago}</span>
                            </td>
                            <td>{p.numero_documento_emitido ? `${p.tipo_documento === "factura" ? "Factura" : "Boleta"} N° ${p.numero_documento_emitido}` : <span className="crm-muted">{p.tipo_documento}</span>}</td>
                            <td className="r strong">
                              {CLP(p.monto_total)}
                              {dsc.length > 0 && <span className="crm-desc-mini">−{CLP(dsc.reduce((s, d) => s + (d.monto || 0), 0))}</span>}
                            </td>
                          </tr>
                          {abierto === p.id && (
                            <tr className="crm-detalle">
                              <td colSpan={6}>
                                <div className="crm-detalle-grid">
                                  <div>
                                    <b>Detalle</b>
                                    {its.length ? its.map((i, k) => <div key={k}>{NUM(i.cantidad)} × {i.nombre} · {CLP(i.precio_unit)} = {CLP(i.subtotal)}</div>) : <div className="crm-muted">Sin ítems</div>}
                                    {dsc.map((d, k) => <div key={"d" + k} className="crm-desc">Descuento{d.descripcion ? ` (${d.descripcion})` : ""}: −{CLP(d.monto)}</div>)}
                                  </div>
                                  <div>
                                    <b>Entrega</b>
                                    <div>{domPorId[p.domicilio_id] ? [domPorId[p.domicilio_id].direccion, domPorId[p.domicilio_id].comuna].filter(Boolean).join(", ") : "—"}</div>
                                    {p.observacion && <div className="crm-muted">“{p.observacion}”</div>}
                                    {p.creado_por && <div className="crm-muted">Ingresado por {p.creado_por}</div>}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {!verTodos && peds.length > 15 && <button className="aq-btn-sec crm-mas" onClick={() => setVerTodos(true)}>Ver los {peds.length} pedidos</button>}
              </div>
            )}
          </section>
        </div>

        <div className="crm-col-side">
          <section className="aq-card">
            <h2>Seguimiento comercial</h2>
            <div className="crm-tipos">
              {TIPOS.map((t) => (
                <button key={t.key} className={"crm-tipo " + (tipo === t.key ? "on" : "")} onClick={() => setTipo(t.key)}>{t.icon} {t.label}</button>
              ))}
            </div>
            <textarea rows={3} placeholder={tipo === "tarea" ? "¿Qué hay que hacer?" : "¿Qué conversaron? Acuerdos, necesidades, objeciones…"} value={texto} onChange={(e) => setTexto(e.target.value)} />
            <div className="crm-prox">
              <label>Próximo contacto
                <input type="date" value={prox} min={hoy} onChange={(e) => setProx(e.target.value)} />
              </label>
              <div className="crm-prox-rapido">
                {[[3, "3 días"], [7, "1 semana"], [m.frecuencia_dias || 14, "su frecuencia"]].map(([d, l]) => (
                  <button key={l} className="crm-chip-mini" onClick={() => setProx(sumarDias(hoy, d))}>{l}</button>
                ))}
              </div>
            </div>
            <button className="crm-btn full" disabled={guardando || !texto.trim()} onClick={guardarSeg}>{guardando ? "Guardando…" : "Registrar"}</button>
            {okSeg && <div className={"aq-result " + (okSeg.startsWith("Error") ? "bad" : "ok")}>{okSeg}</div>}

            <div className="crm-timeline">
              {seg.length === 0 && <p className="crm-muted">Aún no hay seguimiento registrado para este cliente.</p>}
              {seg.map((s) => {
                const t = tipoInfo(s.tipo);
                const venc = !s.completado && s.proximo_contacto && s.proximo_contacto < hoy;
                return (
                  <div key={s.id} className={"crm-tl-item" + (s.completado ? " done" : "")}>
                    <span className="crm-tl-icon">{t.icon}</span>
                    <div className="crm-tl-body">
                      <div className="crm-tl-meta">{t.label} · {fecha(s.created_at)}{s.creado_por ? ` · ${s.creado_por}` : ""}</div>
                      <div className="crm-tl-txt">{s.texto}</div>
                      {s.proximo_contacto && (
                        <div className={"crm-tl-prox" + (venc ? " bad" : "")}>
                          {s.completado ? `✓ Hecho${s.completado_por ? " por " + s.completado_por : ""}` : `Próximo contacto: ${s.proximo_contacto === hoy ? "hoy" : fecha(s.proximo_contacto)}${venc ? " (vencido)" : ""}`}
                          {!s.completado && <button className="crm-chip-mini" onClick={() => completar(s)}>Marcar hecho</button>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {productos.length > 0 && (
            <section className="aq-card">
              <h2>Lo que compra</h2>
              {productos.slice(0, 6).map((p) => (
                <div key={p.nombre} className="crm-prod">
                  <div><strong>{p.nombre}</strong><span>{p.veces} pedido(s) · {CLP(p.monto)}</span></div>
                  <b>{NUM(p.unidades)} u.</b>
                </div>
              ))}
            </section>
          )}

          {(cliente.notas || domicilios.length > 0) && (
            <section className="aq-card">
              <h2>Datos del cliente</h2>
              {domicilios.map((d) => (
                <div key={d.id} className="crm-dom">📍 {[d.direccion, d.comuna].filter(Boolean).join(", ")}{d.identificador_dt ? <span> · {d.identificador_dt}</span> : null}</div>
              ))}
              {cliente.notas && <p className="crm-notas">{cliente.notas}</p>}
            </section>
          )}
        </div>
      </div>
    </>
  );
}

const crmCss = `
.crm-hero { background:linear-gradient(135deg,var(--navy) 0%,#2b4a9a 100%); color:#fff; border-radius:18px; padding:22px 24px; display:flex; flex-direction:column; gap:18px; }
.crm-eyebrow { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#b9c9ec; font-weight:700; }
.crm-title { font-family:'Fraunces',serif; font-weight:600; font-size:26px; margin:4px 0 2px; color:#fff; text-transform:none; letter-spacing:0; }
.crm-sub { margin:0; color:#d3ddf2; font-size:14px; }
.crm-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; }
.crm-kpi { background:#fff; color:var(--ink); border:1px solid var(--line); border-radius:13px; padding:12px 14px; display:flex; flex-direction:column; gap:2px; }
.crm-hero .crm-kpi { background:rgba(255,255,255,.1); border-color:rgba(255,255,255,.16); color:#fff; }
.crm-kpi.click { cursor:pointer; }
.crm-kpi.click:hover { background:rgba(255,255,255,.18); }
.crm-kpi-label { font-size:11px; text-transform:uppercase; letter-spacing:.07em; font-weight:700; opacity:.75; }
.crm-kpi-valor { font-size:22px; font-weight:700; font-variant-numeric:tabular-nums; }
.crm-kpi-nota { font-size:12px; opacity:.75; }
.crm-kpi.warn .crm-kpi-valor { color:#b26a00; }
.crm-kpi.bad .crm-kpi-valor { color:var(--bad); }
.crm-hero .crm-kpi.warn .crm-kpi-valor { color:#ffd27a; }
.crm-hero .crm-kpi.bad .crm-kpi-valor { color:#ffb4ad; }
.crm-kpis-ficha .crm-kpi-valor { font-size:19px; color:var(--navy); }
.crm-muted { color:var(--muted); font-size:13px; }
.crm-toolbar { display:flex; gap:10px; flex-wrap:wrap; }
.crm-search { flex:1 1 320px; }
.crm-select { flex:0 0 220px; width:auto; }
.crm-chips { display:flex; gap:6px; flex-wrap:wrap; margin:12px 0 10px; }
.crm-chip { border:1px solid var(--line); background:#fff; color:var(--ink); font:inherit; font-size:13px; padding:6px 12px; border-radius:20px; cursor:pointer; }
.crm-chip b { margin-left:4px; color:var(--muted); font-weight:600; }
.crm-chip.on { background:var(--navy); border-color:var(--navy); color:#fff; }
.crm-chip.on b { color:#c9d6f0; }
.crm-tabla-wrap { overflow-x:auto; }
.crm-tabla { width:100%; border-collapse:collapse; font-size:14px; }
.crm-tabla th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); font-weight:700; padding:8px 10px; border-bottom:1px solid var(--line); white-space:nowrap; }
.crm-tabla td { padding:10px; border-bottom:1px solid var(--line); vertical-align:middle; }
.crm-tabla tbody tr { cursor:pointer; }
.crm-tabla tbody tr:hover { background:#f7f9fd; }
.crm-tabla .r { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
.crm-tabla .strong { font-weight:700; color:var(--navy); }
.crm-cli { display:flex; align-items:center; gap:10px; min-width:220px; }
.crm-cli strong { display:block; }
.crm-cli > div > span { display:block; font-size:12px; color:var(--muted); max-width:380px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.crm-avatar { width:34px; height:34px; flex:0 0 34px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; }
.crm-avatar.xl { width:58px; height:58px; flex-basis:58px; font-size:20px; }
.crm-seg { display:inline-block; font-size:12px; font-weight:600; padding:3px 9px; border-radius:20px; white-space:nowrap; }
.seg-activo.crm-seg { background:#e6f4ec; color:#1f7a4d; }
.seg-nuevo.crm-seg { background:#e7effc; color:#2457b3; }
.seg-riesgo.crm-seg { background:#fff1dc; color:#a05a00; }
.seg-inactivo.crm-seg { background:#f1f2f5; color:#5b6575; }
.seg-sin.crm-seg { background:#f6f1fb; color:#6b3fa0; }
.crm-mas { margin-top:12px; }
.crm-agenda { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:8px; }
.crm-agenda-item { display:flex; gap:10px; align-items:flex-start; text-align:left; border:1px solid var(--line); border-left:4px solid var(--blue); background:#fff; border-radius:10px; padding:9px 11px; font:inherit; cursor:pointer; }
.crm-agenda-item:hover { background:#f7f9fd; }
.crm-agenda-item.warn { border-left-color:#e09a1b; }
.crm-agenda-item.bad { border-left-color:var(--bad); }
.crm-agenda-fecha { font-size:12px; font-weight:700; color:var(--navy); min-width:46px; }
.crm-agenda-item.bad .crm-agenda-fecha { color:var(--bad); }
.crm-agenda-txt { display:flex; flex-direction:column; font-size:13px; min-width:0; }
.crm-agenda-txt span { color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.crm-volver { align-self:flex-start; background:none; border:none; color:var(--blue); font:inherit; font-weight:600; cursor:pointer; padding:0; }
.crm-ficha-head { background:#fff; border:1px solid var(--line); border-radius:16px; padding:18px 20px; display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.crm-ficha-id { display:flex; gap:14px; align-items:flex-start; }
.crm-ficha-tags { display:flex; gap:6px; flex-wrap:wrap; }
.crm-tag-top { font-size:12px; font-weight:700; padding:3px 9px; border-radius:20px; background:#fff6d6; color:#8a6400; }
.crm-ficha-nombre { font-family:'Fraunces',serif; font-size:24px; font-weight:600; margin:6px 0 0; color:var(--ink); text-transform:none; letter-spacing:0; }
.crm-ficha-detalle { margin:2px 0 0; color:var(--muted); font-size:14px; }
.crm-contacto { display:flex; gap:14px; flex-wrap:wrap; margin-top:8px; font-size:13px; color:var(--muted); }
.crm-contacto a { color:var(--navy); text-decoration:none; font-weight:600; }
.crm-contacto a:hover { text-decoration:underline; }
.crm-ficha-acciones { display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap; }
.crm-btn { background:var(--navy); color:#fff; border:none; font:inherit; font-weight:700; font-size:14px; padding:9px 16px; border-radius:10px; cursor:pointer; }
.crm-btn:hover:not(:disabled) { background:#16265a; }
.crm-btn:disabled { opacity:.5; cursor:not-allowed; }
.crm-btn.full { width:100%; margin-top:10px; }
.crm-cols { display:grid; grid-template-columns:minmax(0,1fr) 360px; gap:14px; align-items:start; }
.crm-col-main, .crm-col-side { display:flex; flex-direction:column; gap:14px; min-width:0; }
.crm-barras { display:grid; grid-template-columns:repeat(12,1fr); gap:6px; height:170px; align-items:end; }
.crm-barra { display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; gap:4px; }
.crm-barra-fill { width:100%; max-width:34px; background:linear-gradient(180deg,#5B8DB8,#1B2F6E); border-radius:6px 6px 2px 2px; min-height:2px; }
.crm-barra-val { font-size:11px; color:var(--muted); font-variant-numeric:tabular-nums; }
.crm-barra-mes { font-size:11px; color:var(--muted); text-transform:capitalize; }
.crm-hist td { font-size:13px; }
.crm-hist td:first-child { white-space:nowrap; }
.crm-hist tr.open { background:#f3f7fd; }
.crm-guia { font-weight:600; color:var(--navy); }
.crm-tag-fine { margin-left:6px; font-size:10px; font-weight:700; background:#eef1f7; color:var(--muted); padding:2px 6px; border-radius:6px; }
.crm-prods { max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--muted); }
.crm-pago { font-size:12px; font-weight:600; padding:2px 8px; border-radius:20px; white-space:nowrap; }
.crm-pago.ok { background:#e6f4ec; color:#1f7a4d; }
.crm-pago.pend { background:#fdecea; color:var(--bad); }
.crm-pill-bad { font-size:12px; font-weight:700; background:#fdecea; color:var(--bad); padding:4px 10px; border-radius:20px; }
.crm-desc-mini { display:block; font-size:11px; color:var(--bad); font-weight:600; }
.crm-detalle td { background:#f7f9fd; cursor:default; }
.crm-detalle-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; font-size:13px; line-height:1.6; }
.crm-desc { color:var(--bad); }
.crm-tipos { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
.crm-tipo { border:1px solid var(--line); background:#fff; font:inherit; font-size:12px; padding:5px 9px; border-radius:8px; cursor:pointer; }
.crm-tipo.on { border-color:var(--navy); background:#eef2fb; color:var(--navy); font-weight:700; }
.crm-prox { display:flex; flex-direction:column; gap:6px; margin-top:10px; }
.crm-prox label { display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--muted); font-weight:600; }
.crm-prox-rapido { display:flex; gap:6px; flex-wrap:wrap; }
.crm-chip-mini { border:1px dashed var(--blue); background:#f3f8fc; color:var(--navy); font:inherit; font-size:11px; padding:3px 8px; border-radius:14px; cursor:pointer; }
.crm-timeline { margin-top:16px; display:flex; flex-direction:column; gap:12px; }
.crm-tl-item { display:flex; gap:10px; }
.crm-tl-item.done { opacity:.6; }
.crm-tl-icon { width:30px; height:30px; flex:0 0 30px; border-radius:50%; background:#eef2fb; display:inline-flex; align-items:center; justify-content:center; font-size:14px; }
.crm-tl-body { flex:1; min-width:0; border-bottom:1px solid var(--line); padding-bottom:10px; }
.crm-tl-meta { font-size:11px; color:var(--muted); }
.crm-tl-txt { font-size:14px; margin-top:2px; white-space:pre-wrap; word-break:break-word; }
.crm-tl-prox { font-size:12px; color:var(--navy); font-weight:600; margin-top:6px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.crm-tl-prox.bad { color:var(--bad); }
.crm-prod { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--line); font-size:14px; }
.crm-prod span { display:block; font-size:12px; color:var(--muted); }
.crm-prod b { color:var(--navy); white-space:nowrap; }
.crm-dom { font-size:13px; padding:4px 0; }
.crm-dom span { color:var(--muted); }
.crm-notas { font-size:13px; background:#fffbea; border:1px solid #f5e3a3; border-radius:8px; padding:8px 10px; white-space:pre-wrap; }
@media (max-width: 900px) {
  .crm-cols { grid-template-columns:1fr; }
  .crm-select { flex:1 1 100%; }
  .crm-detalle-grid { grid-template-columns:1fr; }
  .crm-title { font-size:22px; }
  .crm-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .crm-kpi-valor { font-size:18px; }
  .crm-hero, .crm-ficha-head { padding:16px; }
}
`;
