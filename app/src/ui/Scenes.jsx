import { session } from '../engine/session.js';
import { SLOTS, SCENE_COLORS } from '../engine/song.js';
import { useS, useTick, Icon } from './kit.jsx';

// Tira de escenas: clic lanza la escena (en el siguiente compás si está tocando). «Guardar» fija lo que suena ahora.
export default function ScenesStrip() {
  const s = useS(); useTick(8);
  const L = session.live, barFrac = s.playing ? (L.step % session.C.len) / session.C.len : 0;
  return (
    <section className="panel" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: '8px 12px', flexWrap: 'wrap' }} aria-label="Escenas">
      <h2 style={{ marginRight: 4 }}>Escenas</h2>
      <div className="row" style={{ gap: 6, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
        {SLOTS.map((slot) => {
          const sc = s.scenes[slot], allowed = session.slotAllowed(slot), now = s.sceneNow === slot, pend = s.pendingScene === slot;
          return (
            <button key={slot} type="button" disabled={!sc && !allowed}
              onClick={() => (sc ? session.launchScene(slot) : session.saveScene(slot))}
              title={sc ? `Lanzar ${sc.name}` : allowed ? `Guardar lo que suena en ${slot}` : 'Escenas C–H: Pro'}
              style={{ position: 'relative', overflow: 'hidden', height: 34, minWidth: 84, padding: '0 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                border: `1px ${sc ? 'solid' : 'dashed'} ${now ? SCENE_COLORS[slot] : 'var(--line2)'}`, background: now ? 'var(--sel)' : 'transparent', color: sc ? 'var(--text)' : 'var(--sub)', opacity: !sc && !allowed ? 0.45 : 1 }}>
              {pend && <span aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: `${barFrac * 100}%`, background: SCENE_COLORS[slot] }} />}
              <span className="mono" style={{ width: 16, height: 16, borderRadius: 4, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 600, background: sc ? SCENE_COLORS[slot] : 'transparent', color: '#0B0B0C', border: sc ? 0 : '1px solid var(--line2)' }}>{slot}</span>
              <span style={{ maxWidth: 90, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sc ? sc.name : allowed ? 'Guardar' : 'PRO'}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="btn" disabled={!s.sceneNow} onClick={() => session.saveScene(s.sceneNow)} title="Sobrescribe la escena activa con lo que suena ahora"><Icon name="check" size={13} />Actualizar {s.sceneNow || ''}</button>
      <a href="#/cancion" className="btn">{s.songOn ? <><span className="status-dot on" />Canción</> : 'Canción'}</a>
    </section>
  );
}
