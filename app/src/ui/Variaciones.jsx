import { useMemo, useState } from 'react';
import { session } from '../engine/session.js';
import { VARIACIONES, variar, variarCadena, nombreVar } from '../engine/variaciones.js';
import { analyzeTake } from '../engine/armonia.js';
import { pedirVariacion, contextoVariacion, ERRORES } from '../engine/productor.js';
import { useS, Icon } from './kit.jsx';

// Variaciones: una toma nueva a partir de esta. Las de la lista son gratis e instantáneas; describirla con palabras es Pro (IA).
export default function Variaciones({ take, onClose, onDone }) {
  const s = useS(), [st, setSt] = useState(5), [busy, setBusy] = useState(null), [txt, setTxt] = useState(''), [msg, setMsg] = useState(null), pro = session.can('armonia');
  const an = useMemo(() => analyzeTake(take), [take]);
  const save = async (edited, suffix) => { const id = await session.saveEditedTake(take, edited, suffix); if (id) { session.tourMark('variacion'); onDone(id); } else setMsg({ bad: true, t: 'No se pudo guardar: llegaste al límite de tomas.' }); };
  const one = async (op) => { setBusy(op); setMsg(null); const v = op === 'transponer' ? st : 0; await save(variar(take, op, v), nombreVar(op, v)); setBusy(null); };
  const ia = async () => {
    const t = txt.trim(); if (!t) return; setBusy('ia'); setMsg(null);
    try { const r = await pedirVariacion(contextoVariacion(take, an), t); await save(variarCadena(take, r.ops), r.nombre.toLowerCase()); }
    catch (e) { setMsg({ bad: true, t: ERRORES[e.message] || ERRORES.red }); }
    setBusy(null);
  };
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="var-t" style={{ maxWidth: 640 }}>
        <div className="between"><h2 id="var-t" style={{ fontSize: 18, margin: 0 }}>Variaciones de «{take.name}»</h2><button type="button" className="iconbtn" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={14} /></button></div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Cada una crea una toma nueva con lo que tocó la mosca, transformado. Esta queda igual.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {VARIACIONES.map(([id, n, d]) => (
            <div key={id} className="well" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{n}</span>
              <span className="dim" style={{ fontSize: 11.5, lineHeight: 1.4, flex: 1 }}>{d}</span>
              <div className="row" style={{ gap: 6 }}>
                {id === 'transponer' && <select className="input" aria-label="Semitonos" style={{ height: 30, width: 'auto' }} value={st} onChange={(e) => setSt(+e.target.value)}>{[-12, -7, -5, -3, -2, -1, 1, 2, 3, 5, 7, 12].map((x) => <option key={x} value={x}>{x > 0 ? '+' : ''}{x} st</option>)}</select>}
                <button type="button" className="btn" style={{ flex: 1 }} disabled={!!busy} onClick={() => one(id)}>{busy === id ? 'Creando…' : 'Crear'}</button>
              </div>
            </div>
          ))}
        </div>
        <div className="well" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>Descríbela con tus palabras <span className="chip" style={{ marginLeft: 4 }}>IA · BETA</span>{!pro && <span className="badge-pro" style={{ marginLeft: 6 }}>PRO</span>}</span>
          {!s.user ? <a href="#/bienvenida" className="btn" onClick={onClose}>Inicia sesión para usarla</a> : !pro ? <a href="#/cuenta?plan" className="btn acc" onClick={onClose}>Disponible en Pro</a> : (
            <div className="row" style={{ gap: 6 }}>
              <input className="input" style={{ flex: 1, minWidth: 0 }} maxLength={240} placeholder="«más lenta y oscura», «una versión para cerrar el set»…" value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') ia(); }} aria-label="Describe la variación" />
              <button type="button" className="btn acc" disabled={!!busy || !txt.trim()} onClick={ia}>{busy === 'ia' ? 'Pensando…' : 'Crear'}</button>
            </div>
          )}
          <span className="dim" style={{ fontSize: 11 }}>Gemini elige qué transformaciones de la lista aplicar y en qué orden; solo recibe un resumen de la toma (tempo, compases, notas por pista, tonalidad).</span>
        </div>
        {msg && <p role="alert" style={{ margin: 0, color: msg.bad ? '#FF8A4D' : 'var(--text)', fontSize: 12.5 }}>{msg.t}</p>}
      </div>
    </div>
  );
}
