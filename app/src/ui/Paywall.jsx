import { useState } from 'react';
import { session, PRO_FEATURES } from '../engine/session.js';
import { useS, Icon } from './kit.jsx';

const daysLeft = (t) => Math.max(0, Math.ceil((t - Date.now()) / 86400000));

// Llamado a Pro: explica qué abre, y ofrece la prueba de 7 días (o iniciar sesión para tenerla).
export function Paywall({ feature, title, children }) {
  const s = useS(), [busy, setBusy] = useState(false), [err, setErr] = useState(null);
  const start = async () => { setBusy(true); setErr(null); try { await session.startTrial(); } catch { setErr('No pudimos activar la prueba. Intenta de nuevo.'); } setBusy(false); };
  return (
    <div className="stage" style={{ minHeight: 420, flexDirection: 'column', gap: 18, textAlign: 'center', padding: 24 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 40%, rgba(255,106,26,.12), transparent 55%)', pointerEvents: 'none' }} />
      <span className="badge-pro" style={{ position: 'relative', fontSize: 10, padding: '4px 10px' }}>PRO</span>
      <h2 style={{ position: 'relative', fontSize: 24, letterSpacing: '-.02em', maxWidth: 520 }}>{title || PRO_FEATURES[feature]}</h2>
      {children && <p style={{ position: 'relative', margin: 0, color: '#A6A6AE', maxWidth: 520, lineHeight: 1.6 }}>{children}</p>}
      <ul style={{ position: 'relative', listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
        {Object.values(PRO_FEATURES).map((f) => <li key={f} className="row" style={{ color: '#C4C4CA' }}><span style={{ color: '#FF6A1A' }}><Icon name="check" size={16} stroke={2.4} /></span>{f}</li>)}
      </ul>
      <div className="row" style={{ position: 'relative', flexWrap: 'wrap', justifyContent: 'center' }}>
        {session.canTrial && <button type="button" className="btn lg acc" disabled={busy} onClick={start}>{busy ? 'Activando…' : 'Probar Pro 7 días gratis'}</button>}
        {!s.user && s.sync !== 'off' && <a className="btn lg acc" href="#/bienvenida">Crea tu cuenta para probar Pro</a>}
        <a className="btn lg" href="#/cuenta?plan" style={{ color: '#ECECEE', borderColor: 'rgba(255,255,255,.12)' }}>Ver planes</a>
      </div>
      {s.user && s.trialUsed && s.plan !== 'pro' && <p style={{ position: 'relative', margin: 0, color: '#8C8C94', fontSize: 12 }}>Ya usaste tu prueba. El pago de Pro llega pronto.</p>}
      {err && <p role="alert" style={{ position: 'relative', margin: 0, color: '#FF8A4D' }}>{err}</p>}
      <p style={{ position: 'relative', margin: 0, color: '#66666E', fontSize: 11 }}>Sin tarjeta. Al terminar la prueba vuelves a Free y conservas tus tomas.</p>
    </div>
  );
}

export function TrialBadge() {
  const s = useS();
  if (!session.onTrial) return null;
  return <a href="#/cuenta?plan" className="chip acc hide-sm" title="Prueba de Pro">PRO · {daysLeft(s.trialEnds)} DÍAS</a>;
}
export { daysLeft };
