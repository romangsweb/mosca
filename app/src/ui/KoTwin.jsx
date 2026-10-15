import { useEffect, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { GROUPS } from '../engine/ko.js';

// El K.O. II en pantalla: cada pad se enciende naranja cuando la mosca lo toca y con un aro blanco cuando tú lo tocas en el
// aparato. Las perillas X/Y y el fader siguen lo que la mosca le manda (efecto y pitch).
const LABEL = ['.', '0', 'ENT', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const LAYOUT = [[9, 10, 11], [6, 7, 8], [3, 4, 5], [0, 1, 2]]; // como en el aparato: 7 8 9 arriba, «. 0 ENT» abajo
const PX = 44, PG = 8, OX = 34, OY = 196;

export default function KoTwin({ group: g0, onGroup }) {
  const [group, setGroup] = useState(g0 || session.track().group || 'A');
  const pads = useRef([]), rings = useRef([]), grp = useRef([]), mini = useRef([]), kx = useRef(null), ky = useRef(null), fad = useRef(null), scr = useRef(null);
  useEffect(() => { if (g0) setGroup(g0); }, [g0]);
  const seen = useRef(0);
  useEffect(() => {
    let raf;
    const loop = () => {
      const now = performance.now(), K = session.kolink, out = {}, inn = {}, act = {};
      // sigue al grupo que tocas en el aparato (el K.O. no avisa cuando cambias de grupo, pero sí qué pad tocas)
      const last = K.inLog[K.inLog.length - 1]; if (last?.group && last.at > seen.current) { seen.current = last.at; if (last.group !== group && last.manual !== true) { setGroup(last.group); onGroup?.(last.group); } }
      for (const e of K.outLog) { const a = Math.exp(-(now - e.at) / 200); if (a < 0.02) continue; const key = `${e.group}${e.off}`; out[key] = Math.max(out[key] || 0, a); act[e.group] = Math.max(act[e.group] || 0, a); }
      for (const e of K.inLog) { if (!e.group) continue; const a = Math.exp(-(now - e.at) / 260); if (a < 0.02) continue; const key = `${e.group}${e.off}`; inn[key] = Math.max(inn[key] || 0, a); act[e.group] = Math.max(act[e.group] || 0, a * 0.8); }
      for (let off = 0; off < 12; off++) {
        const o = out[`${group}${off}`] || 0, i = inn[`${group}${off}`] || 0, p = pads.current[off], r = rings.current[off];
        if (p) { p.setAttribute('fill', o > 0.03 ? `rgb(${255},${Math.round(106 + (1 - o) * 60)},${Math.round(26 + (1 - o) * 40)})` : '#3A3A3E'); p.style.filter = o > 0.3 ? `drop-shadow(0 0 ${6 * o}px rgba(255,106,26,${o}))` : 'none'; }
        if (r) r.setAttribute('stroke-opacity', i.toFixed(2));
      }
      GROUPS.forEach((G, j) => { const b = grp.current[j]; if (b) b.setAttribute('fill', act[G] > 0.05 ? `rgba(255,106,26,${0.25 + act[G] * 0.6})` : G === group ? '#2A2A2E' : '#1C1C1F');
        for (let off = 0; off < 12; off++) { const m = mini.current[j * 12 + off]; if (m) { const o = out[`${G}${off}`] || 0, i = inn[`${G}${off}`] || 0; m.setAttribute('fill', o > 0.03 ? `rgba(255,106,26,${0.3 + o * 0.7})` : i > 0.03 ? `rgba(236,236,238,${0.3 + i * 0.7})` : '#3A3A3E'); } } });
      const cc = K.cc; if (kx.current) kx.current.setAttribute('transform', `rotate(${-135 + 270 * (cc.cc12 || 0)})`); if (ky.current) ky.current.setAttribute('transform', `rotate(${-135 + 270 * (cc.cc13 || 0)})`);
      if (fad.current) fad.current.setAttribute('x', String(178 - 60 * (cc.pb || 0) - 9)); // al centro sin pitch; hacia la izquierda cuando se hunde
      if (scr.current) { const L = session.live, t = session.s.tracks.find((x) => x.group === group); scr.current.textContent = `${group} · ${t ? t.name.toUpperCase().slice(0, 7) : '—'} · ${session.s.playing ? Math.round(L.active || 0) : 0}`; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [group]);
  const pick = (G) => { setGroup(G); onGroup?.(G); };
  // tocar un pad en pantalla: suena en el K.O. y la mosca lo siente, como si lo hubieras tocado en el aparato
  const press = (off) => {
    const note = 36 + GROUPS.indexOf(group) * 12 + off, t = session.s.tracks.find((x) => x.group === group) || session.track(), port = session.portFor(t) || session.ko.output;
    if (port) session.ko.hit(note, 110, t.ch || 1, 120, performance.now(), port);
    session.kolink.inLog.push({ group, off, at: performance.now(), vel: 110, manual: true }); session.kolink.stimulate(t, off, 110);
  };
  return (
    <svg viewBox="0 0 300 430" style={{ width: '100%', maxWidth: 340, height: 'auto', display: 'block' }} role="img" aria-label={`K.O. II en pantalla, grupo ${group}`}>
      <defs><linearGradient id="kobody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#24252A" /><stop offset="1" stopColor="#1A1B1E" /></linearGradient></defs>
      <rect x="4" y="4" width="292" height="422" rx="14" fill="url(#kobody)" stroke="#33353A" />{[[14, 14], [286, 14], [14, 416], [286, 416]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.4" fill="#36383D" />)}
      {/* pantalla */}
      <rect x="20" y="20" width="150" height="62" rx="6" fill="#0D0D0F" />
      <text ref={scr} x="30" y="46" fill="#FF6A1A" fontFamily="JetBrains Mono, monospace" fontSize="11">A</text>
      <text x="30" y="68" fill="#77777F" fontFamily="JetBrains Mono, monospace" fontSize="9">FLY PUNCH · SAMPLER</text>
      {/* perillas X / Y */}
      {[[206, 'X', kx], [256, 'Y', ky]].map(([x, l, ref]) => (
        <g key={l} transform={`translate(${x} 50)`}><circle r="20" fill="#2A2C30" stroke="#3A3C41" /><circle r="14" fill="#232428" /><g ref={ref}><rect x="-1.8" y="-18" width="3.6" height="11" rx="1.6" fill="#FF6A1A" /></g><text y="36" textAnchor="middle" fontSize="9" fill="#6E7178" fontFamily="JetBrains Mono, monospace">{l}</text></g>
      ))}
      {/* fader (pitch) */}
      <rect x="110" y="106" width="136" height="6" rx="3" fill="#121315" />
      <rect ref={fad} x="169" y="98" width="18" height="22" rx="3" fill="#3B3D42" stroke="#55585E" />
      <text x="20" y="113" fontSize="9" fill="#6E7178" fontFamily="JetBrains Mono, monospace">PITCH</text>
      {/* grupos */}
      {GROUPS.map((G, j) => (
        <g key={G} onClick={() => pick(G)} style={{ cursor: 'pointer' }}>
          <rect ref={(el) => (grp.current[j] = el)} x={20 + j * 66} y="140" width="56" height="32" rx="6" fill="#1C1C1F" stroke={G === group ? '#FF6A1A' : 'transparent'} strokeWidth="2" />
          <text x={48 + j * 66} y="161" textAnchor="middle" fill="#ECECEE" fontSize="13" fontWeight="600" fontFamily="Inter, sans-serif">{G}</text>
        </g>
      ))}
      {/* pads */}
      {LAYOUT.map((row, ri) => row.map((off, ci) => {
        const x = OX + ci * (PX + PG) + 22, y = OY + ri * (PX + PG);
        return (
          <g key={off} onClick={() => press(off)} style={{ cursor: 'pointer' }}>
            <rect ref={(el) => (pads.current[off] = el)} x={x} y={y} width={PX} height={PX} rx="8" fill="#3A3A3E" style={{ transition: 'fill .05s' }} />
            <rect ref={(el) => (rings.current[off] = el)} x={x - 3} y={y - 3} width={PX + 6} height={PX + 6} rx="10" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeOpacity="0" />
            <text x={x + PX / 2} y={y + PX / 2 + 4} textAnchor="middle" fill="#ECECEE" fontSize="12" fontFamily="JetBrains Mono, monospace" pointerEvents="none">{LABEL[off]}</text>
          </g>
        );
      }))}
      {/* los 4 grupos de un vistazo */}
      {GROUPS.map((G, j) => (
        <g key={G} transform={`translate(226 ${196 + j * 52})`}>
          <text x="-6" y="24" textAnchor="end" fontSize="9" fill="#6E7178" fontFamily="JetBrains Mono, monospace">{G}</text>
          {LAYOUT.map((row, ri) => row.map((off, ci) => <rect key={off} ref={(el) => (mini.current[j * 12 + off] = el)} x={ci * 13} y={ri * 11} width="11" height="9" rx="2" fill="#3A3A3E" />))}
        </g>
      ))}
    </svg>
  );
}
