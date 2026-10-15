// Fly Punch · motor de la sesión: un cerebro, varias pistas, reloj, grabación y salida MIDI / audio interno.
import { Circuit } from './sim.js';
import { KO2 } from './midi.js';
import { profileById, route } from './devices.js';
import { Ear } from './ear.js';
import { Synth, DEFAULT_KIT, FX_DEFAULT } from './synth.js';
import { mutate, mutateTaste, identity } from './mutate.js';
import { kvGet, kvSet, takePut, takesAll, takeDel, FREE_TAKES, sampleGet, samplePut, sampleDel } from './storage.js';
import { VOICES as KIT_VOICES, kitData, toBuffers, KITS as KITS_LIST } from './kits.js';
import { SLOTS, FREE_SLOTS, snapshot, applyScene, morphRates, onBar, exampleSong } from './song.js';
import { handleMidi, FREE_MAPPINGS, targetById } from './controls.js';
import { Capture } from './capture.js';
import { audioPut, audioGet, audioDel, dbOk } from './storage.js';
import { SK_PRESET, skPorts, skSend } from './sidekick.js';
import { Follower } from './follow.js';
import { SCALES } from './devices.js';
import { compas, clickAt, accent } from './compas.js';
import { liveMeter } from './loudness.js';
import { World, FEEDS } from './world.js';
import { Vision } from './vision.js';
import { KoLink, CHARLA_DEFAULT } from './ko.js';
import { cloudEnabled, currentUser, onAuth, loadProfile, saveProfile, signOut, startTrialCloud, listTakes, getTake, uploadTake, renameTakeCloud, deleteTakeCloud , shareTake, unshareTake, kitIndex, uploadSample, downloadSample, deleteSample, uploadTakeAudio, downloadTakeAudio, deleteTakeAudio } from './cloud.js';

// ajustes que se guardan en el navegador y, con cuenta, en la nube
const KEEP = ['bpm', 'sessionName', 'theme', 'guide', 'onboarded', 'alias', 'inputs', 'tracks', 'selTrack', 'selPad', 'density', 'swing', 'humanize', 'curve', 'velMin', 'velMax', 'ghost', 'sendMidi', 'clockOut', 'fxAuto', 'monitor', 'latency', 'oidoSource', 'perRow', 'device', 'port', 'devOverrides', 'kitId', 'scenes', 'song', 'songLoop', 'morph', 'mappings', 'audioIn', 'captureAudio', 'kitVol', 'sk', 'follow', 'fx', 'installHint', 'metro', 'countIn', 'autoLanes', 'opto', 'taste', 'compas', 'acento', 'lufs', 'xfade', 'intensidad', 'mundo', 'charla', 'expr'];

export const SENSES = { gusto: ['dulce', 'amargo'], oido: ['jon_ce', 'jon_f', 'jon_dm'], olfato: ['vinagre', 'co2', 'geosmina'], cortejo: ['canto', 'cva', 'deseo'], vision: ['acercar', 'movimiento', 'luz'] };
// circuitos: cada uno es una parte real del mismo cerebro, con sus sensores y su neurona de salida
export const CIRCUITS = {
  gusto: { name: 'Gusto', desc: 'Neuronas del gusto en la probóscide. La salida, MN9, mueve el músculo para comer.' },
  oido: { name: 'Oído', desc: 'Órgano de Johnston en la antena: graves, medios y agudos.' },
  olfato: { name: 'Olfato', desc: 'Neuronas olfativas de la antena: vinagre (fruta), CO₂ y geosmina (alerta). Pasan por el lóbulo antenal hacia el cuerno lateral.' },
  cortejo: { name: 'Cortejo', desc: 'Cómo una hembra escucha el canto del macho (antena, JO-B), huele su feromona (cVA) y decide: pC1 y vpoDN.' },
  vision: { name: 'Visión', desc: 'El ojo y la huida: algo que se acerca (LPLC2 y LC4) avisa a la fibra gigante (DNp01); el movimiento de lado pasa por T4/T5 hasta las células HS; los ocelos sienten la luz. Con tu cámara.' },
};
export const SENSE_LABEL = { dulce: 'Dulce', amargo: 'Amargo', jon_ce: 'Graves', jon_f: 'Medios', jon_dm: 'Agudos', vinagre: 'Vinagre', co2: 'CO₂', geosmina: 'Geosmina', canto: 'Canto', cva: 'cVA', deseo: 'pC1', acercar: 'Se acerca', movimiento: 'Movimiento', luz: 'Luz' };
export const HIST = 128;
// Qué abre Pro. El servidor aplica lo que importa (límite de tomas); la app solo muestra y bloquea la interfaz.
export const PRO_FEATURES = {
  datos: 'Modo Datos: tus CSV estimulan los sentidos',
  automatizacion: 'Movimientos ilimitados (grabar y dibujar automatización)',
  aprende: 'La mosca aprende tu gusto (plasticidad sináptica)',
  wav: 'Exportar tomas a WAV',
  tomas: 'Tomas ilimitadas en la nube',
  melodia: 'Modo melódico: escalas, bajo y melodía',
  kits: 'Librería completa de kits y tus propias muestras',
  cancion: 'Modo canción y 8 escenas',
  multi: 'Un aparato distinto por pista (p. ej. dos K.O. II)',
  audio: 'Grabar el audio real de tu interfaz con cada toma',
  controles: 'Controles MIDI ilimitados (sidekick y cualquier controlador)',
  pistas: '4 pistas: los 4 grupos del K.O. II, cada una con su circuito',
  directo: 'Directo: crossfader entre aparatos y macros para tocar en vivo',
  mundo: 'Mundo en vivo: sismos, Wikipedia y bitcoin como estímulos (el clima es gratis)',
};
// pistas 3 y 4 (Pro): ocupan los grupos B y D del K.O. II, que las dos primeras dejan libres
export const EXTRA_TRACKS = [{ id: 'p3', group: 'B', sense: 'olfato', root: 60 }, { id: 'p4', group: 'D', sense: 'cortejo', root: 36 }];
export const MAX_TRACKS = 4, FREE_TRACKS = 2;
const NO_PLAN = { plan: 'free', planBase: 'free', trialEnds: null, trialUsed: false, sub: null };
const CURVES = { lineal: (x) => x, suave: (x) => Math.sqrt(x), dura: (x) => x * x };

const DEFAULTS = {
  bpm: 110, sessionName: 'Sesión sin título', theme: 'noche', guide: true, onboarded: false, alias: '',
  inputs: { dulce: 150, amargo: 40, jon_ce: 0, jon_f: 0, jon_dm: 0, vinagre: 0, co2: 0, geosmina: 0, canto: 0, cva: 0, deseo: 0, acercar: 0, movimiento: 0, luz: 0 },
  tracks: [
    { id: 'gusto', name: 'Gusto', sense: 'gusto', group: 'C', ch: 1, mute: false, solo: false, level: 1, map: identity(), kit: [...DEFAULT_KIT], mode: 'ritmo', scale: 'menor_pent', root: 48, dest: 'auto', kitId: null, rev: 0.12, dly: 0, play: 'vivo', frozen: null, len: 16 },
    { id: 'oido', name: 'Oído', sense: 'oido', group: 'A', ch: 1, mute: true, solo: false, level: 0.85, map: identity(), kit: [...DEFAULT_KIT], mode: 'ritmo', scale: 'menor_pent', root: 60, dest: 'auto', kitId: null, rev: 0.2, dly: 0.1, play: 'vivo', frozen: null, len: 16 },
  ],
  selTrack: 'gusto', selPad: 11,
  density: 4, swing: 54, humanize: 4, curve: 'suave', velMin: 70, velMax: 127, ghost: true,
  sendMidi: true, clockOut: false, fxAuto: false, monitor: 'auto', latency: 0,
  device: 'ko2', port: null, devOverrides: {}, kitId: 'analogo',
  scenes: {}, song: [], songLoop: true, morph: true,
  mappings: [], audioIn: null, captureAudio: false, kitVol: 0.7,
  sk: { follow: false, fxAuto: false, fx: [0, 1] },
  fx: { ...FX_DEFAULT }, metro: false, countIn: 1, autoLanes: [],
  taste: { on: true, likes: {}, dislikes: {}, n: 0, plastic: {} },
  compas: '4/4', acento: 0.35, lufs: 'streaming', xfade: 0.5, intensidad: 1, mundo: { mix: 1 }, charla: { ...CHARLA_DEFAULT }, expr: null,
  opto: { on: false, mode: 'activar', target: 'pad', power: 0.6, pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
  follow: { source: 'entrada', tempo: true, key: true, autoPlay: true, offset: 0 },
  oidoSource: 'manual', dataMap: {}, perRow: 16,
};

export class Session {
  constructor() {
    this.listeners = new Set(); this.stepListeners = new Set();
    this.s = structuredClone(DEFAULTS);
    this.s.playing = false; this.s.rec = false; this.s.ko = { input: null, output: null, error: null };
    this.s.takes = []; this.s.ready = false; this.s.user = null; Object.assign(this.s, NO_PLAN); this.s.sync = cloudEnabled ? 'local' : 'off'; this.s.mutHistory = {}; this.s.data = null; this.s.row = 0; this.s.saved = Date.now();
    this.live = { step: 0, pos: 0, active: 0, mn9: 0, groom: 0, rate: {}, lanes: {}, out: {}, hist: new Array(64).fill(0), counts: null, lastHitAt: {}, rowHist: [], rateHist: {}, spikes: {}, meter: {} };
    if (typeof window !== 'undefined') { addEventListener('pagehide', () => this.flush()); document.addEventListener('visibilitychange', () => document.hidden && this.flush()); }
    this.rec = null; this.ear = new Ear(); this.synth = new Synth(); this.capture = new Capture(); this.world = new World(this); this.vision = new Vision(); this.kolink = new KoLink(this, SENSES);
    this.ko = new KO2({
      onStep: (n, at) => this.step(n, at),
      onStart: () => { if (!this.s.playing) this.play(); },
      onStop: () => { if (this.s.playing) this.stop(); },
      onNote: (m) => this.onKoNote(m),
      onRaw: (m) => { this.live.lastRaw = { ...m, at: performance.now() }; },
      onAny: (m) => { this._midiAt = performance.now(); this.live.lastMsg = { ...m, at: performance.now() }; this.kolink?.monitor(m); handleMidi(this, m); },
      onState: (st) => this.set({ ko: { ...st, error: null } }),
    });
    // cada nota que sale hacia un aparato queda registrada: filtro de eco de la conversación y K.O. en pantalla
    const hit = this.ko.hit.bind(this.ko); this.ko.hit = (note, vel, ch, len, at, port = this.ko.output) => { if (port) this.kolink.noteOut(note, port); return hit(note, vel, ch, len, at, port); };
  }
  async load() {
    try { await this.loadCore(); } catch (e) { console.error('Fly Punch no pudo cargar el cerebro', e); this.set({ loadError: String(e?.message || e) }); }
  }
  async loadCore() {
    const [D, cloud] = await Promise.all([
      // circuitos v783 (gusto, oído, olfato, cortejo); si aún no está publicado, el de siempre (gusto y oído)
      fetch(`${import.meta.env.BASE_URL}data/circuito-v783.json`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).catch(() => fetch(`${import.meta.env.BASE_URL}data/circuito-multi.json`).then((r) => r.json())),
      fetch(`${import.meta.env.BASE_URL}data/cerebro-nube.bin`).then((r) => r.arrayBuffer()),
    ]);
    this.D = D; this.cloud = new Int16Array(cloud); this.sim = new Circuit(D);
    this.ensureLive();
    // 1) Lo local (ajustes y tomas de este navegador): rápido, con su propio límite. 2) La cuenta, después y sin bloquear:
    // si Supabase tarda en despertar, la app ya está usable y solo el indicador de sincronía espera.
    const restoreLocal = async () => {
      if (!(await dbOk())) throw new Error('indexeddb no disponible');
      const saved = await kvGet('settings');
      if (saved) Object.assign(this.s, { ...saved, inputs: { ...DEFAULTS.inputs, ...saved.inputs }, tracks: saved.tracks?.map((t, i) => ({ ...(DEFAULTS.tracks[i] || DEFAULTS.tracks[0]), ...t })) || this.s.tracks }); this.ensureLive();
      this.ko.internalBpm = this.s.bpm; this.ko.clockOut = this.s.clockOut; this.ko.latency = this.s.latency;
      await this.refreshTakes();
    };
    try { await Promise.race([restoreLocal(), new Promise((_, rej) => setTimeout(() => rej(new Error('guardado local lento')), 5000))]); }
    catch (e) { console.warn('Fly Punch arrancó sin restaurar todo:', e); this.s.notice = 'restauracion'; }
    try { const pl = this.s.taste?.plastic?.[this.plasticKey]; if (pl) this.sim.applyLearned(pl); } catch (e) { console.warn('aprendizaje', e); }
    this.s.ready = true; this.emit(); this.remember(); this.world.syncAll();
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
  emit() { if (this._batch) { this._batchDirty = true; return; } this.s = { ...this.s }; this.listeners.forEach((f) => f()); }
  batch(fn) { this._batch = true; try { fn(); } finally { this._batch = false; if (this._batchDirty) { this._batchDirty = false; this.emit(); } } } // varios cambios, un solo redibujado
  set(patch, persist = false) {
    const p = typeof patch === 'function' ? patch(this.s) : patch;
    Object.assign(this.s, p); if (p.tracks) this.ensureLive(); this.emit();
    if (persist) this.persist();
  }
  // si cierras o recargas antes de que pase el retraso, se guarda igual
  flush() { if (this._pt) { clearTimeout(this._pt); this._pt = null; kvSet('settings', this.snapshot()); } }
  snapshot() { return Object.fromEntries(KEEP.map((k) => [k, this.s[k]])); }
  persist() {
    if (!this._restoring) { clearTimeout(this._ht); this._ht = setTimeout(() => this.remember(), 500); }
    clearTimeout(this._pt);
    this._pt = setTimeout(() => { this._pt = null; kvSet('settings', this.snapshot()); this.set({ saved: Date.now() }); }, 400);
    if (this.s.user) { clearTimeout(this._ct); this._ct = setTimeout(() => this.pushCloud(), 1500); }
  }
  // ---------- deshacer / rehacer (todo lo que se guarda: estímulos, pistas, patrones, escenas, mezcla…) ----------
  remember() {
    const snap = JSON.stringify(this.snapshot()); this.hist ||= []; if (this.hist[this.hist.length - 1] === snap) return;
    this.hist.push(snap); if (this.hist.length > 60) this.hist.shift(); this.fut = []; this.set({ canUndo: this.hist.length > 1, canRedo: false });
  }
  restoreSnap(snap) {
    this._restoring = true; const v = JSON.parse(snap);
    Object.assign(this.s, v, { tracks: v.tracks.map((t, i) => ({ ...DEFAULTS.tracks[i], ...t })) });
    this.ko.internalBpm = this.s.bpm; this.persist(); this.loadKit(); this._restoring = false;
    this.set({ canUndo: this.hist.length > 1, canRedo: this.fut.length > 0 });
  }
  undo() { if (!this.hist || this.hist.length < 2) return; clearTimeout(this._ht); this.fut.push(this.hist.pop()); this.restoreSnap(this.hist[this.hist.length - 1]); }
  redo() { if (!this.fut?.length) return; const snap = this.fut.pop(); this.hist.push(snap); this.restoreSnap(snap); }
  // ---------- movimientos (automatización): grabar o dibujar cómo cambia un parámetro a lo largo de 1–8 compases ----------
  get autoFull() { return !this.can('automatizacion') && this.s.autoLanes.length >= 1; }
  addAutoLane(target = 'dulce') {
    if (this.autoFull) { location.hash = '#/cuenta?plan'; return; }
    const id = crypto.randomUUID().slice(0, 8); this.set({ autoLanes: [...this.s.autoLanes, { id, target, len: 2, mode: 'play', pts: new Array(32).fill(null) }] }, true); return id;
  }
  setAutoLane(id, patch) {
    this.set({ autoLanes: this.s.autoLanes.map((l) => { if (l.id !== id) return l; const n = { ...l, ...patch }; if (patch.len) n.pts = Array.from({ length: patch.len * 16 }, (_, i) => l.pts[i % l.pts.length] ?? null); return n; }) }, true);
  }
  removeAutoLane(id) { this.set({ autoLanes: this.s.autoLanes.filter((l) => l.id !== id) }, true); }
  drawAuto(id, i0, i1, v0, v1) { // dibujar una línea de valores entre dos pasos
    const l = this.s.autoLanes.find((x) => x.id === id); if (!l) return; const pts = [...l.pts], a = Math.min(i0, i1), b = Math.max(i0, i1);
    for (let i = a; i <= b; i++) pts[i] = b === a ? v1 : Math.round(v0 + ((v1 - v0) * (i - i0)) / (i1 - i0));
    this.setAutoLane(id, { pts });
  }
  automate(n) {
    for (const l of this.s.autoLanes) {
      const t = targetById(l.target); if (!t || l.mode === 'off') continue; const i = n % Math.min(l.pts.length, (l.len || 1) * this.C.len);
      if (l.mode === 'rec') l.pts[i] = t.get(this); // escribe lo que estás moviendo (perilla, sidekick o pad XY)
      else if (l.pts[i] != null && t.get(this) !== l.pts[i]) t.set(this, l.pts[i]);
    }
  }
  // ---------- optogenética: luz que activa (CsChrimson, luz roja) o silencia (GtACR, luz verde) neuronas, al ritmo ----------
  setOpto(patch) { this.set({ opto: { ...DEFAULTS.opto, ...this.s.opto, ...patch } }, true); }
  optoTargets() {
    const o = this.s.opto || DEFAULTS.opto, t = this.track(), pads = this.pads(t);
    if (o.target === 'pista') return pads.filter((p) => p.clase !== 'sensor').map((p) => p.idx);
    if (o.target === 'salida') return [pads[11].idx];
    return [pads[this.s.selPad ?? 11].idx];
  }
  opto(n, at) {
    const o = this.s.opto; this.sim.optoOff?.forEach((i) => this.sim.silenced.delete(i)); this.sim.optoOff = null;
    if (!o?.on || !o.pattern[n % this.C.len]) return;
    const ids = this.optoTargets();
    if (o.mode === 'silenciar') { const add = ids.filter((i) => !this.sim.silenced.has(i)); add.forEach((i) => this.sim.silenced.add(i)); this.sim.optoOff = add; ids.forEach((i) => { this.sim.g[i] -= this.D.params.w_poi * (1 + 4 * o.power); }); } // silencia solo durante este paso (respeta las que silenciaste a mano)
    else ids.forEach((i) => { this.sim.g[i] += this.D.params.w_poi * (1 + 4 * o.power); });
    this.live.opto = { at, ids, mode: o.mode, power: o.power };
  }
  // ---------- la mosca aprende tu gusto ----------
  // Me gusta / no me gusta: refuerza o debilita las sinapsis entre neuronas que acaban de disparar juntas (plasticidad por
  // recompensa) y guarda el reparto de pads para que «Mutar» tienda hacia lo que te gusta.
  // medidor de sonoridad de la salida de la compu (LUFS momentáneo y de 3 s, pico)
  loudness() { if (!this.synth.chain) return null; if (!this._lm || this._lmCtx !== this.synth.ctx) { this._lm = liveMeter(this.synth.ctx, this.synth.chain.post); this._lmCtx = this.synth.ctx; } return this._lm.read(); }
  // largo del patrón de una pista: sigue al compás salvo que elijas otro (polirritmo); 16 = «el compás completo» por compatibilidad
  patLen(t) { return !t?.len || t.len === 16 ? this.C.len : t.len; }
  get C() { return compas(this.s.compas); } // compás actual: len (pasos por compás) y pulsos
  get plasticKey() { return `${this.D.n}:${this.sim.wt.length}`; }
  feedback(sign) {
    if (!this.can('aprende')) { location.hash = '#/cuenta?plan'; return 0; }
    const t = this.track(), ta = { ...DEFAULTS.taste, ...this.s.taste }, key = sign > 0 ? 'likes' : 'dislikes';
    const list = [...(ta[key][t.sense] || []), [...t.map]].slice(-12);
    const changed = this.s.playing ? this.sim.reinforce(sign) : [];
    const plastic = { ...ta.plastic, [this.plasticKey]: this.sim.learned() };
    this.set({ taste: { ...ta, [key]: { ...ta[key], [t.sense]: list }, n: (ta.n || 0) + 1, plastic } }, true);
    this.live.learn = { at: performance.now(), sign, syn: changed };
    return changed.length;
  }
  forget() { this.sim.applyLearned({}); this.set({ taste: { ...DEFAULTS.taste, on: this.s.taste?.on ?? true } }, true); }
  get learnedCount() { return Object.keys(this.s.taste?.plastic?.[this.plasticKey] || {}).length; }
  // ---------- tempo con golpecitos ----------
  tap() {
    const now = performance.now(); this._taps = (this._taps || []).filter((t) => now - t < 2500); this._taps.push(now);
    if (this._taps.length >= 2) { const d = this._taps.slice(-5), iv = (d[d.length - 1] - d[0]) / (d.length - 1); this.setBpm(60000 / iv); }
  }
  // ---------- cuenta ----------
  async adoptUser(user) {
    this.set({ user: { id: user.id, email: user.email, name: user.user_metadata?.name || '' }, sync: 'sincronizando' });
    try {
      const p = await loadProfile(user.id);
      const remote = p?.settings || {};
      if (Object.keys(remote).length) {
        // la nube manda: es lo último que guardaste en cualquier dispositivo
        const tracks = remote.tracks?.map((t, i) => ({ ...(DEFAULTS.tracks[i] || DEFAULTS.tracks[0]), ...t })) || this.s.tracks;
        Object.assign(this.s, remote, { tracks, onboarded: true }); this.ensureLive();
        this.ko.internalBpm = this.s.bpm; this.ko.clockOut = this.s.clockOut; this.ko.latency = this.s.latency;
        kvSet('settings', this.snapshot());
      } else {
        this.s.onboarded = true; await saveProfile(user.id, { settings: this.snapshot(), alias: this.s.alias || p?.alias || null });
      }
      this.set({ alias: this.s.alias || p?.alias || '', ...this.planFrom(p), sync: 'sincronizado' });
      await this.syncKit();
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
  // «Mi kit» en la nube: baja lo que subiste desde otro dispositivo y sube lo que solo está aquí (Pro)
  syncKit() { return (this._kitSync ||= this._syncKit().finally(() => { this._kitSync = null; })); } // una a la vez
  async _syncKit() {
    const uid = this.s.user?.id; if (!uid) return;
    try {
      const idx = await kitIndex(uid); let changed = false;
      for (const v of KIT_VOICES) {
        const loc = await sampleGet(v), rem = idx[v];
        if (rem && (!loc || loc.name !== rem.name || (loc.at || 0) < rem.at)) { await samplePut(v, { name: rem.name, data: await downloadSample(uid, v), at: rem.at, cloud: true }); changed = true; }
        else if (!rem && loc?.cloud) { await sampleDel(v); changed = true; } // la borraste en otro dispositivo
        else if (!rem && loc && this.can('kits')) { await uploadSample(uid, v, loc.name, loc.data, loc.type); await samplePut(v, { ...loc, at: Date.now(), cloud: true }); }
      }
      this.set({ kitCloud: 'ok' }); return changed;
    } catch (e) { console.warn('kit en la nube', e); this.set({ kitCloud: 'error' }); }
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
  // audio real de una toma: de este navegador o, si no está, de la nube (y queda guardado aquí)
  async getAudio(id) {
    const loc = await audioGet(id); if (loc || !this.s.user) return loc;
    const b = await downloadTakeAudio(this.s.user.id, id); if (b) await audioPut(id, b).catch(() => {}); return b;
  }
  async pushAudio(id) {
    const uid = this.s.user?.id; if (!uid || !this.can('audio')) return;
    const b = await audioGet(id); if (!b) return;
    try { await uploadTakeAudio(uid, id, b); this.set({ takes: this.s.takes.map((x) => (x.id === id ? { ...x, cloudAudio: true, hasAudio: true } : x)) }); } catch (e) { console.warn('subir audio', e); }
  }
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
  kitAllowed(id) { return !KITS_LIST.find((k) => k.id === id)?.pro && id !== 'propio' || this.can('kits'); }
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
    this.synth.setFx(this.s.fx, this.ko.internalBpm || this.s.bpm); this.synth.sc = this.s.fx?.sc || 0;
    this.set({ kitActive: want, customSamples: g.custom });
  }
  setTrackKit(tid, id) { if (id && !this.can('kits')) { location.hash = '#/cuenta?plan'; return; } this.setTrack(tid, { kitId: id || null }); this.loadKit(); }
  setFx(patch, persist = true) {
    if ('sc' in patch) this.synth.sc = patch.sc; const fx = { ...FX_DEFAULT, ...this.s.fx, ...patch }; this.set({ fx }, persist); this.synth.setFx(fx, this.ko.internalBpm || this.s.bpm); }
  get wavOptions() { return { padFor: (e) => { const t = this.track(e.track); return t ? this.padSound(t, e.pad) : null; }, fx: this.s.fx, bpm: this.ko.internalBpm || this.s.bpm, sends: Object.fromEntries(this.s.tracks.map((t) => [t.id, { rev: t.rev ?? 0, dly: t.dly ?? 0 }])), kits: this.synth.kits, trackKit: this.synth.trackKit }; }
  // ---------- congelar: el compás que te gustó queda como patrón editable ----------
  freeze(tid = this.s.selTrack) {
    const t = this.track(tid), lanes = this.live.lanes[tid]; if (!t || !lanes) return false;
    const frozen = lanes.map((row) => Array.from(row, (v) => Math.min(127, Math.round(v / (t.level || 1)))));
    if (!frozen.some((r) => r.some(Boolean))) return false;
    this.setTrack(tid, { frozen, play: t.play === 'ambos' ? 'ambos' : 'congelado' }); return true;
  }
  // clic en un paso: apagado → siempre → a veces (50 %) → apagado
  toggleStep(tid, k, pos) {
    const t = this.track(tid), frozen = (t.frozen || Array.from({ length: 12 }, () => new Array(16).fill(0))).map((r) => [...r]);
    const prob = (t.prob || Array.from({ length: 12 }, () => new Array(16).fill(100))).map((r) => [...r]);
    if (!frozen[k][pos]) { frozen[k][pos] = 100; prob[k][pos] = 100; } else if (prob[k][pos] >= 100) prob[k][pos] = 50; else { frozen[k][pos] = 0; prob[k][pos] = 100; }
    this.setTrack(tid, { frozen, prob, play: t.play === 'vivo' ? 'congelado' : t.play });
  }
  // Melodía: subir o bajar la nota de un paso del patrón (en grados de la escala, de −7 a +7)
  setStepDeg(tid, k, pos, delta) {
    const t = this.track(tid), deg = (t.deg || Array.from({ length: 12 }, () => new Array(16).fill(0))).map((r) => [...r]);
    deg[k][pos] = Math.max(-7, Math.min(7, (deg[k][pos] || 0) + delta)); this.setTrack(tid, { deg });
  }
  copyPattern(from, to) {
    const a = this.track(from); if (!a?.frozen) return;
    this.setTrack(to, { frozen: a.frozen.map((r) => [...r]), prob: a.prob?.map((r) => [...r]) || null, len: a.len || null, play: this.track(to).play === 'vivo' ? 'congelado' : this.track(to).play });
  }

  setKit(id) { if (!this.kitAllowed(id)) { location.hash = '#/cuenta?plan'; return; } this.set({ kitId: id }, true); this.loadKit(); }
  async addSample(voice, file) {
    if (!this.can('kits')) throw new Error('pro');
    if (file.size > 4 * 1024 * 1024) throw new Error('grande');
    const data = await file.arrayBuffer(); await this.synth.ensure().decodeAudioData(data.slice(0)); // valida que sea audio
    const at = Date.now(); await samplePut(voice, { name: file.name, data, type: file.type, at }); if (this.s.kitId !== 'propio') this.set({ kitId: 'propio' }, true); await this.loadKit();
    const uid = this.s.user?.id; if (!uid) return;
    this.set({ kitCloud: 'subiendo' });
    try { await uploadSample(uid, voice, file.name, data, file.type); await samplePut(voice, { name: file.name, data, type: file.type, at, cloud: true }); this.set({ kitCloud: 'ok' }); }
    catch (e) { console.warn('subir muestra', e); this.set({ kitCloud: 'error' }); }
  }
  async removeSample(voice) {
    await sampleDel(voice); await this.loadKit();
    if (this.s.user) deleteSample(this.s.user.id, voice).catch((e) => console.warn('borrar muestra', e));
  }
  // ---------- plan ----------
  planFrom(p) {
    const trialEnds = p?.trial_ends_at ? new Date(p.trial_ends_at).getTime() : null, planBase = p?.plan || 'free';
    const plan = planBase === 'pro' || (trialEnds && trialEnds > Date.now()) ? 'pro' : 'free';
    clearTimeout(this._trialT);
    if (planBase !== 'pro' && trialEnds && trialEnds > Date.now()) this._trialT = setTimeout(() => { this.set(this.planFrom(p)); this.loadKit(); }, Math.min(trialEnds - Date.now() + 1000, 2 ** 31 - 1));
    const sub = p?.paddle_subscription_id ? { status: p.plan_status, cycle: p.plan_cycle, renews: p.plan_renews_at ? new Date(p.plan_renews_at).getTime() : null, cancelAt: p.plan_cancel_at ? new Date(p.plan_cancel_at).getTime() : null } : null;
    return { plan, planBase, trialEnds, trialUsed: !!p?.trial_used, sub };
  }
  get onTrial() { return this.s.planBase !== 'pro' && this.s.plan === 'pro'; }
  get canTrial() { return !!this.s.user && !this.s.trialUsed && this.s.planBase !== 'pro'; }
  can(feature) { return this.s.plan === 'pro' || !PRO_FEATURES[feature]; }
  // suscribirse con Paddle: al pagar, el webhook activa Pro en la nube; aquí esperamos a verlo (hasta 1 min)
  async buyPro(cycle) {
    if (!this.s.user) { location.hash = '#/bienvenida'; return 'sin-cuenta'; }
    const { checkout } = await import('./pay.js');
    const r = await checkout(cycle, this.s.user); if (r !== 'pagado') return r;
    this.set({ paying: true });
    for (let i = 0; i < 30; i++) {
      const p = await loadProfile(this.s.user.id).catch(() => null);
      if (p?.plan === 'pro') { this.set({ ...this.planFrom(p), paying: false, notice: 'pro' }); this.loadKit(); await this.refreshTakes(); return 'pro'; }
      await new Promise((ok) => setTimeout(ok, 2000));
    }
    this.set({ paying: false }); return 'pendiente'; // el pago se hizo; Pro llega en cuanto Paddle avise
  }
  async manageBilling() { const { portal } = await import('./pay.js'); await portal(); }
  async startTrial() {
    const end = await startTrialCloud();
    this.set(this.planFrom({ plan: this.s.planBase, trial_ends_at: new Date(end).toISOString(), trial_used: true }));
    this.loadKit();
    await this.refreshTakes();
  }
  setInput(k, v, persist = true) { this.set({ inputs: { ...this.s.inputs, [k]: v } }, persist); }
  setTrack(id, patch, persist = true) { this.set({ tracks: this.s.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }, persist); if ('level' in patch) this.skFollow(this.track(id)); if ('rev' in patch || 'dly' in patch) { const t = this.track(id); this.synth.setSends(id, { rev: t.rev ?? 0, dly: t.dly ?? 0 }); } }
  track(id = this.s.selTrack) { return this.s.tracks.find((t) => t.id === id); }
  pads(track) { return (this.D.modos[track.sense] || this.D.modos.gusto).pads; }
  // estado en vivo de cada pista (rejilla, frecuencias y la historia por neurona para la gráfica del inspector)
  ensureLive() {
    const L = this.live; if (!L) return;
    for (const t of this.s.tracks) {
      if (L.lanes[t.id]) continue;
      L.lanes[t.id] = [...Array(12)].map(() => new Uint8Array(16)); L.rate[t.id] = new Float32Array(12);
      L.rateHist[t.id] = [...Array(12)].map(() => new Float32Array(HIST)); L.spikes[t.id] = [...Array(12)].map(() => new Uint8Array(HIST));
    }
  }
  // crossfader de Directo: las pistas del lado A suenan a la izquierda, las del B a la derecha; al centro, ambas completas
  xfGain(t) { if (!t.xf || !this.can('directo')) return 1; const x = this.s.xfade ?? 0.5; return t.xf === 'A' ? Math.min(1, 2 * (1 - x)) : Math.min(1, 2 * x); }
  // ---------- Mundo en vivo ----------
  feedAllowed(id) { return !!FEEDS[id]?.free || this.can('mundo'); }
  setMundo(id, patch) {
    if (patch.on && !this.feedAllowed(id)) { location.hash = '#/cuenta?plan'; return; }
    const m = this.s.mundo || {}, prev = { ...FEEDS[id]?.defaults, ...m[id] }, next = { ...prev, ...patch };
    this.set({ mundo: { ...m, [id]: next } }, true);
    const restart = ['lat', 'lon', 'wiki', 'product', 'replay'].some((k) => k in patch && patch[k] !== prev[k]);
    if (restart && next.on) this.world.start(id); else this.world.syncAll();
  }
  get trackLimit() { return this.can('pistas') ? MAX_TRACKS : FREE_TRACKS; }
  // agregar una pista (3 y 4 son Pro): toma el siguiente grupo libre del K.O. y un circuito que aún no suena
  addTrack(sense) {
    if (this.s.tracks.length >= MAX_TRACKS) return null;
    if (this.s.tracks.length >= this.trackLimit) { location.hash = '#/cuenta?plan'; return null; }
    const slot = EXTRA_TRACKS.find((x) => !this.s.tracks.some((t) => t.id === x.id)); if (!slot) return null;
    const used = new Set(this.s.tracks.map((t) => t.sense)), avail = Object.keys(CIRCUITS).filter((c) => this.D?.modos?.[c]);
    const sn = sense || avail.find((c) => !used.has(c)) || slot.sense;
    const t = { ...DEFAULTS.tracks[0], id: slot.id, name: CIRCUITS[sn]?.name || `Pista ${this.s.tracks.length + 1}`, sense: sn, group: slot.group, root: slot.root, level: 0.9, map: identity(), kit: [...DEFAULT_KIT], mute: false, solo: false, rev: 0.15, dly: 0, frozen: null, prob: null, len: null, kitId: null };
    this.set({ tracks: [...this.s.tracks, t], selTrack: t.id }, true); this.loadKit(); return t.id;
  }
  removeTrack(id) {
    if (!EXTRA_TRACKS.some((x) => x.id === id)) return; // las dos primeras siempre existen
    this.set({ tracks: this.s.tracks.filter((t) => t.id !== id), selTrack: this.s.selTrack === id ? 'gusto' : this.s.selTrack }, true);
    for (const k of ['lanes', 'rate', 'rateHist', 'spikes']) delete this.live[k][id];
  }
  setSense(tid, sense) {
    if (!this.D.modos[sense]) return; const t = this.track(tid), rename = t && t.name === CIRCUITS[t.sense]?.name; // si la pista se llamaba como su circuito, cambia de nombre con él
    this.setTrack(tid, { sense, frozen: null, play: 'vivo', ...(rename ? { name: CIRCUITS[sense].name } : {}) });
  }
  // sin Pro, las pistas 3 y 4 se conservan pero no suenan
  audible(t) { if (this.s.tracks.indexOf(t) >= this.trackLimit) return false; const solo = this.s.tracks.some((x) => x.solo); return solo ? t.solo : !t.mute; }
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
  route(t, k, bar = Math.floor((this.live.step || 0) / this.C.len), deg = 0) {
    const prof = this.profileFor(t), r = route(prof, t, k, this.pads(t), this.s.devOverrides[prof.id] || {}, bar, deg);
    // sin Pro, lo melódico no sale por MIDI y suena con la voz de batería del pad
    if (r.voice === 'tono' && !this.can('melodia')) return { note: null, ch: r.ch, voice: t.kit[t.map[k]] };
    return r;
  }
  // afinación por pad (semitonos) sobre la del kit; la pista Oído suena 3 semitonos arriba para distinguirse
  padSound(t, k) { const off = t.map[k]; return { tune: t.tune?.[off] || 0, decay: t.decay?.[off] ?? 1, pan: t.pan?.[off] || 0 }; }
  sound(r, vel, when, t, k = null) { const pd = k != null ? this.padSound(t, k) : null; if (r.voice === 'tono') this.synth.play('tono', vel, when, r.note, t.id, pd); else this.synth.play(r.voice, vel, when, (t.id === 'oido' ? 3 : 0) + (pd?.tune || 0), t.id, pd); }
  setCompas(id) { this.set({ compas: id }, true); }
  setBpm(b) { const bpm = Math.max(40, Math.min(240, Math.round(b))); this.ko.internalBpm = bpm; this.set({ bpm }, true); if (this.synth.chain) this.synth.setFx(this.s.fx, bpm); }
  setClockOut(v) { this.ko.clockOut = v; this.set({ clockOut: v }, true); }
  setLatency(v) { this.ko.latency = v; this.set({ latency: v }, true); }
  // Mezcla: a dónde va cada pista. auto = al aparato si hay, si no a la compu (como siempre); aparato; kit (compu); ambos.
  toDevice(t, port = this.portFor(t)) { return this.s.sendMidi && !!port && (t.dest || 'auto') !== 'kit'; }
  toKit(t, port = this.portFor(t)) { const d = t.dest || 'auto'; return d === 'kit' || d === 'ambos' || (d === 'auto' && this.monitorOn) || (d === 'aparato' && !port && this.s.monitor !== 'nunca'); }
  setKitVol(v, persist = true) { this.set({ kitVol: v }, persist); if (this.synth.out) this.synth.out.gain.value = v; }
  get monitorOn() { return this.s.monitor === 'siempre' || (this.s.monitor === 'auto' && (!this.ko.connected || this.profile.kind === 'interno')); }
  // ---------- transporte ----------
  play() { this.synth.ensure(); this.sim.reset(); this.live.step = 0; this.live.countIn = 0; this.s.row = 0; this.morphState = null; if (this.s.songOn) this.songPos = { row: 0, bars: 0 }; this.ko.start(); this.set({ playing: true }); }
  stop() { this.ko.stop(); this.kolink.reset(); if (this._recArm) { this._recArm = false; this.set({ rec: false, counting: false }); } else if (this.s.rec) this.toggleRec(); this.morphState = null; this.set({ playing: false, pendingScene: null }); }
  toggle() { this.s.playing ? this.stop() : this.play(); }
  // ---------- un paso de semicorchea ----------
  rates() {
    const r = { ...this.s.inputs };
    // la cámara manda en los tres sentidos de la visión mientras está encendida
    if (this.vision.on) { const v = this.vision.vals; r.acercar = v.acercar * 200; r.movimiento = v.movimiento * 200; r.luz = v.luz * 200; }
    if (this.s.oidoSource !== 'manual' && this.ear.kind) { const L = this.ear.read(); r.jon_ce = L[0] * 200; r.jon_f = L[1] * 200; r.jon_dm = L[2] * 200; this.live.ear = L; }
    if (this.s.data && Object.keys(this.s.dataMap).length && this.can('datos')) {
      for (const [sense, ci] of Object.entries(this.s.dataMap)) if (ci !== '' && ci != null) r[sense] = this.s.data.cols[ci].norm[this.s.row] * 200;
    }
    morphRates(this, r, this.live.step);
    // Mundo en vivo: clima, sismos, Wikipedia, mercado
    if (this.s.mundo && Object.keys(FEEDS).some((id) => this.s.mundo[id]?.on)) this.world.apply(r);
    this.kolink.applyPulses(r); // golpes del K.O. a un sentido
    // macro «Intensidad» de Directo: escala todos los estímulos a la vez (×0 a ×2)
    const ki = this.can('directo') ? this.s.intensidad ?? 1 : 1; if (ki !== 1) for (const x of Object.keys(r)) r[x] *= ki;
    // las pistas silenciadas no reciben estímulo de su sentido: así no ensucian el cerebro
    // solo estimulan los sentidos de las pistas que suenan (un circuito sin pista no se activa a escondidas)
    const live = new Set(this.s.tracks.filter((t) => this.audible(t)).flatMap((t) => SENSES[t.sense] || []));
    for (const k of Object.keys(r)) if (!live.has(k)) r[k] = 0;
    return r;
  }
  step(n, at) {
    const s = this.s, D = this.D, L = this.live, stepMs = this.ko.stepMs;
    if (s.sendingTake) { L.step = n; L.stepAt = at; return; } // mandando una toma al K.O.: solo corre el reloj, la mosca no toca
    if (L.countIn > 0) { // compás de cuenta: solo clic, la mosca espera
      { const c = clickAt(this.C, n % this.C.len); if (c) this.synth.click(at, c); } L.step = n; L.stepAt = at; L.countIn--;
      if (!L.countIn) { this.ko.step = 0; if (this._recArm) { this._recArm = false; this.startRec(at + stepMs, 0); } } // el compás 1 empieza después de la cuenta
      return;
    }
    const C = this.C, pos = n % C.len;
    if (s.metro) { const c = clickAt(C, pos); if (c) this.synth.click(at, c); }
    if (s.data && n > 0 && n % s.perRow === 0) { s.row = (s.row + 1) % s.data.rows; queueMicrotask(() => this.emit()); }
    this.live.step = n; if (pos === 0) onBar(this, Math.floor(n / C.len));
    if (s.autoLanes?.length) this.batch(() => this.automate(n));
    this.opto(n, at);
    const R = this.rates(); L.lastRates = R;
    const cnt = this.sim.advance(s.density, R); L.counts = cnt;
    let active = 0; for (let i = 0; i < cnt.length; i++) if (cnt[i]) active++;
    L.active = active; L.hist.push(active); L.hist.shift(); L.step = n; L.stepAt = at;
    const flyOn = this.kolink.step(n); // llamada y respuesta con el K.O.: en tu compás la mosca escucha
    const acc = accent(C, pos, s.acento ?? 0), swingMs = pos % 2 ? ((s.swing - 50) / 50) * stepMs : 0, curve = CURVES[s.curve];
    for (const t of s.tracks) {
      const pads = this.pads(t), lanes = L.lanes[t.id], rate = L.rate[t.id], on = this.audible(t);
      pads.forEach((p, k) => {
        const c = cnt[p.idx]; rate[k] = rate[k] * 0.9 + 0.1 * (c / (s.density / 1000));
        lanes[k][pos] = 0; L.rateHist[t.id][k][n % HIST] = rate[k]; L.spikes[t.id][k][n % HIST] = c;
        // vivo = toca la mosca · congelado = toca el patrón · ambos = el patrón más lo que agregue la mosca
        const mode = t.play || 'vivo', fz = mode !== 'vivo' && t.frozen ? t.frozen[k][n % this.patLen(t)] : 0;
        let vel = 0;
        if (c && on && mode !== 'congelado') { const x = Math.min(1, c / 3), ghost = s.ghost && p.inhibidora ? 0.6 : 1; vel = Math.round((s.velMin + (s.velMax - s.velMin) * curve(x)) * ghost * t.level); }
        if (fz && on && Math.random() * 100 < (t.prob?.[k]?.[n % this.patLen(t)] ?? 100)) vel = Math.max(vel, Math.round(fz * t.level));
        if (vel) { const g = flyOn ? this.xfGain(t) : 0; vel = g ? Math.max(1, Math.min(127, Math.round(vel * acc * g))) : 0; }
        if (!vel) return;
        const when = at + swingMs + (Math.random() * 2 - 1) * s.humanize;
        const r = this.route(t, k, undefined, fz ? t.deg?.[k]?.[n % this.patLen(t)] || 0 : 0);
        lanes[k][pos] = vel;
        const port = this.portFor(t);
        const notes = r.chord && r.note != null ? r.chord : [r.note]; // acorde: todas las notas, las añadidas un poco más suaves
        if (this.toDevice(t, port) && r.note != null) notes.forEach((nt, j) => this.ko.hit(nt, j ? Math.round(vel * 0.8) : vel, r.ch, r.voice === 'tono' ? stepMs * 0.9 : 60, when, port));
        if (this.toKit(t, port)) notes.forEach((nt, j) => this.sound({ ...r, note: nt }, j ? Math.round(vel * 0.7) : vel, when, t, k));
        const mt = L.meter[t.id]; if (!mt || when - mt.at > 60 || vel > mt.vel) L.meter[t.id] = { at: when, vel };
        L.lastHitAt[t.id + k] = when;
        if (this.rec) notes.forEach((nt, j) => this.rec.events.push({ t: when - this.rec.t0, step: n - this.rec.n0, track: t.id, pad: k, neuron: p.tipo, note: nt ?? 0, vel: j ? Math.round(vel * 0.8) : vel, ch: r.ch, voice: r.voice, port: port?.name, ...(j ? { chord: 1 } : {}) }));
      });
    }
    L.mn9 = L.mn9 * 0.9 + 0.1 * (cnt[D.mn9] / (s.density / 1000));
    const g = D.modos.oido.pads[11].idx; L.groom = L.groom * 0.9 + 0.1 * (cnt[g] / (s.density / 1000));
    for (const [m, i] of Object.entries(D.salidas || {})) L.out[m] = (L.out[m] || 0) * 0.9 + 0.1 * (cnt[i] / (s.density / 1000));
    const fx = this.profile.fx;
    this.kolink.expression(n); // la mosca mueve pitch, vibrato y efectos del K.O.
    if (s.sk?.fxAuto && n % 2 === 0 && this.can('controles')) { // la mosca mueve los efectos del sidekick: MN9 → tira 1, acicalamiento → tira 2
      const out = this.sidekick.output, v = [Math.min(127, L.mn9 * 1.4), Math.min(127, L.groom * 1.4)];
      this._skFx = this._skFx || [-9, -9]; v.forEach((x, k) => { if (Math.abs(x - this._skFx[k]) >= 2) { skSend.fxAmount(out, k + 1, x); this._skFx[k] = x; } });
    }
    if (s.data) L.rowHist[s.row] = L.mn9;
    this.stepListeners.forEach((f) => f(n, cnt));
  }
  // nota que llega del aparato → estimula la neurona que toca esa nota (como optogenética)
  // una nota que llega de un K.O.: la conversación decide qué neurona o sentido estimula
  onKoNote(m) { if (this.D) this.kolink.noteIn(m); }
  tapPad(k, track = this.track()) {
    this.sim.g[this.pads(track)[k].idx] += this.D.params.w_poi * 2;
    const r = this.route(track, k); this.synth.ensure();
    const port = this.portFor(track);
    const dev = this.toDevice(track, port) && r.note != null;
    if (dev) this.ko.hit(r.note, 110, r.ch, 180, performance.now(), port);
    if (!dev || this.toKit(track, port)) this.sound(r, 110, performance.now(), track, k);
  }
  // ---------- mutar ----------
  mutateTrack(id = this.s.selTrack) {
    const t = this.track(id), hist = this.s.mutHistory[id] || [];
    const ts = this.s.taste?.on && this.can('aprende') ? { likes: this.s.taste.likes?.[t.sense] || [], dislikes: this.s.taste.dislikes?.[t.sense] || [] } : {};
    const map = mutateTaste(this.pads(t), t.kit, this.D.mn9, ts, Date.now());
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
    const merged = remote.map((r) => { const l = byId.get(r.id); return { ...r, events: l?.events || null, hasAudio: !!l?.hasAudio || !!r.cloudAudio, localAudio: !!l?.hasAudio, nEvents: r.nEvents ?? l?.events?.length ?? 0, where: 'nube' }; });
    for (const t of byId.values()) if ((!t.owner || t.owner === uid) && !remoteIds.has(t.id) && !merged.some((m) => m.id === t.id)) merged.push({ ...t, where: 'local' });
    merged.sort((a, b) => b.date - a.date);
    this.set({ takes: merged, ...(blocked ? { notice: 'limite' } : {}) });
    // audio real que aún no está en la nube (tomas grabadas sin conexión o antes de la migración 0005)
    if (this.can('audio')) for (const t of merged) if (t.where === 'nube' && t.localAudio && !t.cloudAudio) this.pushAudio(t.id);
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
        const take = { id: crypto.randomUUID(), name: `Toma ${n}`, date: Date.now(), bpm: Math.round(this.ko.bpm), durMs, steps: this.live.step - r.n0, compas: this.s.compas || '4/4',
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
    if (this._recArm) { this._recArm = false; this.live.countIn = 0; this.set({ rec: false, counting: false }); return; }
    // cuenta de entrada: si no está tocando, un compás (o dos) de clic antes de grabar
    if (!this.s.playing && this.s.countIn > 0) { this.play(); this.live.countIn = this.s.countIn * this.C.len; this._recArm = true; this.set({ rec: true, counting: true }); return; }
    if (!this.s.playing) this.play();
    this.startRec();
  }
  startRec(t0 = performance.now(), n0 = this.live.step) {
    if (this.s.captureAudio && this.can('audio')) this.capture.start(this.s.audioIn).catch((e) => { console.warn('audio', e); this.set({ notice: 'audio' }); });
    this.rec = { t0, n0, events: [] }; this.set({ rec: true, counting: false });
  }
  // abrir en mi estudio una toma compartida: copia local nueva
  async importTake(t) {
    const take = { ...t, id: crypto.randomUUID(), name: `${t.name} (remix)`.slice(0, 80), date: Date.now(), owner: null, cloud: false, shared: false, shareId: null };
    delete take.author; await takePut(take); if (!this.s.onboarded) this.set({ onboarded: true }, true);
    await this.refreshTakes(); this.set({ lastTake: take.id });
  }
  async share(id) {
    const t = this.s.takes.find((x) => x.id === id); if (!t) return null;
    const shareId = await shareTake(id, this.s.alias || '', t.shareId); this.set({ takes: this.s.takes.map((x) => (x.id === id ? { ...x, shared: true, shareId } : x)) }); return shareId;
  }
  async unshare(id) { await unshareTake(id); this.set({ takes: this.s.takes.map((x) => (x.id === id ? { ...x, shared: false } : x)) }); }
  // mandar una toma al K.O.: arranca el reloj (el K.O. debe estar en «sincronía entrante» y grabando) y toca solo hacia los aparatos
  sendTakeToKO(take, onEnd) {
    if (this.s.playing) this.stop();
    const prevClock = this.ko.clockOut; this.ko.clockOut = true; this.stopTake();
    const stepMs = 60000 / (take.bpm || this.s.bpm) / 4, bars = Math.max(1, Math.ceil(take.durMs / (stepMs * this.C.len)));
    this.setBpm(take.bpm || this.s.bpm); this.ko.start(); this.set({ sendingTake: true });
    const t0 = this.ko.nextAt, timers = [];
    for (const e of take.events) timers.push(setTimeout(() => { const tr = this.track(e.track) || this.track(), port = (e.port && this.ko.outPort(e.port)) || this.portFor(tr) || this.ko.output; this.ko.hit(e.note, e.vel, e.ch, 60, t0 + e.t, port); }, Math.max(0, t0 + e.t - performance.now() - 40)));
    timers.push(setTimeout(() => { this.ko.stop(); this.ko.clockOut = prevClock; this.takeTimers = null; this.set({ sendingTake: false }); onEnd?.(); }, t0 + bars * this.C.len * stepMs - performance.now() + 20));
    this.takeTimers = timers;
  }
  // toma editada en el editor de notas: se guarda como toma nueva (la original no se toca)
  async saveEditedTake(orig, edited) {
    if (this.takesLimitReached) { this.set({ notice: 'limite' }); return null; }
    const { where, shared, shareId, cloudAudio, localAudio, hasAudio, cloud, ...rest } = edited;
    const take = { ...rest, id: crypto.randomUUID(), name: `${orig.name} · editada`.slice(0, 80), date: Date.now(), owner: this.s.user?.id || null, cloud: false, editedFrom: orig.id };
    await takePut(take); this.set({ lastTake: take.id }); await this.refreshTakes(); return take.id;
  }
  async renameTake(id, name) {
    const t = this.s.takes.find((x) => x.id === id); if (!t) return;
    if (t.where === 'nube') await renameTakeCloud(id, name).catch((e) => console.warn(e));
    const local = (await takesAll()).find((x) => x.id === id); if (local) await takePut({ ...local, name });
    this.set({ takes: this.s.takes.map((x) => (x.id === id ? { ...x, name } : x)) });
  }
  async deleteTake(id) {
    const t = this.s.takes.find((x) => x.id === id);
    if (t?.where === 'nube') { await deleteTakeCloud(id).catch((e) => console.warn(e)); if (t.hasAudio) deleteTakeAudio(this.s.user.id, id).catch(() => {}); }
    await takeDel(id); audioDel(id); this.set({ takes: this.s.takes.filter((x) => x.id !== id) });
  }
  // reproducir una toma: re-envía notas al K.O. y/o voces internas
  playTake(take, onEnd, { kitOnly = false } = {}) { // kitOnly: solo el sonido de la compu (para grabar el video)
    this.stopTake(); this.synth.ensure();
    const t0 = performance.now() + 60, timers = [];
    for (const e of take.events) {
      timers.push(setTimeout(() => {
        const at = t0 + e.t;
        const port = (e.port && this.ko.outPort(e.port)) || this.ko.output;
        const tr = this.track(e.track) || this.track();
        if (!kitOnly && this.toDevice(tr, port)) this.ko.hit(e.note, e.vel, e.ch, 60, at, port);
        if (kitOnly || this.toKit(tr, port)) e.voice === 'tono' ? this.synth.play('tono', e.vel, at, e.note, tr.id) : this.synth.play(e.voice, e.vel, at, (e.track === 'oido' ? 3 : 0) + this.padSound(tr, e.pad).tune, tr.id, this.padSound(tr, e.pad));
      }, Math.max(0, e.t - 40)));
    }
    timers.push(setTimeout(() => { this.takeTimers = null; onEnd?.(); }, take.durMs + 100));
    this.takeTimers = timers; this.takeT0 = t0;
  }
  stopTake() { (this.takeTimers || []).forEach(clearTimeout); this.takeTimers = null; }
}

export const session = new Session();
