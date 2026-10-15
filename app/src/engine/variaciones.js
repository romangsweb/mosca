// Fly Punch · variaciones de una toma: transforman lo que ya tocó la mosca en una toma nueva (la original no cambia).
// Todas son deterministas salvo «más densa», «más escasa» y «humanizar», que usan azar con semilla (misma toma → mismo resultado).
import { compas } from './compas.js';
import { analyzeTake, scaleOf } from './armonia.js';

export const VARIACIONES = [
  ['mitad', 'Mitad de tiempo', 'Todo dura el doble: más lento y pesado, al mismo tempo.'],
  ['doble', 'Doble de tiempo', 'Todo pasa el doble de rápido y se repite para llenar la toma.'],
  ['densa', 'Más densa', 'Agrega repiques (semicorcheas fantasma) cerca de los golpes.'],
  ['escasa', 'Más escasa', 'Deja los golpes fuertes y en tiempo; quita relleno.'],
  ['invertida', 'Al revés', 'La toma de atrás hacia adelante.'],
  ['respuesta', 'Pregunta y respuesta', 'Cada compás par contesta al anterior: mismo ritmo, melodía en espejo que resuelve en la tónica.'],
  ['humanizar', 'Humanizar', 'Pequeños empujones de tiempo y fuerza, como tocado a mano.'],
  ['cuantizar', 'Cuantizar', 'Todo exacto a la semicorchea.'],
  ['transponer', 'Transponer', 'Sube o baja las pistas melódicas; la batería queda igual.'],
];
const melodic = (e) => e.voice === 'tono' || e.voice === 'pad';
const rnd = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const seedOf = (take) => [...(take.id || take.name || 'x')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 4294967296, 7);
const clampV = (v) => Math.max(1, Math.min(127, Math.round(v)));

export function variar(take, op, valor = 0) {
  const stepMs = 60000 / (take.bpm || 110) / 4, C = compas(take.compas || '4/4'), barMs = C.len * stepMs, R = rnd(seedOf(take) + op.length);
  let ev = take.events.map((e) => ({ ...e })), dur = take.durMs;
  switch (op) {
    case 'mitad': ev = ev.map((e) => ({ ...e, t: e.t * 2, ...(e.durMs ? { durMs: e.durMs * 2 } : {}) })); dur *= 2; break;
    case 'doble': { const half = ev.map((e) => ({ ...e, t: e.t / 2, ...(e.durMs ? { durMs: e.durMs / 2 } : {}) })); ev = [...half, ...half.map((e) => ({ ...e, t: e.t + dur / 2 }))]; break; }
    case 'densa': { const add = []; for (const e of ev) if (!e.chord && R() < 0.35) add.push({ ...e, t: e.t + stepMs * (R() < 0.5 ? 1 : -1), vel: clampV(e.vel * 0.55), ghost: 1 }); ev = [...ev, ...add.filter((e) => e.t >= 0 && e.t < dur)]; break; }
    case 'escasa': ev = ev.filter((e) => { const st = Math.round(e.t / stepMs) % 4; return st === 0 ? e.vel >= 60 || R() < 0.7 : R() < 0.2 + 0.45 * (e.vel / 127); }); break; // en tiempo se queda; el relleno, según su fuerza
    case 'invertida': ev = ev.map((e) => ({ ...e, t: Math.max(0, dur - e.t - (e.durMs || 0)) })); break;
    case 'humanizar': ev = ev.map((e) => ({ ...e, t: Math.max(0, e.t + (R() - 0.5) * 24), vel: clampV(e.vel + (R() - 0.5) * 20) })); break;
    case 'cuantizar': ev = ev.map((e) => ({ ...e, t: Math.round(e.t / stepMs) * stepMs })); break;
    case 'transponer': { const st = Math.max(-12, Math.min(12, Math.round(valor || 0))); ev = ev.map((e) => (melodic(e) ? { ...e, note: Math.max(0, Math.min(127, e.note + st)) } : e)); break; }
    case 'respuesta': {
      const an = analyzeTake(take), tonic = an.key ? an.key.tonic : null, sc = an.key ? scaleOf(an.key) : null, snap = (n) => { if (!sc) return n; for (let d = 0; d <= 2; d++) { if (sc.includes(((n - d) % 12 + 12) % 12)) return n - d; if (sc.includes(((n + d) % 12 + 12) % 12)) return n + d; } return n; }, bars = Math.ceil(dur / barMs), out = [];
      for (let b = 0; b < bars; b++) {
        const src = b % 2 ? b - 1 : b, inBar = ev.filter((e) => e.t >= src * barMs && e.t < (src + 1) * barMs);
        if (b % 2 === 0) { out.push(...ev.filter((e) => e.t >= b * barMs && e.t < (b + 1) * barMs)); continue; }
        const mel = inBar.filter(melodic).sort((x, y) => x.t - y.t), axis = mel[0]?.note;
        const lastMel = mel[mel.length - 1];
        for (const e of inBar) {
          const t = e.t + barMs; if (t >= dur) continue;
          if (melodic(e) && axis != null) { let n = snap(2 * axis - e.note); /* espejo dentro de la escala */ if (e === lastMel && tonic != null) { const base = n - (((n % 12) + 12) % 12) + tonic; n = Math.abs(base - n) <= 6 ? base : base + (base < n ? 12 : -12); } out.push({ ...e, t, note: Math.max(0, Math.min(127, n)) }); }
          else if (R() > 0.2) out.push({ ...e, t }); // la batería contesta casi igual
        }
      }
      ev = out; break;
    }
    default: return null;
  }
  ev = ev.filter((e) => e.t >= 0 && e.t < dur + 1).sort((a, b) => a.t - b.t).map((e) => ({ ...e, step: Math.round(e.t / stepMs) }));
  return { ...take, events: ev, durMs: dur, steps: Math.round(dur / stepMs) };
}
// varias en cadena (para lo que proponga la IA)
export function variarCadena(take, ops) { let t = take; for (const { op, valor } of ops) { const n = variar(t, op, valor); if (n) t = n; } return t; }
export const nombreVar = (op, valor) => (op === 'transponer' ? `${valor > 0 ? '+' : ''}${valor} st` : VARIACIONES.find((v) => v[0] === op)?.[1].toLowerCase() || op);
