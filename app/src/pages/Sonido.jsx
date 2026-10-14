import { SoundRoute } from '../ui/SoundRoute.jsx';
import Libreria from '../ui/Libreria.jsx';
import { useState } from 'react';
import { session } from '../engine/session.js';
import { PAD_KEYS, GROUP_BASE } from '../engine/midi.js';
import { VOICES, VOICE_CAT, DEFAULT_KIT } from '../engine/synth.js';
import { useS, Seg, Icon } from '../ui/kit.jsx';
import { COMPASES, compas } from '../engine/compas.js';

function Slider({ id, label, value, min, max, unit, help, onChange, color }) {
  return (
    <div className="field">
      <div className="between"><label htmlFor={id} style={{ color: 'var(--text)' }}>{label}</label><span className="mono">{value} {unit}</span></div>
      <input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} style={{ accentColor: color }} />
      {help && <span className="dim" style={{ fontSize: 11 }}>{help}</span>}
    </div>
  );
}
function Toggle({ label, desc, checked, onChange, children }) {
  return (
    <div className="setting">
      <div><div className="t">{label}</div><div className="d">{desc}</div></div>
      {children || <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--acc)' }} />{checked ? 'Activado' : 'Desactivado'}</label>}
    </div>
  );
}

export default function Sonido() {
  const s = useS(), [tab, setTabS] = useState(() => { const t = location.hash.split('?')[1]; return ['libreria', 'ritmo', 'din', 'kit', 'midi'].includes(t) ? t : 'libreria'; }), track = session.track();
  const setTab = (t) => { setTabS(t); history.replaceState(null, '', `#/sonido?${t}`); };
  const curve = { lineal: (x) => x, suave: (x) => Math.sqrt(x), dura: (x) => x * x }[s.curve];
  const pts = Array.from({ length: 21 }, (_, i) => `${40 + i * 17},${220 - (s.velMin + (s.velMax - s.velMin) * curve(i / 20)) / 127 * 190}`).join(' ');
  const C = compas(s.compas), cw = 600 / C.len, swingX = (i) => 20 + i * cw + (i % 2 ? ((s.swing - 50) / 50) * cw : 0);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Sonido</h1><p>Qué sonidos usa la mosca: los kits de la compu, cómo se convierte cada disparo en un golpe y la conexión MIDI.</p></div>
        <Seg role="tab" label="Secciones" items={[['libreria', 'Kits'], ['kit', 'Pads y voces'], ['ritmo', 'Ritmo'], ['din', 'Dinámica'], ['midi', 'MIDI y reloj']]} value={tab} onChange={setTab} />
      </div>

      <div className="well" style={{ flex: 'none', padding: '8px 10px' }}><SoundRoute sounds={false} /></div>

      {tab === 'libreria' && <Libreria />}

      {tab === 'ritmo' && (
        <div className="cols">
          <section className="panel" style={{ flex: '1 1 360px', gap: 18 }}>
            <div className="field"><label style={{ color: 'var(--text)' }}>Compás</label>
              <Seg label="Compás" items={Object.keys(COMPASES).map((id) => [id, id])} value={s.compas || '4/4'} onChange={(v) => session.setCompas(v)} />
              <span className="dim" style={{ fontSize: 11 }}>{C.desc}. Cambia el largo del compás, el metrónomo, los patrones, la armonía y las escenas.</span></div>
            <Slider id="acento" label="Acento del compás" value={Math.round((s.acento ?? 0.35) * 100)} min={0} max={100} unit="%" color="var(--acc)" help="El primer tiempo suena más fuerte y lo que cae entre pulsos un poco más suave: así se siente el compás aunque la mosca toque libre." onChange={(v) => session.set({ acento: v / 100 }, true)} />
            <Slider id="dens" label="Densidad (tiempo neuronal por paso)" value={s.density} min={1} max={20} unit="ms" help="Más milisegundos por paso = más disparos por compás = groove más lleno." onChange={(v) => session.set({ density: v }, true)} />
            <Slider id="swing" label="Swing" value={s.swing} min={50} max={75} unit="%" color="var(--acc)" help="Retrasa las semicorcheas pares." onChange={(v) => session.set({ swing: v }, true)} />
            <Slider id="hum" label="Humanizar" value={s.humanize} min={0} max={30} unit="ms" color="var(--steel)" help="Pequeñas variaciones de tiempo al azar." onChange={(v) => session.set({ humanize: v }, true)} />
          </section>
          <section className="panel" style={{ flex: '999 1 480px', background: 'var(--screen)', color: '#ECECEE' }}>
            <h2>Vista previa · 1 compás de {C.name}</h2>
            <svg viewBox="0 0 640 120" style={{ width: '100%' }} role="img" aria-label={`Rejilla de ${C.len} pasos con el swing aplicado`}>
              {Array.from({ length: C.len + 1 }, (_, i) => <line key={i} x1={20 + i * cw} y1="0" x2={20 + i * cw} y2="110" stroke={C.pulsos.includes(i % C.len) ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.07)'} />)}
              {Array.from({ length: C.len }, (_, i) => { const p = C.pulsos.includes(i); return <rect key={i} x={swingX(i) + cw * 0.1} y={i === 0 ? 10 : p ? 20 : 50} width={cw * 0.7} height={i === 0 ? 80 : p ? 70 : 40} rx="4" fill={p ? '#FF6A1A' : '#ECECEE'} opacity={i % 2 ? 0.5 : 0.85} style={{ transition: 'x .2s' }} />; })}
            </svg>
          </section>
        </div>
      )}

      {tab === 'din' && (
        <div className="cols">
          <section className="panel" style={{ flex: '1 1 360px' }}>
            <h2>Curva de velocidad</h2>
            <p className="muted" style={{ margin: 0 }}>Cuántos disparos en un paso se convierten en qué tan fuerte suena el pad.</p>
            <Seg label="Curva" items={[['lineal', 'Lineal'], ['suave', 'Suave'], ['dura', 'Dura']]} value={s.curve} onChange={(v) => session.set({ curve: v }, true)} />
            <Slider id="vmin" label="Velocidad mínima" value={s.velMin} min={1} max={127} onChange={(v) => session.set({ velMin: Math.min(v, s.velMax) }, true)} />
            <Slider id="vmax" label="Velocidad máxima" value={s.velMax} min={1} max={127} onChange={(v) => session.set({ velMax: Math.max(v, s.velMin) }, true)} />
            <label className="row" style={{ gap: 10 }}><input type="checkbox" checked={s.ghost} onChange={(e) => session.set({ ghost: e.target.checked }, true)} style={{ width: 18, height: 18, accentColor: 'var(--acc)' }} />Las inhibidoras tocan notas fantasma (60 % de fuerza)</label>
          </section>
          <section className="panel" style={{ flex: '999 1 420px', background: 'var(--screen)', color: '#ECECEE' }}>
            <svg viewBox="0 0 400 250" style={{ width: '100%' }} role="img" aria-label="Curva de disparos a velocidad">
              <line x1="40" y1="220" x2="380" y2="220" stroke="rgba(255,255,255,.2)" /><line x1="40" y1="20" x2="40" y2="220" stroke="rgba(255,255,255,.2)" />
              <polyline points={pts} fill="none" stroke="#FF6A1A" strokeWidth="3" strokeLinejoin="round" />
              <text x="380" y="242" textAnchor="end" fill="#8C8C94" fontFamily="JetBrains Mono, monospace" fontSize="11">DISPAROS POR PASO →</text>
              <text x="46" y="16" fill="#8C8C94" fontFamily="JetBrains Mono, monospace" fontSize="11">VELOCIDAD</text>
            </svg>
          </section>
        </div>
      )}

      {tab === 'kit' && (
        <section className="panel">
          <div className="between" style={{ flexWrap: 'wrap' }}>
            <Seg label="Pista" items={s.tracks.map((t) => [t.id, `${t.name} · grupo ${t.group}`])} value={track.id} onChange={(id) => session.set({ selTrack: id }, true)} />
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {session.profile.kind === 'grupos' && <label className="row" style={{ gap: 6 }}>Grupo del K.O. II<select className="input" value={track.group} onChange={(e) => session.setTrack(track.id, { group: e.target.value })}>{Object.keys(GROUP_BASE).map((g) => <option key={g}>{g}</option>)}</select></label>}
              <label className="row" style={{ gap: 6 }}>Canal<select className="input" value={track.ch} onChange={(e) => session.setTrack(track.id, { ch: +e.target.value })}>{Array.from({ length: 16 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>
              <label className="row" style={{ gap: 6 }}>Nivel<input type="range" min="20" max="100" value={Math.round(track.level * 100)} onChange={(e) => session.setTrack(track.id, { level: +e.target.value / 100 })} /></label>
              <button type="button" className="btn" onClick={() => session.mutateTrack(track.id)}><Icon name="dado" size={14} />Mutar</button>
              <button type="button" className="btn ghost" onClick={() => session.setTrack(track.id, { kit: [...DEFAULT_KIT] })}>Kit por defecto</button>
            </div>
          </div>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>Dile a Fly Punch qué sonido tiene cada pad de tu kit en el K.O. II. Lo usa para las voces internas y para <strong style={{ color: 'var(--text)' }}>Mutar</strong>: las motoneuronas van a graves, las interneuronas a medios y los sensores e inhibidoras a agudos, así el azar cambia la mezcla sin romperla.</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Pad</th><th>Nota</th><th>Sonido en tu kit</th><th>Registro</th><th title="Solo para el sonido de la compu">Afinación</th><th title="Cuánto se deja sonar">Caída</th><th title="Izquierda – derecha">Paneo</th><th>Neurona que lo toca hoy</th><th>Probar</th></tr></thead>
              <tbody>{PAD_KEYS.map((key, off) => {
                const k = track.map.indexOf(off), p = session.pads(track)[k];
                return (
                  <tr key={key}>
                    <td className="mono" style={{ fontWeight: 600 }}>{key}</td><td className="mono muted">{k >= 0 ? session.route(track, k).note ?? '—' : '—'}</td>
                    <td><select className="input" aria-label={`Sonido del pad ${key}`} value={track.kit[off]} onChange={(e) => { const kit = [...track.kit]; kit[off] = e.target.value; session.setTrack(track.id, { kit }); }}>{VOICES.map((v) => <option key={v}>{v}</option>)}</select></td>
                    <td className="muted">{VOICE_CAT[track.kit[off]]}</td>
                    <td><input type="number" min="-12" max="12" className="input mono" style={{ width: 66, height: 30 }} aria-label={`Afinación del pad ${key} en semitonos`} value={track.tune?.[off] || 0} onChange={(e) => { const tune = [...(track.tune || new Array(12).fill(0))]; tune[off] = Math.max(-12, Math.min(12, +e.target.value || 0)); session.setTrack(track.id, { tune }); }} /></td>
                    <td><input type="range" min="10" max="100" style={{ width: 80, accentColor: 'var(--acc)' }} aria-label={`Caída del pad ${key}`} title={`${Math.round((track.decay?.[off] ?? 1) * 100)} %`} value={Math.round((track.decay?.[off] ?? 1) * 100)} onChange={(e) => { const decay = [...(track.decay || new Array(12).fill(1))]; decay[off] = +e.target.value / 100; session.setTrack(track.id, { decay }); }} /></td>
                    <td><input type="range" min="-100" max="100" style={{ width: 80, accentColor: 'var(--acc)' }} aria-label={`Paneo del pad ${key}`} title={(() => { const v = Math.round((track.pan?.[off] || 0) * 100); return v === 0 ? 'centro' : v < 0 ? `${-v} % izq.` : `${v} % der.`; })()} value={Math.round((track.pan?.[off] || 0) * 100)} onChange={(e) => { const pan = [...(track.pan || new Array(12).fill(0))]; pan[off] = +e.target.value / 100; session.setTrack(track.id, { pan }); }} onDoubleClick={() => { const pan = [...(track.pan || new Array(12).fill(0))]; pan[off] = 0; session.setTrack(track.id, { pan }); }} /></td><td className="mono">{p?.tipo}</td>
                    <td><button type="button" className="iconbtn" aria-label={`Probar pad ${key}`} onClick={() => session.tapPad(k, track)}><Icon name="play" size={12} fill="currentColor" /></button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'midi' && (
        <section className="panel" style={{ gap: 0 }}>
          <Toggle label="Enviar notas al aparato" desc={`Cada disparo toca una nota en ${session.profile.name}. Cámbialo en Equipo.`} checked={s.sendMidi} onChange={(v) => session.set({ sendMidi: v }, true)} />
          <Toggle label="Fly Punch marca el tempo (maestro)" desc="Manda reloj y Start/Stop: el secuenciador del K.O. II arranca junto con la mosca y puedes grabar sus patrones encima. En el K.O. II: SHIFT + ERASE, código 101, ENTER. Si lo dejas apagado y el K.O. manda reloj (código 102), Fly Punch lo sigue." checked={s.clockOut} onChange={(v) => session.setClockOut(v)} />
          {session.profile.fx && <Toggle label="La mosca mueve los efectos" desc="MN9 controla la perilla X de efectos (CC 12) y la actividad total la perilla Y (CC 13). Elige un efecto en el K.O. II para oírlo." checked={s.fxAuto} onChange={(v) => session.set({ fxAuto: v }, true)} />}
          <Toggle label="Sonido interno" desc="Cuándo suena el kit de la compu en las pistas en «Auto». Para elegirlo por pista, usa Mezcla.">
            <Seg label="Sonido interno" items={[['auto', 'Solo sin K.O.'], ['siempre', 'Siempre'], ['nunca', 'Nunca']]} value={s.monitor} onChange={(v) => session.set({ monitor: v }, true)} />
          </Toggle>
          <Toggle label="Metrónomo" desc="Un clic en cada tiempo, más agudo en el primero del compás. Atajo: tecla M." checked={!!s.metro} onChange={(v) => session.set({ metro: v }, true)} />
          <Toggle label="Cuenta de entrada al grabar" desc="Si grabas con todo detenido, suena un clic antes de empezar para que entres a tiempo.">
            <Seg label="Cuenta de entrada" items={[['0', 'Sin cuenta'], ['1', '1 compás'], ['2', '2 compases']]} value={String(s.countIn ?? 1)} onChange={(v) => session.set({ countIn: +v }, true)} />
          </Toggle>
          <Toggle label="Compensar latencia" desc="Adelanta las notas MIDI si el K.O. II suena tarde.">
            <div className="row" style={{ minWidth: 240 }}><input type="range" min="0" max="60" value={s.latency} onChange={(e) => session.setLatency(+e.target.value)} aria-label="Latencia en milisegundos" style={{ flex: 1 }} /><span className="mono" style={{ width: 48, textAlign: 'right' }}>{s.latency} ms</span></div>
          </Toggle>
          <Toggle label="Recibir notas del aparato" desc="Al tocar un pad o tecla que corresponde a una neurona, se estimula esa neurona en el cerebro (como optogenética). Siempre activo.">
            <span className={`chip${s.ko.input ? ' acc' : ''}`}>{s.ko.input ? 'ENTRADA LISTA' : 'SIN ENTRADA'}</span>
          </Toggle>
        </section>
      )}
    </div>
  );
}
