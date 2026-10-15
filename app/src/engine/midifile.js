// Fly Punch · exportar tomas: MIDI estándar (formato 1, una pista por pista de Fly Punch) y CSV de disparos.
import { midiSig } from './compas.js';
const PPQ = 96;
const vlq = (n) => { const b = [n & 0x7F]; while ((n >>= 7)) b.unshift((n & 0x7F) | 0x80); return b; };
const str = (s) => [...new TextEncoder().encode(s)];
const chunk = (id, data) => [...str(id), (data.length >>> 24) & 255, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255, ...data];

export function takeToMidi(take, { namePads = true } = {}) {
  const msPerTick = 60000 / take.bpm / PPQ, tracks = [];
  const tempo = Math.round(60000000 / take.bpm);
  const [nn, dd] = midiSig(take.compas);
  tracks.push([0, 0xFF, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255, 0, 0xFF, 0x58, 4, nn, dd, dd === 3 ? 12 : 24, 8, ...vlq(0), 0xFF, 0x03, ...vlq(str(take.name).length), ...str(take.name), 0, 0xFF, 0x2F, 0]);
  for (const tr of take.tracks) {
    const evs = [];
    for (const e of take.events) if (e.track === tr.id) {
      const t0 = Math.round(e.t / msPerTick), c = (e.ch - 1) & 15;
      evs.push([t0, 0x90 | c, e.note, e.vel], [t0 + Math.max(12, Math.round((e.durMs || 0) / msPerTick)), 0x80 | c, e.note, 0]); // los acordes de la armonía duran lo que suenan
    }
    evs.sort((a, b) => a[0] - b[0] || (a[1] & 0xF0) - (b[1] & 0xF0));
    const label = namePads ? `${tr.name} · grupo ${tr.group}` : tr.name;
    const d = [0, 0xFF, 0x03, ...vlq(str(label).length), ...str(label)];
    let last = 0; for (const [t, s, n, v] of evs) { d.push(...vlq(t - last), s, n, v); last = t; }
    d.push(0, 0xFF, 0x2F, 0); tracks.push(d);
  }
  const head = [0, 1, (tracks.length >> 8) & 255, tracks.length & 255, (PPQ >> 8) & 255, PPQ & 255];
  return new Blob([new Uint8Array([...chunk('MThd', head), ...tracks.flatMap((t) => chunk('MTrk', t))])], { type: 'audio/midi' });
}

export function takeToCsv(take) {
  const rows = ['tiempo_ms,paso,pista,pad,neurona,nota,velocidad,canal'];
  for (const e of take.events) rows.push([e.t.toFixed(1), e.step, e.track, e.pad, e.neuron, e.note, e.vel, e.ch].join(','));
  return new Blob([rows.join('\n')], { type: 'text/csv' });
}

export function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
export const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'toma';
