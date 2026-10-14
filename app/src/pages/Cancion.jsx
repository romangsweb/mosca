import { session } from '../engine/session.js';
import { SLOTS, SCENE_COLORS } from '../engine/song.js';
import { useS, useTick, Icon, Seg } from '../ui/kit.jsx';
import { Paywall } from '../ui/Paywall.jsx';

function Timeline({ s }) {
  useTick(15);
  const rows = s.song, total = rows.reduce((a, r) => a + r.bars, 0) || 1, pos = session.songPos, L = session.live;
  let before = 0; if (s.songOn && pos) for (let i = 0; i < pos.row; i++) before += rows[i]?.bars || 0;
  const head = s.songOn && pos ? (before + Math.max(0, pos.bars) + (s.playing ? (L.step % 16) / 16 : 0)) / total : null;
  return (
    <div style={{ position: 'relative', height: 64, borderRadius: 10, background: 'var(--screen)', display: 'flex', overflow: 'hidden', padding: 6, gap: 3 }} role="img" aria-label="Línea de tiempo de la canción">
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

export default function Cancion() {
  const s = useS(), saved = SLOTS.filter((x) => s.scenes[x]);
  const rows = s.song, total = rows.reduce((a, r) => a + r.bars, 0), secs = Math.round(total * 16 * session.ko.stepMs / 1000);
  const upd = (i, patch) => session.setSong(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i, d) => { const a = [...rows]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; session.setSong(a); };
  if (!session.can('cancion')) return (
    <div className="page">
      <div className="page-head"><div><h1 className="row" style={{ gap: 10 }}>Canción <span className="badge-pro">PRO</span></h1><p>Ordena escenas en el tiempo: intro, subida, caída. La mosca toca la canción completa y cambia de escena al compás.</p></div></div>
      <Paywall feature="cancion">En Free tienes 2 escenas (A y B) para lanzar a mano desde el Estudio. Pro abre 8 escenas y el modo canción con transiciones suaves.</Paywall>
    </div>
  );
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Canción</h1><p>Guarda escenas en el Estudio (lo que la mosca siente y cómo suena) y ordénalas aquí. Cada fila dura los compases que elijas; al pasar a la siguiente, los estímulos cambian {s.morph ? 'en una transición suave de un compás' : 'en seco, al inicio del compás'}.</p></div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Seg label="Transición" items={[['suave', 'Suave'], ['corte', 'Corte']]} value={s.morph ? 'suave' : 'corte'} onChange={(v) => session.set({ morph: v === 'suave' }, true)} />
          <Seg label="Repetir" items={[['loop', 'En bucle'], ['una', 'Una vez']]} value={s.songLoop ? 'loop' : 'una'} onChange={(v) => session.set({ songLoop: v === 'loop' }, true)} />
          {s.songOn ? <button type="button" className="btn lg primary" onClick={() => session.stopSong()}><Icon name="stop" size={12} fill="currentColor" />Salir del modo canción</button>
            : <button type="button" className="btn lg acc" disabled={!rows.some((r) => s.scenes[r.scene])} onClick={() => session.startSong()}><Icon name="play" size={12} fill="currentColor" />Tocar la canción</button>}
        </div>
      </div>

      <Timeline s={s} />
      <p className="mono muted" style={{ margin: 0, fontSize: 11 }}>{rows.length} FILAS · {total} COMPASES · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')} A {Math.round(session.ko.bpm)} BPM{s.songOn ? ' · SONANDO' : ''}</p>

      <div className="cols">
        <section className="panel" style={{ flex: '999 1 520px' }}>
          <div className="panel-head"><h2>Arreglo</h2><button type="button" className="btn" disabled={!saved.length} onClick={() => session.setSong([...rows, { scene: saved[0], bars: 4 }])}><Icon name="mas" size={13} />Añadir fila</button></div>
          {!saved.length && <p className="muted" style={{ margin: 0 }}>Primero guarda al menos una escena en el Estudio: ajusta dulce, amargo, pistas y mutaciones, y pulsa una casilla vacía de la tira «Escenas».</p>}
          {rows.map((r, i) => (
            <div key={i} className="row well" style={{ padding: '6px 8px', gap: 8, outline: s.songOn && session.songPos?.row === i ? `1px solid ${SCENE_COLORS[r.scene]}` : 'none' }}>
              <span className="mono muted" style={{ width: 22, fontSize: 11 }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: SCENE_COLORS[r.scene] }} />
              <select className="input" aria-label={`Escena de la fila ${i + 1}`} style={{ flex: 1, height: 32 }} value={r.scene} onChange={(e) => upd(i, { scene: e.target.value })}>{saved.map((x) => <option key={x} value={x}>{x} · {s.scenes[x].name}</option>)}</select>
              <label className="row" style={{ gap: 6, fontSize: 12 }}><input type="number" min="1" max="64" className="input mono" style={{ width: 64, height: 32 }} value={r.bars} onChange={(e) => upd(i, { bars: Math.max(1, Math.min(64, +e.target.value || 1)) })} aria-label={`Compases de la fila ${i + 1}`} />compases</label>
              <button type="button" className="iconbtn" aria-label="Subir fila" onClick={() => move(i, -1)} disabled={i === 0} style={{ transform: 'rotate(180deg)' }}><Icon name="chevron" size={13} /></button>
              <button type="button" className="iconbtn" aria-label="Bajar fila" onClick={() => move(i, 1)} disabled={i === rows.length - 1}><Icon name="chevron" size={13} /></button>
              <button type="button" className="iconbtn" aria-label="Quitar fila" onClick={() => session.setSong(rows.filter((_, j) => j !== i))}><Icon name="x" size={13} /></button>
            </div>
          ))}
        </section>
        <section className="panel" style={{ flex: '1 1 300px' }}>
          <h2>Escenas guardadas</h2>
          {!saved.length && <p className="muted" style={{ margin: 0, fontSize: 12 }}>Aún no hay escenas.</p>}
          {saved.map((x) => (
            <div key={x} className="row" style={{ gap: 8 }}>
              <span className="mono" style={{ width: 20, height: 20, borderRadius: 5, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600, background: SCENE_COLORS[x], color: '#0B0B0C' }}>{x}</span>
              <input className="input" style={{ flex: 1, height: 32 }} value={s.scenes[x].name} aria-label={`Nombre de la escena ${x}`} onChange={(e) => session.renameScene(x, e.target.value.slice(0, 24))} />
              <button type="button" className="iconbtn" aria-label={`Lanzar ${x}`} onClick={() => session.launchScene(x)}><Icon name="play" size={11} fill="currentColor" /></button>
              <button type="button" className="iconbtn" aria-label={`Borrar ${x}`} onClick={() => session.deleteScene(x)}><Icon name="basura" size={13} /></button>
            </div>
          ))}
          <p className="dim" style={{ margin: 0, fontSize: 11, lineHeight: 1.5 }}>Una escena guarda: dulce, amargo, graves/medios/agudos, densidad, swing, qué pistas suenan, su modo y sus mutaciones.</p>
        </section>
      </div>
    </div>
  );
}
