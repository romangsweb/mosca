// Fly Punch · librería de kits. Cada sonido se sintetiza aquí mismo (DSP en JavaScript), así que todos
// son originales y sin licencias de terceros. Se generan una vez por kit y se tocan como muestras.
export const SR = 44100;
export const KITS = [
  { id: 'analogo', name: 'Análogo', desc: 'Bombo redondo, caja con cuerpo, hats metálicos. El clásico de caja de ritmos.', pro: false },
  { id: 'lofi', name: 'Lo-fi', desc: 'Polvo, cinta y 8 bits. Golpes cálidos y apagados, con ruido de fondo.', pro: true },
  { id: 'metal', name: 'Metal', desc: 'FM y modulación en anillo: campanas, golpes industriales y graves con filo.', pro: true },
  { id: 'organico', name: 'Orgánico', desc: 'Cuerdas punteadas, madera, sacudidores y tambores de mano.', pro: true },
  { id: 'insectos', name: 'Insectos', desc: 'Grillos, cigarras, zumbidos y alas: la mosca tocando con los sonidos de su mundo.', pro: false, nuevo: true },
  { id: 'boom', name: 'Boom', desc: 'Bombos largos con sub, bajo que se arrastra, palmas anchas. Para trap y hip hop.', pro: true, nuevo: true },
  { id: 'minimal', name: 'Minimal', desc: 'Clics, golpes secos y cortos, mucho aire. Para techno y micro house.', pro: true, nuevo: true },
  { id: 'chip', name: 'Chip', desc: 'Ondas cuadradas y ruido de 4 bits, como una consola de los 80.', pro: true, nuevo: true },
];
export const VOICES = ['bombo', 'caja', 'palmas', 'hat', 'hat abierto', 'aro', 'tom', 'perc', 'bajo', 'zap'];

// ---------- utilidades DSP ----------
const TAU = Math.PI * 2;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1; }; }
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
const env = (i, dec, att = 0.001) => { const t = i / SR; return t < att ? t / att : Math.exp(-(t - att) / dec); };
function biquad(x, type, f, q = 0.707) { // RBJ
  const w = TAU * f / SR, c = Math.cos(w), s = Math.sin(w) / (2 * q); let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = s; b1 = 0; b2 = -s; }
  const a0 = 1 + s, a1 = -2 * c, a2 = 1 - s, y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
const noise = (sec, seed = 1) => { const r = rng(seed), b = buf(sec); for (let i = 0; i < b.length; i++) b[i] = r(); return b; };
const mix = (...parts) => { const n = Math.max(...parts.map(([b]) => b.length)), o = new Float32Array(n); for (const [b, g] of parts) for (let i = 0; i < b.length; i++) o[i] += b[i] * g; return o; };
const shape = (b, fn) => { for (let i = 0; i < b.length; i++) b[i] *= fn(i); return b; };
const drive = (b, k) => { const n = Math.tanh(k); for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * k) / n; return b; };
function sweep(sec, f0, f1, tc, wave = 'sin') { // seno con barrido exponencial de f0 a f1
  const b = buf(sec); let ph = 0;
  for (let i = 0; i < b.length; i++) { const f = f1 + (f0 - f1) * Math.exp(-i / SR / tc); ph += TAU * f / SR; b[i] = wave === 'sq' ? Math.sign(Math.sin(ph)) : wave === 'tri' ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : Math.sin(ph); }
  return b;
}
const tones = (sec, freqs, wave = 'sq') => { const b = buf(sec); for (let i = 0; i < b.length; i++) { let s = 0; for (const f of freqs) { const p = (i * f / SR) % 1; s += wave === 'sq' ? (p < 0.5 ? 1 : -1) : Math.sin(TAU * p); } b[i] = s / freqs.length; } return b; };
function fm(sec, fc, ratio, index, idec, adec) { const b = buf(sec); for (let i = 0; i < b.length; i++) { const t = i / SR, m = index * Math.exp(-t / idec) * Math.sin(TAU * fc * ratio * t); b[i] = Math.sin(TAU * fc * t + m) * Math.exp(-t / adec); } return b; }
function pluck(sec, f, damp = 0.996, bright = 0.5, seed = 3) { // Karplus-Strong
  const r = rng(seed), n = Math.round(SR / f), line = new Float32Array(n).map(() => r()), b = buf(sec); let idx = 0;
  for (let i = 0; i < b.length; i++) { const a = line[idx], nb = line[(idx + 1) % n]; b[i] = a; line[idx] = damp * (bright * a + (1 - bright) * nb); idx = (idx + 1) % n; }
  return b;
}
function crush(b, bits, hold) { const q = 2 ** (bits - 1); let last = 0; for (let i = 0; i < b.length; i++) { if (i % hold === 0) last = Math.round(b[i] * q) / q; b[i] = last; } return b; }
function normalize(b, peak = 0.9) { let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < b.length; i++) b[i] *= peak / m; return trim(b); }
function trim(b) { let end = b.length; while (end > 1000 && Math.abs(b[end - 1]) < 1e-4) end--; const o = b.slice(0, end); const fade = Math.min(400, o.length); for (let i = 0; i < fade; i++) o[o.length - 1 - i] *= i / fade; return o; }
const HAT = [205.3, 304.4, 369.6, 522.7, 540, 800];

// ---------- recetas ----------
const R = {
  analogo: {
    bombo: () => drive(mix([shape(sweep(0.7, 165, 47, 0.045), (i) => env(i, 0.42)), 1], [shape(biquad(noise(0.01, 2), 'hp', 2500), (i) => env(i, 0.002)), 0.4]), 1.6),
    caja: () => mix([shape(tones(0.3, [185, 330], 'sin'), (i) => env(i, 0.07)), 0.7], [shape(biquad(biquad(noise(0.4, 4), 'hp', 1100), 'lp', 9000), (i) => env(i, 0.16)), 0.8]),
    palmas: () => { const n = biquad(noise(0.45, 5), 'bp', 1250, 1.1); return shape(n, (i) => { const t = i / SR; return t < 0.03 ? Math.exp(-((t % 0.01) / 0.0025)) : Math.exp(-(t - 0.03) / 0.12); }); },
    hat: () => shape(biquad(tones(0.2, HAT), 'hp', 7200), (i) => env(i, 0.035)),
    'hat abierto': () => shape(biquad(tones(0.8, HAT), 'hp', 6800), (i) => env(i, 0.28)),
    aro: () => shape(biquad(tones(0.1, [1700, 490], 'sin'), 'bp', 1600, 2), (i) => env(i, 0.018)),
    tom: () => shape(sweep(0.6, 240, 140, 0.08), (i) => env(i, 0.25)),
    perc: () => shape(biquad(tones(0.5, [540, 800]), 'bp', 2600, 1.2), (i) => env(i, 0.13)),
    bajo: () => drive(shape(sweep(1.4, 72, 52, 0.05), (i) => env(i, 0.75)), 2),
    zap: () => shape(sweep(0.2, 3200, 70, 0.018), (i) => env(i, 0.07)),
  },
  lofi: {},
  metal: {
    bombo: () => drive(mix([shape(sweep(0.6, 140, 45, 0.04), (i) => env(i, 0.3)), 1], [fm(0.2, 90, 1.41, 6, 0.02, 0.06), 0.35]), 2.4),
    caja: () => { const n = noise(0.4, 9), o = n.map((v, i) => v * Math.sin(TAU * 910 * i / SR)); return mix([shape(biquad(o, 'hp', 700), (i) => env(i, 0.14)), 0.9], [fm(0.2, 220, 2.3, 4, 0.03, 0.06), 0.5]); },
    palmas: () => shape(biquad(fm(0.4, 1100, 1.73, 9, 0.01, 0.2), 'hp', 900), (i) => (i / SR < 0.025 ? Math.exp(-((i / SR % 0.008) / 0.002)) : 1)),
    hat: () => biquad(fm(0.15, 3200, 1.47, 12, 0.02, 0.03), 'hp', 6000),
    'hat abierto': () => biquad(fm(0.7, 3000, 1.47, 10, 0.1, 0.25), 'hp', 5500),
    aro: () => fm(0.15, 1250, 3.01, 5, 0.01, 0.03),
    tom: () => fm(0.6, 160, 1.5, 3, 0.05, 0.22),
    perc: () => fm(1.2, 660, 3.5, 7, 0.15, 0.4),
    bajo: () => drive(fm(1.0, 55, 1.0, 4, 0.12, 0.5), 2.2),
    zap: () => shape(fm(0.3, 400, 2.76, 20, 0.04, 0.1), (i) => env(i, 0.09)),
  },
  organico: {
    bombo: () => mix([shape(sweep(0.6, 110, 58, 0.03), (i) => env(i, 0.22, 0.004)), 1], [shape(biquad(noise(0.3, 12), 'bp', 95, 3), (i) => env(i, 0.12)), 0.7]),
    caja: () => shape(biquad(biquad(noise(0.6, 13), 'bp', 3200, 0.6), 'lp', 7000), (i) => env(i, 0.18, 0.006)),
    palmas: () => shape(biquad(noise(0.12, 14), 'bp', 2600, 3), (i) => env(i, 0.02)),
    hat: () => { const r = rng(15); let g = 0; return shape(biquad(noise(0.18, 16), 'bp', 6500, 1.5), (i) => { if (i % 220 === 0) g = 0.5 + 0.5 * Math.abs(r()); return g * env(i, 0.05, 0.01); }); },
    'hat abierto': () => { const r = rng(17); let g = 0; return shape(biquad(noise(0.5, 18), 'bp', 5800, 1.2), (i) => { if (i % 300 === 0) g = 0.4 + 0.6 * Math.abs(r()); return g * env(i, 0.16, 0.03); }); },
    aro: () => shape(tones(0.12, [880, 1390], 'sin'), (i) => env(i, 0.03)),
    tom: () => mix([shape(sweep(0.5, 200, 160, 0.05), (i) => env(i, 0.18)), 1], [shape(biquad(noise(0.1, 19), 'bp', 400, 2), (i) => env(i, 0.03)), 0.5]),
    perc: () => pluck(1.0, 392, 0.993, 0.55, 20),
    bajo: () => biquad(pluck(1.6, 65.4, 0.997, 0.5, 21), 'lp', 1400),
    zap: () => mix([shape(tones(1.0, [1046], 'sin'), (i) => env(i, 0.35)), 1], [shape(tones(1.0, [2093 * 1.01], 'sin'), (i) => env(i, 0.12)), 0.4]),
  },
  // sonidos de insectos, sintetizados a partir de cómo los producen: estridulación (pulsos), timbales (cigarra) y alas (zumbido)
  insectos: {
    bombo: () => mix([shape(sweep(0.5, 130, 48, 0.035), (i) => env(i, 0.28)), 1], [shape(tones(0.12, [200], 'sq'), (i) => env(i, 0.03) * (0.5 + 0.5 * Math.sin(TAU * 200 * i / SR))), 0.15]),
    caja: () => shape(tones(0.22, [4300], 'sin'), (i) => { const t = i / SR, k = Math.floor(t / 0.028); return k < 4 && t % 0.028 < 0.016 ? Math.sin(Math.PI * (t % 0.028) / 0.016) * (1 - k * 0.15) : 0; }), // grillo: 4 pulsos
    palmas: () => shape(biquad(noise(0.08, 41), 'bp', 3000, 2), (i) => { const t = i / SR; return [0, 0.014, 0.031].reduce((a, s0) => a + (t >= s0 ? Math.exp(-(t - s0) / 0.003) : 0), 0); }), // escarabajo clic
    hat: () => shape(biquad(noise(0.06, 42), 'bp', 7500, 3), (i) => env(i, 0.012)), // aleteo
    'hat abierto': () => shape(biquad(noise(0.6, 43), 'bp', 5000, 1.5), (i) => (0.5 + 0.5 * Math.sin(TAU * 180 * i / SR)) * env(i, 0.3, 0.02)), // cigarra
    aro: () => shape(tones(0.03, [3100], 'sin'), (i) => env(i, 0.006)),
    tom: () => shape(biquad(tones(0.5, [150, 300], 'sq'), 'lp', 1200), (i) => Math.min(1, i / SR / 0.04) * env(i, 0.22)), // abejorro
    perc: () => shape(tones(0.35, [6500], 'sin'), (i) => (Math.sin(TAU * 60 * i / SR) > 0 ? 1 : 0) * env(i, 0.15)), // saltamontes
    bajo: () => shape(biquad(tones(1.0, [65.4, 65.9], 'sq'), 'lp', 650), (i) => (0.75 + 0.25 * Math.sin(TAU * 190 * i / SR)) * env(i, 0.5, 0.01)), // zumbido de mosca
    zap: () => { const b = buf(0.45); let ph = 0; for (let i = 0; i < b.length; i++) { const t = i / SR, f = 600 + 300 * (1 - Math.exp(-t / 0.1)) + 25 * Math.sin(TAU * 7 * t); ph += TAU * f / SR; b[i] = Math.sign(Math.sin(ph)) * 0.6 * env(i, 0.2, 0.01); } return biquad(b, 'lp', 5000); }, // mosquito
  },
  boom: {
    bombo: () => drive(mix([shape(sweep(1.2, 120, 42, 0.05), (i) => env(i, 0.85)), 1], [shape(biquad(noise(0.01, 51), 'hp', 3000), (i) => env(i, 0.002)), 0.3]), 1.3),
    caja: () => mix([shape(tones(0.25, [200], 'sin'), (i) => env(i, 0.05)), 0.6], [shape(biquad(biquad(noise(0.5, 52), 'hp', 1800), 'lp', 8000), (i) => env(i, 0.22)), 0.9]),
    palmas: () => { const n = biquad(noise(0.6, 53), 'bp', 1100, 0.9); return shape(n, (i) => { const t = i / SR; return t < 0.04 ? Math.exp(-((t % 0.0105) / 0.003)) : Math.exp(-(t - 0.04) / 0.2); }); },
    hat: () => shape(biquad(tones(0.12, HAT), 'hp', 8000), (i) => env(i, 0.022)),
    'hat abierto': () => shape(biquad(tones(1.0, HAT), 'hp', 7500), (i) => env(i, 0.4)),
    aro: () => shape(biquad(tones(0.08, [1800, 520], 'sin'), 'bp', 1700, 2), (i) => env(i, 0.012)),
    tom: () => shape(sweep(0.8, 180, 110, 0.06), (i) => env(i, 0.4)),
    perc: () => shape(sweep(0.3, 380, 330, 0.02), (i) => env(i, 0.12)),
    bajo: () => drive(shape(sweep(2.0, 62, 49, 0.06), (i) => env(i, 1.4)), 1.25),
    zap: () => shape(sweep(0.4, 1800, 120, 0.03), (i) => env(i, 0.12)),
  },
  minimal: {
    bombo: () => mix([shape(sweep(0.3, 150, 55, 0.02), (i) => env(i, 0.12)), 1], [shape(tones(0.004, [3000], 'sin'), () => 1), 0.3]),
    caja: () => mix([shape(biquad(noise(0.12, 61), 'hp', 3000), (i) => env(i, 0.04)), 0.9], [shape(tones(0.05, [260], 'sin'), (i) => env(i, 0.02)), 0.5]),
    palmas: () => shape(biquad(noise(0.08, 62), 'bp', 1800, 2), (i) => env(i, 0.03)),
    hat: () => shape(biquad(noise(0.04, 63), 'hp', 9000), (i) => env(i, 0.012)),
    'hat abierto': () => shape(biquad(noise(0.25, 64), 'hp', 8000), (i) => env(i, 0.09)),
    aro: () => shape(tones(0.02, [2400], 'sin'), (i) => env(i, 0.006)),
    tom: () => shape(sweep(0.25, 110, 100, 0.05), (i) => env(i, 0.09)),
    perc: () => fm(0.2, 1500, 2.01, 3, 0.01, 0.04),
    bajo: () => shape(sweep(0.6, 55, 50, 0.04, 'tri'), (i) => env(i, 0.25)),
    zap: () => shape(sweep(0.08, 6000, 400, 0.006), (i) => env(i, 0.03)),
  },
  chip: {
    bombo: () => crush(shape(sweep(0.3, 180, 50, 0.03, 'sq'), (i) => env(i, 0.1)), 4, 2),
    caja: () => crush(shape(noise(0.2, 71), (i) => env(i, 0.07)), 4, 8),
    palmas: () => crush(shape(noise(0.15, 72), (i) => env(i, 0.05)), 4, 16),
    hat: () => crush(shape(biquad(noise(0.05, 73), 'hp', 7000), (i) => env(i, 0.02)), 4, 2),
    'hat abierto': () => crush(shape(biquad(noise(0.35, 74), 'hp', 6500), (i) => env(i, 0.15)), 4, 2),
    aro: () => shape(tones(0.06, [1568], 'sq'), (i) => env(i, 0.03)),
    tom: () => shape(sweep(0.3, 300, 150, 0.05, 'sq'), (i) => env(i, 0.12)),
    perc: () => { const b = buf(0.3), f = [523.3, 659.3, 784]; let ph = 0; for (let i = 0; i < b.length; i++) { ph += f[Math.floor(i / SR / 0.03) % 3] / SR; b[i] = (ph % 1 < 0.5 ? 1 : -1) * env(i, 0.2); } return b; }, // arpegio
    bajo: () => shape(sweep(1.0, 65.4, 65.4, 1, 'tri'), (i) => (env(i, 0.6) > 0.05 ? Math.round(env(i, 0.6) * 8) / 8 : 0)), // triángulo con volumen en escalones
    zap: () => shape(sweep(0.25, 2000, 100, 0.04, 'sq'), (i) => env(i, 0.1)),
  },
};
// Lo-fi: la base analógica, afinada distinto, filtrada, con 8 bits y polvo
for (const v of VOICES) R.lofi[v] = () => { const b = R.analogo[v](), d = noise(b.length / SR, 31); const f = biquad(b.map((x, i) => x + d[i] * 0.02 * env(i, 0.4)), 'lp', v.startsWith('hat') ? 7000 : 4200); return drive(crush(f, 7, 3), 1.8); };

const cache = new Map();
// Devuelve { voz: Float32Array } (independiente del AudioContext)
export function kitData(id) {
  if (cache.has(id)) return cache.get(id);
  const rec = R[id] || R.analogo, out = {};
  for (const v of VOICES) out[v] = normalize(rec[v]());
  cache.set(id, out); return out;
}
export function toBuffers(ctx, data) {
  const o = {};
  for (const [v, d] of Object.entries(data)) { if (d instanceof AudioBuffer) { o[v] = d; continue; } const b = ctx.createBuffer(1, d.length, SR); b.copyToChannel(d, 0); o[v] = b; }
  return o;
}
