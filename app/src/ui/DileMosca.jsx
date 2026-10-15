import { useEffect, useRef, useState } from 'react';
import { session, SENSE_LABEL } from '../engine/session.js';
import { contextoMosca, pedirMosca, aplicarMosca, resumenMosca, ANIMOS, ERRORES, cuota } from '../engine/productor.js';
import { useS, Icon } from './kit.jsx';

// «Dile a la mosca»: escribes cómo quieres que se sienta y Gemini lo traduce a sus sentidos (dulce, olores, cantos, luz…).
// La mosca sigue decidiendo las notas: tú cambias lo que siente. Los ánimos rápidos no usan IA ni consultas.
const SENT_COL = { gusto: '#FF6A1A', oido: '#7D93B2', olfato: '#3DD68C', cortejo: '#C08CFF', vision: '#E8C547' };
let LOG = []; // la conversación vive mientras la app esté abierta

export default function DileMosca({ onClose }) {
  const s = useS(), pro = session.can('armonia'), [txt, setTxt] = useState(''), [busy, setBusy] = useState(false), [log, setLog] = useState(LOG), [q, setQ] = useState(null), box = useRef(null), inp = useRef(null);
  useEffect(() => { LOG = log; box.current?.scrollTo({ top: 1e6, behavior: 'smooth' }); }, [log]);
  useEffect(() => { inp.current?.focus(); if (s.user && pro) cuota().then(setQ).catch(() => {}); }, []);
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  const push = (m) => setLog((l) => [...l, m].slice(-40));
  const apply = (texto, r, ia) => {
    const before = { ...session.s.inputs }, undo = aplicarMosca(session, r), { ch, otros } = resumenMosca(session, before, r, SENSE_LABEL);
    if (!session.s.playing) session.toggle(); // decirle algo a la mosca es para oírla
    session.tourMark('mosca');
    push({ quien: 'mosca', texto: r.respuesta, ch, otros, undo, ia, cambio: [...ch.map(([l, , v]) => `${l} ${v}`), ...otros].join(', ') });
  };
  const animo = ([n, resp, est, extra]) => { push({ quien: 'tu', texto: n }); apply(n, { respuesta: resp, estimulos: est, ...extra, transicion_compases: 2 }, false); };
  const send = async () => {
    const t = txt.trim(); if (!t || busy) return; setTxt(''); push({ quien: 'tu', texto: t }); setBusy(true);
    try { const r = await pedirMosca(contextoMosca(session, LOG.filter((m) => m.quien === 'mosca')), t); setQ({ quedan: r.quedan, de: r.de }); apply(t, r, true); }
    catch (e) { push({ quien: 'sistema', texto: ERRORES[e.message] || ERRORES.red }); }
    setBusy(false);
  };
  return (
    <aside className="dile" role="dialog" aria-label="Dile a la mosca">
      <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
        <div><div style={{ fontWeight: 650 }}>Dile a la mosca</div><div className="dim" style={{ fontSize: 11 }}>Cambias lo que siente; ella decide qué tocar.</div></div>
        <button type="button" className="iconbtn" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={14} /></button>
      </div>
      <div ref={box} className="dile-log" aria-live="polite">
        {!log.length && <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.55, padding: '4px 2px' }}>Escribe cómo quieres que se sienta: «que tenga hambre pero algo la asuste», «que esté enamorada y tranquila», «más intensa». O empieza con un ánimo de abajo (esos no gastan consultas).</div>}
        {log.map((m, i) => (
          <div key={i} className={`msg ${m.quien}`}>
            {m.quien === 'mosca' && <div className="mono dim" style={{ fontSize: 9.5, marginBottom: 3 }}>LA MOSCA{m.ia ? ' · VÍA GEMINI' : ''}</div>}
            <div>{m.texto}</div>
            {m.ch?.length > 0 && <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 6 }}>{m.ch.map(([l, a, b, sen]) => <span key={l} className="chip mono" style={{ borderColor: SENT_COL[sen], color: 'var(--text)' }}>{l} {a}→{b}</span>)}</div>}
            {m.otros?.length > 0 && <div className="mono dim" style={{ fontSize: 10.5, marginTop: 4 }}>{m.otros.join(' · ')}</div>}
            {m.undo && i === log.length - 1 && <button type="button" className="linkbtn" style={{ marginTop: 6, fontSize: 11, background: 'none', border: 0, color: 'var(--sub)', textDecoration: 'underline', cursor: 'pointer', padding: 0 }} onClick={() => { m.undo(); push({ quien: 'sistema', texto: 'Listo: volvió a como estaba.' }); }}>Deshacer</button>}
          </div>
        ))}
        {busy && <div className="msg mosca dim">…</div>}
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{ANIMOS.map((a) => <button key={a[0]} type="button" className="btn" style={{ height: 28, fontSize: 12 }} onClick={() => animo(a)}>{a[0]}</button>)}</div>
        {!s.user ? <a href="#/bienvenida" className="btn" onClick={onClose}>Inicia sesión para escribirle con tus palabras</a> : !pro ? <a href="#/cuenta?plan" className="btn acc" onClick={onClose}>Escribirle con tus palabras es Pro</a> : (
          <div className="row" style={{ gap: 6 }}>
            <input ref={inp} className="input" style={{ flex: 1, minWidth: 0 }} maxLength={240} placeholder="Dile a la mosca…" value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') send(); }} aria-label="Lo que le dices a la mosca" />
            <button type="button" className="btn acc" disabled={busy || !txt.trim() || q?.quedan === 0} onClick={send}>Decir</button>
          </div>
        )}
        <div className="dim" style={{ fontSize: 10.5 }}>{q ? `Te quedan ${q.quedan} de ${q.de} este mes · ` : ''}La mosca no habla: Gemini traduce tu frase a lo que siente. No escribas datos personales.</div>
      </div>
    </aside>
  );
}
