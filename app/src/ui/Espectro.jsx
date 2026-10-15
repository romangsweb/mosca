import { useEffect, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { useS } from './kit.jsx';

// Analizador de espectro: la mezcla de la compu (relleno) y cada pista (línea de su color). Escala logarítmica de 30 Hz a 16 kHz.
// Sirve para ver dónde se pisan las pistas (el bombo y el bajo en los graves, por ejemplo) y qué hace el EQ de cada canal.
const COL = { gusto: '#FF6A1A', oido: '#7D93B2', p3: '#3DD68C', p4: '#C08CFF', armonia: '#E8C547' };
const F0 = 30, F1 = 16000, BANDS = [[30, 'GRAVES'], [250, 'MEDIOS'], [2000, 'AGUDOS'], [6000, 'BRILLO']];

function analysers() {
  const syn = session.synth, ctx = syn.ensure(), ch = syn.chain;
  const A = (syn._an ||= { master: null, tracks: {} });
  if (!A.master) { A.master = ctx.createAnalyser(); A.master.fftSize = 4096; A.master.smoothingTimeConstant = 0.82; ch.post.connect(A.master); }
  for (const [id, b] of Object.entries(ch.buses)) if (!A.tracks[id]) { const a = ctx.createAnalyser(); a.fftSize = 4096; a.smoothingTimeConstant = 0.82; b.mk.connect(a); A.tracks[id] = a; }
  return A;
}

export default function Espectro() {
  const s = useS(), cv = useRef(null), [solo, setSolo] = useState(null), [peak, setPeak] = useState(null);
  useEffect(() => {
    let raf, A = null, buf = null, last = 0;
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      const c = cv.current; if (!c) return;
      if (!A || now - last > 1000) { A = analysers(); last = now; }
      const ctx2 = c.getContext('2d'), dpr = devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
      if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0); ctx2.clearRect(0, 0, W, H);
      const sr = session.synth.ctx.sampleRate, n = A.master.frequencyBinCount; buf ||= new Float32Array(n);
      const x = (f) => (Math.log(f / F0) / Math.log(F1 / F0)) * W, y = (db) => H - Math.max(0, Math.min(1, (db + 100) / 80)) * (H - 14);
      // rejilla de bandas
      ctx2.font = '9px JetBrains Mono, monospace'; ctx2.fillStyle = 'rgba(255,255,255,.28)'; ctx2.strokeStyle = 'rgba(255,255,255,.06)';
      for (const [f, l] of BANDS) { const xx = x(f); ctx2.beginPath(); ctx2.moveTo(xx, 0); ctx2.lineTo(xx, H); ctx2.stroke(); ctx2.fillText(l, xx + 4, 11); }
      const curve = (an) => { an.getFloatFrequencyData(buf); const pts = []; for (let px = 0; px <= W; px += 3) { const f = F0 * Math.pow(F1 / F0, px / W), i = Math.min(n - 1, Math.round((f / (sr / 2)) * n)); let m = -140; for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) m = Math.max(m, buf[j]); pts.push([px, y(m), m, f]); } return pts; };
      // la mezcla: relleno
      const mp = curve(A.master); ctx2.beginPath(); ctx2.moveTo(0, H); mp.forEach(([px, py]) => ctx2.lineTo(px, py)); ctx2.lineTo(W, H); ctx2.closePath();
      const g = ctx2.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(236,236,238,.30)'); g.addColorStop(1, 'rgba(236,236,238,.03)'); ctx2.fillStyle = g; ctx2.fill();
      // cada pista: línea
      let top = null;
      for (const [id, an] of Object.entries(A.tracks)) {
        if (solo && solo !== id) continue; const t = session.track(id); if (!t && id !== 'armonia') continue;
        const pts = curve(an); ctx2.beginPath(); pts.forEach(([px, py], i) => (i ? ctx2.lineTo(px, py) : ctx2.moveTo(px, py))); ctx2.strokeStyle = COL[id] || '#ECECEE'; ctx2.lineWidth = solo ? 2 : 1.4; ctx2.stroke();
        for (const p of pts) if (!top || p[2] > top.db) top = { db: p[2], f: p[3], id };
      }
      if (now % 500 < 17) setPeak(top && top.db > -70 ? top : null);
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, [solo]);
  const ids = [...s.tracks.filter((t) => session.toKit(t)).map((t) => [t.id, t.name]), ...(s.armonia?.on && s.armonia.salida !== 'midi' ? [['armonia', 'Armonía']] : [])];
  return (
    <section className="panel" style={{ gap: 10 }} aria-label="Analizador de espectro">
      <div className="panel-head"><h2>Espectro</h2><span className="muted" style={{ fontSize: 11 }}>Lo que suena en la compu · 30 Hz – 16 kHz</span></div>
      <div style={{ position: 'relative', borderRadius: 12, background: 'var(--screen)', height: 170, overflow: 'hidden' }}>
        <canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label="Espectro de la mezcla y de cada pista" />
        {!s.playing && <span className="dim" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12 }}>Dale a Tocar para ver el espectro</span>}
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className={`btn ${!solo ? 'acc' : ''}`} style={{ height: 28, fontSize: 12 }} onClick={() => setSolo(null)}>Todas</button>
        {ids.map(([id, n]) => <button key={id} type="button" className={`btn ${solo === id ? 'acc' : ''}`} style={{ height: 28, fontSize: 12 }} onClick={() => setSolo(solo === id ? null : id)}><span style={{ width: 10, height: 3, borderRadius: 2, background: COL[id] || '#ECECEE' }} />{n}</button>)}
        <span className="mono dim" style={{ fontSize: 10.5, marginLeft: 'auto' }}>{peak ? `PICO ${peak.f >= 1000 ? `${(peak.f / 1000).toFixed(1)} kHz` : `${Math.round(peak.f)} Hz`} · ${session.track(peak.id)?.name || 'Armonía'}` : ''}</span>
      </div>
      <span className="dim" style={{ fontSize: 11 }}>Relleno gris: la mezcla. Líneas: cada pista. Si dos líneas suben en la misma zona se están pisando: baja una con el EQ de su canal. El sonido de tus aparatos no pasa por aquí.</span>
    </section>
  );
}
