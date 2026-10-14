// Fly Punch · app principal: circuito real del azúcar → pads del K.O. II, visor 3D y pantalla LCD.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { KO2 } from './midi.js';
import { Circuit } from './sim.js';
import { LCD } from './lcd.js';

const $ = (s) => document.querySelector(s);
const D = await (await fetch('./data/circuito-azucar-3d.json')).json();
const cloudRaw = new Int16Array(await (await fetch('./data/cerebro-nube.bin')).arrayBuffer());
const N = D.n, sim = new Circuit(D), lcd = new LCD($('#lcd'));
const UM = 50; // 1 unidad de escena = 50 µm
const CAPA = [0xFF5B1F, 0xF5B800, 0x34C77B, 0x6F8BFF];
const toScene = (p) => new THREE.Vector3(-p[0] / UM, -p[1] / UM, -p[2] / UM);

/* ---------------- escena 3D ---------------- */
const vp = $('#viewport'), canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 4, maxDistance: 60, autoRotate: true, autoRotateSpeed: 0.35 });

// silueta real: 40 mil neuronas de las 139 mil de FlyWire
const cp = new Float32Array(cloudRaw.length);
for (let i = 0; i < cloudRaw.length; i += 3) { cp[i] = -cloudRaw[i] / 10 / UM; cp[i + 1] = -cloudRaw[i + 1] / 10 / UM; cp[i + 2] = -cloudRaw[i + 2] / 10 / UM; }
const cloudGeo = new THREE.BufferGeometry(); cloudGeo.setAttribute('position', new THREE.BufferAttribute(cp, 3));
const cloud = new THREE.Points(cloudGeo, new THREE.PointsMaterial({ size: 0.045, color: 0x6B7280, transparent: true, opacity: 0.28, depthWrite: false }));
scene.add(cloud);

// circuito: 356 neuronas con su posición real
const pos = new Float32Array(N * 3), aAct = new Float32Array(N), aCapa = new Float32Array(N), aPad = new Float32Array(N), aOff = new Float32Array(N);
const centroid = new THREE.Vector3();
for (let i = 0; i < N; i++) { const v = toScene(D.pos_um[i]); pos.set([v.x, v.y, v.z], i * 3); aCapa[i] = Math.max(0, D.capa[i]); centroid.add(v); }
centroid.divideScalar(N); D.pads.forEach((p) => aPad[p.idx] = 1);
const ng = new THREE.BufferGeometry();
ng.setAttribute('position', new THREE.BufferAttribute(pos, 3));
for (const [n, a] of [['aAct', aAct], ['aCapa', aCapa], ['aPad', aPad], ['aOff', aOff]]) ng.setAttribute(n, new THREE.BufferAttribute(a, 1));
const colors = CAPA.map((c) => new THREE.Color(c));
const neuMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uC: { value: colors }, uPx: { value: renderer.getPixelRatio() } },
  vertexShader: `attribute float aAct, aCapa, aPad, aOff; uniform vec3 uC[4]; uniform float uPx; varying vec3 vC; varying float vA;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vec3 c = uC[int(aCapa+.5)];
      vC = aOff > .5 ? vec3(.25) : mix(c, vec3(1.), aAct*.55); vA = aOff > .5 ? .5 : .28 + .72*aAct;
      gl_PointSize = (aPad > .5 ? 9. : 4.) * (1. + aAct*1.8) * uPx * (22. / -mv.z); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(vC, vA * smoothstep(.5, .05, d)); }`,
});
scene.add(new THREE.Points(ng, neuMat));

// sinapsis más fuertes: se iluminan cuando dispara la neurona presináptica
const E = D.edges.pre.length, ep = new Float32Array(E * 6), eAct = new Float32Array(E * 2), eInh = new Float32Array(E * 2);
D.edges.pre.forEach((a, k) => { ep.set(pos.subarray(a * 3, a * 3 + 3), k * 6); ep.set(pos.subarray(D.edges.post[k] * 3, D.edges.post[k] * 3 + 3), k * 6 + 3); eInh[k * 2] = eInh[k * 2 + 1] = D.edges.w[k] < 0 ? 1 : 0; });
const eg = new THREE.BufferGeometry();
eg.setAttribute('position', new THREE.BufferAttribute(ep, 3)); eg.setAttribute('aAct', new THREE.BufferAttribute(eAct, 1)); eg.setAttribute('aInh', new THREE.BufferAttribute(eInh, 1));
const edgeMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute float aAct, aInh; varying float vA; varying float vI; void main(){ vA = aAct; vI = aInh; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `varying float vA; varying float vI; void main(){ vec3 c = vI > .5 ? vec3(.44,.55,1.) : vec3(1.,.36,.12); gl_FragColor = vec4(c, .025 + vA * .55); }`,
});
scene.add(new THREE.LineSegments(eg, edgeMat));

// etiquetas de los 12 pads sobre sus neuronas
const labels = D.pads.map((p) => { const el = document.createElement('span'); el.className = 'tag'; el.textContent = `${p.pad} · ${p.tipo}`; $('#tags').appendChild(el); return el; });
const tmp = new THREE.Vector3();
function placeTags() {
  const w = vp.clientWidth, h = vp.clientHeight;
  D.pads.forEach((p, k) => {
    tmp.fromArray(pos, p.idx * 3).project(camera);
    const el = labels[k], vis = tmp.z < 1 && $('#showTags').checked;
    el.style.display = vis ? 'block' : 'none';
    if (vis) el.style.transform = `translate(${(tmp.x * .5 + .5) * w + 8}px, ${(-tmp.y * .5 + .5) * h - 8}px)`;
  });
}

const VIEWS = {
  frontal: { pos: [0, 0.3, 26], target: [0, 0, 0] },
  dorsal: { pos: [0, 26, 0.01], target: [0, 0, 0] },
  lateral: { pos: [26, 0.3, 0], target: [0, 0, 0] },
  iso: { pos: [15, 11, 18], target: [0, 0, 0] },
  circuito: { pos: null, target: null },
};
let tween = null;
function setView(name) {
  const v = VIEWS[name];
  const target = v.target ? new THREE.Vector3(...v.target) : centroid.clone();
  const to = v.pos ? new THREE.Vector3(...v.pos) : centroid.clone().add(new THREE.Vector3(4, 2.5, 7));
  tween = { from: camera.position.clone(), to, tFrom: controls.target.clone(), tTo: target, t0: performance.now(), dur: 800 };
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
}
document.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => setView(b.dataset.view));
$('#rotate').onclick = (e) => { controls.autoRotate = !controls.autoRotate; e.currentTarget.setAttribute('aria-pressed', String(controls.autoRotate)); };
controls.addEventListener('start', () => tween = null);
camera.position.set(0, 0.3, 26);
new ResizeObserver(() => { const w = vp.clientWidth, h = vp.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }).observe(vp);

/* ---------------- pads ---------------- */
const LAYOUT = [9, 10, 11, 6, 7, 8, 3, 4, 5, 0, 1, 2]; // 7 8 9 / 4 5 6 / 1 2 3 / . 0 enter
const padEls = [], rate = new Float32Array(12);
for (const k of LAYOUT) {
  const p = D.pads[k], inh = p.inhibidora, b = document.createElement('button');
  b.type = 'button'; b.className = 'pad' + (inh ? ' inh' : ''); b.setAttribute('aria-pressed', 'false');
  b.title = `FlyWire ${p.flywire_id} · ${p.tipo} · ${p.nt} · ref. ${p.hz_ref} Hz · clic para silenciar`;
  b.innerHTML = `<span class="key">${p.pad}</span><span class="type">${p.tipo}</span><span class="role">${p.clase}${inh ? ' · inhib.' : ''}</span><span class="hz">0 Hz</span>`;
  b.onclick = () => {
    const on = !sim.silenced.has(p.idx); on ? sim.silenced.add(p.idx) : sim.silenced.delete(p.idx);
    aOff[p.idx] = on ? 1 : 0; ng.attributes.aOff.needsUpdate = true;
    b.classList.toggle('off', on); b.setAttribute('aria-pressed', String(on)); lcd.say(`${on ? 'SIL' : 'ON '} ${p.tipo}`);
  };
  $('#pads').appendChild(b); padEls[k] = b;
}

/* ---------------- raster ---------------- */
const order = [...Array(N).keys()].sort((a, b) => D.capa[a] - D.capa[b] || a - b), rowOf = new Int32Array(N); order.forEach((i, r) => rowOf[i] = r);
const rc = $('#raster'), rx = rc.getContext('2d'); rx.fillStyle = '#000'; rx.fillRect(0, 0, rc.width, rc.height);
const CAPA_CSS = ['#FF5B1F', '#F5B800', '#34C77B', '#6F8BFF'];
function rasterCol(cnt) {
  rx.drawImage(rc, -1, 0); const x = rc.width - 1; rx.fillStyle = '#000'; rx.fillRect(x, 0, 1, rc.height);
  for (let i = 0; i < N; i++) if (cnt[i]) { rx.fillStyle = CAPA_CSS[Math.max(0, D.capa[i])]; rx.fillRect(x, rowOf[i], 1, 1); }
}

/* ---------------- reloj, simulación y MIDI ---------------- */
const MN9 = D.pads[11].idx; let mn9 = 0, active = 0;
const preOfEdge = D.edges.pre;
function step() {
  const ms = Number($('#scale').value), cnt = sim.advance(ms, Number($('#sugar').value));
  const send = $('#send').checked, ch = Number($('#ch').value), base = Number($('#base').value);
  active = 0;
  for (let i = 0; i < N; i++) if (cnt[i]) { active++; aAct[i] = 1; }
  for (let k = 0; k < E; k++) if (cnt[preOfEdge[k]]) eAct[k * 2] = eAct[k * 2 + 1] = 1;
  D.pads.forEach((p, k) => {
    const c = cnt[p.idx]; rate[k] = rate[k] * 0.9 + 0.1 * (c / (ms / 1000));
    if (c > 0) {
      if (send) ko.hit(base + k, Math.min(127, 70 + 15 * (c - 1)), ch, 60);
      const el = padEls[k]; el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 70);
    }
  });
  mn9 = mn9 * 0.9 + 0.1 * (cnt[MN9] / (ms / 1000));
  lcd.push(active); rasterCol(cnt);
}
const ko = new KO2({
  onStep: step,
  onStart: () => { if (!ko.running) togglePlay(); },
  onStop: () => { if (ko.running) togglePlay(); },
  onState: (s) => { $('#dot').classList.toggle('on', !!s.output); $('#status').textContent = s.output ? `conectado · ${s.output}` : 'K.O. II no encontrado · conéctalo directo a la Mac'; lcd.say(s.output ? 'K.O. II CONECTADO' : 'SIN K.O. II'); },
});
function togglePlay() { ko.running ? ko.stop() : ko.start(); $('#play').textContent = ko.running ? '■ Detener' : '▶ Iniciar'; $('#play').setAttribute('aria-pressed', String(ko.running)); }
$('#play').onclick = togglePlay;
$('#connect').onclick = async () => { try { await ko.connect(); } catch (e) { $('#status').textContent = e.message; } };
$('#reset').onclick = () => {
  sim.reset(); sim.silenced.clear(); aOff.fill(0); ng.attributes.aOff.needsUpdate = true;
  padEls.forEach((b) => { b.classList.remove('off'); b.setAttribute('aria-pressed', 'false'); }); lcd.say('RESTABLECIDO');
};
for (let c = 1; c <= 16; c++) $('#ch').add(new Option(c, c));
for (const [id, unit] of [['sugar', ' Hz'], ['scale', ' ms'], ['ibpm', '']]) {
  const el = $('#' + id), out = $('#' + id + 'V');
  const upd = () => { out.textContent = el.value + unit; if (id === 'ibpm') ko.internalBpm = Number(el.value); };
  el.oninput = () => { upd(); lcd.say(`${{ sugar: 'AZUCAR', scale: 'TIEMPO', ibpm: 'BPM' }[id]} ${el.value}${unit.trim().toUpperCase()}`, 900); };
  upd();
}

/* ---------------- bucle de dibujo ---------------- */
let last = performance.now(), hzTimer = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const k = Math.pow(0.02, dt); // decaimiento del brillo (~0.25 s)
  for (let i = 0; i < N; i++) aAct[i] *= k;
  for (let i = 0; i < eAct.length; i++) eAct[i] *= k;
  ng.attributes.aAct.needsUpdate = true; eg.attributes.aAct.needsUpdate = true;
  if (tween) {
    const u = Math.min(1, (now - tween.t0) / tween.dur), e = 1 - Math.pow(1 - u, 3);
    camera.position.lerpVectors(tween.from, tween.to, e); controls.target.lerpVectors(tween.tFrom, tween.tTo, e); if (u >= 1) tween = null;
  }
  controls.update(); renderer.render(scene, camera); placeTags();
  lcd.draw({ running: ko.running, bpm: ko.bpm, sugar: Number($('#sugar').value), mn9, active, clock: ko.hasExternalClock ? 'ext' : 'int' });
  if ((hzTimer += dt) > 0.2) { hzTimer = 0; D.pads.forEach((p, i) => padEls[i].querySelector('.hz').textContent = rate[i].toFixed(0) + ' Hz'); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
