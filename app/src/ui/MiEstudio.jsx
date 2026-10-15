import { useEffect, useState } from 'react';
import { session, CIRCUITS, PRO_FEATURES } from '../engine/session.js';
import { SLOTS } from '../engine/song.js';
import { srcLabel, targetById, FREE_MAPPINGS } from '../engine/controls.js';
import { compas } from '../engine/compas.js';
import { TARGETS as LUFS } from '../engine/loudness.js';
import { VOICES } from '../engine/kits.js';
import { sampleGet } from '../engine/storage.js';
import { kitName } from './SoundRoute.jsx';
import { useS, Icon } from './kit.jsx';

// Mi estudio: todo lo que has configurado en un solo lugar (y lo que es Pro), con atajos para cambiarlo.
function Card({ title, icon, to, toLabel = 'Cambiar', children, pro }) {
  return (
    <section className="panel" style={{ gap: 10, flex: '1 1 300px' }}>
      <div className="between"><h2 className="row" style={{ gap: 8, fontSize: 15 }}><Icon name={icon} size={16} />{title}{pro && !session.can(pro) && <span className="badge-pro">PRO</span>}</h2>{to && <a href={to} className="btn" style={{ height: 28, fontSize: 12 }}>{toLabel}</a>}</div>
      {children}
    </section>
  );
}
const Row = ({ k, v, dim }) => <div className="between" style={{ fontSize: 12.5, gap: 12, color: dim ? 'var(--dim)' : undefined }}><span className="muted">{k}</span><span style={{ textAlign: 'right' }}>{v}</span></div>;

export default function MiEstudio() {
  const s = useS(), [mine, setMine] = useState(null);
  useEffect(() => { (async () => { const o = {}; for (const v of VOICES) { const x = await sampleGet(v); if (x) o[v] = x.name; } setMine(o); })(); }, [s.customSamples, s.kitCloud]);
  const pro = s.plan === 'pro', n = session.learnedCount, scenes = SLOTS.filter((x) => s.scenes[x]), bars = s.song.reduce((a, r) => a + (r.bars || 0), 0);
  const nube = s.takes.filter((t) => t.where === 'nube').length, conAudio = s.takes.filter((t) => t.hasAudio).length;
  const kitT = (t) => kitName((t.kitId && session.can('kits') && t.kitId) || s.kitActive || s.kitId);
  return (
    <>
      <div><h1>Mi estudio</h1><p className="muted" style={{ margin: '4px 0 0' }}>Lo que has configurado, en un solo lugar. {pro ? (session.onTrial ? 'Estás probando Pro.' : 'Tienes Pro: todo está activo.') : <>Lo marcado <span className="badge-pro">PRO</span> se guarda pero no suena hasta que lo actives.</>}</p></div>
      <div className="cols" style={{ gap: 12, alignItems: 'stretch' }}>
        <Card title={`Pistas · ${s.tracks.length} de 4`} icon="estudio" to="#/estudio" pro="pistas">
          {s.tracks.map((t, i) => <Row key={t.id} k={`${i + 1}. ${t.name}`} v={<>{CIRCUITS[t.sense]?.name} · grupo {t.group} · {t.mode === 'melodia' ? 'melodía' : 'ritmo'}{i >= session.trackLimit && <span className="badge-pro" style={{ marginLeft: 6 }}>PRO</span>}</>} />)}
        </Card>
        <Card title="Kits y sonido" icon="sonido" to="#/sonido?libreria" pro="kits">
          <Row k="Kit general" v={kitName(s.kitActive || s.kitId)} />
          {s.tracks.filter((t) => t.kitId).map((t) => <Row key={t.id} k={`Kit de ${t.name}`} v={kitT(t)} />)}
          <Row k="Mi kit" v={mine == null ? '…' : Object.keys(mine).length ? `${Object.keys(mine).length} muestras${s.user ? (s.kitCloud === 'ok' ? ' · en tu cuenta' : s.kitCloud === 'error' ? ' · sin sincronizar' : '') : ' · en este navegador'}` : 'sin muestras'} />
          {mine && Object.entries(mine).slice(0, 4).map(([v, nm]) => <Row key={v} dim k={`  ${v}`} v={nm} />)}
          <Row k="Compás · acento" v={`${compas(s.compas).name} · ${Math.round((s.acento ?? 0.35) * 100)} %`} />
          <Row k="Limitador · WAV" v={`${s.fx?.limit !== false ? 'encendido' : 'apagado'} · ${LUFS[s.lufs || 'streaming'][0]}`} />
        </Card>
        <Card title="La mosca aprende" icon="gusta" to="#/estudio" toLabel="Ir al estudio" pro="aprende">
          <Row k="Sinapsis aprendidas" v={n} />
          <Row k="Votos (me gusta / no)" v={s.taste?.n || 0} />
          <Row k="Mutar según tu gusto" v={s.taste?.on !== false ? 'sí' : 'no'} />
          {n > 0 && <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => session.forget()}>Olvidar lo aprendido</button>}
        </Card>
        <Card title={`Controles MIDI · ${s.mappings.length}${session.can('controles') ? '' : ` de ${FREE_MAPPINGS}`}`} icon="usb" to="#/equipo?controles" pro="controles">
          {s.mappings.length ? s.mappings.slice(0, 8).map((m, i) => <Row key={i} k={targetById(m.target)?.label || m.target} v={<span className="mono" style={{ fontSize: 11 }}>{srcLabel(m.src)}</span>} />) : <span className="muted" style={{ fontSize: 12.5 }}>Ninguno. Asigna perillas del sidekick en Equipo o con el botón MIDI de Directo.</span>}
          {s.mappings.length > 8 && <span className="dim" style={{ fontSize: 11 }}>y {s.mappings.length - 8} más</span>}
        </Card>
        <Card title="Escenas y canción" icon="cancion" to="#/cancion" pro="cancion">
          <Row k="Escenas guardadas" v={scenes.length ? scenes.map((x) => s.scenes[x].name).join(', ') : 'ninguna'} />
          <Row k="Canción" v={s.song.length ? `${s.song.length} partes · ${bars} compases` : 'sin armar'} />
          <Row k="Directo" v={session.can('directo') ? `crossfader ${s.tracks.filter((t) => t.xf).length ? s.tracks.filter((t) => t.xf).map((t) => `${t.name}→${t.xf}`).join(', ') : 'sin lados'}` : 'Pro'} />
        </Card>
        <Card title="Tomas" icon="tomas" to="#/tomas" toLabel="Ver tomas" pro="tomas">
          <Row k="Guardadas" v={`${s.takes.length}${session.can('tomas') ? '' : ' de 5 en la nube'}`} />
          {s.user && <Row k="En tu cuenta" v={nube} />}
          <Row k="Con audio real" v={conAudio} />
        </Card>
        <Card title="Aparatos" icon="usb" to="#/equipo" pro="multi">
          <Row k="Principal" v={session.profile.name} />
          {s.tracks.map((t) => { const p = session.portFor(t); return <Row key={t.id} k={t.name} v={[session.toDevice(t, p) && `${p?.name || session.profileFor(t).name} · ${t.group}`, session.toKit(t, p) && 'compu'].filter(Boolean).join(' + ') || '—'} />; })}
          <Row k="Sidekick" v={session.sidekick?.input ? 'conectado' : 'no detectado'} />
        </Card>
      </div>
      {!pro && (
        <section className="panel" style={{ gap: 8 }}>
          <h2>Lo que activa Pro</h2>
          <ul style={{ margin: 0, paddingLeft: 18, columns: 2, fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.7 }}>{Object.values(PRO_FEATURES).map((f) => <li key={f}>{f}</li>)}</ul>
          <a href="#/cuenta?plan" className="btn acc" style={{ alignSelf: 'flex-start' }}>Ver planes</a>
        </section>
      )}
    </>
  );
}
