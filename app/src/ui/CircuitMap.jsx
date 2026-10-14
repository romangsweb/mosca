import { useEffect, useRef } from 'react';
import { session } from '../engine/session.js';

// Mapa del circuito (2D): la nube del cerebro de fondo, las neuronas de los circuitos en su posición real,
// y las 12 neuronas de la pista dibujadas como esquema (sensores → interneuronas → salida)
// con sus conexiones reales del conectoma. Cada disparo enciende un halo y manda un pulso por sus conexiones.
const ACC = [255, 106, 26], STEEL = [125, 147, 178], WHITE = [236, 236, 238];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function buildGraph(D, pads) {
  const idxs = pads.map((p) => p.idx), pos = new Map(idxs.map((i, k) => [i, k]));
  const out = idxs.map(() => new Map()), inn = idxs.map(() => new Map()), direct = new Map();
  D.syn.pre.forEach((a, s) => {
    const b = D.syn.post[s], w = D.syn.w[s], ka = pos.get(a), kb = pos.get(b);
    if (ka !== undefined && kb !== undefined) direct.set(`${ka}-${kb}`, (direct.get(`${ka}-${kb}`) || 0) + w);
    if (ka !== undefined && kb === undefined) out[ka].set(b, (out[ka].get(b) || 0) + w);
    if (kb !== undefined && ka === undefined) inn[kb].set(a, (inn[kb].get(a) || 0) + w);
  });
  const edges = [];
  direct.forEach((w, key) => { const [a, b] = key.split('-').map(Number); if (a !== b && Math.abs(w) >= 0.5) edges.push({ a, b, w, direct: true }); });
  // conexiones de dos pasos (a → otra neurona → b): muestran el camino real aunque no haya sinapsis directa
  const ind = [];
  for (let a = 0; a < idxs.length; a++) for (let b = 0; b < idxs.length; b++) {
    if (a === b || direct.has(`${a}-${b}`)) continue;
    let s = 0; out[a].forEach((w1, m) => { const w2 = inn[b].get(m); if (w2) s += w1 * w2; });
    if (Math.abs(s) > 0) ind.push({ a, b, w: s / 8, direct: false });
  }
  ind.sort((x, y) => Math.abs(y.w) - Math.abs(x.w));
  return edges.concat(ind.slice(0, 14));
}
function column(p, k) {
  if (k === 11) return 3; // la salida de la pista (MN9 o DNg35)
  if (p.clase === 'sensor' || p.sentido) return 0; // entradas del circuito (sensores o neuronas que se estimulan directo, como pC1)
  if (p.clase === 'motoneurona') return 3;
  if (p.clase === 'descendente') return 2.2;
  return p.inhibidora ? 1 : 1.4;
}

export default function CircuitMap({ selTrack, selPad, onPick, sense }) {
  const cv = useRef(null), st = useRef({});
  useEffect(() => {
    const D = session.D, c = cv.current, g = c.getContext('2d'), N = D.n;
    // nube del cerebro y neuronas reales en vista frontal
    const raw = session.cloud, cloud = [];
    for (let i = 0; i < raw.length; i += 9) cloud.push(raw[i] / 10, raw[i + 1] / 10, raw[i + 2] / 10);
    let mx = 0, my = 0, mz = 0; const n3 = cloud.length / 3;
    for (let i = 0; i < cloud.length; i += 3) { mx += cloud[i]; my += cloud[i + 1]; mz += cloud[i + 2]; }
    mx /= n3; my /= n3; mz /= n3;
    let ext = 0; for (let i = 0; i < cloud.length; i += 3) ext = Math.max(ext, Math.abs(cloud[i] - mx));
    const isSensor = new Uint8Array(N); Object.values(D.grupos).forEach((gr) => gr.forEach((i) => (isSensor[i] = 1)));
    const act = new Float32Array(N), field = Array.from({ length: 170 }, () => [Math.random(), Math.random(), 4 + Math.random() * 6, Math.random() * 10]);
    const S = st.current;
    S.nodeE = new Float32Array(12); S.pulses = []; S.hover = -1; S.selPad = selPad;
    const setTrack = (trackId) => {
      const t = session.track(trackId), pads = session.pads(t);
      S.pads = pads; S.edges = buildGraph(D, pads);
      const cols = {}; pads.forEach((p, k) => { const col = column(p, k); (cols[col] ||= []).push(k); });
      S.layout = new Array(12);
      Object.entries(cols).forEach(([col, ks]) => { ks.sort((a, b) => (pads[a].inhibidora - pads[b].inhibidora) || a - b); ks.forEach((k, j) => (S.layout[k] = [+col / 3, ks.length === 1 ? 0.5 : j / (ks.length - 1)])); });
      S.idxToK = new Map(pads.map((p, k) => [p.idx, k]));
    };
    S.setTrack = setTrack; setTrack(selTrack);
    const off = session.onStep((n, cnt) => {
      for (let i = 0; i < N; i++) if (cnt[i]) act[i] = 1;
      const ms = session.ko.stepMs;
      S.pads.forEach((p, k) => {
        if (!cnt[p.idx]) return; S.nodeE[k] = 1;
        S.edges.forEach((e) => { if (e.a === k && S.pulses.length < 160) S.pulses.push({ e, t0: performance.now(), dur: ms * (e.direct ? 2.5 : 4) }); });
      });
    });
    let W = 0, H = 0, dpr = 1, raf, last = performance.now();
    const geo = () => {
      const cx = W / 2, cy = H * 0.4, k = (W * 0.4) / ext;
      const bx0 = W * 0.27, bx1 = W * 0.73, by0 = H * 0.55, by1 = H * 0.86;
      return { cx, cy, k, nodeXY: (kk) => { const [u, v] = S.layout[kk]; return [bx0 + u * (bx1 - bx0), by0 + v * (by1 - by0)]; } };
    };
    const curve = (x1, y1, x2, y2) => { const mxp = (x1 + x2) / 2, myp = (y1 + y2) / 2 - Math.max(18, Math.abs(x2 - x1) * 0.22); return [mxp, myp]; };
    const qpt = (x1, y1, qx, qy, x2, y2, t) => { const a = 1 - t; return [a * a * x1 + 2 * a * t * qx + t * t * x2, a * a * y1 + 2 * a * t * qy + t * t * y2]; };
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const w = c.clientWidth, h = c.clientHeight;
      if (w !== W || h !== H) { W = w; H = h; dpr = Math.min(2, devicePixelRatio); c.width = W * dpr; c.height = H * dpr; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const G = geo(), decay = Math.pow(0.025, dt), sway = Math.sin(now / 9000) * 0.18, ca = Math.cos(sway), sa = Math.sin(sway);
      const proj = (x, y, z) => { x -= mx; z -= mz; const X = x * ca - z * sa; return [G.cx - X * G.k, G.cy + (y - my) * G.k]; };
      // campo generativo
      for (const f of field) { const a = now / 60000 + f[3]; const r = Math.hypot(f[0] - 0.5, f[1] - 0.5); const ang = Math.atan2(f[1] - 0.5, f[0] - 0.5) + now / 240000; g.fillStyle = `rgba(255,255,255,${0.12 + 0.18 * (0.5 + 0.5 * Math.sin(now / 1000 / f[2] + f[3]))})`; g.fillRect(W / 2 + Math.cos(ang) * r * W, H / 2 + Math.sin(ang) * r * H, 1, 1); }
      // nube
      g.fillStyle = 'rgba(217,220,225,0.16)';
      for (let i = 0; i < cloud.length; i += 3) { const [x, y] = proj(cloud[i], cloud[i + 1], cloud[i + 2]); g.fillRect(x, y, 1, 1); }
      // neuronas reales que disparan
      for (let i = 0; i < N; i++) {
        act[i] *= decay; const p = D.pos_um[i]; const [x, y] = proj(p[0], p[1], p[2]), a = act[i];
        const col = isSensor[i] ? WHITE : D.inh[i] ? STEEL : ACC;
        g.fillStyle = rgba(col, 0.1 + a * 0.7); const r = 0.9 + a * 1.6; g.fillRect(x - r / 2, y - r / 2, r, r);
      }
      // esquema: velo oscuro detrás para que se lea sobre la nube
      { const vg = g.createRadialGradient(W / 2, H * 0.71, 10, W / 2, H * 0.71, W * 0.34); vg.addColorStop(0, 'rgba(8,8,10,0.78)'); vg.addColorStop(1, 'rgba(8,8,10,0)'); g.fillStyle = vg; g.fillRect(0, H * 0.3, W, H * 0.7); }
      // esquema: conexiones
      const nodes = S.layout.map((_, kk) => G.nodeXY(kk));
      for (const e of S.edges) {
        const [x1, y1] = nodes[e.a], [x2, y2] = nodes[e.b], [qx, qy] = curve(x1, y1, x2, y2), inh = e.w < 0;
        const focus = S.selPad === e.a || S.selPad === e.b;
        g.strokeStyle = rgba(inh ? STEEL : ACC, (e.direct ? 0.26 : 0.12) + (focus ? 0.25 : 0)); g.lineWidth = e.direct ? Math.min(3, 0.8 + Math.abs(e.w) / 15) : 0.8;
        g.setLineDash(e.direct ? [] : [3, 4]); g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(qx, qy, x2, y2); g.stroke();
        if (inh && e.direct) { const [ex, ey] = qpt(x1, y1, qx, qy, x2, y2, 0.9), [fx, fy] = qpt(x1, y1, qx, qy, x2, y2, 0.86); const ang = Math.atan2(ey - fy, ex - fx) + Math.PI / 2; g.setLineDash([]); g.beginPath(); g.moveTo(ex + Math.cos(ang) * 5, ey + Math.sin(ang) * 5); g.lineTo(ex - Math.cos(ang) * 5, ey - Math.sin(ang) * 5); g.stroke(); }
      }
      g.setLineDash([]);
      // pulsos viajando
      S.pulses = S.pulses.filter((pl) => {
        const t = (now - pl.t0) / pl.dur; if (t >= 1) return false; if (t < 0) return true;
        const [x1, y1] = nodes[pl.e.a], [x2, y2] = nodes[pl.e.b], [qx, qy] = curve(x1, y1, x2, y2), col = pl.e.w < 0 ? STEEL : ACC;
        g.lineCap = 'round';
        for (let s = 0; s < 6; s++) { const tt = Math.max(0, t - s * 0.025), [px, py] = qpt(x1, y1, qx, qy, x2, y2, tt); g.fillStyle = rgba(col, (1 - s / 6) * (1 - t * 0.4)); g.beginPath(); g.arc(px, py, 2.4 - s * 0.3, 0, Math.PI * 2); g.fill(); }
        return true;
      });
      // nodos
      S.pads.forEach((p, kk) => {
        const [x, y] = nodes[kk], e = (S.nodeE[kk] *= decay), col = p.clase === 'sensor' ? WHITE : p.inhibidora ? STEEL : ACC, sel = kk === S.selPad, out = kk === 11;
        if (e > 0.02) { const r = 8 + (1 - e) * 22, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, 0.75 * e)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
        if (sel) { g.strokeStyle = rgba(col, 0.9); g.lineWidth = 1; g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.stroke();
          const P = D.pos_um[p.idx], [rx, ry] = proj(P[0], P[1], P[2]); g.setLineDash([2, 4]); g.strokeStyle = rgba(col, 0.45); g.beginPath(); g.moveTo(x, y); g.lineTo(rx, ry); g.stroke(); g.setLineDash([]); g.fillStyle = rgba(col, 1); g.beginPath(); g.arc(rx, ry, 2.5, 0, Math.PI * 2); g.fill(); }
        const R = out ? 6 : 4.5;
        g.fillStyle = '#08080A'; g.strokeStyle = rgba(col, 0.6 + e * 0.4); g.lineWidth = out ? 2 : 1.6; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill(); g.stroke();
        if (e > 0.3) { g.fillStyle = rgba(col, e); g.beginPath(); g.arc(x, y, R - 2, 0, Math.PI * 2); g.fill(); }
        const left = S.layout[kk][0] < 0.1;
        g.font = `${sel || S.hover === kk ? 600 : 400} 10px "JetBrains Mono", ui-monospace, monospace`; g.textAlign = left ? 'right' : 'left'; g.textBaseline = 'middle';
        g.fillStyle = sel ? '#ECECEE' : e > 0.4 ? '#C4C4CA' : '#8C8C94'; g.fillText(p.tipo, x + (left ? -12 : 12), y);
      });
      // optogenética: un haz de luz baja por la fibra hasta cada neurona elegida (roja activa, verde silencia)
      const O = session.live.opto, oo = session.s.opto;
      if (oo?.on) {
        const col = oo.mode === 'silenciar' ? [56, 224, 123] : [255, 59, 48];
        const tg = O && now >= O.at && now - O.at < 460 ? O : null, a = tg ? 1 - (now - tg.at) / 460 : 0;
        for (const i of tg ? tg.ids : session.optoTargets()) {
          const P = D.pos_um[i], [x, y] = proj(P[0], P[1], P[2]);
          if (tg) {
            const beam = g.createLinearGradient(x, 0, x, y); beam.addColorStop(0, rgba(col, 0)); beam.addColorStop(1, rgba(col, 0.32 * a));
            g.fillStyle = beam; g.beginPath(); g.moveTo(x - 2, 0); g.lineTo(x + 2, 0); g.lineTo(x + 14, y); g.lineTo(x - 14, y); g.closePath(); g.fill();
            const r = 10 + 26 * a, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, 0.8 * a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
            const kk = S.idxToK.get(i); if (kk !== undefined) { const [nx, ny] = nodes[kk]; g.strokeStyle = rgba(col, a); g.lineWidth = 2; g.beginPath(); g.arc(nx, ny, 10 + (1 - a) * 18, 0, Math.PI * 2); g.stroke(); }
          } else { g.strokeStyle = rgba(col, 0.5); g.lineWidth = 1; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.stroke(); }
        }
        if (tg) { g.fillStyle = rgba(col, 0.5 * a); g.fillRect(0, 0, W, 2); }
      }
      // columnas
      g.font = '500 9px "JetBrains Mono", monospace'; g.fillStyle = '#55555C'; g.textAlign = 'center';
      [['SENSORES', 0], ['INTERNEURONAS', 0.4], ['DESCENDENTES', 0.73], ['SALIDA', 1]].forEach(([l, u]) => g.fillText(l, W * 0.27 + u * W * 0.46, H * 0.55 - 26));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const hit = (e) => { const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, G = geo(); let best = -1, bd = 22 * 22; S.layout.forEach((_, kk) => { const [nx, ny] = G.nodeXY(kk), d = (nx - x) ** 2 + (ny - y) ** 2; if (d < bd) { bd = d; best = kk; } }); return best; };
    const move = (e) => { S.hover = hit(e); c.style.cursor = S.hover >= 0 ? 'pointer' : 'default'; };
    const click = (e) => { const k = hit(e); if (k >= 0) { st.current.onPick?.(k); session.tapPad(k); } };
    c.addEventListener('pointermove', move); c.addEventListener('click', click);
    return () => { cancelAnimationFrame(raf); off(); c.removeEventListener('pointermove', move); c.removeEventListener('click', click); };
  }, []);
  useEffect(() => { st.current.onPick = onPick; }, [onPick]);
  useEffect(() => { st.current.setTrack?.(selTrack); }, [selTrack, sense]); // también al cambiar el circuito de la pista
  useEffect(() => { st.current.selPad = selPad; }, [selPad]);
  return <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} role="img" aria-label="Mapa del circuito: sensores, interneuronas y salida, con sus conexiones reales del conectoma" />;
}
