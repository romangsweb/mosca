// Fly Punch · app: circuito real (gusto + oído) → pads del K.O. II, en una sola pantalla.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { KO2 } from './midi.js';
import { Circuit } from './sim.js';
import { ICON, FLY } from './icons.js';
import { seg } from './seg.js';
import { Ear } from './audio.js';
import { parseCSV, demoCSV } from './data.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const D = await (await fetch('./data/circuito-multi.json')).json();
const cloudRaw = new Int16Array(await (await fetch('./data/cerebro-nube.bin')).arrayBuffer());
const N = D.n, sim = new Circuit(D), ear = new Ear();
const SENSES = { gusto: ['dulce', 'amargo'], oido: ['jon_ce', 'jon_f', 'jon_dm'] };
const SENSE_LABEL = { dulce: 'DULCE', amargo: 'AMARGO', jon_ce: 'GRAVES · JO-CM', jon_f: 'MEDIOS · JO-FV', jon_dm: 'AGUDOS · JO-DA' };
const COL = { blanco: '#F2F4F7', rojo: '#FF3B30', azul: '#2F80FF', naranja: '#FF8A1F' };

// íconos en el DOM
$$('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', ICON[el.dataset.icon] ?? ''));
$('#fly').innerHTML = FLY;

/* =============== estado =============== */
const st = { dash: 'gusto', menu: false, source: 'manual', data: null, target: 'gusto', map: {}, row: 0, steps: 0, lastHit: 0 };
const sense = () => st.dash === 'datos' ? st.target : st.dash;

/* =============== escena 3D =============== */
const UM = 50, vp = $('#view'), canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 4, maxDistance: 60, autoRotate: true, autoRotateSpeed: 0.3 });
const sc = (x, y, z) => [-x / UM, -y / UM, -z / UM];

const cp = new Float32Array(cloudRaw.length);
for (let i = 0; i < cloudRaw.length; i += 3) cp.set(sc(cloudRaw[i] / 10, cloudRaw[i + 1] / 10, cloudRaw[i + 2] / 10), i);
const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3));
scene.add(new THREE.Points(cg, new THREE.PointsMaterial({ size: 0.04, color: 0xffffff, transparent: true, opacity: 0.13, depthWrite: false })));

const pos = new Float32Array(N * 3), aAct = new Float32Array(N), aRole = new Float32Array(N), aPad = new Float32Array(N), aOff = new Float32Array(N);
const isSensor = new Uint8Array(N); Object.values(D.grupos).forEach((g) => g.forEach((i) => isSensor[i] = 1));
const centroid = new THREE.Vector3();
for (let i = 0; i < N; i++) {
  pos.set(sc(...D.pos_um[i]), i * 3); centroid.add(new THREE.Vector3(...pos.subarray(i * 3, i * 3 + 3)));
  aRole[i] = i === D.mn9 ? 3 : isSensor[i] ? 0 : D.inh[i] ? 2 : 1;
}
centroid.divideScalar(N);
const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.BufferAttribute(pos, 3));
for (const [k, a] of Object.entries({ aAct, aRole, aPad, aOff })) ng.setAttribute(k, new THREE.BufferAttribute(a, 1));
const roleCols = [COL.blanco, COL.rojo, COL.azul, COL.naranja].map((c) => new THREE.Color(c));
scene.add(new THREE.Points(ng, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uC: { value: roleCols }, uPx: { value: renderer.getPixelRatio() } },
  vertexShader: `attribute float aAct, aRole, aPad, aOff; uniform vec3 uC[4]; uniform float uPx; varying vec3 vC; varying float vA;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vec3 c = uC[int(aRole+.5)];
      vC = aOff > .5 ? vec3(.3) : mix(vec3(.9), c, min(1., aAct*1.4)); vA = aOff > .5 ? .35 : .16 + .84*aAct + aPad*.25;
      gl_PointSize = (aPad > .5 ? 8. : 3.6) * (1. + aAct*1.7) * uPx * (22. / -mv.z); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord-.5); if (d > .5) discard; gl_FragColor = vec4(vC, vA*smoothstep(.5,.05,d)); }`,
})));
const E = D.edges.pre.length, ep = new Float32Array(E * 6), eAct = new Float32Array(E * 2), eInh = new Float32Array(E * 2);
D.edges.pre.forEach((a, k) => { ep.set(pos.subarray(a * 3, a * 3 + 3), k * 6); ep.set(pos.subarray(D.edges.post[k] * 3, D.edges.post[k] * 3 + 3), k * 6 + 3); eInh[k * 2] = eInh[k * 2 + 1] = D.edges.w[k] < 0 ? 1 : 0; });
const eg = new THREE.BufferGeometry();
eg.setAttribute('position', new THREE.BufferAttribute(ep, 3)); eg.setAttribute('aAct', new THREE.BufferAttribute(eAct, 1)); eg.setAttribute('aInh', new THREE.BufferAttribute(eInh, 1));
scene.add(new THREE.LineSegments(eg, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute float aAct, aInh; varying float vA, vI; void main(){ vA = aAct; vI = aInh; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `varying float vA, vI; void main(){ vec3 c = vI > .5 ? vec3(.18,.5,1.) : vec3(1.,.23,.19); gl_FragColor = vec4(c, .018 + vA*.6); }`,
})));

const tmp = new THREE.Vector3();
function placeTags() {
  const w = vp.clientWidth, h = vp.clientHeight, show = $('#tagsBtn').getAttribute('aria-pressed') === 'true';
  pads().forEach((p, k) => {
    const el = tagEls[k]; tmp.fromArray(pos, p.idx * 3).project(camera);
    const vis = show && tmp.z < 1; el.style.display = vis ? 'block' : 'none';
    if (vis) el.style.transform = `translate(${(tmp.x * .5 + .5) * w + 8}px,${(-tmp.y * .5 + .5) * h - 8}px)`;
  });
}
const tagEls = Array.from({ length: 12 }, () => { const s = document.createElement('span'); s.className = 'tag'; $('#tags').appendChild(s); return s; });

const VIEWS = { frontal: [0, 0.3, 26], dorsal: [0, 26, 0.01], lateral: [26, 0.3, 0], iso: [15, 11, 18], circuito: null };
let tween = null;
function setView(name) {
  const to = VIEWS[name] ? new THREE.Vector3(...VIEWS[name]) : centroid.clone().add(new THREE.Vector3(4, 2.5, 7));
  const tTo = VIEWS[name] ? new THREE.Vector3() : centroid.clone();
  tween = { from: camera.position.clone(), to, tFrom: controls.target.clone(), tTo, t0: performance.now(), dur: 800 };
  $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
}
$$('[data-view]').forEach((b) => b.onclick = () => setView(b.dataset.view));
$('#rotBtn').onclick = (e) => { controls.autoRotate = !controls.autoRotate; e.currentTarget.setAttribute('aria-pressed', String(controls.autoRotate)); };
$('#tagsBtn').onclick = (e) => e.currentTarget.setAttribute('aria-pressed', String(e.currentTarget.getAttribute('aria-pressed') !== 'true'));
controls.addEventListener('start', () => tween = null);
camera.position.set(0, 0.3, 26);
new ResizeObserver(() => { const w = vp.clientWidth, h = vp.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }).observe(vp);

/* =============== pads =============== */
const LAYOUT = [9, 10, 11, 6, 7, 8, 3, 4, 5, 0, 1, 2];
const pads = () => D.modos[sense()].pads;
const roleOf = (p) => p.idx === D.mn9 ? 'naranja' : isSensor[p.idx] ? 'blanco' : p.inhibidora ? 'azul' : 'rojo';
const padEls = [], rate = new Float32Array(12);
for (const k of LAYOUT) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'pad';
  b.innerHTML = '<span class="key"></span><span class="hz">0</span><span class="type"></span><span class="role"></span>';
  b.onclick = () => {
    const p = pads()[k], on = !sim.silenced.has(p.idx); on ? sim.silenced.add(p.idx) : sim.silenced.delete(p.idx);
    aOff[p.idx] = on ? 1 : 0; ng.attributes.aOff.needsUpdate = true; renderPads(); flash(`${on ? 'SIL' : 'ON'} ${p.tipo}`);
  };
  $('#pads').appendChild(b); padEls[k] = b;
}
function renderPads() {
  aPad.fill(0);
  pads().forEach((p, k) => {
    const b = padEls[k]; aPad[p.idx] = 1;
    b.dataset.role = roleOf(p); b.classList.toggle('off', sim.silenced.has(p.idx)); b.setAttribute('aria-pressed', String(sim.silenced.has(p.idx)));
    b.title = `FlyWire ${p.flywire_id} · ${p.tipo} · ${p.clase} · ${p.nt} · clic para silenciar`;
    $('.key', b).textContent = p.pad; $('.type', b).textContent = p.tipo; $('.role', b).textContent = p.clase + (p.inhibidora ? ' · inh' : '');
    tagEls[k].textContent = `${p.pad} · ${p.tipo}`;
  });
  ng.attributes.aPad.needsUpdate = true;
  $('#padMode').textContent = sense() === 'gusto' ? 'GUSTO' : 'OÍDO';
}

/* =============== menú y tableros =============== */
function setDash(d) {
  st.dash = d; st.menu = false; document.body.dataset.menu = 'false';
  $$('[data-dash]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.dash === d)); });
  $$('.board').forEach((el) => { const on = el.id === 'board-' + d; el.hidden = !on; if (on) { el.classList.remove('boot'); void el.offsetWidth; el.classList.add('boot'); } });
  if (d !== 'oido' && ear.kind) { ear.stop(); st.source = 'manual'; syncSource(); }
  renderPads(); flash(d === 'gusto' ? 'MODO GUSTO' : d === 'oido' ? 'MODO OIDO' : 'MODO DATOS');
}
$('#brainBtn').onclick = () => { st.menu = !st.menu; document.body.dataset.menu = String(st.menu); $('#brainBtn').setAttribute('aria-expanded', String(st.menu)); };
$$('[data-dash]').forEach((b) => b.onclick = () => setDash(b.dataset.dash));

// barras de segmentos (range)
function bindBar(el) {
  const upd = () => { el.style.setProperty('--p', (el.value - el.min) / (el.max - el.min) * 100 + '%'); const o = $(`[data-out="${el.id}"]`); if (o) o.innerHTML = seg(Math.round(el.value), 3); };
  el.addEventListener('input', upd); upd(); el._upd = upd;
}
$$('input.bar').forEach(bindBar);

// oído: fuente
async function setSource(s) {
  try {
    if (s === 'mic') await ear.mic();
    else if (s === 'manual') ear.stop();
    st.source = s;
  } catch (e) { flash('SIN MICROFONO'); st.source = 'manual'; ear.stop(); }
  syncSource();
}
function syncSource() {
  $$('[data-source]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.source === st.source)));
  ['oCE', 'oF', 'oDM'].forEach((id) => $('#' + id).disabled = st.source !== 'manual');
  $('#srcName').textContent = st.source === 'manual' ? 'MANUAL' : st.source === 'mic' ? 'MICROFONO' : (ear.name || 'ARCHIVO').toUpperCase().slice(0, 24);
}
$$('[data-source]').forEach((b) => b.onclick = () => b.dataset.source === 'archivo' ? $('#audioFile').click() : setSource(b.dataset.source));
$('#audioFile').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { await ear.file(f); st.source = 'archivo'; } catch { flash('AUDIO NO VALIDO'); } syncSource(); };

// datos
function loadCSV(text, name) {
  const d = parseCSV(text); if (!d.cols.length) { flash('SIN COLUMNAS NUMERICAS'); return; }
  st.data = d; st.row = 0; st.name = name; renderMap(); flash(`${d.rows} FILAS`);
}
function renderMap() {
  const d = st.data; $('#csvName').textContent = d ? `${st.name} · ${d.rows} filas · ${d.cols.length} columnas numéricas` : 'sin archivo';
  const wrap = $('#mapRows'); wrap.innerHTML = '';
  SENSES[st.target].forEach((s, i) => {
    const id = 'map-' + s, row = document.createElement('div'); row.className = 'maprow';
    row.innerHTML = `<label for="${id}">${SENSE_LABEL[s]}</label><select id="${id}"><option value="">—</option>${(d?.cols || []).map((c, ci) => `<option value="${ci}">${c.name}</option>`).join('')}</select><span class="mini" id="lvl-${s}"></span>`;
    wrap.appendChild(row);
    const sel = $('select', row);
    if (st.map[s] === undefined && d) st.map[s] = d.cols[i] ? String(i) : '';
    sel.value = st.map[s] ?? ''; sel.onchange = () => st.map[s] = sel.value;
  });
  $$('[data-target]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.target === st.target)));
}
$('#csvBtn').onclick = () => $('#csvFile').click();
$('#csvFile').onchange = async (e) => { const f = e.target.files[0]; if (f) loadCSV(await f.text(), f.name); };
$('#demoBtn').onclick = () => loadCSV(demoCSV(), 'ejemplo-sintetico.csv');
$$('[data-target]').forEach((b) => b.onclick = () => { st.target = b.dataset.target; st.map = {}; renderMap(); renderPads(); });
renderMap();

/* =============== simulación, reloj y MIDI =============== */
let mn9 = 0, groom = 0, active = 0, hist = new Array(48).fill(0), lvl = {};
function rates() {
  if (st.dash === 'gusto') return { dulce: +$('#gD').value, amargo: +$('#gA').value };
  if (st.dash === 'oido') {
    if (st.source !== 'manual') { const L = ear.read(); ['oCE', 'oF', 'oDM'].forEach((id, i) => { $('#' + id).value = Math.round(L[i] * 200); $('#' + id)._upd(); }); }
    return { jon_ce: +$('#oCE').value, jon_f: +$('#oF').value, jon_dm: +$('#oDM').value };
  }
  const r = {}; if (!st.data) return r;
  for (const s of SENSES[st.target]) { const ci = st.map[s]; r[s] = ci === '' || ci === undefined ? 0 : st.data.cols[ci].norm[st.row] * 200; }
  return r;
}
function step() {
  st.steps++;
  if (st.dash === 'datos' && st.data && st.steps % Number($('#perRow').value) === 0) st.row = (st.row + 1) % st.data.rows;
  const ms = +$('#scale').value, R = rates(); lvl = R;
  const cnt = sim.advance(ms, R), send = $('#sendBtn').getAttribute('aria-pressed') === 'true', ch = +$('#ch').value, base = +$('#base').value;
  active = 0;
  for (let i = 0; i < N; i++) if (cnt[i]) { active++; aAct[i] = 1; }
  for (let k = 0; k < E; k++) if (cnt[D.edges.pre[k]]) eAct[k * 2] = eAct[k * 2 + 1] = 1;
  pads().forEach((p, k) => {
    const c = cnt[p.idx]; rate[k] = rate[k] * 0.9 + 0.1 * (c / (ms / 1000));
    if (c > 0) {
      if (send && ko.output) { ko.hit(base + k, Math.min(127, 70 + 15 * (c - 1)), ch, 60); st.lastHit = performance.now(); }
      const el = padEls[k]; el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 70);
    }
  });
  mn9 = mn9 * 0.9 + 0.1 * (cnt[D.mn9] / (ms / 1000));
  const g = D.modos.oido.pads[11].idx; groom = groom * 0.9 + 0.1 * (cnt[g] / (ms / 1000));
  hist.push(active); hist.shift(); flyFrame++;
}
const ko = new KO2({
  onStep: step,
  onStart: () => { if (!ko.running) togglePlay(); },
  onStop: () => { if (ko.running) togglePlay(); },
  onNote: ({ note }) => { // un pad del K.O. II estimula su neurona (como optogenética)
    const k = note - +$('#base').value; if (k < 0 || k > 11) return;
    sim.g[pads()[k].idx] += D.params.w_poi * 2;
  },
  onState: (s) => { $('#midiState').textContent = s.output ? s.output.toUpperCase() : 'SIN K.O. II'; flash(s.output ? 'K.O. II CONECTADO' : 'SIN K.O. II'); },
});
function togglePlay() {
  ko.running ? ko.stop() : ko.start();
  $('#playBtn').setAttribute('aria-pressed', String(ko.running)); $('#playBtn').setAttribute('aria-label', ko.running ? 'Detener' : 'Iniciar');
  $('#playBtn').innerHTML = ko.running ? ICON.stop : ICON.play;
}
$('#playBtn').onclick = togglePlay;
$('#connectBtn').onclick = async () => { try { await ko.connect(); } catch (e) { flash('SIN WEB MIDI · USA CHROME'); } };
$('#resetBtn').onclick = () => { sim.reset(); sim.silenced.clear(); aOff.fill(0); ng.attributes.aOff.needsUpdate = true; st.row = 0; renderPads(); flash('RESTABLECIDO'); };
$('#sendBtn').onclick = (e) => e.currentTarget.setAttribute('aria-pressed', String(e.currentTarget.getAttribute('aria-pressed') !== 'true'));
for (let c = 1; c <= 16; c++) $('#ch').add(new Option(c, c));
$('#ibpm').addEventListener('input', () => ko.internalBpm = +$('#ibpm').value);

/* =============== pantalla: mensajes, mosca, lecturas =============== */
let msgUntil = 0;
function flash(t) { $('#msg').textContent = t; msgUntil = performance.now() + 1400; }
let flyFrame = 0;
const flyParts = Object.fromEntries($$('#fly [data-p]').map((g) => [g.dataset.p, g]));
function drawFly() {
  const on = new Set(['cuerpo']), run = ko.running, mode = st.dash;
  on.add(run && flyFrame % 2 ? 'alasAbajo' : 'alasArriba');
  let caption = run ? 'LISTA' : 'EN PAUSA';
  if (mode === 'gusto' || (mode === 'datos' && st.target === 'gusto')) {
    on.add('patas');
    if ((lvl.dulce || 0) > 0 && run && flyFrame % 4 < 2) on.add('gota');
    if (mn9 > 15) { on.add('proboscide'); caption = 'COMIENDO'; } else if (run && (lvl.amargo || 0) > (lvl.dulce || 0)) caption = 'RECHAZA'; else if (run) caption = 'PROBANDO';
  } else {
    on.add('antenas');
    const loud = (lvl.jon_ce || 0) + (lvl.jon_f || 0) + (lvl.jon_dm || 0) > 0;
    if (loud && run && flyFrame % 2) on.add('ondas');
    if (groom > 8 && run) { on.add('acicalar'); caption = 'ACICALANDO'; } else { on.add('patas'); if (loud && run) caption = 'ESCUCHANDO'; }
  }
  if (mode === 'datos') { on.add('hoja'); if (st.data && run) caption = `FILA ${st.row + 1}/${st.data.rows}`; }
  if (performance.now() - st.lastHit < 120) on.add('notas');
  for (const [k, g] of Object.entries(flyParts)) g.classList.toggle('on', on.has(k));
  $('#flyCap').textContent = caption;
}
let last = performance.now(), slow = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; const k = Math.pow(0.02, dt);
  for (let i = 0; i < N; i++) aAct[i] *= k; for (let i = 0; i < eAct.length; i++) eAct[i] *= k;
  ng.attributes.aAct.needsUpdate = true; eg.attributes.aAct.needsUpdate = true;
  if (tween) { const u = Math.min(1, (now - tween.t0) / tween.dur), e = 1 - Math.pow(1 - u, 3); camera.position.lerpVectors(tween.from, tween.to, e); controls.target.lerpVectors(tween.tFrom, tween.tTo, e); if (u >= 1) tween = null; }
  if (!ko.running && st.dash === 'oido' && st.source !== 'manual') rates(); // vúmetro vivo aunque esté en pausa
  controls.update(); renderer.render(scene, camera); placeTags(); drawFly();
  if ((slow += dt) > 0.12) {
    slow = 0;
    $('#bpmSeg').innerHTML = seg(Math.round(ko.bpm), 3);
    const big = st.dash === 'gusto' ? Math.round(mn9) : st.dash === 'oido' ? Math.round(groom) : st.data ? st.row + 1 : 0;
    $('#bigSeg').innerHTML = seg(big, 3);
    $('#bigLbl').textContent = st.dash === 'gusto' ? 'MN9 HZ' : st.dash === 'oido' ? 'DNG35 HZ' : 'FILA';
    $('#actSeg').innerHTML = seg(active, 3);
    pads().forEach((p, i) => $('.hz', padEls[i]).textContent = rate[i].toFixed(0));
    const mx = Math.max(12, ...hist); $('#hist').innerHTML = hist.map((v) => `<i style="--h:${Math.round(v / mx * 100)}%"></i>`).join('');
    $('#st-midi').classList.toggle('on', !!ko.output); $('#st-sync').classList.toggle('on', ko.hasExternalClock);
    $('#st-nota').classList.toggle('on', performance.now() - st.lastHit < 200); $('#st-mic').classList.toggle('on', ear.kind === 'mic');
    $('#st-archivo').classList.toggle('on', ear.kind === 'archivo' || (st.dash === 'datos' && !!st.data));
    $('#eatLbl').classList.toggle('on', mn9 > 15); $('#vetoLbl').classList.toggle('on', ko.running && (+$('#gA').value) > 0 && mn9 < 5 && (+$('#gD').value) > 0);
    $('#groomLbl').classList.toggle('on', groom > 8);
    if (st.dash === 'datos' && st.data) SENSES[st.target].forEach((s) => { const el = $('#lvl-' + s); if (el) el.style.setProperty('--p', Math.round((lvl[s] || 0) / 2) + '%'); });
    if (performance.now() > msgUntil) $('#msg').textContent = ko.running ? `${active} NEURONAS ACTIVAS` : 'LISTA';
  }
  requestAnimationFrame(frame);
}
setDash('gusto'); syncSource(); flash('FLY PUNCH');
requestAnimationFrame(frame);
