// Fly Punch · chop: corta un loop en golpes (detección de transitorios) y ordena los cortes del más grave al más brillante,
// así cada corte cae en la voz de Mi kit de su familia (graves → bombo/bajo/tom, agudos → hats). La mosca toca tus cortes.
import { wavBlob } from './synth.js';

// las 10 voces de Mi kit, de la más grave a la más brillante
export const ORDEN_VOCES = ['bombo', 'bajo', 'tom', 'caja', 'palmas', 'aro', 'perc', 'zap', 'hat', 'hat abierto'];
const HOP = 0.01; // 10 ms

// sensibilidad 0–1: más alta = más cortes
export function transientes(buf, sens = 0.5, max = 10) {
  const sr = buf.sampleRate, hop = Math.round(sr * HOP), n = Math.floor(buf.length / hop), ch = [...Array(buf.numberOfChannels)].map((_, c) => buf.getChannelData(c));
  const e = new Float32Array(n); let prev = 0;
  for (let i = 0; i < n; i++) { let s = 0; for (let j = i * hop; j < (i + 1) * hop; j++) { let x = 0; for (const d of ch) x += d[j]; x /= ch.length; const hp = x - prev; prev = x; s += hp * hp; } e[i] = Math.log10(1e-9 + s / hop); }
  // novedad: cuánto sube la energía respecto a lo reciente
  const nov = new Float32Array(n); for (let i = 1; i < n; i++) { let m = 0; for (let k = Math.max(0, i - 8); k < i; k++) m += e[k]; m /= Math.min(8, i); nov[i] = Math.max(0, e[i] - m); }
  const mean = nov.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(nov.reduce((a, b) => a + (b - mean) ** 2, 0) / n), thr = mean + sd * (2.2 - sens * 1.8), minGap = Math.round(0.07 / HOP);
  let picks = [];
  for (let i = 2; i < n - 1; i++) if (nov[i] > thr && nov[i] >= nov[i - 1] && nov[i] >= nov[i + 1] && (!picks.length || i - picks[picks.length - 1].i >= minGap)) picks.push({ i, s: nov[i] });
  if (!picks.length || picks[0].i > 3) picks.unshift({ i: 0, s: Infinity }); // el inicio siempre es un corte
  picks = picks.sort((a, b) => b.s - a.s).slice(0, max).sort((a, b) => a.i - b.i);
  return picks.map((p) => Math.max(0, p.i * hop - Math.round(sr * 0.004))); // un poquito antes del golpe
}
// los cortes como buffers (máx. 2 s cada uno), con fundidos cortos y normalizados
export function cortar(ctx, buf, starts) {
  const sr = buf.sampleRate;
  return starts.map((a, k) => {
    const b = Math.min(buf.length, starts[k + 1] ?? buf.length, a + sr * 2), n = Math.max(1, b - a), out = ctx.createBuffer(buf.numberOfChannels, n, sr), fi = Math.min(Math.round(sr * 0.002), n >> 2), fo = Math.min(Math.round(sr * 0.012), n >> 2);
    let pk = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = a; i < b; i++) pk = Math.max(pk, Math.abs(d[i])); }
    const g = pk > 1e-4 ? 0.89 / pk : 1;
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c), o = out.getChannelData(c); for (let i = 0; i < n; i++) o[i] = d[a + i] * g * Math.min(1, i / fi, (n - 1 - i) / fo); }
    return { buf: out, start: a / sr, dur: n / sr, brillo: centroide(out) };
  });
}
// centro espectral aproximado por cruces por cero (barato y suficiente para ordenar de grave a brillante)
function centroide(b) { const d = b.getChannelData(0), n = Math.min(d.length, b.sampleRate * 0.25); let z = 0; for (let i = 1; i < n; i++) if ((d[i - 1] < 0) !== (d[i] < 0)) z++; return (z * b.sampleRate) / (2 * n); }
// asigna cada corte a una voz: del más grave al más brillante
export function asignar(cortes) { return [...cortes].sort((a, b) => a.brillo - b.brillo).map((c, i) => ({ ...c, voz: ORDEN_VOCES[i] })); }
export const aArchivo = (c, nombre, i) => new File([wavBlob(c.buf)], `${nombre} · corte ${i + 1}.wav`.replace(/[\\/]/g, '-'), { type: 'audio/wav' });
