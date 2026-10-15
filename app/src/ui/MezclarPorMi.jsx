import { useState } from 'react';
import { session } from '../engine/session.js';
import { medir, proponerMezcla, aplicarMezcla } from '../engine/medidor.js';
import { pedirMezcla, mezclaACambios, ERRORES } from '../engine/productor.js';
import { useS } from './kit.jsx';

// «Mezclar por mí»: escucha 4 segundos, mide cada pista y propone niveles y canal. Sin IA con reglas clásicas (gratis);
// con una referencia de estilo, Gemini parte de las mismas medidas (Pro). Nada se aplica hasta que lo apruebas; ⌘Z deshace.
const fmt = (S, id, c) => { const t = S.track(id), out = []; if (c.level != null && Math.abs(c.level - t.level) > 0.02) out.push(`nivel ${Math.round(t.level * 100)}→${Math.round(c.level * 100)}%`);
  const st = c.strip || {}, o = t.strip || {}; for (const [k, l] of [['lo', 'graves'], ['mid', 'medios'], ['hi', 'agudos']]) if (st[k] != null && st[k] !== (o[k] || 0)) out.push(`${l} ${st[k] > 0 ? '+' : ''}${(+st[k]).toFixed(1)} dB`);
  if (st.filtro != null && st.filtro !== (o.filtro || 0)) out.push(`filtro ${st.filtro < 0 ? 'quita agudos' : st.filtro > 0 ? 'quita graves' : 'abierto'}`); if (st.drive != null && st.drive !== (o.drive || 0)) out.push(`saturación ${Math.round(st.drive * 100)}%`);
  if (c.rev != null && c.rev !== (t.rev || 0)) out.push(`reverb ${Math.round(c.rev * 100)}%`); if (c.dly != null && c.dly !== (t.dly || 0)) out.push(`delay ${Math.round(c.dly * 100)}%`); return out; };

export default function MezclarPorMi() {
  const s = useS(), pro = session.can('canal'), [busy, setBusy] = useState(null), [prog, setProg] = useState(0), [res, setRes] = useState(null), [ref, setRef] = useState(''), [err, setErr] = useState(null), [ok, setOk] = useState(false);
  const run = async (ia) => {
    setErr(null); setRes(null); setOk(false); if (!s.playing) session.toggle(); setBusy(ia ? 'ia' : 'reglas');
    try {
      const med = await medir(session, 4000, setProg);
      if (!Object.keys(med).length) { setErr('No sonó ninguna pista en la compu: ponlas en «Compu» o «Ambos».'); setBusy(null); return; }
      if (ia) { const r = await pedirMezcla(session, med, ref.trim()); setRes({ cambios: mezclaACambios(session, r), por: [r.explicacion], ia: true }); }
      else setRes(proponerMezcla(session, med));
    } catch (e) { setErr(ERRORES[e.message] || ERRORES.red); }
    setBusy(null); setProg(0);
  };
  const lines = res ? Object.entries(res.cambios).map(([id, c]) => [session.track(id)?.name, fmt(session, id, c)]).filter(([n, l]) => n && l.length) : [];
  return (
    <section className="panel" style={{ gap: 10 }} aria-label="Mezclar por mí">
      <div className="panel-head"><h2>Mezclar por mí</h2><span className="muted" style={{ fontSize: 11 }}>Escucha 4 segundos y propone; tú decides</span></div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn acc" disabled={!!busy} onClick={() => run(false)}>{busy === 'reglas' ? `Escuchando… ${Math.round(prog * 100)}%` : 'Escuchar y proponer'}</button>
        <span className="dim" style={{ fontSize: 11 }}>o con una referencia:</span>
        <input className="input" style={{ flex: '1 1 220px', minWidth: 0 }} maxLength={160} disabled={!pro || !s.user} placeholder={pro && s.user ? '«techno de club», «lo-fi cálido», «que el bajo mande»…' : 'Con Pro: una referencia de estilo (IA)'} value={ref} onChange={(e) => setRef(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && ref.trim()) run(true); }} aria-label="Referencia de mezcla" />
        <button type="button" className="btn" disabled={!!busy || !pro || !s.user || !ref.trim()} onClick={() => run(true)}>{busy === 'ia' ? `Escuchando… ${Math.round(prog * 100)}%` : 'Proponer con IA'}</button>
      </div>
      {err && <p role="alert" style={{ margin: 0, color: '#FF8A4D', fontSize: 12.5 }}>{err}</p>}
      {res && (
        <div className="well" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }} aria-live="polite">
          {lines.length ? lines.map(([n, l]) => <div key={n} style={{ fontSize: 13 }}><strong>{n}</strong>: <span className="muted">{l.join(' · ')}</span></div>) : <span className="muted" style={{ fontSize: 13 }}>La mezcla ya está equilibrada: no hay nada que cambiar.</span>}
          {res.por.map((p) => <span key={p} className="dim" style={{ fontSize: 11.5 }}>{p}</span>)}
          {lines.length > 0 && <div className="row" style={{ gap: 8 }}><button type="button" className="btn acc" onClick={() => { aplicarMezcla(session, res.cambios); setOk(true); }}>{ok ? 'Aplicado ✓' : 'Aplicar'}</button>{ok && <span className="dim" style={{ fontSize: 11 }}>Con ⌘Z lo deshaces.</span>}{res.ia && <span className="chip">IA</span>}</div>}
        </div>
      )}
      <span className="dim" style={{ fontSize: 11 }}>Mide solo lo que suena en la compu (Compu o Ambos). Lo de tus aparatos se mezcla en el sidekick.</span>
    </section>
  );
}
