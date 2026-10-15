import { session } from '../engine/session.js';
import { PASOS } from '../ui/Recorrido.jsx';
import { useS, Icon } from '../ui/kit.jsx';

// Aprende: el mapa de Fly Punch. El flujo de una idea, de lo que siente la mosca a tu DAW, con cada herramienta en su etapa.
const go = (h) => () => { location.hash = h; };
const abre = (k) => () => session.set({ [k]: true });
const ETAPAS = [
  ['Sentir', 'Lo que le llega a la mosca. Es lo único que controlas de ella.', [
    ['Estímulos', 'Dulce, amargo, sonidos, olores: las perillas del Estudio', go('#/estudio')], ['Dile a la mosca', 'Escribe cómo quieres que se sienta (tecla /)', abre('dile')],
    ['Oído', 'Tu micrófono o una canción como estímulo', go('#/oido')], ['Visión', 'Tu cámara como ojo de la mosca', go('#/vision')],
    ['Mundo', 'Clima, sismos, Wikipedia y bitcoin en vivo', go('#/mundo')], ['Datos', 'Tus CSV estimulan los sentidos', go('#/datos')]]],
  ['Pensar', 'El cerebro real (FlyWire) reacciona: cada neurona que dispara es una nota.', [
    ['Mapa y 3D', 'Mira qué neuronas disparan y por qué', go('#/estudio')], ['La mosca aprende', 'Me gusta (G) / No me gusta (N) refuerza conexiones', go('#/estudio')],
    ['Conversación con el K.O.', 'Tus pads del K.O. le hablan a la mosca', go('#/ko')]]],
  ['Tocar', 'Cómo se oye lo que piensa: pistas, sonidos y aparatos.', [
    ['Plantillas', 'Un género que suena en 30 segundos', abre('plantillas')], ['Patrones', 'Beats con tus palabras y Mis patrones (Estudio)', go('#/estudio')],
    ['Melodía, arpegio y armonía', 'Escalas, acordes, progresiones y la rueda', go('#/cancion')], ['Kits y Mi kit', 'Sonidos, cortar un loop, diseñar un sonido', go('#/sonido')],
    ['Equipo', 'K.O. II, sidekick y cualquier aparato MIDI', go('#/equipo')]]],
  ['Dar forma', 'Mezcla, arreglo y directo.', [
    ['Mezcla', 'Canal por pista, espectro, mezclar por mí', go('#/mezcla')], ['Canción', 'Escenas en orden, con transiciones', go('#/cancion')],
    ['Directo', 'Escenas a tiempo, looper, remates, modo escenario', go('#/directo')]]],
  ['Guardar', 'Que no se pierda la idea.', [
    ['Grabar (R)', 'Graba una toma desde ahora', () => session.toggleRec()], ['Capturar (C)', 'Guarda los últimos 8 compases, aunque no grabaras', go('#/estudio')],
    ['Tomas', 'Todas tus tomas, en este navegador y en la nube', go('#/tomas')]]],
  ['Transformar y llevar', 'De idea a canción: en Fly Punch o en tu DAW.', [
    ['Variaciones y armonía', 'Toma nueva a partir de otra; acordes y choques', go('#/tomas')], ['Hacer pad', 'Un pedazo de la toma se vuelve un sonido', go('#/tomas')],
    ['Exportar', 'MIDI, WAV, pistas separadas o video para redes', go('#/tomas')]]],
];

export default function Aprende() {
  const s = useS(), done = s.tour?.done || {}, n = PASOS.filter(([k]) => done[k]).length;
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Aprende</h1><p>Fly Punch en un mapa: una idea nace de lo que siente la mosca, pasa por su cerebro, suena en tus pistas y termina en tu DAW. Cada herramienta vive en una etapa.</p></div>
        <div className="row">
          <button type="button" className="btn lg acc" onClick={() => session.set({ tour: { ...(s.tour || {}), on: true, visto: true, done: n === PASOS.length ? {} : done } }, true)}>{n && n < PASOS.length ? `Seguir el recorrido (${n}/${PASOS.length})` : 'Hacer el recorrido de 2 minutos'}</button>
        </div>
      </div>
      <div className="flujo">
        {ETAPAS.map(([t, d, tools], i) => (
          <section key={t} className="etapa" aria-label={`Etapa ${i + 1}: ${t}`}>
            <span className="num">{i + 1} · {i < ETAPAS.length - 1 ? 'luego →' : 'fin'}</span>
            <h2 style={{ margin: 0, fontSize: 16 }}>{t}</h2>
            <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>{d}</p>
            {tools.map(([l, sub, fn]) => <a key={l} className="tool" href="#/aprende" onClick={(e) => { e.preventDefault(); fn(); }}>{l}<span>{sub}</span></a>)}
          </section>
        ))}
      </div>
      <div className="cols">
        <section className="panel" style={{ flex: '1 1 320px', gap: 8 }}>
          <h2>Tres ideas para entenderlo</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}><strong style={{ color: 'var(--text)' }}>La mosca decide las notas; tú decides qué siente.</strong> No hay un botón para «tocar más bonito»: cambias sus sentidos y ella responde. Las herramientas de IA siguen esa regla: cambian lo que siente, transforman o proponen, nunca escriben sus notas.</p>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}><strong style={{ color: 'var(--text)' }}>Es un instrumento, no un DAW.</strong> Fly Punch genera ideas que no se te ocurrirían; tu DAW las termina. Por eso todo se exporta: MIDI, pistas separadas, WAV.</p>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}><strong style={{ color: 'var(--text)' }}>Nada se pierde.</strong> Capturar (C) guarda lo que sonó hace un momento; ⌘Z deshace casi todo; las tomas originales nunca cambian.</p>
        </section>
        <section className="panel" style={{ flex: '1 1 260px', gap: 8 }}>
          <h2>Más ayuda</h2>
          <button type="button" className="btn" onClick={() => session.set({ atajos: true })}><Icon name="docs" size={14} />Atajos de teclado (?)</button>
          <a href="#/cuenta?ayuda" className="btn">Documentación completa</a>
          <button type="button" className="btn" onClick={() => session.set({ guide: true }, true)}>Mostrar los consejos de cada sección</button>
        </section>
      </div>
    </div>
  );
}
