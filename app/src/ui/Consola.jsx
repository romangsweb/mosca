import { useEffect, useRef } from 'react';
import { session } from '../engine/session.js';
import { noteToPad, GROUPS } from '../engine/ko.js';
import { useS } from './kit.jsx';

// La consola de Fly Punch: cada aparato que suena se dibuja como un instrumento propio de la app (no es réplica de ningún
// producto) y se mueve con lo que pasa de verdad: pads que disparan, perillas que gira la mosca, faders que mueves tú.
// Firma de la casa: un «ojo compuesto» de 7 hexágonos en cada panel que late con la actividad del cerebro.
const ACC = [255, 106, 26], LED_OFF = '#2B2D31', INK = '#6E7178', PANEL = '#1B1C1F';
const hex = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
const glow = (el, a, col = ACC) => { if (!el) return; el.setAttribute('fill', a > 0.04 ? `rgb(${Math.round(43 + (col[0] - 43) * a)},${Math.round(45 + (col[1] - 45) * a)},${Math.round(49 + (col[2] - 49) * a)})` : LED_OFF); };
const decay = (at, now, ms = 220) => (at ? Math.exp(-(now - at) / ms) : 0);

// el ojo: 7 hexágonos, el centro late con las neuronas activas y el anillo gira con la salida
function Eye({ x, y, refs }) {
  const pts = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3) * 7.4, Math.sin((i * Math.PI) / 3) * 7.4])];
  return <g transform={`translate(${x} ${y})`}>{pts.map(([dx, dy], i) => <polygon key={i} ref={(el) => (refs.current[i] = el)} points={hex(dx, dy, 3.9)} fill={LED_OFF} />)}</g>;
}
function eyeTick(refs, now) {
  const L = session.live, on = session.s.playing, a = on ? Math.min(1, (L.active || 0) / 60) : 0, k = Math.floor(now / 90) % 6;
  refs.current.forEach((el, i) => glow(el, i === 0 ? a : on && i - 1 === k ? 0.35 + a * 0.5 : a * 0.15));
}
function Panel({ w, h, title, sub, children, eye }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`${title}${sub ? `, ${sub}` : ''}`}>
      <defs><linearGradient id={`pg${w}${h}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#222326" /><stop offset="1" stopColor={PANEL} /></linearGradient></defs>
      <rect x="1" y="1" width={w - 2} height={h - 2} rx="10" fill={`url(#pg${w}${h})`} stroke="#2E3034" />
      {[[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" fill="#34363B" />)}
      <text x="16" y="22" fill="#D9DADD" fontSize="11" fontWeight="600" fontFamily="Inter, sans-serif">{title}</text>
      {sub && <text x="16" y="35" fill={INK} fontSize="8.5" fontFamily="JetBrains Mono, monospace">{sub}</text>}
      {eye}
      {children}
    </svg>
  );
}
function Knob({ x, y, r = 11, label, refEl }) {
  return <g transform={`translate(${x} ${y})`}><circle r={r} fill="#2A2C30" stroke="#3A3C41" /><circle r={r - 4} fill="#232428" /><g ref={refEl}><rect x="-1.3" y={-r + 2} width="2.6" height={r * 0.55} rx="1.2" fill="#FF6A1A" /></g>{label && <text y={r + 11} textAnchor="middle" fill={INK} fontSize="7.5" fontFamily="JetBrains Mono, monospace">{label}</text>}</g>;
}
const turn = (el, v) => el?.setAttribute('transform', `rotate(${-135 + 270 * Math.max(0, Math.min(1, v || 0))})`);

// sampler de bolsillo: 12 pads, grupos A–D, dos perillas (el K.O. II y similares)
function Pocket({ port, name }) {
  const pads = useRef([]), grp = useRef([]), eye = useRef([]), kx = useRef(null), ky = useRef(null), last = useRef('A');
  useEffect(() => { let raf; const loop = () => { const now = performance.now(), K = session.kolink, lit = {};
    for (const e of K.outLog) if (!port || e.port === port) { const a = decay(e.at, now); if (a > 0.04) { lit[`${e.group}${e.off}`] = Math.max(lit[`${e.group}${e.off}`] || 0, a); if (a > 0.9) last.current = e.group; } }
    for (const e of K.inLog) if (e.group) { const a = decay(e.at, now, 300); if (a > 0.04) { lit[`in${e.group}${e.off}`] = a; if (a > 0.9) last.current = e.group; } }
    const G = last.current;
    for (let off = 0; off < 12; off++) { const o = lit[`${G}${off}`] || 0, i = lit[`in${G}${off}`] || 0; glow(pads.current[off], Math.max(o, i), o >= i ? ACC : [236, 236, 238]); }
    GROUPS.forEach((g, j) => glow(grp.current[j], g === G ? 0.55 : 0, [236, 236, 238]));
    turn(kx.current, K.cc.cc12); turn(ky.current, K.cc.cc13); eyeTick(eye, now); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, [port]);
  const L = [[9, 10, 11], [6, 7, 8], [3, 4, 5], [0, 1, 2]], LB = ['.', '0', 'E', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <Panel w={170} h={196} title={name} sub="SAMPLER · 4 GRUPOS" eye={<Eye x={146} y={22} refs={eye} />}>
      <Knob x={36} y={62} label="X" refEl={kx} /><Knob x={72} y={62} label="Y" refEl={ky} />
      {GROUPS.map((g, j) => <g key={g}><rect ref={(el) => (grp.current[j] = el)} x={102 + (j % 2) * 26} y={50 + Math.floor(j / 2) * 18} width="22" height="13" rx="3" fill={LED_OFF} /><text x={113 + (j % 2) * 26} y={60 + Math.floor(j / 2) * 18} textAnchor="middle" fill="#9A9CA1" fontSize="8" fontFamily="Inter, sans-serif" pointerEvents="none">{g}</text></g>)}
      {L.map((row, r) => row.map((off, c) => <g key={off}><rect ref={(el) => (pads.current[off] = el)} x={30 + c * 38} y={94 + r * 24} width="32" height="19" rx="4" fill={LED_OFF} /><text x={46 + c * 38} y={107 + r * 24} textAnchor="middle" fill="#8B8D93" fontSize="8" fontFamily="JetBrains Mono, monospace" pointerEvents="none">{LB[off]}</text></g>))}
    </Panel>
  );
}
// mezclador de dos canales (el sidekick): faders, tres perillas de EQ y medidores por tira
function Mixer({ port, name }) {
  const fad = useRef([]), eq = useRef([]), vu = useRef([]), fx = useRef([]), eye = useRef([]);
  useEffect(() => { let raf; const loop = () => { const now = performance.now(), K = session.kolink, v = (ch, num) => { const x = K.ccIn[`${port}|${ch}|cc${num}`]; return x ? x.val / 127 : null; };
    [1, 2].forEach((ch, i) => { const f = v(ch, 7); if (fad.current[i]) fad.current[i].setAttribute('y', String(150 - (f ?? 0.75) * 70));
      [22, 23, 24].forEach((num, j) => turn(eq.current[i * 3 + j], v(ch, num) ?? 0.5));
      const t = session.s.tracks[i], m = t ? session.live.meter[t.id] : null, lvl = m ? Math.max(0, (m.vel / 127) * Math.exp(-(now - m.at) / 220)) : 0;
      for (let k = 0; k < 8; k++) glow(vu.current[i * 8 + k], lvl * 8 > k ? 1 : 0, k > 6 ? [229, 72, 77] : ACC);
      const fxOn = K.ccIn[`${port}|${ch}|cc14`]; glow(fx.current[i], fxOn && fxOn.val > 63 ? 1 : 0); });
    eyeTick(eye, now); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, [port]);
  return (
    <Panel w={190} h={196} title={name} sub="MEZCLADOR · 2 TIRAS" eye={<Eye x={166} y={22} refs={eye} />}>
      {[0, 1].map((i) => { const x0 = 22 + i * 84; return (
        <g key={i}>
          {['ALTO', 'MED', 'BAJO'].map((l, j) => <Knob key={l} x={x0 + 14} y={56 + j * 30} r={9} refEl={(el) => (eq.current[i * 3 + j] = el)} />)}
          {['ALTO', 'MED', 'BAJO'].map((l, j) => <text key={l} x={x0 + 30} y={59 + j * 30} fill={INK} fontSize="6.5" fontFamily="JetBrains Mono, monospace">{l}</text>)}
          <rect x={x0 + 50} y="70" width="4" height="96" rx="2" fill="#121315" />
          <rect ref={(el) => (fad.current[i] = el)} x={x0 + 42} y="95" width="20" height="12" rx="2.5" fill="#3B3D42" stroke="#55585E" />
          {Array.from({ length: 8 }, (_, k) => <rect key={k} ref={(el) => (vu.current[i * 8 + k] = el)} x={x0 + 66} y={160 - k * 11} width="6" height="8" rx="1.5" fill={LED_OFF} />)}
          <rect ref={(el) => (fx.current[i] = el)} x={x0 + 8} y="150" width="22" height="12" rx="3" fill={LED_OFF} /><text x={x0 + 19} y="173" textAnchor="middle" fill={INK} fontSize="7" fontFamily="JetBrains Mono, monospace">FX {i + 1}</text>
        </g>
      ); })}
    </Panel>
  );
}
// caja de ritmos de 16 pasos (TR-8S, General MIDI…): una fila de pasos con la cabeza de reproducción y los golpes
function Steps({ port, name, sub }) {
  const st = useRef([]), eye = useRef([]), kb = useRef([]);
  useEffect(() => { let raf; const loop = () => { const now = performance.now(), L = session.live, pos = session.s.playing ? L.step % 16 : -1, hits = session.kolink.notes.filter((n) => (!port || n.port === port) && now - n.at < 250);
    for (let i = 0; i < 16; i++) glow(st.current[i], i === pos ? (hits.length ? 1 : 0.35) : 0, i === pos && hits.length ? ACC : [236, 236, 238]);
    kb.current.forEach((el, i) => turn(el, session.s.playing ? 0.3 + 0.4 * Math.sin(now / (900 + i * 300)) * 0.5 + (L.active || 0) / 200 : 0.3));
    eyeTick(eye, now); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, [port]);
  return (
    <Panel w={250} h={120} title={name} sub={sub} eye={<Eye x={226} y={22} refs={eye} />}>
      {Array.from({ length: 6 }, (_, i) => <Knob key={i} x={30 + i * 32} y={58} r={9} refEl={(el) => (kb.current[i] = el)} />)}
      {Array.from({ length: 16 }, (_, i) => <rect key={i} ref={(el) => (st.current[i] = el)} x={16 + i * 14} y="88" width="11" height="16" rx="2.5" fill={LED_OFF} stroke={i % 4 === 0 ? '#3E4046' : 'none'} />)}
    </Panel>
  );
}
// teclado o sinte: las teclas que toca la mosca
function Keys({ port, name }) {
  const k = useRef([]), eye = useRef([]);
  useEffect(() => { let raf; const loop = () => { const now = performance.now(), on = {};
    for (const n of session.kolink.notes) if (!port || n.port === port) { const a = decay(n.at, now, 300); if (a > 0.04) on[((n.note % 24) + 24) % 24] = Math.max(on[n.note % 24] || 0, a); }
    for (let i = 0; i < 24; i++) glow(k.current[i], on[i] || 0); eyeTick(eye, now); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, [port]);
  const white = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23], black = [1, 3, 6, 8, 10, 13, 15, 18, 20, 22];
  return (
    <Panel w={250} h={120} title={name} sub="MELODÍA · 2 OCTAVAS" eye={<Eye x={226} y={22} refs={eye} />}>
      {white.map((n, i) => <rect key={n} ref={(el) => (k.current[n] = el)} x={16 + i * 15.6} y="50" width="14" height="56" rx="2" fill={LED_OFF} />)}
      {black.map((n) => { const wi = white.indexOf(n - 1); return <rect key={n} ref={(el) => (k.current[n] = el)} x={16 + wi * 15.6 + 10} y="50" width="9" height="32" rx="1.5" fill="#121315" stroke="#2E3034" />; })}
    </Panel>
  );
}
// el sonido de la compu: un altavoz cuyo cono late con lo que suena
function Speaker({ name }) {
  const cone = useRef(null), ring = useRef([]), eye = useRef([]);
  useEffect(() => { let raf; const loop = () => { const now = performance.now(), m = Object.values(session.live.meter || {}).reduce((a, x) => Math.max(a, (x.vel / 127) * Math.exp(-(now - x.at) / 200)), 0);
    cone.current?.setAttribute('r', String(22 + m * 6)); ring.current.forEach((el, i) => glow(el, m > i / 10 ? 0.9 : 0));
    eyeTick(eye, now); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, []);
  return (
    <Panel w={150} h={120} title={name} sub="KIT DE LA COMPU" eye={<Eye x={126} y={22} refs={eye} />}>
      <circle cx="52" cy="78" r="32" fill="#121315" stroke="#2E3034" /><circle ref={cone} cx="52" cy="78" r="22" fill="#26282C" /><circle cx="52" cy="78" r="6" fill="#33363B" />
      {Array.from({ length: 10 }, (_, i) => <rect key={i} ref={(el) => (ring.current[i] = el)} x={98 + (i % 2) * 14} y={104 - Math.floor(i / 2) * 13} width="10" height="9" rx="2" fill={LED_OFF} />)}
    </Panel>
  );
}

// la consola completa: los aparatos que están sonando ahora, uno junto al otro
export default function Consola({ compact = false }) {
  const s = useS(), list = [], seen = new Set();
  for (const t of s.tracks) {
    if (!session.audible(t)) continue;
    const prof = session.profileFor(t), port = session.portFor(t);
    if (session.toDevice(t, port)) { const key = `${prof.id}|${port?.name || ''}`; if (!seen.has(key)) { seen.add(key); list.push({ key, prof, port: port?.name, name: prof.name }); } }
    if (session.toKit(t, port) && !seen.has('compu')) { seen.add('compu'); list.push({ key: 'compu', prof: { art: 'interno' }, name: 'Compu' }); }
  }
  const sk = session.sidekick; if (sk?.input) list.push({ key: 'sidekick', prof: { art: 'mezclador' }, port: sk.input.name, name: 'Sidekick' });
  if (!list.length) return null;
  const face = (d) => {
    switch (d.prof.art) {
      case 'bolsillo': return <Pocket port={d.port} name={d.name} />;
      case 'mezclador': return <Mixer port={d.port} name={d.name} />;
      case 'ritmos': case 'groovebox': case 'software': case 'personal': return <Steps port={d.port} name={d.name} sub={d.prof.maker ? d.prof.maker.toUpperCase().slice(0, 30) : 'SECUENCIADOR'} />;
      case 'teclado': return <Keys port={d.port} name={d.name} />;
      default: return <Speaker name={d.name} />;
    }
  };
  const W = { bolsillo: 190, mezclador: 210, interno: 170 };
  return (
    <section aria-label="Consola: lo que está sonando" style={{ flex: 'none', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: compact ? 'nowrap' : 'wrap', overflowX: compact ? 'auto' : undefined, padding: 12, borderRadius: 14, background: 'linear-gradient(#141518, #0F1012)', border: '1px solid #26282C' }}>
      {list.map((d) => <div key={d.key} style={{ flex: `0 0 ${Math.round((W[d.prof.art] || 260) * (compact ? 0.68 : 1))}px` }}>{face(d)}</div>)}
    </section>
  );
}
export { Pocket, Mixer, Steps, Keys, Speaker };
