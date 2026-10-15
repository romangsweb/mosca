// Fly Punch · K.O. II a fondo: conversación (el K.O. toca a la mosca), expresión neuronal (la mosca mueve pitch, vibrato y
// efectos del K.O.) y el registro de lo que va y viene para el K.O. en pantalla.
import { profileById } from './devices.js';
import { SK_MATCH } from './sidekick.js';

export const GROUPS = ['A', 'B', 'C', 'D'];
const KO_MATCH = profileById('ko2').match;
// nota → grupo y pad del K.O. (notas 36–83: cuatro grupos de 12 pads)
export const noteToPad = (note) => (note >= 36 && note <= 83 ? { group: GROUPS[Math.floor((note - 36) / 12)], off: (note - 36) % 12 } : null);

export const CHARLA_DEFAULT = { on: true, modo: 'vivo', destino: 'neurona', fuerza: 0.6, eco: true, curva: 'lineal', pads: {} };
// cuánto pesa la fuerza con que tocas: lineal, suave (los golpes flojos ya cuentan) o dura (solo los fuertes)
export const CURVAS = { lineal: (x) => x, suave: (x) => Math.sqrt(x), dura: (x) => x * x * x };
// lo que puede hacer un pad elegido a mano: estimular cualquier neurona (n:índice) o dar un golpe a un sentido (s:nombre)
export const padKey = (group, off) => `${group || '-'}${off}`;
export const EXPR_DEFAULT = { on: false, lanes: [{ src: 'salida', dest: 'cc12', depth: 1, inv: false }, { src: 'activas', dest: 'cc13', depth: 1, inv: false }, { src: 'ninguna', dest: 'pb', depth: 0.6, inv: false }, { src: 'ninguna', dest: 'cc1', depth: 0.8, inv: false }] };
export const EXPR_SOURCES = [['ninguna', '— nada —'], ['salida', 'Salida de la pista elegida'], ['activas', 'Neuronas activas'], ['out:gusto', 'MN9 (gusto)'], ['out:oido', 'Acicalamiento (oído)'], ['out:olfato', 'Salida del olfato'], ['out:cortejo', 'Salida del cortejo'], ['out:vision', 'Fibra gigante (visión)']];
export const EXPR_DESTS = [['cc12', 'Efecto · perilla X (CC 12)'], ['cc13', 'Efecto · perilla Y (CC 13)'], ['pb', 'Pitch (se hunde)'], ['cc1', 'Vibrato (CC 1)'], ['cc64', 'Sustain (CC 64)']];

export class KoLink {
  constructor(session, senses) { this.S = session; this.senses = senses; this.mon = []; this.sent = []; this.inLog = []; this.outLog = []; this.eco = new Map(); this.pulses = []; this.last = {}; this.cc = { cc12: 0, cc13: 0, cc1: 0, pb: 0, cc64: 0 }; }
  // todo lo que Fly Punch le manda a un K.O. (para el filtro de eco y para la animación)
  noteOut(note, port) { const now = performance.now(); this.sent.push([note, now]); if (this.sent.length > 64) this.sent.shift(); const p = noteToPad(note); if (p) { this.outLog.push({ ...p, at: now, port: port?.name }); if (this.outLog.length > 96) this.outLog.shift(); } }
  // monitor MIDI: todo lo que llega (para ver qué manda cada control del K.O. y asignarlo con un clic)
  monitor(m) { if (m.type === 'note' && !m.val) return; this.mon.unshift({ ...m, at: Date.now() }); if (this.mon.length > 40) this.mon.length = 40; }
  isKoPort(name) { return !!name && KO_MATCH.test(name) && !SK_MATCH.test(name); }
  // ---------- conversación: una nota que llega del K.O. ----------
  noteIn({ note, vel, port, main }) {
    const S = this.S, c = { ...CHARLA_DEFAULT, ...S.s.charla }; if (!c.on) return;
    if (!(main || this.isKoPort(port)) || SK_MATCH.test(port || '')) return;
    const now = performance.now(); if (this.sent.some(([n, t]) => n === note && now - t < 40)) return; // es nuestra propia nota de regreso (MIDI thru)
    const p = noteToPad(note) || { group: null, off: ((note % 12) + 12) % 12 };
    this.inLog.push({ ...p, at: now, vel }); if (this.inLog.length > 96) this.inLog.shift();
    const t = (p.group && S.s.tracks.find((x) => x.group === p.group && S.audible(x))) || S.track();
    if (c.modo === 'pregunta' && S.s.playing && this.turno() === 'tu') { const pos = S.live.step % S.C.len; this.eco.set(pos, [...(this.eco.get(pos) || []), { t: t.id, off: p.off, vel, key: padKey(p.group, p.off) }]); }
    this.stimulate(t, p.off, vel, c, padKey(p.group, p.off));
  }
  stimulate(t, off, vel, c = { ...CHARLA_DEFAULT, ...this.S.s.charla }, key = null) {
    const S = this.S, k = Math.max(0, t.map.indexOf(off)), pads = S.pads(t), amt = (CURVAS[c.curva] || CURVAS.lineal)(Math.min(1, vel / 127)) * (0.3 + 1.7 * c.fuerza);
    const own = key && c.pads?.[key]; // un pad asignado a mano manda sobre todo lo demás
    if (own?.startsWith('n:')) { const i = +own.slice(2); if (i < S.D.n) { S.sim.g[i] += S.D.params.w_poi * 3 * amt; S.live.koHit = { at: performance.now(), idx: i }; } return; }
    if (own?.startsWith('s:')) { this.pulses.push({ sense: own.slice(2), s: amt, at: performance.now() }); S.live.koHit = { at: performance.now(), sense: own.slice(2) }; return; }
    if (c.destino === 'sentido') { const sens = this.senses[t.sense] || []; if (sens.length) this.pulses.push({ sense: sens[off % sens.length], s: amt, at: performance.now() }); }
    else S.sim.g[pads[k].idx] += S.D.params.w_poi * 3 * amt; // golpe a la neurona de ese pad
    S.live.koHit = { at: performance.now(), track: t.id, k };
  }
  // llamada y respuesta: compases pares te escucha (tú tocas), impares contesta (toca la mosca)
  turno(n = this.S.live.step) { return Math.floor(n / this.S.C.len) % 2 === 0 ? 'tu' : 'mosca'; }
  // se llama en cada paso, antes de que la mosca toque. Devuelve si la mosca puede sonar en este paso.
  step(n) {
    const S = this.S, c = { ...CHARLA_DEFAULT, ...S.s.charla }; if (!c.on || c.modo !== 'pregunta') return true;
    const turno = this.turno(n), pos = n % S.C.len;
    if (turno === 'tu' && pos === 0) this.eco.clear(); // un compás nuevo para escucharte
    if (turno === 'mosca' && c.eco) for (const h of this.eco.get(pos) || []) { const t = S.track(h.t); if (t) this.stimulate(t, h.off, h.vel * 0.8, c, h.key); } // la mosca «recuerda» tu frase
    S.live.turno = turno;
    return turno === 'mosca';
  }
  applyPulses(r) {
    if (!this.pulses.length) return r; const now = performance.now(); this.pulses = this.pulses.filter((p) => now - p.at < 500);
    for (const p of this.pulses) r[p.sense] = (r[p.sense] || 0) + p.s * 160 * Math.exp(-(now - p.at) / 150);
    return r;
  }
  // ---------- expresión: neuronas → pitch, vibrato, efectos ----------
  value(src) {
    const S = this.S, L = S.live, hz = (x) => Math.min(1, (x || 0) / 150);
    if (src === 'salida') { const t = S.track(); return hz(t.sense === 'gusto' ? L.mn9 : L.out[t.sense]); }
    if (src === 'activas') return Math.min(1, (L.active || 0) / 80);
    if (src.startsWith('out:')) { const m = src.slice(4); return hz(m === 'gusto' ? L.mn9 : L.out[m]); }
    return null;
  }
  expression(n) {
    const S = this.S, e = { ...EXPR_DEFAULT, ...(S.s.expr || {}), on: S.s.expr ? S.s.expr.on : !!S.s.fxAuto }; if (!e.on || n % 2 || !S.ko.connected) return; // sin ajustes nuevos, respeta el viejo «la mosca mueve los efectos»
    const ports = new Set([S.ko.output, ...S.s.tracks.map((t) => (S.profileFor(t).id === 'ko2' ? S.portFor(t) : null))].filter(Boolean));
    for (const l of e.lanes) {
      let v = this.value(l.src); if (v == null) continue; if (l.inv) v = 1 - v; v *= l.depth;
      const prev = this.cc[l.dest] ?? 0, sm = prev + (v - prev) * 0.5; this.cc[l.dest] = sm;
      if (l.dest === 'pb') { // pitch bend: 8192 es el centro; la actividad lo hunde (hasta media escala hacia abajo)
        const val = Math.round(8192 - sm * 4096); if (Math.abs(val - (this.last.pb ?? 8192)) < 64) continue; this.last.pb = val;
        ports.forEach((p) => S.ko.send([0xE0, val & 0x7F, (val >> 7) & 0x7F], undefined, p)); this.cc.pb = sm;
      } else {
        const num = { cc12: 12, cc13: 13, cc1: 1, cc64: 64 }[l.dest], val = l.dest === 'cc64' ? (sm > 0.5 ? 127 : 0) : Math.round(sm * 127);
        if (Math.abs(val - (this.last[l.dest] ?? -9)) < 2) continue; this.last[l.dest] = val;
        ports.forEach((p) => S.ko.send([0xB0, num, val], undefined, p));
      }
    }
  }
  // al detener: pitch al centro y sustain suelto, para no dejar el K.O. desafinado
  reset() {
    const S = this.S, ports = new Set([S.ko.output, ...S.s.tracks.map((t) => (S.profileFor(t).id === 'ko2' ? S.portFor(t) : null))].filter(Boolean));
    ports.forEach((p) => { S.ko.send([0xE0, 0, 64], undefined, p); S.ko.send([0xB0, 64, 0], undefined, p); }); this.last = {}; this.cc = { cc12: 0, cc13: 0, cc1: 0, pb: 0, cc64: 0 }; this.eco.clear();
  }
}

