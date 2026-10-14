// Fly Punch · motor de la sesión: un cerebro, varias pistas, reloj, grabación y salida MIDI / audio interno.
import { Circuit } from './sim.js';
import { KO2 } from './midi.js';
import { profileById, route } from './devices.js';
import { Ear } from './ear.js';
import { Synth, DEFAULT_KIT, FX_DEFAULT } from './synth.js';
import { mutate, identity } from './mutate.js';
import { kvGet, kvSet, takePut, takesAll, takeDel, FREE_TAKES, sampleGet, samplePut, sampleDel } from './storage.js';
import { VOICES as KIT_VOICES, kitData, toBuffers } from './kits.js';
import { SLOTS, FREE_SLOTS, snapshot, applyScene, morphRates, onBar, exampleSong } from './song.js';
import { handleMidi, FREE_MAPPINGS } from './controls.js';
import { Capture } from './capture.js';
import { audioPut, audioGet, audioDel, dbOk } from './storage.js';
import { SK_PRESET, skPorts, skSend } from './sidekick.js';
import { Follower } from './follow.js';
import { SCALES } from './devices.js';
import { cloudEnabled, currentUser, onAuth, loadProfile, saveProfile, signOut, startTrialCloud, listTakes, getTake, uploadTake, renameTakeCloud, deleteTakeCloud } from './cloud.js';

// ajustes que se guardan en el navegador y, con cuenta, en la nube
const KEEP = ['bpm', 'sessionName', 'theme', 'guide', 'onboarded', 'alias', 'inputs', 'tracks', 'selTrack', 'selPad', 'density', 'swing', 'humanize', 'curve', 'velMin', 'velMax', 'ghost', 'sendMidi', 'clockOut', 'fxAuto', 'monitor', 'latency', 'oidoSource', 'perRow', 'device', 'port', 'devOverrides', 'kitId', 'scenes', 'song', 'songLoop', 'morph', 'mappings', 'audioIn', 'captureAudio', 'kitVol', 'sk', 'follow', 'fx'];

export const SENSES = { gusto: ['dulce', 'amargo'], oido: ['jon_ce', 'jon_f', 'jon_dm'] };
export const SENSE_LABEL = { dulce: 'Dulce', amargo: 'Amargo', jon_ce: 'Graves', jon_f: 'Medios', jon_dm: 'Agudos' };
export const HIST = 128;
// Qué abre Pro. El servidor aplica lo que importa (límite de tomas); la app solo muestra y bloquea la interfaz.
export const PRO_FEATURES = {
  datos: 'Modo Datos: tus CSV estimulan los sentidos',
  wav: 'Exportar tomas a WAV',
  tomas: 'Tomas ilimitadas en la nube',
  melodia: 'Modo melódico: escalas, bajo y melodía',
  kits: 'Librería completa de kits y tus propias muestras',
  cancion: 'Modo canción y 8 escenas',
  multi: 'Un aparato distinto por pista (p. ej. dos K.O. II)',
  audio: 'Grabar el audio real de tu interfaz con cada toma',
  controles: 'Controles MIDI ilimitados (sidekick y cualquier controlador)',
};
const NO_PLAN = { plan: 'free', planBase: 'free', trialEnds: null, trialUsed: false };
const CURVES = { lineal: (x) => x, suave: (x) => Math.sqrt(x), dura: (x) => x * x };

const DEFAULTS = {
  bpm: 110, sessionName: 'Sesión sin título', theme: 'noche', guide: true, onboarded: false, alias: '',
  inputs: { dulce: 150, amargo: 40, jon_ce: 0, jon_f: 0, jon_dm: 0 },
  tracks: [
    { id: 'gusto', name: 'Gusto', sense: 'gusto', group: 'C', ch: 1, mute: false, solo: false, level: 1, map: identity(), kit: [...DEFAULT_KIT], mode: 'ritmo', scale: 'menor_pent', root: 48, dest: 'auto', kitId: null, rev: 0.12, dly: 0, play: 'vivo', frozen: null },
    { id: 'oido', name: 'Oído', sense: 'oido', group: 'A', ch: 1, mute: true, solo: false, level: 0.85, map: identity(), kit: [...DEFAULT_KIT], mode: 'ritmo', scale: 'menor_pent', root: 60, dest: 'auto', kitId: null, rev: 0.2, dly: 0.1, play: 'vivo', frozen: null },
  ],
  selTrack: 'gusto', selPad: 11,
  density: 4, swing: 54, humanize: 4, curve: 'suave', velMin: 70, velMax: 127, ghost: true,
  sendMidi: true, clockOut: false, fxAuto: false, monitor: 'auto', latency: 0,
  device: 'ko2', port: null, devOverrides: {}, kitId: 'analogo',
  scenes: {}, song: [], songLoop: true, morph: true,
  mappings: [], audioIn: null, captureAudio: false, kitVol: 0.7,
  sk: { follow: false, fxAuto: false, fx: [0, 1] },
  fx: { ...FX_DEFAULT },
  follow: { source: 'entrada', tempo: true, key: true, autoPlay: true, offset: 0 },
  oidoSource: 'manual', dataMap: {}, perRow: 16,
};

export class Session {
  constructor() {
    this.listeners = new Set(); this.stepListeners = new Set();
    this.s = structuredClone(DEFAULTS);
    this.s.playing = false; this.s.rec = false; this.s.ko = { input: null, output: null, error: null };
    this.s.takes = []; this.s.ready = false; this.s.user = null; Object.assign(this.s, NO_PLAN); this.s.sync = cloudEnabled ? 'local' : 'off'; this.s.mutHistory = {}; this.s.data = null; this.s.row = 0; this.s.saved = Date.now();
    this.live = { step: 0, pos: 0, active: 0, mn9: 0, groom: 0, rate: {}, lanes: {}, hist: new Array(64).fill(0), counts: null, lastHitAt: {}, rowHist: [], rateHist: {}, spikes: {}, meter: {} };
    if (typeof window !== 'undefined') { addEventListener('pagehide', () => this.flush()); document.addEventListener('visibilitychange', () => document.hidden && this.flush()); }
    this.rec = null; this.ear = new Ear(); this.synth = new Synth(); this.capture = new Capture();
    this.ko = new KO2({
      onStep: (n, at) => this.step(n, at),
      onStart: () => { if (!this.s.playing) this.play(); },
      onStop: () => { if (this.s.playing) this.stop(); },
      onNote: (m) => this.onKoNote(m),
      onRaw: (m) => { this.live.lastRaw = { ...m, at: performance.now() }; },
      onAny: (m) => { this._midiAt = performance.now(); this.live.lastMsg = { ...m, at: performance.now() }; handleMidi(this, m); },
      onState: (st) => this.set({ ko: { ...st, error: null } }),
    });
  }
  async load() {
    try { await this.loadCore(); } catch (e) { console.error('Fly Punch no pudo cargar el cerebro', e); this.set({ loadError: String(e?.message || e) }); }
  }
  async loadCore() {
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
    // 1) Lo local (ajustes y tomas de este navegador): rápido, con su propio límite. 2) La cuenta, después y sin bloquear:
    // si Supabase tarda en despertar, la app ya está usable y solo el indicador de sincronía espera.
    const restoreLocal = async () => {
      if (!(await dbOk())) throw new Error('indexeddb no disponible');
      const saved = await kvGet('settings');
      if (saved) Object.assign(this.s, { ...saved, tracks: saved.tracks?.map((t, i) => ({ ...DEFAULTS.tracks[i], ...t })) || this.s.tracks });
      this.ko.internalBpm = this.s.bpm; this.ko.clockOut = this.s.clockOut; this.ko.latency = this.s.latency;
      await this.refreshTakes();
    };
    try { await Promise.race([restoreLocal(), new Promise((_, rej) => setTimeout(() => rej(new Error('guardado local lento')), 5000))]); }
    catch (e) { console.warn('Fly Punch arrancó sin restaurar todo:', e); this.s.notice = 'restauracion'; }
    this.s.ready = true; this.emit();
    try { this.loadKit(); } catch (e) { console.warn('kit', e); }
    if (cloudEnabled) {
      (async () => {
        try { const u = await currentUser(); if (u) await this.adoptUser(u); } catch (e) { console.warn('cuenta', e); if (this.s.user) this.set({ sync: 'error' }); }
        onAuth((u) => { if (u && u.id !== this.s.user?.id) this.adoptUser(u); if (!u && this.s.user) { this.set({ user: null, ...NO_PLAN, sync: 'local' }); this.refreshTakes(); } });
      })();
    }
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
  // si cierras o recargas antes de que pase el retraso, se guarda igual
  flush() { if (this._pt) { clearTimeout(this._pt); this._pt = null; kvSet('settings', this.snapshot()); } }
  snapshot() { return Object.fromEntries(KEEP.map((k) => [k, this.s[k]])); }
  persist() {
    clearTimeout(this._pt);
    this._pt = setTimeout(() => { this._pt = null; kvSet('settings', this.snapshot()); this.set({ saved: Date.now() }); }, 400);
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
      this.loadKit();
      await this.refreshTakes();
    } catch (e) { console.warn('perfil', e); this.set({ sync: 'error' }); }
  }
  async pushCloud() {
    if (!this.s.user) return;
    this.set({ sync: 'sincronizando' });
    try { await saveProfile(this.s.user.id, { settings: this.snapshot(), alias: this.s.alias || null }); this.set({ sync: 'sincronizado' }); }
    catch (e) { console.warn('sincronizar', e); this.set({ sync: 'error' }); }
  }
  async logout() { await signOut(); this.set({ user: null, ...NO_PLAN, sync: 'local' }); this.loadKit(); await this.refreshTakes(); }
  // ---------- controles aprendidos ----------
  get mappingsFull() { return !this.can('controles') && this.s.mappings.length >= FREE_MAPPINGS; }
  learn(target) { if (this.mappingsFull && !this.s.mappings.some((m) => m.target === target)) { location.hash = '#/cuenta?plan'; return; } if (!this.ko.access) this.connect(); this.set({ learn: this.s.learn === target ? null : target }); }
  // ---------- sidekick (EP-136) ----------
  get sidekick() { return skPorts(this.ko, this.s.sk?.outPort); }
  applySkPreset() {
    const port = this.sidekick.input?.name, n = this.can('controles') ? SK_PRESET.length : FREE_MAPPINGS;
    const pick = SK_PRESET.slice(0, n), targets = new Set(pick.map((x) => x.target));
    const keep = this.s.mappings.filter((m) => !targets.has(m.target) && !pick.some((x) => x.src.ch === m.src.ch && x.src.num === m.src.num && m.src.type === 'cc'));
    this.set({ mappings: [...(this.can('controles') ? keep : []), ...pick.map((x) => ({ target: x.target, src: { ...x.src, port } }))], learn: null }, true);
    return pick.length;
  }
  setSk(patch) {
    const sk = { ...this.s.sk, ...patch }; this.set({ sk }, true);
    const out = this.sidekick.output;
    if (patch.fx) sk.fx.forEach((i, k) => skSend.fxType(out, k + 1, i));
    if (patch.follow) this.s.tracks.slice(0, 2).forEach((t, k) => skSend.fader(out, k + 1, t.level));
    if (patch.fxAuto === false) [1, 2].forEach((k) => skSend.fxAmount(out, k, 0));
  }
  skFollow(t) { // la mezcla de Fly Punch mueve el fader de la tira del sidekick (sin eco si el cambio vino del propio sidekick)
    if (!this.s.sk?.follow || !this.can('controles') || performance.now() - (this._midiAt || 0) < 40) return;
    const k = this.s.tracks.findIndex((x) => x.id === t.id); if (k < 0 || k > 1) return;
    skSend.fader(this.sidekick.output, k + 1, t.level);
  }
  // ---------- acompañar: seguir el tempo, los golpes y el tono de una canción ----------
  get follower() { return (this._fol ||= new Follower((st) => this.onFollow(st))); }
  async startFollow(source, opt = {}) {
    const f = { ...DEFAULTS.follow, ...this.s.follow, source }; this.set({ follow: f }, true); this._folPlayed = false;
    try { await this.follower.start(this.synth.ensure(), source, { deviceId: this.s.audioIn, ...opt }); }
    catch (e) { console.warn('acompañar', e); this.live.follow = { ...this.follower.state, on: false, error: e?.name === 'NotAllowedError' ? 'permiso' : e?.message === 'sin-audio' ? 'sin-audio' : 'error' }; this.emit(); }
  }
  stopFollow() { this._fol?.stop(); this.live.follow = { ...(this._fol?.state || {}), on: false }; this.emit(); }
  setFollow(patch) { this.set({ follow: { ...DEFAULTS.follow, ...this.s.follow, ...patch } }, true); }
  get followLocked() { const st = this.live.follow; return !!(st?.on && st.bpm && st.conf > 0.22 && st.secs >= 5); }
  onFollow(st) {
    this.live.follow = { ...st }; const f = { ...DEFAULTS.follow, ...this.s.follow };
    if (this.followLocked) {
      if (f.tempo && !this.ko.hasExternalClock) {
        this.ko.internalBpm = st.bpm; if (Math.round(st.bpm) !== this.s.bpm) { this.s.bpm = Math.round(st.bpm); if (this.synth.chain) this.synth.setFx(this.s.fx, st.bpm); }
        if (f.autoPlay && !this.s.playing && !this._folPlayed) { this._folPlayed = true; this.play(); }
        this.followPhase(st.beatAt + (f.offset || 0), st.periodMs);
      }
      if (f.key && st.key && st.keyConf > 0.35 && this.can('melodia')) {
        const scale = st.key.mode === 'menor' ? 'menor_pent' : 'mayor_pent', base = { gusto: 48, oido: 60 };
        const tracks = this.s.tracks.map((t) => { if (t.mode !== 'melodia' || !SCALES[scale]) return t; const root = (base[t.id] ?? 48) + st.key.root; return t.root === root && t.scale === scale ? t : { ...t, root, scale }; });
        if (tracks.some((t, i) => t !== this.s.tracks[i])) this.s.tracks = tracks;
      }
    }
    this.emit();
  }
  // corre la rejilla de pasos para que cada 4 pasos (un tiempo) caiga en el golpe de la canción, poco a poco
  followPhase(beatAt, periodMs) {
    const ko = this.ko; if (!this.s.playing || !ko.timer || ko.hasExternalClock || !beatAt || !periodMs) return;
    const dur = ko.stepMs, m = (4 - (ko.step % 4)) % 4, tStep = ko.nextAt + m * dur;
    const err = ((((beatAt - tStep) % periodMs) + periodMs * 1.5) % periodMs) - periodMs / 2;
    ko.nextAt += Math.max(-dur * 0.5, Math.min(dur * 0.5, err * 0.35)); this.live.followErr = err;
  }
  unmap(target) { this.set({ mappings: this.s.mappings.filter((m) => m.target !== target) }, true); }
  getAudio(id) { return audioGet(id); }
  // ---------- escenas y canción ----------
  slotAllowed(slot) { return SLOTS.indexOf(slot) < FREE_SLOTS || this.can('cancion'); }
  saveScene(slot, name) {
    if (!this.slotAllowed(slot)) { location.hash = '#/cuenta?plan'; return; }
    const prev = this.s.scenes[slot];
    this.set({ scenes: { ...this.s.scenes, [slot]: { name: name || prev?.name || `Escena ${slot}`, data: snapshot(this.s) } }, sceneNow: slot }, true);
  }
  deleteScene(slot) { const sc = { ...this.s.scenes }; delete sc[slot]; this.set({ scenes: sc, song: this.s.song.filter((r) => r.scene !== slot) }, true); }
  renameScene(slot, name) { const sc = this.s.scenes[slot]; if (sc) this.set({ scenes: { ...this.s.scenes, [slot]: { ...sc, name } } }, true); }
  // se aplica al inicio del siguiente compás si está tocando; si no, de inmediato
  launchScene(slot) { if (!this.s.scenes[slot]) return; if (this.s.playing) this.set({ pendingScene: slot }); else applyScene(this, slot, { morph: false }); }
  setSong(song) { this.set({ song }, true); }
  // siguiente casilla libre que tu plan permite (o null)
  get freeSlot() { return SLOTS.find((x) => !this.s.scenes[x] && this.slotAllowed(x)) || null; }
  makeExampleSong() {
    if (!this.can('cancion')) { location.hash = '#/cuenta?plan'; return; }
    const { scenes, song } = exampleSong(this.s);
    this.set({ scenes: { ...this.s.scenes, ...scenes }, song }, true);
  }
  startSong() {
    if (!this.can('cancion')) { location.hash = '#/cuenta?plan'; return; }
    const rows = this.s.song.filter((r) => this.s.scenes[r.scene]); if (!rows.length) return;
    this.songPos = { row: 0, bars: this.s.playing ? -1 : 0 }; applyScene(this, rows[0].scene, { morph: false });
    this.set({ songOn: true }); if (!this.s.playing) this.play();
  }
  stopSong() { this.songPos = null; this.set({ songOn: false }); }
  // ---------- librería de sonidos ----------
  // 'propio' = Mi kit: base Análogo + las muestras que subas por sonido (se guardan en este navegador)
  kitAllowed(id) { return id === 'analogo' || this.can('kits'); }
  async loadKit() {
    const want = this.kitAllowed(this.s.kitId) ? this.s.kitId : 'analogo', ctx = this.synth.ensure();
    if (this.synth.out) this.synth.out.gain.value = this.s.kitVol ?? 0.7;
    const build = async (id) => {
      const base = { ...kitData(id === 'propio' ? 'analogo' : id) }, custom = {};
      if (id === 'propio') for (const v of KIT_VOICES) {
        const smp = await sampleGet(v); if (!smp) continue;
        try { base[v] = await ctx.decodeAudioData(smp.data.slice(0)); custom[v] = smp.name; } catch (e) { console.warn('muestra', v, e); }
      }
      return { buffers: toBuffers(ctx, base), custom };
    };
    const g = await build(want); this.synth.kit = g.buffers; this.synth.kits = { [want]: g.buffers };
    // kit propio de cada pista (Pro); si no, la pista usa el kit general
    for (const t of this.s.tracks) {
      const id = t.kitId && this.kitAllowed(t.kitId) && this.can('kits') ? t.kitId : want;
      if (!this.synth.kits[id]) this.synth.kits[id] = (await build(id)).buffers;
      this.synth.trackKit[t.id] = id; this.synth.setSends(t.id, { rev: t.rev ?? 0, dly: t.dly ?? 0 });
    }
    this.synth.setFx(this.s.fx, this.ko.internalBpm || this.s.bpm);
    this.set({ kitActive: want, customSamples: g.custom });
  }
  setTrackKit(tid, id) { if (id && !this.can('kits')) { location.hash = '#/cuenta?plan'; return; } this.setTrack(tid, { kitId: id || null }); this.loadKit(); }
  setFx(patch) { const fx = { ...FX_DEFAULT, ...this.s.fx, ...patch }; this.set({ fx }, true); this.synth.setFx(fx, this.ko.internalBpm || this.s.bpm); }
  get wavOptions() { return { fx: this.s.fx, bpm: this.ko.internalBpm || this.s.bpm, sends: Object.fromEntries(this.s.tracks.map((t) => [t.id, { rev: t.rev ?? 0, dly: t.dly ?? 0 }])), kits: this.synth.kits, trackKit: this.synth.trackKit }; }
  // ---------- congelar: el compás que te gustó queda como patrón editable ----------
  freeze(tid = this.s.selTrack) {
    const t = this.track(tid), lanes = this.live.lanes[tid]; if (!t || !lanes) return false;
    const frozen = lanes.map((row) => Array.from(row, (v) => Math.min(127, Math.round(v / (t.level || 1)))));
    if (!frozen.some((r) => r.some(Boolean))) return false;
    this.setTrack(tid, { frozen, play: t.play === 'ambos' ? 'ambos' : 'congelado' }); return true;
  }
  toggleStep(tid, k, pos) {
    const t = this.track(tid), frozen = (t.frozen || Array.from({ length: 12 }, () => new Array(16).fill(0))).map((r) => [...r]);
    frozen[k][pos] = frozen[k][pos] ? 0 : 100; this.setTrack(tid, { frozen, play: t.play === 'vivo' ? 'congelado' : t.play });
  }

  setKit(id) { if (!this.kitAllowed(id)) { location.hash = '#/cuenta?plan'; return; } this.set({ kitId: id }, true); this.loadKit(); }
  async addSample(voice, file) {
    if (!this.can('kits')) throw new Error('pro');
    if (file.size > 4 * 1024 * 1024) throw new Error('grande');
    const data = await file.arrayBuffer(); await this.synth.ensure().decodeAudioData(data.slice(0)); // valida que sea audio
    await samplePut(voice, { name: file.name, data }); if (this.s.kitId !== 'propio') this.set({ kitId: 'propio' }, true); await this.loadKit();
  }
  async removeSample(voice) { await sampleDel(voice); await this.loadKit(); }
  // ---------- plan ----------
  planFrom(p) {
    const trialEnds = p?.trial_ends_at ? new Date(p.trial_ends_at).getTime() : null, planBase = p?.plan || 'free';
    const plan = planBase === 'pro' || (trialEnds && trialEnds > Date.now()) ? 'pro' : 'free';
    clearTimeout(this._trialT);
    if (planBase !== 'pro' && trialEnds && trialEnds > Date.now()) this._trialT = setTimeout(() => { this.set(this.planFrom(p)); this.loadKit(); }, Math.min(trialEnds - Date.now() + 1000, 2 ** 31 - 1));
    return { plan, planBase, trialEnds, trialUsed: !!p?.trial_used };
  }
  get onTrial() { return this.s.planBase !== 'pro' && this.s.plan === 'pro'; }
  get canTrial() { return !!this.s.user && !this.s.trialUsed && this.s.planBase !== 'pro'; }
  can(feature) { return this.s.plan === 'pro' || !PRO_FEATURES[feature]; }
  async startTrial() {
    const end = await startTrialCloud();
    this.set(this.planFrom({ plan: this.s.planBase, trial_ends_at: new Date(end).toISOString(), trial_used: true }));
    this.loadKit();
    await this.refreshTakes();
  }
  setInput(k, v) { this.set({ inputs: { ...this.s.inputs, [k]: v } }, true); }
  setTrack(id, patch) { this.set({ tracks: this.s.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }, true); if ('level' in patch) this.skFollow(this.track(id)); if ('rev' in patch || 'dly' in patch) { const t = this.track(id); this.synth.setSends(id, { rev: t.rev ?? 0, dly: t.dly ?? 0 }); } }
  track(id = this.s.selTrack) { return this.s.tracks.find((t) => t.id === id); }
  pads(track) { return this.D.modos[track.sense].pads; }
  audible(t) { const solo = this.s.tracks.some((x) => x.solo); return solo ? t.solo : !t.mute; }
  // ---------- dispositivo ----------
  get profile() { return profileById(this.s.device); }
  get devOverride() { return this.s.devOverrides[this.s.device] || {}; }
  wantPort() { const p = this.profile; return p.kind === 'interno' ? { none: true } : this.s.port ? { port: this.s.port } : { match: p.match }; }
  async connect(silent = false) {
    this.ko.want = this.wantPort();
    try { await this.ko.connect(); } catch (e) { if (!silent) this.set({ ko: { input: null, output: null, error: e.message } }); }
  }
  // cambiar de dispositivo o de puerto
  chooseDevice(id, port = null) { this.set({ device: id, port }, true); this.ko.bind(this.wantPort()); if (!this.ko.access && id !== 'interno') this.connect(); }
  setDevOverride(patch) { this.set({ devOverrides: { ...this.s.devOverrides, [this.s.device]: { ...this.devOverride, ...patch } } }, true); }
  // salida por pista (Pro): cada pista puede ir a otro perfil y puerto; si no, la del Equipo principal
  profileFor(t) { return t.out?.device && this.can('multi') ? profileById(t.out.device) : this.profile; }
  portFor(t) { if (t.out?.port && this.can('multi')) return this.ko.outPort(t.out.port); return this.profileFor(t).kind === 'interno' ? null : this.ko.output; }
  route(t, k) {
    const prof = this.profileFor(t), r = route(prof, t, k, this.pads(t), this.s.devOverrides[prof.id] || {});
    // sin Pro, lo melódico no sale por MIDI y suena con la voz de batería del pad
    if (r.voice === 'tono' && !this.can('melodia')) return { note: null, ch: r.ch, voice: t.kit[t.map[k]] };
    return r;
  }
  sound(r, vel, when, t) { if (r.voice === 'tono') this.synth.play('tono', vel, when, r.note, t.id); else this.synth.play(r.voice, vel, when, t.id === 'oido' ? 3 : 0, t.id); }
  setBpm(b) { const bpm = Math.max(40, Math.min(240, Math.round(b))); this.ko.internalBpm = bpm; this.set({ bpm }, true); if (this.synth.chain) this.synth.setFx(this.s.fx, bpm); }
  setClockOut(v) { this.ko.clockOut = v; this.set({ clockOut: v }, true); }
  setLatency(v) { this.ko.latency = v; this.set({ latency: v }, true); }
  // Mezcla: a dónde va cada pista. auto = al aparato si hay, si no a la compu (como siempre); aparato; kit (compu); ambos.
  toDevice(t, port = this.portFor(t)) { return this.s.sendMidi && !!port && (t.dest || 'auto') !== 'kit'; }
  toKit(t, port = this.portFor(t)) { const d = t.dest || 'auto'; return d === 'kit' || d === 'ambos' || (d === 'auto' && this.monitorOn) || (d === 'aparato' && !port && this.s.monitor !== 'nunca'); }
  setKitVol(v) { this.set({ kitVol: v }, true); if (this.synth.out) this.synth.out.gain.value = v; }
  get monitorOn() { return this.s.monitor === 'siempre' || (this.s.monitor === 'auto' && (!this.ko.connected || this.profile.kind === 'interno')); }
  // ---------- transporte ----------
  play() { this.synth.ensure(); this.sim.reset(); this.live.step = 0; this.s.row = 0; this.morphState = null; if (this.s.songOn) this.songPos = { row: 0, bars: 0 }; this.ko.start(); this.set({ playing: true }); }
  stop() { this.ko.stop(); if (this.s.rec) this.toggleRec(); this.morphState = null; this.set({ playing: false, pendingScene: null }); }
  toggle() { this.s.playing ? this.stop() : this.play(); }
  // ---------- un paso de semicorchea ----------
  rates() {
    const r = { ...this.s.inputs };
    if (this.s.oidoSource !== 'manual' && this.ear.kind) { const L = this.ear.read(); r.jon_ce = L[0] * 200; r.jon_f = L[1] * 200; r.jon_dm = L[2] * 200; this.live.ear = L; }
    if (this.s.data && Object.keys(this.s.dataMap).length && this.can('datos')) {
      for (const [sense, ci] of Object.entries(this.s.dataMap)) if (ci !== '' && ci != null) r[sense] = this.s.data.cols[ci].norm[this.s.row] * 200;
    }
    morphRates(this, r, this.live.step);
    // las pistas silenciadas no reciben estímulo de su sentido: así no ensucian el cerebro
    for (const t of this.s.tracks) if (!this.audible(t)) for (const k of SENSES[t.sense]) r[k] = 0;
    return r;
  }
  step(n, at) {
    const s = this.s, D = this.D, L = this.live, stepMs = this.ko.stepMs;
    if (s.data && n > 0 && n % s.perRow === 0) { s.row = (s.row + 1) % s.data.rows; queueMicrotask(() => this.emit()); }
    this.live.step = n; if (n % 16 === 0) onBar(this, n / 16);
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
        // vivo = toca la mosca · congelado = toca el patrón · ambos = el patrón más lo que agregue la mosca
        const mode = t.play || 'vivo', fz = mode !== 'vivo' && t.frozen ? t.frozen[k][pos] : 0;
        let vel = 0;
        if (c && on && mode !== 'congelado') { const x = Math.min(1, c / 3), ghost = s.ghost && p.inhibidora ? 0.6 : 1; vel = Math.round((s.velMin + (s.velMax - s.velMin) * curve(x)) * ghost * t.level); }
        if (fz && on) vel = Math.max(vel, Math.round(fz * t.level));
        if (!vel) return;
        const when = at + swingMs + (Math.random() * 2 - 1) * s.humanize;
        const r = this.route(t, k);
        lanes[k][pos] = vel;
        const port = this.portFor(t);
        if (this.toDevice(t, port) && r.note != null) this.ko.hit(r.note, vel, r.ch, r.voice === 'tono' ? stepMs * 0.9 : 60, when, port);
        if (this.toKit(t, port)) this.sound(r, vel, when, t);
        const mt = L.meter[t.id]; if (!mt || when - mt.at > 60 || vel > mt.vel) L.meter[t.id] = { at: when, vel };
        L.lastHitAt[t.id + k] = when;
        if (this.rec) this.rec.events.push({ t: when - this.rec.t0, step: n - this.rec.n0, track: t.id, pad: k, neuron: p.tipo, note: r.note ?? 0, vel, ch: r.ch, voice: r.voice, port: port?.name });
      });
    }
    L.mn9 = L.mn9 * 0.9 + 0.1 * (cnt[D.mn9] / (s.density / 1000));
    const g = D.modos.oido.pads[11].idx; L.groom = L.groom * 0.9 + 0.1 * (cnt[g] / (s.density / 1000));
    const fx = this.profile.fx;
    if (s.fxAuto && fx && this.ko.connected && n % 2 === 0) { this.ko.cc(fx.x, Math.min(127, L.mn9 * 1.4)); this.ko.cc(fx.y, Math.min(127, active * 2)); }
    if (s.sk?.fxAuto && n % 2 === 0 && this.can('controles')) { // la mosca mueve los efectos del sidekick: MN9 → tira 1, acicalamiento → tira 2
      const out = this.sidekick.output, v = [Math.min(127, L.mn9 * 1.4), Math.min(127, L.groom * 1.4)];
      this._skFx = this._skFx || [-9, -9]; v.forEach((x, k) => { if (Math.abs(x - this._skFx[k]) >= 2) { skSend.fxAmount(out, k + 1, x); this._skFx[k] = x; } });
    }
    if (s.data) L.rowHist[s.row] = L.mn9;
    this.stepListeners.forEach((f) => f(n, cnt));
  }
  // nota que llega del aparato → estimula la neurona que toca esa nota (como optogenética)
  onKoNote({ note }) {
    for (const t of this.s.tracks) for (let k = 0; k < 12; k++) if (this.route(t, k).note === note) this.sim.g[this.pads(t)[k].idx] += this.D.params.w_poi * 2;
  }
  tapPad(k, track = this.track()) {
    this.sim.g[this.pads(track)[k].idx] += this.D.params.w_poi * 2;
    const r = this.route(track, k); this.synth.ensure();
    const port = this.portFor(track);
    const dev = this.toDevice(track, port) && r.note != null;
    if (dev) this.ko.hit(r.note, 110, r.ch, 180, performance.now(), port);
    if (!dev || this.toKit(track, port)) this.sound(r, 110, performance.now(), track);
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
    const merged = remote.map((r) => { const l = byId.get(r.id); return { ...r, events: l?.events || null, hasAudio: !!l?.hasAudio, nEvents: r.nEvents ?? l?.events?.length ?? 0, where: 'nube' }; });
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
      const durMs = performance.now() - r.t0, audioP = this.capture.active ? this.capture.stop() : Promise.resolve(null);
      if (r.events.length) {
        const n = this.s.takes.length + 1;
        const take = { id: crypto.randomUUID(), name: `Toma ${n}`, date: Date.now(), bpm: Math.round(this.ko.bpm), durMs, steps: this.live.step - r.n0,
          tracks: this.s.tracks.filter((t) => r.events.some((e) => e.track === t.id)).map(({ id, name, group, ch, sense }) => ({ id, name, group, ch, sense })),
          inputs: { ...this.s.inputs }, source: this.s.data ? 'datos' : this.s.oidoSource, events: r.events };
        take.owner = this.s.user?.id || null; take.cloud = false;
        audioP.then(async (blob) => {
          if (blob && blob.size) { await audioPut(take.id, blob); take.hasAudio = true; }
          await takePut(take); this.set({ lastTake: take.id }); await this.refreshTakes();
        });
      }
      this.set({ rec: false }); return;
    }
    if (this.takesLimitReached) { this.set({ notice: 'limite' }); return; }
    if (!this.s.playing) this.play();
    if (this.s.captureAudio && this.can('audio')) this.capture.start(this.s.audioIn).catch((e) => { console.warn('audio', e); this.set({ notice: 'audio' }); });
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
    await takeDel(id); audioDel(id); this.set({ takes: this.s.takes.filter((x) => x.id !== id) });
  }
  // reproducir una toma: re-envía notas al K.O. y/o voces internas
  playTake(take, onEnd) {
    this.stopTake(); this.synth.ensure();
    const t0 = performance.now() + 60, timers = [];
    for (const e of take.events) {
      timers.push(setTimeout(() => {
        const at = t0 + e.t;
        const port = (e.port && this.ko.outPort(e.port)) || this.ko.output;
        const tr = this.track(e.track) || this.track();
        if (this.toDevice(tr, port)) this.ko.hit(e.note, e.vel, e.ch, 60, at, port);
        if (this.toKit(tr, port)) e.voice === 'tono' ? this.synth.play('tono', e.vel, at, e.note, tr.id) : this.synth.play(e.voice, e.vel, at, e.track === 'oido' ? 3 : 0, tr.id);
      }, Math.max(0, e.t - 40)));
    }
    timers.push(setTimeout(() => { this.takeTimers = null; onEnd?.(); }, take.durMs + 100));
    this.takeTimers = timers; this.takeT0 = t0;
  }
  stopTake() { (this.takeTimers || []).forEach(clearTimeout); this.takeTimers = null; }
}

export const session = new Session();
