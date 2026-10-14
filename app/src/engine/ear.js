// Fly Punch · oído: micrófono o archivo de audio → energía en 3 bandas → neuronas del órgano de Johnston.
// Graves → JO-CM, medios → JO-FV, agudos → JO-DA. Es una asignación de diseño, no una medición fisiológica.
const BANDS = [[30, 300], [300, 2000], [2000, 8000]];
export class Ear {
  constructor() { this.ctx = null; this.an = null; this.src = null; this.stream = null; this.levels = [0, 0, 0]; this.peak = [1, 1, 1]; this.name = ''; this.kind = null; }
  async ensure() {
    if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.an = this.ctx.createAnalyser(); this.an.fftSize = 2048; this.an.smoothingTimeConstant = 0.6; this.bins = new Uint8Array(this.an.frequencyBinCount); }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }
  stop() {
    try { this.src?.stop?.(); } catch {}
    this.src?.disconnect(); this.src = null;
    this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null;
    this.kind = null; this.levels = [0, 0, 0];
  }
  async mic(deviceId) {
    await this.ensure(); this.stop();
    this.stream = await navigator.mediaDevices.getUserMedia(deviceId ? { audio: { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } } : { audio: true });
    this.src = this.ctx.createMediaStreamSource(this.stream); this.src.connect(this.an);
    this.kind = 'mic'; this.name = 'micrófono';
  }
  async file(f) {
    await this.ensure(); this.stop();
    const buf = await this.ctx.decodeAudioData(await f.arrayBuffer());
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const gain = this.ctx.createGain(); gain.gain.value = 0.6;
    s.connect(this.an); s.connect(gain).connect(this.ctx.destination); s.start();
    this.src = s; this.kind = 'archivo'; this.name = f.name;
  }
  read() {
    if (!this.kind) return this.levels;
    this.an.getByteFrequencyData(this.bins);
    const hzPerBin = this.ctx.sampleRate / 2 / this.bins.length;
    this.levels = BANDS.map(([lo, hi], b) => {
      let s = 0, n = 0;
      for (let i = Math.floor(lo / hzPerBin); i <= Math.min(this.bins.length - 1, Math.ceil(hi / hzPerBin)); i++) { s += this.bins[i]; n++; }
      const e = n ? s / n : 0; this.peak[b] = Math.max(this.peak[b] * 0.996, e, 8);
      return Math.max(0, Math.min(1, (e / this.peak[b] - 0.15) / 0.85));
    });
    return this.levels;
  }
}
