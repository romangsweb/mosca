import { useEffect, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { TARGETS, targetById } from '../engine/controls.js';
import { useS, useTick, Icon } from './kit.jsx';

// Movimientos: grabar o dibujar cómo cambia un parámetro (dulce, amargo, filtro…) a lo largo de 1–8 compases,
// y un pad XY para tocar dos parámetros a la vez con el dedo o el mouse.
const AUTO_TARGETS = TARGETS.filter((t) => t.kind === 'range' && t.id !== 'bpm');
const norm = (t, v) => (v - t.min) / (t.max - t.min), denorm = (t, f) => Math.round(t.min + Math.max(0, Math.min(1, f)) * (t.max - t.min));

function Lane({ lane, n }) {
  const cv = useRef(null), last = useRef(null), t = targetById(lane.target);
  useEffect(() => {
    const c = cv.current, g = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio), W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); } // redimensionar solo si cambió (es caro)
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const N = Math.min(lane.pts.length, (lane.len || 1) * session.C.len), B = session.C.len, x = (i) => (i / N) * W, y = (v) => H - 3 - norm(t, v) * (H - 6);
    g.fillStyle = 'rgba(255,255,255,.04)'; for (let b = 0; b < N / B; b++) if (b % 2) g.fillRect(x(b * B), 0, x(B), H);
    g.strokeStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < N; i += 4) { g.beginPath(); g.moveTo(x(i) + 0.5, 0); g.lineTo(x(i) + 0.5, H); g.stroke(); }
    g.beginPath(); let on = false; lane.pts.slice(0, N).forEach((v, i) => { if (v == null) { on = false; return; } const X = x(i + 0.5), Y = y(v); on ? g.lineTo(X, Y) : g.moveTo(X, Y); on = true; });
    g.strokeStyle = lane.mode === 'rec' ? '#E5484D' : lane.mode === 'off' ? '#55555C' : '#FF6A1A'; g.lineWidth = 2; g.stroke();
    if (session.s.playing) { const px = x((n % N) + 0.5); g.fillStyle = 'rgba(236,236,238,.7)'; g.fillRect(px, 0, 1.5, H); }
  }, [lane.pts, lane.mode, lane.target, session.s.compas, session.s.playing ? n : -1]);
  const at = (e) => { const r = cv.current.getBoundingClientRect(), N = Math.min(lane.pts.length, (lane.len || 1) * session.C.len); return [Math.max(0, Math.min(N - 1, Math.floor(((e.clientX - r.left) / r.width) * N))), denorm(t, 1 - (e.clientY - r.top) / r.height)]; };
  const down = (e) => { e.currentTarget.setPointerCapture(e.pointerId); const [i, v] = at(e); last.current = [i, v]; session.drawAuto(lane.id, i, i, v, v); };
  const move = (e) => { if (!last.current) return; const [i, v] = at(e); session.drawAuto(lane.id, last.current[0], i, last.current[1], v); last.current = [i, v]; };
  const M = (mode, label, icon, color) => <button type="button" className="iconbtn" aria-pressed={lane.mode === mode} title={label} aria-label={label} onClick={() => session.setAutoLane(lane.id, { mode })} style={lane.mode === mode ? { color, borderColor: color } : undefined}><Icon name={icon} size={12} fill={icon === 'play' ? 'currentColor' : undefined} /></button>;
  return (
    <div className="well" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <select className="input" aria-label="Parámetro" style={{ height: 30, flex: '1 1 150px' }} value={lane.target} onChange={(e) => session.setAutoLane(lane.id, { target: e.target.value, pts: lane.pts.map(() => null) })}>
          {AUTO_TARGETS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
        <select className="input" aria-label="Largo" style={{ height: 30, width: 'auto' }} value={lane.len} onChange={(e) => session.setAutoLane(lane.id, { len: +e.target.value })}>{[1, 2, 4, 8].map((b) => <option key={b} value={b}>{b} {b === 1 ? 'compás' : 'compases'}</option>)}</select>
        <span className="mono muted" style={{ fontSize: 10, minWidth: 54, textAlign: 'right' }}>{t ? t.get(session) : ''}</span>
        <button type="button" className="iconbtn" aria-pressed={lane.mode === 'rec'} title="Grabar: mueve el control (perilla, sidekick o pad XY) mientras suena" aria-label="Grabar" onClick={() => { if (!session.s.playing) session.play(); session.setAutoLane(lane.id, { mode: lane.mode === 'rec' ? 'play' : 'rec' }); }} style={lane.mode === 'rec' ? { color: '#E5484D', borderColor: '#E5484D' } : undefined}><span style={{ width: 9, height: 9, borderRadius: 5, background: '#E5484D', display: 'block' }} /></button>
        {M('play', 'Reproducir', 'play', 'var(--acc)')}
        {M('off', 'Apagar', 'stop', 'var(--sub)')}
        <button type="button" className="iconbtn" title="Borrar el dibujo" aria-label="Borrar el dibujo" onClick={() => session.setAutoLane(lane.id, { pts: lane.pts.map(() => null) })}><Icon name="deshacer" size={12} /></button>
        <button type="button" className="iconbtn" title="Quitar" aria-label="Quitar movimiento" onClick={() => session.removeAutoLane(lane.id)}><Icon name="basura" size={12} /></button>
      </div>
      <canvas ref={cv} style={{ width: '100%', height: 64, display: 'block', borderRadius: 6, background: 'var(--screen)', cursor: 'crosshair', touchAction: 'none' }} onPointerDown={down} onPointerMove={move} onPointerUp={() => (last.current = null)} aria-label={`Dibuja el movimiento de ${t?.label}`} />
    </div>
  );
}

function XYPad() {
  const s = useS(), [ax, setAx] = useState('dulce'), [ay, setAy] = useState('amargo'), ref = useRef(null), drag = useRef(false);
  const tx = targetById(ax), ty = targetById(ay), fx = norm(tx, tx.get(session)), fy = norm(ty, ty.get(session));
  const apply = (e) => { const r = ref.current.getBoundingClientRect(); session.batch(() => { tx.set(session, denorm(tx, (e.clientX - r.left) / r.width)); ty.set(session, denorm(ty, 1 - (e.clientY - r.top) / r.height)); }); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 210, flex: 'none' }}>
      <div ref={ref} role="slider" aria-label={`Pad XY: ${tx.label} y ${ty.label}`} aria-valuenow={tx.get(session)} tabIndex={0}
        style={{ position: 'relative', width: 210, height: 170, borderRadius: 10, background: 'radial-gradient(circle at 50% 50%, rgba(255,106,26,.08), transparent 70%), var(--screen)', touchAction: 'none', cursor: 'crosshair', overflow: 'hidden' }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = true; apply(e); }} onPointerMove={(e) => drag.current && apply(e)} onPointerUp={() => { drag.current = false; session.persist(); }}>
        <span style={{ position: 'absolute', left: `${fx * 100}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,106,26,.35)' }} />
        <span style={{ position: 'absolute', top: `${(1 - fy) * 100}%`, left: 0, right: 0, height: 1, background: 'rgba(255,106,26,.35)' }} />
        <span style={{ position: 'absolute', left: `calc(${fx * 100}% - 9px)`, top: `calc(${(1 - fy) * 100}% - 9px)`, width: 18, height: 18, borderRadius: 9, background: '#FF6A1A', boxShadow: '0 0 16px #FF6A1A' }} />
        <span className="mono" style={{ position: 'absolute', left: 8, bottom: 6, fontSize: 9, color: '#77777F' }}>{tx.label.toUpperCase()} →</span>
        <span className="mono" style={{ position: 'absolute', left: 8, top: 6, fontSize: 9, color: '#77777F' }}>↑ {ty.label.toUpperCase()}</span>
      </div>
      <div className="row" style={{ gap: 4 }}>
        <select className="input" aria-label="Eje X" style={{ height: 28, fontSize: 11, flex: 1, minWidth: 0 }} value={ax} onChange={(e) => setAx(e.target.value)}>{AUTO_TARGETS.map((x) => <option key={x.id} value={x.id}>X · {x.label}</option>)}</select>
        <select className="input" aria-label="Eje Y" style={{ height: 28, fontSize: 11, flex: 1, minWidth: 0 }} value={ay} onChange={(e) => setAy(e.target.value)}>{AUTO_TARGETS.map((x) => <option key={x.id} value={x.id}>Y · {x.label}</option>)}</select>
      </div>
    </div>
  );
}

export default function Automation() {
  const s = useS(); useTick(20);
  const n = session.live.step;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <XYPad />
      <div style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!s.autoLanes.length && <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>Añade un movimiento y <strong style={{ color: 'var(--text)' }}>dibújalo</strong> con el dedo o el mouse, o pulsa <strong style={{ color: '#E5484D' }}>●</strong> y mueve el pad XY, una perilla o el sidekick mientras suena: queda grabado y se repite en bucle.</p>}
        {s.autoLanes.map((l) => <Lane key={l.id} lane={l} n={n} />)}
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn" onClick={() => session.addAutoLane(['dulce', 'amargo', 'filtro', 'density'].find((x) => !s.autoLanes.some((l) => l.target === x)) || 'dulce')}><Icon name="mas" size={12} />Añadir movimiento</button>
          {session.autoFull && <span className="muted" style={{ fontSize: 11 }}><span className="badge-pro">PRO</span> En Free tienes 1 movimiento.</span>}
        </div>
      </div>
    </div>
  );
}
