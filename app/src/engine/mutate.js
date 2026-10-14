// Fly Punch · Mutar: reparte las neuronas de una pista entre los pads del kit según su papel en el circuito.
// Motoneuronas y descendentes → graves (bombo, bajo, tom); interneuronas excitadoras → medios (caja, palmas, aro);
// sensores e inhibidoras → agudos (hats, percusiones). Así el azar cambia el sonido pero conserva una mezcla con sentido.
import { VOICE_CAT } from './synth.js';

export function neuronCat(p, mn9) {
  if (p.idx === mn9 || p.clase === 'motoneurona' || p.clase === 'descendente') return 'grave';
  if (p.clase === 'sensor') return 'agudo';
  return p.inhibidora ? 'agudo' : 'medio';
}
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (a, R) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Devuelve map[k] = offset de pad (0–11) para la neurona k.
export function mutate(pads, kit, mn9, seed = Date.now()) {
  const R = rng(seed), free = { grave: [], medio: [], agudo: [] };
  kit.forEach((v, off) => free[VOICE_CAT[v] || 'agudo'].push(off));
  Object.values(free).forEach((a) => shuffle(a, R));
  const map = new Array(pads.length).fill(-1), left = [];
  shuffle(pads.map((_, k) => k), R).forEach((k) => { const c = neuronCat(pads[k], mn9); if (free[c].length) map[k] = free[c].pop(); else left.push(k); });
  const rest = shuffle([...free.grave, ...free.medio, ...free.agudo], R);
  left.forEach((k) => (map[k] = rest.pop()));
  return map;
}
export const identity = () => Array.from({ length: 12 }, (_, i) => i);
