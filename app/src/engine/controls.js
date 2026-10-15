// Fly Punch · controles aprendidos (MIDI learn). Cualquier perilla, fader, pad o tecla de cualquier aparato
// (sidekick, controladores, el propio K.O. II) puede mover un parámetro o disparar una acción.
import { SLOTS } from './song.js';

const range = (id, label, group, min, max, get, set) => ({ id, label, group, kind: 'range', min, max, get, set });
const trig = (id, label, group, fire) => ({ id, label, group, kind: 'trigger', fire });
const TRACK_IDS = ['gusto', 'oido', 'p3', 'p4'];

export const TARGETS = [
  range('dulce', 'Dulce', 'Estímulos', 0, 200, (s) => s.s.inputs.dulce, (s, v) => s.setInput('dulce', v, false)),
  range('amargo', 'Amargo', 'Estímulos', 0, 200, (s) => s.s.inputs.amargo, (s, v) => s.setInput('amargo', v, false)),
  range('jon_ce', 'Graves (oído)', 'Estímulos', 0, 200, (s) => s.s.inputs.jon_ce, (s, v) => s.setInput('jon_ce', v, false)),
  range('jon_f', 'Medios (oído)', 'Estímulos', 0, 200, (s) => s.s.inputs.jon_f, (s, v) => s.setInput('jon_f', v, false)),
  range('jon_dm', 'Agudos (oído)', 'Estímulos', 0, 200, (s) => s.s.inputs.jon_dm, (s, v) => s.setInput('jon_dm', v, false)),
  range('vinagre', 'Vinagre (olfato)', 'Estímulos', 0, 200, (s) => s.s.inputs.vinagre ?? 0, (s, v) => s.setInput('vinagre', v, false)),
  range('co2', 'CO₂ (olfato)', 'Estímulos', 0, 200, (s) => s.s.inputs.co2 ?? 0, (s, v) => s.setInput('co2', v, false)),
  range('geosmina', 'Geosmina (olfato)', 'Estímulos', 0, 200, (s) => s.s.inputs.geosmina ?? 0, (s, v) => s.setInput('geosmina', v, false)),
  range('canto', 'Canto (cortejo)', 'Estímulos', 0, 200, (s) => s.s.inputs.canto ?? 0, (s, v) => s.setInput('canto', v, false)),
  range('cva', 'cVA (cortejo)', 'Estímulos', 0, 200, (s) => s.s.inputs.cva ?? 0, (s, v) => s.setInput('cva', v, false)),
  range('deseo', 'pC1 (cortejo)', 'Estímulos', 0, 200, (s) => s.s.inputs.deseo ?? 0, (s, v) => s.setInput('deseo', v, false)),
  range('density', 'Densidad', 'Ritmo', 1, 20, (s) => s.s.density, (s, v) => s.set({ density: v })),
  range('swing', 'Swing', 'Ritmo', 50, 75, (s) => s.s.swing, (s, v) => s.set({ swing: v })),
  range('bpm', 'Tempo', 'Ritmo', 60, 180, (s) => s.s.bpm, (s, v) => s.setBpm(v)),
  range('xfade', 'Crossfader A ↔ B', 'Directo', 0, 100, (s) => Math.round((s.s.xfade ?? 0.5) * 100), (s, v) => s.set({ xfade: v / 100 })),
  range('intensidad', 'Intensidad (todos los estímulos)', 'Directo', 0, 200, (s) => Math.round((s.s.intensidad ?? 1) * 100), (s, v) => s.set({ intensidad: v / 100 })),
  range('kit_vol', 'Volumen del kit (compu)', 'Mezcla', 0, 100, (s) => Math.round((s.s.kitVol ?? 0.7) * 100), (s, v) => s.setKitVol(v / 100, false)),
  range('filtro', 'Filtro de la compu', 'Mezcla', 0, 100, (s) => Math.round((s.s.fx?.filtro ?? 1) * 100), (s, v) => s.setFx({ filtro: v / 100 }, false)),
  // por pista (1 y 2 conservan sus ids de siempre para no romper controles ya aprendidos; 3 y 4 son Pro)
  ...TRACK_IDS.flatMap((id, i) => [
    range(`lvl_${id}`, `Nivel pista ${i + 1}`, 'Mezcla', 20, 100, (s) => Math.round((s.track(id)?.level ?? 1) * 100), (s, v) => s.track(id) && s.setTrack(id, { level: v / 100 }, false)),
    range(`rev_${id}`, `Reverb pista ${i + 1}`, 'Mezcla', 0, 100, (s) => Math.round((s.track(id)?.rev ?? 0) * 100), (s, v) => s.track(id) && s.setTrack(id, { rev: v / 100 }, false)),
    trig(`mute_${id}`, `Silenciar pista ${i + 1}`, 'Mezcla', (s) => s.track(id) && s.setTrack(id, { mute: !s.track(id).mute })),
  ]),
  trig('play', 'Tocar / detener', 'Acciones', (s) => s.toggle()),
  trig('rec', 'Grabar', 'Acciones', (s) => s.toggleRec()),
  trig('mutar', 'Mutar pista', 'Acciones', (s) => s.mutateTrack()),
  trig('next', 'Siguiente escena', 'Escenas', (s) => { const have = SLOTS.filter((x) => s.s.scenes[x]); if (!have.length) return; const i = have.indexOf(s.s.sceneNow); s.launchScene(have[(i + 1) % have.length]); }),
  ...SLOTS.map((x) => trig(`scene_${x}`, `Escena ${x}`, 'Escenas', (s) => s.launchScene(x))),
];
export const targetById = (id) => TARGETS.find((t) => t.id === id);
export const FREE_MAPPINGS = 4;
const TYPE_LABEL = { cc: 'CC', note: 'Nota', pb: 'Palanca (pitch bend)', at: 'Presión' };
export const srcLabel = (m) => `${TYPE_LABEL[m.type] || m.type}${m.type === 'pb' || (m.type === 'at' && !m.num) ? '' : ` ${m.num}`} · canal ${m.ch}${m.port ? ` · ${m.port}` : ''}`;
const continuous = (t) => t === 'cc' || t === 'pb' || t === 'at';
const same = (a, b) => a.type === b.type && a.ch === b.ch && a.num === b.num && (!a.port || !b.port || a.port === b.port);

// mensaje entrante → aprender o aplicar
export function handleMidi(session, msg) {
  const s = session.s;
  if (s.learn) {
    const t = targetById(s.learn); if (!t) return;
    if (t.kind === 'range' && !continuous(msg.type)) return; // un rango necesita una perilla, fader, palanca o presión
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
