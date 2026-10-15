// Fly Punch · Productor IA (beta Pro): le manda a la función `productor` el análisis ya calculado aquí (nada personal)
// y aplica lo que propone con un clic. La mosca sigue decidiendo las notas; la IA solo sugiere armonía y ajustes.
import { cloud } from './cloud.js';
import { keyName, chordName } from './armonia.js';
import { SCALES, NOTE_NAMES } from './devices.js';

const pista = (S, t) => ({ sentido: t.sense, modo: t.mode || 'ritmo', ...(t.mode === 'melodia' ? { escala: t.scale, raiz: NOTE_NAMES[((t.root % 12) + 12) % 12], progresion: t.prog || 'ninguna', acorde: t.chord || 'nota' } : {}), suena: S.audible(t) });
const ajustesActuales = (S) => ({ bpm: Math.round(S.ko.bpm || S.s.bpm), compas: S.s.compas || '4/4', densidad: S.s.density, swing: S.s.swing, filtro: +(S.s.fx?.filtro ?? 1).toFixed(2) });

export function contextoVivo(S) {
  const H = S.live.harm;
  return { fuente: 'en vivo', tonalidad: keyName(H?.key), seguridad: H?.key ? Math.round(H.key.conf * 100) : 0, ultimos_acordes: (H?.hist || []).map((c) => `${chordName(c)}${c.roman ? ` (${c.roman})` : ''}`), pistas: S.s.tracks.map((t) => pista(S, t)), ajustes: ajustesActuales(S) };
}
export function contextoToma(S, an, take) {
  return { fuente: 'toma grabada', duracion_s: Math.round(take.durMs / 1000), bpm: take.bpm, compas: take.compas || '4/4', tonalidad: keyName(an.key), segunda_opcion: keyName(an.key?.alt), seguridad: Math.round((an.key?.conf || 0) * 100),
    acordes_por_compas: an.bars.slice(0, 24).map((b) => `${chordName(b.chord)}${b.chord?.roman ? ` (${b.chord.roman})` : ''}${b.clashes.length ? ` ·${b.clashes.length} choques` : ''}`), notas: an.n, fuera_de_tono: an.fuera, roces: an.roce, pistas: S.s.tracks.map((t) => pista(S, t)), ajustes: ajustesActuales(S) };
}
const call = async (body) => {
  if (!cloud) throw new Error('sin-nube');
  const { data, error } = await cloud.functions.invoke('productor', { body });
  if (error) { let b = null; try { b = await error.context?.json(); } catch {} throw new Error(b?.error || 'red'); }
  return data;
};
export const cuota = () => call({ consulta: 'cuota' });
export const pedir = (contexto, pedido) => call({ contexto, pedido });
export const ERRORES = { 'sin-nube': 'El Productor necesita tu cuenta en la nube.', 'sin-sesion': 'Inicia sesión para usar el Productor.', pro: 'El Productor es parte de Pro.', 'sin-consultas': 'Ya usaste tus consultas de este mes. Se renuevan el día 1.', 'tope-global': 'La beta llegó a su límite de este mes. Vuelve el día 1.', gemini: 'Gemini no respondió. No se descontó la consulta: intenta de nuevo.', red: 'No pudimos conectar con el Productor.' };

// lo que cambiaría, en palabras, para enseñarlo antes de aplicar
export function cambios(S, r) {
  const a = r.ajustes || {}, out = [];
  if (r.progresion) out.push(`Progresión «${r.progresion.nombre}» en las pistas de Melodía`);
  if (a.escala || a.raiz != null) out.push(`Escala ${a.escala ? SCALES[a.escala]?.[0] : 'igual'}${a.raiz != null ? ` en ${NOTE_NAMES[a.raiz]}` : ''}`);
  if (a.bpm) out.push(`Tempo ${a.bpm} BPM`); if (a.densidad) out.push(`Densidad ${a.densidad} ms`); if (a.swing) out.push(`Swing ${a.swing}%`); if (a.filtro != null) out.push(`Filtro de la compu ${Math.round(a.filtro * 100)}%`);
  return out;
}
export function aplicar(S, r, { solo = null } = {}) {
  const a = r.ajustes || {}, mel = (t) => t.mode === 'melodia';
  S.batch(() => {
    if (r.progresion && (!solo || solo === 'progresion')) S.set({ tracks: S.s.tracks.map((t) => (mel(t) ? { ...t, prog: 'ia', progIa: r.progresion.grados, progIaNombre: r.progresion.nombre } : t)) }, true);
    if (solo === 'progresion') return;
    if (a.escala || a.raiz != null) S.set({ tracks: S.s.tracks.map((t) => { if (!mel(t)) return t; let root = t.root; if (a.raiz != null) { root = t.root - (((t.root % 12) + 12) % 12) + a.raiz; if (root - t.root > 6) root -= 12; } return { ...t, ...(a.escala ? { scale: a.escala } : {}), root }; }) }, true);
    if (a.bpm) S.setBpm(a.bpm); if (a.densidad) S.set({ density: a.densidad }, true); if (a.swing) S.set({ swing: a.swing }, true); if (a.filtro != null) S.setFx({ filtro: a.filtro });
  });
}

// ---------- «Dile a la mosca»: tu frase → lo que siente (la IA cambia sus sentidos, nunca sus notas) ----------
export const ESTIMULO_SENTIDO = { dulce: 'gusto', amargo: 'gusto', jon_ce: 'oido', jon_f: 'oido', jon_dm: 'oido', vinagre: 'olfato', co2: 'olfato', geosmina: 'olfato', canto: 'cortejo', cva: 'cortejo', deseo: 'cortejo', acercar: 'vision', movimiento: 'vision', luz: 'vision' };
export function contextoMosca(S, historial = []) {
  const L = S.live, hz = (x) => Math.round(x || 0);
  return { estimulos_actuales: S.s.inputs, sentidos_que_suenan: [...new Set(S.s.tracks.filter((t) => S.audible(t)).map((t) => t.sense))], densidad: S.s.density, intensidad: S.s.intensidad ?? 1, bpm: Math.round(S.ko.bpm || S.s.bpm), swing: S.s.swing, tocando: !!S.s.playing,
    actividad: { neuronas_activas: L.active || 0, mn9_hz: hz(L.mn9), salidas_hz: Object.fromEntries(Object.entries(L.out || {}).map(([k, v]) => [k, hz(v)])) },
    conversacion_reciente: historial.slice(-3).map((m) => ({ dijeron: m.texto, cambio: m.cambio })) };
}
export const pedirMosca = (contexto, pedido) => call({ modo: 'mosca', contexto, pedido });
// atajos sin IA (gratis, al instante): ánimos conocidos
export const ANIMOS = [
  ['Tranquila', 'Respiro hondo. Poco que oler, poco que probar: toco despacito.', { dulce: 60, amargo: 0, jon_ce: 20, jon_f: 20, jon_dm: 0, vinagre: 20, co2: 0, geosmina: 0, acercar: 0, movimiento: 10 }, { densidad: 2, intensidad: 0.8 }],
  ['Hambrienta', '¡Azúcar! No pienso en otra cosa que comer.', { dulce: 190, amargo: 0, vinagre: 120 }, { densidad: 6 }],
  ['Asqueada', 'Esto sabe amargo y huele a moho. No, gracias.', { dulce: 20, amargo: 180, geosmina: 150, vinagre: 0 }, { densidad: 5 }],
  ['Nerviosa', 'Algo se me viene encima y todo se mueve. ¡Hay que huir!', { acercar: 160, movimiento: 140, co2: 120 }, { densidad: 10, intensidad: 1.3 }],
  ['Enamorada', 'Oigo un canto y huele a feromona… me pongo romántica.', { canto: 170, cva: 70, deseo: 160, jon_ce: 120 }, { densidad: 6 }],
  ['Que se duerma', 'Silencio, oscuridad… me voy apagando.', Object.fromEntries(Object.keys(ESTIMULO_SENTIDO).map((k) => [k, 0])), { densidad: 1, intensidad: 0.5 }],
];
// aplica lo que siente la mosca; devuelve cómo deshacerlo
export function aplicarMosca(S, r) {
  const prev = { inputs: { ...S.s.inputs }, density: S.s.density, intensidad: S.s.intensidad ?? 1, bpm: S.s.bpm, swing: S.s.swing };
  const to = { ...S.s.inputs, ...(r.estimulos || {}) }, bars = r.transicion_compases ?? 2;
  S.batch(() => {
    if (S.s.playing && bars > 0) S.morphState = { from: { ...S.s.inputs }, to, n0: S.live.step, len: bars * S.C.len }; // transición suave, compás a compás
    else S.set({ inputs: to }, true);
    if (r.densidad) S.set({ density: r.densidad }, true); if (r.intensidad != null) S.set({ intensidad: r.intensidad }, true);
    if (r.bpm) S.setBpm(r.bpm); if (r.swing) S.set({ swing: r.swing }, true);
  });
  return () => { S.morphState = null; S.batch(() => { S.set({ inputs: prev.inputs, density: prev.density, intensidad: prev.intensidad, swing: prev.swing }, true); if (r.bpm) S.setBpm(prev.bpm); }); };
}
// lo que cambió, para mostrarlo en la conversación
export function resumenMosca(S, before, r, label) {
  const ch = Object.entries(r.estimulos || {}).filter(([k, v]) => (before[k] ?? 0) !== v).map(([k, v]) => [label[k] || k, before[k] ?? 0, v, ESTIMULO_SENTIDO[k]]);
  const otros = [r.densidad && `densidad ${r.densidad} ms`, r.intensidad != null && `intensidad ×${(+r.intensidad).toFixed(2)}`, r.bpm && `${r.bpm} BPM`, r.swing && `swing ${r.swing}%`].filter(Boolean);
  return { ch, otros };
}

// ---------- variaciones descritas con palabras: la IA elige una cadena de la lista; la app las aplica ----------
export const pedirVariacion = (contexto, pedido) => call({ modo: 'variacion', contexto, pedido });
export function contextoVariacion(take, an) {
  const C = take.compas || '4/4', stepMs = 60000 / (take.bpm || 110) / 4, bars = Math.max(1, Math.round(take.durMs / (stepMs * 16)));
  const porPista = Object.fromEntries(take.tracks.map((t) => [t.name, take.events.filter((e) => e.track === t.id).length]));
  return { bpm: take.bpm, compas: C, compases: bars, notas_por_compas: Math.round(take.events.length / bars), notas_por_pista: porPista, tonalidad: an?.empty ? 'sin melodía' : keyName(an?.key) };
}

// ---------- generador de beat: tu frase → un patrón por voces ----------
const VEL = { X: 122, x: 98, o: 58, '-': 0 };
export const pedirBeat = (S, pedido) => call({ modo: 'beat', contexto: { pasos: Math.min(16, S.C.len), compas: S.s.compas || '4/4', bpm_actual: Math.round(S.ko.bpm || S.s.bpm), kit_actual: S.s.kitActive || S.s.kitId }, pedido });
export const beatAPatron = (S, r) => ({ nombre: r.nombre, filas: r.filas.map((f) => ({ voz: f.voz, vels: [...f.pasos].map((c) => VEL[c] ?? 0) })), len: Math.min(16, S.C.len), compas: S.s.compas || '4/4', ...(r.bpm ? { bpm: r.bpm } : {}), ...(r.swing ? { swing: r.swing } : {}), ...(r.kit ? { kit: r.kit } : {}), ia: true, explicacion: r.explicacion });

// ---------- mezclar por mí con referencia (IA): parte de las medidas reales ----------
export function pedirMezcla(S, med, referencia) {
  const pistas = Object.fromEntries(Object.entries(med).filter(([id]) => S.track(id)).map(([id, m]) => { const t = S.track(id); return [id, { nombre: t.name, modo: t.mode || 'ritmo', nivel: t.level, canal: t.strip || {}, rev: t.rev || 0, dly: t.dly || 0, ...m }]; }));
  return call({ modo: 'mezcla', contexto: { pistas, bpm: Math.round(S.ko.bpm || S.s.bpm) }, pedido: referencia });
}
export const mezclaACambios = (S, r) => Object.fromEntries(r.pistas.map((p) => [p.id, { ...(p.nivel != null ? { level: p.nivel } : {}), ...(p.rev != null ? { rev: p.rev } : {}), ...(p.dly != null ? { dly: p.dly } : {}), strip: { ...(S.track(p.id)?.strip || {}), ...Object.fromEntries(['lo', 'mid', 'hi', 'filtro', 'drive'].filter((k) => p[k] != null).map((k) => [k, p[k]])) } }]));

// ---------- diseñador de sonidos: tu descripción → parámetros del sintetizador de la app ----------
export const pedirSonido = (pedido) => call({ modo: 'sonido', contexto: {}, pedido });
