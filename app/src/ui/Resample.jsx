import { useMemo, useState } from 'react';
import { session } from '../engine/session.js';
import { compas } from '../engine/compas.js';
import { VOICES } from '../engine/kits.js';
import { useS, Seg, Icon } from './kit.jsx';

// Remuestrear: un pedazo de la toma (con los sonidos de la compu o con el audio real de tus aparatos) se vuelve el sonido
// de una voz de Mi kit. Así un compás que tocó la mosca puede ser un pad nuevo: un loop, un golpe, una textura.
export default function Resample({ take, onClose }) {
  const s = useS(), C = compas(take.compas || '4/4'), stepMs = 60000 / (take.bpm || 110) / 4, bars = Math.max(1, Math.ceil(take.durMs / (C.len * stepMs)));
  const [src, setSrc] = useState(take.hasAudio ? 'real' : 'kit'), [track, setTrack] = useState(''), [bar, setBar] = useState(0), [beat, setBeat] = useState(0), [len, setLen] = useState(C.len);
  const [voice, setVoice] = useState('perc'), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null), pro = session.can('kits');
  const beats = Math.max(1, Math.floor(C.len / 4)), lens = useMemo(() => [[2, '1 corchea'], [4, '1 tiempo'], [8, '2 tiempos'], [C.len, '1 compás'], [C.len * 2, '2 compases']].filter(([n], i, a) => a.findIndex(([m]) => m === n) === i), [C.len]);
  const opt = { src, track: track || null, fromStep: bar * C.len + beat * 4, steps: len, label: `c${bar + 1}${beat ? `.${beat + 1}` : ''}` };
  const err = (e) => setMsg({ bad: true, t: e.message === 'pro' ? 'Tus propias muestras son parte de Pro.' : e.message === 'silencio' || e.message === 'vacio' ? 'En ese pedazo no suena nada: elige otro compás.' : e.message === 'sin-audio' ? 'Esta toma no tiene audio real.' : e.message === 'grande' ? 'El pedazo pesa más de 4 MB: hazlo más corto.' : 'No pudimos remuestrear este pedazo.' });
  const listen = async () => {
    setBusy(true); setMsg(null);
    try { const buf = await session.resampleBuffer(take, opt), ctx = session.synth.ensure(), sn = ctx.createBufferSource(); sn.buffer = buf; sn.connect(ctx.destination); sn.start(); setMsg({ t: `${buf.duration.toFixed(2)} s · normalizado a −1 dB` }); }
    catch (e) { err(e); } setBusy(false);
  };
  const save = async () => {
    setBusy(true); setMsg(null);
    try { const d = await session.resample(take, opt, voice); setMsg({ ok: true, t: `Listo: ${d.toFixed(2)} s en la voz «${voice}» de Mi kit. Suena en los pads con esa voz de las pistas que usan Mi kit${s.user ? ', y se sube a tu cuenta' : ''}.` }); }
    catch (e) { err(e); } setBusy(false);
  };
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rs-t" style={{ maxWidth: 520 }}>
        <div className="between"><h2 id="rs-t" style={{ fontSize: 18, margin: 0 }}>Hacer un pad con «{take.name}»</h2><button type="button" className="iconbtn" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={14} /></button></div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Elige un pedazo de la toma: se recorta a tempo, se normaliza y queda como sonido de Mi kit.</p>
        <div className="field"><label>Qué audio</label>
          <Seg label="Fuente" items={[...(take.hasAudio ? [['real', 'Audio real de tus aparatos']] : []), ['kit', 'Sonidos de la compu']]} value={src} onChange={setSrc} /></div>
        {src === 'kit' && (
          <div className="field"><label htmlFor="rs-tr">Pista</label>
            <select id="rs-tr" className="input" value={track} onChange={(e) => setTrack(e.target.value)}><option value="">Todas juntas</option>{take.tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div className="field"><label htmlFor="rs-b">Desde el compás</label><select id="rs-b" className="input" value={bar} onChange={(e) => setBar(+e.target.value)}>{Array.from({ length: bars }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></div>
          <div className="field"><label htmlFor="rs-be">Tiempo</label><select id="rs-be" className="input" value={beat} onChange={(e) => setBeat(+e.target.value)}>{Array.from({ length: beats }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></div>
          <div className="field"><label htmlFor="rs-l">Largo</label><select id="rs-l" className="input" value={len} onChange={(e) => setLen(+e.target.value)}>{lens.map(([n, l]) => <option key={n} value={n}>{l}</option>)}</select></div>
        </div>
        <div className="field"><label htmlFor="rs-v">Guardar en la voz</label>
          <select id="rs-v" className="input" value={voice} onChange={(e) => setVoice(e.target.value)}>{VOICES.map((v) => <option key={v} value={v}>{v}{s.customSamples?.[v] ? ` · ahora: ${s.customSamples[v]}` : ''}</option>)}</select></div>
        {msg && <p role="status" style={{ margin: 0, fontSize: 12.5, color: msg.bad ? '#FF8A4D' : msg.ok ? 'var(--text)' : 'var(--sub)' }}>{msg.t}</p>}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn lg" disabled={busy} onClick={listen}><Icon name="play" size={11} fill="currentColor" />Escuchar</button>
          {pro ? <button type="button" className="btn lg acc" disabled={busy} onClick={save}>Guardar en Mi kit</button> : <a href="#/cuenta?plan" className="btn lg acc">Guardar en Mi kit · PRO</a>}
        </div>
      </div>
    </div>
  );
}
