import { useEffect, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { PARAMS, ONDAS, DEFAULT, PRESETS, limpiar, render, toFile } from '../engine/disenador.js';
import { VOICES } from '../engine/kits.js';
import { pedirSonido, ERRORES } from '../engine/productor.js';
import { useS, Icon, Seg } from './kit.jsx';

// Diseñador de sonidos: describe un golpe («bombo 808 largo y sucio») y Gemini elige los parámetros; o muévelos tú.
// El audio lo genera este sintetizador (no la IA): original, instantáneo y tuyo. Se guarda como una voz de Mi kit.
const ONDA_L = { sine: 'Seno', triangle: 'Triángulo', square: 'Cuadrada', sawtooth: 'Sierra' };
export default function Disenador({ onClose }) {
  const s = useS(), [p, setP] = useState(DEFAULT), [nombre, setNombre] = useState('Mi sonido'), [voz, setVoz] = useState('bombo'), [txt, setTxt] = useState(''), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null), cv = useRef(null), buf = useRef(null), pro = session.can('kits');
  // dibuja la forma de onda cada vez que cambia el sonido
  useEffect(() => { let off = false; render(p).then((b) => { if (off) return; buf.current = b; const c = cv.current; if (!c) return; const g = c.getContext('2d'), W = (c.width = c.clientWidth * 2), H = (c.height = c.clientHeight * 2), d = b.getChannelData(0), step = Math.max(1, Math.floor(d.length / W));
    g.clearRect(0, 0, W, H); g.fillStyle = '#FF6A1A'; for (let x = 0; x < W; x++) { let m = 0; for (let i = x * step; i < (x + 1) * step && i < d.length; i++) m = Math.max(m, Math.abs(d[i])); const h = m * H * 0.46; g.fillRect(x, H / 2 - h, 1, h * 2 || 1); } }); return () => { off = true; }; }, [p]);
  const listen = () => { const b = buf.current; if (!b) return; const ctx = session.synth.ensure(), src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(); };
  useEffect(() => { const t = setTimeout(listen, 60); return () => clearTimeout(t); }, [p]); // se escucha al cambiarlo
  const ia = async () => { const q = txt.trim(); if (!q) return; setBusy(true); setMsg(null); try { const r = await pedirSonido(q); setP(limpiar(r.params)); setNombre(r.nombre); setVoz(r.voz); setMsg({ t: r.explicacion }); } catch (e) { setMsg({ bad: true, t: ERRORES[e.message] || ERRORES.red }); } setBusy(false); };
  const save = async () => { setBusy(true); try { const b = await render(p); await session.addSample(voz, toFile(b, nombre)); setMsg({ t: `«${nombre}» quedó en la voz «${voz}» de Mi kit${s.user ? ' (y en tu cuenta)' : ''}.` }); } catch (e) { setMsg({ bad: true, t: e.message === 'pro' ? 'Guardar en Mi kit es parte de Pro.' : 'No se pudo guardar.' }); } setBusy(false); };
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="dis-t" style={{ maxWidth: 720 }}>
        <div className="between"><h2 id="dis-t" style={{ fontSize: 18, margin: 0 }}>Diseñar un sonido</h2><button type="button" className="iconbtn" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={14} /></button></div>
        <div className="row" style={{ gap: 6 }}>
          <input className="input" style={{ flex: 1, minWidth: 0 }} maxLength={200} disabled={!s.user || !session.can('armonia')} placeholder={s.user && session.can('armonia') ? 'Descríbelo: «bombo 808 largo y sucio», «gota de agua», «hat de cristal»…' : 'Con Pro: descríbelo y la IA elige los parámetros'} value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') ia(); }} aria-label="Describe el sonido" />
          <button type="button" className="btn acc" disabled={busy || !txt.trim() || !s.user || !session.can('armonia')} onClick={ia}>{busy ? 'Diseñando…' : 'Diseñar con IA'}</button>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}><span className="label">Partir de</span>{PRESETS.map(([n, v]) => <button key={n} type="button" className="btn" style={{ height: 28, fontSize: 12 }} onClick={() => { setP(limpiar({ ...DEFAULT, ...v })); setNombre(n); }}>{n}</button>)}</div>
        <div style={{ position: 'relative', height: 84, borderRadius: 10, background: 'var(--screen)', cursor: 'pointer' }} onClick={listen} title="Escuchar"><canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} aria-label="Forma de onda del sonido" /></div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><span className="label">Onda</span><Seg label="Onda" items={ONDAS.map((o) => [o, ONDA_L[o]])} value={p.onda} onChange={(o) => setP({ ...p, onda: o })} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px 16px' }}>
          {PARAMS.map(([k, l, lo, hi, st, u]) => (
            <label key={k} className="row" style={{ gap: 8, fontSize: 12 }}><span className="muted" style={{ width: 92 }}>{l}</span>
              <input type="range" min={lo} max={hi} step={st} value={p[k]} onChange={(e) => setP({ ...p, [k]: +e.target.value })} style={{ flex: 1, minWidth: 0, accentColor: 'var(--acc)' }} />
              <span className="mono" style={{ width: 52, textAlign: 'right', fontSize: 10.5 }}>{st < 1 ? (+p[k]).toFixed(2) : Math.round(p[k])}{u && ` ${u}`}</span></label>
          ))}
        </div>
        {msg && <p role="status" style={{ margin: 0, fontSize: 12.5, color: msg.bad ? '#FF8A4D' : 'var(--text)' }}>{msg.t}</p>}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <input className="input" style={{ flex: '1 1 160px', minWidth: 0 }} maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del sonido" />
          <select className="input" style={{ width: 'auto' }} value={voz} onChange={(e) => setVoz(e.target.value)} aria-label="Voz de Mi kit">{VOICES.map((v) => <option key={v} value={v}>en la voz «{v}»{s.customSamples?.[v] ? ' (reemplaza)' : ''}</option>)}</select>
          <button type="button" className="btn" onClick={listen}><Icon name="play" size={11} fill="currentColor" />Escuchar</button>
          {pro ? <button type="button" className="btn acc" disabled={busy} onClick={save}>Guardar en Mi kit</button> : <a href="#/cuenta?plan" className="btn acc">Guardar en Mi kit · PRO</a>}
        </div>
        <span className="dim" style={{ fontSize: 11 }}>El sonido lo genera el sintetizador de Fly Punch: la IA solo elige los parámetros. Es tuyo y libre de derechos.</span>
      </div>
    </div>
  );
}
