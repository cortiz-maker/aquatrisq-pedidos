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

// Mensaje que ve el operador y que se envía por correo al cliente.
function mensajeConfirmacion(guia) {
  return [
    `Hola! Tu Pedido Nº ${guia} ya fue ingresado a la agenda para ser despachado.`,
    `-`,
    `Síguenos en nuestro instagram y no olvides subirnos *@aquatrisq y déjanos tu opinión* 💦💙`,
    `-`,
    `🟡*Importante:*🟡`,
    `- Si estas *agendando recargas* recuerda que debes entregar *la misma cantidad de bidones*.`,
    `- Los despachos podrían sufrir modificaciones con respecto al día de entrega, de ser el caso *será avisado mediante este mismo medio*, y confirmado por este medio.`,
  ].join("\n");
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

  // Navegación entre vistas: inicio (dashboard) | nuevo | mantenedor | confirmacion
  const [vista, setVista] = useState("inicio");
  const [confirma, setConfirma] = useState(null); // { guia, mensaje, emailEnviado, emailDestino, sync }

  // ── Autenticación (Supabase Auth) ──────────────────────────
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [rol, setRol] = useState(null);           // admin | operador | gerencial
  const [perfilNombre, setPerfilNombre] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [logueando, setLogueando] = useState(false);

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

  // Mantenedor de bloqueo
  const [buscarMant, setBuscarMant] = useState("");
  const [clienteMant, setClienteMant] = useState(null);
  const [domMant, setDomMant] = useState(null);
  const [bloqMant, setBloqMant] = useState(false);
  const [motivoMant, setMotivoMant] = useState("");
  const [operadorMant, setOperadorMant] = useState("");
  const [guardandoMant, setGuardandoMant] = useState(false);
  const [okMant, setOkMant] = useState("");

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
      try {
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
      } catch (e) {
        setErrorCarga(e.message || "No se pudieron cargar los catálogos.");
      } finally {
        setCargando(false);
      }
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
      setPedidosMes(data || []);
    } catch (e) {
      setErrorDash(e.message || "No se pudo cargar el período.");
      setPedidosMes([]);
    } finally {
      setCargandoDash(false);
    }
  }
  useEffect(() => {
    if (vista === "inicio") cargarDashboard(periodo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, periodo, credsListas, session]);

  // ── Sesión: detectar login, cargar rol del perfil ──────────
  useEffect(() => {
    if (!credsListas) { setAuthReady(true); return; }
    let activo = true;
    async function cargarPerfil(sess) {
      if (!sess) { setRol(null); setPerfilNombre(""); return; }
      const { data } = await supabase
        .from("perfiles")
        .select("rol, nombre, activo")
        .eq("id", sess.user.id)
        .maybeSingle();
      if (!activo) return;
      if (data && data.activo) {
        setRol(data.rol);
        setPerfilNombre(data.nombre || sess.user.email);
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
      setLoginError(e.message || "No se pudo iniciar sesión.");
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
    if (rol === "gerencial" && (vista === "nuevo" || vista === "mantenedor")) {
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

      // 6) Mensaje de confirmación + correo al cliente (best-effort)
      const guia = pedido.numero_guia;
      const mensaje = mensajeConfirmacion(guia);
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
      setCliente(null);
      setDomicilioId("");
      setPlanPrepago(null);
      setConsumePlan(false);
      setResultado(null);
    } catch (e) {
      setResultado({ ok: false, msg: "No se pudo guardar: " + (e.message || e) });
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
    return {
      ingresados: ped.length,
      enviados: ped.filter((p) => p.estado_sync === "enviado_dt").length,
      pendientes: ped.filter((p) => p.estado_sync !== "enviado_dt").length,
      entregados: ped.filter((p) => est(p).includes("entreg")).length,
      paraHoy: ped.filter((p) => (p.fecha_min_entrega || "").slice(0, 10) === hoy).length,
      monto: ped.reduce((s, p) => s + (Number(p.monto_total) || 0), 0),
      porCobrar: ped.filter((p) => p.por_cobrar).reduce((s, p) => s + (Number(p.monto_total) || 0), 0),
      tieneEstado: ped.some((p) => p.estado_entrega != null || p.estado != null),
    };
  })();

  const pedidosFiltrados = useMemo(() => {
    const q = buscarPedido.trim().toLowerCase();
    return pedidosMes.filter((p) => {
      if (filtroEstado === "enviados" && p.estado_sync !== "enviado_dt") return false;
      if (filtroEstado === "pendientes" && p.estado_sync === "enviado_dt") return false;
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
            {rol !== "gerencial" && (
              <button className={vista === "mantenedor" ? "on" : ""} onClick={() => setVista("mantenedor")}>Clientes</button>
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

        {/* ===================== INICIO / DASHBOARD ===================== */}
        {credsListas && vista === "inicio" && (
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
                  <div className="aq-kpi">
                    <span>Para hoy</span><strong>{dash.paraHoy}</strong>
                  </div>
                </div>

                <div className="aq-money">
                  <div className="aq-money-card navy">
                    <span>Monto del mes</span>
                    <strong>{CLP(dash.monto)}</strong>
                  </div>
                  <div className="aq-money-card cobrar">
                    <span>Por cobrar</span>
                    <strong>{CLP(dash.porCobrar)}</strong>
                  </div>
                </div>

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
                        return (
                          <div className="aq-tr" key={p.id}>
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
                              {p.por_cobrar && <em className="aq-pc">PC</em>}
                            </span>
                            <span className={"aq-badge " + (p.estado_sync === "enviado_dt" ? "ok" : "warn")}>
                              {p.estado_sync === "enviado_dt" ? "En DT" : "Pend."}
                            </span>
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

                {!dash.tieneEstado && (
                  <p className="aq-muted">
                    El estado “Entregado” se activará cuando conectemos el retorno de DispatchTrack.
                  </p>
                )}
              </>
            )}
          </>
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

        {/* ===================== MANTENEDOR DE CLIENTES ===================== */}
        {credsListas && !cargando && !errorCarga && vista === "mantenedor" && (
          <section className="aq-card">
            <h2>Bloquear / desbloquear cliente</h2>
            {!clienteMant ? (
              <div className="aq-search">
                <input
                  placeholder="Buscar por identificador (0004-1), nombre, dirección o RUT"
                  value={buscarMant}
                  onChange={(e) => setBuscarMant(e.target.value)}
                  autoFocus
                />
                {resultadosMant.length > 0 && (
                  <ul className="aq-results">
                    {resultadosMant.map((r) => (
                      <li
                        key={r.cliente.id + "|" + (r.dom?.id || "")}
                        onClick={() => elegirMant(r)}
                        className={r.cliente.bloqueado ? "aq-li-alerta" : ""}
                      >
                        <strong>{r.cliente.bloqueado ? "⚠ " : ""}{r.cliente.nombre}</strong>
                        <span>
                          {r.dom?.identificador_dt
                            ? r.dom.identificador_dt + " · " + (r.dom.direccion || "")
                            : (r.cliente.codigo_cliente || r.cliente.rut || "")}
                          {r.cliente.bloqueado ? " · bloqueado" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="aq-mant">
                <div className="aq-chosen">
                  <div>
                    <strong>{clienteMant.nombre}</strong>
                    <span>
                      {domMant?.identificador_dt
                        ? domMant.identificador_dt + " · " + (domMant.direccion || "")
                        : (clienteMant.codigo_cliente || clienteMant.rut || "")}
                    </span>
                  </div>
                  <button className="aq-link" onClick={() => { setClienteMant(null); setDomMant(null); setOkMant(""); }}>Cambiar</button>
                </div>
                <p className="aq-muted" style={{ marginTop: 6 }}>
                  El bloqueo aplica a todo el cliente y sus domicilios.
                </p>
                <label className="aq-check" style={{ marginTop: 14 }}>
                  <input type="checkbox" checked={bloqMant} onChange={(e) => setBloqMant(e.target.checked)} />
                  Cliente bloqueado para comprar
                </label>
                {bloqMant && (
                  <>
                    <label className="aq-full">
                      Motivo del bloqueo
                      <textarea rows="2" value={motivoMant} onChange={(e) => setMotivoMant(e.target.value)} placeholder="Ej: Bloqueo por no pago" />
                    </label>
                    <label className="aq-full">
                      Operador
                      <input value={operadorMant} onChange={(e) => setOperadorMant(e.target.value)} placeholder="Tu nombre" />
                    </label>
                  </>
                )}
                <button className="aq-btn" disabled={guardandoMant} onClick={guardarBloqueo} style={{ marginTop: 14 }}>
                  {guardandoMant ? "Guardando…" : "Guardar"}
                </button>
                {okMant && <div className={"aq-result " + (okMant.startsWith("Error") ? "bad" : "ok")}>{okMant}</div>}
              </div>
            )}
          </section>
        )}

        {/* ===================== NUEVO PEDIDO ===================== */}
        {credsListas && !cargando && !errorCarga && vista === "nuevo" && (
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
                <>
                  <div className="aq-chosen">
                    <div>
                      <strong>{cliente.nombre}</strong>
                      <span>{cliente.rut || cliente.codigo_cliente}{cliente.es_empresa ? " · empresa" : ""}</span>
                    </div>
                    <button className="aq-link" onClick={() => { setCliente(null); setItems([]); setDescuentos([]); }}>
                      Cambiar
                    </button>
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
@media (prefers-reduced-motion: reduce) { * { animation:none !important; transition:none !important; } }
`;
