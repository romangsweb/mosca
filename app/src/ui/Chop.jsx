import { useEffect, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { transientes, cortar, asignar, aArchivo } from '../engine/chop.js';
import { useS, Icon } from './kit.jsx';

// Cortar un loop en pads: sueltas un loop (un break, tu propia batería, una frase), se corta por golpes y cada corte va a una
// voz de Mi kit, del más grave al más brillante. Así la mosca toca tus cortes como una MPC que decide sola.
const COLS = ['#FF6A1A', '#FF8A4D', '#E8C547', '#3DD68C', '#7D93B2', '#C08CFF', '#EC6FA9', '#4CC3D9', '#ECECEE', '#9A9AA2'];
export default function Chop({ onClose }) {
  const s = useS(), [buf, setBuf] = useState(null), [name, setName] = useState(''), [sens, setSens] = useState(0.5), [cortes, setCortes] = useState([]), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null), [over, setOver] = useState(false), cv = useRef(null), pro = session.can('kits');
  const load = async (file) => {
    setMsg(null); if (!file) return; if (file.size > 20 * 1024 * 1024) { setMsg({ bad: true, t: 'El archivo pesa más de 20 MB: usa un loop más corto.' }); return; }
    try { const b = await session.synth.ensure().decodeAudioData(await file.arrayBuffer()); if (b.duration > 30) { setMsg({ bad: true, t: 'Usa un loop de 30 segundos o menos.' }); return; } setBuf(b); setName(file.name.replace(/\.[^.]+$/, '').slice(0, 30)); }
    catch { setMsg({ bad: true, t: 'No pudimos leer ese audio. Prueba con WAV, MP3 o AIFF.' }); }
  };
  useEffect(() => { if (!buf) return; setCortes(asignar(cortar(session.synth.ensure(), buf, transientes(buf, sens, 10)))); }, [buf, sens]);
  // forma de onda con los cortes de color
  useEffect(() => { const c = cv.current; if (!c || !buf) return; const g = c.getContext('2d'), W = (c.width = c.clientWidth * 2), H = (c.height = c.clientHeight * 2), d = buf.getChannelData(0), st = Math.max(1, Math.floor(d.length / W));
    g.clearRect(0, 0, W, H); const bySt = [...cortes].sort((a, b) => a.start - b.start);
    for (let x = 0; x < W; x++) { const t = (x / W) * buf.duration, k = bySt.findLastIndex((q) => q.start <= t); let m = 0; for (let i = x * st; i < (x + 1) * st && i < d.length; i++) m = Math.max(m, Math.abs(d[i])); g.fillStyle = k >= 0 ? COLS[cortes.indexOf(bySt[k]) % COLS.length] : '#555'; const h = m * H * 0.46; g.fillRect(x, H / 2 - h, 1, Math.max(1, h * 2)); }
    g.fillStyle = 'rgba(255,255,255,.85)'; for (const q of bySt) g.fillRect((q.start / buf.duration) * W, 0, 2, H); }, [cortes]);
  const play = (c) => { const ctx = session.synth.ensure(), src = ctx.createBufferSource(); src.buffer = c.buf; src.connect(ctx.destination); src.start(); };
  const save = async () => { setBusy(true); setMsg(null); try { await session.addSamples(cortes.map((c, i) => ({ voice: c.voz, file: aArchivo(c, name || 'loop', i) }))); setMsg({ t: `${cortes.length} cortes guardados en Mi kit. Las pistas con el kit general ya los tocan.` }); if (!s.playing) session.toggle(); } catch (e) { setMsg({ bad: true, t: e.message === 'pro' ? 'Mi kit es parte de Pro.' : 'No se pudieron guardar los cortes.' }); } setBusy(false); };
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="chop-t" style={{ maxWidth: 720 }}>
        <div className="between"><h2 id="chop-t" style={{ fontSize: 18, margin: 0 }}>Cortar un loop en pads</h2><button type="button" className="iconbtn" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={14} /></button></div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Suelta un loop (un break, tu batería, una frase de hasta 30 s). Se corta por golpes y cada corte va a una voz de Mi kit, del más grave al más brillante: la mosca toca tus cortes.</p>
        {!buf ? (
          <label className={`well ${over ? 'drop-over' : ''}`} style={{ padding: 28, display: 'grid', placeItems: 'center', gap: 8, cursor: 'pointer', borderStyle: 'dashed', textAlign: 'center' }} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); load(e.dataTransfer.files[0]); }}>
            <Icon name="subir" size={22} /><span style={{ fontWeight: 600 }}>Suelta aquí tu loop o elige un archivo</span><span className="dim" style={{ fontSize: 11.5 }}>WAV, MP3 o AIFF · hasta 30 s</span>
            <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={(e) => load(e.target.files[0])} />
          </label>
        ) : (<>
          <canvas ref={cv} style={{ width: '100%', height: 96, borderRadius: 10, background: 'var(--screen)', display: 'block' }} aria-label="Forma de onda con los cortes" />
          <label className="row" style={{ gap: 10, fontSize: 12 }}><span className="muted">Menos cortes</span><input type="range" min={0} max={1} step={0.01} value={sens} onChange={(e) => setSens(+e.target.value)} style={{ flex: 1, accentColor: 'var(--acc)' }} /><span className="muted">Más cortes</span><span className="mono" style={{ width: 70, textAlign: 'right' }}>{cortes.length} cortes</span></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
            {cortes.map((c, i) => <button key={i} type="button" className="btn" style={{ justifyContent: 'flex-start', gap: 8, height: 40 }} onClick={() => play(c)} title="Escuchar"><span style={{ width: 10, height: 10, borderRadius: 3, background: COLS[i % COLS.length], flex: 'none' }} /><span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}><span style={{ fontSize: 12.5 }}>{c.voz}</span><span className="mono dim" style={{ fontSize: 9.5 }}>{(c.dur * 1000).toFixed(0)} ms</span></span></button>)}
          </div>
          {msg && <p role="status" style={{ margin: 0, fontSize: 12.5, color: msg.bad ? '#FF8A4D' : 'var(--text)' }}>{msg.t}</p>}
          <div className="row" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <button type="button" className="btn" onClick={() => { setBuf(null); setCortes([]); setMsg(null); }}>Otro loop</button>
            <span className="dim" style={{ fontSize: 11, flex: 1 }}>Reemplaza esas voces de Mi kit.</span>
            {pro ? <button type="button" className="btn acc" disabled={busy || !cortes.length} onClick={save}>{busy ? 'Guardando…' : `Guardar ${cortes.length} cortes en Mi kit`}</button> : <a href="#/cuenta?plan" className="btn acc">Guardar en Mi kit · PRO</a>}
          </div>
        </>)}
        {!buf && msg && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: '#FF8A4D' }}>{msg.t}</p>}
      </div>
    </div>
  );
}
