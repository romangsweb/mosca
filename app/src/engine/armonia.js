// Fly Punch · armonía sin IA generativa: teoría musical en código, local e instantánea.
//  1. Tonalidad: perfiles de Krumhansl-Kessler (cuánto «pesa» cada grado en una tonalidad mayor o menor) contra el
//     histograma de las notas que tocó la mosca (cada nota pesa por su velocidad).
//  2. Acorde de cada compás: la tríada (de la tonalidad, o prestada con castigo) que más notas del compás explica.
//  3. Choques: notas fuera de la tonalidad, o notas fuertes en un tiempo fuerte que no son del acorde.
//  4. Pista de armonía: el acorde de cada compás con buena conducción de voces (cada voz se mueve lo menos posible) y un bajo.
import { NOTE_NAMES } from './devices.js';
import { compas } from './compas.js';

const KK_MAY = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MEN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
export const ESCALA_MAY = [0, 2, 4, 5, 7, 9, 11], ESCALA_MEN = [0, 2, 3, 5, 7, 8, 10];
const Q = { may: [0, 4, 7], men: [0, 3, 7], dis: [0, 3, 6] };
// tríadas de cada grado: [semitonos desde la tónica, calidad, cifra romana]
const GRADOS = {
  mayor: [[0, 'may', 'I'], [2, 'men', 'ii'], [4, 'men', 'iii'], [5, 'may', 'IV'], [7, 'may', 'V'], [9, 'men', 'vi'], [11, 'dis', 'vii°']],
  menor: [[0, 'men', 'i'], [2, 'dis', 'ii°'], [3, 'may', 'III'], [5, 'men', 'iv'], [7, 'men', 'v'], [7, 'may', 'V'], [8, 'may', 'VI'], [10, 'may', 'VII']],
};
const pc = (n) => ((n % 12) + 12) % 12;
const corr = (a, b) => { const ma = a.reduce((x, y) => x + y) / 12, mb = b.reduce((x, y) => x + y) / 12; let n = 0, da = 0, db = 0; for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return da && db ? n / Math.sqrt(da * db) : 0; };
const rot = (p, k) => p.map((_, i) => p[pc(i - k)]);

export const keyName = (k) => (k ? `${NOTE_NAMES[k.tonic]} ${k.modo}` : '—');
export const chordName = (c) => (c ? `${NOTE_NAMES[c.root]}${c.q === 'men' ? 'm' : c.q === 'dis' ? '°' : ''}` : '—');
export const scaleOf = (k) => (k ? (k.modo === 'mayor' ? ESCALA_MAY : ESCALA_MEN).map((x) => pc(x + k.tonic)) : []);

export function histogram(notes) { const h = new Array(12).fill(0); for (const { note, w = 1 } of notes) h[pc(note)] += w; return h; }

// la tonalidad que mejor explica el histograma · confianza: qué tanto le gana a la segunda opción (0…1)
// prior: tonalidades que declaran tus pistas (tónica y modo de su escala): ayudan a desempatar entre relativas (Do menor ↔ Mi♭ mayor)
export function detectKey(h, prior = []) {
  if (h.reduce((a, b) => a + b, 0) <= 0) return null;
  const all = [], bonus = (k, m) => (prior.some((p) => p.tonic === k && p.modo === m) ? 0.2 : 0);
  for (let k = 0; k < 12; k++) { all.push({ tonic: k, modo: 'mayor', r: corr(h, rot(KK_MAY, k)) + bonus(k, 'mayor') }, { tonic: k, modo: 'menor', r: corr(h, rot(KK_MEN, k)) + bonus(k, 'menor') }); }
  all.sort((a, b) => b.r - a.r);
  const [a, b] = all; return { tonic: a.tonic, modo: a.modo, r: a.r, conf: Math.max(0, Math.min(1, (a.r - b.r) * 4 + (a.r - 0.5))), alt: { tonic: b.tonic, modo: b.modo } };
}

// el acorde que mejor explica las notas de un compás dentro de la tonalidad · bass: clase de la nota más grave (bonus a la fundamental)
export function chordFor(h, key, bass = null) {
  const tot = h.reduce((a, b) => a + b, 0); if (!tot || !key) return null;
  const cands = [];
  for (const [deg, q, roman] of GRADOS[key.modo]) cands.push({ root: pc(key.tonic + deg), q, roman, dia: true });
  for (let r = 0; r < 12; r++) for (const q of ['may', 'men']) if (!cands.some((c) => c.root === r && c.q === q)) cands.push({ root: r, q, roman: null, dia: false }); // prestados
  let best = null;
  for (const c of cands) {
    const tones = Q[c.q].map((x) => pc(c.root + x)); let sc = 0;
    for (let i = 0; i < 12; i++) sc += tones.includes(i) ? h[i] * (i === c.root ? 1.25 : 1) : -0.45 * h[i];
    if (bass === c.root) sc += 0.3 * tot; if (!c.dia) sc -= 0.35 * tot; if (c.q === 'dis') sc -= 0.1 * tot;
    if (!best || sc > best.sc) best = { ...c, sc, tones };
  }
  return best;
}

// voces del acorde lo más cerca posible de las anteriores (rango cómodo para un pad: 52–74)
export function voicing(chord, prev = null, lo = 52, hi = 74) {
  const tones = Q[chord.q].map((x) => pc(chord.root + x)), opts = [];
  for (let base = lo; base <= hi; base++) { if (pc(base) !== tones[0] && pc(base) !== tones[1] && pc(base) !== tones[2]) continue;
    const v = [base]; for (let i = 1; i < 3; i++) { let n = v[i - 1] + 1; while (!tones.includes(pc(n)) || v.some((x) => pc(x) === pc(n))) n++; v.push(n); }
    if (v[2] <= hi + 2) opts.push(v); }
  if (!prev) return opts.sort((a, b) => Math.abs(a[0] - 60) - Math.abs(b[0] - 60))[0];
  return opts.sort((a, b) => a.reduce((s, n, i) => s + Math.abs(n - prev[i]), 0) - b.reduce((s, n, i) => s + Math.abs(n - prev[i]), 0))[0];
}
// la tonalidad que dice la escala de una pista: escalas con tercera menor → menor
export const MINOR_SCALES = /^(menor|menor_pent|dorica|frigia|armonica|melodica|blues|hirajoshi)$/;
export const declaredKey = (t) => ({ tonic: ((t.root % 12) + 12) % 12, modo: MINOR_SCALES.test(t.scale || '') ? 'menor' : 'mayor' });
export const bassNote = (chord, lo = 36) => lo + pc(chord.root - lo);

// ---------- tomas ----------
const melodic = (e) => e.voice === 'tono' && e.track !== 'armonia';
export function analyzeTake(take) {
  const C = compas(take.compas || '4/4'), stepMs = 60000 / (take.bpm || 110) / 4, barMs = C.len * stepMs, ev = take.events.filter(melodic);
  if (!ev.length) return { empty: true };
  const key = detectKey(histogram(ev.map((e) => ({ note: e.note, w: e.vel / 127 }))));
  const nBars = Math.max(1, Math.ceil(take.durMs / barMs)), bars = [], scale = scaleOf(key);
  let fuera = 0, roce = 0;
  for (let b = 0; b < nBars; b++) {
    const inBar = ev.filter((e) => e.t >= b * barMs && e.t < (b + 1) * barMs);
    const low = inBar.length ? inBar.reduce((m, e) => (e.note < m.note ? e : m)) : null;
    const ch = chordFor(histogram(inBar.map((e) => ({ note: e.note, w: e.vel / 127 }))), key, low ? pc(low.note) : null) || bars[b - 1]?.chord || null;
    const clashes = [];
    for (const e of inBar) {
      const p = pc(e.note), step = Math.round((e.t - b * barMs) / stepMs), strong = step % 4 === 0;
      if (!scale.includes(p)) { clashes.push({ e, tipo: 'fuera' }); fuera++; }
      else if (ch && strong && e.vel >= 90 && !ch.tones.includes(p)) { clashes.push({ e, tipo: 'roce' }); roce++; }
    }
    bars.push({ i: b, chord: ch, n: inBar.length, clashes });
  }
  return { key, bars, barMs, stepMs, fuera, roce, n: ev.length };
}

// la pista de armonía de una toma: acordes con conducción de voces y/o bajo
export function harmonyEvents(an, { modo = 'ambos', vel = 72, ch = 3 } = {}) {
  const out = []; let prev = null;
  for (const b of an.bars) {
    if (!b.chord) continue; const t = b.i * an.barMs;
    if (modo !== 'bajo') { const v = voicing(b.chord, prev); prev = v; v.forEach((note, j) => out.push({ t: t + j * 4, track: 'armonia', pad: 0, neuron: 'armonía', note, vel: vel - j * 4, ch, voice: 'pad', durMs: an.barMs * 0.96 })); }
    if (modo !== 'acordes') { const bn = bassNote(b.chord), half = an.barMs / 2; [0, half].forEach((o) => out.push({ t: t + o, track: 'armonia', pad: 1, neuron: 'armonía', note: bn, vel: vel + 12, ch, voice: 'tono', durMs: half * 0.9 })); }
  }
  return out;
}

// ajustar los choques: cada nota que choca se mueve a la nota del acorde más cercana (empate: hacia abajo). No toca las demás.
export function fixClashes(take, an) {
  const fix = new Map(); for (const b of an.bars) for (const c of b.clashes) if (b.chord) fix.set(c.e, b.chord);
  let moved = 0;
  const events = take.events.map((e) => {
    const ch = fix.get(e); if (!ch) return e;
    let best = e.note; for (let d = 1; d <= 6; d++) { if (ch.tones.includes(pc(e.note - d))) { best = e.note - d; break; } if (ch.tones.includes(pc(e.note + d))) { best = e.note + d; break; } }
    if (best !== e.note) moved++; return best === e.note ? e : { ...e, note: best, fixedFrom: e.note };
  });
  return { events, moved };
}
