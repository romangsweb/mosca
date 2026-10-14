import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { session } from '../engine/session.js';

const UM = 50;
const VIEWS = { Frontal: [0, 0.3, 22], Dorsal: [0, 22, 0.01], Lateral: [22, 0.3, 0], Circuito: null };

// Visor 3D: nube del cerebro completo + 818 neuronas del circuito; se encienden al disparar.
export default function Brain({ view, selTrack, selPad, onPick }) {
  const host = useRef(null), api = useRef(null);
  useEffect(() => {
    const D = session.D, el = host.current, N = D.n;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x000000, 0); el.prepend(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 4, maxDistance: 60, autoRotate: true, autoRotateSpeed: 0.25 });
    const sc = (x, y, z) => [-x / UM, -y / UM, -z / UM];
    const raw = session.cloud, cp = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i += 3) cp.set(sc(raw[i] / 10, raw[i + 1] / 10, raw[i + 2] / 10), i);
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3));
    cg.computeBoundingSphere(); const bs = cg.boundingSphere;
    // profundidad: lo cercano a la cámara más claro y grande, lo lejano más tenue y azulado → se lee el volumen
    const depthU = { uCam: { value: 22 }, uR: { value: bs.radius }, uPx: { value: renderer.getPixelRatio() } };
    const DEPTH = `uniform float uCam, uR; float depthF(vec4 mv){ return clamp((uCam + uR * .8 + mv.z) / (uR * 1.6), 0., 1.); }`;
    scene.add(new THREE.Points(cg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: depthU,
      vertexShader: `${DEPTH} uniform float uPx; varying float vF; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vF = depthF(mv);
        gl_PointSize = (1.4 + 1.6*vF) * uPx * (22. / -mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying float vF; void main(){ float d = length(gl_PointCoord-.5); if (d > .5) discard;
        vec3 c = mix(vec3(.30,.38,.52), vec3(.93,.93,.95), vF); gl_FragColor = vec4(c, (.04 + .11*vF*vF) * smoothstep(.5,.1,d)); }`,
    })));

    const pos = new Float32Array(N * 3), aAct = new Float32Array(N), aRole = new Float32Array(N), aPad = new Float32Array(N);
    const isSensor = new Uint8Array(N); Object.values(D.grupos).forEach((g) => g.forEach((i) => (isSensor[i] = 1)));
    const centroid = new THREE.Vector3();
    for (let i = 0; i < N; i++) { pos.set(sc(...D.pos_um[i]), i * 3); centroid.x += pos[i * 3]; centroid.y += pos[i * 3 + 1]; centroid.z += pos[i * 3 + 2]; aRole[i] = i === D.mn9 ? 3 : isSensor[i] ? 0 : D.inh[i] ? 2 : 1; }
    centroid.divideScalar(N);
    const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    for (const [k, a] of Object.entries({ aAct, aRole, aPad })) ng.setAttribute(k, new THREE.BufferAttribute(a, 1));
    const C = ['#ECECEE', '#FF6A1A', '#7D93B2', '#FF8A3D'].map((c) => new THREE.Color(c));
    scene.add(new THREE.Points(ng, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uC: { value: C }, ...depthU },
      vertexShader: `${DEPTH} attribute float aAct, aRole, aPad; uniform vec3 uC[4]; uniform float uPx; varying vec3 vC; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vec3 c = uC[int(aRole+.5)]; float f = depthF(mv);
          vC = mix(mix(vec3(.45,.52,.62), vec3(.85), f), c, min(1., aAct*1.6 + aPad*.6)); vA = (.16 + .2*f) + .55*aAct + aPad*.3;
          gl_PointSize = (aPad > .5 ? 8. : 3.6) * (.8 + .4*f) * (1. + aAct*1.2) * uPx * (22. / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord-.5); if (d > .5) discard; float core = smoothstep(.5,.0,d); gl_FragColor = vec4(vC, vA*core*core*1.4); }`,
    })));
    const E = D.edges.pre.length, ep = new Float32Array(E * 6), eAct = new Float32Array(E * 2), eInh = new Float32Array(E * 2);
    D.edges.pre.forEach((a, k) => { ep.set(pos.subarray(a * 3, a * 3 + 3), k * 6); ep.set(pos.subarray(D.edges.post[k] * 3, D.edges.post[k] * 3 + 3), k * 6 + 3); eInh[k * 2] = eInh[k * 2 + 1] = D.edges.w[k] < 0 ? 1 : 0; });
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(ep, 3)); eg.setAttribute('aAct', new THREE.BufferAttribute(eAct, 1)); eg.setAttribute('aInh', new THREE.BufferAttribute(eInh, 1));
    scene.add(new THREE.LineSegments(eg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: depthU,
      vertexShader: `${DEPTH} attribute float aAct, aInh; varying float vA, vI, vF; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vA = aAct; vI = aInh; vF = depthF(mv); gl_Position = projectionMatrix*mv; }`,
      // en reposo las conexiones se ven tenues en gris (excitan) o azul acero (inhiben); al disparar, naranja
      fragmentShader: `varying float vA, vI, vF; void main(){ vec3 rest = vI > .5 ? vec3(.49,.58,.72) : vec3(.82,.80,.78), hot = vI > .5 ? vec3(.55,.66,.85) : vec3(1.,.42,.1);
        gl_FragColor = vec4(mix(rest, hot, min(1., vA*1.5)), (.014 + .03*vF) + vA*.34); }`,
    })));

    // etiquetas de los 12 pads de la pista seleccionada
    const tags = Array.from({ length: 12 }, () => { const s = document.createElement('span'); s.className = 'tag'; el.querySelector('.tags').appendChild(s); return s; });
    const tmp = new THREE.Vector3(); let tween = null, padIdx = [], sel = -1, allTags = false;
    const setPads = (trackId, selK) => {
      aPad.fill(0); const t = session.track(trackId); padIdx = session.pads(t).map((p) => p.idx); sel = selK;
      padIdx.forEach((i) => (aPad[i] = 1)); ng.attributes.aPad.needsUpdate = true;
      session.pads(t).forEach((p, k) => { tags[k].textContent = p.tipo; tags[k].classList.toggle('sel', k === selK); });
    };
    const setView = (name) => {
      const to = VIEWS[name] ? new THREE.Vector3(...VIEWS[name]) : centroid.clone().add(new THREE.Vector3(4, 2.5, 7));
      const tTo = VIEWS[name] ? new THREE.Vector3() : centroid.clone(); allTags = name === 'Circuito';
      tween = { from: camera.position.clone(), to, tFrom: controls.target.clone(), tTo, t0: performance.now(), dur: 900 };
    };
    controls.addEventListener('start', () => (tween = null));
    camera.position.set(0, 0.3, 22);
    const ro = new ResizeObserver(() => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }); ro.observe(el);
    const off = session.onStep((n, cnt) => {
      for (let i = 0; i < N; i++) if (cnt[i]) aAct[i] = 1;
      for (let k = 0; k < E; k++) if (cnt[D.edges.pre[k]]) eAct[k * 2] = eAct[k * 2 + 1] = 1;
    });
    // clic: elegir el pad más cercano al puntero
    const pick = (e) => {
      const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = -1, bd = 400;
      padIdx.forEach((i, k) => { tmp.fromArray(pos, i * 3).project(camera); const dx = (tmp.x * 0.5 + 0.5) * r.width - x, dy = (-tmp.y * 0.5 + 0.5) * r.height - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = k; } });
      if (best >= 0) api.current.onPick?.(best);
    };
    let downAt = null;
    renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
    renderer.domElement.addEventListener('pointerup', (e) => { if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 4) pick(e); downAt = null; });
    let last = performance.now(), raf;
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now; const k = Math.pow(0.03, dt);
      for (let i = 0; i < N; i++) aAct[i] *= k; for (let i = 0; i < eAct.length; i++) eAct[i] *= k;
      ng.attributes.aAct.needsUpdate = true; eg.attributes.aAct.needsUpdate = true;
      if (tween) { const u = Math.min(1, (now - tween.t0) / tween.dur), e = 1 - Math.pow(1 - u, 3); camera.position.lerpVectors(tween.from, tween.to, e); controls.target.lerpVectors(tween.tFrom, tween.tTo, e); if (u >= 1) tween = null; }
      controls.update(); depthU.uCam.value = camera.position.distanceTo(bs.center); renderer.render(scene, camera);
      const w = el.clientWidth, h = el.clientHeight;
      padIdx.forEach((i, k) => { const t = tags[k]; tmp.fromArray(pos, i * 3).project(camera); const vis = tmp.z < 1 && (allTags || k === sel || aAct[i] > 0.85); t.style.display = vis ? 'block' : 'none'; if (vis) t.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w + 9}px,${(-tmp.y * 0.5 + 0.5) * h - 7}px)`; t.classList.toggle('hot', aAct[i] > 0.4); });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    api.current = { setPads, setView, onPick: null };
    return () => { cancelAnimationFrame(raf); off(); ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); tags.forEach((t) => t.remove()); };
  }, []);
  useEffect(() => { api.current.onPick = onPick; }, [onPick]);
  useEffect(() => { api.current.setPads(selTrack, selPad); }, [selTrack, selPad]);
  useEffect(() => { api.current.setView(view); }, [view]);
  return <div ref={host} style={{ position: 'absolute', inset: 0 }}><div className="tags" /></div>;
}
