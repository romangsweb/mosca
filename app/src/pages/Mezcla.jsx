import { useEffect, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { PROFILES } from '../engine/devices.js';
import { KITS } from '../engine/kits.js';
import { audioInputs, rawConstraints } from '../engine/capture.js';
import { useS, useTick, Icon, Seg } from '../ui/kit.jsx';
import { DeviceArt } from '../ui/DeviceArt.jsx';

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

function Fader({ id, label, value, onChange, height = 150 }) {
  return (
    <input id={id} type="range" min="0" max="100" value={Math.round(value * 100)} aria-label={label} onChange={(e) => onChange(+e.target.value / 100)}
      style={{ writingMode: 'vertical-lr', direction: 'rtl', height, width: 28, accentColor: 'var(--acc)', margin: 0 }} />
  );
}

function Strip({ title, art, icon, sub, children, controls, meter, fader, on = true }) {
  return (
    <section className="panel" style={{ flex: '1 1 250px', maxWidth: 340, gap: 12, opacity: on ? 1 : 0.65 }}>
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
    <Strip title={`Pista ${t.name}`} art={prof.art} on={session.audible(t)} sub={<><span className={`status-dot${dev ? ' on' : ''}`} /> {session.audible(t) ? `Suena en: ${where}` : 'Silenciada'}</>}
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

function KitStrip() {
  const s = useS(), users = s.tracks.filter((t) => session.audible(t) && session.toKit(t));
  const v = Math.max(0, ...users.map((t) => meterOf(t.id)));
  return (
    <Strip title="Compu · kit" icon="sonido" sub={users.length ? `Lo usan: ${users.map((t) => t.name).join(', ')}` : 'Ninguna pista lo usa ahora'}
      fader={<Fader id="kitvol" label="Volumen del kit" value={s.kitVol ?? 0.7} onChange={(x) => session.setKitVol(x)} />}
      meter={<Meter value={v * (s.kitVol ?? 0.7) / 0.7} />}
      controls={<>
        <div className="field"><label htmlFor="kitsel">Kit de la librería</label>
          <select id="kitsel" className="input" value={s.kitActive || s.kitId} onChange={(e) => session.setKit(e.target.value)}>
            {KITS.map((k) => <option key={k.id} value={k.id}>{k.name}{k.pro && !session.can('kits') ? ' · Pro' : ''}</option>)}
            <option value="propio">Mi kit{!session.can('kits') ? ' · Pro' : ''}</option>
          </select></div>
        <p className="dim" style={{ margin: 0, fontSize: 11, lineHeight: 1.45 }}>Suena por las bocinas o audífonos de tu computadora. Pon una pista en «Compu» o «Ambos» para usarlo junto a tu aparato.</p>
        <a className="btn" href="#/sonido">Abrir la librería</a>
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

export default function Mezcla() {
  const s = useS(); useTick(30);
  const anySolo = s.tracks.some((t) => t.solo);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Mezcla</h1><p>Cómo suena todo junto. Cada pista de la mosca va a un aparato, al kit de la compu o a ambos. Con el sidekick, los dos K.O. II se mezclan en el aparato y vuelven aquí por la entrada.</p></div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {anySolo && <button type="button" className="btn" onClick={() => s.tracks.forEach((t) => t.solo && session.setTrack(t.id, { solo: false }))}>Quitar solos</button>}
          {!session.ko.access && session.ko.supported && <button type="button" className="btn lg primary" onClick={() => session.connect()}>Permitir MIDI</button>}
          <button type="button" className={`btn lg ${s.playing ? 'primary' : 'acc'}`} onClick={() => session.toggle()}><Icon name={s.playing ? 'stop' : 'play'} size={12} fill="currentColor" />{s.playing ? 'Detener' : 'Tocar'}</button>
        </div>
      </div>
      <div className="well mono" style={{ padding: '10px 14px', fontSize: 11, lineHeight: 1.7, color: 'var(--sub)', overflowX: 'auto', whiteSpace: 'nowrap' }} aria-label="Flujo de la señal">
        MOSCA → {s.tracks.map((t) => { const p = session.portFor(t), dv = session.toDevice(t, p), k = session.toKit(t, p); return `${t.name.toUpperCase()} → ${[dv && (p?.name || session.profileFor(t).name), k && 'COMPU'].filter(Boolean).join(' + ') || '—'}`; }).join('   ·   ')}   ·   APARATOS → SIDEKICK → ENTRADA
      </div>
      <div className="cols" style={{ alignItems: 'stretch' }}>
        {s.tracks.map((t) => <TrackStrip key={t.id} t={t} />)}
        <KitStrip />
        <InputStrip />
      </div>
    </div>
  );
}
