import { useEffect, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { drawCompoundEye } from '../engine/vision.js';
import { useS, useTick, Icon } from '../ui/kit.jsx';

// Visión: tu cámara es el ojo de la mosca. Lo que se acerca, lo que se mueve y la luz estimulan sus neuronas reales.
const CH = [
  ['acercar', 'Se acerca', 'LPLC2 y LC4: detectores de «looming» que avisan a la fibra gigante (DNp01), la neurona de la huida.', 'var(--acc)'],
  ['movimiento', 'Movimiento', 'T4 y T5: detectores de movimiento; su señal llega a las células HS, que le dicen a la mosca hacia dónde gira el mundo.', 'var(--white)'],
  ['luz', 'Luz', 'Los ocelos: tres ojos simples en la frente que sienten los cambios de luz (vía sus neuronas OCG).', 'var(--steel)'],
];

export default function Vision() {
  const s = useS(); useTick(15);
  const cv = useRef(null), raw = useRef(null), [err, setErr] = useState(null), [busy, setBusy] = useState(false), [human, setHuman] = useState(false);
  const V = session.vision, on = V.on, L = session.live, outHz = s.playing ? L.out?.vision || 0 : 0, huye = outHz > 40;
  const has = !!session.D?.modos?.vision, track = s.tracks.find((t) => t.sense === 'vision' && session.audible(t));
  useEffect(() => {
    let raf; const draw = () => {
      const c = cv.current; if (c) { const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(2, devicePixelRatio); if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); } const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); drawCompoundEye(g, w, h, session.vision.frame); }
      const r = raw.current; if (r && session.vision.video && r.srcObject !== session.vision.stream) r.srcObject = session.vision.stream;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, []);
  // borra la copia guardada de los datos (y el service worker viejo, que la servía para siempre) y recarga
  const refreshBrain = async () => {
    try { for (const k of await caches.keys()) await caches.delete(k); } catch {}
    try { for (const r of (await navigator.serviceWorker?.getRegistrations()) || []) await r.update(); } catch {}
    location.reload();
  };
  const start = async () => {
    setBusy(true); setErr(null);
    try { await session.vision.start(); session.emit(); } catch (e) { setErr(e?.name === 'NotAllowedError' ? 'No diste permiso para usar la cámara. Revisa el candado de la barra de direcciones.' : 'No encontramos una cámara.'); }
    setBusy(false);
  };
  const stop = () => { session.vision.stop(); session.emit(); };
  const useVision = () => { const t = session.track(); session.setSense(t.id, 'vision'); session.setTrack(t.id, { mute: false }); };
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Visión</h1><p>Tu cámara es el ojo de la mosca. Acerca la mano rápido y su fibra gigante, la neurona de la huida, dispara; mueve la cámara de lado y se encienden sus detectores de movimiento.</p></div>
        <div className="row">
          {on ? <button type="button" className="btn lg" onClick={stop}><Icon name="stop" size={12} fill="currentColor" />Apagar cámara</button>
            : <button type="button" className="btn lg acc" disabled={busy || !has} onClick={start}><Icon name="vision" size={15} />{busy ? 'Abriendo…' : 'Usar la cámara'}</button>}
          <button type="button" className="btn lg primary" onClick={() => session.toggle()}><Icon name={s.playing ? 'stop' : 'play'} size={12} fill="currentColor" />{s.playing ? 'Detener' : 'Tocar'}</button>
        </div>
      </div>
      {!has && <div className="well row" style={{ padding: 12, gap: 10, flexWrap: 'wrap' }}><span style={{ flex: 1, fontSize: 13 }}>Tu navegador tiene guardada una versión vieja del cerebro, sin el circuito de Visión.</span><button type="button" className="btn acc" onClick={refreshBrain}>Actualizar el cerebro</button></div>}
      {err && <p role="alert" style={{ margin: 0, color: '#FF8A4D' }}>{err}</p>}
      {has && !track && <div className="well row" style={{ padding: 12, gap: 10, flexWrap: 'wrap' }}><span style={{ flex: 1, fontSize: 13 }}>Ninguna pista que suene usa el circuito de Visión, así que la cámara no tocará nada.</span><button type="button" className="btn acc" onClick={useVision}>Usar Visión en la pista {session.track().name}</button></div>}
      <div className="cols" style={{ alignItems: 'stretch' }}>
        <section className="screen" style={{ flex: '2 1 520px', minHeight: 420, position: 'relative' }} aria-label="Lo que ve la mosca">
          <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          {!on && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#8C8C94', fontSize: 13, textAlign: 'center', padding: 24 }}>Enciende la cámara para ver el mundo como un mosaico de omatidios: unos 750 «pixeles» por ojo.</div>}
          {huye && <div aria-live="assertive" style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 6px #FF6A1A', pointerEvents: 'none' }} />}
          <div className="hud" style={{ position: 'absolute', left: 12, top: 12, background: 'rgba(8,8,10,.78)', borderRadius: 10, padding: '8px 12px', backdropFilter: 'blur(4px)' }}>
            <div><div className="label">Fibra gigante · DNp01</div><div className="v" style={{ color: 'var(--acc)' }}>{Math.round(outHz)}<small> Hz</small></div></div>
            <div><div className="label">Estado</div><div style={{ fontSize: 15, fontWeight: 600, marginTop: 5, color: huye ? '#FF6A1A' : undefined }}>{!s.playing ? 'En pausa' : huye ? '¡Huye!' : on ? 'Mirando' : 'Sin cámara'}</div></div>
          </div>
          {on && human && <video ref={raw} muted playsInline autoPlay style={{ position: 'absolute', right: 12, bottom: 12, width: 160, borderRadius: 8, transform: 'scaleX(-1)', border: '1px solid rgba(255,255,255,.2)' }} />}
          {on && <label className="row" style={{ position: 'absolute', right: 12, top: 12, gap: 6, fontSize: 11, color: '#ECECEE', background: 'rgba(8,8,10,.78)', borderRadius: 8, padding: '5px 9px' }}><input type="checkbox" checked={human} onChange={(e) => setHuman(e.target.checked)} style={{ accentColor: 'var(--acc)' }} />Ver como persona</label>}
        </section>
        <aside style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CH.map(([k, label, desc, col]) => {
            const v = on ? V.vals[k] : (s.inputs[k] || 0) / 200;
            return (
              <section key={k} className="panel" style={{ gap: 8 }}>
                <div className="between"><h2 style={{ fontSize: 14 }}>{label}</h2><span className="mono" style={{ fontSize: 12 }}>{Math.round(v * 100)}%</span></div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--line)' }}><div style={{ width: `${v * 100}%`, height: '100%', borderRadius: 4, background: col, transition: 'width .08s linear' }} /></div>
                <p className="muted" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5 }}>{desc}</p>
                {!on && <input type="range" min={0} max={200} value={s.inputs[k] || 0} aria-label={label} onChange={(e) => session.setInput(k, +e.target.value)} style={{ accentColor: 'var(--acc)' }} />}
              </section>
            );
          })}
          <p className="dim" style={{ margin: 0, fontSize: 11, lineHeight: 1.5 }}>La imagen de la cámara no sale de tu computadora: se reduce a 48 × 36 puntos y solo se calculan tres números. La app no simula el lóbulo óptico completo (son ~77 000 neuronas): calcula «se acerca», «movimiento» y «luz» y con eso estimula a las neuronas que hacen ese cálculo en la mosca. De ahí en adelante, todo es el conectoma real.</p>
        </aside>
      </div>
    </div>
  );
}
