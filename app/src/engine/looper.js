// Fly Punch · looper con capas. Graba lo que suena (la mosca, el arpegiador y lo que tú tocas en el K.O.) durante 1, 2 o 4
// compases, lo repite a tempo y deja sumar capas encima, una vuelta a la vez.
// Fases: vacio → armado (espera el compás) → grabando → tocando ⇄ capa (graba una vuelta más encima)
export const LOOP_BARS = [1, 2, 4];
const MAX_EVENTS = 3000;

export class Looper {
  constructor(session) { this.S = session; this.reset(); }
  reset() { this.bars = this.bars || 2; this.layers = []; this.phase = 'vacio'; this.start = 0; this.cur = null; this.armedFor = null; this.callar = false; this.pausa = false; }
  get steps() { return this.bars * this.S.C.len; }
  get playing() { return this.layers.length > 0; } // con al menos una capa, el loop suena (también mientras esperas o grabas otra)
  // el botón principal: grabar el primer loop, o sumar una capa
  main() {
    if (!this.S.s.playing) return false;
    if (this.phase === 'vacio') { this.phase = 'armado'; this.armedFor = 'loop'; }
    else if (this.phase === 'tocando') { this.phase = 'armado'; this.armedFor = 'capa'; }
    else if (this.phase === 'armado') { this.phase = this.layers.length ? 'tocando' : 'vacio'; this.armedFor = null; } // cancelar
    this.S.emit(); return true;
  }
  undo() { if (this.phase === 'capa') { this.cur = null; this.phase = 'tocando'; } else this.layers.pop(); if (!this.layers.length && this.phase !== 'grabando') this.phase = 'vacio'; this.S.emit(); }
  // al detener: las capas se quedan; al volver a tocar, el loop arranca desde el paso 0
  halt() { this.cur = null; this.armedFor = null; this.start = 0; this.phase = this.layers.length ? 'tocando' : 'vacio'; }
  clear() { const b = this.bars; this.reset(); this.bars = b; this.S.emit(); }
  setBars(b) { if (this.phase === 'vacio' || this.phase === 'armado') { this.bars = b; this.S.emit(); } }
  toggleLayer(id) { const l = this.layers.find((x) => x.id === id); if (l) { l.muted = !l.muted; this.S.emit(); } }
  // posición dentro del loop (0…pasos-1) del paso absoluto n
  pos(n) { return (((n - this.start) % this.steps) + this.steps) % this.steps; }
  // se llama en cada paso, antes de que toque la mosca
  step(n, at) {
    const S = this.S, len = S.C.len;
    if (this.phase === 'armado' && n % len === 0) {
      if (this.armedFor === 'loop') { this.start = n; this.cur = { id: Date.now(), events: [], muted: false, name: 'Capa 1' }; this.phase = 'grabando'; }
      else if (this.pos(n) === 0) { this.cur = { id: Date.now(), events: [], muted: false, name: `Capa ${this.layers.length + 1}` }; this.phase = 'capa'; } // la capa empieza al inicio del loop
      this.armedFor = null; queueMicrotask(() => S.emit());
    }
    if (this.phase === 'grabando' && n - this.start >= this.steps) { this.layers.push(this.cur); this.cur = null; this.phase = 'tocando'; queueMicrotask(() => S.emit()); }
    else if (this.phase === 'capa' && n > this.start && this.pos(n) === 0 && this.cur?.started) { this.layers.push(this.cur); this.cur = null; this.phase = 'tocando'; queueMicrotask(() => S.emit()); }
    if (this.phase === 'capa' && this.cur) this.cur.started = true;
    if (!this.playing || this.pausa) return;
    const p = this.pos(n);
    for (const l of this.layers) if (!l.muted) for (const e of l.events) if (e.s === p) S.playLoopEvent(e, at + e.off);
  }
  // ¿la mosca toca en este paso? (puedes callarla para tocar solo con el loop)
  flyAllowed() { return !(this.callar && this.layers.length && this.playing); }
  recording() { return this.phase === 'grabando' || this.phase === 'capa'; }
  // lo que sale de Fly Punch en el paso n, a la hora `when`
  capture(n, at, e, when) {
    if (!this.recording() || !this.cur || this.cur.events.length > MAX_EVENTS) return;
    this.cur.events.push({ ...e, s: this.pos(n), off: Math.max(0, when - at) });
  }
  // una nota que tocas en el K.O.: llega ahora, y el paso que suena ahora es anterior al último programado
  captureIn(note, vel, ch, port) {
    if (!this.recording() || !this.cur) return;
    const L = this.S.live, stepMs = this.S.ko.stepMs, now = performance.now(), back = Math.max(0, Math.ceil((L.stepAt - now) / stepMs));
    const n = L.step - back, at = L.stepAt - back * stepMs;
    this.cur.events.push({ kind: 'in', note, vel, ch, port, s: this.pos(n), off: Math.max(0, now - at) });
  }
}
