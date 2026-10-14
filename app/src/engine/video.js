// Fly Punch · escena vertical de una toma (1080×1920): el cerebro que la tocó, las neuronas que disparan y los pads.
// La usan el video para redes (MediaRecorder) y la página pública de una toma compartida.
import { session, CIRCUITS } from './session.js';

export const W = 1080, H = 1920;
const ACC = '255,106,26', STEEL = '125,147,178', WHITE = '236,236,238', MONO = 'JetBrains Mono, ui-monospace, monospace';
export const videoSupported = () => typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
const pickType = () => ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';

export function makeScene(take, cv, { author = null } = {}) {
  const D = session.D, g = cv.getContext('2d');
  // fondo fijo: la nube del cerebro en vista frontal (se dibuja una vez)
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H; const b = bg.getContext('2d');
  const raw = session.cloud; let mx = 0, my = 0, n3 = 0, ext = 0;
  for (let i = 0; i < raw.length; i += 9) { mx += raw[i] / 10; my += raw[i + 1] / 10; n3++; } mx /= n3; my /= n3;
  for (let i = 0; i < raw.length; i += 9) ext = Math.max(ext, Math.abs(raw[i] / 10 - mx));
  const k = (W * 0.44) / ext, cx = W / 2, cy = 780, proj = (x, y) => [cx - (x - mx) * k, cy + (y - my) * k];
  const grd = b.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#0E0E10'); grd.addColorStop(1, '#070708'); b.fillStyle = grd; b.fillRect(0, 0, W, H);
  b.fillStyle = 'rgba(217,220,225,0.13)'; for (let i = 0; i < raw.length; i += 6) { const [x, y] = proj(raw[i] / 10, raw[i + 1] / 10); b.fillRect(x, y, 1.6, 1.6); }
  for (let i = 0; i < D.n; i++) { const [x, y] = proj(...D.pos_um[i]); b.fillStyle = `rgba(${D.inh[i] ? STEEL : ACC},0.28)`; b.fillRect(x - 1.5, y - 1.5, 3, 3); }
  const tracks = (take.tracks || []).map((t) => ({ ...t, pads: (D.modos[t.sense] || D.modos.gusto).pads }));
  const ev = [...take.events].sort((a, z) => a.t - z.t);
  let glow, padE, names, ei, lastT;
  const reset = () => { glow = new Map(); padE = tracks.map(() => new Float32Array(12)); names = []; ei = 0; lastT = 0; };
  reset();
  const text = (s, x, y, size, color, weight = 500, align = 'left', font = 'Inter, system-ui, sans-serif') => { g.font = `${weight} ${size}px ${font}`; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y); };
  const draw = (t, progress = Math.min(1, t / take.durMs)) => {
    if (t < lastT) reset(); lastT = t;
    while (ei < ev.length && ev[ei].t <= t) { const e = ev[ei++], ti = tracks.findIndex((x) => x.id === e.track); if (ti < 0) continue; const p = tracks[ti].pads[e.pad]; if (!p) continue; glow.set(p.idx, 1); padE[ti][e.pad] = 1; names.unshift({ n: p.tipo, at: t, inh: p.inhibidora }); names.length = Math.min(names.length, 5); }
    g.drawImage(bg, 0, 0);
    for (const [i, a] of glow) {
      const [x, y] = proj(...D.pos_um[i]), col = D.inh[i] ? STEEL : ACC, r = 10 + a * 46;
      const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(${col},${0.85 * a})`); rg.addColorStop(1, `rgba(${col},0)`); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
      g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(x - 3, y - 3, 6, 6);
      const na = a * 0.93; if (na < 0.03) glow.delete(i); else glow.set(i, na);
    }
    text('FLY PUNCH', 80, 150, 34, `rgb(${WHITE})`, 700, 'left', MONO);
    text(author ? `por ${author}` : 'un cerebro real de mosca tocando', 80, 196, 30, 'rgba(236,236,238,.6)');
    text(take.name, 80, 300, 76, `rgb(${WHITE})`, 700);
    text(`${take.bpm} BPM · ${tracks.map((x) => CIRCUITS[x.sense]?.name || x.name).join(' + ')} · FlyWire`, 80, 360, 30, `rgba(${ACC},1)`, 500, 'left', MONO);
    names.forEach((x, j) => { const a = Math.max(0, 1 - (t - x.at) / 1600); if (a <= 0) return; text(x.n, W - 80, 1280 - j * 46, 34, `rgba(${x.inh ? STEEL : ACC},${a})`, 600, 'right', MONO); });
    tracks.forEach((tr, ti) => {
      const y0 = 1360 + ti * 230, size = 64, gap = 12;
      text(`${tr.name} · ${CIRCUITS[tr.sense]?.name || ''}`.toUpperCase(), 80, y0 - 18, 26, 'rgba(236,236,238,.55)', 600, 'left', MONO);
      for (let p = 0; p < 12; p++) {
        const a = padE[ti][p], x = 80 + p * (size + gap), col = tr.pads[p]?.inhibidora ? STEEL : ACC;
        g.fillStyle = `rgba(${col},${0.12 + a * 0.8})`; g.beginPath(); g.roundRect(x, y0, size, size, 12); g.fill(); padE[ti][p] = a * 0.9;
      }
    });
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(80, 1820, W - 160, 6); g.fillStyle = `rgb(${ACC})`; g.fillRect(80, 1820, (W - 160) * progress, 6);
    text('flypunch.buildations.com', W / 2, 1880, 28, 'rgba(236,236,238,.55)', 500, 'center', MONO);
  };
  return { draw, reset };
}

export async function renderVideo(take, { useRealAudio = false, onProgress } = {}) {
  const ctx = session.synth.ensure(); if (ctx.state === 'suspended') await ctx.resume();
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const scene = makeScene(take, cv);
  // audio: el real grabado desde tu interfaz, o el kit de la compu
  const dest = ctx.createMediaStreamDestination(), taps = []; let realSrc = null;
  if (useRealAudio) {
    const blob = await session.getAudio(take.id);
    if (blob) { const buf = await ctx.decodeAudioData(await blob.arrayBuffer()); realSrc = ctx.createBufferSource(); realSrc.buffer = buf; realSrc.connect(dest); realSrc.connect(ctx.destination); }
  }
  if (!realSrc) for (const node of [session.synth.chain.comp, session.synth.chain.thru]) { node.connect(dest); taps.push(node); }
  const stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const type = pickType(), rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 192_000 } : undefined), chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((res) => (rec.onstop = res));
  const total = take.durMs + 1500; let t0 = 0, raf = 0;
  const loop = (now) => { const t = now - t0; scene.draw(t); onProgress?.(Math.min(1, t / total)); if (t < total) raf = requestAnimationFrame(loop); else rec.stop(); };
  rec.start(500); t0 = performance.now();
  if (realSrc) realSrc.start(); else session.playTake(take, null, { kitOnly: true });
  raf = requestAnimationFrame(loop);
  const guard = setTimeout(() => rec.state !== 'inactive' && rec.stop(), total + 4000); // si la pestaña pierde el foco, rAF se detiene
  await done; clearTimeout(guard); cancelAnimationFrame(raf);
  taps.forEach((nd) => { try { nd.disconnect(dest); } catch {} }); try { realSrc?.stop(); } catch {}
  stream.getTracks().forEach((x) => x.stop());
  const mime = rec.mimeType || type || 'video/webm';
  return { blob: new Blob(chunks, { type: mime }), ext: mime.includes('mp4') ? 'mp4' : 'webm' };
}
