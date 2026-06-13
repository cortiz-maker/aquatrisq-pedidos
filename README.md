# Aquatrisq — Pedidos

Formulario de pedidos (uso interno). React + Vite + Supabase, desplegable en Vercel.

## Configurar
Pega tus credenciales en `src/config.js`, o configúralas en Vercel como
variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_PUENTE_URL`. La anon key es pública (va al navegador); el service_role
NO va aquí, solo en el puente.

## Local
```
npm install
npm run dev
```

## Vercel
Importa el repo. Framework: Vite. Build: `npm run build`. Output: `dist`.
Carga las variables VITE_ en Project Settings → Environment Variables.
