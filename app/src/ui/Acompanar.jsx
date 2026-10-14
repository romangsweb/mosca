import { useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { KEY_NAMES } from '../engine/follow.js';
import { useS, useTick, Icon, Seg } from './kit.jsx';

// Acompañar: la mosca sigue el tempo, los golpes y el tono de una canción que suena en tu Mac.
const SOURCES = [['entrada', 'Entrada (sidekick)'], ['pestana', 'Pestaña o pantalla'], ['archivo', 'Archivo']];
const HOW = {
  entrada: ['En tu Mac: Configuración del Sistema → Sonido → Salida: elige el EP-136.', 'Pon tu canción en Spotify o Apple Music: suena por el sidekick, junto a tus K.O. II.', 'Pulsa «Escuchar y seguir»: Fly Punch oye la mezcla por la entrada y se engancha.'],
  pestana: ['Abre la canción en otra pestaña de Chrome (p. ej. el reproductor web de Spotify).', 'Pulsa «Escuchar y seguir» y elige esa pestaña con «Compartir audio» activado.', 'La canción sigue sonando normal; Fly Punch solo la escucha.'],
  archivo: ['Elige un MP3, WAV o AIFF tuyo.', 'Suena aquí mismo y Fly Punch lo sigue.', 'Útil para practicar sin cables.'],
};
const ERR = { permiso: 'No se dio permiso para escuchar. Revisa el candado de la barra de direcciones.', 'sin-audio': 'Esa pestaña no compartió audio: vuelve a intentarlo y activa «Compartir audio».', error: 'No pudimos abrir esa fuente de audio.' };

function Pulse({ on, color, label }) {
  return (
    <span className="row" style={{ gap: 6, fontSize: 10, color: '#8C8C94' }} aria-hidden="true">
      <span style={{ width: 12, height: 12, borderRadius: 6, background: on ? color : '#26262B', boxShadow: on ? `0 0 12px ${color}` : 'none', transition: 'background .05s, box-shadow .05s' }} />{label}
    </span>
  );
}

export function Acompanar() {
  const s = useS(); useTick(30);
  const st = session.live.follow || {}, f = s.follow || {}, src = f.source || 'entrada', file = useRef(null), [busy, setBusy] = useState(false);
  const locked = session.followLocked, now = performance.now(), L = session.live;
  const songBeat = st.on && st.beatAt && st.periodMs ? ((((now - st.beatAt - (f.offset || 0)) % st.periodMs) + st.periodMs) % st.periodMs) / st.periodMs < 0.13 : false;
  const flyBeat = s.playing && L.step % 4 === 0 && now - (L.stepAt || 0) < 90;
  const start = async (opt) => { setBusy(true); await session.startFollow(src, opt); setBusy(false); };
  const go = () => (src === 'archivo' ? file.current?.click() : start());
  const melo = s.tracks.some((t) => t.mode === 'melodia'), keyTxt = st.key ? `${KEY_NAMES[st.key.root]} ${st.key.mode}` : '—';
  const status = !st.on ? (st.error ? ERR[st.error] : 'Apagado') : !locked ? `Escuchando… ${Math.max(0, Math.ceil(5 - (st.secs || 0)))} s` : 'Enganchado';
  return (
    <section className="panel" style={{ gap: 12 }} aria-label="Acompañar una canción">
      <div className="panel-head" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div><h2 className="row" style={{ fontSize: 15, gap: 8 }}><Icon name="oido" size={16} />Acompañar una canción</h2>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 12 }}>La mosca sigue el tempo, los golpes y el tono de lo que suena, y toca encima.</p></div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Seg label="Fuente" items={SOURCES} value={src} onChange={(v) => { if (st.on) session.stopFollow(); session.setFollow({ source: v }); }} />
          {st.on ? <button type="button" className="btn lg primary" onClick={() => session.stopFollow()}><Icon name="stop" size={12} fill="currentColor" />Dejar de seguir</button>
            : <button type="button" className="btn lg acc" disabled={busy} onClick={go}><Icon name="oido" size={14} />{busy ? 'Abriendo…' : 'Escuchar y seguir'}</button>}
          <input ref={file} type="file" accept="audio/*" hidden onChange={(e) => { const fl = e.target.files?.[0]; e.target.value = ''; if (fl) start({ file: fl }); }} />
        </div>
      </div>
      <div className="cols" style={{ alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 420px', borderRadius: 12, background: 'var(--screen)', color: '#ECECEE', padding: 14, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <div><span className="label" style={{ color: '#77777F' }}>Tempo</span>
            <div className="mono" style={{ fontSize: 30, fontWeight: 600, color: locked ? '#FF6A1A' : '#8C8C94', lineHeight: 1.1 }}>{st.bpm ? Math.round(st.bpm) : '—'}<small style={{ fontSize: 11, color: '#77777F' }}> BPM</small></div>
            <div style={{ height: 4, borderRadius: 2, background: '#26262B', marginTop: 6 }}><div style={{ height: '100%', width: `${Math.round((st.conf || 0) * 100)}%`, borderRadius: 2, background: locked ? '#3DD68C' : '#77777F' }} /></div>
            <span className="mono" style={{ fontSize: 9, color: '#77777F' }}>SEGURIDAD</span></div>
          <div><span className="label" style={{ color: '#77777F' }}>Tono</span>
            <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3, color: st.keyConf > 0.35 ? '#ECECEE' : '#8C8C94' }}>{keyTxt}</div>
            <span style={{ fontSize: 10.5, color: '#8C8C94', lineHeight: 1.4, display: 'block' }}>{!f.key ? 'No se sigue' : !session.can('melodia') ? 'Seguir el tono es Pro' : melo ? 'Las pistas en Melodía usan esta escala' : 'Pon una pista en Melodía para usarlo'}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span className="label" style={{ color: '#77777F' }}>Golpes</span>
            <Pulse on={songBeat} color="#ECECEE" label="CANCIÓN" /><Pulse on={flyBeat} color="#FF6A1A" label="MOSCA" />
            <span className="mono" style={{ fontSize: 9.5, color: locked ? '#3DD68C' : '#8C8C94' }}>{status.toUpperCase()}</span></div>
          <div style={{ gridColumn: '1 / -1', height: 6, borderRadius: 3, background: '#1B1B1F', overflow: 'hidden' }} aria-label="Nivel de la canción"><div style={{ height: '100%', width: `${Math.min(100, (st.level || 0) * 110)}%`, background: 'linear-gradient(90deg, #FF6A1A, #FFB37A)', transition: 'width .08s linear' }} /></div>
          {st.on && st.name && <span className="mono" style={{ gridColumn: '1 / -1', fontSize: 10, color: '#77777F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>OYENDO · {st.name}</span>}
        </div>
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[['tempo', 'Seguir el tempo y los golpes'], ['key', 'Seguir el tono (pistas en Melodía)'], ['autoPlay', 'Empezar a tocar al engancharse']].map(([k, label]) => (
            <label key={k} className="row" style={{ gap: 10, fontSize: 13 }}><input type="checkbox" checked={f[k] !== false} onChange={(e) => session.setFollow({ [k]: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--acc)' }} />{label}{k === 'key' && !session.can('melodia') && <span className="badge-pro">PRO</span>}</label>
          ))}
          <div className="row" style={{ gap: 6, fontSize: 12 }}>
            <span className="muted" style={{ flex: 1 }}>Ajuste fino de golpes</span>
            <button type="button" className="iconbtn" aria-label="Adelantar 10 ms" onClick={() => session.setFollow({ offset: (f.offset || 0) - 10 })}><Icon name="menos" size={12} /></button>
            <span className="mono" style={{ width: 54, textAlign: 'center' }}>{(f.offset || 0) > 0 ? '+' : ''}{f.offset || 0} ms</span>
            <button type="button" className="iconbtn" aria-label="Atrasar 10 ms" onClick={() => session.setFollow({ offset: (f.offset || 0) + 10 })}><Icon name="mas" size={12} /></button>
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--sub)', fontSize: 11.5, lineHeight: 1.45 }}>{HOW[src].map((t) => <li key={t}>{t}</li>)}</ol>
        </div>
      </div>
      <p className="dim" style={{ margin: 0, fontSize: 11 }}>Funciona mejor con música de pulso marcado (electrónica, pop, hip hop). La canción no se modifica ni sale de tu computadora: Fly Punch solo la escucha.</p>
    </section>
  );
}
