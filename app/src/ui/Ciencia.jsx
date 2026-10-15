import { useEffect, useRef, useState } from 'react';
import { session, SENSES, SENSE_LABEL } from '../engine/session.js';
import { SENTIDOS, SALIDAS, ESTIMULO, describe, MODELO, POR_QUE, CLASES } from '../engine/ciencia.js';
import { PAD_KEYS } from '../engine/midi.js';
import { useS, Icon } from './kit.jsx';

// ---------- «La mosca te cuenta»: una línea sutil sobre el cerebro que explica lo que está pasando, mientras toca ----------
// Avisa cuando una salida se enciende (comer, limpiarse, escapar…), cuando mueves un estímulo y, de vez en cuando, cuál
// neurona dispara más. Máximo un mensaje cada 7 s y sin repetirse; se oculta con la ×.
export function Narrador() {
  const s = useS(), [msg, setMsg] = useState(null), st = useRef({ last: 0, seen: {}, on: {}, inputs: { ...session.s.inputs }, hot: 0 });
  const on = s.ciencia?.narrar !== false;
  useEffect(() => {
    if (!on) return;
    const tick = () => {
      const S = session, L = S.live, now = performance.now(), m = st.current; if (!S.s.playing) return;
      const say = (key, text, why) => { if (now - m.last < 7000 || (m.seen[key] && now - m.seen[key] < 60000)) return false; m.last = now; m.seen[key] = now; setMsg({ text, why, at: now, key }); m.cur = key; return true; };
      // si la salida que se anunció ya se apagó (p. ej. subiste el amargo), el mensaje se quita para no contradecir lo que suena
      if (m.cur?.startsWith('out:')) { const sen = m.cur.slice(4), thr = SALIDAS[sen]?.[0] || 30, hz = sen === 'gusto' ? L.mn9 : L.out?.[sen] || 0; if (hz < thr * 0.4) { m.cur = null; setMsg(null); } }
      const senses = [...new Set(S.s.tracks.filter((t) => S.audible(t)).map((t) => t.sense))];
      // 1 · una salida que se enciende
      for (const sen of senses) { const [thr, fn] = SALIDAS[sen] || []; if (!fn) continue; const hz = sen === 'gusto' ? L.mn9 : L.out?.[sen] || 0, was = m.on[sen]; m.on[sen] = hz > thr; if (hz > thr && !was && say(`out:${sen}`, fn(S.s.inputs), sen)) return; }
      // 2 · un estímulo que cambió mucho
      for (const [k, v] of Object.entries(S.s.inputs)) { const d = v - (m.inputs[k] ?? 0); if (Math.abs(d) > 40) { m.inputs = { ...S.s.inputs }; const sen = Object.keys(SENSES).find((x) => SENSES[x].includes(k)); if (say(`in:${k}:${d > 0}`, `${d > 0 ? 'Subiste' : 'Bajaste'} ${SENSE_LABEL[k].toLowerCase()}. ${ESTIMULO[k]}${senses.includes(sen) ? '' : ' (Ninguna pista toca este sentido ahora.)'}`, sen)) return; } }
      m.inputs = { ...S.s.inputs };
      // 3 · cada ~25 s: la neurona más activa
      if (now - m.hot > 25000) { let best = null; for (const t of S.s.tracks) { if (!S.audible(t)) continue; S.pads(t).forEach((p, k) => { const r = L.rate?.[t.id]?.[k] || 0; if (!best || r > best.r) best = { r, p, t, k }; }); }
        if (best && best.r > 15) { m.hot = now; say(`hot:${best.p.tipo}`, `La que más dispara ahora es ${best.p.tipo}: ${describe(best.p)} Suena en el pad ${PAD_KEYS[best.t.map[best.k]]} de ${best.t.name}.`, best.t.sense); } }
    };
    const id = setInterval(tick, 700); return () => clearInterval(id);
  }, [on]);
  useEffect(() => { if (!msg) return; const id = setTimeout(() => setMsg((x) => (x === msg ? null : x)), 10000); return () => clearTimeout(id); }, [msg]);
  if (!on || !msg) return null;
  return (
    <div className="narrador" role="status" aria-live="polite">
      <span className="mono" style={{ fontSize: 9.5, opacity: 0.6, flex: 'none' }}>LA MOSCA</span>
      <span style={{ flex: 1 }}>{msg.text}</span>
      {msg.why && <button type="button" className="linkbtn" onClick={() => session.set({ cienciaFicha: msg.why, ciencia: { ...(session.s.ciencia || {}), ficha: true } }, true)}>¿Por qué?</button>}
      <button type="button" className="iconbtn" style={{ border: 0, width: 22, height: 22, minWidth: 22 }} aria-label="Ocultar la narración" title="Ocultar la narración (puedes volver a activarla en Aprende)" onClick={() => session.set({ ciencia: { ...(session.s.ciencia || {}), narrar: false } }, true)}><Icon name="x" size={11} /></button>
    </div>
  );
}

// ---------- ficha de un sentido: qué es en la mosca real y cómo suena aquí ----------
export function Ficha({ sense, compact = false }) {
  const f = SENTIDOS[sense]; if (!f) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, lineHeight: 1.5 }}>
      {!compact && <strong style={{ fontSize: 14 }}>{f.titulo}</strong>}
      <span>{f.bio}</span>
      <span className="muted"><strong style={{ color: 'var(--text)' }}>Salida:</strong> {f.salida}</span>
      <span className="muted"><strong style={{ color: 'var(--text)' }}>Cómo suena:</strong> {f.musica}</span>
      <span className="well" style={{ padding: '8px 10px', fontSize: 12 }}><strong>Dato:</strong> {f.dato}</span>
      <span className="dim mono" style={{ fontSize: 10 }}>{f.fuente}</span>
    </div>
  );
}
// plegable para el Estudio (se recuerda abierto o cerrado)
export function FichaPlegable({ sense }) {
  const s = useS(), open = s.ciencia?.ficha === true || s.cienciaFicha === sense, ref = useRef(null);
  useEffect(() => { if (s.cienciaFicha === sense) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [s.cienciaFicha]);
  return (
    <details ref={ref} className="ciencia-det" open={open} onToggle={(e) => { const o = e.currentTarget.open; if (o !== open) session.set({ ciencia: { ...(s.ciencia || {}), ficha: o }, cienciaFicha: null }, true); }}>
      <summary>La ciencia de este circuito</summary>
      <Ficha sense={sense} compact />
    </details>
  );
}

// ---------- para Aprende: el modelo, por qué estos sentidos y las clases de neuronas ----------
export function CienciaAprende() {
  const s = useS(), [sel, setSel] = useState('gusto'), narr = s.ciencia?.narrar !== false;
  return (
    <section className="panel" style={{ gap: 14 }} aria-label="La ciencia detrás">
      <div className="panel-head"><h2>La ciencia detrás</h2>
        <label className="row" style={{ gap: 6, fontSize: 12 }}><input type="checkbox" checked={narr} onChange={(e) => session.set({ ciencia: { ...(s.ciencia || {}), narrar: e.target.checked } }, true)} style={{ accentColor: 'var(--acc)' }} />La mosca te cuenta lo que pasa (en el Estudio)</label></div>
      <div className="cols" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong style={{ fontSize: 14 }}>Cómo funciona el modelo</strong>
          <div className="ciencia-flujo" aria-hidden="true">{['Estímulo', 'Sensores', 'Interneuronas', 'Descendentes y motoneuronas', 'Nota'].map((x, i, a) => <span key={x}>{x}{i < a.length - 1 && <em>→</em>}</span>)}</div>
          {MODELO.map((p) => <p key={p} className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55 }}>{p}</p>)}
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55 }}><strong>¿Por qué estos sentidos?</strong> <span className="muted">{POR_QUE}</span></p>
          <strong style={{ fontSize: 14, marginTop: 6 }}>Las neuronas y su papel</strong>
          {Object.entries(CLASES).map(([k, [n, d]]) => <span key={k} className="muted" style={{ fontSize: 12.5 }}><strong style={{ color: 'var(--text)' }}>{n}.</strong> {d}</span>)}
        </div>
        <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{Object.keys(SENTIDOS).map((k) => <button key={k} type="button" className={`btn ${sel === k ? 'acc' : ''}`} style={{ height: 30 }} onClick={() => setSel(k)}><Icon name={k} size={14} />{SENTIDOS[k].titulo.split(':')[0]}</button>)}</div>
          <div className="well" style={{ padding: 14 }}><Ficha sense={sel} /></div>
        </div>
      </div>
      <span className="dim" style={{ fontSize: 10.5 }}>Datos: FlyWire v783 (Dorkenwald et al., Nature 2024) · modelo: Shiu et al., Nature 2024. Es una simplificación: reproduce bien qué neuronas se activan, no toda su biología.</span>
    </section>
  );
}
