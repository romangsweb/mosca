// Fly Punch · webhook de Paddle → plan Pro en Supabase.
// Paddle avisa cada cambio de suscripción; aquí se verifica la firma y se actualiza el perfil.
// Secretos (Supabase → Edge Functions → Secrets): PADDLE_WEBHOOK_SECRET. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen.
// Se despliega SIN verificación de JWT (Paddle no manda token de Supabase): la firma HMAC es la autenticación.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const SECRET = Deno.env.get('PADDLE_WEBHOOK_SECRET') ?? '';
const PRO = new Set(['active', 'trialing', 'past_due']); // past_due: Paddle sigue reintentando el cobro, no cortamos de golpe

async function hmacHex(key: string, msg: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const safeEq = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

async function verify(req: Request, raw: string) {
  const h = req.headers.get('paddle-signature') ?? '';
  const parts = Object.fromEntries(h.split(';').map((p) => p.split('=') as [string, string]));
  const ts = Number(parts.ts), h1s = h.split(';').filter((p) => p.startsWith('h1=')).map((p) => p.slice(3));
  if (!SECRET || !ts || !h1s.length) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false; // más de 5 minutos: posible repetición
  const mine = await hmacHex(SECRET, `${ts}:${raw}`);
  return h1s.some((x) => safeEq(x, mine));
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const raw = await req.text();
  if (!(await verify(req, raw))) return new Response('firma inválida', { status: 401 });
  const ev = JSON.parse(raw), d = ev.data ?? {}, type: string = ev.event_type ?? '';
  if (!type.startsWith('subscription.') && type !== 'transaction.completed') return new Response('ignorado');

  // ¿de quién es? user_id viaja en custom_data desde el checkout; si no, por el cliente de Paddle
  let uid: string | null = d.custom_data?.user_id ?? null;
  if (!uid && d.customer_id) { const { data } = await db.from('profiles').select('id').eq('paddle_customer_id', d.customer_id).maybeSingle(); uid = data?.id ?? null; }
  if (!uid) return new Response('sin usuario', { status: 200 }); // 200: no queremos reintentos infinitos

  const { error: dup } = await db.from('paddle_events').insert({ id: ev.event_id, type, user_id: uid });
  if (dup?.code === '23505') return new Response('repetido');

  const at = ev.occurred_at ?? new Date().toISOString();
  const { data: prof } = await db.from('profiles').select('plan_event_at').eq('id', uid).maybeSingle();
  if (prof?.plan_event_at && new Date(prof.plan_event_at) > new Date(at)) return new Response('viejo');

  const patch: Record<string, unknown> = { plan_event_at: at };
  if (d.customer_id) patch.paddle_customer_id = d.customer_id;
  if (type.startsWith('subscription.')) {
    const interval = d.items?.[0]?.price?.billing_cycle?.interval;
    Object.assign(patch, {
      paddle_subscription_id: d.id, plan_status: d.status, plan: PRO.has(d.status) ? 'pro' : 'free',
      plan_cycle: interval === 'year' ? 'año' : interval === 'month' ? 'mes' : null,
      plan_renews_at: d.current_billing_period?.ends_at ?? d.next_billed_at ?? null,
      plan_cancel_at: d.scheduled_change?.action === 'cancel' ? d.scheduled_change.effective_at : null,
    });
  } else if (d.subscription_id) { // transaction.completed: el primer pago llega a veces antes que subscription.created
    Object.assign(patch, { paddle_subscription_id: d.subscription_id, plan: 'pro', plan_status: 'active' });
  }
  const { error } = await db.from('profiles').update(patch).eq('id', uid);
  if (error) { await db.from('paddle_events').delete().eq('id', ev.event_id); return new Response(error.message, { status: 500 }); } // 500: que Paddle reintente
  return new Response('ok');
});
