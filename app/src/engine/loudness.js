// Fly Punch · volumen percibido (LUFS, ITU-R BS.1770-4 / EBU R128) y limitador.
// Con esto el WAV exportado sale al volumen que piden las plataformas y sin recortes digitales.

export const TARGETS = {
  off: ['Sin normalizar', null],
  streaming: ['−14 LUFS · Spotify, YouTube', -14],
  apple: ['−16 LUFS · Apple Music, podcasts', -16],
  club: ['−9 LUFS · club, DJ', -9],
};

// filtro K (dos biquads: estante +4 dB arriba de ~1.7 kHz y paso altas en 38 Hz), coeficientes para cualquier frecuencia de muestreo
export function kCoefs(sr) {
  const shelf = (() => { const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196, K = Math.tan(Math.PI * f0 / sr), Vh = 10 ** (G / 20), Vb = Vh ** 0.4996667741545416, a0 = 1 + K / Q + K * K;
    return { b: [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], a: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] }; })();
  const hp = (() => { const f0 = 38.13547087602444, Q = 0.5003270373238773, K = Math.tan(Math.PI * f0 / sr), a0 = 1 + K / Q + K * K;
    return { b: [1, -2, 1], a: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] }; })();
  return [shelf, hp];
}
function filt(x, { b, a }) {
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
// sonoridad integrada con compuertas (absoluta −70 LUFS y relativa −10 LU), bloques de 400 ms con 75 % de traslape
export function integratedLufs(channels, sr) {
  const [sh, hp] = kCoefs(sr), kw = channels.map((c) => filt(filt(c, sh), hp));
  const blk = Math.round(0.4 * sr), hop = Math.round(0.1 * sr), z = [];
  for (let s = 0; s + blk <= kw[0].length; s += hop) { let e = 0; for (const c of kw) { let m = 0; for (let i = s; i < s + blk; i++) m += c[i] * c[i]; e += m / blk; } z.push(e); }
  const L = (e) => -0.691 + 10 * Math.log10(e);
  const abs = z.filter((e) => L(e) > -70); if (!abs.length) return -Infinity;
  const rel = L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10, g = abs.filter((e) => L(e) > rel);
  return L(g.reduce((a, b) => a + b, 0) / g.length);
}
// pico real aproximado: interpolación ×4 (Catmull-Rom) para encontrar picos entre muestras
export function truePeak(channels) {
  let m = 0;
  for (const c of channels) for (let i = 1; i < c.length - 2; i++) {
    const p0 = c[i - 1], p1 = c[i], p2 = c[i + 1], p3 = c[i + 2]; m = Math.max(m, Math.abs(p1));
    for (const t of [0.25, 0.5, 0.75]) { const v = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t); m = Math.max(m, Math.abs(v)); }
  }
  return m;
}
const db = (x) => 20 * Math.log10(Math.max(1e-9, x));

// limitador con anticipación (5 ms) y relajación suave: ninguna muestra pasa del techo, sin distorsión audible
export function limit(channels, sr, ceilingDb = -1, releaseMs = 80) {
  const ceil = 10 ** (ceilingDb / 20) * 0.94, n = channels[0].length, L = Math.max(1, Math.round(0.005 * sr)); // 0.94: margen para picos entre muestras
  const req = new Float32Array(n); for (let i = 0; i < n; i++) { let p = 0; for (const c of channels) p = Math.max(p, Math.abs(c[i])); req[i] = p > ceil ? ceil / p : 1; }
  // mínimo en una ventana que mira L muestras adelante (deque monótono, O(n))
  const mn = new Float32Array(n), dq = new Int32Array(n + L); let h = 0, t = 0;
  for (let i = 0; i < n + L; i++) {
    if (i < n) { while (t > h && req[dq[t - 1]] >= req[i]) t--; dq[t++] = i; }
    const o = i - L; if (o < 0) continue; while (dq[h] < o) h++; mn[o] = req[dq[h]];
  }
  // promedio de L muestras: la ganancia baja en rampa y llega justo al valor necesario en el pico
  const g = new Float32Array(n); let acc = 0; for (let i = 0; i < n; i++) { acc += mn[i] - (i >= L ? mn[i - L] : 0); g[i] = (acc + Math.max(0, L - 1 - i) * mn[0]) / L; } // antes del inicio: ya atenuado
  // baja de inmediato con la rampa; sube despacio (relajación) para no «bombear»
  const rel = 1 - Math.exp(-1 / (releaseMs / 1000 * sr)); let cur = 1, red = 0;
  for (let i = 0; i < n; i++) { cur = g[i] < cur ? g[i] : cur + (g[i] - cur) * rel; red = Math.max(red, 1 - cur); for (const c of channels) c[i] *= cur; }
  return db(1 - red); // reducción máxima en dB (negativa)
}

// normaliza un AudioBuffer (en su lugar) al objetivo LUFS y lo limita a −1 dBTP. Devuelve el informe.
export function master(buffer, targetLufs = -14, ceilingDb = -1) {
  const ch = [...Array(buffer.numberOfChannels)].map((_, i) => buffer.getChannelData(i)), sr = buffer.sampleRate, orig = ch.map((c) => c.slice());
  const before = integratedLufs(ch, sr);
  let gainDb = 0, reduction = 0, after = before;
  // el limitador baja los picos y con ello un poco la sonoridad: se corrige la ganancia y se repite (máx. 4 vueltas)
  for (let it = 0; it < 4; it++) {
    if (targetLufs == null || !Number.isFinite(before)) { reduction = limit(ch, sr, ceilingDb); after = integratedLufs(ch, sr); break; }
    gainDb = Math.max(-24, Math.min(30, gainDb + (targetLufs - after))); const g = 10 ** (gainDb / 20);
    ch.forEach((c, k) => { const o = orig[k]; for (let i = 0; i < c.length; i++) c[i] = o[i] * g; });
    reduction = limit(ch, sr, ceilingDb); after = integratedLufs(ch, sr);
    if (Math.abs(after - targetLufs) < 0.3 || reduction < -12) break; // no aplastar más de 12 dB
  }
  return { before: +before.toFixed(1), after: +after.toFixed(1), gainDb: +gainDb.toFixed(1), limiterDb: +reduction.toFixed(1), peakDb: +db(truePeak(ch)).toFixed(1) };
}

// medidor en vivo: K-weighting con nodos de Web Audio y energía de 400 ms (momentáneo) y 3 s (corto plazo)
export function liveMeter(ctx, source) {
  const sh = ctx.createBiquadFilter(); sh.type = 'highshelf'; sh.frequency.value = 1500; sh.gain.value = 4;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38; hp.Q.value = 0.5;
  const an = ctx.createAnalyser(); an.fftSize = 2048; source.connect(sh).connect(hp).connect(an);
  const pk = ctx.createAnalyser(); pk.fftSize = 2048; source.connect(pk);
  const buf = new Float32Array(an.fftSize), pb = new Float32Array(pk.fftSize), hist = []; let peak = 0, peakAt = 0;
  return {
    read() { // llamar ~20 veces por segundo
      an.getFloatTimeDomainData(buf); let e = 0; for (const v of buf) e += v * v; e /= buf.length;
      pk.getFloatTimeDomainData(pb); let p = 0; for (const v of pb) p = Math.max(p, Math.abs(v));
      const now = performance.now(); hist.push([now, e]); while (hist.length && now - hist[0][0] > 3000) hist.shift();
      if (p >= peak || now - peakAt > 1500) { peak = p; peakAt = now; }
      const m = hist.filter(([t]) => now - t < 400), avg = (a) => a.reduce((s, [, x]) => s + x, 0) / Math.max(1, a.length), L = (x) => (x > 1e-10 ? -0.691 + 10 * Math.log10(x) : -Infinity);
      return { momentary: L(avg(m)), short: L(avg(hist)), peakDb: db(peak) };
    },
    stop() { try { source.disconnect(sh); source.disconnect(pk); } catch {} },
  };
}
