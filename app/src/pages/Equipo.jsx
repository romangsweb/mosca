import { useState } from 'react';
import { session } from '../engine/session.js';
import { PROFILES, VOICE_LIST } from '../engine/devices.js';
import { useS, Icon, Seg } from '../ui/kit.jsx';
import { DeviceArt } from '../ui/DeviceArt.jsx';
import { Controles, AudioIn } from '../ui/EquipoExtra.jsx';
export { DeviceArt };

function Principal() {
  const s = useS(), prof = session.profile, ov = session.devOverride, [testing, setTesting] = useState(false);
  const ports = session.ko.ports().outputs, track = session.track();
  const detected = (p) => p.match && ports.some((n) => p.match.test(n));
  const test = () => { setTesting(true); session.synth.ensure(); [11, 9, 3, 7, 0, 4, 11, 1].forEach((k, i) => setTimeout(() => session.tapPad(k, track), i * 160)); setTimeout(() => setTesting(false), 1400); };
  const lockMel = prof.pro && !session.can('melodia');
  return (
    <div>
      <div className="cols" style={{ alignItems: 'stretch' }}>
        <section aria-label="Galería de dispositivos" style={{ flex: '999 1 560px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, alignContent: 'start' }}>
          {PROFILES.map((p) => {
            const on = s.device === p.id, det = detected(p);
            return (
              <button key={p.id} type="button" aria-pressed={on} onClick={() => session.chooseDevice(p.id)} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: 10, borderColor: on ? 'var(--acc)' : undefined }}>
                <span style={{ position: 'relative', display: 'grid', placeItems: 'center', height: 110, borderRadius: 10, background: 'var(--screen)', color: on ? '#ECECEE' : '#8C8C94', overflow: 'hidden' }}>
                  <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: on ? 'radial-gradient(circle at 50% 60%, rgba(255,106,26,.16), transparent 65%)' : 'none' }} />
                  <DeviceArt art={p.art} />
                  {det && <span className="chip" style={{ position: 'absolute', left: 8, top: 8, background: 'rgba(61,214,140,.15)', color: '#3DD68C' }}><span className="status-dot on" />DETECTADO</span>}
                  {p.pro && <span className="badge-pro" style={{ position: 'absolute', right: 8, top: 8 }}>PRO</span>}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px' }}>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span className="muted" style={{ fontSize: 11, lineHeight: 1.4 }}>{p.maker}</span>
                </span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 4px 2px' }}>{p.tags.map((t) => <span key={t} className="chip" style={{ fontSize: 9 }}>{t.toUpperCase()}</span>)}</span>
              </button>
            );
          })}
        </section>

        <aside className="panel" style={{ flex: '1 1 340px', maxWidth: 460, gap: 14 }} aria-label="Configuración del dispositivo">
          <div className="row" style={{ gap: 14 }}>
            <span style={{ flex: 'none', display: 'grid', placeItems: 'center', width: 96, height: 72, borderRadius: 10, background: 'var(--screen)', color: '#ECECEE' }}><DeviceArt art={prof.art} size={84} /></span>
            <div style={{ minWidth: 0 }}><h2 style={{ fontSize: 17, letterSpacing: '-.01em' }}>{prof.name}</h2><p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>{prof.maker}</p>
              <p className="row" style={{ margin: '6px 0 0', gap: 6, fontSize: 12 }}><span className={`status-dot${s.ko.output ? ' on' : ''}`} />{prof.kind === 'interno' ? 'Suena en tu computadora' : s.ko.output ? `Conectado: ${s.ko.output}` : 'Sin conexión: elige un puerto'}</p></div>
          </div>
          {lockMel && <div className="well" style={{ padding: 12, fontSize: 12, lineHeight: 1.5 }}><span className="badge-pro">PRO</span> El modo melódico es parte de Pro. <a href="#/cuenta?plan" style={{ textDecoration: 'underline' }}>{session.canTrial ? 'Pruébalo 7 días gratis' : 'Ver planes'}</a></div>}
          {prof.kind !== 'interno' && (
            <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor="port">Puerto MIDI</label>
                <select id="port" className="input" value={s.port || ''} onChange={(e) => session.chooseDevice(s.device, e.target.value || null)}>
                  <option value="">{prof.match ? 'Automático (detectar)' : 'Elige un puerto…'}</option>
                  {ports.map((n) => <option key={n} value={n}>{n}</option>)}
                </select></div>
              <div className="field" style={{ width: 90 }}><label htmlFor="ch">Canal</label>
                <select id="ch" className="input" value={ov.ch ?? prof.ch} disabled={prof.kind === 'canales' || prof.id === 'ko2'} onChange={(e) => session.setDevOverride({ ch: +e.target.value })}>{Array.from({ length: 16 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></div>
            </div>
          )}
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--sub)', fontSize: 12.5, lineHeight: 1.5 }}>{prof.setup.map((t) => <li key={t}>{t}</li>)}</ol>
          <button type="button" className="btn lg acc" onClick={test} disabled={testing}><Icon name="play" size={12} fill="currentColor" />{testing ? 'Sonando…' : 'Probar: tocar 8 notas'}</button>

          {prof.kind === 'voces' && (
            <details className="doc-item" open={prof.id === 'custom'}>
              <summary>Mapa de notas por sonido</summary>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingBottom: 14 }}>
                {VOICE_LIST.map((v) => (
                  <label key={v} className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>{v}
                    <input type="number" min="0" max="127" className="input mono" style={{ width: 70, height: 30 }} value={(ov.notes || prof.notes)[v]} onChange={(e) => session.setDevOverride({ notes: { ...(ov.notes || prof.notes), [v]: Math.max(0, Math.min(127, +e.target.value)) } })} />
                  </label>
                ))}
              </div>
            </details>
          )}
          {prof.kind !== 'interno' && (
            <details className="doc-item">
              <summary>Qué toca cada neurona · pista {track.name}</summary>
              <table className="table mono" style={{ marginBottom: 12 }}><thead><tr><th>Neurona</th><th>Sonido</th><th>Nota</th><th>Canal</th></tr></thead>
                <tbody>{session.pads(track).map((p, k) => { const r = session.route(track, k); return <tr key={k}><td>{p.tipo}</td><td className="muted">{r.voice === 'tono' ? 'melodía' : r.voice}</td><td>{r.note ?? '—'}</td><td>{r.ch}</td></tr>; })}</tbody></table>
            </details>
          )}
          <p className="dim" style={{ margin: 0, fontSize: 11, lineHeight: 1.5 }}>¿Tu aparato no está? Usa <strong>Personalizado</strong> y escribe las notas que espera; casi todas las cajas de ritmos y samplers aceptan notas MIDI.</p>
        </aside>
      </div>
    </div>
  );
}

export default function Equipo() {
  const [tab, setTab] = useState(() => { const t = location.hash.split('?')[1] || 'principal'; if (t === 'pistas') { location.hash = '#/mezcla'; return 'principal'; } return t; });
  const pick = (t) => { setTab(t); history.replaceState(null, '', `#/equipo?${t}`); };
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Equipo</h1><p>Con qué toca la mosca, qué la controla y qué escucha. Funciona con el K.O. II, el sidekick y cualquier aparato MIDI.</p></div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {!session.ko.access && session.ko.supported && <button type="button" className="btn lg primary" onClick={() => session.connect()}>Permitir MIDI</button>}
          {!session.ko.supported && <span className="chip">SIN WEB MIDI · USA CHROME O EDGE</span>}
          <Seg role="tab" label="Secciones de Equipo" items={[['principal', 'Aparato principal'], ['controles', 'Controles'], ['audio', 'Audio']]} value={tab} onChange={pick} />
        </div>
      </div>
      {tab === 'principal' && <Principal />}
      {tab === 'controles' && <Controles />}
      {tab === 'audio' && <AudioIn />}
    </div>
  );
}
