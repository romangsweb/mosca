// Fly Punch · compases. Cada paso es una semicorchea (1/16). Un compás dura `len` pasos (máximo 16, el ancho de la rejilla)
// y `pulsos` dice dónde caen los tiempos: el primero es el fuerte. Los compases de /8 se agrupan (6/8 = 3+3, 7/8 = 2+2+3).
export const COMPASES = {
  '4/4': { name: '4/4', desc: 'El de casi todo: pop, house, hip hop', len: 16, pulsos: [0, 4, 8, 12] },
  '3/4': { name: '3/4 · vals', desc: 'Tres tiempos: vals, folk, baladas', len: 12, pulsos: [0, 4, 8] },
  '2/4': { name: '2/4 · marcha', desc: 'Dos tiempos: marcha, polka, cumbia rápida', len: 8, pulsos: [0, 4] },
  '6/8': { name: '6/8', desc: 'Dos pulsos de tres corcheas: son, blues lento, jigas', len: 12, pulsos: [0, 6], sub: [0, 2, 4, 6, 8, 10] },
  '5/8': { name: '5/8 · 3+2', desc: 'Cojo: se siente que le falta un pedacito', len: 10, pulsos: [0, 6], sub: [0, 2, 4, 6, 8] },
  '7/8': { name: '7/8 · 2+2+3', desc: 'Balcánico, progresivo: tres pulsos, el último largo', len: 14, pulsos: [0, 4, 8], sub: [0, 2, 4, 6, 8, 10, 12] },
};
export const compas = (id) => COMPASES[id] || COMPASES['4/4'];
// clics del metrónomo: en los pulsos (y en las corcheas de los compases de /8, más suaves)
export const clickAt = (c, pos) => (pos === 0 ? 2 : c.pulsos.includes(pos) ? 1 : c.sub?.includes(pos) ? 0.5 : 0);
// posición legible compás.tiempo.paso
export function posLabel(c, n) {
  const bar = Math.floor(n / c.len), pos = n % c.len; let beat = 0;
  c.pulsos.forEach((p, i) => { if (pos >= p) beat = i; });
  return `${String(1 + bar).padStart(3, '0')}.${1 + beat}.${1 + pos - c.pulsos[beat]}`;
}
// acento: el tiempo fuerte suena un poco más, los pulsos algo más, lo demás un poco menos (cantidad 0–1)
export const accent = (c, pos, amt) => (amt ? 1 + amt * (pos === 0 ? 0.25 : c.pulsos.includes(pos) ? 0.1 : -0.12) : 1);
// numerador / denominador para el archivo MIDI
export const midiSig = (id) => { const [a, b] = (COMPASES[id] ? id : '4/4').split('/').map(Number); return [a, Math.log2(b)]; };
