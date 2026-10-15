import { useEffect } from 'react';
import { session, CIRCUITS } from '../engine/session.js';
import { SLOTS, SCENE_COLORS } from '../engine/song.js';
import { srcLabel } from '../engine/controls.js';
import { useS, useTick, Icon, Seg } from '../ui/kit.jsx';

// Directo: tocar el set en vivo. Escenas grandes que se lanzan a tiempo de compás, cada pista con su lado del crossfader,
// y cuatro macros que se asignan al sidekick (o a cualquier perilla) con un clic.

function Learn({ target }) {
  const s = useS(), m = s.mappings.find((x) => x.target === target), on = s.learn === target;
  return (
    <button type="button" className={`btn ${on ? 'acc' : ''}`} style={{ height: 26, fontSize: 10.5, padding: '0 8px' }} onClick={() => session.learn(target)}
      title={m ? `Asignado a ${srcLabel(m.src)} · clic para cambiar` : 'Mueve una perilla o fader de tu controlador para asignarlo'}>
      {on ? 'Mueve un control…' : m ? <span className="mono">{srcLabel(m.src).split(' · ')[0]}</span> : 'MIDI'}
    </button>
  );
}

function Macro({ id, label, value, min = 0, max = 100, fmt, onChange, pro, wide }) {
  const locked = pro && !session.can('directo');
  return (
    <div className="well" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, gridColumn: wide ? '1 / -1' : undefined, opacity: locked ? 0.6 : 1 }}>
      <div className="between"><label htmlFor={`m-${id}`} style={{ fontSize: 12, fontWeight: 600 }}>{label}{locked && <span className="badge-pro" style={{ marginLeft: 6 }}>PRO</span>}</label>
        <span className="row" style={{ gap: 6 }}><span className="mono" style={{ fontSize: 12 }}>{fmt(value)}</span><Learn target={id} /></span></div>
      <input id={`m-${id}`} type="range" min={min} max={max} value={value} disabled={locked} onChange={(e) => onChange(+e.target.value)} style={{ width: '100%', accentColor: 'var(--acc)', height: wide ? 28 : undefined }} />
      {wide && <div className="between mono" style={{ fontSize: 10, color: 'var(--dim)' }}><span>◀ LADO A</span><span>AMBOS</span><span>LADO B ▶</span></div>}
    </div>
  );
}

function TrackPad({ t }) {
  const s = useS(), on = session.audible(t), locked = s.tracks.indexOf(t) >= session.trackLimit, g = session.xfGain(t);
  const prof = session.profileFor(t), port = session.portFor(t), dest = [session.toDevice(t, port) && `${port?.name || prof.name} · ${t.group}`, session.toKit(t, port) && 'compu'].filter(Boolean).join(' + ');
  return (
    <section className="panel" style={{ gap: 10, opacity: locked ? 0.55 : 1, borderColor: t.id === s.selTrack ? 'var(--acc)' : undefined }}>
      <div className="between"><h2 className="row" style={{ gap: 8, fontSize: 15 }}><Icon name={t.sense} size={16} />{t.name}</h2><span className="mono muted" style={{ fontSize: 10 }}>{CIRCUITS[t.sense]?.name?.toUpperCase()}</span></div>
      <span className="muted" style={{ fontSize: 11.5, minHeight: 16 }}>{locked ? <a href="#/cuenta?plan">Pista Pro: no suena</a> : dest ? `→ ${dest}` : 'sin destino'}</span>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className={`btn lg ${t.mute ? 'primary' : ''}`} style={{ flex: 1 }} aria-pressed={t.mute} onClick={() => session.setTrack(t.id, { mute: !t.mute })}>{t.mute ? 'Silenciada' : 'Mute'}</button>
        <button type="button" className={`btn lg ${t.solo ? 'acc' : ''}`} style={{ width: 64 }} aria-pressed={t.solo} onClick={() => session.setTrack(t.id, { solo: !t.solo })}>Solo</button>
      </div>
      <div className="row" style={{ gap: 8, fontSize: 12 }}><span className="muted" style={{ width: 44 }}>Nivel</span>
        <input type="range" min={5} max={100} value={Math.round(t.level * 100)} aria-label={`Nivel de ${t.name}`} onChange={(e) => session.setTrack(t.id, { level: +e.target.value / 100 })} style={{ flex: 1, accentColor: 'var(--acc)' }} />
        <span className="mono" style={{ width: 34, textAlign: 'right' }}>{Math.round(t.level * 100)}</span></div>
      <div className="between" style={{ gap: 8 }}>
        <Seg label={`Lado del crossfader de ${t.name}`} items={[['A', 'A'], ['-', 'Centro'], ['B', 'B']]} value={t.xf || '-'} onChange={(v) => (session.can('directo') ? session.setTrack(t.id, { xf: v === '-' ? null : v }) : (location.hash = '#/cuenta?plan'))} />
        <div aria-hidden="true" style={{ width: 54, height: 6, borderRadius: 3, background: 'var(--line)' }}><div style={{ width: `${(on ? g : 0) * 100}%`, height: '100%', borderRadius: 3, background: 'var(--acc)', transition: 'width .1s' }} /></div>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="btn" style={{ flex: 1 }} onClick={() => session.mutateTrack(t.id)}><Icon name="dado" size={13} />Mutar</button>
        <button type="button" className="btn" style={{ flex: 1 }} onClick={() => { if (!session.freeze(t.id)) session.set({ notice: 'congelar' }); }}><Icon name="nieve" size={13} />Congelar</button>
        <button type="button" className="btn" style={{ flex: 1 }} disabled={(t.play || 'vivo') === 'vivo'} onClick={() => session.setTrack(t.id, { play: 'vivo' })} title="Vuelve a que toque la mosca">Soltar</button>
      </div>
    </section>
  );
}

export default function Directo() {
  const s = useS(); useTick(10);
  const L = session.live, barFrac = s.playing ? (L.step % session.C.len) / session.C.len : 0;
  // teclas 1–8 lanzan escenas (solo en esta página)
  useEffect(() => {
    const k = (e) => { if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return; const i = '12345678'.indexOf(e.key); if (i >= 0) session.launchScene(SLOTS[i]); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  const anyScene = SLOTS.some((x) => s.scenes[x]);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Directo</h1><p>Toca el set en vivo: lanza escenas a tiempo, cruza entre tus aparatos y mueve la mosca con cuatro macros. Todo se puede asignar al sidekick con el botón MIDI.</p></div>
        <div className="row">
          <button type="button" className={`btn lg ${s.rec ? 'primary' : ''}`} onClick={() => session.toggleRec()}><span className="status-dot" style={{ background: '#E5484D' }} />{s.rec ? 'Detener grabación' : 'Grabar el set'}</button>
          <button type="button" className="btn lg acc" onClick={() => session.toggle()}><Icon name={s.playing ? 'stop' : 'play'} size={13} fill="currentColor" />{s.playing ? 'Detener' : 'Tocar'}</button>
        </div>
      </div>

      <section className="panel" style={{ gap: 10 }} aria-label="Escenas">
        <div className="between"><h2>Escenas <span className="mono muted" style={{ fontSize: 10, fontWeight: 400 }}>· TECLAS 1–8 · ENTRAN AL SIGUIENTE COMPÁS</span></h2>
          <div style={{ width: 160, height: 4, borderRadius: 2, background: 'var(--line)' }} aria-hidden="true"><div style={{ width: `${barFrac * 100}%`, height: '100%', borderRadius: 2, background: 'var(--text)' }} /></div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {SLOTS.map((slot, i) => {
            const sc = s.scenes[slot], now = s.sceneNow === slot, pend = s.pendingScene === slot, col = SCENE_COLORS[slot];
            return (
              <button key={slot} type="button" disabled={!sc} onClick={() => session.launchScene(slot)}
                style={{ position: 'relative', overflow: 'hidden', height: 74, borderRadius: 12, textAlign: 'left', padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  border: `${now ? 2 : 1}px ${sc ? 'solid' : 'dashed'} ${now || pend ? col : 'var(--line2)'}`, background: now ? `color-mix(in srgb, ${col} 22%, var(--panel))` : 'var(--well)', color: sc ? 'var(--text)' : 'var(--dim)', opacity: sc ? 1 : 0.6 }}>
                {pend && <span aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: 0, height: 4, width: `${barFrac * 100}%`, background: col }} />}
                <span className="between" style={{ width: '100%' }}><span className="mono" style={{ fontSize: 11, fontWeight: 700, color: col }}>{slot}</span><span className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>{i + 1}</span></span>
                <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sc ? sc.name : 'Vacía'}</span>
                <span className="mono" style={{ fontSize: 9.5, color: now ? col : 'var(--dim)' }}>{now ? 'SONANDO' : pend ? 'ENTRA EN EL COMPÁS' : sc ? '' : ' '}</span>
              </button>
            );
          })}
        </div>
        {!anyScene && <p className="muted" style={{ margin: 0, fontSize: 12 }}>Aún no tienes escenas. Guárdalas en el Estudio (tira de Escenas) o crea la canción de ejemplo en <a href="#/cancion">Canción</a>.</p>}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {s.tracks.map((t) => <TrackPad key={t.id} t={t} />)}
        {s.tracks.length < 4 && (
          <button type="button" className="panel" style={{ alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', color: 'var(--sub)', minHeight: 200, cursor: 'pointer' }} onClick={() => session.addTrack()}>
            <Icon name="mas" size={20} />Agregar pista{s.tracks.length >= session.trackLimit && <span className="badge-pro">PRO</span>}
          </button>
        )}
      </div>

      <section className="panel" style={{ gap: 10 }} aria-label="Macros">
        <div className="between"><h2>Macros</h2><span className="muted" style={{ fontSize: 11.5 }}>Pulsa MIDI y mueve un fader o perilla del sidekick para asignarlo.</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          <Macro wide pro id="xfade" label="Crossfader A ↔ B" value={Math.round((s.xfade ?? 0.5) * 100)} fmt={(v) => (v < 45 ? `A ${100 - v}` : v > 55 ? `B ${v}` : 'centro')} onChange={(v) => session.set({ xfade: v / 100 })} />
          <Macro pro id="intensidad" label="Intensidad" value={Math.round((s.intensidad ?? 1) * 100)} max={200} fmt={(v) => `×${(v / 100).toFixed(2)}`} onChange={(v) => session.set({ intensidad: v / 100 })} />
          <Macro id="density" label="Densidad" value={s.density} min={1} max={20} fmt={(v) => `${v} ms`} onChange={(v) => session.set({ density: v }, true)} />
          <Macro id="filtro" label="Filtro de la compu" value={Math.round((s.fx?.filtro ?? 1) * 100)} fmt={(v) => (v >= 99 ? 'abierto' : `${v}%`)} onChange={(v) => session.setFx({ filtro: v / 100 })} />
          <Macro id="swing" label="Swing" value={s.swing} min={50} max={75} fmt={(v) => `${v}%`} onChange={(v) => session.set({ swing: v }, true)} />
        </div>
        <p className="dim" style={{ margin: 0, fontSize: 11 }}>Crossfader: elige en cada pista si va del lado A o B (por ejemplo, un K.O. II en cada lado). Intensidad sube o baja todos los estímulos a la vez: la mosca se calma o se enciende.</p>
      </section>
    </div>
  );
}
