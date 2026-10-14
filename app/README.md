# Fly Punch · app (Vite + React)

Un cerebro real de mosca (818 neuronas del conectoma FlyWire, modelo de Shiu et al. 2024) toca el K.O. II (EP-133) por MIDI.

```bash
cd app
npm install
npm run dev      # http://localhost:5173 · usar Chrome o Edge (Web MIDI)
npm run build    # genera dist/ estático (base relativa)
```

## Estructura
- `src/engine/` — sin React: `sim.js` (LIF), `midi.js` (K.O. II: notas, reloj in/out, CC), `session.js` (pistas, paso de semicorchea, grabación), `synth.js` (voces internas + WAV), `midifile.js` (exportar .mid/.csv), `mutate.js` (Mutar por registro), `storage.js` (IndexedDB), `ear.js` (micrófono/archivo → 3 bandas), `data.js` (CSV).
- `src/pages/` — Estudio, Oído, Datos, Sonido, Tomas, Cuenta, Bienvenida.
- `public/data/` — circuito (818 neuronas) y nube del cerebro.

## Ajustes en el K.O. II (SHIFT + ERASE, código, ENTER)
110 recibir todos los canales · 101 recibir reloj (Fly Punch maestro) · 102 enviar reloj · 100 sin reloj.

## Publicar (Vercel, capa gratuita)
1. vercel.com → Add New → Project → importa `romangsweb/mosca`.
2. **Root Directory: `app`** (el resto lo toma de `vercel.json`).
3. Deploy. Luego Settings → Domains → agrega el subdominio y crea en tu DNS el CNAME que indique Vercel.

Hoy todo se guarda en el navegador (IndexedDB); no necesita base de datos ni variables de entorno.

## Cuentas (Supabase, capa gratuita)
1. Crea un proyecto en supabase.com y ejecuta `../supabase/migrations/20261014_0001_profiles.sql` en el SQL Editor.
2. Authentication → URL Configuration: Site URL `https://flypunch.buildations.com`; Redirect URLs `https://flypunch.buildations.com/**`, `http://localhost:5173/**`.
3. Authentication → Providers → Google: activa con el Client ID/Secret de Google Cloud (OAuth, tipo Web, redirect `https://TU-PROYECTO.supabase.co/auth/v1/callback`).
4. Copia la URL y la clave **anon** (Project Settings → API) a `app/.env.local` y a Cloudflare Pages → Settings → Variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Nunca uses la clave `service_role` en la app.
