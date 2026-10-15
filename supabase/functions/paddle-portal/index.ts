// Fly Punch · enlace al portal de Paddle para administrar la suscripción (cambiar tarjeta, facturas, cancelar).
// Requiere sesión de Supabase. Secretos: PADDLE_API_KEY y PADDLE_ENV ('sandbox' o 'production').
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const URL_ = Deno.env.get('SUPABASE_URL')!, API = Deno.env.get('PADDLE_ENV') === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const auth = req.headers.get('Authorization') ?? '';
  const user = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await user.auth.getUser(); if (!u?.user) return json({ error: 'sin sesión' }, 401);
  const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: p } = await admin.from('profiles').select('paddle_customer_id, paddle_subscription_id').eq('id', u.user.id).maybeSingle();
  if (!p?.paddle_customer_id) return json({ error: 'sin suscripción' }, 404);
  const r = await fetch(`${API}/customers/${p.paddle_customer_id}/portal-sessions`, {
    method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('PADDLE_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(p.paddle_subscription_id ? { subscription_ids: [p.paddle_subscription_id] } : {}),
  });
  const out = await r.json(); if (!r.ok) return json({ error: out?.error?.detail ?? 'paddle' }, 502);
  return json({ url: out.data?.urls?.general?.overview });
});
