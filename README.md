# Estudio Bamboleo · PWA

App mobile-first (PWA) para reservas de clases y venta de pases de Estudio Bamboleo.
React + Vite + TypeScript + Tailwind CSS + Lucide + Supabase.

## Puesta en marcha

1. En Supabase → SQL Editor, pegá y ejecutá `supabase_schema.sql`.
2. Copiá `.env.example` a `.env` y completá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. `npm install` y `npm run dev`.
4. Registrate en la app y promové tu usuario a admin (al final de `supabase_schema.sql` está la consulta).

## Despliegue en Vercel

Importá el repositorio en Vercel (framework: Vite) y cargá las variables
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. `vercel.json` ya incluye el rewrite SPA.

## Precios (lista "Abonos a partir de Octubre")

| Pack | Pases | Precio |
|---|---|---|
| Clase suelta | 1 | $15.000 |
| Pack 4 pases (1 vez por semana) | 4 | $40.000 |
| Pack 8 pases Nivel Inicial / Desde Cero | 8 | $50.000 |
| Pack 8 pases General (2 veces por semana) | 8 | $60.000 |
| Pack 12 pases (abono 2x + extra 1x) | 12 | $85.000 |
| Pack 16 pases (abono 2x + extra 2x) | 16 | $90.000 |
| Pase Libre | 48 | $160.000 |

Alias de transferencia: `ESTUDIO.BAMBOLEO`. Los precios y el alias se editan desde Admin → Precios.

Producción: desplegado en Vercel (proyecto `estudio-bamboleo`), se actualiza con cada push a `main`.
