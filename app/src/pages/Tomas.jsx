import { useEffect, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { takeToMidi, takeToCsv, download, slug } from '../engine/midifile.js';
import { renderWav, wavBlob } from '../engine/synth.js';
import { FREE_TAKES } from '../engine/storage.js';
import { useS, Icon } from '../ui/kit.jsx';

const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const when = (d) => { const x = new Date(d), today = new Date().toDateString() === x.toDateString(); return today ? `hoy ${x.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : x.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); };
const COL = { gusto: '#FF6A1A', oido: '#7D93B2' };

function Roll({ take, playing, t0 }) {
  const head = useRef(null);
  useEffect(() => {
    let raf; const loop = () => {
      const h = head.current;
      if (h) { const x = playing ? Math.min(700, Math.max(0, ((performance.now() - t0) / take.durMs) * 700)) : 0; h.setAttribute('x1', x); h.setAttribute('x2', x); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [playing, t0, take]);
  const rows = take.tracks.flatMap((t) => Array.from({ length: 12 }, (_, k) => ({ t: t.id, k })));
  const H = Math.max(120, rows.length * 12), x = (ms) => (ms / take.durMs) * 700;
  const bars = Math.max(1, Math.round(take.steps / 16));
  return (
    <svg viewBox={`0 0 700 ${H}`} style={{ width: '100%', height: 'auto', maxHeight: 340 }} role="img" aria-label={`Rollo de notas de ${take.name}`}>
      {Array.from({ length: bars + 1 }, (_, i) => <line key={i} x1={(i / bars) * 700} y1="0" x2={(i / bars) * 700} y2={H} stroke="rgba(255,255,255,.1)" />)}
      {take.events.map((e, i) => { const r = rows.findIndex((row) => row.t === e.track && row.k === e.pad); return <rect key={i} x={x(e.t)} y={r * 12 + 2} width="4" height="8" rx="1.5" fill={COL[e.track] || '#ECECEE'} opacity={0.35 + (e.vel / 127) * 0.65} />; })}
      <line ref={head} x1="0" y1="0" x2="0" y2={H} stroke="#ECECEE" strokeWidth="2" opacity={playing ? 0.9 : 0} />
    </svg>
  );
}

function RealAudio({ id }) {
  const [url, setUrl] = useState(null);
  useEffect(() => { let u; session.getAudio(id).then((b) => { if (b) { u = URL.createObjectURL(b); setUrl(u); } }); return () => u && URL.revokeObjectURL(u); }, [id]);
  if (!url) return null;
  return <div className="well row" style={{ padding: '8px 12px', gap: 12 }}><span className="chip acc">AUDIO REAL</span><audio controls src={url} style={{ flex: 1, height: 32 }} /></div>;
}

export default function Tomas() {
  const s = useS(), [sel, setSel] = useState(s.lastTake || s.takes[0]?.id), [playing, setPlaying] = useState(false), [exp, setExp] = useState(false), [fmtSel, setFmt] = useState('mid'), [busy, setBusy] = useState(false), [editing, setEditing] = useState(false);
  const take = s.takes.find((t) => t.id === sel) || s.takes[0], [loadErr, setLoadErr] = useState(null);
  useEffect(() => () => session.stopTake(), []);
  useEffect(() => { setLoadErr(null); if (take && !take.events) session.ensureEvents(take.id).catch(() => setLoadErr('No pudimos descargar esta toma. Revisa tu conexión.')); }, [take?.id, take?.events]);
  const ready = !!take?.events;
  const count = s.user && s.plan === 'pro' ? `${s.takes.length} TOMAS · PRO` : `${s.takes.length} DE ${FREE_TAKES} · FREE`;
  const play = () => { if (playing) { session.stopTake(); setPlaying(false); return; } session.playTake(take, () => setPlaying(false)); setPlaying(true); };
  const doExport = async () => {
    setBusy(true);
    const base = slug(take.name);
    if (fmtSel === 'mid') download(takeToMidi(take), `${base}.mid`);
    if (fmtSel === 'csv') download(takeToCsv(take), `${base}-disparos.csv`);
    if (fmtSel === 'real') { const blob = await session.getAudio(take.id); if (blob) { try { const buf = await session.synth.ensure().decodeAudioData(await blob.arrayBuffer()); download(wavBlob(buf), `${base}-audio-real.wav`); } catch { download(blob, `${base}-audio-real.webm`); } } }
    if (fmtSel === 'wav') download(await renderWav(take, (e) => e.voice, session.synth.kit), `${base}-${session.s.kitActive || 'kit'}.wav`);
    setBusy(false); setExp(false);
  };
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Tomas</h1><p>Cada toma guarda las notas que tocó la mosca en todas las pistas, con su tiempo exacto. {s.user ? 'Con tu cuenta se guardan en la nube y las ves en cualquier dispositivo.' : 'Sin cuenta se guardan solo en este navegador.'}</p></div>
        <div className="row">{!s.user && s.sync !== 'off' && <a href="#/bienvenida" className="btn">Iniciar sesión para guardarlas en la nube</a>}<span className="chip">{count}</span></div>
      </div>
      {!s.takes.length ? (
        <div className="stage" style={{ minHeight: 380, flexDirection: 'column', gap: 14, textAlign: 'center' }}>
          <span style={{ width: 64, height: 64, borderRadius: '50%', border: '1px solid rgba(255,255,255,.14)', display: 'grid', placeItems: 'center' }}><span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--rec)' }} /></span>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Aún no hay tomas</p>
          <p style={{ margin: 0, color: '#8C8C94', maxWidth: 420 }}>Pulsa el punto rojo (o la tecla R) mientras la mosca toca. Al detener, la toma aparece aquí.</p>
          <button type="button" className="btn lg acc" onClick={() => { location.hash = '#/estudio'; session.toggleRec(); }}>Grabar ahora</button>
        </div>
      ) : (
        <div className="cols">
          <section aria-label="Lista de tomas" style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {s.takes.map((t) => (
              <button key={t.id} type="button" className="list-item" aria-pressed={t.id === take.id} onClick={() => { session.stopTake(); setPlaying(false); setSel(t.id); }}>
                <span style={{ display: 'flex', gap: 3 }}>{t.tracks.map((tr) => <span key={tr.id} style={{ width: 4, height: 28, borderRadius: 2, background: COL[tr.id] }} />)}</span>
                <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span><span className="mono muted" style={{ fontSize: 11 }}>{when(t.date)} · {fmt(t.durMs)} · {t.bpm} BPM · {t.events?.length ?? t.nEvents} notas</span></span>
                {t.hasAudio && <span className="chip" title="Incluye el audio real">AUDIO</span>}
                <span className="chip" title={t.where === 'nube' ? 'Guardada en tu cuenta' : 'Solo en este navegador'} style={t.where === 'nube' ? { color: 'var(--text)' } : undefined}>{t.where === 'nube' ? 'NUBE' : 'LOCAL'}</span>
              </button>
            ))}
            <div className="panel" style={{ borderStyle: 'dashed', background: 'transparent' }}>
              <span className="muted" style={{ fontSize: 12, lineHeight: 1.55 }}>¿Y el sonido real del K.O. II? Fly Punch graba las <strong style={{ color: 'var(--text)' }}>notas</strong>. Para el audio de tu kit: exporta a MIDI y tócalo de nuevo hacia el K.O., graba la salida de audio del K.O. II con tu interfaz, o activa «Fly Punch marca el tempo» en Sonido y graba los patrones directamente en el K.O.</span>
            </div>
          </section>
          {take && (
            <section className="panel" style={{ flex: '999 1 560px' }}>
              <div className="between" style={{ flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  {editing ? <input className="input" autoFocus defaultValue={take.name} onBlur={(e) => { session.renameTake(take.id, e.target.value || take.name); setEditing(false); }} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-label="Nombre de la toma" />
                    : <h2 style={{ fontSize: 20, letterSpacing: '-.02em' }}>{take.name}</h2>}
                  <p className="mono muted" style={{ margin: '4px 0 0', fontSize: 11 }}>{when(take.date).toUpperCase()} · {fmt(take.durMs)} · {take.bpm} BPM · {take.tracks.map((t) => `${t.name} (grupo ${t.group})`).join(' + ')}</p>
                </div>
                <div className="row">
                  <button type="button" className="btn lg primary" onClick={play} disabled={!ready}><Icon name={playing ? 'stop' : 'play'} size={12} fill="currentColor" />{playing ? 'Detener' : 'Reproducir'}</button>
                  <button type="button" className="btn lg" onClick={() => setExp(true)} disabled={!ready}><Icon name="bajar" size={14} />Exportar</button>
                </div>
              </div>
              <div style={{ borderRadius: 12, background: 'var(--screen)', padding: 12, minHeight: 140, display: 'grid', placeItems: ready ? 'stretch' : 'center', color: '#8C8C94' }}>{ready ? <Roll take={take} playing={playing} t0={session.takeT0} /> : <span>{loadErr || 'Descargando notas de la nube…'}</span>}</div>
              {take.hasAudio && <RealAudio id={take.id} />}
              {take.where === 'local' && s.user && <p className="muted" style={{ margin: 0, fontSize: 12 }}>Esta toma está solo en este navegador{s.takes.filter((t) => t.where === 'nube').length >= FREE_TAKES && s.plan !== 'pro' ? ': tu cuenta Free ya tiene 5 tomas en la nube.' : '; se subirá en la próxima sincronización.'}</p>}
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <div className="stat"><div className="label">Notas</div><div className="v">{take.events?.length ?? take.nEvents}</div></div>
                <div className="stat"><div className="label">Neurona más activa</div><div className="v">{ready ? Object.entries(take.events.reduce((a, e) => ((a[e.neuron] = (a[e.neuron] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1])[0]?.[0] : '—'}</div></div>
                <div className="stat"><div className="label">Fuente</div><div className="v">{take.source}</div></div>
                <div className="stat"><div className="label">Entradas</div><div className="v" style={{ fontSize: 11 }}>D {take.inputs.dulce} · A {take.inputs.amargo}</div></div>
              </div>
              <div className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <button type="button" className="btn" onClick={() => setEditing(true)}><Icon name="lapiz" size={14} />Renombrar</button>
                <button type="button" className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => { if (confirm(`¿Eliminar «${take.name}»?`)) { session.deleteTake(take.id); setSel(null); } }}><Icon name="basura" size={14} />Eliminar</button>
              </div>
            </section>
          )}
        </div>
      )}
      {exp && take && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setExp(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="exp-t">
            <h2 id="exp-t" style={{ fontSize: 18 }}>Exportar «{take.name}»</h2>
            <div role="radiogroup" aria-label="Formato" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...(take.hasAudio ? [['real', 'Audio real (.wav)', 'Lo que sonó en tus aparatos, grabado desde tu interfaz.']] : []), ['mid', 'MIDI (.mid)', 'Una pista por pista de Fly Punch. Ábrelo en Ableton, Logic o FL Studio.'], ['csv', 'CSV de disparos', 'Tiempo, neurona, nota y velocidad de cada disparo.'], ['wav', 'Audio (.wav)', 'Con el kit de la librería que tengas elegido (no con los sonidos de tu aparato).']].map(([id, l, d]) => (
                <button key={id} type="button" role="radio" aria-checked={fmtSel === id} className="radio-card" disabled={id === 'wav' && !session.can('wav')} style={id === 'wav' && !session.can('wav') ? { opacity: 0.55, cursor: 'not-allowed' } : undefined} onClick={() => setFmt(id)}><span className="o" /><span style={{ flex: 1 }}><span style={{ display: 'block', fontWeight: 600 }}>{l}</span><span className="muted" style={{ fontSize: 12 }}>{d}</span></span>{id === 'wav' && !session.can('wav') && <span className="badge-pro">PRO</span>}</button>
              ))}
            </div>
            {!session.can('wav') && <a href="#/cuenta?plan" className="muted" style={{ fontSize: 12 }}>WAV es parte de Pro · {session.canTrial ? 'pruébalo 7 días gratis' : 'ver planes'} →</a>}
            <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn lg" onClick={() => setExp(false)}>Cancelar</button><button type="button" className="btn lg primary" disabled={busy} onClick={doExport}>{busy ? 'Preparando…' : 'Descargar'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
