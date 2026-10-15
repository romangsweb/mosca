import { useEffect, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { PROFILES } from '../engine/devices.js';
import { KITS } from '../engine/kits.js';
import { audioInputs, rawConstraints } from '../engine/capture.js';
import { useS, useTick, Icon, Seg } from '../ui/kit.jsx';
import { DeviceArt } from '../ui/DeviceArt.jsx';
import { SK_PRESET, SK_FX } from '../engine/sidekick.js';
import { TARGETS } from '../engine/controls.js';
import { Acompanar } from '../ui/Acompanar.jsx';
import Consola from '../ui/Consola.jsx';
import Espectro from '../ui/Espectro.jsx';
import { kitName } from '../ui/SoundRoute.jsx';

// Mezcla: una tira por pista (a dónde va, nivel, silencio, solo), la compu (kit interno) y la entrada de audio
// (el sidekick o tu interfaz). Es el mapa de cómo suena todo junto.
const DEST = [['auto', 'Auto'], ['aparato', 'Aparato'], ['kit', 'Compu'], ['ambos', 'Ambos']];
const DEST_HELP = {
  auto: 'Al aparato si está conectado; si no, suena el kit en la compu.',
  aparato: 'Solo al aparato (MIDI). Si no hay aparato, suena en la compu para que no te quedes sin sonido.',
  kit: 'Solo el kit de la librería, en la compu. El aparato no recibe nada de esta pista.',
  ambos: 'Al aparato y al kit a la vez: útil para capas o para escuchar sin el sidekick.',
};

function Meter({ value, height = 150 }) {
  return (
    <div aria-hidden="true" style={{ width: 8, height, borderRadius: 4, background: '#1B1B1F', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.min(100, value * 100)}%`, background: value > 0.92 ? '#E5484D' : 'linear-gradient(to top, #FF6A1A, #FFB37A)', transition: 'height .06s linear' }} />
    </div>
  );
}
const meterOf = (id) => { const m = session.live.meter[id]; if (!m) return 0; const dt = performance.now() - m.at; return dt < 0 ? 0 : (m.vel / 127) * Math.exp(-dt / 220); };

// sonoridad en vivo de la compu: LUFS momentáneo (400 ms), de 3 s y pico; la barra marca −14 LUFS (streaming)
function Loudness() {
  useTick(12);
  const L = session.s.playing ? session.loudness() : null, f = (x) => (Number.isFinite(x) ? x.toFixed(1) : '—');
  const pct = (x) => (Number.isFinite(x) ? Math.max(0, Math.min(100, ((x + 40) / 40) * 100)) : 0), hot = L && L.peakDb > -1;
  return (
    <div className="well" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }} aria-label="Sonoridad de la salida">
      <div className="between mono" style={{ fontSize: 10, color: 'var(--dim)' }}><span>LUFS 3 S</span><span>MOMENTÁNEO</span><span>PICO</span></div>
      <div className="between mono" style={{ fontSize: 15, fontWeight: 600 }}><span style={{ color: 'var(--acc)' }}>{f(L?.short)}</span><span>{f(L?.momentary)}</span><span style={{ color: hot ? '#E5484D' : undefined }}>{f(L?.peakDb)} dB</span></div>
      <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'var(--line)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct(L?.momentary)}%`, borderRadius: 3, background: 'linear-gradient(90deg, #7D93B2, #FF6A1A)', transition: 'width .08s linear' }} />
        <i title="−14 LUFS" style={{ position: 'absolute', left: `${pct(-14)}%`, top: -3, bottom: -3, width: 2, background: 'var(--text)' }} />
      </div>
      <span className="dim" style={{ fontSize: 10.5 }}>La raya es −14 LUFS, el volumen de Spotify y YouTube. Al exportar WAV se ajusta solo.</span>
    </div>
  );
}
function Fader({ id, label, value, onChange, height = 150 }) {
  return (
    <input id={id} type="range" min="0" max="100" value={Math.round(value * 100)} aria-label={label} onChange={(e) => onChange(+e.target.value / 100)}
      style={{ writingMode: 'vertical-lr', direction: 'rtl', height, width: 28, accentColor: 'var(--acc)', margin: 0 }} />
  );
}

const Slider = ({ label, value, onChange, fmt = (v) => `${Math.round(v * 100)}%`, disabled }) => (
  <label className="row" style={{ gap: 8, fontSize: 12, opacity: disabled ? 0.5 : 1 }}><span className="muted" style={{ width: 62 }}>{label}</span>
    <input type="range" min="0" max="100" value={Math.round(value * 100)} disabled={disabled} onChange={(e) => onChange(+e.target.value / 100)} style={{ flex: 1, accentColor: 'var(--acc)' }} />
    <span className="mono" style={{ width: 40, textAlign: 'right', fontSize: 11 }}>{fmt(value)}</span></label>
);

function Strip({ title, art, icon, sub, children, controls, meter, fader, on = true, wide = false }) {
  return (
    <section className="panel" style={{ flex: wide ? '1 1 330px' : '1 1 250px', maxWidth: wide ? 440 : 340, gap: 12, opacity: on ? 1 : 0.65 }}>
      <div className="row" style={{ gap: 10 }}>
        <span style={{ flex: 'none', display: 'grid', placeItems: 'center', width: 64, height: 46, borderRadius: 9, background: 'var(--screen)', color: '#ECECEE' }}>{art ? <DeviceArt art={art} size={56} /> : <Icon name={icon} size={20} />}</span>
        <div style={{ minWidth: 0 }}><h2 style={{ fontSize: 15 }}>{title}</h2><p className="muted" style={{ margin: '3px 0 0', fontSize: 11.5, lineHeight: 1.35 }}>{sub}</p></div>
      </div>
      <div className="row" style={{ alignItems: 'stretch', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '10px 10px 8px', borderRadius: 10, background: 'var(--screen)' }}>{fader}{meter}</div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{controls}</div>
      </div>
      {children}
    </section>
  );
}

function TrackStrip({ t }) {
  const s = useS(), prof = session.profileFor(t), port = session.portFor(t), multi = session.can('multi'), ports = session.ko.ports().outputs, d = t.dest || 'auto';
  const dev = session.toDevice(t, port), kit = session.toKit(t, port);
  const where = [dev && (port?.name || prof.name), kit && 'compu'].filter(Boolean).join(' + ') || 'en silencio';
  return (
    <Strip title={`Pista ${t.name}`} art={prof.art} on={session.audible(t)} sub={<><span className={`status-dot${dev ? ' on' : ''}`} /> {session.audible(t) ? `Suena en: ${where}` : s.tracks.indexOf(t) >= session.trackLimit ? <a href="#/cuenta?plan">Pista 3 y 4 son Pro</a> : 'Silenciada'}</>}
      fader={<Fader id={`lvl-${t.id}`} label={`Nivel de ${t.name}`} value={t.level} onChange={(v) => session.setTrack(t.id, { level: Math.max(0.05, v) })} />}
      meter={<Meter value={meterOf(t.id) * (session.audible(t) ? 1 : 0)} />}
      controls={<>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className={`btn ${t.mute ? 'primary' : ''}`} aria-pressed={t.mute} onClick={() => session.setTrack(t.id, { mute: !t.mute })}>M</button>
          <button type="button" className={`btn ${t.solo ? 'acc' : ''}`} aria-pressed={t.solo} onClick={() => session.setTrack(t.id, { solo: !t.solo })}>S</button>
          <span className="mono muted" style={{ fontSize: 11, marginLeft: 'auto' }}>{Math.round(t.level * 100)}%</span>
        </div>
        <p className="dim" style={{ margin: 0, fontSize: 11, lineHeight: 1.45 }}>{DEST_HELP[d]}</p>
      </>}>
      <div className="field"><label>Destino</label><Seg label={`Destino de ${t.name}`} items={DEST} value={d} onChange={(v) => session.setTrack(t.id, { dest: v })} /></div>
      {session.toKit(t) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <div className="row" style={{ gap: 8 }}><span className="label" style={{ flex: 1 }}>En la compu</span>{!session.can('kits') && <a href="#/cuenta?plan" className="badge-pro">PRO</a>}</div>
          <select className="input" aria-label={`Kit de ${t.name}`} value={t.kitId || ''} onChange={(e) => session.setTrackKit(t.id, e.target.value)}>
            <option value="">Kit general ({kitName(s.kitActive || s.kitId)})</option>
            {KITS.map((k) => <option key={k.id} value={k.id} disabled={!session.can('kits')}>{k.name}</option>)}
            <option value="propio" disabled={!session.can('kits')}>Mi kit</option>
          </select>
          <Slider label="Reverb" value={t.rev ?? 0} onChange={(v) => session.setTrack(t.id, { rev: v })} />
          <Slider label="Delay" value={t.dly ?? 0} onChange={(v) => session.setTrack(t.id, { dly: v })} />
        </div>
      )}
      {session.toKit(t) && <Canal t={t} />}
      {d !== 'kit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <div className="row" style={{ gap: 8 }}><span className="label">Aparato de esta pista</span>{!multi && <a href="#/cuenta?plan" className="badge-pro" style={{ marginLeft: 'auto' }}>PRO</a>}</div>
          <select className="input" aria-label={`Aparato de ${t.name}`} disabled={!multi} value={t.out?.device || ''} onChange={(e) => session.setTrack(t.id, { out: e.target.value ? { device: e.target.value, port: t.out?.port || null } : (t.out?.port ? { device: null, port: t.out.port } : null) })}>
            <option value="">Igual que el principal ({session.profile.name})</option>
            {PROFILES.filter((p) => p.kind !== 'interno').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input" aria-label={`Puerto MIDI de ${t.name}`} disabled={!multi} value={t.out?.port || ''} onChange={(e) => session.setTrack(t.id, { out: { device: t.out?.device || null, port: e.target.value || null } })}>
            <option value="">Puerto del principal{session.ko.output ? ` (${session.ko.output.name})` : ''}</option>
            {ports.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {!multi && <p className="dim" style={{ margin: 0, fontSize: 11 }}>Un aparato distinto por pista (p. ej. dos K.O. II) es parte de Pro.</p>}
        </div>
      )}
      <button type="button" className="btn" onClick={() => [11, 3, 7, 0].forEach((k, i) => setTimeout(() => session.tapPad(k, t), i * 180))}><Icon name="play" size={11} fill="currentColor" />Probar esta pista</button>
    </Strip>
  );
}

// perilla de canal: deslizador con centro (doble clic vuelve a 0)
const Knob = ({ label, value, min, max, fmt, onChange, disabled, center = 0 }) => (
  <label className="row" style={{ gap: 8, fontSize: 12, opacity: disabled ? 0.5 : 1 }} onDoubleClick={() => !disabled && onChange(center)} title="Doble clic: al centro"><span className="muted" style={{ width: 62 }}>{label}</span>
    <input type="range" min={min} max={max} step="any" value={value} disabled={disabled} onChange={(e) => onChange(+e.target.value)} style={{ flex: 1, minWidth: 0, accentColor: 'var(--acc)' }} />
    <span className="mono" style={{ width: 52, textAlign: 'right', fontSize: 11 }}>{fmt(value)}</span></label>
);
const db = (v) => `${v > 0.05 ? '+' : ''}${(Math.abs(v) < 0.05 ? 0 : v).toFixed(1)} dB`;
const hz = (f) => (f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${Math.round(f)}`);
const fltFmt = (v) => (Math.abs(v) < 0.02 ? 'abierto' : v < 0 ? `LP ${hz(20000 * Math.pow(0.01, -v))}` : `HP ${hz(20 * Math.pow(150, v))}`); // LP: pasan los graves · HP: pasan los agudos

function Canal({ t }) {
  const st = t.strip || {}, pro = session.can('canal'), set = (k) => (v) => session.setStrip(t.id, { [k]: Math.abs(v) < (k === 'filtro' ? 0.03 : 0.25) && k !== 'drive' ? 0 : v });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      <div className="row" style={{ gap: 8 }}><span className="label" style={{ flex: 1 }}>Canal</span>
        {!pro ? <a href="#/cuenta?plan" className="badge-pro">PRO</a> : (st.lo || st.mid || st.hi || st.filtro || st.drive) ? <button type="button" className="btn" style={{ height: 24, fontSize: 11 }} onClick={() => session.setTrack(t.id, { strip: null })}>Plano</button> : null}</div>
      <Knob label="Graves" value={st.lo || 0} min={-12} max={12} fmt={db} disabled={!pro} onChange={set('lo')} />
      <Knob label="Medios" value={st.mid || 0} min={-12} max={12} fmt={db} disabled={!pro} onChange={set('mid')} />
      <Knob label="Agudos" value={st.hi || 0} min={-12} max={12} fmt={db} disabled={!pro} onChange={set('hi')} />
      <Knob label="Filtro" value={st.filtro || 0} min={-1} max={1} fmt={fltFmt} disabled={!pro} onChange={set('filtro')} />
      <Knob label="Saturar" value={st.drive || 0} min={0} max={1} fmt={(v) => `${Math.round(v * 100)}%`} disabled={!pro} onChange={set('drive')} />
      <label className="row" style={{ gap: 8, fontSize: 12 }}><input type="checkbox" checked={t.choke !== false} onChange={(e) => session.setTrack(t.id, { choke: e.target.checked })} style={{ accentColor: 'var(--acc)' }} />El hat cerrado corta al abierto</label>
    </div>
  );
}

function KitStrip() {
  const s = useS(), fx = s.fx || {}, users = s.tracks.filter((t) => session.audible(t) && session.toKit(t));
  const v = Math.max(0, ...users.map((t) => meterOf(t.id)));
  return (
 <Strip wide title="Compu · kit y efectos" icon="sonido" sub={users.length ? `Lo usan: ${users.map((t) => t.name).join(', ')}` : 'Ninguna pista lo usa ahora'}
      fader={<Fader id="kitvol" label="Volumen del kit" value={s.kitVol ?? 0.7} onChange={(x) => session.setKitVol(x)} />}
      meter={<Meter value={v * (s.kitVol ?? 0.7) / 0.7} />}
      controls={<>
        <div className="field"><label htmlFor="kitsel">Kit general</label>
          <select id="kitsel" className="input" value={s.kitActive || s.kitId} onChange={(e) => session.setKit(e.target.value)}>
            {KITS.map((k) => <option key={k.id} value={k.id}>{k.name}{k.pro && !session.can('kits') ? ' · Pro' : ''}</option>)}
            <option value="propio">Mi kit{!session.can('kits') ? ' · Pro' : ''}</option>
          </select></div>
        <Slider label="Filtro" value={fx.filtro ?? 1} onChange={(v) => session.setFx({ filtro: v })} fmt={(v) => { const f = 180 * Math.pow(100, v); return v >= 0.99 ? 'abierto' : f < 1000 ? `${Math.round(f)}` : `${(f / 1000).toFixed(1)}k`; }} />
        <div className="row" style={{ gap: 8, fontSize: 12 }}><span className="muted" style={{ width: 62 }}>Delay</span>
          <Seg label="Tiempo del delay" items={[['0.5', '1/8'], ['0.75', '1/8·'], ['1', '1/4']]} value={String(fx.dlyBeats ?? 0.75)} onChange={(v) => session.setFx({ dlyBeats: +v })} /></div>
        <Slider label="Repetir" value={(fx.dlyFb ?? 0.38) / 0.85} onChange={(v) => session.setFx({ dlyFb: v * 0.85 })} />
        <Slider label="Sidechain" value={fx.sc || 0} onChange={(v) => session.setFx({ sc: v })} />
        <label className="row" style={{ gap: 10, fontSize: 12 }}><input type="checkbox" checked={fx.comp !== false} onChange={(e) => session.setFx({ comp: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--acc)' }} />Compresor maestro</label>
        <label className="row" style={{ gap: 10, fontSize: 12 }} title="Los picos se quedan cerca de −2 dB: evita recortes digitales"><input type="checkbox" checked={fx.limit !== false} onChange={(e) => session.setFx({ limit: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--acc)' }} />Limitador maestro (techo −2 dB)</label>
        <Loudness />
        <p className="dim" style={{ margin: 0, fontSize: 11, lineHeight: 1.45 }}>Reverb y delay se mandan desde cada pista; el delay va a tempo. Sidechain: cada bombo baja un instante las demás pistas. Los efectos salen también en el WAV.</p>
      </>} />
  );
}

function InputStrip() {
  const s = useS(), [inputs, setInputs] = useState([]), [level, setLevel] = useState(0), [on, setOn] = useState(false), stop = useRef(null);
  const refresh = async () => setInputs(await audioInputs());
  useEffect(() => { refresh(); return () => stop.current?.(); }, []);
  const listen = async () => {
    if (on) { stop.current?.(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(rawConstraints(s.audioIn)), ctx = session.synth.ensure(), an = ctx.createAnalyser(); an.fftSize = 1024;
      const src = ctx.createMediaStreamSource(stream); src.connect(an); const buf = new Float32Array(an.fftSize); let raf = 0; refresh();
      const loop = () => { an.getFloatTimeDomainData(buf); let m = 0; for (const x of buf) m = Math.max(m, Math.abs(x)); setLevel((l) => Math.max(m, l * 0.85)); raf = requestAnimationFrame(loop); };
      loop(); setOn(true);
      stop.current = () => { cancelAnimationFrame(raf); src.disconnect(); stream.getTracks().forEach((x) => x.stop()); setLevel(0); setOn(false); stop.current = null; };
    } catch { setOn(false); }
  };
  const name = inputs.find((d) => d.id === s.audioIn)?.label || 'Predeterminada';
  return (
    <Strip title="Entrada · sidekick" icon="mic" sub={`${name}${s.captureAudio && session.can('audio') ? ' · se graba con cada toma' : ''}`}
      fader={<div style={{ width: 28, height: 150, display: 'grid', placeItems: 'center' }}><span className="mono dim" style={{ fontSize: 9, writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>NIVEL EN EL APARATO</span></div>}
      meter={<Meter value={level * 1.1} />}
      controls={<>
        <div className="field"><label htmlFor="ain-mix">Entrada de audio</label>
          <select id="ain-mix" className="input" value={s.audioIn || ''} onChange={(e) => { stop.current?.(); session.set({ audioIn: e.target.value || null }, true); }}>
            <option value="">Predeterminada del sistema</option>
            {inputs.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select></div>
        <button type="button" className={`btn ${on ? 'acc' : ''}`} onClick={listen}>{on ? 'Dejar de medir' : 'Medir entrada'}</button>
        <p className="dim" style={{ margin: 0, fontSize: 11, lineHeight: 1.45 }}>Aquí llega la mezcla real de tus aparatos. Su volumen se ajusta en el sidekick; Fly Punch solo la mide y la graba.</p>
        <a className="btn" href="#/equipo?audio">Grabación de audio</a>
      </>} />
  );
}

// el sidekick como superficie de control y como mezclador que Fly Punch puede mover
function SidekickPanel() {
  const s = useS(), sk = session.sidekick, pro = session.can('controles'), [done, setDone] = useState(null);
  const mapped = SK_PRESET.filter((x) => s.mappings.some((m) => m.target === x.target && m.src.type === 'cc' && m.src.ch === x.src.ch && m.src.num === x.src.num)).length;
  const label = (id) => TARGETS.find((t) => t.id === id)?.label || id;
  const Toggle = ({ k, children }) => (
    <label className="row" style={{ gap: 10, fontSize: 13, opacity: pro ? 1 : 0.55 }}>
      <input type="checkbox" disabled={!pro} checked={!!s.sk?.[k]} onChange={(e) => session.setSk({ [k]: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--acc)' }} />{children}
    </label>
  );
  if (!sk.input) return (
    <section className="panel" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 14px' }}>
      <span className="row" style={{ gap: 8, fontSize: 13, fontWeight: 600 }}><Icon name="mezcla" size={16} />K.O.–sidekick</span>
      <span className="row muted" style={{ gap: 6, fontSize: 12, flex: 1, minWidth: 240 }}><span className="status-dot" />{session.ko.access ? 'No conectado. Conéctalo por USB-C directo a la Mac para usar sus perillas y mover su mezcla desde aquí.' : 'Permite MIDI para detectarlo.'}</span>
      {!session.ko.access && session.ko.supported && <button type="button" className="btn primary" onClick={() => session.connect()}>Permitir MIDI</button>}
    </section>
  );
  return (
    <section className="panel" style={{ gap: 12 }}>
      <div className="panel-head">
        <div className="row" style={{ gap: 12 }}>
          <span style={{ flex: 'none', display: 'grid', placeItems: 'center', width: 64, height: 46, borderRadius: 9, background: 'var(--screen)', color: '#ECECEE' }}><Icon name="mezcla" size={22} /></span>
          <div><h2 style={{ fontSize: 15 }}>K.O.–sidekick · EP-136</h2>
            <p className="row muted" style={{ margin: '3px 0 0', gap: 6, fontSize: 12 }}><span className={`status-dot${sk.input ? ' on' : ''}`} />{sk.input ? `Conectado: ${sk.input.name}` : session.ko.access ? 'No detectado por MIDI: conéctalo por USB-C directo a la Mac' : 'Permite MIDI para detectarlo'}</p></div>
        </div>
        {!session.ko.access && session.ko.supported && <button type="button" className="btn primary" onClick={() => session.connect()}>Permitir MIDI</button>}
      </div>
      <div className="cols" style={{ alignItems: 'stretch' }}>
        <div className="well" style={{ flex: '999 1 420px', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="label" style={{ flex: 1 }}>Perillas y botones → Fly Punch · {mapped}/{SK_PRESET.length} asignados</span>
            <button type="button" className="btn acc" onClick={() => setDone(session.applySkPreset())}>Usar el mapa del sidekick</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '4px 14px' }}>
            {SK_PRESET.map((x, i) => (
              <span key={x.target} className="row mono" style={{ gap: 6, fontSize: 10.5, opacity: !pro && i >= 4 ? 0.45 : 1 }}>
                <span style={{ color: 'var(--acc)', minWidth: 78 }}>{x.label}</span><span className="muted">→ {label(x.target)}</span>
              </span>
            ))}
          </div>
          {done != null && <p role="status" style={{ margin: 0, fontSize: 12, color: '#3DD68C' }}>Listo: {done} controles asignados. Mueve una perilla del sidekick y mira cómo cambia Fly Punch.{!pro && ' En Free son los primeros 4; Pro asigna los 16.'}</p>}
          <p className="dim" style={{ margin: 0, fontSize: 11, lineHeight: 1.5 }}>Tira 1 = pista Gusto, tira 2 = pista Oído. Las perillas siguen moviendo también el sonido del sidekick. Puedes cambiar cualquier asignación en Equipo → Controles.</p>
        </div>
        <div className="well" style={{ flex: '1 1 300px', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="row label" style={{ gap: 8 }}>Fly Punch → sidekick{!pro && <a href="#/cuenta?plan" className="badge-pro">PRO</a>}</span>
          {!pro && <p style={{ margin: 0, fontSize: 11.5, color: '#FF8A4D' }}>Mover el sidekick desde Fly Punch es parte de Pro.</p>}
          {pro && !sk.output && (
            <div className="field"><span className="label" style={{ color: '#FF8A4D' }}>No encontramos la salida MIDI del sidekick: elígela</span>
              <select className="input" value={s.sk?.outPort || ''} onChange={(e) => session.setSk({ outPort: e.target.value || null })}>
                <option value="">Elige un puerto…</option>
                {session.ko.ports().outputs.map((n) => <option key={n} value={n}>{n}</option>)}
              </select></div>
          )}
          {pro && sk.output && <span className="mono dim" style={{ fontSize: 10 }}>SALIDA: {sk.output.name}</span>}
          <Toggle k="follow">Los faders de esta Mezcla mueven los del sidekick</Toggle>
          <Toggle k="fxAuto">La mosca mueve los efectos del sidekick</Toggle>
          {s.sk?.fxAuto && (
            <div className="row" style={{ gap: 8 }}>
              {[0, 1].map((k) => (
                <label key={k} className="field" style={{ flex: 1 }}><span className="label">Efecto tira {k + 1}</span>
                  <select className="input" value={s.sk.fx?.[k] ?? k} onChange={(e) => { const fx = [...(s.sk.fx || [0, 1])]; fx[k] = +e.target.value; session.setSk({ fx }); }}>
                    {SK_FX.map((n, i) => <option key={n} value={i}>{n}</option>)}
                  </select></label>
              ))}
            </div>
          )}
          <p className="dim" style={{ margin: 0, fontSize: 11, lineHeight: 1.5 }}>{s.sk?.fxAuto ? 'La neurona MN9 abre el efecto de la tira 1; el acicalamiento, el de la tira 2.' : 'La actividad de la mosca abre y cierra los efectos del sidekick, al ritmo de sus neuronas.'}</p>
        </div>
      </div>
    </section>
  );
}

export default function Mezcla() {
  const s = useS(); useTick(30);
  const anySolo = s.tracks.some((t) => t.solo);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Mezcla</h1><p>Cómo suena todo junto: acompaña una canción, decide a dónde va cada pista (aparato, kit de la compu o ambos) y usa el sidekick como mezclador.</p></div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {anySolo && <button type="button" className="btn" onClick={() => s.tracks.forEach((t) => t.solo && session.setTrack(t.id, { solo: false }))}>Quitar solos</button>}
          {!session.ko.access && session.ko.supported && <button type="button" className="btn lg primary" onClick={() => session.connect()}>Permitir MIDI</button>}
          <button type="button" className={`btn lg ${s.playing ? 'primary' : 'acc'}`} onClick={() => session.toggle()}><Icon name={s.playing ? 'stop' : 'play'} size={12} fill="currentColor" />{s.playing ? 'Detener' : 'Tocar'}</button>
        </div>
      </div>
      
      <Consola />
      <Espectro />
      <Acompanar />
      <SidekickPanel />
      <div className="cols" style={{ alignItems: 'stretch' }}>
        {s.tracks.map((t) => <TrackStrip key={t.id} t={t} />)}
        <KitStrip />
        <InputStrip />
      </div>
    </div>
  );
}
