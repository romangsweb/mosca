// Fly Punch · Acompañar. Escucha una canción (la entrada del sidekick, una pestaña del navegador o un archivo),
// detecta su tempo, dónde caen sus golpes y su tonalidad, para que la mosca toque encima.
// Tempo: flujo espectral → autocorrelación (70–180 BPM). Golpes: peine sobre el flujo. Tono: croma + perfiles de Krumhansl.
// Todo corre en el navegador; el audio no sale de tu computadora.
import { rawConstraints } from './capture.js';

const N = 1024, NK = 4096;
const WORKLET = `class Tap extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(${N});this.n=0}process(i){const c=i[0];if(c&&c.length){const a=c[0],b=c[1]||c[0];for(let k=0;k<a.length;k++){this.b[this.n++]=(a[k]+b[k])*.5;if(this.n===${N}){this.port.postMessage({buf:this.b.slice(0),t:currentTime});this.n=0}}}return true}}registerProcessor('fp-tap',Tap)`;

// FFT real radix-2 (in place sobre re/im)
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
const hann = (n) => Float32Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function corr(a, b) { const ma = a.reduce((x, y) => x + y) / 12, mb = b.reduce((x, y) => x + y) / 12; let n = 0, da = 0, db = 0; for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db || 1); }
export const KEY_NAMES = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];

export class Follower {
  constructor(onUpdate) {
    this.onUpdate = onUpdate; this.ctx = null; this.node = null; this.src = null; this.stream = null; this.player = null;
    this.win = hann(N); this.winK = hann(NK); this.wt = Float32Array.from({ length: N / 2 }, (_, i) => 1 / (1 + i / 24)); this.reset();
  }
  reset() {
    this.env = []; this.times = []; this.prev = null; this.kbuf = new Float32Array(NK); this.kn = 0; this.chroma = new Float32Array(12);
    this.cands = []; this.frames = 0; this.level = 0; this.flip = 0;
    this.state = { on: false, source: null, name: '', bpm: null, conf: 0, beatAt: null, periodMs: null, key: null, keyConf: 0, level: 0, secs: 0, error: null };
  }
  get fps() { return this.ctx ? this.ctx.sampleRate / N : 46.875; }
  async start(ctx, source, opt = {}) {
    this.stop(); this.reset(); this.ctx = ctx;
    if (ctx.state === 'suspended') await ctx.resume();
    if (!Follower.loaded?.has(ctx)) { const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })); await ctx.audioWorklet.addModule(url); (Follower.loaded ||= new WeakSet()).add(ctx); }
    this.node = new AudioWorkletNode(ctx, 'fp-tap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2 });
    const mute = ctx.createGain(); mute.gain.value = 0; this.node.connect(mute).connect(ctx.destination);
    this.node.port.onmessage = (e) => this.frame(e.data.buf, e.data.t);
    let name = '';
    if (source === 'archivo') {
      const buf = await ctx.decodeAudioData(await opt.file.arrayBuffer()), s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buf; s.loop = true; g.gain.value = 0.8; s.connect(this.node); s.connect(g).connect(ctx.destination); s.start(); this.player = s; name = opt.file.name;
    } else {
      this.stream = source === 'pestana'
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, preferCurrentTab: false, selfBrowserSurface: 'exclude', systemAudio: 'include' })
        : await navigator.mediaDevices.getUserMedia(rawConstraints(opt.deviceId));
      this.stream.getVideoTracks().forEach((t) => t.stop());
      const at = this.stream.getAudioTracks()[0]; if (!at) { this.stop(); throw new Error('sin-audio'); }
      at.onended = () => { this.stop(); this.onUpdate?.(this.state); };
      this.src = ctx.createMediaStreamSource(this.stream); this.src.connect(this.node); name = at.label || '';
    }
    Object.assign(this.state, { on: true, source, name }); this.onUpdate?.(this.state);
  }
  stop() {
    try { this.player?.stop(); } catch {}
    this.player?.disconnect(); this.player = null; this.src?.disconnect(); this.src = null;
    this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null;
    if (this.node) { this.node.port.onmessage = null; this.node.disconnect(); this.node = null; }
    if (this.state) this.state.on = false;
  }
  // tiempo del contexto de audio → reloj de la página (performance.now)
  toPerf(t) { return performance.now() - (this.ctx.currentTime - t) * 1000; }
  frame(buf, t) {
    // nivel
    let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(buf[i])); this.level = Math.max(pk, this.level * 0.9);
    // flujo espectral (log)
    const re = new Float32Array(N), im = new Float32Array(N); for (let i = 0; i < N; i++) re[i] = buf[i] * this.win[i];
    fft(re, im);
    const mag = new Float32Array(N / 2); for (let i = 0; i < N / 2; i++) mag[i] = Math.log1p(100 * Math.hypot(re[i], im[i]));
    let flux = 0; if (this.prev) for (let i = 1; i < N / 2; i++) { const d = mag[i] - this.prev[i]; if (d > 0) flux += d * this.wt[i]; } // más peso a graves: el bombo marca el tiempo, los platillos llenan las corcheas
    this.prev = mag; this.env.push(flux); this.times.push(t);
    this.fluxAvg = (this.fluxAvg ?? flux) * 0.98 + flux * 0.02;
    const keep = Math.round(this.fps * 12); if (this.env.length > keep) { this.env.splice(0, this.env.length - keep); this.times.splice(0, this.times.length - keep); }
    // croma (ventana larga para tener resolución en graves)
    this.kbuf.copyWithin(0, N); this.kbuf.set(buf, NK - N); this.kn++;
    if (this.kn % 4 === 0 && flux < this.fluxAvg * 1.3) this.keyFrame(); // el tono se mide en lo sostenido, no en los golpes
    if (++this.frames % 12 === 0) this.analyze();
  }
  keyFrame() {
    const re = new Float32Array(NK), im = new Float32Array(NK); for (let i = 0; i < NK; i++) re[i] = this.kbuf[i] * this.winK[i];
    fft(re, im);
    // solo picos espectrales (notas), no el ruido de fondo: si no, el número de bins por nota sesga el resultado
    const hz = this.ctx.sampleRate / NK, c = new Float32Array(12), lo = Math.ceil(100 / hz), hi = Math.floor(Math.min(NK / 2 - 2, 2100 / hz)), m = new Float32Array(hi + 2);
    let mean = 0; for (let i = lo - 1; i <= hi + 1; i++) { m[i] = Math.hypot(re[i], im[i]); mean += m[i]; } mean /= hi - lo + 3;
    for (let i = lo; i <= hi; i++) {
      if (m[i] <= m[i - 1] || m[i] < m[i + 1] || m[i] < mean * 3) continue;
      const off = (0.5 * (m[i - 1] - m[i + 1])) / (m[i - 1] - 2 * m[i] + m[i + 1] || 1), p = 69 + 12 * Math.log2(((i + off) * hz) / 440);
      c[((Math.round(p) % 12) + 12) % 12] += Math.sqrt(m[i]);
    }
    const tot = c.reduce((a, b) => a + b) || 1; for (let i = 0; i < 12; i++) this.chroma[i] = this.chroma[i] * 0.995 + c[i] / tot;
  }
  analyze() {
    const st = this.state, fps = this.fps, n = this.env.length; st.secs = n / fps; st.level = this.level;
    if (n < fps * 4) { this.onUpdate?.(st); return; }
    // envolvente sin tendencia (resta media móvil) y rectificada
    const w = Math.round(fps * 0.25), e = new Float32Array(n); let acc = 0;
    for (let i = 0; i < n; i++) { acc += this.env[i]; if (i >= w) acc -= this.env[i - w]; e[i] = Math.max(0, this.env[i] - acc / Math.min(i + 1, w)); }
    // suavizar los picos (binomial de 5): sin esto, un periodo que no cae en cuadro entero se 've' la mitad de veces
    const sm = new Float32Array(n); for (let i = 0; i < n; i++) sm[i] = (6 * e[i] + 4 * ((e[i - 1] || 0) + (e[i + 1] || 0)) + (e[i - 2] || 0) + (e[i + 2] || 0)) / 16;
    e.set(sm);
    const ac = (lag) => { let s = 0; for (let i = lag; i < n; i++) s += e[i] * e[i - lag]; return s / (n - lag); };
    const a0 = ac(0) || 1, lmin = Math.floor((60 * fps) / 180), lmax = Math.ceil((60 * fps) / 70);
    const A = []; for (let l = 1; l <= Math.min(lmax * 4 + 2, n - 1); l++) A[l] = ac(l);
    const acf = (x) => { const i = Math.floor(x), fr = x - i; return (A[i] ?? 0) * (1 - fr) + (A[i + 1] ?? 0) * fr; };
    // búsqueda en rejilla fraccionaria: el periodo casi nunca cae en un número entero de cuadros.
    // Suma 1 a 4 tiempos + medio tiempo (distingue 124 de 83, que también encaja con las corcheas).
    let best = -1, lag = lmin;
    const score = (L) => { let sc = 0.5 * acf(L / 2); for (let k = 1; k <= 4; k++) if (k * L < n - 1) sc += acf(k * L) / k ** 0.3; return sc; };
    for (let L = lmin; L <= lmax; L += 0.02) {
      const bpm = (60 * fps) / L, prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2), sc = score(L) * prior;
      if (sc > best) { best = sc; lag = L; }
    }
    const y1 = acf(lag);
    // afinado fino: el periodo que maximiza la coherencia de fase de todos los golpes de la ventana (sub-cuadro)
    const coh = (P) => { let zr = 0, zi = 0; for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / P; zr += e[i] * Math.cos(a); zi += e[i] * Math.sin(a); } return zr * zr + zi * zi; };
    { let bc = -1, bL = lag; for (let L = lag - 0.4; L <= lag + 0.4; L += 0.01) { const c = coh(L); if (c > bc) { bc = c; bL = L; } } lag = bL; }
    let bpm = (60 * fps) / lag; const conf = Math.max(0, Math.min(1, y1 / a0 * 1.6));
    // estabilizar: mediana de las últimas estimaciones; ignora saltos de octava
    if (st.bpm) { const r = bpm / st.bpm; if (Math.abs(r - 2) < 0.06) bpm /= 2; else if (Math.abs(r - 0.5) < 0.03) bpm *= 2; }
    this.cands.push(bpm); if (this.cands.length > 7) this.cands.shift();
    const med = [...this.cands].sort((a, b) => a - b)[this.cands.length >> 1];
    st.bpm = Math.round(med * 10) / 10; st.conf = st.conf * 0.6 + conf * 0.4;
    // fase: media circular de los golpes en los últimos ~8 s (precisión menor a un cuadro y sin saltos)
    const P = (60 * fps) / st.bpm, i0 = Math.max(0, n - Math.round(fps * 8)); let zr = 0, zi = 0;
    for (let i = i0; i < n; i++) { const a = (2 * Math.PI * i) / P; zr += e[i] * Math.cos(a); zi += e[i] * Math.sin(a); }
    const ph = ((Math.atan2(zi, zr) / (2 * Math.PI)) * P + P) % P, back = (((n - 1 - ph) % P) + P) % P;
    const per = 60000 / st.bpm, fresh = this.toPerf(this.times[n - 1] - back / fps - N / 2 / this.ctx.sampleRate);
    // histéresis: un salto de medio tiempo (bombo ↔ contratiempo) solo se acepta si se repite varias veces seguidas
    if (st.beatAt && st.periodMs) {
      const pred = st.beatAt + Math.round((fresh - st.beatAt) / per) * per, d = ((((fresh - pred) % per) + per * 1.5) % per) - per / 2;
      if (Math.abs(d) > per * 0.2 && ++this.flip < 6) st.beatAt = pred; else { this.flip = 0; st.beatAt = Math.abs(d) > per * 0.2 ? fresh : pred + d * 0.5; }
    } else st.beatAt = fresh;
    st.periodMs = per;
    // tonalidad
    let kb = -2, k2 = -2, key = null;
    for (let r = 0; r < 12; r++) for (const [mode, prof] of [['mayor', MAJ], ['menor', MIN]]) {
      const rot = Array.from({ length: 12 }, (_, i) => prof[(i - r + 12) % 12]), c = corr(this.chroma, rot);
      if (c > kb) { k2 = kb; kb = c; key = { root: r, mode }; } else if (c > k2) k2 = c;
    }
    st.key = key; st.keyConf = Math.max(0, Math.min(1, (kb - k2) * 8 + (kb - 0.3)));
    this.onUpdate?.(st);
  }
}
