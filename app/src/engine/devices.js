// Fly Punch · perfiles de dispositivo. Cada perfil dice cómo se convierte un disparo en una nota MIDI.
// kind: 'grupos' (pads en grupos de 12, como el K.O. II) · 'voces' (una nota por tipo de sonido) ·
//       'canales' (un canal por tipo de sonido) · 'melodico' (escala) · 'interno' (sin MIDI)
// Las notas por voz se pueden editar en el perfil Personalizado.
import { GROUP_BASE } from './midi.js';

export const VOICE_LIST = ['bombo', 'caja', 'palmas', 'hat', 'hat abierto', 'aro', 'tom', 'perc', 'bajo', 'zap'];

export const PROFILES = [
  { id: 'ko2', name: 'EP-133 K.O. II', maker: 'Teenage Engineering', art: 'bolsillo', kind: 'grupos', ch: 1, match: /EP-?133|K\.?O|teenage/i, fx: { x: 12, y: 13 }, clock: true, tags: ['Ritmo', 'Reloj', 'Efectos'],
    setup: ['Conéctalo por USB-C directo a la computadora, sin dock.', 'En el K.O. II: SHIFT + ERASE, código 110 y ENTER (recibir en todos los canales).', 'Cada pista toca un grupo: Gusto en C, Oído en A.'] },
  { id: 'tr8s', name: 'TR-8S', maker: 'Roland', art: 'ritmos', kind: 'voces', ch: 10, match: /TR-?8S/i, clock: true, tags: ['Ritmo', 'Reloj'],
    notes: { bombo: 36, caja: 38, palmas: 39, hat: 42, 'hat abierto': 46, aro: 37, tom: 47, perc: 50, bajo: 43, zap: 49 },
    setup: ['Conéctalo por USB.', 'Revisa que el canal MIDI de la TR-8S sea el mismo que aquí (10 por defecto).', 'Cada sonido de la mosca va a su instrumento: bombo BD, caja SD, palmas HC, hats CH/OH, toms LT/MT/HT.'] },
  { id: 'gm', name: 'Batería General MIDI', maker: 'Logic, GarageBand y la mayoría de cajas de ritmos', art: 'ritmos', kind: 'voces', ch: 10, match: null, clock: true, tags: ['Ritmo', 'Software', 'Hardware'],
    notes: { bombo: 36, caja: 38, palmas: 39, hat: 42, 'hat abierto': 46, aro: 37, tom: 45, perc: 56, bajo: 35, zap: 49 },
    setup: ['Funciona con cualquier batería que siga el estándar General MIDI.', 'En Mac, para mandar a Logic o GarageBand: abre «Configuración de Audio MIDI», activa el «Bus IAC» y elígelo aquí como puerto.', 'Canal 10 por defecto; cámbialo si tu batería escucha otro.'] },
  { id: 'drumrack', name: 'Ableton Live · Drum Rack', maker: 'Ableton', art: 'software', kind: 'grupos', base: 36, ch: 1, match: /IAC|loopMIDI|Ableton/i, clock: true, tags: ['Ritmo', 'Software', 'Reloj'],
    setup: ['Mac: activa el Bus IAC en «Configuración de Audio MIDI». Windows: instala loopMIDI y crea un puerto.', 'En Live: pista MIDI con un Drum Rack, entrada = ese puerto, monitor en «In».', 'Los 12 pads de la pista tocan las celdas C1 a B1 del Drum Rack.'] },
  { id: 'elektron', name: 'Digitakt · Digitakt II', maker: 'Elektron', art: 'groovebox', kind: 'canales', note: 60, match: /Digitakt|Elektron/i, clock: true, tags: ['Ritmo', 'Reloj'],
    chans: { bombo: 1, caja: 2, palmas: 3, aro: 4, hat: 5, 'hat abierto': 6, tom: 7, bajo: 7, perc: 8, zap: 8 },
    setup: ['Conéctalo por USB (Overbridge no es necesario).', 'En el Digitakt: SETTINGS › MIDI CONFIG › CHANNELS; deja las pistas 1–8 en los canales 1–8.', 'Cada sonido de la mosca dispara una pista: 1 bombo, 2 caja, 3 palmas, 4 aro, 5–6 hats, 7 tom/bajo, 8 perc.'] },
  { id: 'synth', name: 'Sintetizador', maker: 'Cualquier sinte o DAW con instrumento', art: 'teclado', kind: 'melodico', ch: 1, match: null, clock: false, pro: true, tags: ['Melódico'],
    setup: ['Elige el puerto de tu sintetizador (o el Bus IAC para un instrumento en tu DAW).', 'Las neuronas tocan notas de la escala que elijas en Sonido: las motoneuronas hacen el bajo y los sensores la melodía.', 'Canal 1 por defecto.'] },
  { id: 'custom', name: 'Personalizado', maker: 'Define tu propio mapa de notas', art: 'personal', kind: 'voces', ch: 1, match: null, clock: true, tags: ['Ritmo', 'Editable'],
    notes: { bombo: 36, caja: 38, palmas: 39, hat: 42, 'hat abierto': 46, aro: 37, tom: 45, perc: 56, bajo: 35, zap: 49 },
    setup: ['Elige el puerto y el canal.', 'Edita abajo qué nota recibe cada sonido.', 'Útil para cualquier caja de ritmos o sampler que no esté en la galería.'] },
  { id: 'interno', name: 'Sin aparato', maker: 'Sonido interno de Fly Punch', art: 'interno', kind: 'interno', ch: 1, match: null, clock: false, tags: ['Sin cables'],
    setup: ['Fly Punch toca con sus propios sonidos.', 'Ideal para probar, grabar y exportar a WAV sin hardware.'] },
];
export const profileById = (id) => PROFILES.find((p) => p.id === id) || PROFILES[0];

// Escalas para el modo melódico (semitonos desde la tónica)
export const SCALES = {
  menor_pent: ['Pentatónica menor', [0, 3, 5, 7, 10]], mayor_pent: ['Pentatónica mayor', [0, 2, 4, 7, 9]],
  dorica: ['Dórica', [0, 2, 3, 5, 7, 9, 10]], menor: ['Menor natural', [0, 2, 3, 5, 7, 8, 10]], mayor: ['Mayor', [0, 2, 4, 5, 7, 9, 11]],
  frigia: ['Frigia', [0, 1, 3, 5, 7, 8, 10]],
};
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// grado de la escala por neurona: motoneuronas y descendentes abajo (bajo), interneuronas en medio, sensores arriba
const RANK = { motoneurona: 0, descendente: 1, ascendente: 2, interneurona: 3, sensor: 5 };
export function melodicNote(pads, k, track) {
  const order = pads.map((p, i) => [RANK[p.clase] ?? 3, p.inhibidora ? 1 : 0, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]).map((x) => x[2]);
  const pos = order.indexOf(k), sc = SCALES[track.scale || 'menor_pent'][1];
  return (track.root ?? 48) + 12 * Math.floor(pos / sc.length) + sc[pos % sc.length];
}

// ¿Qué nota y canal toca la neurona k de una pista con este perfil? (null = no manda MIDI)
export function route(profile, track, k, pads, overrides = {}) {
  const off = track.map[k], voice = track.kit[off];
  if (track.mode === 'melodia' || profile.kind === 'melodico') return { note: melodicNote(pads, k, track), ch: overrides.ch ?? profile.ch, voice: 'tono' };
  switch (profile.kind) {
    case 'grupos': return { note: (profile.base ?? GROUP_BASE[track.group]) + off, ch: overrides.ch ?? (profile.id === 'ko2' ? track.ch : profile.ch), voice };
    case 'voces': return { note: (overrides.notes || profile.notes)[voice] ?? 36, ch: overrides.ch ?? profile.ch, voice };
    case 'canales': return { note: profile.note, ch: (overrides.chans || profile.chans)[voice] ?? 1, voice };
    default: return { note: null, ch: 1, voice };
  }
}
