import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { PUENTE_URL, SUPABASE_URL } from "./config.js";

// ── Valores de enums (tal cual están en Postgres) ────────────
const TIPOS_PAGO = ["Efectivo", "Transferencia", "Tarjeta", "Debito", "Plan PrePago", "Por Cobrar"];
const TIPOS_DOC = ["boleta", "factura", "sin_documento"];
const MARCAS = ["TrisQ", "Positive", "AguaFine"];
// Origen de un descuento manual en pedido_descuentos (texto libre, pero acotamos).
const ORIGENES_DESC = ["cliente", "volumen", "plan", "combo", "manual"];

const CLP = (n) =>
  "$" + (Number(n) || 0).toLocaleString("es-CL", { maximumFractionDigits: 0 });

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
  const [marca, setMarca] = useState("");
  const [fechaMin, setFechaMin] = useState("");
  const [fechaMax, setFechaMax] = useState("");
  const [observacion, setObservacion] = useState("");
  const [creadoPor, setCreadoPor] = useState("");

  // Guardado
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok, guia, sync, msg }

  // ── Carga inicial de catálogos ─────────────────────────────
  useEffect(() => {
    if (!credsListas) {
      setCargando(false);
      return;
    }
    (async () => {
      try {
        const [c, p, t, d] = await Promise.all([
          supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
          supabase.from("productos").select("*").eq("activo", true).order("nombre"),
          supabase.from("precio_tramos").select("*"),
          supabase.from("domicilios").select("id,cliente_id,identificador_dt,etiqueta,direccion,comuna,es_principal").eq("activo", true),
        ]);
        if (c.error) throw c.error;
        if (p.error) throw p.error;
        if (t.error) throw t.error;
        if (d.error) throw d.error;
        setClientes(c.data || []);
        setProductos(p.data || []);
        setTramos(t.data || []);
        setTodosDomicilios(d.data || []);
      } catch (e) {
        setErrorCarga(e.message || "No se pudieron cargar los catálogos.");
      } finally {
        setCargando(false);
      }
    })();
  }, [credsListas]);

  // ── Al elegir cliente: domicilios + plan + descuentos ──────
  async function elegirCliente(c, domPreseleccionarId) {
    setCliente(c);
    setBuscarCliente("");
    setDomicilioId("");
    setPlanPrepago(null);
    setConsumePlan(false);
    setMarca(c.marca || "");
    setRutFactura(c.rut || "");
    setTipoDocumento(c.es_empresa ? "factura" : "boleta");

    const [dom, plan, dc] = await Promise.all([
      supabase.from("domicilios").select("*").eq("cliente_id", c.id).eq("activo", true).order("es_principal", { ascending: false }),
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
  }

  // Resultados de búsqueda: por datos del cliente (nombre/RUT/código) y
  // también por el identificador del domicilio (ej. 215-1).
  const resultadosBusqueda = useMemo(() => {
    const q = buscarCliente.trim().toLowerCase();
    if (!q) return [];
    const porCliente = clientes
      .filter(
        (c) =>
          (c.nombre || "").toLowerCase().includes(q) ||
          (c.rut || "").toLowerCase().includes(q) ||
          (c.codigo_cliente || "").toLowerCase().includes(q)
      )
      .map((c) => ({ cliente: c, dom: null }));

    // Coincidencias por identificador_dt del domicilio (215-1)
    const porDomicilio = todosDomicilios
      .filter((d) => (d.identificador_dt || "").toLowerCase().includes(q))
      .map((d) => ({ cliente: clientes.find((c) => c.id === d.cliente_id), dom: d }))
      .filter((r) => r.cliente);

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
  async function guardarPedido() {
    const err = validar();
    if (err) {
      setResultado({ ok: false, msg: err });
      return;
    }
    setGuardando(true);
    setResultado(null);

    try {
      // 1) Cabecera. numero_guia lo genera la función siguiente_numero_aq().
      const cabecera = {
        cliente_id: cliente.id,
        domicilio_id: domicilioId,
        fecha_min_entrega: fechaMin ? new Date(fechaMin).toISOString() : null,
        fecha_max_entrega: fechaMax ? new Date(fechaMax).toISOString() : null,
        marca: marca || null,
        tipo_pago: tipoPago,
        por_cobrar: tipoPago === "Por Cobrar",
        tipo_documento: tipoDocumento,
        rut_factura: tipoDocumento === "factura" ? rutFactura.trim() : null,
        monto_total: montoTotal,
        origen: "formulario",
        observacion: observacion.trim() || null,
        estado_sync: "pendiente",
        creado_por: creadoPor.trim() || null,
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
          // 'subtotal' es columna generada en la base (cantidad * precio_unit);
          // Postgres la calcula sola, por eso no la enviamos.
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

      setResultado({
        ok: true,
        guia: pedido.numero_guia,
        sync,
        msg: `Pedido ${pedido.numero_guia} guardado. ${avisoSync}${avisoPlan}`,
      });

      // Reset de la parte transaccional, conservando al cliente.
      setItems([]);
      setDescuentos([]);
      setObservacion("");
      // refrescar saldo del plan
      if (cliente) elegirCliente(cliente);
    } catch (e) {
      setResultado({ ok: false, msg: "No se pudo guardar: " + (e.message || e) });
    } finally {
      setGuardando(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="aq">
      <style>{css}</style>

      <header className="aq-header">
        <div className="aq-brand">
          <span className="aq-mark" aria-hidden>≋</span>
          <div>
            <h1>Aquatrisq</h1>
            <p>Crear pedido</p>
          </div>
        </div>
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

        {credsListas && !cargando && !errorCarga && (
          <>
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
                              ? r.dom.identificador_dt + " · " + (r.dom.direccion || "")
                              : (r.cliente.rut || r.cliente.codigo_cliente)}
                            {r.cliente.es_empresa ? " · empresa" : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="aq-chosen">
                  <div>
                    <strong>{cliente.nombre}</strong>
                    <span>{cliente.rut || cliente.codigo_cliente}{cliente.es_empresa ? " · empresa" : ""}</span>
                  </div>
                  <button className="aq-link" onClick={() => { setCliente(null); setItems([]); setDescuentos([]); }}>
                    Cambiar
                  </button>
                </div>
              )}
            </section>

            {cliente && cliente.bloqueado && (
              <div className="aq-alerta-cliente">
                <strong>⚠ Cliente con alerta</strong>
                <p>{cliente.motivo_bloqueo || "Cliente marcado para revisión."}</p>
                <span>Revisa antes de continuar con el pedido.</span>
              </div>
            )}

            {cliente && (
              <>
                {/* Domicilio */}
                <section className="aq-card">
                  <h2>Domicilio de entrega</h2>
                  {domicilios.length === 0 ? (
                    <p className="aq-muted">Este cliente no tiene domicilios cargados.</p>
                  ) : (
                    <select value={domicilioId} onChange={(e) => setDomicilioId(e.target.value)}>
                      {domicilios.map((d) => (
                        <option key={d.id} value={d.id}>
                          {(d.etiqueta ? d.etiqueta + " · " : "") + d.direccion + (d.comuna ? ", " + d.comuna : "")}
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

                {/* Descuentos */}
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

                {/* Documento y pago */}
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

                {/* Entrega y notas */}
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
                      Operador
                      <input value={creadoPor} onChange={(e) => setCreadoPor(e.target.value)} placeholder="Tu nombre" />
                    </label>
                  </div>
                  <label className="aq-full">
                    Observación
                    <textarea rows="2" value={observacion} onChange={(e) => setObservacion(e.target.value)} />
                  </label>
                </section>

                {/* Resumen */}
                <section className="aq-card aq-resumen">
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

                  {errorValidacion && <p className="aq-hint">{errorValidacion}</p>}

                  <button className="aq-btn" disabled={!!errorValidacion || guardando} onClick={guardarPedido}>
                    {guardando ? "Guardando…" : "Guardar pedido"}
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
.aq-brand { display:flex; align-items:center; gap:14px; max-width:760px; margin:0 auto; }
.aq-mark { font-size:30px; color:var(--blue); line-height:1; }
.aq-header h1 { font-family:'Fraunces',serif; font-weight:600; font-size:22px; margin:0; letter-spacing:.2px; }
.aq-header p { margin:0; font-size:13px; color:#c5d2e8; }
.aq-main { max-width:760px; margin:0 auto; padding:18px 16px 60px; display:flex; flex-direction:column; gap:14px; }
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
@media (max-width:560px) {
  .aq-grid { grid-template-columns:1fr; }
  .aq-item { grid-template-columns: 1fr 56px 80px 28px; }
  .aq-item .aq-sub { display:none; }
  .aq-desc { grid-template-columns: 1fr 80px 28px; }
  .aq-desc select { grid-column:1 / -1; }
}
@media (prefers-reduced-motion: reduce) { * { animation:none !important; transition:none !important; } }
`;
