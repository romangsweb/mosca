import { useEffect, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { Logo } from '../ui/kit.jsx';
import { cloudEnabled, signInGoogle, signInEmail } from '../engine/cloud.js';

const STEPS = [
  ['usb', 'Conecta tu aparato', 'K.O. II, TR-8S, Digitakt, Ableton o cualquier equipo MIDI: elígelo en la galería de Equipo. En Chrome o Edge. Sin aparato también suena, con sonidos internos.'],
  ['gusto', 'Elige qué siente la mosca', 'Gusto (dulce y amargo), Oído (micrófono o un audio), Olfato (vinagre, CO₂, geosmina), Cortejo (el canto del macho) o Datos (un CSV). Cada sentido enciende un circuito real distinto y toca su propia pista.'],
  ['play', 'Toca', 'Tocar está arriba al centro, junto al tempo (o usa la barra espaciadora). Las neuronas que disparan tocan su pad a tempo.'],
  ['tomas', 'Graba, muta y exporta', 'El punto rojo graba. Mutar reparte las neuronas entre los sonidos de tu kit sin romper la mezcla. Exporta tus tomas a MIDI para cualquier DAW.'],
];

// Fondo generativo: nube del cerebro proyectada que gira despacio, con chispas que disparan
function Field() {
  const cv = useRef(null);
  useEffect(() => {
    const c = cv.current, g = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio), raw = session.cloud;
    const pts = []; for (let i = 0; i < raw.length; i += 3 * 3) pts.push([raw[i] / 10, raw[i + 1] / 10, raw[i + 2] / 10]);
    const cx0 = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy0 = pts.reduce((a, p) => a + p[1], 0) / pts.length, cz0 = pts.reduce((a, p) => a + p[2], 0) / pts.length;
    const sparks = session.D.pos_um.map((p) => [p[0], p[1], p[2], Math.random() * 6]);
    let raf; const draw = (t) => {
      const W = c.clientWidth, H = c.clientHeight; if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const a = t / 26000, ca = Math.cos(a), sa = Math.sin(a), k = Math.min(W * 1.1, H) / 520;
      const proj = (x, y, z) => { x -= cx0; y -= cy0; z -= cz0; const X = x * ca - z * sa, Z = x * sa + z * ca; return [W / 2 - X * k, H * 0.4 - y * k, Z]; };
      g.fillStyle = '#D9DCE1';
      for (const p of pts) { const [x, y, z] = proj(...p); g.globalAlpha = 0.16 + 0.12 * (z / 300 + 0.5); g.fillRect(x, y, 1.3, 1.3); }
      for (const s of sparks) {
        const ph = ((t / 1000 + s[3]) % 6) / 6; if (ph > 0.12) continue;
        const [x, y] = proj(s[0], s[1], s[2]), o = 1 - ph / 0.12;
        g.globalAlpha = o; g.fillStyle = s[3] < 1.6 ? '#7D93B2' : '#FF6A1A'; g.beginPath(); g.arc(x, y, 1 + o * 1.6, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1; raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true" />;
}

export default function Bienvenida() {
  const [step, setStep] = useState(0);
  const done = () => { session.set({ onboarded: true }, true); location.hash = '#/estudio'; };
  const st = STEPS[Math.max(0, step - 1)];
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexWrap: 'wrap', background: '#0B0B0C', color: '#ECECEE' }}>
      <section style={{ flex: '1 1 600px', minWidth: 0, position: 'relative', minHeight: 440, background: '#08080A', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '40px 44px' }}>
        <Field />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 62%, rgba(255,106,26,.08), transparent 50%), radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,.7))' }} />
        <div className="row" style={{ position: 'relative', gap: 12 }}><Logo size={30} /><span style={{ fontWeight: 600, fontSize: 17 }}>Fly Punch</span></div>
        <div style={{ position: 'relative', maxWidth: 520, animation: 'rise .6s ease-out both' }}>
          <p className="label" style={{ margin: '0 0 14px', fontSize: 10 }}>Conectoma FlyWire · 5 circuitos reales · MIDI</p>
          <h1 style={{ fontSize: 'clamp(36px, 4.2vw, 56px)', lineHeight: 1.02, letterSpacing: '-.035em' }}>Un cerebro real de mosca toca tu música.</h1>
          <p style={{ margin: '18px 0 0', fontSize: 16, lineHeight: 1.6, color: '#A6A6AE', maxWidth: 460 }}>Las neuronas reaccionan a sabores, sonidos y datos. Cada una que dispara toca un pad, a tempo.</p>
        </div>
      </section>
      <section style={{ flex: '1 1 440px', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#0F0F11', borderLeft: '1px solid rgba(255,255,255,.06)' }}>
        {step === 0 ? (
          <Login onSkip={() => (session.s.onboarded ? (location.hash = '#/estudio') : setStep(1))} />
        ) : (
          <div key={step} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} aria-label={`Paso ${step} de 4`} style={{ position: 'relative', height: 2, borderRadius: 1, background: 'rgba(255,255,255,.08)' }}><span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${step * 25}%`, background: '#FF6A1A', transition: 'width .45s cubic-bezier(.2,.8,.2,1)' }} /></div>
            <span className="label">Paso {step} de 4</span>
            <div style={{ height: 168, borderRadius: 14, background: '#08080A', border: '1px solid rgba(255,255,255,.06)', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(255,106,26,.12), transparent 60%)' }} />
              <svg width="92" height="92" viewBox="0 0 24 24" fill="none" stroke="#ECECEE" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative' }} aria-hidden="true"><path d={ICON_PATHS[st[0]]} pathLength="120" strokeDasharray="120" style={{ animation: 'draw 1.1s cubic-bezier(.4,0,.2,1) both' }} /></svg>
            </div>
            <div style={{ animation: 'rise .35s ease-out both', display: 'flex', flexDirection: 'column', gap: 10 }}><h2 style={{ fontSize: 24 }}>{st[1]}</h2><p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: '#A6A6AE' }}>{st[2]}</p></div>
            <div className="row" style={{ marginTop: 4 }}>
              <button type="button" className="btn lg" style={{ color: '#ECECEE', borderColor: 'rgba(255,255,255,.1)' }} onClick={() => setStep(step - 1)}>Atrás</button>
              {step < 4 ? <button type="button" className="btn lg" style={{ background: '#ECECEE', color: '#0B0B0C', fontWeight: 600 }} onClick={() => setStep(step + 1)}>Siguiente</button>
                : <button type="button" className="btn lg acc" onClick={done}>Abrir el estudio</button>}
              <button type="button" className="btn ghost" style={{ marginLeft: 'auto', color: '#8C8C94' }} onClick={done}>Saltar</button>
            </div>
          </div>
        )}
      </section>
      <style>{'@keyframes draw{from{stroke-dashoffset:120}to{stroke-dashoffset:0}}'}</style>
    </div>
  );
}
const ICON_PATHS = { usb: 'M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0zM12 16.5V21', gusto: 'M12 3c3.5 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.5-6.5 6-11z', play: 'M7 4.5v15l12-7.5z', tomas: 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0' };

const G_ICON = <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4" /><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" /><path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" fill="#FBBC05" /><path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1z" fill="#EA4335" /></svg>;

function Login({ onSkip }) {
  const [mail, setMail] = useState(''), [state, setState] = useState('idle'), [err, setErr] = useState(null);
  const google = async () => { setErr(null); try { await signInGoogle(); } catch (e) { setErr('No pudimos abrir Google. Intenta de nuevo.'); } };
  const email = async (e) => {
    e.preventDefault(); setErr(null); setState('enviando');
    try { await signInEmail(mail.trim()); setState('enviado'); } catch (x) { setState('idle'); setErr(/rate|limit/i.test(x.message) ? 'Espera un minuto antes de pedir otro enlace.' : 'No pudimos enviar el enlace. Revisa el correo.'); }
  };
  if (state === 'enviado') return (
    <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 14, animation: 'rise .4s ease-out both' }}>
      <h2 style={{ fontSize: 24 }}>Revisa tu correo</h2>
      <p style={{ margin: 0, color: '#A6A6AE', fontSize: 14, lineHeight: 1.6 }}>Te enviamos un enlace de acceso a <strong style={{ color: '#ECECEE' }}>{mail}</strong>. Ábrelo en este mismo navegador y entrarás directo a tu estudio.</p>
      <button type="button" className="btn lg ghost" style={{ color: '#A6A6AE', justifyContent: 'flex-start', padding: 0 }} onClick={() => setState('idle')}>Usar otro correo</button>
    </div>
  );
  return (
    <form style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 14, animation: 'rise .4s ease-out both' }} onSubmit={email}>
      <h2 style={{ fontSize: 24 }}>Entra a tu estudio</h2>
      <p style={{ margin: '0 0 6px', color: '#8C8C94', fontSize: 14 }}>Tu cuenta guarda tus ajustes de sonido y los sincroniza entre dispositivos.</p>
      <button type="button" className="btn lg" disabled={!cloudEnabled} onClick={google} style={{ color: '#ECECEE', borderColor: 'rgba(255,255,255,.1)', background: '#161618' }}>{G_ICON}Continuar con Google</button>
      <div className="row" style={{ color: '#66666E', fontSize: 12 }}><span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.07)' }} />o con tu correo<span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.07)' }} /></div>
      <div className="field"><label htmlFor="email" style={{ color: '#A6A6AE' }}>Correo</label><input id="email" type="email" required autoComplete="email" className="input" style={{ height: 44, background: '#0B0B0C', borderColor: 'rgba(255,255,255,.1)' }} placeholder="tu@correo.com" value={mail} onChange={(e) => setMail(e.target.value)} disabled={!cloudEnabled} /></div>
      <button type="submit" className="btn lg" style={{ background: '#ECECEE', color: '#0B0B0C', fontWeight: 600 }} disabled={!cloudEnabled || !mail.includes('@') || state === 'enviando'}>{state === 'enviando' ? 'Enviando…' : 'Enviar enlace de acceso'}</button>
      {err && <p role="alert" style={{ margin: 0, color: '#FF8A4D', fontSize: 13 }}>{err}</p>}
      <button type="button" className="btn lg ghost" style={{ color: '#A6A6AE' }} onClick={onSkip}>Probar sin cuenta <span style={{ color: '#66666E' }}>· se guarda en este navegador</span></button>
      <p style={{ margin: '10px 0 0', fontSize: 11, color: '#66666E', lineHeight: 1.6 }}>{cloudEnabled ? 'Sin contraseñas: entras con Google o con un enlace a tu correo. Tus tomas siguen en este navegador por ahora.' : 'Las cuentas no están configuradas en esta instalación; todo se guarda en este navegador.'}</p>
    </form>
  );
}
