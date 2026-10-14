// Fly Punch · MIDI para el K.O. II (EP-133). Web MIDI: Chrome / Edge.
// Reloj: sigue el reloj del K.O. II si llega (ajuste 102 en el K.O.); si no, reloj interno.
// Con clockOut activo, Fly Punch es el maestro: manda reloj 24 ppqn y Start/Stop (ajuste 101 en el K.O.).
export const GROUP_BASE = { A: 36, B: 48, C: 60, D: 72 };
export const PAD_KEYS = ['.', '0', 'ENT', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export class KO2 {
  constructor(h = {}) {
    this.h = h; this.access = null; this.input = null; this.output = null;
    this.clocks = []; this.ticks = 0; this.extClockAt = 0; this.running = false;
    this.internalBpm = 110; this.timer = null; this.nextAt = 0; this.step = 0;
    this.clockOut = false; this.latency = 0;
  }
  get supported() { return typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess; }
  get connected() { return !!this.output; }
  get hasExternalClock() { return !this.clockOut && performance.now() - this.extClockAt < 500; }
  get stepMs() { return 60000 / this.bpm / 4; }
  get bpm() {
    if (this.hasExternalClock && this.clocks.length > 24) {
      const c = this.clocks, span = (c[c.length - 1] - c[0]) / (c.length - 1);
      return 60000 / (span * 24);
    }
    return this.internalBpm;
  }
  async connect() {
    if (!this.supported) throw new Error('Este navegador no tiene Web MIDI. Usa Chrome o Edge.');
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => this.bind();
    this.bind();
  }
  ports() {
    if (!this.access) return { inputs: [], outputs: [] };
    return { inputs: [...this.access.inputs.values()].map((p) => p.name), outputs: [...this.access.outputs.values()].map((p) => p.name) };
  }
  // want: { port: nombre exacto elegido por el usuario, match: RegExp del perfil, none: true para no conectar }
  bind(want = this.want || {}) {
    this.want = want; if (!this.access) return;
    const pick = (m) => { const ps = [...m.values()]; if (want.none) return null; if (want.port) return ps.find((p) => p.name === want.port) || null; return want.match ? ps.find((p) => want.match.test(p.name)) || null : null; };
    if (this.input) this.input.onmidimessage = null;
    this.input = pick(this.access.inputs); this.output = pick(this.access.outputs);
    if (this.input) this.input.onmidimessage = (e) => this.onMsg(e);
    this.h.onState?.({ input: this.input?.name || null, output: this.output?.name || null });
  }
  onMsg(e) {
    const [st, d1, d2] = e.data;
    if (st === 0xF8) {
      if (this.clockOut) return;
      this.extClockAt = performance.now(); this.clocks.push(e.timeStamp); if (this.clocks.length > 49) this.clocks.shift();
      if (this.running && this.ticks % 6 === 0) this.h.onStep?.(this.step++, performance.now());
      this.ticks++; return;
    }
    if (st === 0xFA) { if (this.clockOut) return; this.ticks = 0; this.step = 0; this.h.onStart?.(); return; }
    if (st === 0xFC) { if (this.clockOut) return; this.h.onStop?.(); return; }
    if ((st & 0xF0) === 0x90 && d2 > 0) this.h.onNote?.({ ch: (st & 0x0F) + 1, note: d1, vel: d2 });
  }
  send(bytes, at) { if (this.output) this.output.send(bytes, at ? at - this.latency : undefined); }
  hit(note, vel = 100, ch = 1, len = 60, at = performance.now()) {
    if (!this.output) return;
    const c = (ch - 1) & 0x0F;
    this.send([0x90 | c, note & 0x7F, Math.max(1, Math.min(127, vel | 0))], at);
    this.send([0x80 | c, note & 0x7F, 0], at + len);
  }
  cc(num, val, ch = 1) { this.send([0xB0 | ((ch - 1) & 0x0F), num & 0x7F, Math.max(0, Math.min(127, val | 0))]); }
  start() {
    this.running = true; if (this.timer) return;
    this.step = 0; this.nextAt = performance.now() + 30;
    if (this.clockOut) this.send([0xFA], this.nextAt);
    const loop = () => {
      const now = performance.now();
      if (!this.hasExternalClock) {
        const dur = this.stepMs;
        while (this.nextAt <= now + 25) { // 25 ms de anticipación
          if (this.clockOut) for (let i = 0; i < 6; i++) this.send([0xF8], this.nextAt + (i * dur) / 6);
          this.h.onStep?.(this.step++, this.nextAt); this.nextAt += dur;
        }
      } else this.nextAt = now;
      this.timer = setTimeout(loop, 4);
    };
    loop();
  }
  stop() {
    this.running = false; clearTimeout(this.timer); this.timer = null;
    if (this.clockOut) this.send([0xFC]);
  }
}
