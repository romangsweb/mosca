// Fly Punch · medidor y «Mezclar por mí». Escucha unos segundos lo que suena en la compu, mide cada pista (nivel y energía
// por bandas) y propone niveles y canal con reglas de mezcla de toda la vida: el bombo se queda con los graves, la melodía
// un poco abajo de la batería, nadie se come a nadie. La IA (opcional) parte de las mismas medidas.
const BANDAS = { graves: [30, 150], medios: [150, 2000], agudos: [2000, 6000], brillo: [6000, 16000] };
export function analysers(session) {
  const syn = session.synth, ctx = syn.ensure(), ch = syn.chain, A = (syn._an ||= { master: null, tracks: {} });
  if (!A.master) { A.master = ctx.createAnalyser(); A.master.fftSize = 4096; A.master.smoothingTimeConstant = 0.82; ch.post.connect(A.master); }
  for (const [id, b] of Object.entries(ch.buses)) if (!A.tracks[id]) { const a = ctx.createAnalyser(); a.fftSize = 4096; a.smoothingTimeConstant = 0.82; b.mk.connect(a); A.tracks[id] = a; }
  return A;
}
const db = (p) => (p > 1e-12 ? 10 * Math.log10(p) : -120);
// mide durante ms: promedio de potencia por banda y nivel RMS de cada pista
export async function medir(session, ms = 4000, onProgress) {
  const A = analysers(session), sr = session.synth.ctx.sampleRate, acc = {}, t0 = performance.now();
  while (performance.now() - t0 < ms) {
    for (const [id, an] of Object.entries(analysers(session).tracks)) {
      const n = an.frequencyBinCount, f = new Float32Array(n), w = new Float32Array(an.fftSize); an.getFloatFrequencyData(f); an.getFloatTimeDomainData(w);
      const a = (acc[id] ||= { k: 0, rms: 0, b: { graves: 0, medios: 0, agudos: 0, brillo: 0 } }); a.k++;
      let s2 = 0; for (const x of w) s2 += x * x; a.rms += s2 / w.length;
      for (const [b, [lo, hi]] of Object.entries(BANDAS)) { let p = 0; for (let i = Math.floor((lo / (sr / 2)) * n); i < Math.min(n, (hi / (sr / 2)) * n); i++) p += 10 ** (f[i] / 10); a.b[b] += p; }
    }
    onProgress?.((performance.now() - t0) / ms); await new Promise((r) => setTimeout(r, 100));
  }
  void A;
  return Object.fromEntries(Object.entries(acc).map(([id, a]) => [id, { rms_db: +db(a.rms / a.k).toFixed(1), bandas: Object.fromEntries(Object.entries(a.b).map(([b, p]) => [b, +db(p / a.k).toFixed(1)])) }]).filter(([, m]) => m.rms_db > -80));
}
// reglas: devuelve los cambios por pista { id: { level, strip, rev } } y las razones en palabras
export function proponerMezcla(session, med) {
  const S = session, ids = Object.keys(med).filter((id) => S.track(id)), out = {}, por = [];
  if (!ids.length) return { cambios: {}, por: ['No sonó ninguna pista en la compu: pon alguna en «Compu» o «Ambos» y dale a Tocar.'] };
  const ritmo = (id) => S.track(id).mode !== 'melodia';
  // 1 · niveles: la batería manda; la melodía 3 dB abajo; una segunda batería 2 dB abajo de la primera
  const ref = Math.max(...ids.map((id) => med[id].rms_db)); let drums = 0;
  for (const id of [...ids].sort((a, b) => med[b].rms_db - med[a].rms_db)) {
    const off = ritmo(id) ? (drums++ ? -2 : 0) : -3, want = ref + off, d = want - med[id].rms_db, t = S.track(id);
    out[id] = { level: Math.max(0.2, Math.min(1, (t.level || 1) * 10 ** (d / 20))) };
  }
  const mx = Math.max(...Object.values(out).map((o) => o.level)); for (const o of Object.values(out)) o.level = +Math.min(1, o.level / mx).toFixed(2); // la más fuerte queda al 100%
  por.push('Niveles: la batería al frente, la melodía 3 dB abajo, una segunda batería 2 dB abajo de la primera.');
  if (S.can('canal')) {
    // 2 · graves: solo una pista se queda con ellos (la que más tiene); las demás los recortan
    const g = [...ids].sort((a, b) => med[b].bandas.graves - med[a].bandas.graves), dueño = g[0];
    for (const id of g.slice(1)) if (med[id].bandas.graves > med[dueño].bandas.graves - 9) { out[id].strip = { ...(S.track(id).strip || {}), lo: -6 }; por.push(`${S.track(id).name}: −6 dB de graves para dejarle espacio a ${S.track(dueño).name}.`); }
    // 3 · presencia: una melodía apagada gana un poco de agudos
    for (const id of ids) if (!ritmo(id) && med[id].bandas.agudos < med[id].bandas.medios - 18) { out[id].strip = { ...(out[id].strip || S.track(id).strip || {}), hi: 3 }; por.push(`${S.track(id).name}: +3 dB de agudos para que se escuche más clara.`); }
  } else por.push('Con Pro también recorta graves y da presencia con el canal de cada pista.');
  // 4 · aire: si nadie tiene reverb, un poco a las melodías
  if (ids.every((id) => !S.track(id).rev)) for (const id of ids) if (!ritmo(id)) { out[id].rev = 0.14; por.push(`${S.track(id).name}: un poco de reverb para darle aire.`); }
  return { cambios: out, por };
}
export function aplicarMezcla(S, cambios) {
  S.batch(() => { for (const [id, c] of Object.entries(cambios)) { const t = S.track(id); if (!t) continue; S.setTrack(id, { ...(c.level != null ? { level: c.level } : {}), ...(c.rev != null ? { rev: c.rev } : {}), ...(c.dly != null ? { dly: c.dly } : {}), ...(c.strip && S.can('canal') ? { strip: c.strip } : {}) }); } });
}
