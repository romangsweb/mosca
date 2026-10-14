// Fly Punch · controles aprendidos (MIDI learn). Cualquier perilla, fader, pad o tecla de cualquier aparato
// (sidekick, controladores, el propio K.O. II) puede mover un parámetro o disparar una acción.
import { SLOTS } from './song.js';

const range = (id, label, group, min, max, get, set) => ({ id, label, group, kind: 'range', min, max, get, set });
const trig = (id, label, group, fire) => ({ id, label, group, kind: 'trigger', fire });

export const TARGETS = [
  range('dulce', 'Dulce', 'Estímulos', 0, 200, (s) => s.s.inputs.dulce, (s, v) => s.setInput('dulce', v, false)),
  range('amargo', 'Amargo', 'Estímulos', 0, 200, (s) => s.s.inputs.amargo, (s, v) => s.setInput('amargo', v, false)),
  range('jon_ce', 'Graves (oído)', 'Estímulos', 0, 200, (s) => s.s.inputs.jon_ce, (s, v) => s.setInput('jon_ce', v, false)),
  range('jon_f', 'Medios (oído)', 'Estímulos', 0, 200, (s) => s.s.inputs.jon_f, (s, v) => s.setInput('jon_f', v, false)),
  range('jon_dm', 'Agudos (oído)', 'Estímulos', 0, 200, (s) => s.s.inputs.jon_dm, (s, v) => s.setInput('jon_dm', v, false)),
  range('density', 'Densidad', 'Ritmo', 1, 20, (s) => s.s.density, (s, v) => s.set({ density: v })),
  range('swing', 'Swing', 'Ritmo', 50, 75, (s) => s.s.swing, (s, v) => s.set({ swing: v })),
  range('bpm', 'Tempo', 'Ritmo', 60, 180, (s) => s.s.bpm, (s, v) => s.setBpm(v)),
  range('lvl_gusto', 'Nivel pista Gusto', 'Mezcla', 20, 100, (s) => Math.round(s.track('gusto').level * 100), (s, v) => s.setTrack('gusto', { level: v / 100 }, false)),
  range('lvl_oido', 'Nivel pista Oído', 'Mezcla', 20, 100, (s) => Math.round(s.track('oido').level * 100), (s, v) => s.setTrack('oido', { level: v / 100 }, false)),
  range('kit_vol', 'Volumen del kit (compu)', 'Mezcla', 0, 100, (s) => Math.round((s.s.kitVol ?? 0.7) * 100), (s, v) => s.setKitVol(v / 100)),
  trig('play', 'Tocar / detener', 'Acciones', (s) => s.toggle()),
  trig('rec', 'Grabar', 'Acciones', (s) => s.toggleRec()),
  trig('mutar', 'Mutar pista', 'Acciones', (s) => s.mutateTrack()),
  trig('mute_gusto', 'Silenciar Gusto', 'Mezcla', (s) => s.setTrack('gusto', { mute: !s.track('gusto').mute })),
  trig('mute_oido', 'Silenciar Oído', 'Mezcla', (s) => s.setTrack('oido', { mute: !s.track('oido').mute })),
  trig('next', 'Siguiente escena', 'Escenas', (s) => { const have = SLOTS.filter((x) => s.s.scenes[x]); if (!have.length) return; const i = have.indexOf(s.s.sceneNow); s.launchScene(have[(i + 1) % have.length]); }),
  ...SLOTS.map((x) => trig(`scene_${x}`, `Escena ${x}`, 'Escenas', (s) => s.launchScene(x))),
];
export const targetById = (id) => TARGETS.find((t) => t.id === id);
export const FREE_MAPPINGS = 4;
export const srcLabel = (m) => `${m.type === 'cc' ? 'CC' : 'Nota'} ${m.num} · canal ${m.ch}${m.port ? ` · ${m.port}` : ''}`;
const same = (a, b) => a.type === b.type && a.ch === b.ch && a.num === b.num && (!a.port || !b.port || a.port === b.port);

// mensaje entrante → aprender o aplicar
export function handleMidi(session, msg) {
  const s = session.s;
  if (s.learn) {
    const t = targetById(s.learn); if (!t) return;
    if (t.kind === 'range' && msg.type !== 'cc') return; // un rango necesita una perilla o fader
    const src = { type: msg.type, ch: msg.ch, num: msg.num, port: msg.port };
    const mappings = [...s.mappings.filter((m) => m.target !== t.id && !same(m.src, src)), { target: t.id, src }];
    session.set({ mappings, learn: null }, true);
    return;
  }
  for (const m of s.mappings) {
    if (!same(m.src, msg)) continue;
    const t = targetById(m.target); if (!t) continue;
    if (t.kind === 'range') t.set(session, Math.round(t.min + (msg.val / 127) * (t.max - t.min)));
    else {
      const key = `${m.src.type}${m.src.ch}.${m.src.num}`, was = session._trigState?.[key] || false, on = msg.val >= 64;
      session._trigState = { ...session._trigState, [key]: on };
      if (msg.type === 'note' || (on && !was)) t.fire(session);
    }
  }
}
