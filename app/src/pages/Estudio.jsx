import { lazy, Suspense, useCallback, useState } from 'react';
import { session, SENSES, SENSE_LABEL, HIST, CIRCUITS } from '../engine/session.js';
import { PAD_KEYS } from '../engine/midi.js';
import { SCALES, NOTE_NAMES, CHORDS, PROGS } from '../engine/devices.js';
import { SoundRoute } from '../ui/SoundRoute.jsx';
import { useS, useTick, Icon, Knob, Seg, roleColor, ROLE_DESC } from '../ui/kit.jsx';
// el 3D (three.js) solo se descarga si abres una vista 3D: el arranque es más rápido
const Brain = lazy(() => import('../ui/Brain.jsx'));
const Automation = lazy(() => import('../ui/Automation.jsx'));
const Opto = lazy(() => import('../ui/Opto.jsx'));
import CircuitMap from '../ui/CircuitMap.jsx';
import { Pads, Lanes } from '../ui/PadsLanes.jsx';
import ScenesStrip from '../ui/Scenes.jsx';

const PRESETS = { gusto: { dulce: ['Solo dulce', { dulce: 180, amargo: 0 }], veto: ['Veto amargo', { dulce: 150, amargo: 40 }], rampa: ['Mitad y mitad', { dulce: 90, amargo: 90 }] },
  oido: { voz: ['Voz', { jon_ce: 40, jon_f: 150, jon_dm: 40 }], bajo: ['Bajo', { jon_ce: 180, jon_f: 30, jon_dm: 0 }], brillo: ['Brillos', { jon_ce: 0, jon_f: 40, jon_dm: 170 }] },
  olfato: { fruta: ['Fruta', { vinagre: 170, co2: 0, geosmina: 0 }], alerta: ['Alerta', { vinagre: 0, co2: 150, geosmina: 120 }], conflicto: ['Fruta podrida', { vinagre: 140, co2: 0, geosmina: 140 }] },
  cortejo: { canto: ['Solo canto', { canto: 160, cva: 0, deseo: 0 }], cortejo: ['Canto + cVA', { canto: 150, cva: 120, deseo: 0 }], deseo: ['pC1 directo', { canto: 0, cva: 0, deseo: 150 }] } };
// salida de cada circuito: etiqueta de la neurona y estado cuando dispara
const OUT = { gusto: ['MN9 · comer', 'Comiendo'], oido: ['DNg35 · acicalar', 'Se acicala'], olfato: [null, 'Responde al olor'], cortejo: [null, 'Receptiva'] };
const NT = { acetylcholine: 'ACh', gaba: 'GABA', glutamate: 'Glu', serotonin: '5-HT', dopamine: 'DA', octopamine: 'OA' };
const SENSE_COLOR = { dulce: 'var(--acc)', amargo: 'var(--steel)', jon_ce: 'var(--steel)', jon_f: 'var(--white)', jon_dm: 'var(--acc)', vinagre: 'var(--acc)', co2: 'var(--steel)', geosmina: 'var(--white)', canto: 'var(--acc)', cva: 'var(--white)', deseo: 'var(--steel)' };

function Hud() {
  useTick(8);
  const L = session.live, on = session.s.playing, sense = session.track().sense, D = session.D;
  const [lab, st] = OUT[sense] || OUT.gusto, outIdx = D.salidas?.[sense] ?? D.mn9, hz = sense === 'gusto' ? L.mn9 : L.out[sense] || 0;
  const label = lab || `${session.pads(session.track())[11].tipo} · salida`;
  const veto = sense === 'gusto' && on && session.s.inputs.amargo > session.s.inputs.dulce * 0.25 && L.mn9 < 15;
  return (
    <div className="hud">
      <div><div className="label">Neuronas activas</div><div className="v">{on ? L.active : 0}<small> / {D.n}</small></div></div>
      <div><div className="label">{label}</div><div className="v" style={{ color: 'var(--acc)' }} data-out={outIdx}>{on ? Math.round(hz) : 0}<small> Hz</small></div></div>
      <div><div className="label">Estado</div><div style={{ fontSize: 14, fontWeight: 500, marginTop: 5 }}>{!on ? 'En pausa' : hz > 15 ? st : veto ? 'Rechaza · amargo' : sense === 'gusto' ? 'Probando' : 'Escuchando'}</div></div>
    </div>
  );
}
// La mosca aprende tu gusto: Me gusta / No me gusta refuerza o debilita las sinapsis que acaban de disparar juntas
function Taste() {
  const s = useS(); useTick(4);
  const [open, setOpen] = useState(false), pro = session.can('aprende'), ta = s.taste || {}, n = session.learnedCount;
  const Lr = session.live.learn, fresh = Lr && performance.now() - Lr.at < 1600;
  const msg = fresh ? (Lr.syn.length ? `${Lr.sign > 0 ? 'Reforzó' : 'Debilitó'} ${Lr.syn.length} sinapsis` : 'Dale play: aprende de lo que está sonando') : `${n} sinapsis aprendidas`;
  const scr = { background: 'rgba(20,20,22,.85)', borderColor: 'rgba(255,255,255,.1)', color: '#ECECEE', backdropFilter: 'blur(6px)' };
  return (
    <div className="br" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      {open && (
        <div role="dialog" aria-label="Aprendizaje" style={{ ...scr, border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: 12, width: 250, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
          <strong style={{ fontSize: 13 }}>La mosca aprende tu gusto</strong>
          <span style={{ color: '#9A9AA2', lineHeight: 1.45 }}>Mientras suena, pulsa <b>Me gusta</b> (G) o <b>No me gusta</b> (N). Las sinapsis entre neuronas que acaban de disparar juntas se refuerzan o debilitan (de ×0,25 a ×3 su peso real), y «Mutar» tiende hacia los repartos que te gustaron.</span>
          <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={ta.on !== false} onChange={(e) => session.set({ taste: { ...ta, on: e.target.checked } }, true)} style={{ accentColor: 'var(--acc)' }} />Mutar según mi gusto</label>
          <div className="between mono" style={{ fontSize: 10, color: '#77777F' }}><span>{n} SINAPSIS · {ta.n || 0} VOTOS</span>
            <button type="button" className="btn" style={{ height: 26, fontSize: 11 }} disabled={!n && !ta.n} onClick={() => session.forget()}>Olvidar</button></div>
        </div>
      )}
      <div className="row" style={{ gap: 6 }}>
        <span className="mono" aria-live="polite" style={{ fontSize: 10, color: fresh && Lr.syn.length ? (Lr.sign > 0 ? '#FF6A1A' : '#7D93B2') : '#77777F', alignSelf: 'center' }}>{pro ? msg.toUpperCase() : ''}</span>
        <button type="button" className="btn" style={scr} title="Me gusta (G): refuerza lo que está sonando" onClick={() => session.feedback(1)}><Icon name="gusta" size={14} />Me gusta{!pro && <span className="badge-pro">PRO</span>}</button>
        <button type="button" className="iconbtn" style={{ ...scr, border: '1px solid rgba(255,255,255,.1)' }} aria-label="No me gusta" title="No me gusta (N): debilita lo que está sonando" onClick={() => session.feedback(-1)}><Icon name="nogusta" size={14} /></button>
        {pro && <button type="button" className="iconbtn" style={{ ...scr, border: '1px solid rgba(255,255,255,.1)' }} aria-label="Ajustes de aprendizaje" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="chevron" size={12} /></button>}
      </div>
    </div>
  );
}
// Gráfica de la neurona: frecuencia de disparo (área) y cada disparo real (marcas abajo), últimos HIST pasos.
function RateChart({ track, k, color }) {
  useTick(15);
  const L = session.live, rh = L.rateHist[track.id]?.[k], sp = L.spikes[track.id]?.[k];
  if (!rh) return null;
  const W = 270, H = 58, n = session.s.playing ? L.step : 0, vals = [], spk = [];
  for (let i = 0; i < HIST; i++) { const j = (n + 1 + i) % HIST; vals.push(rh[j]); spk.push(sp[j]); }
  const max = Math.max(20, ...vals) * 1.15, x = (i) => (i / (HIST - 1)) * W, y = (v) => H - 2 - (v / max) * (H - 8);
  const line = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const secs = Math.round((HIST * session.ko.stepMs) / 1000), last = vals[HIST - 1], gid = `rg-${track.id}-${k}`;
  return (
    <div className="well" style={{ padding: '8px 10px 6px' }}>
      <svg viewBox={`0 0 ${W} ${H + 14}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`Frecuencia de disparo de los últimos ${secs} segundos, máximo ${Math.round(max / 1.15)} hercios`}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--line)" />)}
        <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${gid})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
        {session.s.playing && <circle cx={W} cy={y(last)} r="3" fill={color}><animate attributeName="r" values="3;5;3" dur="1s" repeatCount="indefinite" /></circle>}
        {spk.map((c, i) => c ? <rect key={i} x={x(i) - 0.75} y={H + 5} width="1.5" height={Math.min(8, 3 + c * 2)} fill={color} opacity={0.85} /> : null)}
      </svg>
      <div className="between mono" style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '.06em' }}><span>−{secs} s</span><span>MÁX {Math.round(Math.max(...vals))} HZ</span><span>AHORA</span></div>
    </div>
  );
}
function NeuronCard({ track, k }) {
  useTick(6);
  const p = session.pads(track)[k], off = track.map[k], rate = session.s.playing ? Math.round(session.live.rate[track.id][k]) : 0;
  const D = session.D, ins = D.syn.post.reduce((a, x) => a + (x === p.idx), 0), outs = D.syn.pre.reduce((a, x) => a + (x === p.idx), 0);
  const silenced = session.sim.silenced.has(p.idx);
  const toggleMute = () => { silenced ? session.sim.silenced.delete(p.idx) : session.sim.silenced.add(p.idx); session.emit(); };
  return (
    <section className="panel" style={{ flex: 1 }}>
      <div className="panel-head"><h2>Neurona</h2><span className="mono muted" style={{ fontSize: 10 }}>PAD {PAD_KEYS[off]} · NOTA {session.route(track, k).note ?? '—'}</span></div>
      <div className="between"><span className="mono" style={{ fontSize: 20, fontWeight: 600, color: p.clase === 'sensor' ? 'var(--text)' : roleColor(p) }}>{p.tipo}</span><span className="mono" style={{ fontSize: 20 }}>{rate}<small className="muted" style={{ fontSize: 11 }}> Hz</small></span></div>
      <RateChart track={track} k={k} color={p.clase === 'sensor' ? 'var(--acc)' : roleColor(p)} />
      <span className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>{ROLE_DESC[p.clase]}{p.inhibidora ? ' Es inhibidora: frena a las que conecta.' : ''}{p.idx === D.mn9 ? ' MN9 es la que hace comer a la mosca: la salida del circuito.' : ''}</span>
      <div className="row"><div className="stat"><div className="label">Entradas</div><div className="v">{ins}</div></div><div className="stat"><div className="label">Salidas</div><div className="v">{outs}</div></div><div className="stat"><div className="label">Transmisor</div><div className="v">{NT[p.nt] || p.nt}</div></div></div>
      <div className="row">
        <button type="button" className="btn" style={{ flex: 1 }} aria-pressed={silenced} onClick={toggleMute}>{silenced ? 'Reactivar' : 'Silenciar'}</button>
        <button type="button" className="btn" style={{ flex: 1 }} onClick={() => session.tapPad(k, track)} title={`FlyWire ID ${p.flywire_id}`}>Estimular</button>
      </div>
    </section>
  );
}
function Inputs({ track }) {
  const s = useS(), senses = SENSES[track.sense] || [], pre = PRESETS[track.sense] || {};
  const cur = Object.entries(pre).find(([, [, v]]) => Object.entries(v).every(([k, x]) => s.inputs[k] === x))?.[0];
  const live = track.sense === 'oido' && s.oidoSource !== 'manual';
  return (
    <section className="panel">
      <div className="panel-head"><h2>Entrada · {track.name}</h2><a href={track.sense === 'oido' ? '#/oido' : '#/datos'} className="muted" style={{ fontSize: 11 }}>{track.sense === 'oido' ? 'Micrófono o archivo' : 'Usar datos'}</a></div>
      <div className="field"><label htmlFor="circ">Circuito de la pista</label>
        <select id="circ" className="input" style={{ height: 32 }} value={track.sense} onChange={(e) => session.setSense(track.id, e.target.value)} title={CIRCUITS[track.sense]?.desc}>
          {Object.entries(CIRCUITS).filter(([id]) => session.D.modos[id]).map(([id, c]) => <option key={id} value={id}>{c.name}{id === 'olfato' || id === 'cortejo' ? ' · nuevo' : ''}</option>)}
        </select></div>
      {live ? <p className="muted" style={{ margin: 0 }}>Escuchando {s.oidoSource === 'mic' ? 'el micrófono' : 'un archivo'}. <a href="#/oido" style={{ textDecoration: 'underline' }}>Abrir Oído</a></p> : (
        <div className="knobs">{senses.map((k) => <Knob key={k} id={`in-${k}`} label={SENSE_LABEL[k]} value={s.inputs[k]} color={SENSE_COLOR[k]} onChange={(v) => session.setInput(k, v)} />)}</div>
      )}
      {!live && <Seg label="Presets" items={Object.entries(pre).map(([id, [t]]) => [id, t])} value={cur} onChange={(id) => session.set({ inputs: { ...s.inputs, ...pre[id][1] } }, true)} />}
    </section>
  );
}

export default function Estudio() {
  const [view2, setView2] = useState('disparos');
  const s = useS(), [view, setView] = useState('Mapa');
  const track = session.track(), selPad = s.selPad;
  const onPick = useCallback((k) => session.set({ selPad: k }, true), []);
  const canUndo = (s.mutHistory[track.id] || []).length > 0;
  return (
    <div className="page" style={{ gap: 10 }}>
      <div className="studio-top">
        <section className="screen" aria-label="Cerebro de la mosca">
          <div className="grid" />{view === 'Mapa' ? <CircuitMap selTrack={track.id} selPad={selPad} onPick={onPick} sense={track.sense} /> : <Suspense fallback={<div className="mono" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#77777F', fontSize: 11 }}>CARGANDO 3D…</div>}><Brain view={view} selTrack={track.id} selPad={selPad} onPick={onPick} sense={track.sense} /></Suspense>}<div className="vignette" />
          <Hud /><Taste />
          <div className="tr"><Seg onScreen label="Vista" items={[['Mapa', 'Mapa'], ['Frontal', '3D'], ['Dorsal', 'Dorsal'], ['Lateral', 'Lateral']]} value={view} onChange={setView} /></div>
          <div className="bl">
            <span className="legend"><i style={{ borderColor: '#ECECEE' }} />SENSOR</span><span className="legend"><i style={{ borderColor: '#FF6A1A' }} />EXCITA</span><span className="legend"><i style={{ borderColor: '#7D93B2' }} />INHIBE</span>
            <a href="#/cuenta?ayuda" style={{ fontSize: 11, textDecoration: 'underline', textUnderlineOffset: 3 }}>¿Qué estoy viendo?</a>
          </div>
        </section>
        <aside className="inspector" aria-label="Inspector">
          <Inputs track={track} />
          <NeuronCard track={track} k={selPad} />
        </aside>
      </div>
      <ScenesStrip />
      <div className="studio-bottom">
        <section className="panel pads-panel" style={{ gap: 8 }}>
          <div className="panel-head"><h2>Pads · {track.name}</h2>
            <Seg label="Modo de la pista" items={[['ritmo', 'Ritmo'], ['melodia', session.can('melodia') ? 'Melodía' : 'Melodía · PRO']]} value={track.mode || 'ritmo'} onChange={(m) => (m === 'melodia' && !session.can('melodia') ? (location.hash = '#/cuenta?plan') : session.setTrack(track.id, { mode: m }))} />
          </div>
          {track.mode === 'melodia' && session.can('melodia') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 84px', gap: 6 }}>
              <select className="input" aria-label="Escala" style={{ height: 30 }} value={track.scale} onChange={(ev) => session.setTrack(track.id, { scale: ev.target.value })}>{Object.entries(SCALES).map(([id, [n]]) => <option key={id} value={id}>{n}</option>)}</select>
              <select className="input" aria-label="Tónica" style={{ height: 30 }} value={track.root} onChange={(ev) => session.setTrack(track.id, { root: +ev.target.value })}>{[36, 48, 60].flatMap((o) => NOTE_NAMES.map((n, i) => <option key={o + i} value={o + i}>{n}{o / 12 - 1}</option>))}</select>
              <select className="input" aria-label="Acorde" title="Cada neurona toca un acorde dentro de la escala; el bajo sigue con nota sola" style={{ height: 30 }} value={track.chord || 'nota'} onChange={(ev) => session.setTrack(track.id, { chord: ev.target.value })}>{Object.entries(CHORDS).map(([id, [n]]) => <option key={id} value={id}>{n}</option>)}</select>
              <span />
              <select className="input" aria-label="Progresión" title="La armonía avanza un acorde por compás" style={{ height: 30, gridColumn: '1 / -1' }} value={track.prog || 'ninguna'} onChange={(ev) => session.setTrack(track.id, { prog: ev.target.value })}>{Object.entries(PROGS).map(([id, [n]]) => <option key={id} value={id}>{n}</option>)}</select>
            </div>
          )}
          <Pads track={track} selPad={selPad} onSelect={onPick} />
        </section>
        <section className="panel lanes-panel" style={{ gap: 8 }}>
          <div className="between" style={{ flexWrap: 'wrap' }}>
            <Seg label="Vista" items={[['disparos', 'Disparos'], ['mov', 'Movimientos'], ['luz', 'Luz']]} value={view2} onChange={setView2} />
            <div className="tracks" role="list" aria-label="Pistas">
              {s.tracks.map((t) => (
                <div key={t.id} className="trk" role="listitem" aria-current={t.id === track.id}>
                  <button type="button" className="nm" onClick={() => session.set({ selTrack: t.id }, true)}><Icon name={t.sense} size={14} />{t.name}<span className="mono muted" style={{ fontSize: 10, fontWeight: 500 }}>{t.group}</span></button>
                  <button type="button" className="ms m" aria-pressed={t.mute} aria-label={`Silenciar ${t.name}`} onClick={() => session.setTrack(t.id, { mute: !t.mute })}>M</button>
                  <button type="button" className="ms s" aria-pressed={t.solo} aria-label={`Solo ${t.name}`} onClick={() => session.setTrack(t.id, { solo: !t.solo })}>S</button>
                </div>
              ))}
              <a className="trk" href="#/datos" style={{ color: 'var(--sub)', paddingRight: 10 }}><Icon name="mas" size={14} />Datos<span className="badge-pro">PRO</span></a>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <Seg label="Quién toca la pista" items={[['vivo', 'Mosca'], ['congelado', 'Patrón'], ['ambos', 'Ambos']]} value={track.play || 'vivo'} onChange={(v) => { if (v !== 'vivo' && !track.frozen && !session.freeze(track.id)) session.setTrack(track.id, { play: v, frozen: Array.from({ length: 12 }, () => new Array(16).fill(0)) }); else session.setTrack(track.id, { play: v }); }} />
              {track.play && track.play !== 'vivo' && (
                <select className="input" aria-label="Largo del patrón" title="Largo del patrón: menos de 16 pasos crea polirritmos contra el compás" style={{ height: 34, width: 'auto' }} value={track.len || session.C.len} onChange={(e) => session.setTrack(track.id, { len: +e.target.value })}>
                  {[16, 15, 14, 12, 10, 9, 8, 7, 6, 5, 3].map((n) => <option key={n} value={n}>{n} pasos</option>)}
                </select>
              )}
              {track.frozen && track.play !== 'vivo' && s.tracks.filter((x) => x.id !== track.id).map((x) => <button key={x.id} type="button" className="btn" title={`Copiar este patrón a la pista ${x.name}`} onClick={() => session.copyPattern(track.id, x.id)}>Copiar → {x.name}</button>)}
              <button type="button" className="btn" onClick={() => { if (!session.freeze(track.id)) session.set({ notice: 'congelar' }); }} title="Guarda el último compás de la mosca como patrón editable"><Icon name="nieve" size={14} />Congelar</button>
              <button type="button" className="btn" onClick={() => session.mutateTrack()} title="Reparte las neuronas entre los pads respetando graves, medios y agudos"><Icon name="dado" size={14} />Mutar</button>
              <button type="button" className="iconbtn" disabled={!canUndo} aria-label="Deshacer mutación" onClick={() => session.undoMutate()}><Icon name="deshacer" size={14} /></button>
            </div>
          </div>
          {view2 === 'mov' ? <Suspense fallback={null}><Automation /></Suspense> : view2 === 'luz' ? <Suspense fallback={null}><Opto /></Suspense> : <Lanes track={track} selPad={selPad} />}
          <SoundRoute tracks={[track]} compact />
        </section>
      </div>
    </div>
  );
}
