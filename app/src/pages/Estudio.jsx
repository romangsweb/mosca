import { useCallback, useState } from 'react';
import { session, SENSES, SENSE_LABEL, HIST } from '../engine/session.js';
import { PAD_KEYS } from '../engine/midi.js';
import { SCALES, NOTE_NAMES } from '../engine/devices.js';
import { useS, useTick, Icon, Knob, Seg, roleColor, ROLE_DESC } from '../ui/kit.jsx';
import Brain from '../ui/Brain.jsx';
import CircuitMap from '../ui/CircuitMap.jsx';
import { Pads, Lanes } from '../ui/PadsLanes.jsx';

const PRESETS = { gusto: { dulce: ['Solo dulce', { dulce: 180, amargo: 0 }], veto: ['Veto amargo', { dulce: 150, amargo: 40 }], rampa: ['Mitad y mitad', { dulce: 90, amargo: 90 }] },
  oido: { voz: ['Voz', { jon_ce: 40, jon_f: 150, jon_dm: 40 }], bajo: ['Bajo', { jon_ce: 180, jon_f: 30, jon_dm: 0 }], brillo: ['Brillos', { jon_ce: 0, jon_f: 40, jon_dm: 170 }] } };
const NT = { acetylcholine: 'ACh', gaba: 'GABA', glutamate: 'Glu', serotonin: '5-HT', dopamine: 'DA', octopamine: 'OA' };
const SENSE_COLOR = { dulce: 'var(--acc)', amargo: 'var(--steel)', jon_ce: 'var(--steel)', jon_f: 'var(--white)', jon_dm: 'var(--acc)' };

function Hud() {
  useTick(8);
  const L = session.live, on = session.s.playing, veto = on && session.s.inputs.amargo > session.s.inputs.dulce * 0.25 && L.mn9 < 15;
  return (
    <div className="hud">
      <div><div className="label">Neuronas activas</div><div className="v">{on ? L.active : 0}<small> / 818</small></div></div>
      <div><div className="label">MN9 · comer</div><div className="v" style={{ color: 'var(--acc)' }}>{on ? Math.round(L.mn9) : 0}<small> Hz</small></div></div>
      <div><div className="label">Estado</div><div style={{ fontSize: 14, fontWeight: 500, marginTop: 5 }}>{!on ? 'En pausa' : L.mn9 > 15 ? 'Comiendo' : veto ? 'Rechaza · amargo' : 'Probando'}</div></div>
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
      <div className="between"><span className="mono" style={{ fontSize: 20, fontWeight: 600, color: roleColor(p) }}>{p.tipo}</span><span className="mono" style={{ fontSize: 20 }}>{rate}<small className="muted" style={{ fontSize: 11 }}> Hz</small></span></div>
      <RateChart track={track} k={k} color={roleColor(p)} />
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
  const s = useS(), senses = SENSES[track.sense], pre = PRESETS[track.sense];
  const cur = Object.entries(pre).find(([, [, v]]) => Object.entries(v).every(([k, x]) => s.inputs[k] === x))?.[0];
  const live = track.sense === 'oido' && s.oidoSource !== 'manual';
  return (
    <section className="panel">
      <div className="panel-head"><h2>Entrada · {track.name}</h2><a href={track.sense === 'oido' ? '#/oido' : '#/datos'} className="muted" style={{ fontSize: 11 }}>{track.sense === 'oido' ? 'Micrófono o archivo' : 'Usar datos'}</a></div>
      {live ? <p className="muted" style={{ margin: 0 }}>Escuchando {s.oidoSource === 'mic' ? 'el micrófono' : 'un archivo'}. <a href="#/oido" style={{ textDecoration: 'underline' }}>Abrir Oído</a></p> : (
        <div className="knobs">{senses.map((k) => <Knob key={k} id={`in-${k}`} label={SENSE_LABEL[k]} value={s.inputs[k]} color={SENSE_COLOR[k]} onChange={(v) => session.setInput(k, v)} />)}</div>
      )}
      {!live && <Seg label="Presets" items={Object.entries(pre).map(([id, [t]]) => [id, t])} value={cur} onChange={(id) => session.set({ inputs: { ...s.inputs, ...pre[id][1] } }, true)} />}
    </section>
  );
}

export default function Estudio() {
  const s = useS(), [view, setView] = useState('Mapa');
  const track = session.track(), selPad = s.selPad;
  const onPick = useCallback((k) => session.set({ selPad: k }, true), []);
  const canUndo = (s.mutHistory[track.id] || []).length > 0;
  return (
    <div className="page" style={{ gap: 10 }}>
      <div className="studio-top">
        <section className="screen" aria-label="Cerebro de la mosca">
          <div className="grid" />{view === 'Mapa' ? <CircuitMap selTrack={track.id} selPad={selPad} onPick={onPick} /> : <Brain view={view} selTrack={track.id} selPad={selPad} onPick={onPick} />}<div className="vignette" />
          <Hud />
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
      <div className="studio-bottom">
        <section className="panel pads-panel" style={{ gap: 8 }}>
          <div className="panel-head"><h2>Pads · {track.name}</h2>
            <Seg label="Modo de la pista" items={[['ritmo', 'Ritmo'], ['melodia', session.can('melodia') ? 'Melodía' : 'Melodía · PRO']]} value={track.mode || 'ritmo'} onChange={(m) => (m === 'melodia' && !session.can('melodia') ? (location.hash = '#/cuenta?plan') : session.setTrack(track.id, { mode: m }))} />
          </div>
          {track.mode === 'melodia' && session.can('melodia') && (
            <div className="row" style={{ gap: 6 }}>
              <select className="input" aria-label="Escala" style={{ flex: 1, height: 30 }} value={track.scale} onChange={(ev) => session.setTrack(track.id, { scale: ev.target.value })}>{Object.entries(SCALES).map(([id, [n]]) => <option key={id} value={id}>{n}</option>)}</select>
              <select className="input" aria-label="Tónica" style={{ width: 84, height: 30 }} value={track.root} onChange={(ev) => session.setTrack(track.id, { root: +ev.target.value })}>{[36, 48, 60].flatMap((o) => NOTE_NAMES.map((n, i) => <option key={o + i} value={o + i}>{n}{o / 12 - 1}</option>))}</select>
            </div>
          )}
          <Pads track={track} selPad={selPad} onSelect={onPick} />
        </section>
        <section className="panel lanes-panel" style={{ gap: 8 }}>
          <div className="between" style={{ flexWrap: 'wrap' }}>
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
              <button type="button" className="btn" onClick={() => session.mutateTrack()} title="Reparte las neuronas entre los pads respetando graves, medios y agudos"><Icon name="dado" size={14} />Mutar</button>
              <button type="button" className="iconbtn" disabled={!canUndo} aria-label="Deshacer mutación" onClick={() => session.undoMutate()}><Icon name="deshacer" size={14} /></button>
              <a href="#/sonido" className="btn ghost">Sonido</a>
            </div>
          </div>
          <Lanes track={track} selPad={selPad} />
        </section>
      </div>
    </div>
  );
}
