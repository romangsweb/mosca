// Fly Punch · diseñador de sonidos: un sintetizador paramétrico que renderiza un golpe o un tono a un buffer. La IA solo
// elige parámetros (no genera audio): el sonido lo hace este código, así que es original, instantáneo y sin derechos.
import { wavBlob } from './synth.js';

export const PARAMS = [
  // [clave, etiqueta, min, max, paso, unidad]
  ['freq', 'Tono', 30, 2000, 1, 'Hz'], ['barrido', 'Barrido', -48, 48, 1, 'st'], ['barrido_ms', 'Velocidad del barrido', 5, 600, 1, 'ms'],
  ['ataque_ms', 'Ataque', 0, 300, 1, 'ms'], ['caida_ms', 'Caída', 20, 3000, 1, 'ms'], ['ruido', 'Ruido', 0, 1, 0.01, ''], ['ruido_color', 'Color del ruido', 200, 14000, 10, 'Hz'],
  ['fm', 'FM (metal)', 0, 1, 0.01, ''], ['fm_ratio', 'Razón FM', 0.5, 8, 0.01, '×'], ['filtro', 'Filtro', 100, 18000, 10, 'Hz'], ['resonancia', 'Resonancia', 0, 20, 0.1, ''], ['drive', 'Saturación', 0, 1, 0.01, ''],
];
export const ONDAS = ['sine', 'triangle', 'square', 'sawtooth'];
export const DEFAULT = { onda: 'sine', freq: 55, barrido: 24, barrido_ms: 80, ataque_ms: 1, caida_ms: 700, ruido: 0, ruido_color: 3000, fm: 0, fm_ratio: 1.41, filtro: 8000, resonancia: 0.7, drive: 0.3 };
export const PRESETS = [
  ['Bombo 808', { onda: 'sine', freq: 48, barrido: 30, barrido_ms: 60, ataque_ms: 0, caida_ms: 1400, ruido: 0, fm: 0, filtro: 5000, resonancia: 0.7, drive: 0.35 }],
  ['Caja seca', { onda: 'triangle', freq: 190, barrido: 7, barrido_ms: 30, ataque_ms: 0, caida_ms: 180, ruido: 0.75, ruido_color: 4200, fm: 0, filtro: 9000, resonancia: 1, drive: 0.2 }],
  ['Hat metálico', { onda: 'square', freq: 820, barrido: 0, ataque_ms: 0, caida_ms: 70, ruido: 0.6, ruido_color: 9500, fm: 0.8, fm_ratio: 3.17, filtro: 16000, resonancia: 2, drive: 0 }],
  ['Zap láser', { onda: 'sawtooth', freq: 1600, barrido: -40, barrido_ms: 160, ataque_ms: 0, caida_ms: 220, ruido: 0, fm: 0.2, fm_ratio: 2, filtro: 7000, resonancia: 8, drive: 0.4 }],
  ['Gota', { onda: 'sine', freq: 700, barrido: 14, barrido_ms: 40, ataque_ms: 0, caida_ms: 160, ruido: 0, fm: 0, filtro: 12000, resonancia: 0.7, drive: 0 }],
  ['Campana', { onda: 'sine', freq: 520, barrido: 0, ataque_ms: 0, caida_ms: 2200, ruido: 0, fm: 0.55, fm_ratio: 3.5, filtro: 14000, resonancia: 0.7, drive: 0 }],
  ['Bajo sucio', { onda: 'sawtooth', freq: 55, barrido: 2, barrido_ms: 20, ataque_ms: 2, caida_ms: 600, ruido: 0, fm: 0.1, fm_ratio: 1, filtro: 900, resonancia: 6, drive: 0.6 }],
];
export const limpiar = (p) => { const o = { ...DEFAULT }; o.onda = ONDAS.includes(p?.onda) ? p.onda : DEFAULT.onda; for (const [k, , lo, hi] of PARAMS) if (typeof p?.[k] === 'number' && isFinite(p[k])) o[k] = Math.max(lo, Math.min(hi, p[k])); return o; };

export async function render(p0) {
  const p = limpiar(p0), sr = 44100, dur = Math.min(4.2, (p.ataque_ms + p.caida_ms) / 1000 + 0.05), ctx = new OfflineAudioContext(1, Math.ceil(sr * dur), sr);
  const out = ctx.createGain(), env = ctx.createGain(), lp = ctx.createBiquadFilter(), sh = ctx.createWaveShaper();
  lp.type = 'lowpass'; lp.frequency.value = p.filtro; lp.Q.value = p.resonancia;
  if (p.drive > 0.01) { const k = 1 + p.drive * 30, n = 1024, c = new Float32Array(n), tk = Math.tanh(k); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / tk; } sh.curve = c; }
  env.connect(lp).connect(sh).connect(out).connect(ctx.destination);
  const a = p.ataque_ms / 1000, d = p.caida_ms / 1000;
  env.gain.setValueAtTime(0.0001, 0); env.gain.linearRampToValueAtTime(1, Math.max(0.001, a)); env.gain.exponentialRampToValueAtTime(0.0001, a + d);
  // tono con barrido (y FM opcional)
  if (p.ruido < 0.999) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = p.onda; const f1 = p.freq * Math.pow(2, p.barrido / 12);
    o.frequency.setValueAtTime(Math.max(10, f1), 0); o.frequency.exponentialRampToValueAtTime(Math.max(10, p.freq), Math.max(0.006, p.barrido_ms / 1000));
    if (p.fm > 0.005) { const m = ctx.createOscillator(), mg = ctx.createGain(); m.frequency.value = p.freq * p.fm_ratio; mg.gain.value = p.freq * p.fm * 6; m.connect(mg).connect(o.frequency); m.start(0); m.stop(dur); }
    g.gain.value = 1 - p.ruido * 0.7; o.connect(g).connect(env); o.start(0); o.stop(dur);
  }
  if (p.ruido > 0.001) {
    const nb = ctx.createBuffer(1, Math.ceil(sr * dur), sr), dd = nb.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = nb; bp.type = 'bandpass'; bp.frequency.value = p.ruido_color; bp.Q.value = 0.9; g.gain.value = p.ruido * 1.4; s.connect(bp).connect(g).connect(env); s.start(0);
  }
  const buf = await ctx.startRendering(), ch = buf.getChannelData(0); let pk = 0; for (const x of ch) pk = Math.max(pk, Math.abs(x)); if (pk > 0) for (let i = 0; i < ch.length; i++) ch[i] *= 0.89 / pk; // a −1 dBFS
  return buf;
}
export const toFile = (buf, nombre) => new File([wavBlob(buf)], `${nombre}.wav`.replace(/[\\/]/g, '-'), { type: 'audio/wav' });
