import { useState } from 'react';
import { session } from '../engine/session.js';
import { pedirBeat, beatAPatron, ERRORES } from '../engine/productor.js';
import { useS, Icon } from './kit.jsx';

// Mis patrones: ritmos guardados por voz (bombo, caja, hat…), para usarlos en cualquier pista. Se generan con tus palabras
// (IA, Pro) o se guardan del patrón congelado de una pista. Al aplicarlos, la pista queda en «Ambos»: el patrón más la mosca.
const CH = (v) => (v >= 110 ? '#FF6A1A' : v >= 80 ? 'rgba(255,106,26,.65)' : v > 0 ? 'rgba(255,106,26,.32)' : 'var(--line)');
function Mini({ p }) {
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      {p.filas.map((f) => (
        <div key={f.voz} style={{ display: 'grid', gridTemplateColumns: `64px repeat(${p.len || 16}, 1fr)`, gap: 2, alignItems: 'center' }}>
          <span className="mono dim" style={{ fontSize: 9.5, whiteSpace: 'nowrap', overflow: 'hidden' }}>{f.voz}</span>
          {Array.from({ length: p.len || 16 }, (_, i) => <span key={i} style={{ height: 8, borderRadius: 2, background: CH(f.vels[i] || 0), outline: i % 4 === 0 ? '1px solid rgba(255,255,255,.06)' : 'none' }} />)}
        </div>
      ))}
    </div>
  );
}

export default function Patrones({ onClose }) {
  const s = useS(), t = session.track(), pro = session.can('armonia'), [txt, setTxt] = useState(''), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null), [nuevo, setNuevo] = useState(null);
  const mine = session.patternFromTrack(t.id);
  const apply = (p) => { const r = session.applyPattern(t.id, p); setMsg(r.ok ? { t: `«${p.nombre}» suena en ${t.name}: el patrón y la mosca encima.${r.faltan.length ? ` Sin pad para: ${r.faltan.join(', ')}.` : ''}` } : { bad: true, t: r.why === 'melodia' ? `${t.name} está en Melodía: pásala a Ritmo para usar un patrón de batería.` : 'No se pudo aplicar.' }); if (!s.playing && r.ok) session.toggle(); };
  const gen = async () => {
    const q = txt.trim(); if (!q || busy) return; setBusy(true); setMsg(null);
    try { const r = await pedirBeat(session, q); const p = beatAPatron(session, r); setNuevo(p); apply(p); }
    catch (e) { setMsg({ bad: true, t: ERRORES[e.message] || ERRORES.red }); }
    setBusy(false);
  };
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pat-t" style={{ maxWidth: 680 }}>
        <div className="between"><h2 id="pat-t" style={{ fontSize: 18, margin: 0 }}>Patrones · pista {t.name}</h2><button type="button" className="iconbtn" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={14} /></button></div>
        <div className="well" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>Generar un beat con tus palabras <span className="chip" style={{ marginLeft: 4 }}>IA · BETA</span>{!pro && <span className="badge-pro" style={{ marginLeft: 6 }}>PRO</span>}</span>
          {!s.user ? <a href="#/bienvenida" className="btn" onClick={onClose}>Inicia sesión para usarlo</a> : !pro ? <a href="#/cuenta?plan" className="btn acc" onClick={onClose}>Disponible en Pro</a> : (
            <div className="row" style={{ gap: 6 }}>
              <input className="input" style={{ flex: 1, minWidth: 0 }} maxLength={240} autoFocus placeholder="«boom bap a 90 con hats sueltos», «reggaetón lento», «techno de 4 al piso»…" value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') gen(); }} aria-label="Describe el beat" />
              <button type="button" className="btn acc" disabled={busy || !txt.trim()} onClick={gen}>{busy ? 'Componiendo…' : 'Generar'}</button>
            </div>
          )}
          <span className="dim" style={{ fontSize: 11 }}>La IA escribe un patrón de un compás; la pista queda en «Ambos»: tu beat de base y la mosca tocando encima. Gasta una de tus consultas del mes.</span>
          {nuevo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <div className="between"><span style={{ fontWeight: 600 }}>{nuevo.nombre}{nuevo.bpm ? <span className="mono dim" style={{ fontSize: 11 }}> · {nuevo.bpm} BPM</span> : null}</span>
                <button type="button" className="btn acc" onClick={() => { session.savePattern(nuevo, nuevo.nombre); setNuevo(null); setMsg({ t: 'Guardado en Mis patrones.' }); }}>Guardar en Mis patrones</button></div>
              {nuevo.explicacion && <span className="muted" style={{ fontSize: 12 }}>{nuevo.explicacion}</span>}
              <Mini p={nuevo} />
            </div>
          )}
        </div>
        {msg && <p role="status" style={{ margin: 0, fontSize: 12.5, color: msg.bad ? '#FF8A4D' : 'var(--text)' }}>{msg.t}</p>}
        <div className="between"><span style={{ fontWeight: 600, fontSize: 13.5 }}>Mis patrones <span className="mono dim" style={{ fontSize: 11 }}>{(s.patrones || []).length}/40</span></span>
          <button type="button" className="btn" disabled={!mine} title={mine ? '' : 'Congela un compás en esta pista (Estudio › Congelar) para guardarlo'} onClick={() => { const n = prompt('Nombre del patrón', `${t.name} ${new Date().toLocaleDateString()}`); if (n != null) { session.savePattern({ ...mine, bpm: Math.round(session.ko.bpm || s.bpm), swing: s.swing }, n || 'Patrón'); setMsg({ t: 'Guardado en Mis patrones.' }); } }}>Guardar el patrón de {t.name}</button></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, maxHeight: 320, overflow: 'auto' }}>
          {!(s.patrones || []).length && <span className="dim" style={{ fontSize: 12 }}>Aún no tienes patrones. Genera uno arriba o congela un compás que te guste y guárdalo.</span>}
          {(s.patrones || []).map((p) => (
            <div key={p.id} className="well" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="between"><span style={{ fontWeight: 600, fontSize: 13 }}>{p.nombre}{p.ia && <span className="chip" style={{ marginLeft: 6 }}>IA</span>}</span><span className="mono dim" style={{ fontSize: 10 }}>{p.bpm ? `${p.bpm} BPM` : ''}</span></div>
              <Mini p={p} />
              <div className="row" style={{ gap: 6 }}><button type="button" className="btn" style={{ flex: 1 }} onClick={() => apply(p)}>Usar en {t.name}</button><button type="button" className="iconbtn" aria-label={`Borrar ${p.nombre}`} onClick={() => session.deletePattern(p.id)}><Icon name="basura" size={13} /></button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
