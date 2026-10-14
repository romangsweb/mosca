import { useState } from 'react';
import { session } from '../engine/session.js';
import { SLOTS, SCENE_COLORS } from '../engine/song.js';
import { useS, useTick, Icon, Seg, Knob } from '../ui/kit.jsx';
import { Paywall } from '../ui/Paywall.jsx';

// Canción: 1) guarda escenas (fotos de lo que suena), 2) ordénalas con sus compases, 3) toca.
// Todo se puede hacer desde aquí, sin ir al Estudio.

function Timeline({ s }) {
  useTick(15);
  const rows = s.song, total = rows.reduce((a, r) => a + r.bars, 0) || 1, pos = session.songPos, L = session.live;
  let before = 0; if (s.songOn && pos) for (let i = 0; i < pos.row; i++) before += rows[i]?.bars || 0;
  const head = s.songOn && pos ? (before + Math.max(0, pos.bars) + (s.playing ? (L.step % 16) / 16 : 0)) / total : null;
  if (!rows.length) return (
    <div className="mono" style={{ flex: 'none', height: 64, borderRadius: 10, background: 'var(--screen)', display: 'grid', placeItems: 'center', color: '#77777F', fontSize: 11, letterSpacing: '.06em' }}>EL ARREGLO ESTÁ VACÍO · AÑADE ESCENAS ABAJO</div>
  );
  return (
    <div style={{ position: 'relative', flex: 'none', height: 64, borderRadius: 10, background: 'var(--screen)', display: 'flex', overflow: 'hidden', padding: 6, gap: 3 }} role="img" aria-label="Línea de tiempo de la canción">
      {rows.map((r, i) => {
        const sc = s.scenes[r.scene];
        return (
          <div key={i} style={{ flex: r.bars, minWidth: 6, borderRadius: 6, background: sc ? SCENE_COLORS[r.scene] : '#26262B', opacity: s.songOn && pos?.row === i ? 1 : 0.55, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '6px 8px', color: '#0B0B0C', overflow: 'hidden' }}>
            <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{r.scene}</span>
            <span style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{sc?.name || 'sin escena'} · {r.bars}</span>
          </div>
        );
      })}
      {head != null && <span aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(6px + (100% - 12px) * ${head})`, width: 2, background: '#ECECEE', boxShadow: '0 0 8px #ECECEE' }} />}
    </div>
  );
}

const Step = ({ n, title, done, children }) => (
  <section className="panel" style={{ flex: '1 1 260px', gap: 8, borderColor: done ? 'rgba(61,214,140,.35)' : undefined }}>
    <div className="row" style={{ gap: 8 }}>
      <span className="mono" style={{ width: 22, height: 22, borderRadius: 11, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600, background: done ? '#3DD68C' : 'var(--acc)', color: '#0B0B0C' }}>{done ? '✓' : n}</span>
      <h2 style={{ fontSize: 14 }}>{title}</h2>
    </div>
    {children}
  </section>
);

// lo que suena ahora: lo justo para componer escenas sin salir de esta página
function Ahora({ s }) {
  return (
    <section className="panel" style={{ flex: '1 1 360px', gap: 10 }}>
      <div className="panel-head"><h2>Lo que suena ahora</h2><a href="#/estudio" className="btn">Más en el Estudio</a></div>
      <div className="knobs" style={{ justifyContent: 'flex-start' }}>
        <Knob id="c-dulce" label="Dulce" value={s.inputs.dulce} onChange={(v) => session.setInput('dulce', v)} />
        <Knob id="c-amargo" label="Amargo" value={s.inputs.amargo} color="var(--steel)" onChange={(v) => session.setInput('amargo', v)} />
        <Knob id="c-graves" label="Graves" value={s.inputs.jon_ce} color="#ECECEE" onChange={(v) => session.setInput('jon_ce', v)} />
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {s.tracks.map((t) => <button key={t.id} type="button" className={`btn ${t.mute ? '' : 'acc'}`} aria-pressed={!t.mute} onClick={() => session.setTrack(t.id, { mute: !t.mute })}><Icon name={t.sense} size={13} />{t.name}{t.mute ? ' · en silencio' : ''}</button>)}
        <button type="button" className="btn" onClick={() => session.mutateTrack()}><Icon name="dado" size={13} />Mutar</button>
      </div>
      <label className="row" style={{ gap: 10, fontSize: 12 }}>Densidad<input type="range" min="1" max="20" value={s.density} onChange={(e) => session.set({ density: +e.target.value }, true)} style={{ flex: 1, accentColor: 'var(--acc)' }} /><span className="mono" style={{ width: 24 }}>{s.density}</span></label>
    </section>
  );
}

const resumen = (d) => `dulce ${Math.round(d.inputs.dulce)} · amargo ${Math.round(d.inputs.amargo)} · ${Object.entries(d.tracks).filter(([, t]) => !t.mute).map(([id]) => (id === 'gusto' ? 'Gusto' : 'Oído')).join('+') || 'nada'}`;

function Escenas({ s }) {
  const add = (x) => session.setSong([...s.song, { scene: x, bars: 4 }]);
  return (
    <section className="panel" style={{ flex: '1 1 420px', gap: 8 }}>
      <div className="panel-head"><h2>Escenas</h2><span className="muted" style={{ fontSize: 11 }}>Una escena es una foto de lo que suena</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
        {SLOTS.map((x) => {
          const sc = s.scenes[x], now = s.sceneNow === x;
          if (!sc) return (
            <button key={x} type="button" className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 10, borderStyle: 'dashed', minHeight: 96 }} onClick={() => session.saveScene(x)}>
              <span className="mono" style={{ fontSize: 11, color: SCENE_COLORS[x] }}>{x}</span>
              <span style={{ fontSize: 12 }}><Icon name="mas" size={12} /> Guardar lo que suena aquí</span>
            </button>
          );
          return (
            <div key={x} className="well" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, outline: now ? `1px solid ${SCENE_COLORS[x]}` : 'none' }}>
              <div className="row" style={{ gap: 6 }}>
                <span className="mono" style={{ width: 20, height: 20, borderRadius: 5, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600, background: SCENE_COLORS[x], color: '#0B0B0C', flex: 'none' }}>{x}</span>
                <input className="input" style={{ flex: 1, minWidth: 0, height: 28 }} value={sc.name} aria-label={`Nombre de la escena ${x}`} onChange={(e) => session.renameScene(x, e.target.value.slice(0, 24))} />
              </div>
              <span className="mono muted" style={{ fontSize: 10 }}>{resumen(sc.data)}</span>
              <div className="row" style={{ gap: 4 }}>
                <button type="button" className="iconbtn" title="Escuchar esta escena" aria-label={`Lanzar ${x}`} onClick={() => session.launchScene(x)}><Icon name="play" size={11} fill="currentColor" /></button>
                <button type="button" className="iconbtn" title="Reemplazar con lo que suena ahora" aria-label={`Actualizar ${x} con lo que suena`} onClick={() => session.saveScene(x)}><Icon name="deshacer" size={13} /></button>
                <button type="button" className="iconbtn" title="Borrar" aria-label={`Borrar ${x}`} onClick={() => session.deleteScene(x)}><Icon name="basura" size={13} /></button>
                <button type="button" className="btn" style={{ marginLeft: 'auto', height: 28 }} onClick={() => add(x)}><Icon name="mas" size={11} />Al arreglo</button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="dim" style={{ margin: 0, fontSize: 11, lineHeight: 1.5 }}>Guarda: dulce, amargo, graves/medios/agudos, densidad, swing, qué pistas suenan, su modo y sus mutaciones. ▶ la escucha; ↺ la reemplaza con lo que suena ahora.</p>
    </section>
  );
}

function Arreglo({ s }) {
  const rows = s.song, saved = SLOTS.filter((x) => s.scenes[x]);
  const upd = (i, patch) => session.setSong(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i, d) => { const a = [...rows]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; session.setSong(a); };
  return (
    <section className="panel" style={{ flex: '999 1 520px' }}>
      <div className="panel-head"><h2>Arreglo</h2>{rows.length > 0 && <button type="button" className="btn" onClick={() => session.setSong([])}>Vaciar</button>}</div>
      {!rows.length && <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>{saved.length ? 'Pulsa una escena de abajo para añadirla. Cada fila dura los compases que elijas.' : 'Primero guarda al menos una escena.'}</p>}
      {rows.map((r, i) => (
        <div key={i} className="row well" style={{ padding: '6px 8px', gap: 8, outline: s.songOn && session.songPos?.row === i ? `1px solid ${SCENE_COLORS[r.scene]}` : 'none' }}>
          <span className="mono muted" style={{ width: 22, fontSize: 11 }}>{String(i + 1).padStart(2, '0')}</span>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: SCENE_COLORS[r.scene], flex: 'none' }} />
          <select className="input" aria-label={`Escena de la fila ${i + 1}`} style={{ flex: 1, minWidth: 0, height: 32 }} value={r.scene} onChange={(e) => upd(i, { scene: e.target.value })}>{saved.map((x) => <option key={x} value={x}>{x} · {s.scenes[x].name}</option>)}</select>
          <label className="row" style={{ gap: 6, fontSize: 12 }}><input type="number" min="1" max="64" className="input mono" style={{ width: 60, height: 32 }} value={r.bars} onChange={(e) => upd(i, { bars: Math.max(1, Math.min(64, +e.target.value || 1)) })} aria-label={`Compases de la fila ${i + 1}`} />comp.</label>
          <button type="button" className="iconbtn" aria-label="Subir fila" onClick={() => move(i, -1)} disabled={i === 0} style={{ transform: 'rotate(180deg)' }}><Icon name="chevron" size={13} /></button>
          <button type="button" className="iconbtn" aria-label="Bajar fila" onClick={() => move(i, 1)} disabled={i === rows.length - 1}><Icon name="chevron" size={13} /></button>
          <button type="button" className="iconbtn" aria-label="Quitar fila" onClick={() => session.setSong(rows.filter((_, j) => j !== i))}><Icon name="x" size={13} /></button>
        </div>
      ))}
      {saved.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="label" style={{ marginRight: 4 }}>Añadir</span>
          {saved.map((x) => <button key={x} type="button" className="btn" style={{ height: 30, borderColor: SCENE_COLORS[x] }} onClick={() => session.setSong([...rows, { scene: x, bars: 4 }])}><span className="mono" style={{ color: SCENE_COLORS[x], fontWeight: 600 }}>{x}</span>{s.scenes[x].name}</button>)}
        </div>
      )}
    </section>
  );
}

export default function Cancion() {
  const s = useS(), [ask, setAsk] = useState(false), saved = SLOTS.filter((x) => s.scenes[x]);
  const rows = s.song, playable = rows.some((r) => s.scenes[r.scene]), total = rows.reduce((a, r) => a + r.bars, 0), secs = Math.round(total * 16 * session.ko.stepMs / 1000);
  if (!session.can('cancion')) return (
    <div className="page">
      <div className="page-head"><div><h1 className="row" style={{ gap: 10 }}>Canción <span className="badge-pro">PRO</span></h1><p>Ordena escenas en el tiempo: intro, subida, caída. La mosca toca la canción completa y cambia de escena al compás.</p></div></div>
      <Paywall feature="cancion">En Free tienes 2 escenas (A y B) para lanzar a mano desde el Estudio. Pro abre 8 escenas y el modo canción con transiciones suaves.</Paywall>
    </div>
  );
  const example = () => { if (['A', 'B', 'C', 'D'].some((x) => s.scenes[x]) && !ask) { setAsk(true); return; } setAsk(false); session.makeExampleSong(); };
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Canción</h1><p>Guarda escenas, ordénalas y toca. Al pasar de una fila a la siguiente, lo que siente la mosca cambia {s.morph ? 'en una transición suave de un compás' : 'en seco, al inicio del compás'}.</p></div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Seg label="Transición" items={[['suave', 'Suave'], ['corte', 'Corte']]} value={s.morph ? 'suave' : 'corte'} onChange={(v) => session.set({ morph: v === 'suave' }, true)} />
          <Seg label="Repetir" items={[['loop', 'En bucle'], ['una', 'Una vez']]} value={s.songLoop ? 'loop' : 'una'} onChange={(v) => session.set({ songLoop: v === 'loop' }, true)} />
          {s.songOn ? <button type="button" className="btn lg primary" onClick={() => { session.stopSong(); session.stop(); }}><Icon name="stop" size={12} fill="currentColor" />Detener la canción</button>
            : <button type="button" className="btn lg acc" disabled={!playable} title={playable ? '' : 'Añade al menos una escena al arreglo'} onClick={() => session.startSong()}><Icon name="play" size={12} fill="currentColor" />Tocar la canción</button>}
        </div>
      </div>

      <Timeline s={s} />
      <p className="mono muted" style={{ margin: 0, fontSize: 11 }}>{rows.length} FILAS · {total} COMPASES · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')} A {Math.round(session.ko.bpm)} BPM{s.songOn ? ' · SONANDO' : ''}</p>

      {(!saved.length || !playable) && (
        <div className="cols" style={{ alignItems: 'stretch' }}>
          <Step n="1" title="Guarda escenas" done={saved.length > 0}>
            <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>Ajusta lo que suena (aquí abajo o en el Estudio) y guárdalo en una casilla. Repite con otra sensación.</p>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {session.freeSlot && <button type="button" className="btn primary" onClick={() => session.saveScene(session.freeSlot)}>Guardar lo que suena como {session.freeSlot}</button>}
              <button type="button" className={`btn ${ask ? 'acc' : ''}`} onClick={example}>{ask ? '¿Reemplazar A–D? Sí, crear' : 'Crear canción de ejemplo'}</button>
              {ask && <button type="button" className="btn" onClick={() => setAsk(false)}>Cancelar</button>}
            </div>
          </Step>
          <Step n="2" title="Ordénalas" done={playable}><p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>En el Arreglo, pulsa una escena para añadirla como fila y elige cuántos compases dura.</p></Step>
          <Step n="3" title="Toca la canción" done={s.songOn}><p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>La mosca recorre las filas y cambia de escena al compás. Grábala desde Tomas con el punto rojo.</p></Step>
        </div>
      )}

      <div className="cols" style={{ alignItems: 'stretch' }}>
        <Arreglo s={s} />
        <Ahora s={s} />
      </div>
      <Escenas s={s} />
      {saved.length > 0 && playable && <div className="row" style={{ gap: 6 }}><button type="button" className={`btn ${ask ? 'acc' : ''}`} onClick={example}>{ask ? '¿Reemplazar A–D? Sí, crear' : 'Crear canción de ejemplo'}</button>{ask && <button type="button" className="btn" onClick={() => setAsk(false)}>Cancelar</button>}</div>}
    </div>
  );
}
