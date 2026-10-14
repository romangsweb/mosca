// Fly Punch · MIDI. Web MIDI: Chrome / Edge.
// Un puerto principal (perfil de Equipo) + salidas extra por pista. Se escuchan TODAS las entradas:
// notas y CC de cualquier aparato (para aprender controles); el reloj solo del puerto principal.
// Reloj: sigue el reloj del K.O. II si llega (ajuste 102 en el K.O.); si no, reloj interno.
// Con clockOut activo, Fly Punch es el maestro: manda reloj 24 ppqn y Start/Stop (ajuste 101 en el K.O.).
export const GROUP_BASE = { A: 36, B: 48, C: 60, D: 72 };
export const PAD_KEYS = ['.', '0', 'ENT', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Reloj en un worker: los temporizadores de la página se frenan cuando la pestaña no está visible,
// los del worker no. El worker solo "late"; la programación de notas sigue aquí con marcas de tiempo exactas.
let TICK_URL = null;
const tickWorker = () => {
  try { TICK_URL ||= URL.createObjectURL(new Blob(['let t=null;onmessage=(e)=>{clearInterval(t);t=e.data>0?setInterval(()=>postMessage(0),e.data):null}'], { type: 'text/javascript' })); return new Worker(TICK_URL); }
  catch { return null; }
};

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
    this.input = pick(this.access.inputs); this.output = pick(this.access.outputs);
    for (const inp of this.access.inputs.values()) inp.onmidimessage = (e) => this.onMsg(e, inp);
    this.h.onState?.({ input: this.input?.name || null, output: this.output?.name || null });
  }
  outPort(name) { if (!this.access || !name) return null; return [...this.access.outputs.values()].find((p) => p.name === name) || null; }
  onMsg(e, inp) {
    const [st, d1, d2] = e.data, main = inp === this.input;
    if (st >= 0xF8 && !main) return; // reloj y transporte solo del puerto principal
    if (st === 0xF8) {
      if (this.clockOut) return;
      this.extClockAt = performance.now(); this.clocks.push(e.timeStamp); if (this.clocks.length > 49) this.clocks.shift();
      if (this.running && this.ticks % 6 === 0) this.h.onStep?.(this.step++, performance.now());
      this.ticks++; return;
    }
    if (st === 0xFA) { if (this.clockOut) return; this.ticks = 0; this.step = 0; this.h.onStart?.(); return; }
    if (st === 0xFC) { if (this.clockOut) return; this.h.onStop?.(); return; }
    const type = st & 0xF0, ch = (st & 0x0F) + 1, port = inp?.name;
    if (type === 0x90 && d2 > 0) { this.h.onNote?.({ ch, note: d1, vel: d2, port, main }); this.h.onAny?.({ type: 'note', ch, num: d1, val: d2, port }); }
    if (type === 0xB0) this.h.onAny?.({ type: 'cc', ch, num: d1, val: d2, port });
    // perillas que no mandan CC: la palanca suele mandar pitch bend; los pads de presión, aftertouch
    if (type === 0xE0) this.h.onAny?.({ type: 'pb', ch, num: 0, val: d2, port });
    if (type === 0xD0) this.h.onAny?.({ type: 'at', ch, num: 0, val: d1, port });
    if (type === 0xA0) this.h.onAny?.({ type: 'at', ch, num: d1, val: d2, port });
    if (type !== 0x80) this.h.onRaw?.({ bytes: [...e.data].slice(0, 3), port });
  }
  send(bytes, at, port = this.output) { if (port) port.send(bytes, at ? at - this.latency : undefined); }
  hit(note, vel = 100, ch = 1, len = 60, at = performance.now(), port = this.output) {
    if (!port) return;
    const c = (ch - 1) & 0x0F;
    this.send([0x90 | c, note & 0x7F, Math.max(1, Math.min(127, vel | 0))], at, port);
    this.send([0x80 | c, note & 0x7F, 0], at + len, port);
  }
  cc(num, val, ch = 1) { this.send([0xB0 | ((ch - 1) & 0x0F), num & 0x7F, Math.max(0, Math.min(127, val | 0))]); }
  start() {
    this.running = true; if (this.timer) return;
    this.step = 0; this.nextAt = performance.now() + 30;
    if (this.clockOut) this.send([0xFA], this.nextAt);
    const loop = () => {
      if (!this.timer) return;
      const now = performance.now();
      if (!this.hasExternalClock) {
        // con la pestaña oculta el navegador entrega los latidos con retraso: programamos más adelante
        const dur = this.stepMs, ahead = typeof document !== 'undefined' && document.hidden ? 160 : 25;
        if (now - this.nextAt > 250) this.nextAt = now + 5; // tras una pausa larga (p. ej. la Mac dormida) no recuperar cientos de pasos de golpe
        while (this.nextAt <= now + ahead) {
          if (this.clockOut) for (let i = 0; i < 6; i++) this.send([0xF8], this.nextAt + (i * dur) / 6);
          this.h.onStep?.(this.step++, this.nextAt); this.nextAt += dur;
        }
      } else this.nextAt = now;
    };
    this.worker ||= tickWorker();
    if (this.worker) { this.timer = true; this.worker.onmessage = loop; this.worker.postMessage(5); loop(); }
    else { const t = () => { loop(); if (this.timer) this.timer = setTimeout(t, 4); }; this.timer = setTimeout(t, 0); }
  }
  stop() {
    this.running = false; if (this.worker) this.worker.postMessage(0); if (typeof this.timer === 'number') clearTimeout(this.timer); this.timer = null;
    if (this.clockOut) this.send([0xFC]);
  }

}
