import { useEffect, useMemo, useState } from 'react';
import { contextoVivo, contextoToma, pedir, cuota, cambios, aplicar, ERRORES } from '../engine/productor.js';
import { session } from '../engine/session.js';
import { keyName, chordName, analyzeTake, harmonyEvents, fixClashes } from '../engine/armonia.js';
import { useS, useTick, Seg, Icon } from './kit.jsx';

// Armonía en vivo: lo que deduce de la mosca (tonalidad y acordes) y el acompañamiento que la sigue
export function ArmoniaPanel() {
  const s = useS(); useTick(4);
  const H = session.live.harm, a = s.armonia || {}, pro = session.can('armonia'), hasMel = s.tracks.some((t) => t.mode === 'melodia' && session.audible(t));
  const set = (patch) => session.set({ armonia: { ...a, ...patch } }, true);
  const aligned = H?.key && s.tracks.filter((t) => t.mode === 'melodia').every((t) => t.root % 12 === H.key.tonic && (H.key.modo === 'mayor' ? /mayor/.test(t.scale) : /menor/.test(t.scale)));
  return (
    <section className="panel" style={{ gap: 12 }} aria-label="Armonía">
      <div className="panel-head"><h2>Armonía</h2><span className="muted" style={{ fontSize: 11 }}>El análisis se calcula aquí, sin internet</span></div>
      {!H?.key ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>{hasMel ? 'Dale a Tocar: en un par de compases aparece la tonalidad y el acorde de lo que toca la mosca.' : <>Pon una pista en <strong>Melodía</strong> (Estudio › Pads) y dale a Tocar: aquí verás la tonalidad y los acordes de la mosca.</>}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 18px', alignItems: 'end' }}>
          <span className="label">Tonalidad</span><span className="label">Acorde ahora</span>
          <span style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-.02em' }}>{keyName(H.key)}</span>
          <span style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-.02em', color: 'var(--acc)' }}>{chordName(H.chord)} <span className="mono muted" style={{ fontSize: 12, fontWeight: 500 }}>{H.chord?.roman || 'prestado'}</span></span>
          <span aria-label={`Seguridad ${Math.round(H.key.conf * 100)}%`} title="Qué tanto le gana a la segunda opción" style={{ height: 4, borderRadius: 2, background: 'var(--line)', width: 120 }}><span style={{ display: 'block', width: `${H.key.conf * 100}%`, height: '100%', borderRadius: 2, background: 'var(--text)' }} /></span>
          <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>{H.hist.map((c, i) => <span key={c.at} className="chip mono" style={{ opacity: 0.4 + 0.6 * (i + 1) / H.hist.length }}>{chordName(c)}</span>)}</span>
        </div>
      )}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <button type="button" className={`btn ${a.on && pro ? 'acc' : ''}`} aria-pressed={!!a.on} onClick={() => (pro ? set({ on: !a.on }) : (location.hash = '#/cuenta?plan'))}>{a.on && pro ? 'Acompañando' : 'Acompañar a la mosca'}{!pro && <span className="badge-pro" style={{ marginLeft: 6 }}>PRO</span>}</button>
        <Seg label="Qué toca la armonía" items={[['acordes', 'Acordes'], ['bajo', 'Bajo'], ['ambos', 'Ambos']]} value={a.modo || 'acordes'} onChange={(v) => set({ modo: v })} />
        <select className="input" aria-label="Por dónde sale la armonía" style={{ height: 34, width: 'auto' }} value={a.salida === 'midi' ? `midi${a.ch || 3}` : 'compu'} onChange={(e) => (e.target.value === 'compu' ? set({ salida: 'compu' }) : set({ salida: 'midi', ch: +e.target.value.slice(4) }))}>
          <option value="compu">Suena en la compu</option>{Array.from({ length: 16 }, (_, i) => <option key={i} value={`midi${i + 1}`}>MIDI canal {i + 1}{session.ko.output ? ` · ${session.ko.output.name}` : ''}</option>)}
        </select>
        <label className="row" style={{ gap: 6, fontSize: 12, flex: '1 1 160px' }}><span className="muted">Nivel</span><input type="range" min={0} max={100} value={Math.round((a.nivel ?? 0.6) * 100)} onChange={(e) => set({ nivel: +e.target.value / 100 })} style={{ flex: 1, accentColor: 'var(--acc)' }} /></label>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn" disabled={!H?.key || aligned} onClick={() => session.alignScales()} title="Pone todas las pistas en Melodía en esta tonalidad: quita los choques entre pistas">{aligned ? 'Pistas en la tonalidad' : `Alinear las pistas a ${keyName(H?.key)}`}</button>
        <span className="dim" style={{ fontSize: 11, flex: '1 1 260px' }}>La armonía va un compás detrás de la mosca: escucha lo que tocó y elige el acorde que mejor lo explica, con voces que se mueven lo menos posible. Las notas de la mosca no se tocan.</span>
      </div>
      <Productor getContexto={() => contextoVivo(session)} ready={!!H?.key} />
    </section>
  );
}

// Análisis de una toma: tonalidad, acorde por compás, choques; y dos versiones nuevas (la original no cambia)
export function ArmoniaTake({ take, onClose, onDone }) {
  const an = useMemo(() => analyzeTake(take), [take]), [modo, setModo] = useState('ambos'), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null);
  const make = async (kind) => {
    setBusy(true);
    let edited, suffix;
    if (kind === 'armonia') { const ev = harmonyEvents(an, { modo, ch: session.s.armonia?.ch || 3 }); edited = { ...take, events: [...take.events.filter((e) => e.track !== 'armonia'), ...ev].sort((a, b) => a.t - b.t), tracks: [...take.tracks.filter((t) => t.id !== 'armonia'), { id: 'armonia', name: 'Armonía', group: '—', ch: session.s.armonia?.ch || 3, sense: 'armonia' }] }; suffix = 'con armonía'; }
    else { const r = fixClashes(take, an); edited = { ...take, events: r.events }; suffix = `ajustada (${r.moved})`; }
    const id = await session.saveEditedTake(take, edited, suffix); setBusy(false);
    if (id) onDone?.(id); else setMsg('No se pudo guardar: llegaste al límite de tomas.');
  };
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ar-t" style={{ maxWidth: 620 }}>
        <div className="between"><h2 id="ar-t" style={{ fontSize: 18, margin: 0 }}>Armonía de «{take.name}»</h2><button type="button" className="iconbtn" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={14} /></button></div>
        {an.empty ? <p className="muted" style={{ margin: 0 }}>Esta toma no tiene notas melódicas (solo golpes de batería). Graba con una pista en Melodía para analizar su armonía.</p> : (<>
          <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
            <div><div className="label">Tonalidad</div><div style={{ fontSize: 22, fontWeight: 650 }}>{keyName(an.key)}</div><div className="dim" style={{ fontSize: 11 }}>o {keyName(an.key.alt)} · seguridad {Math.round(an.key.conf * 100)}%</div></div>
            <div><div className="label">Notas fuera de la tonalidad</div><div style={{ fontSize: 22, fontWeight: 650, color: an.fuera ? '#FF8A4D' : undefined }}>{an.fuera}</div></div>
            <div><div className="label">Roces en tiempo fuerte</div><div style={{ fontSize: 22, fontWeight: 650 }}>{an.roce}</div><div className="dim" style={{ fontSize: 11 }}>de {an.n} notas</div></div>
          </div>
          <div><div className="label" style={{ marginBottom: 6 }}>Acorde de cada compás</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 6, maxHeight: 180, overflow: 'auto' }}>
              {an.bars.map((b) => <div key={b.i} className="well" style={{ padding: '6px 8px', borderColor: b.clashes.length ? 'rgba(255,138,77,.5)' : undefined }} title={b.clashes.length ? `${b.clashes.length} nota(s) que chocan` : ''}>
                <div className="mono dim" style={{ fontSize: 9.5 }}>C{b.i + 1}</div><div style={{ fontWeight: 600 }}>{chordName(b.chord)}</div><div className="mono dim" style={{ fontSize: 9.5 }}>{b.chord?.roman || (b.chord ? 'prest.' : '')}{b.clashes.length ? ` · ${b.clashes.length}!` : ''}</div></div>)}
            </div></div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <Seg label="Qué lleva la armonía" items={[['acordes', 'Acordes'], ['bajo', 'Bajo'], ['ambos', 'Acordes y bajo']]} value={modo} onChange={setModo} />
            <button type="button" className="btn acc" disabled={busy} onClick={() => make('armonia')}>Crear versión con armonía</button>
            <button type="button" className="btn" disabled={busy || !(an.fuera + an.roce)} onClick={() => make('ajuste')} title="Cada nota que choca se mueve a la nota del acorde más cercana; el resto queda igual">Ajustar las {an.fuera + an.roce} que chocan</button>
          </div>
          <p className="dim" style={{ margin: 0, fontSize: 11 }}>Las dos crean una toma nueva; esta queda como está. La armonía se exporta como su propia pista en el MIDI y en las pistas separadas.</p>
          <Productor getContexto={() => contextoToma(session, an, take)} />
          {msg && <p role="alert" style={{ margin: 0, color: '#FF8A4D', fontSize: 12 }}>{msg}</p>}
        </>)}
      </div>
    </div>
  );
}

// Productor IA (beta Pro): Gemini lee el análisis (no tus datos) y propone; tú decides con un clic
export function Productor({ getContexto, ready = true }) {
  const s = useS(), pro = session.can('armonia'), [pedido, setPedido] = useState(''), [busy, setBusy] = useState(false), [res, setRes] = useState(null), [err, setErr] = useState(null), [q, setQ] = useState(null), [hecho, setHecho] = useState(null);
  useEffect(() => { if (s.user && pro) cuota().then(setQ).catch(() => {}); }, [s.user, pro]);
  const go = async () => { setBusy(true); setErr(null); setRes(null); setHecho(null); try { const r = await pedir(getContexto(), pedido.trim()); setRes(r); setQ({ quedan: r.quedan, de: r.de }); } catch (e) { setErr(ERRORES[e.message] || ERRORES.red); } setBusy(false); };
  const lista = res ? cambios(session, res) : [];
  return (
    <div className="well" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="between" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 650 }}>Productor IA <span className="chip" style={{ marginLeft: 6 }}>BETA</span>{!pro && <span className="badge-pro" style={{ marginLeft: 6 }}>PRO</span>}</span>
        {q && <span className="mono muted" style={{ fontSize: 11 }}>TE QUEDAN {q.quedan} DE {q.de} ESTE MES</span>}
      </div>
      <p className="dim" style={{ margin: 0, fontSize: 11.5 }}>Gemini lee el análisis de arriba (tonalidad, acordes, ajustes de tus pistas) y propone una progresión y ajustes. No recibe tu correo ni tus datos; no escribas datos personales en el pedido.</p>
      {!s.user ? <a href="#/bienvenida" className="btn">Inicia sesión para usarlo</a> : !pro ? <a href="#/cuenta?plan" className="btn acc">Disponible en Pro</a> : (<>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ flex: 1, minWidth: 0 }} maxLength={240} placeholder="Opcional: «más oscuro», «que suene a lo-fi», «quiero un drop»…" value={pedido} onChange={(e) => setPedido(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && ready && go()} aria-label="Qué le pides al productor" />
          <button type="button" className="btn acc" disabled={busy || !ready || q?.quedan === 0} onClick={go}>{busy ? 'Pensando…' : 'Pedir propuesta'}</button>
        </div>
        {!ready && <span className="dim" style={{ fontSize: 11 }}>Primero dale a Tocar con una pista en Melodía, para que haya algo que analizar.</span>}
      </>)}
      {err && <p role="alert" style={{ margin: 0, color: '#FF8A4D', fontSize: 12.5 }}>{err}</p>}
      {res && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }} aria-live="polite">
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>{res.explicacion}</p>
          {lista.length > 0 && <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>{lista.map((x) => <li key={x}>{x}</li>)}</ul>}
          {res.por_que && <p className="muted" style={{ margin: 0, fontSize: 12 }}>{res.por_que}</p>}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {lista.length > 0 && <button type="button" className="btn acc" onClick={() => { aplicar(session, res); setHecho('todo'); }}>{hecho === 'todo' ? 'Aplicado ✓' : 'Aplicar todo'}</button>}
            {res.progresion && <button type="button" className="btn" onClick={() => { aplicar(session, res, { solo: 'progresion' }); setHecho('prog'); }}>{hecho === 'prog' ? 'Progresión aplicada ✓' : 'Solo la progresión'}</button>}
            {hecho && <span className="dim" style={{ fontSize: 11 }}>Con ⌘Z lo deshaces.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
