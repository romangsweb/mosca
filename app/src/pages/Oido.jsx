import { useEffect, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { useS, useTick, Icon, Seg } from '../ui/kit.jsx';

const BANDS = [['jon_ce', 'Graves', 'JO-CM', '#7D93B2'], ['jon_f', 'Medios', 'JO-FV', '#ECECEE'], ['jon_dm', 'Agudos', 'JO-DA', '#FF6A1A']];
const bandOf = (i, n) => (i < n * 0.08 ? 0 : i < n * 0.4 ? 1 : 2);

function useOidoTrack() {
  useEffect(() => { session.set({ selTrack: 'oido' }); const t = session.track('oido'); if (t.mute) session.setTrack('oido', { mute: false }); }, []);
}
// Espectro circular real (micrófono o archivo) con anillos
function Radial({ on }) {
  const cv = useRef(null);
  useEffect(() => {
    let raf; const c = cv.current, g = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio);
    const draw = (t) => {
      const W = c.clientWidth, H = c.clientHeight; if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, r0 = 86, ear = session.ear, n = 96;
      let bins = null; if (on && ear.an) { ear.an.getByteFrequencyData(ear.bins); bins = ear.bins; }
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2, b = bandOf(i % 48, 48);
        const v = bins ? bins[Math.floor(Math.pow((i % 48) / 48, 1.6) * 380) + 2] / 255 : 0.06 + 0.04 * Math.sin(t / 700 + i * 0.4);
        const len = 6 + v * 92;
        g.strokeStyle = BANDS[b][3]; g.globalAlpha = 0.35 + v * 0.65; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); g.stroke();
      }
      if (on) for (let k = 0; k < 3; k++) { const ph = ((t / 2400 + k / 3) % 1); g.globalAlpha = (1 - ph) * 0.5; g.strokeStyle = '#FF6A1A'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, 70 + ph * 150, 0, Math.PI * 2); g.stroke(); }
      g.globalAlpha = 1; raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, [on]);
  return <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true" />;
}
function Waveform({ peaks }) {
  const cv = useRef(null);
  useEffect(() => {
    let raf; const c = cv.current, g = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio), ear = session.ear;
    const draw = () => {
      const W = c.clientWidth, H = c.clientHeight; if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const dur = ear.src?.buffer?.duration || 1, ph = ear.ctx && ear.t0 != null ? ((ear.ctx.currentTime - ear.t0) % dur) / dur : 0;
      const n = peaks.length, bw = W / n;
      peaks.forEach(([lo, mid, hi], i) => {
        const x = i * bw, played = i / n < ph, h = Math.max(2, (lo + mid + hi) / 3 * H * 0.9);
        const b = lo > mid && lo > hi ? 0 : hi > mid ? 2 : 1;
        g.fillStyle = BANDS[b][3]; g.globalAlpha = played ? 0.95 : 0.35; g.fillRect(x + 0.5, (H - h) / 2, Math.max(1, bw - 1.5), h);
      });
      g.globalAlpha = 1; g.fillStyle = '#FF6A1A'; g.shadowColor = '#FF6A1A'; g.shadowBlur = 12; g.fillRect(ph * W - 1, 0, 2, H); g.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, [peaks]);
  return <canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label="Forma de onda del archivo con cabezal de reproducción" />;
}
function peaksOf(buf, n = 160) {
  const d = buf.getChannelData(0), step = Math.floor(d.length / n), out = [];
  for (let i = 0; i < n; i++) { let lo = 0, hi = 0, prev = 0; for (let j = i * step; j < (i + 1) * step; j += 8) { const x = d[j]; lo += Math.abs(x); hi += Math.abs(x - prev); prev = x; } lo /= step / 8; hi /= step / 8; out.push([Math.min(1, lo * 2.2), Math.min(1, (lo + hi) * 1.3), Math.min(1, hi * 2.5)]); }
  return out;
}
function Fader({ id, label, sensor, color, value, onChange }) {
  const f = value / 200;
  const drag = (e) => { const r = e.currentTarget.getBoundingClientRect(); onChange(Math.round(Math.max(0, Math.min(1, (r.bottom - 14 - e.clientY) / (r.height - 28))) * 200)); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: 110 }}>
      <span className="mono" style={{ fontSize: 16 }}>{value}<small className="muted" style={{ fontSize: 10 }}> Hz</small></span>
      <div aria-hidden="true" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag(e); }} onPointerMove={(e) => e.buttons && drag(e)}
        style={{ position: 'relative', width: 44, height: 280, borderRadius: 10, background: '#131315', border: '1px solid rgba(255,255,255,.07)', cursor: 'ns-resize', touchAction: 'none' }}>
        <span style={{ position: 'absolute', left: '50%', top: 14, bottom: 14, width: 2, marginLeft: -1, background: '#26262B' }} />
        <span style={{ position: 'absolute', left: '50%', bottom: 14, height: `calc((100% - 28px) * ${f})`, width: 2, marginLeft: -1, background: color }} />
        <span style={{ position: 'absolute', left: 4, right: 4, bottom: `calc(3px + (100% - 28px) * ${f})`, height: 22, borderRadius: 5, background: 'linear-gradient(180deg,#2A2A2F,#1B1B1F)', border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 2px 6px rgba(0,0,0,.6)' }}><span style={{ position: 'absolute', left: 6, right: 6, top: 10, height: 1, background: color }} /></span>
      </div>
      <label htmlFor={id} style={{ fontWeight: 500 }}>{label}</label><span className="mono muted" style={{ fontSize: 10 }}>{sensor}</span>
      <input id={id} type="range" min="0" max="200" value={value} onChange={(e) => onChange(+e.target.value)} style={{ width: '100%', accentColor: color }} />
    </div>
  );
}
function Side() {
  useTick(12);
  const s = session.s, L = session.live, live = s.oidoSource !== 'manual' && session.ear.kind;
  const lv = BANDS.map(([k], i) => (live ? session.ear.read()[i] : s.inputs[k] / 200));
  const groom = s.playing && L.groom > 8;
  return (
    <aside className="inspector" style={{ paddingTop: 0 }}>
      <section className="panel">
        <h2>Lo que oye la mosca</h2>
        <div className="row" style={{ height: 150, alignItems: 'stretch' }}>
          {BANDS.map(([k, label, sensor, c], i) => (
            <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div className="well" style={{ flex: 1, width: '100%', position: 'relative', overflow: 'hidden' }}><span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.round(lv[i] * 100)}%`, background: c, opacity: 0.85, transition: 'height .1s linear' }} /></div>
              <span style={{ fontSize: 11 }}>{label}</span><span className="mono muted" style={{ fontSize: 9.5 }}>{sensor}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Respuesta del circuito</h2>
        <div className="row">
          <div className="stat"><div className="label">DNg35</div><div className="v" style={{ fontSize: 20 }}>{s.playing ? Math.round(L.groom) : 0}<small className="muted" style={{ fontSize: 10 }}> Hz</small></div></div>
          <div className="stat" style={{ background: groom ? 'var(--acc-soft)' : undefined, color: groom ? 'var(--acc)' : 'var(--dim)', display: 'flex', alignItems: 'center', gap: 8, transition: 'all .3s' }}><span className="mono" style={{ fontSize: 10, letterSpacing: '.1em' }}>{groom ? 'SE ACICALA' : 'TRANQUILA'}</span></div>
        </div>
        {!s.playing && <button type="button" className="btn acc" onClick={() => session.play()}><Icon name="play" size={12} fill="currentColor" />Tocar para oír al circuito</button>}
        <p className="dim" style={{ margin: 0, fontSize: 11, lineHeight: 1.55 }}>Asignar bandas a cada grupo de sensores es una decisión de diseño de Fly Punch, no una medición fisiológica.</p>
      </section>
    </aside>
  );
}

export default function Oido() {
  useOidoTrack();
  const s = useS(), [err, setErr] = useState(null), [peaks, setPeaks] = useState(null), [over, setOver] = useState(false), fileIn = useRef(null);
  const src = s.oidoSource, ear = session.ear;
  const pick = async (id) => {
    setErr(null);
    if (id === 'manual') { ear.stop(); session.set({ oidoSource: 'manual' }, true); return; }
    if (id === 'mic') { session.set({ oidoSource: 'mic' }, true); return; }
    session.set({ oidoSource: 'archivo' }, true);
  };
  const micOn = src === 'mic' && ear.kind === 'mic';
  const toggleMic = async () => {
    try { if (micOn) { ear.stop(); session.emit(); } else { await ear.mic(); if (!session.s.playing) session.play(); session.emit(); } }
    catch { setErr('No pudimos usar el micrófono. Revisa el permiso del navegador.'); }
  };
  const loadFile = async (f) => {
    try { await ear.file(f); ear.t0 = ear.ctx.currentTime; setPeaks(peaksOf(ear.src.buffer)); if (!session.s.playing) session.play(); session.emit(); }
    catch { setErr('No pudimos leer ese archivo de audio.'); }
  };
  const loadDemo = async () => {
    // demo sintético: bajo + voz aproximada + platillos, generado aquí mismo
    const sr = 44100, ctx = new OfflineAudioContext(1, sr * 8, sr);
    for (let b = 0; b < 16; b++) { const t = b * 0.5; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.45); }
    for (let b = 0; b < 32; b++) { const t = b * 0.25 + 0.125, buf = ctx.createBuffer(1, sr * 0.05, sr), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000; n.buffer = buf; n.connect(f).connect(ctx.destination); n.start(t); }
    const v = ctx.createOscillator(), vg = ctx.createGain(); v.type = 'sawtooth'; [220, 247, 196, 262].forEach((f, i) => v.frequency.setValueAtTime(f, i * 2)); vg.gain.value = 0.12; v.connect(vg).connect(ctx.destination); v.start(2); v.stop(6);
    const rendered = await ctx.startRendering();
    const blob = await bufferToFile(rendered); loadFile(new File([blob], 'ejemplo-bajo-voz-platillos.wav', { type: 'audio/wav' }));
  };
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Oído</h1><p>La antena es el oído de la mosca. Graves, medios y agudos estimulan tres grupos reales de sensores (órgano de Johnston). Suena en la pista Oído, grupo {session.track('oido').group}.</p></div>
        <Seg role="tab" label="Fuente" items={[['mic', 'Micrófono', 'mic'], ['archivo', 'Archivo', 'archivo'], ['manual', 'Manual', 'manual']]} value={src} onChange={pick} />
      </div>
      <div className="studio-top" style={{ minHeight: 560 }}>
        <div className="stage">
          <div className="vignette" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 50% 46%, rgba(255,106,26,.08), transparent 45%)' }} />
          {src === 'mic' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, animation: 'rise .35s ease-out' }}>
              <div style={{ position: 'relative', width: 400, height: 400, display: 'grid', placeItems: 'center' }}>
                <Radial on={micOn} />
                <button type="button" onClick={toggleMic} aria-pressed={micOn} aria-label={micOn ? 'Detener micrófono' : 'Activar micrófono'} style={{ position: 'relative', width: 132, height: 132, borderRadius: '50%', border: `1px solid ${micOn ? '#FF6A1A' : 'rgba(255,255,255,.14)'}`, background: micOn ? '#FF6A1A' : '#131315', color: micOn ? '#0B0B0C' : '#ECECEE', display: 'grid', placeItems: 'center', boxShadow: micOn ? '0 0 60px rgba(255,106,26,.35)' : 'none', transition: 'all .3s' }}><Icon name="mic" size={40} /></button>
              </div>
              <div style={{ textAlign: 'center' }}><p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{micOn ? 'Escuchando' : 'Micrófono apagado'}</p><p style={{ margin: '6px 0 0', color: '#8C8C94', maxWidth: 380, lineHeight: 1.55 }}>{micOn ? 'Habla, aplaude o pon música cerca. La mosca reacciona en tiempo real.' : 'Pulsa el micrófono. El navegador te pedirá permiso; el audio nunca sale de tu computadora.'}</p></div>
            </div>
          )}
          {src === 'archivo' && !peaks && (
            <div className={`drop${over ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }} style={{ animation: 'rise .35s ease-out' }}>
              <svg className="border" aria-hidden="true"><rect x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="16" fill="rgba(255,255,255,.015)" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" strokeDasharray="8 4" style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }} /></svg>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: '#131315', border: '1px solid rgba(255,255,255,.08)', display: 'grid', placeItems: 'center' }}><Icon name="subir" size={28} /></div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Suelta un archivo de audio</p>
              <p style={{ margin: 0, color: '#8C8C94' }}>WAV, MP3, FLAC u OGG · se analiza en tu navegador, no se sube</p>
              <div className="row"><button type="button" className="btn lg primary" onClick={() => fileIn.current.click()}>Elegir archivo</button><button type="button" className="btn lg" style={{ color: '#ECECEE', borderColor: 'rgba(255,255,255,.12)' }} onClick={loadDemo}>Audio de ejemplo</button></div>
              <input ref={fileIn} type="file" accept="audio/*" hidden onChange={(e) => e.target.files[0] && loadFile(e.target.files[0])} />
            </div>
          )}
          {src === 'archivo' && peaks && (
            <div style={{ position: 'absolute', inset: 0, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16, animation: 'rise .35s ease-out' }}>
              <div className="between">
                <div className="row"><span style={{ width: 40, height: 40, borderRadius: 10, background: '#131315', display: 'grid', placeItems: 'center', color: '#FF6A1A' }}><Icon name="nota" size={18} /></span><div><p style={{ margin: 0, fontWeight: 600 }}>{ear.name}</p><p className="mono" style={{ margin: '2px 0 0', color: '#8C8C94', fontSize: 11 }}>{(ear.src?.buffer?.duration || 0).toFixed(1)} s · EN BUCLE</p></div></div>
                <button type="button" className="btn" style={{ color: '#ECECEE', borderColor: 'rgba(255,255,255,.12)' }} onClick={() => { ear.stop(); setPeaks(null); session.emit(); }}>Quitar</button>
              </div>
              <div style={{ flex: 1, minHeight: 200 }}><Waveform peaks={peaks} /></div>
              <div className="mono" style={{ display: 'flex', gap: 22, fontSize: 10, letterSpacing: '.08em', color: '#8C8C94' }}>{BANDS.map(([k, l, sn, c]) => <span key={k} className="row" style={{ gap: 6 }}><span style={{ width: 10, height: 3, background: c }} />{l.toUpperCase()} → {sn}</span>)}</div>
            </div>
          )}
          {src === 'manual' && (
            <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end', animation: 'rise .35s ease-out' }}>
              {BANDS.map(([k, label, sensor, c]) => <Fader key={k} id={`f-${k}`} label={label} sensor={sensor} color={c} value={s.inputs[k]} onChange={(v) => session.setInput(k, v)} />)}
            </div>
          )}
          {err && <div className="toast" role="alert" style={{ position: 'absolute', bottom: 16 }}>{err}</div>}
        </div>
        <Side />
      </div>
    </div>
  );
}
async function bufferToFile(buf) {
  const len = buf.length * 2 + 44, ab = new ArrayBuffer(len), v = new DataView(ab), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, len - 8, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, len - 44, true);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 0x7fff, true);
  return new Blob([ab], { type: 'audio/wav' });
}
