// ============================================================
// Configuración. Pega aquí tus valores, o (mejor) configúralos
// como variables de entorno en Vercel con el prefijo VITE_.
//
// La anon key de Supabase es pública por diseño (va al navegador),
// así que es seguro tenerla en el build del frontend. NO uses aquí
// el service_role: ese solo vive en el puente (Railway).
// ============================================================

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || https://yzjnmnzbkykkqhefqekp.supabase.co/rest/v1/;;

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGc...tu-llave-larga";;

export const PUENTE_URL =
  import.meta.env.VITE_PUENTE_URL ||
  "https://aquatrisq-production.up.railway.app";
