import { useEffect, useRef } from 'react';
import { session } from '../engine/session.js';
import { PAD_KEYS } from '../engine/midi.js';
import { roleColor, roleGlow } from './kit.jsx';

// Pads en el acomodo del K.O. II: 7 8 9 / 4 5 6 / 1 2 3 / . 0 ENT (offsets de nota: . 0 ENT 1..9 = 0..11).
// Cada pad físico muestra la neurona k que hoy lo toca (track.map[k] = offset); Mutar cambia ese reparto.
const LAYOUT = [9, 10, 11, 6, 7, 8, 3, 4, 5, 0, 1, 2];

export function Pads({ track, selPad, onSelect }) {
  const refs = useRef([]);
  const pads = session.pads(track);
  useEffect(() => session.onStep((n) => {
    const lanes = session.live.lanes[track.id], pos = n % 16;
    lanes.forEach((row, k) => { if (row[pos] > 0) { const el = refs.current[k]; if (!el) return; el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 90); } });
  }), [track.id]);
  return (
    <div className="pads">
      {LAYOUT.map((off) => {
        const k = track.map.indexOf(off), p = pads[k], muted = session.sim.silenced.has(p.idx);
        return (
          <button key={off} ref={(el) => (refs.current[k] = el)} type="button" className={`pad${muted ? ' off' : ''}`} aria-pressed={selPad === k}
            aria-label={`Pad ${PAD_KEYS[off]}, neurona ${p.tipo}`} style={{ '--pc': roleColor(p), '--pg': roleGlow(p) }}
            onPointerDown={() => { session.tapPad(k, track); onSelect(k); }}>
            <span className="glow" /><span className="led" />
            <span className="k">{PAD_KEYS[off]}</span>
            <span className="n">{p.tipo}</span>
            <span className="v">{track.kit[off]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Lanes({ track, selPad }) {
  const grid = useRef(null), head = useRef(null), meters = useRef([]);
  const pads = session.pads(track);
  useEffect(() => {
    const cells = grid.current.querySelectorAll('.cell');
    const color = pads.map((p) => (p.clase === 'sensor' ? '236,236,238' : p.inhibidora ? '125,147,178' : '255,106,26'));
    const paint = () => { const lanes = session.live.lanes[track.id]; lanes.forEach((row, k) => row.forEach((v, i) => { cells[k * 16 + i].style.background = v ? `rgba(${color[k]},${0.25 + (v / 127) * 0.6})` : ''; })); };
    paint();
    const off = session.onStep(paint);
    let raf; const loop = () => {
      const L = session.live, ms = session.ko.stepMs;
      if (session.s.playing && L.stepAt) { const f = ((L.step % 16) + Math.min(1, Math.max(0, (performance.now() - L.stepAt) / ms))) / 16; head.current.style.left = `${f * 100}%`; head.current.style.opacity = 0.7; }
      else head.current.style.opacity = 0;
      const lvl = Math.min(1, L.active / 60);
      meters.current.forEach((m, i) => m && (m.style.height = `${session.s.playing ? Math.round((i ? 0.85 : 1) * lvl * 100) : 0}%`));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { off(); cancelAnimationFrame(raf); };
  }, [track.id]);
  return (
    <div className="lanes">
      <div className="lane-names">{pads.map((p, k) => <span key={k} className={k === selPad ? 'sel' : ''}>{p.tipo}</span>)}</div>
      <div className="lane-grid" ref={grid} role="img" aria-label="Disparos del último compás por neurona">
        {Array.from({ length: 192 }, (_, i) => <span key={i} className={`cell${i % 4 === 0 ? ' beat' : ''}`} />)}
        <span className="playhead" ref={head} />
      </div>
      <div className="meters" aria-hidden="true">{[0, 1].map((i) => <span key={i} className="meter"><i ref={(el) => (meters.current[i] = el)} /></span>)}</div>
    </div>
  );
}
