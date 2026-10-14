// Fly Punch · escenas y modo canción.
// Una escena es una foto de lo que la mosca siente y cómo suena: estímulos, densidad, swing, pistas activas y mutaciones.
// Las escenas se lanzan al inicio del siguiente compás; la canción es una lista de [escena, compases].
export const SLOTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export const FREE_SLOTS = 2;
export const SCENE_COLORS = { A: '#FF6A1A', B: '#7D93B2', C: '#ECECEE', D: '#FFB37A', E: '#A9BACB', F: '#C4C4CA', G: '#FF8A4D', H: '#5E7896' };

export function snapshot(s) {
  return {
    inputs: { ...s.inputs }, density: s.density, swing: s.swing,
    tracks: Object.fromEntries(s.tracks.map((t) => [t.id, { mute: t.mute, map: [...t.map], mode: t.mode }])),
  };
}

// aplica todo menos los estímulos, que pueden transicionar (morph) durante un compás
export function applyScene(session, slot, { morph = session.s.morph, step = session.live.step } = {}) {
  const sc = session.s.scenes[slot]; if (!sc) return;
  const d = sc.data, s = session.s;
  const tracks = s.tracks.map((t) => (d.tracks[t.id] ? { ...t, mute: d.tracks[t.id].mute, map: [...d.tracks[t.id].map], mode: d.tracks[t.id].mode || t.mode } : t));
  if (morph && s.playing) session.morphState = { from: { ...s.inputs }, to: { ...d.inputs }, n0: step, len: 16 };
  else session.morphState = null;
  session.set({ tracks, density: d.density, swing: d.swing, ...(morph && s.playing ? {} : { inputs: { ...d.inputs } }), sceneNow: slot, pendingScene: null });
}

// estímulos interpolados mientras dura la transición
export function morphRates(session, r, n) {
  const m = session.morphState; if (!m) return r;
  const p = Math.min(1, Math.max(0, (n - m.n0) / m.len)), e = p * p * (3 - 2 * p);
  for (const k of Object.keys(m.to)) r[k] = m.from[k] + (m.to[k] - m.from[k]) * e;
  if (p >= 1) { session.morphState = null; queueMicrotask(() => session.set({ inputs: { ...m.to } }, true)); }
  return r;
}

// se llama al inicio de cada compás
export function onBar(session, bar) {
  const s = session.s;
  if (s.songOn && s.song.length) {
    let { row, bars } = session.songPos || { row: 0, bars: 0 };
    if (bar > 0) bars++;
    if (bars >= (s.song[row]?.bars || 1)) {
      row++; bars = 0;
      if (row >= s.song.length) { if (s.songLoop) row = 0; else { session.songPos = null; queueMicrotask(() => { session.set({ songOn: false }); session.stop(); }); return; } }
      applyScene(session, s.song[row].scene, { step: bar * 16 });
    }
    session.songPos = { row, bars }; queueMicrotask(() => session.emit());
    return;
  }
  if (s.pendingScene) applyScene(session, s.pendingScene, { step: bar * 16 });
}

// Canción de ejemplo a partir de lo que suena ahora: cuatro partes que cambian lo que la mosca siente.
export function exampleSong(s) {
  const base = snapshot(s), mk = (name, inputs, density, mutes) => ({
    name, data: { ...base, inputs: { ...base.inputs, ...inputs }, density: Math.max(1, Math.min(20, density)), tracks: Object.fromEntries(Object.entries(base.tracks).map(([id, t]) => [id, { ...t, mute: mutes[id] ?? t.mute }])) },
  });
  const d = base.density || 4;
  const scenes = {
    A: mk('Intro', { dulce: 45, amargo: 0, jon_ce: 0, jon_f: 0, jon_dm: 0 }, d - 1, { gusto: false, oido: true }),
    B: mk('Subida', { dulce: 110, amargo: 15, jon_ce: 60, jon_f: 30, jon_dm: 0 }, d, { gusto: false, oido: false }),
    C: mk('Clímax', { dulce: 185, amargo: 70, jon_ce: 120, jon_f: 90, jon_dm: 80 }, d + 3, { gusto: false, oido: false }),
    D: mk('Caída', { dulce: 20, amargo: 150, jon_ce: 30, jon_f: 0, jon_dm: 40 }, d - 1, { gusto: true, oido: false }),
  };
  return { scenes, song: [{ scene: 'A', bars: 4 }, { scene: 'B', bars: 4 }, { scene: 'C', bars: 8 }, { scene: 'D', bars: 4 }] };
}
