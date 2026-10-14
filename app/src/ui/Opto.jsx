import { session } from '../engine/session.js';
import { useS, useTick, Icon, Seg } from './kit.jsx';

// Optogenética: en el laboratorio se ponen proteínas sensibles a la luz en neuronas concretas.
// CsChrimson + luz roja las hace disparar; GtACR + luz verde las apaga. Aquí la luz pulsa al ritmo del compás.
const PATTERNS = {
  negras: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  corcheas: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  sincopa: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
  rafaga: [1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
};
export default function Opto() {
  const s = useS(); useTick(20);
  const o = s.opto || {}, pat = o.pattern || PATTERNS.negras, red = o.mode !== 'silenciar', col = red ? '#FF3B30' : '#38E07B';
  const track = session.track(), pads = session.pads(track), sel = pads[s.selPad ?? 11], pos = session.live.step % session.C.len;
  const targetsTxt = o.target === 'pista' ? `las ${pads.filter((p) => p.clase !== 'sensor').length} neuronas de la pista` : o.target === 'salida' ? `la salida (${pads[11].tipo})` : `${sel?.tipo} (elígela en el mapa o en los pads)`;
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn lg" aria-pressed={!!o.on} onClick={() => { session.setOpto({ on: !o.on }); if (!o.on && !s.playing) session.play(); }} style={o.on ? { background: col, borderColor: col, color: '#0B0B0C' } : undefined}><Icon name="sol" size={14} />{o.on ? 'Luz encendida' : 'Encender la luz'}</button>
          <Seg label="Efecto de la luz" items={[['activar', 'Activar · roja'], ['silenciar', 'Silenciar · verde']]} value={o.mode || 'activar'} onChange={(v) => session.setOpto({ mode: v })} />
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="label">Dónde</span>
          <Seg label="Neuronas iluminadas" items={[['pad', 'Neurona elegida'], ['pista', 'Toda la pista'], ['salida', 'Salida']]} value={o.target || 'pad'} onChange={(v) => session.setOpto({ target: v })} />
        </div>
        <span className="muted" style={{ fontSize: 12 }}>Iluminas: <strong style={{ color: col }}>{targetsTxt}</strong></span>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${session.C.len}, 1fr)`, gap: 4 }} role="group" aria-label="Pulsos de luz por paso">
          {pat.slice(0, session.C.len).map((on, i) => (
            <button key={i} type="button" aria-pressed={!!on} aria-label={`Paso ${i + 1}`} onClick={() => session.setOpto({ pattern: pat.map((x, j) => (j === i ? (x ? 0 : 1) : x)) })}
              style={{ height: 34, borderRadius: 6, border: `1px solid ${on ? col : 'var(--line)'}`, background: on ? col : session.C.pulsos.includes(i) ? 'var(--hover)' : 'var(--well)', opacity: s.playing && pos === i ? 1 : on ? 0.85 : 1, boxShadow: s.playing && pos === i && on && o.on ? `0 0 14px ${col}` : 'none', outline: s.playing && pos === i ? '1px solid var(--text)' : 'none' }} />
          ))}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="label">Patrón</span>
          {[['negras', 'Cada tiempo'], ['corcheas', 'Corcheas'], ['sincopa', 'Síncopa'], ['rafaga', 'Ráfagas']].map(([id, l]) => <button key={id} type="button" className="btn" style={{ height: 30 }} onClick={() => session.setOpto({ pattern: [...PATTERNS[id]] })}>{l}</button>)}
          <button type="button" className="btn" style={{ height: 30 }} onClick={() => session.setOpto({ pattern: Array.from({ length: 16 }, () => (Math.random() < 0.3 ? 1 : 0)) })}><Icon name="dado" size={12} />Al azar</button>
        </div>
        <label className="row" style={{ gap: 10, fontSize: 12 }}><span className="muted" style={{ width: 70 }}>Intensidad</span><input type="range" min="0" max="100" value={Math.round((o.power ?? 0.6) * 100)} onChange={(e) => session.setOpto({ power: +e.target.value / 100 })} style={{ flex: 1, accentColor: col }} /><span className="mono" style={{ width: 36, fontSize: 11 }}>{Math.round((o.power ?? 0.6) * 100)}%</span></label>
      </div>
      <p className="muted" style={{ flex: '1 1 240px', margin: 0, fontSize: 12, lineHeight: 1.55 }}>
        <strong style={{ color: 'var(--text)' }}>Optogenética.</strong> En el laboratorio se ponen proteínas sensibles a la luz en neuronas concretas: con <span style={{ color: '#FF3B30' }}>CsChrimson y luz roja</span> disparan; con <span style={{ color: '#38E07B' }}>GtACR y luz verde</span> se apagan. Aquí la luz pulsa al ritmo: activar la salida fuerza su golpe; silenciar una interneurona cambia todo lo que viene después.
      </p>
    </div>
  );
}
