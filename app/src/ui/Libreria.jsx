import { useEffect, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { KITS, VOICES, kitData, toBuffers } from '../engine/kits.js';
import { playBuffer } from '../engine/synth.js';
import { useS, Icon } from './kit.jsx';

// Patrón corto para escuchar un kit (2 compases a 110 BPM)
const DEMO = [['bombo', [0, 7, 10, 16, 23, 26]], ['caja', [4, 12, 20, 28]], ['hat', [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]], ['hat abierto', [14, 30]], ['palmas', [12, 28]], ['perc', [3, 19, 27]], ['bajo', [0, 10, 16, 26]], ['aro', [9, 25]], ['tom', [29]], ['zap', [31]]];
function audition(buffers) {
  const ctx = session.synth.ensure(), t0 = ctx.currentTime + 0.05, st = 60 / 110 / 4;
  for (const [v, steps] of DEMO) for (const n of steps) playBuffer(ctx, session.synth.out, buffers[v], v.startsWith('hat') ? 80 : 110, t0 + n * st);
  return st * 32 * 1000;
}

// Miniatura: las 10 formas de onda del kit en una tira
function Strip({ id, active }) {
  const cv = useRef(null);
  useEffect(() => {
    const c = cv.current, g = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio), W = c.clientWidth, H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const d = kitData(id), w = W / VOICES.length;
    VOICES.forEach((v, i) => {
      const b = d[v], n = Math.floor(w) - 4, step = Math.max(1, Math.floor(Math.min(b.length, 44100 * 0.6) / n));
      g.fillStyle = i === 0 || i === 8 ? '#FF6A1A' : active ? '#ECECEE' : '#8C8C94';
      for (let x = 0; x < n; x++) { let m = 0; for (let j = 0; j < step; j++) { const q = b[x * step + j] || 0; m += q * q; } const h = Math.max(1, Math.min(1, Math.sqrt(m / step) * 2.2) * (H - 8)); g.globalAlpha = 0.85; g.fillRect(i * w + 2 + x, (H - h) / 2, 1, h); }
    });
  }, [id, active]);
  return <canvas ref={cv} style={{ width: '100%', height: 64, display: 'block' }} aria-hidden="true" />;
}

export default function Libreria() {
  const s = useS(), [playing, setPlaying] = useState(null), [err, setErr] = useState(null), [over, setOver] = useState(null);
  const listen = (id) => { setPlaying(id); const ms = audition(toBuffers(session.synth.ensure(), kitData(id))); setTimeout(() => setPlaying((p) => (p === id ? null : p)), ms); };
  const upload = async (voice, file) => {
    setErr(null); if (!file) return;
    try { await session.addSample(voice, file); } catch (e) { setErr(e.message === 'grande' ? 'El archivo pesa más de 4 MB.' : e.message === 'pro' ? 'Tus propias muestras son parte de Pro.' : 'No pudimos leer ese archivo de audio.'); }
  };
  const pro = session.can('kits'), activeKit = s.kitActive || 'analogo';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p className="muted" style={{ margin: 0, maxWidth: 760, lineHeight: 1.55 }}>Los sonidos de la compu: suenan cuando una pista va a «Compu» o «Ambos» en Mezcla (o cuando no hay aparato), y son los que se usan al exportar a WAV. Todos se sintetizan en la app: son originales y libres de derechos.</p>
      {(() => { const users = s.tracks.filter((t) => session.audible(t) && session.toKit(t)); return (
        <div className="well row" style={{ padding: '10px 12px', gap: 10, fontSize: 12.5, flexWrap: 'wrap' }}>
          <span className={`status-dot${users.length ? ' on' : ''}`} />
          <span style={{ flex: 1, minWidth: 220 }}>{users.length ? `Este kit suena ahora en: ${users.map((t) => t.name).join(' y ')}.` : 'Ahora ninguna pista usa el kit: todas van a tu aparato. Pon una en «Compu» o «Ambos» para oírlo junto al K.O. II.'}</span>
          <a href="#/mezcla" className="btn">Abrir Mezcla</a>
        </div>); })()}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {KITS.map((k) => {
          const on = activeKit === k.id, locked = k.pro && !pro;
          return (
            <article key={k.id} className="panel" style={{ gap: 10, borderColor: on ? 'var(--acc)' : undefined }}>
              <div style={{ borderRadius: 10, background: 'var(--screen)', padding: '6px 4px', position: 'relative' }}>
                <Strip id={k.id} active={on || playing === k.id} />
                {playing === k.id && <span className="chip acc" style={{ position: 'absolute', left: 8, top: 8 }}>SONANDO</span>}
              </div>
              <div className="between"><h3 style={{ fontSize: 15 }}>{k.name}</h3>{k.pro ? <span className="badge-pro">PRO</span> : <span className="chip">FREE</span>}</div>
              <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.5, minHeight: 36 }}>{k.desc}</p>
              <div className="row">
                <button type="button" className="btn" onClick={() => listen(k.id)} disabled={playing === k.id}><Icon name="play" size={11} fill="currentColor" />Escuchar</button>
                <button type="button" className={`btn ${on ? '' : locked ? '' : 'primary'}`} style={{ marginLeft: 'auto' }} disabled={on} onClick={() => session.setKit(k.id)}>{on ? 'En uso' : locked ? 'Desbloquear con Pro' : 'Usar este kit'}</button>
              </div>
            </article>
          );
        })}
      </div>

      <section className="panel" style={{ borderColor: activeKit === 'propio' ? 'var(--acc)' : undefined }}>
        <div className="between" style={{ flexWrap: 'wrap' }}>
          <div><h3 className="row" style={{ fontSize: 15, gap: 8 }}>Mi kit <span className="badge-pro">PRO</span></h3><p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>Sube tus propias muestras (WAV, MP3, AIFF · hasta 4 MB). Lo que no reemplaces suena con Análogo. Se guardan en este navegador.</p></div>
          {pro && <button type="button" className={`btn ${activeKit === 'propio' ? '' : 'primary'}`} disabled={activeKit === 'propio'} onClick={() => session.setKit('propio')}>{activeKit === 'propio' ? 'En uso' : 'Usar Mi kit'}</button>}
        </div>
        {!pro ? <a href="#/cuenta?plan" className="btn lg acc" style={{ alignSelf: 'flex-start' }}>{session.canTrial ? 'Probar Pro 7 días gratis' : 'Ver planes'}</a> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {VOICES.map((v) => {
              const mine = s.customSamples?.[v];
              return (
                <label key={v} className="well" onDragOver={(e) => { e.preventDefault(); setOver(v); }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); setOver(null); upload(v, e.dataTransfer.files[0]); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px dashed ${over === v ? 'var(--acc)' : 'var(--line2)'}`, cursor: 'pointer' }}>
                  <button type="button" className="iconbtn" aria-label={`Escuchar ${v}`} onClick={(e) => { e.preventDefault(); session.synth.play(v, 110); }}><Icon name="play" size={11} fill="currentColor" /></button>
                  <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontWeight: 600, fontSize: 12 }}>{v}</span><span className="muted mono" style={{ display: 'block', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mine || 'Análogo · suelta o elige un archivo'}</span></span>
                  {mine ? <button type="button" className="iconbtn" aria-label={`Quitar muestra de ${v}`} onClick={(e) => { e.preventDefault(); session.removeSample(v); }}><Icon name="x" size={12} /></button> : <Icon name="subir" size={14} />}
                  <input type="file" accept="audio/*" hidden onChange={(e) => upload(v, e.target.files[0])} />
                </label>
              );
            })}
          </div>
        )}
        {err && <p role="alert" style={{ margin: 0, color: '#FF8A4D' }}>{err}</p>}
      </section>
    </div>
  );
}
