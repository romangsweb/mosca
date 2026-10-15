import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { keyName, chordName } from '../engine/armonia.js';
import { posLabel } from '../engine/compas.js';
import { useS, useTick, Icon } from './kit.jsx';
import CircuitMap from './CircuitMap.jsx';

const Brain = lazy(() => import('./Brain.jsx'));
const COL = { gusto: '#FF6A1A', oido: '#7D93B2', p3: '#3DD68C', p4: '#C08CFF' };

// Modo escenario: pantalla completa para proyectar en vivo o grabar. El cerebro al centro, las pistas como columnas de luz,
// el compás, la escena y la armonía en grande, y un halo que respira con el volumen de la mezcla.
export default function Escenario({ onClose }) {
  const s = useS(); useTick(24);
  const root = useRef(null), halo = useRef(null), [view, setView] = useState('3D'), [ui, setUi] = useState(true), t = session.track(), L = session.live, H = L.harm;
  useEffect(() => {
    root.current?.requestFullscreen?.().catch(() => {});
    const k = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'v' || e.key === 'V') setView((v) => (v === '3D' ? 'Mapa' : v === 'Mapa' ? 'Dorsal' : '3D')); if (e.key === 'h' || e.key === 'H') setUi((x) => !x); };
    const fs = () => { if (!document.fullscreenElement) onClose(); };
    addEventListener('keydown', k); document.addEventListener('fullscreenchange', fs);
    let raf, an = null, buf = null, lvl = 0;
    const loop = () => { raf = requestAnimationFrame(loop); const syn = session.synth; if (!syn.ctx || !syn.chain) return;
      if (!an) { an = syn.ctx.createAnalyser(); an.fftSize = 1024; syn.chain.post.connect(an); buf = new Float32Array(an.fftSize); }
      an.getFloatTimeDomainData(buf); let sum = 0; for (const x of buf) sum += x * x; const rms = Math.sqrt(sum / buf.length);
      lvl = Math.max(rms * 3, lvl * 0.92); const act = Math.min(1, (session.live.active || 0) / 120), a = Math.min(1, lvl * 0.7 + act * 0.5);
      if (halo.current) halo.current.style.opacity = String(0.15 + a * 0.85); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener('keydown', k); document.removeEventListener('fullscreenchange', fs); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); try { if (an) session.synth.chain.post.disconnect(an); } catch {} };
  }, []);
  const now = performance.now(), cols = s.tracks.filter((x) => session.audible(x)).map((x) => { const m = L.meter[x.id], v = m ? Math.max(0, 1 - (now - m.at) / 260) * (m.vel / 127) : 0; return { x, v }; });
  const pos = s.playing ? posLabel(session.C, L.step || 0) : '—';
  return (
    <div ref={root} className="escenario" role="dialog" aria-label="Modo escenario">
      <div className="screen" style={{ position: 'absolute', inset: 0, borderRadius: 0, border: 0 }}>
        <div className="grid" />
        {view === 'Mapa' ? <CircuitMap selTrack={t.id} selPad={s.selPad} onPick={() => {}} sense={t.sense} /> : <Suspense fallback={null}><Brain view={view} selTrack={t.id} selPad={s.selPad} onPick={() => {}} sense={t.sense} /></Suspense>}
        <div ref={halo} className="esc-halo" />
        <div className="vignette" />
      </div>
      {/* columnas de luz: una por pista que suena */}
      <div className="esc-cols" aria-hidden="true">{cols.map(({ x, v }) => <div key={x.id} style={{ background: `linear-gradient(to top, ${COL[x.id] || '#ECECEE'}, transparent)`, opacity: 0.08 + v * 0.8, transform: `scaleY(${0.25 + v * 0.75})` }} />)}</div>
      {ui && (<>
        <div className="esc-tl"><div className="esc-brand">FLY PUNCH</div><div className="mono">{s.sessionName}</div></div>
        <div className="esc-tr mono"><div className="esc-big">{pos}</div><div>{Math.round(session.ko.bpm || s.bpm)} BPM · {s.compas || '4/4'}</div></div>
        <div className="esc-bl">
          <div className="mono esc-label">NEURONAS ACTIVAS</div><div className="esc-big">{s.playing ? L.active || 0 : 0}<span className="mono" style={{ fontSize: 14, opacity: 0.5 }}> / {session.D?.n}</span></div>
          {s.sceneNow && <div className="mono esc-label" style={{ marginTop: 10 }}>ESCENA {s.sceneNow}{s.scenes[s.sceneNow]?.name ? ` · ${s.scenes[s.sceneNow].name.toUpperCase()}` : ''}</div>}
        </div>
        <div className="esc-br">
          {H?.key && <><div className="mono esc-label">{keyName(H.key).toUpperCase()}</div><div className="esc-big" style={{ color: '#FF6A1A' }}>{chordName(H.chord)}</div></>}
        </div>
        <div className="esc-bar">
          <button type="button" className="btn" onClick={() => session.toggle()}><Icon name={s.playing ? 'stop' : 'play'} size={12} fill="currentColor" />{s.playing ? 'Detener' : 'Tocar'}</button>
          <button type="button" className="btn" onClick={() => setView((v) => (v === '3D' ? 'Mapa' : v === 'Mapa' ? 'Dorsal' : '3D'))}>Vista: {view} (V)</button>
          <button type="button" className="btn" onClick={() => setUi(false)}>Ocultar textos (H)</button>
          <button type="button" className="btn" onClick={onClose}>Salir (Esc)</button>
        </div>
      </>)}
    </div>
  );
}
