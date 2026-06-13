// ============================================================
// Configuración. Pega aquí tus valores, o (mejor) configúralos
// como variables de entorno en Vercel con el prefijo VITE_.
//
// La anon key de Supabase es pública por diseño (va al navegador),
// así que es seguro tenerla en el build del frontend. NO uses aquí
// el service_role: ese solo vive en el puente (Railway).
// ============================================================

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://yzjnmnzbkykkqhefqekp.supabase.co";

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6am5tbnpia3lra3FoZWZxZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMDY0MzAsImV4cCI6MjA5Njg4MjQzMH0.OXCwLwpR2dra4QeQaMmnJ9yhtG9YHPpCP05T4TdWVtc";;

export const PUENTE_URL =
  import.meta.env.VITE_PUENTE_URL ||
  "https://aquatrisq-production.up.railway.app";
