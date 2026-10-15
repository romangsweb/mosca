// Fly Punch · Visión: la cámara como ojo de mosca.
// Cada cuadro se reduce a una imagen pequeña (como los ~750 omatidios de cada ojo) y se calculan tres cosas que el ojo de la
// mosca también calcula: cuánta luz cambia (fotorreceptores R7/R8), cuánto se mueve la escena de lado (detectores T4/T5)
// y si algo se acerca (detectores de «looming» LPLC2 y LC4, que avisan a la fibra gigante para huir).
// Esos tres valores estimulan a esas neuronas en el conectoma; lo que pasa después lo decide el cerebro real.

const W = 48, H = 36; // resolución de trabajo (la mosca ve aún menos: unos 25 × 30 omatidios por ojo)

export class Vision {
  constructor() { this.on = false; this.vals = { luz: 0, movimiento: 0, acercar: 0 }; this.raw = { luz: 0, flujo: 0, div: 0 }; this.frame = null; this.prev = null; this.listeners = new Set(); }
  async start(deviceId) {
    this.stop();
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }), width: { ideal: 320 }, height: { ideal: 240 } }, audio: false });
    const v = (this.video = document.createElement('video')); v.muted = true; v.playsInline = true; v.srcObject = this.stream; await v.play();
    const c = (this.cv = document.createElement('canvas')); c.width = W; c.height = H; this.g = c.getContext('2d', { willReadFrequently: true });
    this.on = true; this.prev = null; this.loop();
  }
  stop() { this.on = false; cancelAnimationFrame(this.raf); this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null; this.video = null; this.vals = { luz: 0, movimiento: 0, acercar: 0 }; this.frame = null; }
  loop() {
    if (!this.on) return;
    const now = performance.now();
    if (!this.last || now - this.last > 33) { this.last = now; this.process(); }
    this.raf = requestAnimationFrame(() => this.loop());
  }
  // un cuadro: luminancia (espejada, como un espejo), cambio de luz, flujo horizontal y expansión
  process() {
    const g = this.g; g.save(); g.scale(-1, 1); g.drawImage(this.video, -W, 0, W, H); g.restore();
    const d = g.getImageData(0, 0, W, H).data, L = new Float32Array(W * H);
    let mean = 0; for (let i = 0; i < W * H; i++) { L[i] = (0.25 * d[i * 4] + 0.6 * d[i * 4 + 1] + 0.15 * d[i * 4 + 2]) / 255; mean += L[i]; } mean /= W * H; // la mosca ve más el verde
    const P = this.prev; this.frame = L;
    if (!P) { this.prev = L; return; }
    // flujo óptico por regiones (Lucas–Kanade de una sola ventana por región): izquierda, derecha, arriba, abajo, todo
    const reg = { l: [0, 0, 0, 0, 0], r: [0, 0, 0, 0, 0], t: [0, 0, 0, 0, 0], b: [0, 0, 0, 0, 0], a: [0, 0, 0, 0, 0] };
    let dl = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, ix = (L[i + 1] - L[i - 1]) / 2, iy = (L[i + W] - L[i - W]) / 2, it = L[i] - P[i]; dl += Math.abs(it);
      const add = (R) => { R[0] += ix * ix; R[1] += ix * iy; R[2] += iy * iy; R[3] += ix * it; R[4] += iy * it; };
      add(reg.a); add(x < W / 2 ? reg.l : reg.r); add(y < H / 2 ? reg.t : reg.b);
    }
    // flujo «normal» por eje (robusto con bordes rectos): u = −ΣIxIt/ΣIx², v = −ΣIyIt/ΣIy²
    const fu = (R) => (R[0] > 1e-3 ? -R[3] / R[0] : 0), fv = (R) => (R[2] > 1e-3 ? -R[4] / R[2] : 0);
    const ua = fu(reg.a), div = (fu(reg.r) - fu(reg.l)) + (fv(reg.b) - fv(reg.t));
    const dMean = Math.abs(mean - (this.prevMean ?? mean)); this.prevMean = mean;
    this.raw = { luz: mean, cambio: dMean, flujo: ua, div, textura: dl / ((W - 2) * (H - 2)) };
    // a 0–1, con suavizado: sube rápido y baja despacio (como una neurona que se adapta)
    const sm = (k, x, up = 0.6, down = 0.12) => { const o = this.vals[k]; this.vals[k] = o + (x - o) * (x > o ? up : down); };
    sm('luz', Math.min(1, dMean * 12 + mean * 0.2));                       // los ocelos: sobre todo los cambios de luz de toda la escena
    sm('movimiento', Math.min(1, Math.abs(ua) * 0.9));                      // T4/T5: cuánto se desliza la escena de lado (px por cuadro)
    sm('acercar', Math.min(1, Math.max(0, div - 0.3) * 0.35), 0.7, 0.25);    // LPLC2/LC4: expansión (bordes que se abren hacia afuera)
    this.prev = L;
    this.listeners.forEach((f) => f(this));
  }
  onFrame(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
}
export const VISION_SIZE = { W, H };

// dibuja lo que ve la mosca: un mosaico hexagonal de omatidios (cada uno, un solo valor de luz)
export function drawCompoundEye(g, w, h, frame, { cols = 26, tint = [168, 255, 140] } = {}) {
  g.fillStyle = '#060607'; g.fillRect(0, 0, w, h);
  if (!frame) return;
  const r = w / (cols * Math.sqrt(3)), dx = r * Math.sqrt(3), dy = r * 1.5, rows = Math.ceil(h / dy) + 1;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols + 1; col++) {
    const cx = col * dx + (row % 2 ? dx / 2 : 0), cy = row * dy;
    const fx = Math.min(W - 1, Math.max(0, Math.floor((cx / w) * W))), fy = Math.min(H - 1, Math.max(0, Math.floor((cy / h) * H))), v = frame[fy * W + fx];
    const k = Math.pow(v, 0.8);
    g.fillStyle = `rgb(${Math.round(tint[0] * k)},${Math.round(tint[1] * k)},${Math.round(tint[2] * k)})`;
    g.beginPath(); for (let a = 0; a < 6; a++) { const an = Math.PI / 6 + (a * Math.PI) / 3; g.lineTo(cx + r * 0.92 * Math.cos(an), cy + r * 0.92 * Math.sin(an)); } g.fill();
  }
}
