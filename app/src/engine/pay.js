// Fly Punch · pagos con Paddle (checkout en ventana sobre la app). Paddle cobra, factura y paga los impuestos de cada país.
// Variables públicas (no son secretas): VITE_PADDLE_CLIENT_TOKEN, VITE_PADDLE_ENV ('sandbox' | 'production'),
// VITE_PADDLE_PRICE_MES y VITE_PADDLE_PRICE_ANO. El plan lo activa el webhook (supabase/functions/paddle-webhook).
import { cloud } from './cloud.js';

const env = import.meta.env, TOKEN = env.VITE_PADDLE_CLIENT_TOKEN, ENV = env.VITE_PADDLE_ENV || 'sandbox';
export const PRICES = { mes: env.VITE_PADDLE_PRICE_MES, año: env.VITE_PADDLE_PRICE_ANO };
export const payEnabled = !!(TOKEN && PRICES.mes && PRICES.año && cloud);
export const paySandbox = ENV !== 'production';

let ready = null, onEvent = () => {};
function load() {
  if (ready) return ready;
  ready = new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'; s.async = true;
    s.onload = () => { if (paySandbox) window.Paddle.Environment.set('sandbox'); window.Paddle.Initialize({ token: TOKEN, eventCallback: (e) => onEvent(e) }); ok(window.Paddle); };
    s.onerror = () => { ready = null; fail(new Error('No se pudo cargar Paddle')); };
    document.head.appendChild(s);
  });
  return ready;
}
// abre el pago; resuelve 'pagado' cuando Paddle confirma, o 'cerrado' si cierras la ventana
export async function checkout(cycle, user) {
  const P = await load();
  return new Promise((ok) => {
    let paid = false;
    onEvent = (e) => { if (e.name === 'checkout.completed') paid = true; if (e.name === 'checkout.closed') ok(paid ? 'pagado' : 'cerrado'); };
    P.Checkout.open({
      items: [{ priceId: PRICES[cycle], quantity: 1 }],
      customer: user?.email ? { email: user.email } : undefined,
      customData: { user_id: user.id },
      settings: { displayMode: 'overlay', theme: document.documentElement.dataset.theme === 'dia' ? 'light' : 'dark', locale: 'es', allowLogout: false },
    });
  });
}
// portal de Paddle para cambiar tarjeta, ver facturas o cancelar
export async function portal() {
  const { data, error } = await cloud.functions.invoke('paddle-portal', { method: 'POST' });
  if (error || !data?.url) throw error || new Error('sin portal');
  window.open(data.url, '_blank', 'noopener');
}
