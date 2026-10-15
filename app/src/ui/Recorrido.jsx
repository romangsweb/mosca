import { useEffect } from 'react';
import { session } from '../engine/session.js';
import { useS, Icon } from './kit.jsx';

// Recorrido de primera vez: «tu primer beat en 2 minutos». Seis pasos que se marcan solos cuando los haces; «Llévame» te
// lleva a la sección y hace brillar el botón.
export const PASOS = [
  ['play', 'Dale a Tocar', 'La mosca empieza a sentir y cada neurona que dispara toca una nota.', 'estudio'],
  ['plantilla', 'Elige una plantilla', 'Un género que suena en 30 segundos: house, lo-fi, techno, trap…', 'estudio', 'plantillas'],
  ['mosca', 'Dile a la mosca cómo sentirse', 'Elige un ánimo o escríbele: cambias lo que siente y ella cambia lo que toca.', 'estudio'],
  ['captura', 'Guarda lo que te gustó', '¿Sonó algo bueno? Captura (C) guarda los últimos 8 compases, aunque no estuvieras grabando.', 'estudio'],
  ['variacion', 'Haz una variación', 'En Tomas, abre Variaciones: mitad de tiempo, al revés, pregunta y respuesta…', 'tomas'],
  ['exportar', 'Llévalo a tu DAW', 'Exporta MIDI o pistas separadas para terminarla en Ableton, Logic o FL Studio.', 'tomas'],
];
export function brillar(target, page) {
  if (page && !location.hash.startsWith(`#/${page}`)) location.hash = `#/${page}`;
  setTimeout(() => { const el = document.querySelector(`[data-tour="${target}"]`); if (!el) return; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('tour-glow'); setTimeout(() => el.classList.remove('tour-glow'), 4500); }, 380);
}
export function Recorrido() {
  const s = useS(), t = s.tour || {}, done = t.done || {};
  useEffect(() => { if (s.playing) session.tourMark('play'); }, [s.playing]);
  const n = PASOS.filter(([k]) => done[k]).length, cur = PASOS.find(([k]) => !done[k]);
  const cerrar = () => session.set({ tour: { ...t, on: false } }, true), min = (v) => session.set({ tour: { ...t, min: v } }, true);
  if (t.min) return <button type="button" className="recorrido-pill" onClick={() => min(false)} aria-label="Abrir el recorrido">Tu primer beat · {n}/{PASOS.length}{cur ? ` · ${cur[1]}` : ' · ¡listo!'}</button>;
  return (
    <aside className="recorrido" aria-label="Recorrido: tu primer beat">
      <div className="between"><span style={{ fontWeight: 650, fontSize: 13 }}>Tu primer beat · {n}/{PASOS.length}</span><span className="row" style={{ gap: 2 }}><button type="button" className="iconbtn" style={{ border: 0, fontSize: 16, lineHeight: 1 }} aria-label="Minimizar el recorrido" title="Minimizar" onClick={() => min(true)}>–</button><button type="button" className="iconbtn" style={{ border: 0 }} aria-label="Cerrar el recorrido" onClick={cerrar}><Icon name="x" size={13} /></button></span></div>
      <div style={{ display: 'flex', gap: 3 }}>{PASOS.map(([k]) => <span key={k} style={{ flex: 1, height: 3, borderRadius: 2, background: done[k] ? 'var(--acc)' : 'var(--line)' }} />)}</div>
      {cur ? (<>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{cur[1]}</div>
        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>{cur[2]}</div>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn acc" style={{ height: 30 }} onClick={() => { min(true); brillar(cur[4] || cur[0], cur[3]); }}>Llévame</button>
          <button type="button" className="btn" style={{ height: 30 }} onClick={() => session.tourMark(cur[0])}>Saltar paso</button>
        </div>
      </>) : (<>
        <div style={{ fontWeight: 600, fontSize: 14 }}>¡Listo! Ya hiciste tu primer beat con la mosca.</div>
        <div className="muted" style={{ fontSize: 12.5 }}>En Aprende está el mapa completo: Directo, Canción, Armonía, Mezcla y más.</div>
        <div className="row" style={{ gap: 6 }}><a href="#/aprende" className="btn acc" style={{ height: 30 }} onClick={cerrar}>Ver el mapa</a><button type="button" className="btn" style={{ height: 30 }} onClick={cerrar}>Cerrar</button></div>
      </>)}
    </aside>
  );
}
export function InvitaRecorrido() {
  const s = useS();
  const go = (on) => session.set({ tour: { ...(s.tour || {}), on, visto: true, done: s.tour?.done || {} } }, true);
  return (
    <aside className="recorrido" aria-label="Invitación al recorrido">
      <div style={{ fontWeight: 650, fontSize: 14 }}>¿Hacemos tu primer beat en 2 minutos?</div>
      <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>Seis pasos: tocar, una plantilla, decirle a la mosca cómo sentirse, guardar, variar y llevarlo a tu DAW.</div>
      <div className="row" style={{ gap: 6 }}><button type="button" className="btn acc" style={{ height: 30 }} onClick={() => go(true)}>Empezar</button><button type="button" className="btn" style={{ height: 30 }} onClick={() => go(false)}>Ahora no</button></div>
    </aside>
  );
}
