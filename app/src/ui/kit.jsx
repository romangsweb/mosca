import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { session } from '../engine/session.js';

export const useS = () => useSyncExternalStore((f) => session.subscribe(f), () => session.get());

// re-render a ~fps mientras el componente esté montado (para lecturas en vivo)
export function useTick(fps = 15) {
  const [, set] = useState(0);
  useEffect(() => { let id, last = 0; const loop = (t) => { if (t - last > 1000 / fps) { last = t; set((x) => x + 1); } id = requestAnimationFrame(loop); }; id = requestAnimationFrame(loop); return () => cancelAnimationFrame(id); }, [fps]);
}

export const ICONS = {
  estudio: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  gusto: 'M12 3c3.5 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.5-6.5 6-11z',
  oido: 'M6 20c0-6 2-11 6-14M15.4 10.2a4 4 0 0 1 0 4.8M18 8a7.5 7.5 0 0 1 0 9M11.5 5.3a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0',
  datos: 'M3.5 5h17v14h-17zM3.5 9.5h17M3.5 14h17M9.5 5v14',
  sonido: 'M5 6h14M5 12h14M5 18h14M9 4v4M15 10v4M8 16v4',
  tomas: 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0',
  docs: 'M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM5 16a4 4 0 0 1 4-4h9',
  ajustes: 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  play: 'M7 4.5v15l12-7.5z', stop: 'M6 6h12v12H6z', pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  sol: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 1.5v2M12 20.5v2M1.5 12h2M20.5 12h2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M4.6 19.4L6 18M18 6l1.4-1.4',
  luna: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  mic: 'M9 3h6v11H9zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21',
  archivo: 'M6 3h8l4 4v14H6zM14 3v4h4M9 14v3M12 11v6M15 13v4',
  manual: 'M6 4v16M12 4v16M18 4v16M4 14h4M10 8h4M16 12h4',
  dado: 'M4 4h16v16H4zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
  deshacer: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  subir: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v4h14v-4',
  bajar: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 15v4h14v-4',
  usb: 'M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0zM12 16.5V21',
  nota: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0a3 3 0 1 1 6 0M20 16a3 3 0 1 1-6 0a3 3 0 1 1 6 0',
  basura: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  lapiz: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  mas: 'M12 5v14M5 12h14', menos: 'M5 12h14', x: 'M6 6l12 12M18 6 6 18',
  chevron: 'M6 9l6 6 6-6',
  olfato: 'M5 17c2.3-2.6 4.7-2.6 7 0s4.7 2.6 7 0M5 12c2.3-2.6 4.7-2.6 7 0s4.7 2.6 7 0M5 7c2.3-2.6 4.7-2.6 7 0s4.7 2.6 7 0',
  cortejo: 'M12 19.5s-6.5-3.9-6.5-8.6A3.6 3.6 0 0 1 12 8.6a3.6 3.6 0 0 1 6.5 2.3c0 4.7-6.5 8.6-6.5 8.6z',
  metro: 'M8.5 20h7l-2.5-15h-2zM12 14l5-7M7 20h10',
  nieve: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5',
  mezcla: 'M6 4v16M12 4v16M18 4v16M4 15h4M10 8h4M16 12h4',
  cancion: 'M4 6h10M4 12h16M4 18h7M17 4v6M20 14v6',
};
export function Icon({ name, size = 18, stroke = 1.6, fill, style }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={ICONS[name]} /></svg>;
}
export function Logo({ size = 26 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><ellipse cx="4.6" cy="12" rx="2.7" ry="5.4" /><ellipse cx="19.4" cy="12" rx="2.7" ry="5.4" /><path d="M7.6 9c1-3 2.9-4.4 4.4-4.4S15.4 6 16.4 9c.8 2.4.5 6-1.5 7.5-1.1.9-2.1 1-2.9 1s-1.8-.1-2.9-1C7.1 15 6.8 11.4 7.6 9z" /><circle cx="12" cy="13.6" r="1.3" fill="#FF6A1A" stroke="none" /></svg>;
}
export function Seg({ items, value, onChange, label, onScreen, role = 'radio' }) {
  return (
    <div className={`seg${onScreen ? ' on-screen' : ''}`} role={role === 'tab' ? 'tablist' : 'radiogroup'} aria-label={label}>
      {items.map(([id, text, icon]) => (
        <button key={id} type="button" role={role} {...(role === 'tab' ? { 'aria-selected': value === id } : { 'aria-checked': value === id })} aria-pressed={value === id} onClick={() => onChange(id)}>
          {icon && <Icon name={icon} size={15} />}{text}
        </button>
      ))}
    </div>
  );
}
// Perilla: arrastra vertical o usa el deslizador accesible debajo.
export function Knob({ id, label, value, max = 200, unit = 'Hz', color = 'var(--acc)', onChange }) {
  const drag = useRef(null);
  const a0 = (135 * Math.PI) / 180, a = a0 + (value / max) * ((270 * Math.PI) / 180), r = 25;
  const p = (ang, rr = r) => [32 + rr * Math.cos(ang), 32 + rr * Math.sin(ang)];
  const [x0, y0] = p(a0), [x1, y1] = p(a), [px, py] = p(a, 12), large = (value / max) * 270 > 180 ? 1 : 0;
  const down = (e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, v: value }; };
  const move = (e) => { if (!drag.current) return; onChange(Math.max(0, Math.min(max, Math.round(drag.current.v + (drag.current.y - e.clientY) * (max / 160))))); };
  return (
    <div className="knob">
      <svg width="64" height="64" viewBox="0 0 64 64" onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)} aria-hidden="true">
        <path d="M14.4 49.6A25 25 0 1 1 49.6 49.6" fill="none" stroke="var(--track)" strokeWidth="4" strokeLinecap="round" />
        {value > 0 && <path d={`M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}`} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />}
        <circle cx="32" cy="32" r="16" fill="var(--knob)" stroke="var(--line)" />
        <line x1="32" y1="32" x2={px} y2={py} stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <label htmlFor={id} className="muted" style={{ fontSize: 11 }}>{label}</label>
      <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{value} {unit}</span>
      <input id={id} type="range" min="0" max={max} value={value} onChange={(e) => onChange(+e.target.value)} style={{ accentColor: color }} />
    </div>
  );
}
export const roleColor = (p, mn9) => (p.clase === 'sensor' ? 'var(--white)' : p.inhibidora ? 'var(--steel)' : 'var(--acc)');
export const roleGlow = (p) => (p.clase === 'sensor' ? 'rgba(236,236,238,.35)' : p.inhibidora ? 'rgba(125,147,178,.55)' : 'rgba(255,106,26,.6)');
export const ROLE_DESC = {
  sensor: 'Sensor: recibe el estímulo directamente.', interneurona: 'Interneurona: procesa la señal dentro del cerebro.',
  descendente: 'Descendente: lleva la orden del cerebro al cuerpo.', motoneurona: 'Motoneurona: mueve un músculo.', ascendente: 'Ascendente: sube información del cuerpo al cerebro.',
};
