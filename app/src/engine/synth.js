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
  const p = name === 'tono' ? 1 : Math.pow(2, pitch / 12);
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
    case 'tono': { // voz melódica: pitch = nota MIDI. Dos osciladores desafinados + filtro con envolvente
      const f = 440 * Math.pow(2, (pitch - 69) / 12), lp = ctx.createBiquadFilter(), dur = pitch < 52 ? 0.42 : 0.3;
      lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(400 + v * 3800, t); lp.frequency.exponentialRampToValueAtTime(260, t + dur);
      const a = osc('sawtooth', f), b = osc(pitch < 52 ? 'square' : 'triangle', f * 1.004); a.connect(lp); b.connect(lp); lp.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      a.start(t); b.start(t); a.stop(t + dur + 0.02); b.stop(t + dur + 0.02); break;
    }
    case 'zap': { const o = osc('square', 1800 * p); o.frequency.exponentialRampToValueAtTime(120, t + 0.09); o.connect(g); env(ctx, g, t, 0.18 * v, 0.1); o.start(t); o.stop(t + 0.11); break; }
    default: break;
  }
}

// ---------- efectos de la compu ----------
// Cada pista entra a su bus → (seco) maestro · (envío) reverb · (envío) delay a tempo. Maestro: filtro → compresor.
function impulse(ctx, secs = 2.2) {
  const n = Math.round(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let seed = 7 + c * 13; for (let i = 0; i < n; i++) { seed = (seed * 16807) % 2147483647; d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / n, 3.2); } }
  return b;
}
export const FX_DEFAULT = { filtro: 1, comp: true, dlyBeats: 0.75, dlyFb: 0.38 };
export function buildChain(ctx, dest, fx = FX_DEFAULT, bpm = 110) {
  const out = ctx.createGain(); out.gain.value = 0.7;
  const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 0.8;
  const comp = ctx.createDynamicsCompressor(), thru = ctx.createGain();
  out.connect(filt); filt.connect(comp).connect(dest); filt.connect(thru).connect(dest);
  const rev = ctx.createConvolver(); rev.buffer = impulse(ctx); const revOut = ctx.createGain(); revOut.gain.value = 0.9; rev.connect(revOut).connect(out);
  const dly = ctx.createDelay(2), fb = ctx.createGain(), dlyTone = ctx.createBiquadFilter(); dlyTone.type = 'lowpass'; dlyTone.frequency.value = 3800;
  dly.connect(dlyTone).connect(fb).connect(dly); dlyTone.connect(out);
  const buses = {};
  const chain = {
    out, filt, comp, thru, rev, dly, fb, buses,
    bus(id, sends = {}) {
      if (!buses[id]) { const g = ctx.createGain(), r = ctx.createGain(), d = ctx.createGain(); g.connect(out); g.connect(r).connect(rev); g.connect(d).connect(dly); buses[id] = { in: g, rev: r, dly: d }; }
      const b = buses[id]; b.rev.gain.value = sends.rev ?? 0; b.dly.gain.value = sends.dly ?? 0; return b.in;
    },
    set(f = FX_DEFAULT, tempo = bpm) {
      const x = { ...FX_DEFAULT, ...f };
      filt.frequency.value = 180 * Math.pow(18000 / 180, Math.max(0, Math.min(1, x.filtro)));
      comp.threshold.value = -18; comp.ratio.value = 4; comp.knee.value = 8;
      // compresor encendido = señal por el compresor; apagado = directo
      try { filt.disconnect(); } catch {} filt.connect(x.comp ? comp : thru);
      dly.delayTime.value = Math.min(1.9, (60 / Math.max(40, tempo)) * x.dlyBeats); fb.gain.value = Math.max(0, Math.min(0.85, x.dlyFb));
    },
  };
  chain.set(fx, bpm);
  return chain;
}

export class Synth {
  constructor() { this.ctx = null; this.out = null; this.enabled = true; this.kit = null; this.kits = {}; this.chain = null; this.trackKit = {}; this.sends = {}; }
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.chain = buildChain(this.ctx, this.ctx.destination); this.out = this.chain.out;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  // clic del metrónomo: directo a la salida, sin efectos ni volumen del kit
  click(at = performance.now(), accent = false) {
    const ctx = this.ensure(), t = Math.max(ctx.currentTime, ctx.currentTime + (at - performance.now()) / 1000), o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1760 : 1175; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.22, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.06);
  }
  setFx(fx, bpm) { this.ensure(); this.chain.set(fx, bpm); }
  setSends(id, sends) { this.sends[id] = sends; if (this.chain) this.chain.bus(id, sends); }
  // at: performance.now() en ms · track: id de la pista (su bus, su kit y sus envíos)
  play(name, vel, at = performance.now(), pitch = 0, track = null, pad = null) {
    if (!this.enabled || !name) return;
    const ctx = this.ensure(), t = Math.max(ctx.currentTime, ctx.currentTime + (at - performance.now()) / 1000);
    const kit = (track && this.kits[this.trackKit[track]]) || this.kit;
    const dest = padOut(ctx, track ? this.chain.bus(track, this.sends[track]) : this.out, t, pad || undefined, kit?.[name]?.duration || 0.5);
    if (name !== 'tono' && kit?.[name]) playBuffer(ctx, dest, kit[name], vel, t, pitch);
    else voice(ctx, dest, name, vel, t, pitch);
    // sidechain: el bombo «empuja» a las demás pistas (baja su volumen un instante y vuelve)
    if (name === 'bombo' && this.sc > 0) for (const [id, b] of Object.entries(this.chain.buses)) {
      if (id === track) continue; const gn = b.in.gain, depth = 1 - this.sc * 0.85 * Math.min(1, vel / 110);
      gn.cancelScheduledValues(t); gn.setValueAtTime(gn.value, t); gn.linearRampToValueAtTime(depth, t + 0.005); gn.linearRampToValueAtTime(1, t + 0.06 + this.sc * 0.18);
    }
  }
}

// Render de una toma a WAV con las voces internas.
// toca una muestra del kit: velocidad → volumen, pitch → semitonos
// caída (0.1–1: qué tanto del sonido se deja sonar) y paneo (−1 izq · 1 der) por pad
export function padOut(ctx, dest, t, { decay = 1, pan = 0 } = {}, len = 0.5) {
  if (decay >= 0.99 && !pan) return dest;
  const g = ctx.createGain(); let out = g;
  if (pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p).connect(dest); } else g.connect(dest);
  if (decay < 0.99) { const end = t + Math.max(0.02, len * decay); g.gain.setValueAtTime(1, Math.max(t, end - 0.04)); g.gain.linearRampToValueAtTime(0.0001, end); }
  return out;
}
export function playBuffer(ctx, dest, buffer, vel, t, pitch = 0) {
  const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = buffer; src.playbackRate.value = Math.pow(2, pitch / 12);
  g.gain.value = Math.pow(Math.max(0.05, vel / 127), 1.3); src.connect(g).connect(dest); src.start(t);
}
// opt: { fx, bpm, sends: {pista: {rev, dly}}, kits: {id: buffers}, trackKit: {pista: id} } → el WAV suena como en la compu
export async function renderWav(take, kitFor, kit = null, opt = {}) {
  const sr = 44100, dur = take.durMs / 1000 + 2.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * dur), sr), chain = buildChain(ctx, ctx.destination, opt.fx, opt.bpm);
  for (const id of new Set(take.events.map((e) => e.track))) chain.bus(id || 'x', opt.sends?.[id]);
  for (const e of take.events) {
    const n = kitFor(e), t = e.t / 1000 + 0.05, p = n === 'tono' ? e.note : (e.track === 'oido' ? 3 : 0) + (opt.padFor?.(e)?.tune || 0);
    const k = (opt.kits && opt.trackKit && opt.kits[opt.trackKit[e.track]]) || kit, pd = opt.padFor?.(e);
    const dest = padOut(ctx, chain.bus(e.track || 'x', opt.sends?.[e.track]), t, pd || undefined, k?.[n]?.duration || 0.5);
    if (n !== 'tono' && k?.[n]) playBuffer(ctx, dest, k[n], e.vel, t, p); else voice(ctx, dest, n, e.vel, t, p);
    const sc = opt.fx?.sc || 0;
    if (n === 'bombo' && sc > 0) for (const [id, b] of Object.entries(chain.buses)) { if (id === e.track) continue; const gn = b.in.gain; gn.setValueAtTime(1, t); gn.linearRampToValueAtTime(1 - sc * 0.85 * Math.min(1, e.vel / 110), t + 0.005); gn.linearRampToValueAtTime(1, t + 0.06 + sc * 0.18); }
  }
  return wavBlob(await ctx.startRendering());
}
export function wavBlob(buf) {
  const ch = buf.numberOfChannels, len = buf.length * ch * 2 + 44, ab = new ArrayBuffer(len), v = new DataView(ab);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, len - 8, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, len - 44, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44; for (let i = 0; i < buf.length; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Blob([ab], { type: 'audio/wav' });
}
