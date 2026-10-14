// Fly Punch · módulo MIDI para el K.O. II (EP-133). Web MIDI: Chrome / Edge.
// Reloj: sigue el reloj MIDI del K.O. II (24 ppqn) si llega; si no, usa un reloj interno.
export class KO2 {
  constructor(h = {}) {
    this.h = h; this.access = null; this.input = null; this.output = null;
    this.clocks = []; this.ticks = 0; this.extClockAt = 0; this.running = false;
    this.internalBpm = 110; this.timer = null; this.nextAt = 0;
  }
  get supported() { return !!navigator.requestMIDIAccess; }
  get hasExternalClock() { return performance.now() - this.extClockAt < 500; }
  get bpm() {
    if (this.hasExternalClock && this.clocks.length > 24) {
      const c = this.clocks, span = (c[c.length - 1] - c[0]) / (c.length - 1);
      return 60000 / (span * 24);
    }
    return this.internalBpm;
  }
  async connect() {
    if (!this.supported) throw new Error('Este navegador no soporta Web MIDI. Usa Chrome o Edge.');
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => this.bind();
    this.bind();
  }
  bind() {
    const re = /EP-?133|K\.?O|teenage/i, pick = (m) => [...m.values()].find((p) => re.test(p.name)) || null;
    if (this.input) this.input.onmidimessage = null;
    this.input = pick(this.access.inputs); this.output = pick(this.access.outputs);
    if (this.input) this.input.onmidimessage = (e) => this.onMsg(e);
    this.h.onState?.({ input: this.input?.name, output: this.output?.name });
  }
  onMsg(e) {
    const [st, d1, d2] = e.data;
    if (st === 0xF8) {
      this.extClockAt = performance.now(); this.clocks.push(e.timeStamp); if (this.clocks.length > 49) this.clocks.shift();
      if (this.running && this.ticks % 6 === 0) this.h.onStep?.(this.ticks / 6);
      this.ticks++; return;
    }
    if (st === 0xFA) { this.ticks = 0; this.h.onStart?.(); return; }
    if (st === 0xFC) { this.h.onStop?.(); return; }
    if ((st & 0xF0) === 0x90 && d2 > 0) this.h.onNote?.({ ch: (st & 0x0F) + 1, note: d1, vel: d2 });
  }
  hit(note, vel = 100, ch = 1, len = 80) {
    if (!this.output) return;
    const c = (ch - 1) & 0x0F, now = performance.now();
    this.output.send([0x90 | c, note & 0x7F, Math.max(1, Math.min(127, vel | 0))]);
    this.output.send([0x80 | c, note & 0x7F, 0], now + len);
  }
  // Reloj interno: semicorcheas a internalBpm; se pausa solo si llega reloj del K.O. II.
  start() {
    this.running = true; if (this.timer) return;
    let step = 0; this.nextAt = performance.now();
    const loop = () => {
      const now = performance.now();
      if (!this.hasExternalClock) {
        const dur = 60000 / this.internalBpm / 4;
        while (this.nextAt <= now) { this.h.onStep?.(step++); this.nextAt += dur; }
      } else { this.nextAt = now; }
      this.timer = setTimeout(loop, 5);
    };
    loop();
  }
  stop() { this.running = false; clearTimeout(this.timer); this.timer = null; }
}
