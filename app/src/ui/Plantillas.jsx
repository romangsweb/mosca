import { session } from '../engine/session.js';
import { PLANTILLAS, aplicarPlantilla, necesitaPro } from '../engine/plantillas.js';
import { useS, Icon } from './kit.jsx';

// Empezar con una plantilla: un género que suena en 30 segundos. Reemplaza tempo, kit y lo que tocan las pistas 1 y 2 (⌘Z deshace).
export default function Plantillas({ onClose }) {
  useS();
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pl-t" style={{ maxWidth: 760 }}>
        <div className="between"><h2 id="pl-t" style={{ fontSize: 18, margin: 0 }}>Empezar con una plantilla</h2><button type="button" className="iconbtn" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={14} /></button></div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Un punto de partida por género: la batería en la pista 1 (con la mosca tocando encima) y la melodía en la pista 2. Cambia tempo, kit y lo que siente la mosca; con ⌘Z vuelves a como estabas.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {PLANTILLAS.map((p) => { const pro = necesitaPro(session, p); return (
            <button key={p.id} type="button" className="well" style={{ padding: 12, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer', border: '1px solid var(--line)' }} onClick={() => { aplicarPlantilla(session, p); onClose(); }}>
              <span className="between" style={{ width: '100%' }}><span style={{ fontWeight: 650, fontSize: 14 }}>{p.nombre}</span><span className="mono dim" style={{ fontSize: 10.5 }}>{p.bpm} BPM</span></span>
              <span className="muted" style={{ fontSize: 12, lineHeight: 1.45 }}>{p.desc}</span>
              {pro.length > 0 && <span className="dim" style={{ fontSize: 10.5 }}><span className="badge-pro" style={{ marginRight: 4 }}>PRO</span>sin Pro suena sin {pro.join(', ')}</span>}
            </button>
          ); })}
        </div>
      </div>
    </div>
  );
}
