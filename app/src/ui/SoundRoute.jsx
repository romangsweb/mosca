import { session } from '../engine/session.js';
import { KITS } from '../engine/kits.js';
import { Icon } from './kit.jsx';

// ¿Dónde suena cada pista? Un vistazo: aparato, kit de la compu o ambos.
export const kitName = (id) => (id === 'propio' ? 'Mi kit' : KITS.find((k) => k.id === id)?.name || 'Análogo');
export function whereText(t) {
  const port = session.portFor(t), prof = session.profileFor(t), parts = [];
  if (session.toDevice(t, port)) parts.push(`${prof.name}${prof.kind === 'grupos' && t.mode !== 'melodia' ? ` · grupo ${t.group}` : ''}`);
  if (session.toKit(t, port)) parts.push(`kit ${kitName(session.s.kitActive || session.s.kitId)} en la compu`);
  return parts.join(' + ') || 'en silencio';
}

export function SoundRoute({ tracks = session.s.tracks, compact = false, sounds = true }) {
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {tracks.map((t) => (
        <span key={t.id} className="chip" style={{ gap: 6, textTransform: 'none', letterSpacing: 0, fontSize: compact ? 11 : 12, opacity: session.audible(t) ? 1 : 0.55 }} title={`Pista ${t.name}: ${whereText(t)}`}>
          <Icon name={t.sense} size={12} />{compact ? '' : `${t.name} → `}{whereText(t)}{t.mode === 'melodia' ? ' · melodía' : ''}
        </span>
      ))}
      <a href="#/mezcla" className="btn ghost" style={{ height: 28 }}>Cambiar dónde suena</a>
      {sounds && <a href="#/sonido?libreria" className="btn ghost" style={{ height: 28 }}>Cambiar sonidos</a>}
    </div>
  );
}
