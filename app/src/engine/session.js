// Fly Punch · motor de la sesión: un cerebro, varias pistas, reloj, grabación y salida MIDI / audio interno.
import { Circuit } from './sim.js';
import { KO2, GROUP_BASE } from './midi.js';
import { Ear } from './ear.js';
import { Synth, DEFAULT_KIT } from './synth.js';
import { mutate, identity } from './mutate.js';
import { kvGet, kvSet, takePut, takesAll, takeDel, FREE_TAKES } from './storage.js';
import { cloudEnabled, currentUser, onAuth, loadProfile, saveProfile, signOut, startTrialCloud, listTakes, getTake, uploadTake, renameTakeCloud, deleteTakeCloud } from './cloud.js';

// ajustes que se guardan en el navegador y, con cuenta, en la nube
const KEEP = ['bpm', 'sessionName', 'theme', 'guide', 'onboarded', 'alias', 'inputs', 'tracks', 'selTrack', 'selPad', 'density', 'swing', 'humanize', 'curve', 'velMin', 'velMax', 'ghost', 'sendMidi', 'clockOut', 'fxAuto', 'monitor', 'latency', 'oidoSource', 'perRow'];

export const SENSES = { gusto: ['dulce', 'amargo'], oido: ['jon_ce', 'jon_f', 'jon_dm'] };
export const SENSE_LABEL = { dulce: 'Dulce', amargo: 'Amargo', jon_ce: 'Graves', jon_f: 'Medios', jon_dm: 'Agudos' };
export const HIST = 128;
// Qué abre Pro. El servidor aplica lo que importa (límite de tomas); la app solo muestra y bloquea la interfaz.
export const PRO_FEATURES = {
  datos: 'Modo Datos: tus CSV estimulan los sentidos',
  wav: 'Exportar tomas a WAV',
  tomas: 'Tomas ilimitadas en la nube',
};
const NO_PLAN = { plan: 'free', planBase: 'free', trialEnds: null, trialUsed: false };
const CURVES = { lineal: (x) => x, suave: (x) => Math.sqrt(x), dura: (x) => x * x };

const DEFAULTS = {
  bpm: 110, sessionName: 'Sesión sin título', theme: 'noche', guide: true, onboarded: false, alias: '',
  inputs: { dulce: 150, amargo: 40, jon_ce: 0, jon_f: 0, jon_dm: 0 },
  tracks: [
    { id: 'gusto', name: 'Gusto', sense: 'gusto', group: 'C', ch: 1, mute: false, solo: false, level: 1, map: identity(), kit: [...DEFAULT_KIT] },
    { id: 'oido', name: 'Oído', sense: 'oido', group: 'A', ch: 1, mute: true, solo: false, level: 0.85, map: identity(), kit: [...DEFAULT_KIT] },
  ],
  selTrack: 'gusto', selPad: 11,
  density: 4, swing: 54, humanize: 4, curve: 'suave', velMin: 70, velMax: 127, ghost: true,
  sendMidi: true, clockOut: false, fxAuto: false, monitor: 'auto', latency: 0,
  oidoSource: 'manual', dataMap: {}, perRow: 16,
};

export class Session {
  constructor() {
    this.listeners = new Set(); this.stepListeners = new Set();
    this.s = structuredClone(DEFAULTS);
    this.s.playing = false; this.s.rec = false; this.s.ko = { input: null, output: null, error: null };
    this.s.takes = []; this.s.ready = false; this.s.user = null; Object.assign(this.s, NO_PLAN); this.s.sync = cloudEnabled ? 'local' : 'off'; this.s.mutHistory = {}; this.s.data = null; this.s.row = 0; this.s.saved = Date.now();
    this.live = { step: 0, pos: 0, active: 0, mn9: 0, groom: 0, rate: {}, lanes: {}, hist: new Array(64).fill(0), counts: null, lastHitAt: {}, rowHist: [], rateHist: {}, spikes: {} };
    this.rec = null; this.ear = new Ear(); this.synth = new Synth();
    this.ko = new KO2({
      onStep: (n, at) => this.step(n, at),
      onStart: () => { if (!this.s.playing) this.play(); },
      onStop: () => { if (this.s.playing) this.stop(); },
      onNote: (m) => this.onKoNote(m),
      onState: (st) => this.set({ ko: { ...st, error: null } }),
    });
  }
  async load() {
    const [D, cloud] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/circuito-multi.json`).then((r) => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/cerebro-nube.bin`).then((r) => r.arrayBuffer()),
    ]);
    this.D = D; this.cloud = new Int16Array(cloud); this.sim = new Circuit(D);
    for (const t of this.s.tracks) {
      this.live.lanes[t.id] = [...Array(12)].map(() => new Uint8Array(16)); this.live.rate[t.id] = new Float32Array(12);
      // historia por neurona (últimos HIST pasos): frecuencia suavizada y disparos crudos, para la gráfica del inspector
      this.live.rateHist[t.id] = [...Array(12)].map(() => new Float32Array(HIST)); this.live.spikes[t.id] = [...Array(12)].map(() => new Uint8Array(HIST));
    }
    const saved = await kvGet('settings');
    if (saved) Object.assign(this.s, { ...saved, tracks: saved.tracks?.map((t, i) => ({ ...DEFAULTS.tracks[i], ...t })) || this.s.tracks });
    this.ko.internalBpm = this.s.bpm; this.ko.clockOut = this.s.clockOut; this.ko.latency = this.s.latency;
    await this.refreshTakes();
    if (cloudEnabled) {
      try { const u = await currentUser(); if (u) await this.adoptUser(u); } catch (e) { console.warn('cuenta', e); }
      onAuth((u) => { if (u && u.id !== this.s.user?.id) this.adoptUser(u); if (!u && this.s.user) { this.set({ user: null, ...NO_PLAN, sync: 'local' }); this.refreshTakes(); } });
    }
    this.s.ready = true; this.emit();
    if (navigator.requestMIDIAccess) this.connect(true);
  }
  // ---------- store ----------
  get() { return this.s; }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  onStep(fn) { this.stepListeners.add(fn); return () => this.stepListeners.delete(fn); }
  emit() { this.s = { ...this.s }; this.listeners.forEach((f) => f()); }
  set(patch, persist = false) {
    Object.assign(this.s, typeof patch === 'function' ? patch(this.s) : patch); this.emit();
    if (persist) this.persist();
  }
  snapshot() { return Object.fromEntries(KEEP.map((k) => [k, this.s[k]])); }
  persist() {
    clearTimeout(this._pt);
    this._pt = setTimeout(() => { kvSet('settings', this.snapshot()); this.set({ saved: Date.now() }); }, 400);
    if (this.s.user) { clearTimeout(this._ct); this._ct = setTimeout(() => this.pushCloud(), 1500); }
  }
  // ---------- cuenta ----------
  async adoptUser(user) {
    this.set({ user: { id: user.id, email: user.email, name: user.user_metadata?.name || '' }, sync: 'sincronizando' });
    try {
      const p = await loadProfile(user.id);
      const remote = p?.settings || {};
      if (Object.keys(remote).length) {
        // la nube manda: es lo último que guardaste en cualquier dispositivo
        const tracks = remote.tracks?.map((t, i) => ({ ...DEFAULTS.tracks[i], ...t })) || this.s.tracks;
        Object.assign(this.s, remote, { tracks, onboarded: true });
        this.ko.internalBpm = this.s.bpm; this.ko.clockOut = this.s.clockOut; this.ko.latency = this.s.latency;
        kvSet('settings', this.snapshot());
      } else {
        this.s.onboarded = true; await saveProfile(user.id, { settings: this.snapshot(), alias: this.s.alias || p?.alias || null });
      }
      this.set({ alias: this.s.alias || p?.alias || '', ...this.planFrom(p), sync: 'sincronizado' });
      await this.refreshTakes();
    } catch (e) { console.warn('perfil', e); this.set({ sync: 'error' }); }
  }
  async pushCloud() {
    if (!this.s.user) return;
    this.set({ sync: 'sincronizando' });
    try { await saveProfile(this.s.user.id, { settings: this.snapshot(), alias: this.s.alias || null }); this.set({ sync: 'sincronizado' }); }
    catch (e) { console.warn('sincronizar', e); this.set({ sync: 'error' }); }
  }
  async logout() { await signOut(); this.set({ user: null, ...NO_PLAN, sync: 'local' }); await this.refreshTakes(); }
  // ---------- plan ----------
  planFrom(p) {
    const trialEnds = p?.trial_ends_at ? new Date(p.trial_ends_at).getTime() : null, planBase = p?.plan || 'free';
    const plan = planBase === 'pro' || (trialEnds && trialEnds > Date.now()) ? 'pro' : 'free';
    clearTimeout(this._trialT);
    if (planBase !== 'pro' && trialEnds && trialEnds > Date.now()) this._trialT = setTimeout(() => this.set(this.planFrom(p)), Math.min(trialEnds - Date.now() + 1000, 2 ** 31 - 1));
    return { plan, planBase, trialEnds, trialUsed: !!p?.trial_used };
  }
  get onTrial() { return this.s.planBase !== 'pro' && this.s.plan === 'pro'; }
  get canTrial() { return !!this.s.user && !this.s.trialUsed && this.s.planBase !== 'pro'; }
  can(feature) { return this.s.plan === 'pro' || !PRO_FEATURES[feature]; }
  async startTrial() {
    const end = await startTrialCloud();
    this.set(this.planFrom({ plan: this.s.planBase, trial_ends_at: new Date(end).toISOString(), trial_used: true }));
    await this.refreshTakes();
  }
  setInput(k, v) { this.set({ inputs: { ...this.s.inputs, [k]: v } }, true); }
  setTrack(id, patch) { this.set({ tracks: this.s.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }, true); }
  track(id = this.s.selTrack) { return this.s.tracks.find((t) => t.id === id); }
  pads(track) { return this.D.modos[track.sense].pads; }
  audible(t) { const solo = this.s.tracks.some((x) => x.solo); return solo ? t.solo : !t.mute; }
  // ---------- dispositivo ----------
  async connect(silent = false) {
    try { await this.ko.connect(); } catch (e) { if (!silent) this.set({ ko: { input: null, output: null, error: e.message } }); }
  }
  setBpm(b) { const bpm = Math.max(40, Math.min(240, Math.round(b))); this.ko.internalBpm = bpm; this.set({ bpm }, true); }
  setClockOut(v) { this.ko.clockOut = v; this.set({ clockOut: v }, true); }
  setLatency(v) { this.ko.latency = v; this.set({ latency: v }, true); }
  get monitorOn() { return this.s.monitor === 'siempre' || (this.s.monitor === 'auto' && !this.ko.connected); }
  // ---------- transporte ----------
  play() { this.synth.ensure(); this.sim.reset(); this.live.step = 0; this.s.row = 0; this.ko.start(); this.set({ playing: true }); }
  stop() { this.ko.stop(); if (this.s.rec) this.toggleRec(); this.set({ playing: false }); }
  toggle() { this.s.playing ? this.stop() : this.play(); }
  // ---------- un paso de semicorchea ----------
  rates() {
    const r = { ...this.s.inputs };
    if (this.s.oidoSource !== 'manual' && this.ear.kind) { const L = this.ear.read(); r.jon_ce = L[0] * 200; r.jon_f = L[1] * 200; r.jon_dm = L[2] * 200; this.live.ear = L; }
    if (this.s.data && Object.keys(this.s.dataMap).length && this.can('datos')) {
      for (const [sense, ci] of Object.entries(this.s.dataMap)) if (ci !== '' && ci != null) r[sense] = this.s.data.cols[ci].norm[this.s.row] * 200;
    }
    // las pistas silenciadas no reciben estímulo de su sentido: así no ensucian el cerebro
    for (const t of this.s.tracks) if (!this.audible(t)) for (const k of SENSES[t.sense]) r[k] = 0;
    return r;
  }
  step(n, at) {
    const s = this.s, D = this.D, L = this.live, stepMs = this.ko.stepMs;
    if (s.data && n > 0 && n % s.perRow === 0) { s.row = (s.row + 1) % s.data.rows; queueMicrotask(() => this.emit()); }
    const R = this.rates(); L.lastRates = R;
    const cnt = this.sim.advance(s.density, R); L.counts = cnt;
    let active = 0; for (let i = 0; i < cnt.length; i++) if (cnt[i]) active++;
    L.active = active; L.hist.push(active); L.hist.shift(); L.step = n; L.stepAt = at;
    const pos = n % 16, swingMs = pos % 2 ? ((s.swing - 50) / 50) * stepMs : 0, curve = CURVES[s.curve];
    for (const t of s.tracks) {
      const pads = D.modos[t.sense].pads, lanes = L.lanes[t.id], rate = L.rate[t.id], on = this.audible(t);
      pads.forEach((p, k) => {
        const c = cnt[p.idx]; rate[k] = rate[k] * 0.9 + 0.1 * (c / (s.density / 1000));
        lanes[k][pos] = 0; L.rateHist[t.id][k][n % HIST] = rate[k]; L.spikes[t.id][k][n % HIST] = c;
        if (!c || !on) return;
        const x = Math.min(1, c / 3), ghost = s.ghost && p.inhibidora ? 0.6 : 1;
        const vel = Math.round((s.velMin + (s.velMax - s.velMin) * curve(x)) * ghost * t.level);
        const when = at + swingMs + (Math.random() * 2 - 1) * s.humanize;
        const off = t.map[k], note = GROUP_BASE[t.group] + off;
        lanes[k][pos] = vel;
        if (s.sendMidi && this.ko.connected) this.ko.hit(note, vel, t.ch, 60, when);
        if (this.monitorOn) this.synth.play(t.kit[off], vel, when, t.id === 'oido' ? 3 : 0);
        L.lastHitAt[t.id + k] = when;
        if (this.rec) this.rec.events.push({ t: when - this.rec.t0, step: n - this.rec.n0, track: t.id, pad: k, neuron: p.tipo, note, vel, ch: t.ch, voice: t.kit[off] });
      });
    }
    L.mn9 = L.mn9 * 0.9 + 0.1 * (cnt[D.mn9] / (s.density / 1000));
    const g = D.modos.oido.pads[11].idx; L.groom = L.groom * 0.9 + 0.1 * (cnt[g] / (s.density / 1000));
    if (s.fxAuto && this.ko.connected && n % 2 === 0) { this.ko.cc(12, Math.min(127, L.mn9 * 1.4)); this.ko.cc(13, Math.min(127, active * 2)); }
    if (s.data) L.rowHist[s.row] = L.mn9;
    this.stepListeners.forEach((f) => f(n, cnt));
  }
  // pad del K.O. II → estimula su neurona (como optogenética)
  onKoNote({ note }) {
    for (const t of this.s.tracks) {
      const base = GROUP_BASE[t.group]; if (note < base || note > base + 11) continue;
      const k = t.map.indexOf(note - base); if (k < 0) continue;
      this.sim.g[this.pads(t)[k].idx] += this.D.params.w_poi * 2;
    }
  }
  tapPad(k, track = this.track()) {
    this.sim.g[this.pads(track)[k].idx] += this.D.params.w_poi * 2;
    const off = track.map[k]; this.synth.ensure();
    if (this.s.sendMidi && this.ko.connected) this.ko.hit(GROUP_BASE[track.group] + off, 110, track.ch);
    else this.synth.play(track.kit[off], 110);
  }
  // ---------- mutar ----------
  mutateTrack(id = this.s.selTrack) {
    const t = this.track(id), hist = this.s.mutHistory[id] || [];
    const map = mutate(this.pads(t), t.kit, this.D.mn9, Date.now());
    this.set({ mutHistory: { ...this.s.mutHistory, [id]: [...hist, t.map].slice(-20) } });
    this.setTrack(id, { map });
  }
  undoMutate(id = this.s.selTrack) {
    const hist = this.s.mutHistory[id] || []; if (!hist.length) return;
    this.setTrack(id, { map: hist[hist.length - 1] }); this.set({ mutHistory: { ...this.s.mutHistory, [id]: hist.slice(0, -1) } });
  }
  // ---------- grabación ----------
  // ---------- tomas: navegador + nube ----------
  // Cada toma local lleva owner (id de la cuenta que la creó, o null si se grabó sin cuenta) y cloud (ya subida).
  // Con sesión: se suben las locales pendientes, se listan las de la nube y se descargan sus notas al abrirlas.
  get takesLimitReached() { return this.s.plan !== 'pro' && this.s.takes.length >= FREE_TAKES; }
  async refreshTakes() {
    const uid = this.s.user?.id, local = await takesAll();
    if (!uid) { this.set({ takes: local.filter((t) => !t.owner).map((t) => ({ ...t, where: 'local' })) }); return; }
    let remote = [];
    try { remote = await listTakes(); } catch (e) { console.warn('tomas', e); this.set({ takes: local.filter((t) => !t.owner || t.owner === uid).map((t) => ({ ...t, where: t.cloud ? 'nube' : 'local' })), sync: 'error' }); return; }
    const remoteIds = new Set(remote.map((t) => t.id)); let blocked = false;
    for (const t of local) {
      if (t.owner && t.owner !== uid) continue;
      if (remoteIds.has(t.id)) { if (!t.cloud || !t.owner) await takePut({ ...t, owner: uid, cloud: true }); continue; }
      if (t.cloud && t.owner === uid) { await takeDel(t.id); continue; } // se borró en otro dispositivo
      if (blocked) continue;
      const r = await uploadTake(t).catch((e) => { console.warn('subir toma', e); return 'error'; });
      if (r === 'ok' || r === 'existe') { await takePut({ ...t, owner: uid, cloud: true }); remote.unshift({ ...t, nEvents: t.events.length }); }
      if (r === 'limite') blocked = true;
    }
    const byId = new Map((await takesAll()).map((t) => [t.id, t]));
    const merged = remote.map((r) => { const l = byId.get(r.id); return { ...r, events: l?.events || null, nEvents: r.nEvents ?? l?.events?.length ?? 0, where: 'nube' }; });
    for (const t of byId.values()) if ((!t.owner || t.owner === uid) && !remoteIds.has(t.id) && !merged.some((m) => m.id === t.id)) merged.push({ ...t, where: 'local' });
    merged.sort((a, b) => b.date - a.date);
    this.set({ takes: merged, ...(blocked ? { notice: 'limite' } : {}) });
  }
  // notas de una toma que solo está en la nube
  async ensureEvents(id) {
    const t = this.s.takes.find((x) => x.id === id); if (!t || t.events) return t;
    const full = await getTake(id); await takePut({ ...full, owner: this.s.user?.id || null, cloud: true });
    this.set({ takes: this.s.takes.map((x) => (x.id === id ? { ...x, events: full.events } : x)) });
    return { ...t, events: full.events };
  }
  toggleRec() {
    if (this.rec) {
      const r = this.rec; this.rec = null;
      const durMs = performance.now() - r.t0;
      if (r.events.length) {
        const n = this.s.takes.length + 1;
        const take = { id: crypto.randomUUID(), name: `Toma ${n}`, date: Date.now(), bpm: Math.round(this.ko.bpm), durMs, steps: this.live.step - r.n0,
          tracks: this.s.tracks.filter((t) => r.events.some((e) => e.track === t.id)).map(({ id, name, group, ch, sense }) => ({ id, name, group, ch, sense })),
          inputs: { ...this.s.inputs }, source: this.s.data ? 'datos' : this.s.oidoSource, events: r.events };
        take.owner = this.s.user?.id || null; take.cloud = false;
        takePut(take).then(async () => { this.set({ lastTake: take.id }); await this.refreshTakes(); });
      }
      this.set({ rec: false }); return;
    }
    if (this.takesLimitReached) { this.set({ notice: 'limite' }); return; }
    if (!this.s.playing) this.play();
    this.rec = { t0: performance.now(), n0: this.live.step, events: [] }; this.set({ rec: true });
  }
  async renameTake(id, name) {
    const t = this.s.takes.find((x) => x.id === id); if (!t) return;
    if (t.where === 'nube') await renameTakeCloud(id, name).catch((e) => console.warn(e));
    const local = (await takesAll()).find((x) => x.id === id); if (local) await takePut({ ...local, name });
    this.set({ takes: this.s.takes.map((x) => (x.id === id ? { ...x, name } : x)) });
  }
  async deleteTake(id) {
    const t = this.s.takes.find((x) => x.id === id);
    if (t?.where === 'nube') await deleteTakeCloud(id).catch((e) => console.warn(e));
    await takeDel(id); this.set({ takes: this.s.takes.filter((x) => x.id !== id) });
  }
  // reproducir una toma: re-envía notas al K.O. y/o voces internas
  playTake(take, onEnd) {
    this.stopTake(); this.synth.ensure();
    const t0 = performance.now() + 60, timers = [];
    for (const e of take.events) {
      timers.push(setTimeout(() => {
        const at = t0 + e.t;
        if (this.s.sendMidi && this.ko.connected) this.ko.hit(e.note, e.vel, e.ch, 60, at);
        if (this.monitorOn) this.synth.play(e.voice, e.vel, at, e.track === 'oido' ? 3 : 0);
      }, Math.max(0, e.t - 40)));
    }
    timers.push(setTimeout(() => { this.takeTimers = null; onEnd?.(); }, take.durMs + 100));
    this.takeTimers = timers; this.takeT0 = t0;
  }
  stopTake() { (this.takeTimers || []).forEach(clearTimeout); this.takeTimers = null; }
}

export const session = new Session();
