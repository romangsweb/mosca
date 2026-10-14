/* =========================================================
   MOSCA · conectoma-lab
   Visor 3D procedural de esqueletos neuronales (estilo FlyWire)
   + extracción de señal (audio / CSV) + separación topológica.
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (s, el = document) => el.querySelector(s);
const UM_PER_UNIT = 75;                 // 1 unidad de escena ≈ 75 µm (cerebro ≈ 590 µm)
const fmtInt = n => n.toLocaleString('en-US').replace(/,/g, ' ');

/* ---------------------------------------------------------
   RNG determinista
   --------------------------------------------------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(783);
const rr = (a, b) => a + (b - a) * rand();
function gauss() { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const gv = k => V(gauss() * k, gauss() * k, gauss() * k);
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------------------------------------------------------
   Regiones anatómicas (orden = índice en shader)
   --------------------------------------------------------- */
const REGIONS = [
  { id: 'OL', name: 'Lóbulos ópticos',      color: '#B4407F', n: 760 },
  { id: 'MB', name: 'Cuerpos fungiformes',  color: '#B88A2E', n: 320 },
  { id: 'AL', name: 'Lóbulos antenales',    color: '#1E6F7A', n: 230 },
  { id: 'CX', name: 'Complejo central',     color: '#6A5A9E', n: 170 },
  { id: 'PR', name: 'Protocerebro',         color: '#7F8A99', n: 420 },
];
const RIDX = Object.fromEntries(REGIONS.map((r, i) => [r.id, i]));

/* ---------------------------------------------------------
   Volúmenes (elipsoides)
   --------------------------------------------------------- */
class Ell {
  constructor(c, r) { this.c = c; this.r = r; }
  q(p) { const x = (p.x - this.c.x) / this.r.x, y = (p.y - this.c.y) / this.r.y, z = (p.z - this.c.z) / this.r.z; return x * x + y * y + z * z; }
  sample(k = 1) { let x, y, z; do { x = rr(-1, 1); y = rr(-1, 1); z = rr(-1, 1); } while (x * x + y * y + z * z > 1); return V(this.c.x + x * this.r.x * k, this.c.y + y * this.r.y * k, this.c.z + z * this.r.z * k); }
  surface() { const v = gv(1).normalize(); return V(this.c.x + v.x * this.r.x, this.c.y + v.y * this.r.y, this.c.z + v.z * this.r.z); }
}
function makeSide(s) {
  return {
    med:  new Ell(V(3.05 * s, 0, 0),      V(0.5, 1.25, 0.75)),
    lob:  new Ell(V(2.3 * s, -0.1, 0.05), V(0.42, 0.85, 0.6)),
    cal:  new Ell(V(0.85 * s, 0.72, -0.5),V(0.36, 0.26, 0.28)),
    ped:  V(0.68 * s, 0.35, 0.1),
    heel: V(0.6 * s, 0.18, 0.45),
    vTip: new Ell(V(0.7 * s, 0.92, 0.5),  V(0.12, 0.2, 0.12)),
    mTip: new Ell(V(0.2 * s, 0.18, 0.5),  V(0.2, 0.1, 0.12)),
    al:   new Ell(V(0.42 * s, -0.55, 0.6),V(0.3, 0.3, 0.28)),
    lh:   new Ell(V(1.45 * s, 0.4, -0.3), V(0.35, 0.3, 0.3)),
  };
}
const SIDES = { '1': makeSide(1), '-1': makeSide(-1) };
const CB  = new Ell(V(0, 0, 0),         V(1.85, 1.2, 0.9));
const FB  = new Ell(V(0, 0.28, 0),      V(0.55, 0.2, 0.18));
const EB  = new Ell(V(0, 0.05, 0.28),   V(0.24, 0.14, 0.12));
const PB  = new Ell(V(0, 0.75, -0.55),  V(0.6, 0.08, 0.08));

/* ---------------------------------------------------------
   Generación de esqueletos
   --------------------------------------------------------- */
const POS = [], REG = [], DST = [];
const STEP = 0.045;
let R = 0; // región actual

function seg(a, b, d0, d1) { POS.push(a.x, a.y, a.z, b.x, b.y, b.z); REG.push(R, R); DST.push(d0, d1); }

function travel(p, target, d, o = {}) {
  const jit = o.jitter ?? 0.3;
  let dir = target.clone().sub(p).normalize();
  let g = 0;
  while (p.distanceTo(target) > STEP * 1.5 && g++ < 300) {
    const want = target.clone().sub(p).normalize();
    dir.lerp(want, 0.2).add(gv(jit * 0.12)).normalize();
    const q = p.clone().addScaledVector(dir, STEP);
    seg(p, q, d, d + STEP); d += STEP; p = q;
    if (o.twigs && rand() < o.twigs) arbor(p, null, d, { n: 1, len: rr(3, 8), branch: 0.05 });
  }
  return { p, d };
}

function arbor(p0, vol, d0, o) {
  const stack = [];
  const step = STEP * (o.stepK ?? 0.7);
  for (let i = 0; i < o.n; i++) stack.push({ p: p0.clone(), dir: gv(1).normalize(), steps: o.len * rr(0.6, 1.2), d: d0, depth: 0 });
  while (stack.length) {
    const b = stack.pop();
    let { p, dir, d } = b;
    for (let s = 0; s < b.steps; s++) {
      dir.add(gv(0.45)).normalize();
      if (o.flat) dir.addScaledVector(o.flat, -dir.dot(o.flat) * 0.8).normalize();
      if (vol && vol.q(p) > 0.85) dir.lerp(vol.c.clone().sub(p).normalize(), 0.5).normalize();
      const q = p.clone().addScaledVector(dir, step);
      seg(p, q, d, d + step); d += step; p = q;
      if (b.depth < (o.maxDepth ?? 4) && rand() < (o.branch ?? 0.12)) {
        stack.push({ p: p.clone(), dir: dir.clone().add(gv(0.9)).normalize(), steps: (b.steps - s) * 0.7, d, depth: b.depth + 1 });
      }
    }
  }
}

const sgn = () => (rand() < 0.5 ? -1 : 1);

function neuronOL() {
  const s = sgn(), S = SIDES[s];
  let y, z; do { y = rr(-1, 1); z = rr(-1, 1); } while (y * y + z * z > 1);
  y *= 1.12; z *= 0.66;
  let p = V((3.72 + rr(0, 0.12)) * s, y, z), d = 0;
  ({ p, d } = travel(p, V(3.1 * s, y * 0.95, z * 0.95), d, { jitter: 0.12 }));
  arbor(p, S.med, d, { n: 2, len: 6, branch: 0.15, flat: V(1, 0, 0) });
  if (rand() < 0.78) {
    ({ p, d } = travel(p, V(2.3 * s, y * 0.66 - 0.1, z * 0.78), d, { jitter: 0.18 }));
    arbor(p, S.lob, d, { n: 2, len: 6, branch: 0.14 });
    if (rand() < 0.22) {
      ({ p, d } = travel(p, V(rr(0.9, 1.6) * s, rr(-0.4, 0.7), rr(-0.4, 0.4)), d, { jitter: 0.25, twigs: 0.01 }));
      arbor(p, null, d, { n: 3, len: 8, branch: 0.12 });
    }
  }
}

function neuronAL() {
  const s = sgn(), S = SIDES[s];
  let p = S.al.surface(), d = 0;
  p.y -= 0.05;
  ({ p, d } = travel(p, S.al.sample(0.8), d, { jitter: 0.3 }));
  arbor(p, S.al, d, { n: 3, len: 5, branch: 0.25, stepK: 0.5 });
  if (rand() < 0.7) {
    ({ p, d } = travel(p, V(0.55 * s, 0.1, 0.0).add(gv(0.03)), d, { jitter: 0.12 }));
    ({ p, d } = travel(p, S.cal.sample(0.6), d, { jitter: 0.15 }));
    arbor(p, S.cal, d, { n: 2, len: 4, branch: 0.2, stepK: 0.5 });
    ({ p, d } = travel(p, S.lh.sample(0.7), d, { jitter: 0.2 }));
    arbor(p, S.lh, d, { n: 3, len: 7, branch: 0.15 });
  } else {
    arbor(p, S.al, d, { n: 4, len: 10, branch: 0.12, stepK: 0.6 });
  }
}

function neuronMB() {
  const s = sgn(), S = SIDES[s];
  let p = S.cal.surface(), d = 0;
  p.y += 0.08; p.z -= 0.05;
  ({ p, d } = travel(p, S.cal.sample(0.7), d, { jitter: 0.3 }));
  arbor(p, S.cal, d, { n: 2, len: 4, branch: 0.2, stepK: 0.5 });
  const off = gv(0.035);
  ({ p, d } = travel(p, S.ped.clone().add(off), d, { jitter: 0.05 }));
  ({ p, d } = travel(p, S.heel.clone().add(off), d, { jitter: 0.05 }));
  if (rand() < 0.66) {
    travel(p, S.vTip.sample(0.8), d, { jitter: 0.05 });
    travel(p, S.mTip.sample(0.8), d, { jitter: 0.05 });
  } else {
    travel(p, S.mTip.sample(0.9).add(V(0, -0.05, 0.06)), d, { jitter: 0.08 });
  }
}

function neuronCX() {
  const s = sgn();
  const xc = rr(0.05, 0.6) * s;
  let p = V(xc * 1.1, 0.95 + rr(0, 0.15), -0.75 + rr(-0.1, 0.1)), d = 0;
  ({ p, d } = travel(p, V(xc, 0.75, -0.55), d, { jitter: 0.12 }));
  arbor(p, PB, d, { n: 2, len: 4, branch: 0.15, stepK: 0.5 });
  ({ p, d } = travel(p, V(rr(-0.5, 0.5), 0.28 + rr(-0.08, 0.08), rr(-0.08, 0.08)), d, { jitter: 0.12 }));
  arbor(p, FB, d, { n: 2, len: 5, branch: 0.15, flat: V(0, 1, 0), stepK: 0.6 });
  if (rand() < 0.5) {
    const a = rand() * Math.PI * 2;
    ({ p, d } = travel(p, V(Math.cos(a) * 0.2, 0.05 + Math.sin(a) * 0.12, 0.28), d, { jitter: 0.1 }));
    arbor(p, EB, d, { n: 2, len: 4, branch: 0.15, stepK: 0.5 });
  }
  if (rand() < 0.3) {
    ({ p, d } = travel(p, V(0.75 * s, -0.05, 0.35), d, { jitter: 0.15 }));
    arbor(p, null, d, { n: 3, len: 6, branch: 0.15 });
  }
}

function neuronPR() {
  let p = CB.surface(), d = 0;
  const t1 = CB.sample(0.75);
  ({ p, d } = travel(p, t1, d, { jitter: 0.35, twigs: 0.015 }));
  arbor(p, CB, d, { n: 3, len: 8, branch: 0.12 });
  const k = rand();
  if (k < 0.35) {
    ({ p, d } = travel(p, CB.sample(0.75), d, { jitter: 0.35, twigs: 0.02 }));
    arbor(p, CB, d, { n: 2, len: 7, branch: 0.12 });
  } else if (k < 0.5) {
    ({ p, d } = travel(p, V(rr(-0.15, 0.15), -1.25, 0.1), d, { jitter: 0.25 }));
    travel(p, V(rr(-0.1, 0.1), -1.95, 0.05), d, { jitter: 0.08 });
  } else if (k < 0.64) {
    ({ p, d } = travel(p, V(-t1.x + rr(-0.3, 0.3), t1.y, t1.z), d, { jitter: 0.25 }));
    arbor(p, CB, d, { n: 2, len: 7, branch: 0.12 });
  }
}

const GEN = { OL: neuronOL, MB: neuronMB, AL: neuronAL, CX: neuronCX, PR: neuronPR };
function buildConnectome() {
  for (const r of REGIONS) { R = RIDX[r.id]; for (let i = 0; i < r.n; i++) GEN[r.id](); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(POS, 3));
  g.setAttribute('aRegion', new THREE.Float32BufferAttribute(REG, 1));
  g.setAttribute('aDist', new THREE.Float32BufferAttribute(DST, 1));
  return g;
}

/* ---------------------------------------------------------
   Escena
   --------------------------------------------------------- */
const viewport = $('#viewport');
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0xffffff, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(0, 0.3, 17);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 40;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.target.set(0, 0, 0);

const uniforms = {
  uTime: { value: 0 },
  uBase: { value: 0.26 },
  uColors: { value: REGIONS.map(r => new THREE.Color(r.color)) },
  uAct: { value: REGIONS.map(() => 0) },
  uVis: { value: REGIONS.map(() => 1) },
};

const lineMat = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  vertexShader: /* glsl */`
    attribute float aRegion;
    attribute float aDist;
    uniform float uTime, uBase;
    uniform vec3  uColors[5];
    uniform float uAct[5];
    uniform float uVis[5];
    varying vec3  vColor;
    varying float vAlpha;
    void main() {
      int r = int(aRegion + 0.5);
      vec3  c   = uColors[r];
      float act = uAct[r];
      float w   = fract(aDist * 0.42 - uTime * 0.75);
      float pulse = smoothstep(0.86, 1.0, w) * act;
      vColor = mix(c, c * 0.42, pulse);
      vAlpha = (uBase + act * 0.18 + pulse * 0.75) * uVis[r];
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    varying vec3  vColor;
    varying float vAlpha;
    void main() {
      if (vAlpha < 0.004) discard;
      gl_FragColor = vec4(vColor, vAlpha);
    }`,
});

/* Neuropilo: silueta tipo malla con borde Fresnel, clínico */
const shellMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.FrontSide,
  uniforms: { uOpacity: { value: 1 } },
  vertexShader: `
    varying vec3 vN; varying vec3 vV;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `
    uniform float uOpacity; varying vec3 vN; varying vec3 vV;
    void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(vec3(0.55,0.58,0.62), (0.025 + f*0.28) * uOpacity); }`,
});
const shells = new THREE.Group();
function addShell(e) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), shellMat);
  m.position.copy(e.c); m.scale.set(e.r.x * 1.04, e.r.y * 1.04, e.r.z * 1.04);
  m.renderOrder = 0; shells.add(m);
}
addShell(CB);
for (const s of ['1', '-1']) { addShell(SIDES[s].med); addShell(SIDES[s].lob); }
scene.add(shells);

/* ---------------------------------------------------------
   Viewport utilities
   --------------------------------------------------------- */
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);

const VIEWS = {
  front:   { pos: V(0, 0.3, 17),     cap: 'VISTA FRONTAL · PERSPECTIVA 28° · ANTERIOR' },
  dorsal:  { pos: V(0, 17, 0.01),    cap: 'VISTA DORSAL · PERSPECTIVA 28° · SUPERIOR' },
  lateral: { pos: V(17, 0.3, 0),     cap: 'VISTA LATERAL · PERSPECTIVA 28° · DERECHA' },
  iso:     { pos: V(10, 7, 11.5),    cap: 'VISTA ISOMÉTRICA · PERSPECTIVA 28°' },
};
let tween = null;
function setView(name) {
  const v = VIEWS[name];
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('is-active', b.dataset.view === name));
  $('#vp-caption').textContent = v.cap;
  tween = { from: camera.position.clone(), to: v.pos.clone(), t0: performance.now(), dur: 700, tFrom: controls.target.clone() };
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

const btnRotate = $('#toggle-rotate');
function toggleRotate(force) {
  controls.autoRotate = force ?? !controls.autoRotate;
  btnRotate.classList.toggle('is-active', controls.autoRotate);
}
btnRotate.addEventListener('click', () => toggleRotate());
$('#toggle-shell').addEventListener('click', e => { shells.visible = !shells.visible; e.currentTarget.classList.toggle('is-active', shells.visible); });
controls.addEventListener('start', () => { tween = null; });

/* Gizmo de ejes */
const gz = $('#gizmo'), gctx = gz.getContext('2d');
const dpr = Math.min(window.devicePixelRatio, 2);
gz.width = 72 * dpr; gz.height = 72 * dpr; gctx.scale(dpr, dpr);
const AXES = [[V(1, 0, 0), 'X', '#BF6A4D'], [V(0, 1, 0), 'Y', '#5E8C61'], [V(0, 0, 1), 'Z', '#4A6E96']];
function drawGizmo() {
  gctx.clearRect(0, 0, 72, 72);
  const c = 36, L = 22;
  gctx.strokeStyle = '#E4E6E9'; gctx.lineWidth = 1;
  gctx.beginPath(); gctx.arc(c, c, 30, 0, Math.PI * 2); gctx.stroke();
  const items = AXES.map(([v, l, col]) => ({ v: v.clone().transformDirection(camera.matrixWorldInverse), l, col }));
  items.sort((a, b) => a.v.z - b.v.z);
  gctx.font = '500 9px Roboto Mono, monospace'; gctx.textAlign = 'center'; gctx.textBaseline = 'middle';
  for (const { v, l, col } of items) {
    const x = c + v.x * L, y = c - v.y * L;
    gctx.globalAlpha = v.z < -0.2 ? 0.45 : 1;
    gctx.strokeStyle = col; gctx.lineWidth = 1.2;
    gctx.beginPath(); gctx.moveTo(c, c); gctx.lineTo(x, y); gctx.stroke();
    gctx.fillStyle = '#fff'; gctx.beginPath(); gctx.arc(c + v.x * (L + 6), c - v.y * (L + 6), 6, 0, Math.PI * 2); gctx.fill();
    gctx.fillStyle = col; gctx.fillText(l, c + v.x * (L + 6), c - v.y * (L + 6) + 0.5);
  }
  gctx.globalAlpha = 1;
  gctx.fillStyle = '#333'; gctx.beginPath(); gctx.arc(c, c, 1.6, 0, Math.PI * 2); gctx.fill();
}

/* Barra de escala */
const sbBar = $('#scalebar-bar'), sbLbl = $('#scalebar-label');
let lastSb = 0;
function updateScalebar() {
  const dist = camera.position.distanceTo(controls.target);
  const pxPerUnit = viewport.clientHeight / (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const pxPerUm = pxPerUnit / UM_PER_UNIT;
  const nice = [10, 25, 50, 100, 200, 250, 500];
  let um = nice.find(n => n * pxPerUm >= 60) ?? 500;
  const w = Math.round(um * pxPerUm);
  if (w !== lastSb) { sbBar.style.width = w + 'px'; sbLbl.textContent = um + ' µm'; lastSb = w; }
}

/* Coordenadas del cursor */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), controls.target);
  if (ray.ray.intersectPlane(plane, hit)) {
    const f = n => (n * UM_PER_UNIT).toFixed(1).padStart(7, ' ');
    $('#st-cursor').textContent = `x ${f(hit.x)}  y ${f(hit.y)}  z ${f(hit.z)} µm`;
  }
});
canvas.addEventListener('pointerleave', () => { $('#st-cursor').textContent = 'x — y — z — µm'; });

/* ---------------------------------------------------------
   Leyenda de regiones
   --------------------------------------------------------- */
const legendList = $('#legend-list');
const visState = REGIONS.map(() => true);
const actBars = [];
REGIONS.forEach((r, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<span class="sw" style="background:${r.color}"></span><span>${r.name}</span><span class="n">${r.n}</span><span class="act"><i style="background:${r.color}"></i></span>`;
  li.title = `${r.id} · clic para ocultar · hover para aislar`;
  li.addEventListener('click', () => { visState[i] = !visState[i]; li.classList.toggle('off', !visState[i]); applyVis(); });
  li.addEventListener('mouseenter', () => applyVis(i));
  li.addEventListener('mouseleave', () => applyVis());
  legendList.appendChild(li);
  actBars.push(li.querySelector('.act i'));
});
function applyVis(iso = -1) {
  uniforms.uVis.value = REGIONS.map((_, i) => {
    if (!visState[i]) return 0;
    if (iso >= 0 && i !== iso) return 0.12;
    return 1;
  });
}

/* ---------------------------------------------------------
   Datos · estado
   --------------------------------------------------------- */
const SWEET = /sacaros|sucros|glucos|fructos|trehalos|maltos|arabinos|sorbitol|sugar|az[uú]car|miel|honey|sweet|dulce|n[eé]ctar/i;
const AVERS = /quinin|cafe[ií]n|caffein|deet|bitter|amarg|ruido|noise|artefact|silenc|denaton|lobelin|estricn|strychn|clic|hum/i;
const PATH_APP = ['PAM-γ5 → MBON-γ5β′2a', 'PAM-β′2 → MBON-β′2mp', 'PAM-α1 → MBON-α1', 'PAM-γ4 → MBON-γ4>γ1γ2'];
const PATH_AVR = ['PPL1-γ1pedc → MBON-γ1pedc>α/β', 'PPL1-γ2α′1 → MBON-γ2α′1', 'PPL1-α3 → MBON-α3'];

const state = {
  source: null,   // {name, size, kind, fmt, duration}
  peaks: null,    // Float32Array [min,max,...]
  items: [],      // {id,label,x,hz,dest,t0,t1,prior}
  results: null,
  transcriptHTML: '',
  hl: -1,
  playhead: -1,
  simulating: false,
};

/* Demo: muestra 14-B (transcripción Whisper de referencia) */
function buildDemo() {
  const tokens = [
    ['sacarosa', 0.82, 'AL', 1.6], ['quinina', 0.64, 'AL', -1.7], ['glucosa', 0.71, 'AL', 1.3],
    ['ruido_compresor', 0.38, 'OL', -1.2], ['fructosa', 0.77, 'AL', 1.4], ['cafeína', 0.58, 'AL', -1.5],
    ['artefacto_mic', 0.22, 'OL', -1.0], ['trehalosa', 0.69, 'MB', 1.1], ['DEET', 0.47, 'AL', -1.3],
    ['arabinosa', 0.41, 'MB', 0.45], ['silencio', 0.06, 'OL', -0.8], ['maltosa', 0.74, 'AL', 1.2],
  ];
  const dur = 9.6, n = tokens.length, slot = dur / n;
  const items = tokens.map(([label, x, dest, prior], i) => {
    const t0 = i * slot + 0.08, t1 = (i + 1) * slot - 0.12;
    return { id: `S-${String(i + 1).padStart(2, '0')}`, label, x, hz: 2 + 98 * x, dest, t0, t1, prior };
  });
  // forma de onda sintética coherente con las amplitudes
  const N = 1400, peaks = new Float32Array(N * 2);
  const nr = mulberry32(14);
  for (let i = 0; i < N; i++) {
    const t = (i / N) * dur;
    const it = items.find(o => t >= o.t0 && t <= o.t1);
    let a = 0.025 + nr() * 0.02;
    if (it) {
      const u = (t - it.t0) / (it.t1 - it.t0);
      const env = Math.sin(Math.PI * u) ** 0.6 * (0.75 + 0.25 * Math.sin(u * 37 + i * 0.3));
      a += it.x * env * (0.55 + nr() * 0.45);
    }
    peaks[i * 2] = -a * (0.8 + nr() * 0.2);
    peaks[i * 2 + 1] = a * (0.8 + nr() * 0.2);
  }
  const words = {
    sacarosa: 'solución de', quinina: 'al cinco por ciento con trazas de', glucosa: ', residuo de',
    ruido_compresor: '— [ruido de compresor] —', fructosa: ', segunda dilución:', cafeína: 'contaminada con',
    artefacto_mic: '[artefacto]', trehalosa: '; control positivo', DEET: 'y repelente', arabinosa: ', blanco con',
    silencio: '[silencio]', maltosa: '; cierre con',
  };
  let html = '<span class="muted">«Muestra catorce-B:</span> ';
  items.forEach((it, i) => {
    const pre = words[it.label] ?? '';
    const bracket = pre.startsWith('[') || pre.startsWith('—');
    if (!bracket && pre) html += `${pre} `;
    html += `<span class="tk" data-i="${i}">${it.label}</span> `;
  });
  html += '<span class="muted">»</span>';
  return {
    source: { name: 'demo_muestra_14B.wav', size: 307200, kind: 'DEMO · AUDIO', fmt: 'PCM 16 kHz · mono · 9.60 s', duration: dur, model: 'whisper-large-v3 · es' },
    peaks, items, transcriptHTML: html,
  };
}

/* ---------------------------------------------------------
   Carga de archivos
   --------------------------------------------------------- */
const dz = $('#dropzone'), fileInput = $('#file-input');
['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('is-over'); }));
['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('is-over'); }));
dz.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
fileInput.addEventListener('change', () => { const f = fileInput.files[0]; if (f) handleFile(f); fileInput.value = ''; });
// permitir soltar en cualquier parte del panel izquierdo
$('.panel-left').addEventListener('dragover', e => e.preventDefault());
$('.panel-left').addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('is-over'); const f = e.dataTransfer.files[0]; if (f) handleFile(f); });

const sleep = ms => new Promise(r => setTimeout(r, ms));
function setPipeline(step) {
  document.querySelectorAll('#pipeline li').forEach(li => {
    const s = +li.dataset.step;
    li.classList.toggle('done', s < step);
    li.classList.toggle('active', s === step);
  });
}
function status(text, mode = 'ok') { $('#st-state').textContent = text; $('#st-led').className = 'st-led ' + mode; }

async function handleFile(file) {
  if (state.simulating) return;
  const isCSV = /\.csv$/i.test(file.name) || file.type.includes('csv');
  const isAudio = file.type.startsWith('audio/') || /\.(wav|mp3|flac|ogg|m4a|aac|webm)$/i.test(file.name);
  if (!isCSV && !isAudio) { status(`Formato no soportado: ${file.name}`, 'busy'); return; }
  status(`Procesando ${file.name}…`, 'busy');
  clearResults();
  try {
    setPipeline(0); await sleep(250);
    const data = isCSV ? await parseCSV(file) : await parseAudio(file);
    setPipeline(1); await sleep(isCSV ? 150 : 450);
    setPipeline(2); await sleep(250);
    setPipeline(3); await sleep(250);
    loadData(data);
    setPipeline(4);
    status(`${file.name} · ${data.items.length} variables mapeadas`, 'ok');
  } catch (err) {
    console.error(err);
    setPipeline(-1);
    status(`Error al procesar ${file.name}`, 'busy');
  }
}

async function parseAudio(file) {
  const ab = await file.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const buf = await ctx.decodeAudioData(ab);
  ctx.close();
  const ch = buf.getChannelData(0), sr = buf.sampleRate, dur = buf.duration;
  const N = 1400, peaks = new Float32Array(N * 2), bs = Math.max(1, Math.floor(ch.length / N));
  let gmax = 1e-6;
  for (let i = 0; i < N; i++) {
    let mn = 0, mx = 0;
    for (let j = i * bs, e = Math.min(ch.length, j + bs); j < e; j++) { const v = ch[j]; if (v < mn) mn = v; if (v > mx) mx = v; }
    peaks[i * 2] = mn; peaks[i * 2 + 1] = mx; gmax = Math.max(gmax, -mn, mx);
  }
  for (let i = 0; i < peaks.length; i++) peaks[i] /= gmax;

  // segmentación por energía: RMS + tasa de cruces por cero (proxy espectral)
  const nSeg = Math.min(16, Math.max(4, Math.round(dur / 0.8)));
  const len = Math.floor(ch.length / nSeg);
  const raw = [];
  for (let s = 0; s < nSeg; s++) {
    let sum = 0, zc = 0;
    for (let j = s * len + 1, e = (s + 1) * len; j < e; j++) { sum += ch[j] * ch[j]; if ((ch[j] >= 0) !== (ch[j - 1] >= 0)) zc++; }
    raw.push({ rms: Math.sqrt(sum / len), f: (zc / len) * sr / 2 });
  }
  const maxR = Math.max(...raw.map(r => r.rms), 1e-6);
  const items = raw.map((r, i) => {
    const x = r.rms / maxR;
    const voice = r.f > 120 && r.f < 1400;
    const prior = x < 0.18 ? -1.2 : voice ? 0.9 : -0.5;
    const t0 = (i * len) / sr, t1 = ((i + 1) * len) / sr;
    return { id: `S-${String(i + 1).padStart(2, '0')}`, label: `seg_${String(i + 1).padStart(2, '0')}·${Math.round(r.f)}Hz`, x, hz: 2 + 98 * x, dest: voice ? 'AL' : (x < 0.18 ? 'OL' : 'MB'), t0, t1, prior };
  });
  return {
    source: { name: file.name, size: file.size, kind: 'AUDIO', fmt: `${(sr / 1000).toFixed(1)} kHz · ${buf.numberOfChannels} ch · ${dur.toFixed(2)} s`, duration: dur, model: 'segmentación RMS/ZCR' },
    peaks, items,
    transcriptHTML: '<span class="muted">Backend Whisper no conectado — segmentación acústica local (RMS · ZCR).</span> ' +
      items.map((it, i) => `<span class="tk" data-i="${i}">${it.id}</span>`).join(' '),
  };
}

async function parseCSV(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const sep = [',', ';', '\t'].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const head = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1, 41).map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, '')));
  const isNum = v => v !== '' && !isNaN(parseFloat(v.replace(',', '.')));
  let numCol = head.findIndex((_, c) => rows.every(r => isNum(r[c] ?? '')));
  let txtCol = head.findIndex((_, c) => c !== numCol && rows.some(r => !isNum(r[c] ?? '')));
  if (numCol < 0) numCol = 0;
  const vals = rows.map(r => parseFloat((r[numCol] ?? '0').replace(',', '.')) || 0);
  const mn = Math.min(...vals), mx = Math.max(...vals), span = mx - mn || 1;
  const dur = rows.length;
  const items = rows.map((r, i) => {
    const label = txtCol >= 0 ? r[txtCol] : `${head[numCol]}_${i + 1}`;
    const x = (vals[i] - mn) / span;
    const prior = SWEET.test(label) ? 1.4 : AVERS.test(label) ? -1.4 : 0;
    const dest = ['AL', 'MB', 'OL'][hashStr(label) % 3];
    return { id: `S-${String(i + 1).padStart(2, '0')}`, label, x, hz: 2 + 98 * x, dest, t0: i + 0.1, t1: i + 0.9, prior };
  });
  // "forma de onda" = serie de valores, escala de grises
  const N = 1400, peaks = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const k = Math.min(items.length - 1, Math.floor((i / N) * items.length));
    const a = 0.04 + items[k].x * 0.9 * (0.85 + 0.15 * Math.sin(i * 0.9));
    peaks[i * 2] = -a; peaks[i * 2 + 1] = a;
  }
  return {
    source: { name: file.name, size: file.size, kind: 'CSV', fmt: `${rows.length} filas · col. «${head[numCol]}»`, duration: dur, model: `serie · ${head[numCol]}` },
    peaks, items,
    transcriptHTML: `<span class="muted">Columnas: ${head.join(' · ')}</span><br>` + items.slice(0, 18).map((it, i) => `<span class="tk" data-i="${i}">${it.label}</span>`).join(' '),
  };
}

/* ---------------------------------------------------------
   Render de panel izquierdo
   --------------------------------------------------------- */
function loadData(d) {
  Object.assign(state, { source: d.source, peaks: d.peaks, items: d.items, transcriptHTML: d.transcriptHTML, results: null });
  $('#src-kind').textContent = d.source.kind;
  $('#fm-name').textContent = d.source.name;
  $('#fm-size').textContent = d.source.size > 1e6 ? (d.source.size / 1e6).toFixed(2) + ' MB' : (d.source.size / 1e3).toFixed(1) + ' kB';
  $('#fm-fmt').textContent = d.source.fmt;
  $('#wave-meta').textContent = d.source.model;
  $('#session-file').textContent = d.source.name;
  $('#transcript').innerHTML = d.transcriptHTML;
  $('#map-count').textContent = `${d.items.length} var.`;

  const tb = $('#map-table tbody');
  tb.innerHTML = '';
  d.items.forEach((it, i) => {
    const r = REGIONS[RIDX[it.dest]];
    const tr = document.createElement('tr');
    tr.dataset.i = i;
    tr.style.animationDelay = `${i * 25}ms`;
    tr.innerHTML = `<td>${String(i + 1).padStart(2, '0')}</td>
      <td class="var" title="${it.label}">${it.label}</td>
      <td class="num">${it.x.toFixed(2)}</td>
      <td class="num"><span class="hzcell">${it.hz.toFixed(1)}<span class="hzbar"><i style="width:${Math.min(100, it.hz)}%"></i></span></span></td>
      <td><span class="dest"><i style="background:${r.color}"></i>${it.dest}</span></td>`;
    tb.appendChild(tr);
  });
  drawWave();
  drawStrip();
}

function setHighlight(i) {
  state.hl = i;
  document.querySelectorAll('#map-table tbody tr').forEach(tr => tr.classList.toggle('hl', +tr.dataset.i === i));
  document.querySelectorAll('#transcript .tk').forEach(t => t.classList.toggle('hl', +t.dataset.i === i));
  document.querySelectorAll('.row').forEach(r => r.classList.toggle('hl', +r.dataset.i === i));
  drawWave(); drawStrip();
}
function bindHover(container, sel) {
  container.addEventListener('mouseover', e => { const el = e.target.closest(sel); if (el) setHighlight(+el.dataset.i); });
  container.addEventListener('mouseleave', () => setHighlight(-1));
}
bindHover($('#map-table tbody'), 'tr');
bindHover($('#transcript'), '.tk');
bindHover($('#list-app'), '.row');
bindHover($('#list-avr'), '.row');

/* Forma de onda (escala de grises) */
const wave = $('#wave'), wctx = wave.getContext('2d');
function fitCanvas(c, ctx) {
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [w, h];
}
function drawWave() {
  if (!state.peaks) return;
  const [w, h] = fitCanvas(wave, wctx);
  const top = 12, bot = h - 12, mid = (top + bot) / 2, amp = (bot - top) / 2;
  const dur = state.source.duration;
  wctx.clearRect(0, 0, w, h);

  // segmentos de variables
  state.items.forEach((it, i) => {
    const x0 = (it.t0 / dur) * w, x1 = (it.t1 / dur) * w;
    if (i === state.hl) { wctx.fillStyle = '#ECEEF1'; wctx.fillRect(x0, top, x1 - x0, bot - top); }
    wctx.strokeStyle = i === state.hl ? '#333' : '#C9CDD2';
    wctx.lineWidth = 1;
    wctx.beginPath(); wctx.moveTo(x0, 6.5); wctx.lineTo(x0, 4.5); wctx.lineTo(x1, 4.5); wctx.lineTo(x1, 6.5); wctx.stroke();
  });

  wctx.strokeStyle = '#E4E6E9'; wctx.beginPath(); wctx.moveTo(0, mid + 0.5); wctx.lineTo(w, mid + 0.5); wctx.stroke();

  const N = state.peaks.length / 2;
  const cols = Math.floor(w);
  for (let x = 0; x < cols; x++) {
    const k0 = Math.floor((x / cols) * N), k1 = Math.max(k0 + 1, Math.floor(((x + 1) / cols) * N));
    let mn = 0, mx = 0;
    for (let k = k0; k < k1; k++) { mn = Math.min(mn, state.peaks[k * 2]); mx = Math.max(mx, state.peaks[k * 2 + 1]); }
    const played = state.playhead >= 0 && x / cols <= state.playhead;
    const g = Math.round(150 - Math.min(1, mx - mn) * 80);
    wctx.fillStyle = played ? '#333' : `rgb(${g},${g + 2},${g + 6})`;
    wctx.fillRect(x, mid - mx * amp, 1, Math.max(1, (mx - mn) * amp));
  }

  // regla temporal
  wctx.fillStyle = '#A2A7AE'; wctx.font = '9px Roboto Mono, monospace'; wctx.textBaseline = 'bottom';
  const stepT = dur > 30 ? 10 : dur > 12 ? 2 : 1;
  for (let t = 0; t <= dur; t += stepT) {
    const x = Math.round((t / dur) * w) + 0.5;
    wctx.fillRect(x, h - 4, 1, 4);
    if (t > 0 && x < w - 16) wctx.fillText(state.source.kind === 'CSV' ? `${t}` : `${t}s`, x + 2, h - 1);
  }

  if (state.playhead >= 0) {
    const x = Math.round(state.playhead * w) + 0.5;
    wctx.strokeStyle = '#333'; wctx.beginPath(); wctx.moveTo(x, 0); wctx.lineTo(x, h); wctx.stroke();
  }
}

/* ---------------------------------------------------------
   Panel derecho · separación topológica
   --------------------------------------------------------- */
const strip = $('#strip'), sctx = strip.getContext('2d');
function drawStrip() {
  const [w, h] = fitCanvas(strip, sctx);
  sctx.clearRect(0, 0, w, h);
  const pad = 8, y0 = 10, y1 = h - 16;
  const X = s => pad + ((s + 1) / 2) * (w - pad * 2);
  // zonas
  sctx.fillStyle = 'rgba(191,106,77,0.05)'; sctx.fillRect(pad, y0, X(0) - pad, y1 - y0);
  sctx.fillStyle = 'rgba(94,140,97,0.06)'; sctx.fillRect(X(0), y0, w - pad - X(0), y1 - y0);
  sctx.strokeStyle = '#E4E6E9'; sctx.lineWidth = 1; sctx.strokeRect(pad + 0.5, y0 + 0.5, w - pad * 2 - 1, y1 - y0 - 1);
  sctx.setLineDash([2, 3]); sctx.strokeStyle = '#A2A7AE';
  sctx.beginPath(); sctx.moveTo(Math.round(X(0)) + 0.5, y0); sctx.lineTo(Math.round(X(0)) + 0.5, y1); sctx.stroke();
  sctx.setLineDash([]);
  sctx.fillStyle = '#A2A7AE'; sctx.font = '9px Roboto Mono, monospace'; sctx.textBaseline = 'top';
  sctx.textAlign = 'left'; sctx.fillText('−1 aversivo', pad, y1 + 4);
  sctx.textAlign = 'center'; sctx.fillText('θ=0', X(0), y1 + 4);
  sctx.textAlign = 'right'; sctx.fillText('apetitivo +1', w - pad, y1 + 4);

  if (!state.results) return;
  state.results.forEach((r, i) => {
    const jy = ((hashStr(r.label) % 1000) / 1000);
    const x = X(r.score), y = y0 + 6 + jy * (y1 - y0 - 12);
    const col = r.cat === 'app' ? '#5E8C61' : '#BF6A4D';
    sctx.fillStyle = col;
    sctx.globalAlpha = state.hl < 0 || state.hl === i ? 1 : 0.25;
    sctx.beginPath(); sctx.arc(x, y, state.hl === i ? 3.5 : 2.5, 0, Math.PI * 2); sctx.fill();
    if (state.hl === i) {
      sctx.strokeStyle = col; sctx.beginPath(); sctx.arc(x, y, 6.5, 0, Math.PI * 2); sctx.stroke();
      sctx.fillStyle = '#333'; sctx.textAlign = x > w / 2 ? 'right' : 'left'; sctx.textBaseline = 'middle';
      sctx.fillText(r.label, x + (x > w / 2 ? -10 : 10), y);
    }
  });
  sctx.globalAlpha = 1;
}

function classify(items) {
  return items.map((it, i) => {
    const jit = ((hashStr(it.label) % 1000) / 1000 - 0.5) * 0.35;
    const s = Math.tanh(it.prior * 0.85 + ((it.hz - 50) / 50) * 0.55 + jit);
    const cat = s >= 0 ? 'app' : 'avr';
    let path = cat === 'app' ? PATH_APP[hashStr(it.label) % PATH_APP.length] : PATH_AVR[hashStr(it.label) % PATH_AVR.length];
    if (cat === 'avr' && it.x < 0.25) path = 'descartado · SNR < 3 dB';
    return { ...it, i, score: s, conf: Math.abs(s), cat, path };
  });
}

function renderResults() {
  const res = state.results;
  const app = res.filter(r => r.cat === 'app').sort((a, b) => b.score - a.score);
  const avr = res.filter(r => r.cat === 'avr').sort((a, b) => a.score - b.score);
  const row = (r, k) => `<li class="row ${r.cat}" data-i="${r.i}" style="animation-delay:${k * 45}ms">
      <span class="dot ${r.cat === 'app' ? 'ok' : 'bad'}"></span>
      <span class="id">${r.id}</span>
      <span class="lbl" title="${r.label}">${r.label}</span>
      <span class="hz">${r.hz.toFixed(1)} Hz</span>
      <span class="sc">${r.score >= 0 ? '+' : '−'}${Math.abs(r.score).toFixed(2)}</span>
      <span></span><span></span>
      <span class="path">${r.path}</span>
      <span class="conf"><i style="width:${(r.conf * 100).toFixed(0)}%"></i></span>
    </li>`;
  $('#list-app').innerHTML = app.length ? app.map(row).join('') : '<li class="empty mono">— ninguno</li>';
  $('#list-avr').innerHTML = avr.length ? avr.map(row).join('') : '<li class="empty mono">— ninguno</li>';
  $('#c-app').textContent = app.length;
  $('#c-avr').textContent = avr.length;

  const mean = a => a.reduce((s, r) => s + r.score, 0) / (a.length || 1);
  const vr = (a, m) => a.reduce((s, r) => s + (r.score - m) ** 2, 0) / (a.length || 1);
  const m1 = mean(app), m2 = mean(avr);
  const dprime = app.length && avr.length ? (m1 - m2) / Math.sqrt(0.5 * (vr(app, m1) + vr(avr, m2)) + 1e-3) : 0;
  countUp($('#m-n'), res.length, 0);
  countUp($('#m-app'), app.length, 0);
  countUp($('#m-avr'), avr.length, 0);
  countUp($('#m-d'), dprime, 2);
  $('#btn-json').disabled = $('#btn-csv').disabled = false;
  drawStrip();
}

function clearResults() {
  state.results = null;
  ['#m-n', '#m-app', '#m-avr', '#m-d'].forEach(s => $(s).textContent = '—');
  $('#list-app').innerHTML = $('#list-avr').innerHTML = '<li class="empty mono">sin datos · ejecutar simulación</li>';
  $('#c-app').textContent = $('#c-avr').textContent = '0';
  $('#btn-json').disabled = $('#btn-csv').disabled = true;
  drawStrip();
}

function countUp(el, to, dec) {
  const t0 = performance.now(), dur = 600;
  (function f(now) {
    const u = Math.min(1, (now - t0) / dur), e = 1 - (1 - u) ** 3;
    el.textContent = (to * e).toFixed(dec);
    if (u < 1) requestAnimationFrame(f);
  })(t0);
}

/* ---------------------------------------------------------
   Simulación
   --------------------------------------------------------- */
const SIM_DUR = 4200;            // ms reales
const SIM_MODEL_MS = 500;        // ms de modelo
let sim = null;
const bump = (u, a, b) => THREE.MathUtils.smoothstep(u, a, a + 0.12) * (1 - THREE.MathUtils.smoothstep(u, b - 0.12, b));
const PHASES = [[0.0, 'inyección · neuronas receptoras'], [0.3, 'propagación · PN → cálices MB'], [0.55, 'Kenyon → DAN / MBON'], [0.82, 'lectura · separación']];

function startSim() {
  if (state.simulating || !state.items.length) return;
  state.simulating = true;
  clearResults();
  const share = { AL: 0, OL: 0, MB: 0 };
  state.items.forEach(it => share[it.dest] = (share[it.dest] || 0) + 1);
  const n = state.items.length;
  sim = { t0: performance.now(), share: Object.fromEntries(Object.entries(share).map(([k, v]) => [k, v / n])) };
  const b = $('#btn-sim'); b.classList.add('running'); $('#btn-sim-label').textContent = 'Simulando…';
  $('#sim-hud').classList.add('on');
  status('Simulación en curso · integrador LIF', 'busy');
  toggleRotate(true);
  document.querySelectorAll('#map-table tbody tr').forEach(tr => tr.classList.remove('injected', 'injecting'));
}

function stepSim(now) {
  const u = Math.min(1, (now - sim.t0) / SIM_DUR);
  const w = k => 0.45 + 0.55 * (sim.share[k] || 0);
  const act = {
    AL: bump(u, 0.0, 0.5) * w('AL'),
    OL: bump(u, 0.0, 0.5) * w('OL'),
    MB: Math.max(bump(u, 0.22, 0.8), bump(u, 0.0, 0.5) * (sim.share.MB || 0)),
    CX: bump(u, 0.5, 1.0) * 0.8,
    PR: bump(u, 0.45, 1.0),
  };
  uniforms.uAct.value = REGIONS.map(r => act[r.id] * 1.0);
  actBars.forEach((bar, i) => bar.style.width = (uniforms.uAct.value[i] * 100).toFixed(0) + '%');

  // reproducción de la señal / inyección
  const pu = Math.min(1, u / 0.6);
  state.playhead = pu;
  const tNow = pu * state.source.duration;
  document.querySelectorAll('#map-table tbody tr').forEach(tr => {
    const it = state.items[+tr.dataset.i];
    tr.classList.toggle('injecting', tNow >= it.t0 && tNow <= it.t1 && u < 0.6);
    if (tNow > it.t1) tr.classList.add('injected');
  });
  drawWave();

  $('#hud-t').textContent = String(Math.round(u * SIM_MODEL_MS)).padStart(3, '0');
  $('#hud-phase').textContent = [...PHASES].reverse().find(p => u >= p[0])[1];
  $('#st-bar').style.width = (u * 100).toFixed(1) + '%';

  if (u >= 1) finishSim();
}

function finishSim() {
  sim = null;
  state.simulating = false;
  state.playhead = -1;
  uniforms.uAct.value = REGIONS.map(() => 0);
  actBars.forEach(b => b.style.width = '0');
  document.querySelectorAll('#map-table tbody tr').forEach(tr => tr.classList.remove('injecting'));
  drawWave();
  state.results = classify(state.items);
  renderResults();
  $('#btn-sim').classList.remove('running'); $('#btn-sim-label').textContent = 'Repetir simulación';
  $('#sim-hud').classList.remove('on');
  setTimeout(() => { $('#st-bar').style.width = '0'; }, 600);
  const a = state.results.filter(r => r.cat === 'app').length;
  status(`Simulación completa · ${a}/${state.results.length} apetitivos · ${SIM_MODEL_MS} ms de modelo`, 'ok');
}

$('#btn-sim').addEventListener('click', startSim);

/* ---------------------------------------------------------
   Exportación
   --------------------------------------------------------- */
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const baseName = () => (state.source?.name ?? 'dataset').replace(/\.[^.]+$/, '');
const filtered = () => (state.results ?? []).filter(r => r.cat === 'app').sort((a, b) => b.score - a.score);

$('#btn-json').addEventListener('click', () => {
  const items = filtered().map(({ id, label, x, hz, dest, score, path }) => ({ id, label, x: +x.toFixed(4), hz: +hz.toFixed(2), destino: dest, score: +score.toFixed(4), ruta: path }));
  const out = {
    meta: {
      app: 'mosca/conectoma-lab', fecha: new Date().toISOString(), fuente: state.source.name,
      modelo: 'D. melanogaster · FAFB FlyWire v783 (subconjunto procedural)', criterio: 'score ≥ 0 (apetitivo)',
      n_total: state.results.length, n_filtrado: items.length,
    },
    items,
  };
  download(`${baseName()}_filtrado.json`, JSON.stringify(out, null, 2), 'application/json');
  status(`Exportado ${baseName()}_filtrado.json · ${items.length} filas`, 'ok');
});
$('#btn-csv').addEventListener('click', () => {
  const esc = v => /[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v;
  const rows = filtered().map(r => [r.id, esc(r.label), r.x.toFixed(4), r.hz.toFixed(2), r.dest, r.score.toFixed(4), esc(r.path)].join(','));
  download(`${baseName()}_filtrado.csv`, ['id,label,x,hz,destino,score,ruta', ...rows].join('\n'), 'text/csv');
  status(`Exportado ${baseName()}_filtrado.csv · ${rows.length} filas`, 'ok');
});

/* ---------------------------------------------------------
   Teclado
   --------------------------------------------------------- */
window.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  const map = { '1': 'front', '2': 'dorsal', '3': 'lateral', '4': 'iso' };
  if (map[e.key]) setView(map[e.key]);
  else if (e.key === 'r' || e.key === 'R') toggleRotate();
  else if (e.key === 'Enter') startSim();
});

/* Reloj */
setInterval(() => { $('#clock').textContent = new Date().toLocaleTimeString('es-MX', { hour12: false }); }, 1000);

/* ---------------------------------------------------------
   Arranque
   --------------------------------------------------------- */
const geo = buildConnectome();
const lines = new THREE.LineSegments(geo, lineMat);
lines.renderOrder = 1;
scene.add(lines);
resize();

const nNeurons = REGIONS.reduce((s, r) => s + r.n, 0);
$('#st-neurons').textContent = `${fmtInt(nNeurons)} neuronas`;
$('#st-segs').textContent = `${fmtInt(POS.length / 6)} segmentos`;
status('Listo · modelo cargado', 'ok');

loadData(buildDemo());
setPipeline(4);
window.addEventListener('resize', () => { drawWave(); drawStrip(); });

let frames = 0, fpsT = performance.now();
const clock = new THREE.Clock();
function loop(now) {
  requestAnimationFrame(loop);
  uniforms.uTime.value = clock.getElapsedTime();

  if (tween) {
    const u = Math.min(1, (now - tween.t0) / tween.dur), e = u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
    const dist = THREE.MathUtils.lerp(tween.from.length(), tween.to.length(), e);
    camera.position.lerpVectors(tween.from, tween.to, e).setLength(dist);
    controls.target.lerpVectors(tween.tFrom, V(0, 0, 0), e);
    if (u >= 1) tween = null;
  }
  if (sim) stepSim(now);
  else {
    // actividad espontánea muy tenue
    const t = uniforms.uTime.value;
    uniforms.uAct.value = REGIONS.map((_, i) => 0.06 + 0.05 * Math.sin(t * 0.5 + i * 1.7));
  }

  controls.update();
  renderer.render(scene, camera);
  drawGizmo();
  updateScalebar();

  frames++;
  if (now - fpsT > 500) { $('#st-fps').textContent = `${Math.round(frames * 1000 / (now - fpsT))} fps`; frames = 0; fpsT = now; }
}
requestAnimationFrame(loop);

// Primera corrida automática para mostrar el flujo completo
setTimeout(startSim, 900);
