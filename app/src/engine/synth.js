// Fly Punch · sintetizador interno (Web Audio). Sirve para escuchar sin K.O. II y para exportar WAV.
// No imita los sonidos del K.O. II: son voces simples de batería por rol.
export const VOICES = ['bombo', 'caja', 'palmas', 'hat', 'hat abierto', 'aro', 'tom', 'perc', 'bajo', 'zap'];
export const VOICE_CAT = { bombo: 'grave', bajo: 'grave', tom: 'grave', caja: 'medio', palmas: 'medio', aro: 'medio', hat: 'agudo', 'hat abierto': 'agudo', perc: 'agudo', zap: 'agudo' };
// rol por pad de un grupo (orden de notas: . 0 ENT 1 2 3 4 5 6 7 8 9)
export const DEFAULT_KIT = ['hat', 'hat abierto', 'perc', 'bombo', 'caja', 'palmas', 'tom', 'aro', 'perc', 'bajo', 'bajo', 'zap'];

function noiseBuffer(ctx) {
  if (ctx._noise) return ctx._noise;
  const b = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return (ctx._noise = b);
}
const env = (ctx, g, t, peak, dec) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); };

// Toca una voz en ctx a tiempo t (segundos de ctx) hacia dest.
export function voice(ctx, dest, name, vel, t, pitch = 0) {
  const v = Math.max(0.05, vel / 127), g = ctx.createGain(); g.connect(dest);
  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); return o; };
  const noise = (filterType, f, q = 1) => { const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx); const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.value = f; fl.Q.value = q; s.connect(fl).connect(g); return s; };
  const p = Math.pow(2, pitch / 12);
  switch (name) {
    case 'bombo': { const o = osc('sine', 150 * p); o.frequency.exponentialRampToValueAtTime(42 * p, t + 0.12); o.connect(g); env(ctx, g, t, 0.9 * v, 0.42); o.start(t); o.stop(t + 0.45); break; }
    case 'tom': { const o = osc('sine', 220 * p); o.frequency.exponentialRampToValueAtTime(110 * p, t + 0.2); o.connect(g); env(ctx, g, t, 0.6 * v, 0.3); o.start(t); o.stop(t + 0.32); break; }
    case 'bajo': { const o = osc('sawtooth', 55 * p), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.25); o.connect(f).connect(g); env(ctx, g, t, 0.45 * v, 0.32); o.start(t); o.stop(t + 0.34); break; }
    case 'caja': { const s = noise('highpass', 1200); env(ctx, g, t, 0.5 * v, 0.18); s.start(t); s.stop(t + 0.2); const o = osc('triangle', 190 * p), g2 = ctx.createGain(); o.connect(g2).connect(dest); env(ctx, g2, t, 0.35 * v, 0.1); o.start(t); o.stop(t + 0.12); break; }
    case 'palmas': { const s = noise('bandpass', 1600, 0.8); [0, 0.011, 0.022].forEach((d, i) => { g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.5 * v, t + d + 0.002); g.gain.exponentialRampToValueAtTime(i === 2 ? 0.0001 : 0.05, t + d + (i === 2 ? 0.16 : 0.01)); }); s.start(t); s.stop(t + 0.2); break; }
    case 'aro': { const o = osc('square', 820 * p), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; o.connect(f).connect(g); env(ctx, g, t, 0.3 * v, 0.04); o.start(t); o.stop(t + 0.05); break; }
    case 'hat': { const s = noise('highpass', 7500); env(ctx, g, t, 0.28 * v, 0.05); s.start(t); s.stop(t + 0.06); break; }
    case 'hat abierto': { const s = noise('highpass', 6500); env(ctx, g, t, 0.24 * v, 0.28); s.start(t); s.stop(t + 0.3); break; }
    case 'perc': { const o = osc('triangle', 520 * p), m = osc('square', 1370 * p), mg = ctx.createGain(); mg.gain.value = 300; m.connect(mg).connect(o.frequency); o.connect(g); env(ctx, g, t, 0.3 * v, 0.09); o.start(t); m.start(t); o.stop(t + 0.1); m.stop(t + 0.1); break; }
    case 'zap': { const o = osc('square', 1800 * p); o.frequency.exponentialRampToValueAtTime(120, t + 0.09); o.connect(g); env(ctx, g, t, 0.18 * v, 0.1); o.start(t); o.stop(t + 0.11); break; }
    default: break;
  }
}

export class Synth {
  constructor() { this.ctx = null; this.out = null; this.enabled = true; }
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.out = this.ctx.createGain(); this.out.gain.value = 0.7;
      const comp = this.ctx.createDynamicsCompressor(); this.out.connect(comp).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  // at: performance.now() en ms
  play(name, vel, at = performance.now(), pitch = 0) {
    if (!this.enabled || !name) return;
    const ctx = this.ensure(), t = Math.max(ctx.currentTime, ctx.currentTime + (at - performance.now()) / 1000);
    voice(ctx, this.out, name, vel, t, pitch);
  }
}

// Render de una toma a WAV con las voces internas.
export async function renderWav(take, kitFor) {
  const sr = 44100, dur = take.durMs / 1000 + 1;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * dur), sr), out = ctx.createGain(); out.gain.value = 0.7;
  const comp = ctx.createDynamicsCompressor(); out.connect(comp).connect(ctx.destination);
  for (const e of take.events) voice(ctx, out, kitFor(e), e.vel, e.t / 1000 + 0.05, e.track === 'oido' ? 3 : 0);
  return wavBlob(await ctx.startRendering());
}
function wavBlob(buf) {
  const ch = buf.numberOfChannels, len = buf.length * ch * 2 + 44, ab = new ArrayBuffer(len), v = new DataView(ab);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, len - 8, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, len - 44, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44; for (let i = 0; i < buf.length; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Blob([ab], { type: 'audio/wav' });
}
