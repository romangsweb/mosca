import { useState } from 'react';
import { session } from '../engine/session.js';
import { CHARLA_DEFAULT, EXPR_DEFAULT, EXPR_SOURCES, EXPR_DESTS, GROUPS, noteToPad, padKey } from '../engine/ko.js';
import { SENSES, SENSE_LABEL } from '../engine/session.js';
import { session as S2, CIRCUITS, EXTRA_TRACKS, MAX_TRACKS } from '../engine/session.js';
import { TARGETS, targetById, srcLabel } from '../engine/controls.js';
import KoTwin from '../ui/KoTwin.jsx';
import { useS, useTick, Icon, Seg } from '../ui/kit.jsx';

// K.O. II a fondo: conversación (tu K.O. toca a la mosca), expresión (la mosca mueve pitch, vibrato y efectos),
// melodías con tus samples y mandar una toma al secuenciador del K.O.
function Turno() {
  useTick(15); const t = session.live.turno, on = session.s.playing;
  return (
    <div className="row" style={{ gap: 8 }} aria-live="polite">
      {['tu', 'mosca'].map((k) => <span key={k} className="mono" style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, letterSpacing: '.08em', background: on && t === k ? (k === 'tu' ? 'var(--text)' : 'var(--acc)') : 'var(--well)', color: on && t === k ? 'var(--bg)' : 'var(--dim)', transition: 'background .1s' }}>{k === 'tu' ? 'TOCAS TÚ' : 'CONTESTA LA MOSCA'}</span>)}
    </div>
  );
}
function Lane({ l, i, set }) {
  useTick(12); const v = session.kolink.cc[l.dest] ?? 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1.2fr) minmax(150px, 1fr) 90px 54px', gap: 8, alignItems: 'center', fontSize: 12 }}>
      <span>{EXPR_DESTS.find(([d]) => d === l.dest)?.[1]}</span>
      <select className="input" style={{ height: 30, fontSize: 12 }} aria-label="Fuente" value={l.src} onChange={(e) => set(i, { src: e.target.value })}>{EXPR_SOURCES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
      <input type="range" min={0} max={100} value={Math.round(l.depth * 100)} aria-label="Cantidad" onChange={(e) => set(i, { depth: +e.target.value / 100 })} style={{ accentColor: 'var(--acc)' }} />
      <div aria-hidden="true" style={{ height: 6, borderRadius: 3, background: 'var(--line)' }}><div style={{ width: `${Math.min(1, v) * 100}%`, maxWidth: '100%', height: '100%', borderRadius: 3, background: 'var(--acc)' }} /></div>
    </div>
  );
}

// qué pista toca cada grupo del K.O. (y arreglarlo con un clic)
function Grupos() {
  const s = useS();
  return (
    <section className="panel" style={{ gap: 8 }} aria-label="Grupos del K.O.">
      <h2 style={{ fontSize: 15 }}>Grupos del K.O. → pistas de la mosca</h2>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>Cada grupo del K.O. habla con la pista que usa ese grupo. Si un grupo no tiene pista, sus pads estimulan a la pista elegida en el Estudio.</p>
      {GROUPS.map((G) => {
        const t = s.tracks.find((x) => x.group === G), slot = EXTRA_TRACKS.find((x) => x.group === G), on = t && S2.audible(t);
        return (
          <div key={G} className="row" style={{ gap: 10, fontSize: 12.5, padding: '6px 0', borderTop: '1px solid var(--line)' }}>
            <span className="mono" style={{ width: 28, height: 28, borderRadius: 7, display: 'grid', placeItems: 'center', background: on ? 'var(--acc)' : 'var(--well)', color: on ? '#0B0B0C' : 'var(--sub)', fontWeight: 700 }}>{G}</span>
            <span style={{ flex: 1 }}>{t ? <>{t.name} <span className="dim">· {CIRCUITS[t.sense]?.name}</span>{!on && <span style={{ color: '#FF8A4D' }}> · {s.tracks.indexOf(t) >= S2.trackLimit ? 'Pro: no suena' : 'silenciada'}</span>}</> : <span className="dim">sin pista → toca a «{S2.track().name}»</span>}</span>
            {t && !on && s.tracks.indexOf(t) < S2.trackLimit && <button type="button" className="btn" style={{ height: 28 }} onClick={() => S2.setTrack(t.id, { mute: false, solo: false })}>Activar</button>}
            {!t && slot && s.tracks.length < MAX_TRACKS && <button type="button" className="btn" style={{ height: 28 }} onClick={() => S2.addTrack()}>Crear pista{s.tracks.length >= S2.trackLimit && <span className="badge-pro">PRO</span>}</button>}
          </div>
        );
      })}
    </section>
  );
}
// pads a elección: cada pad del K.O. puede estimular la neurona que quieras (o dar un golpe a un sentido)
const KLABEL = ['.', '0', 'ENT', '1', '2', '3', '4', '5', '6', '7', '8', '9'], KLAYOUT = [[9, 10, 11], [6, 7, 8], [3, 4, 5], [0, 1, 2]];
function PadsElegidos() {
  const s = useS(); useTick(8);
  const c = { ...CHARLA_DEFAULT, ...s.charla }, map = c.pads || {}, [group, setGroup] = useState(S2.track().group || 'C'), [sel, setSel] = useState(null), seen = useState({ at: 0 })[0];
  // tocar un pad en el K.O. lo elige aquí
  const last = session.kolink.inLog.at(-1); if (last?.group && !last.manual && last.at > seen.at) { seen.at = last.at; if (last.group !== group) setTimeout(() => setGroup(last.group)); setTimeout(() => setSel(last.off)); }
  const D = S2.D, opts = Object.entries(D?.modos || {}).map(([m, md]) => [m, md.pads.map((p) => [`n:${p.idx}`, p.tipo])]);
  const name = (v) => (!v ? null : v.startsWith('s:') ? SENSE_LABEL[v.slice(2)] : (D?.modos && Object.values(D.modos).flatMap((m) => m.pads).find((p) => p.idx === +v.slice(2))?.tipo) || 'neurona');
  const set = (v) => { const pads = { ...map }; if (v) pads[padKey(group, sel)] = v; else delete pads[padKey(group, sel)]; S2.set({ charla: { ...c, pads } }, true); };
  const n = Object.keys(map).length;
  return (
    <section className="panel" style={{ gap: 10 }} aria-label="Pads a elección">
      <div className="between"><h2 style={{ fontSize: 15 }}>Pads a elección</h2>{n > 0 && <button type="button" className="btn" style={{ height: 28 }} onClick={() => S2.set({ charla: { ...c, pads: {} } }, true)}>Quitar las {n}</button>}</div>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>Elige qué neurona dispara cada pad de tu K.O.: por ejemplo un pad para la fibra gigante (huida) y otro para MN9 (comer). Toca un pad en el K.O. o aquí para elegirlo.</p>
      <div className="row" style={{ gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Seg label="Grupo" items={GROUPS.map((g) => [g, g])} value={group} onChange={(g) => { setGroup(g); setSel(null); }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 58px)', gap: 6 }}>
            {KLAYOUT.flat().map((off) => { const v = map[padKey(group, off)], on = sel === off, hot = performance.now() - (session.kolink.inLog.filter((e) => e.group === group && e.off === off).at(-1)?.at || 0) < 200;
              return <button key={off} type="button" onClick={() => setSel(off)} style={{ height: 50, borderRadius: 9, border: `2px solid ${on ? 'var(--acc)' : 'transparent'}`, background: v ? 'color-mix(in srgb, var(--acc) 30%, var(--well))' : 'var(--well)', color: 'var(--text)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, boxShadow: hot ? '0 0 0 3px #ECECEE' : 'none', transition: 'box-shadow .08s' }}>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{KLABEL[off]}</span><span style={{ fontSize: 9, color: 'var(--sub)', maxWidth: 54, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name(v) || 'su pad'}</span></button>; })}
          </div>
        </div>
        <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sel == null ? <span className="dim" style={{ fontSize: 12 }}>Elige un pad.</span> : <>
            <span style={{ fontSize: 13 }}>Pad <b className="mono">{KLABEL[sel]}</b> del grupo <b>{group}</b> estimula:</span>
            <select className="input" style={{ height: 32 }} value={map[padKey(group, sel)] || ''} onChange={(e) => set(e.target.value)} aria-label="Qué estimula este pad">
              <option value="">Por defecto: la neurona de su pad en la pista</option>
              <optgroup label="Un golpe a un sentido">{Object.values(SENSES).flat().map((k) => <option key={k} value={`s:${k}`}>{SENSE_LABEL[k]}</option>)}</optgroup>
              {opts.map(([m, list]) => <optgroup key={m} label={`Neuronas · ${CIRCUITS[m]?.name || m}`}>{list.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</optgroup>)}
            </select>
            <span className="dim" style={{ fontSize: 11 }}>Las neuronas de otros circuitos también existen en este cerebro: un pad puede tocar el cortejo aunque la pista sea de gusto. Solo suena lo que dispare en pistas que suenan.</span>
          </>}
        </div>
      </div>
    </section>
  );
}
// monitor MIDI: qué manda cada botón, perilla o pad, y a qué está conectado; lo que no hace nada se asigna aquí mismo
function Monitor() {
  const s = useS(); useTick(6);
  const rows = session.kolink.mon.slice(0, 10), groups = [...new Set(TARGETS.map((t) => t.group))];
  const what = (m) => {
    const map = s.mappings.find((x) => x.src.type === m.type && x.src.ch === m.ch && x.src.num === m.num && (!x.src.port || !m.port || x.src.port === m.port));
    if (map) return `→ ${targetById(map.target)?.label}`;
    if (m.type === 'note') { const p = noteToPad(m.num); if (p && s.charla?.on !== false) { const t = s.tracks.find((x) => x.group === p.group && S2.audible(x)) || S2.track(); return `→ conversación: pad ${['.', '0', 'ENT', '1', '2', '3', '4', '5', '6', '7', '8', '9'][p.off]} de ${t.name}`; } }
    return null;
  };
  const assign = (m, target) => { const src = { type: m.type, ch: m.ch, num: m.num, port: m.port }; if (S2.mappingsFull) { location.hash = '#/cuenta?plan'; return; } S2.set({ mappings: [...s.mappings.filter((x) => x.target !== target), { target, src }] }, true); };
  return (
    <section className="panel" style={{ gap: 8 }} aria-label="Monitor MIDI">
      <div className="between"><h2 style={{ fontSize: 15 }}>Monitor: lo que manda tu K.O.</h2><span className="mono dim" style={{ fontSize: 10 }}>{rows.length ? 'EN VIVO' : 'TOCA ALGO EN EL K.O.'}</span></div>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>Mueve una perilla, el fader o toca un botón del K.O. Si manda algo que no hace nada, asígnalo aquí: por ejemplo el fader a «Intensidad» o un botón a «Mutar pista».</p>
      {rows.map((m, i) => { const w = what(m); return (
        <div key={`${m.at}-${i}`} className="row" style={{ gap: 8, fontSize: 11.5, opacity: Math.max(0.45, 1 - i * 0.06) }}>
          <span className="mono" style={{ width: 150, flex: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{srcLabel({ type: m.type, ch: m.ch, num: m.num })}{m.type !== 'pb' ? ` = ${m.val}` : ''}</span>
          <span style={{ flex: 1, minWidth: 0, color: w ? 'var(--acc)' : 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w || 'no hace nada'}</span>
          {!w && <select className="input" style={{ height: 26, fontSize: 11, width: 170 }} value="" aria-label="Asignar a" onChange={(e) => e.target.value && assign(m, e.target.value)}>
            <option value="">Asignar a…</option>{groups.map((g) => <optgroup key={g} label={g}>{TARGETS.filter((t) => t.group === g && (t.kind === 'trigger' || m.type !== 'note')).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</optgroup>)}
          </select>}
        </div>
      ); })}
    </section>
  );
}

export default function KO() {
  const s = useS(), [take, setTake] = useState(s.lastTake || s.takes[0]?.id), [sending, setSending] = useState(false);
  const c = { ...CHARLA_DEFAULT, ...s.charla }, e = { ...EXPR_DEFAULT, ...(s.expr || {}), on: s.expr ? s.expr.on : !!s.fxAuto };
  const setC = (p) => session.set({ charla: { ...c, ...p } }, true), setE = (p) => session.set({ expr: { ...e, ...p } }, true);
  const setLane = (i, p) => setE({ lanes: e.lanes.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const port = s.ko?.output, mel = s.tracks.filter((t) => t.mode === 'melodia');
  const tk = s.takes.find((t) => t.id === take);
  const send = async () => { if (!tk) return; setSending(true); const full = tk.events ? tk : await session.ensureEvents(tk.id); session.sendTakeToKO(full, () => setSending(false)); };
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>K.O. II</h1><p>Tu K.O. y la mosca, en los dos sentidos: lo que tocas en el K.O. estimula su cerebro, y ella le contesta con sus pads, su pitch y sus efectos.</p></div>
        <div className="row">
          <span className={`chip${port ? ' acc' : ''}`}>{port ? `CONECTADO · ${port}` : 'K.O. NO DETECTADO'}</span>
          {!port && <button type="button" className="btn lg" onClick={() => session.connect()}>Permitir MIDI</button>}
          <button type="button" className="btn lg acc" onClick={() => session.toggle()}><Icon name={s.playing ? 'stop' : 'play'} size={12} fill="currentColor" />{s.playing ? 'Detener' : 'Tocar'}</button>
        </div>
      </div>
      <div className="cols" style={{ alignItems: 'stretch' }}>
        <section className="panel" style={{ flex: '0 1 360px', alignItems: 'center', gap: 10, background: 'var(--screen)' }} aria-label="K.O. II en pantalla">
          <KoTwin />
          <div className="row mono" style={{ gap: 14, fontSize: 10, color: '#8C8C94' }}><span className="row" style={{ gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 2, background: '#FF6A1A' }} />TOCA LA MOSCA</span><span className="row" style={{ gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 2, border: '2px solid #ECECEE' }} />TOCAS TÚ</span></div>
          <span style={{ fontSize: 11, color: '#77777F', textAlign: 'center' }}>Toca un pad aquí y suena en tu K.O.; la mosca lo siente igual que si lo tocaras en el aparato.</span>
        </section>
        <section className="panel" style={{ flex: '1 1 420px', gap: 12 }} aria-label="Conversación">
          <div className="between"><h2 className="row" style={{ gap: 8, fontSize: 15 }}><Icon name="oido" size={16} />Conversación: el K.O. toca a la mosca</h2>
            <input type="checkbox" checked={c.on} onChange={(ev) => setC({ on: ev.target.checked })} aria-label="Encender conversación" style={{ width: 18, height: 18, accentColor: 'var(--acc)' }} /></div>
          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>Cada pad que tocas en el K.O. (o que toca su secuenciador) estimula a la mosca: el pad 5 del grupo C empuja a la neurona del pad 5 de la pista en el grupo C. Ella contesta con lo que su cerebro decide.</p>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <Seg label="Modo" items={[['vivo', 'A la vez'], ['pregunta', 'Llamada y respuesta']]} value={c.modo} onChange={(v) => setC({ modo: v })} />
            <Seg label="Qué estimula" items={[['neurona', 'La neurona del pad'], ['sentido', 'Un sentido']]} value={c.destino} onChange={(v) => setC({ destino: v })} />
          </div>
          <div className="row" style={{ gap: 10, fontSize: 12 }}>Golpe flojo / fuerte<Seg label="Curva de fuerza" items={[['suave', 'Suave'], ['lineal', 'Lineal'], ['dura', 'Dura']]} value={c.curva || 'lineal'} onChange={(v) => setC({ curva: v })} /><span className="dim" style={{ fontSize: 11 }}>Suave: los golpes flojos ya cuentan · Dura: solo los fuertes</span></div>
          <label className="row" style={{ gap: 10, fontSize: 12 }}>Fuerza<input type="range" min={0} max={100} value={Math.round(c.fuerza * 100)} onChange={(ev) => setC({ fuerza: +ev.target.value / 100 })} style={{ flex: 1, accentColor: 'var(--acc)' }} /><span className="mono" style={{ width: 40 }}>{Math.round(c.fuerza * 100)}%</span></label>
          {c.modo === 'pregunta' && <>
            <Turno />
            <label className="row" style={{ gap: 8, fontSize: 12 }}><input type="checkbox" checked={c.eco} onChange={(ev) => setC({ eco: ev.target.checked })} style={{ accentColor: 'var(--acc)' }} />Eco: al contestar, la mosca vuelve a sentir tu frase (sale transformada por su cerebro)</label>
            <p className="dim" style={{ margin: 0, fontSize: 11.5 }}>Un compás tocas tú y la mosca solo escucha; el siguiente contesta ella. Funciona mejor con el K.O. siguiendo el reloj de Fly Punch o al revés (Sonido › MIDI y reloj).</p>
          </>}
          <p className="dim" style={{ margin: 0, fontSize: 11.5 }}>El K.O. manda MIDI por canal 1 de fábrica. Si no llega nada, revisa en el K.O.: SHIFT + SYSTEM → MIDI (110 = recibe todo, manda por canal 1).</p>
        </section>
      </div>
      <PadsElegidos />
      <div className="cols" style={{ alignItems: 'stretch' }}><div style={{ flex: '1 1 380px' }}><Grupos /></div><div style={{ flex: '1 1 460px' }}><Monitor /></div></div>
      <section className="panel" style={{ gap: 12 }} aria-label="Expresión neuronal">
        <div className="between"><h2 className="row" style={{ gap: 8, fontSize: 15 }}><Icon name="mezcla" size={16} />Expresión: la mosca mueve tu K.O.</h2>
          <input type="checkbox" checked={e.on} onChange={(ev) => setE({ on: ev.target.checked })} aria-label="Encender expresión" style={{ width: 18, height: 18, accentColor: 'var(--acc)' }} /></div>
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Elige qué neurona mueve cada control del K.O. mientras toca: las perillas X/Y del efecto que tengas activo, el pitch (se hunde con la actividad), el vibrato y el sustain. Pide OS 2.5 o mayor para X/Y y sustain.</p>
        {e.lanes.map((l, i) => <Lane key={l.dest} l={l} i={i} set={setLane} />)}
        <p className="dim" style={{ margin: 0, fontSize: 11 }}>Ejemplo: Fibra gigante → Pitch: cada vez que la mosca «huye» (Visión), el K.O. se desafina hacia abajo. Al detener, el pitch vuelve al centro.</p>
      </section>
      <div className="cols" style={{ alignItems: 'stretch' }}>
        <section className="panel" style={{ flex: '1 1 380px', gap: 10 }} aria-label="Melodías con tus samples">
          <h2 className="row" style={{ gap: 8, fontSize: 15 }}><Icon name="nota" size={16} />Melodías con tus samples</h2>
          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>Una pista en Melodía puede tocar un sonido de tu K.O. como teclado: bajos, leads o acordes con tus propios samples.</p>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>
            <li>En el K.O., elige el pad con el sonido y entra a SHIFT + SOUND, página MIDI: ponle un canal (por ejemplo 2).</li>
            <li>Aquí, pon ese mismo canal en la pista que está en Melodía.</li>
            <li>Si no suena cromático, presiona KEYS en el K.O. con ese pad elegido.</li>
          </ol>
          {mel.length ? mel.map((t) => (
            <label key={t.id} className="row" style={{ gap: 10, fontSize: 12.5 }}><span style={{ flex: 1 }}>{t.name} · Melodía</span>Canal
              <select className="input" style={{ height: 30, width: 80 }} value={t.melCh || t.ch || 1} onChange={(ev) => session.setTrack(t.id, { melCh: +ev.target.value })}>{Array.from({ length: 16 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>
          )) : <span className="dim" style={{ fontSize: 12 }}>Ninguna pista está en Melodía. Cámbiala en el Estudio (Pads › Melodía).</span>}
        </section>
        <section className="panel" style={{ flex: '1 1 380px', gap: 10 }} aria-label="Mandar una toma al K.O.">
          <h2 className="row" style={{ gap: 8, fontSize: 15 }}><Icon name="subir" size={16} />Mandar una toma al K.O. <span className="chip">BETA</span></h2>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>
            <li>En el K.O.: SHIFT + SYSTEM → reloj en «entrada» (101).</li>
            <li>Pon el K.O. a grabar (REC) en un patrón vacío; esperará el reloj.</li>
            <li>Aquí, elige la toma y pulsa «Mandar»: Fly Punch arranca el reloj y toca la toma hacia el K.O.</li>
          </ol>
          <select className="input" style={{ height: 32 }} value={take || ''} onChange={(ev) => setTake(ev.target.value)} aria-label="Toma">{s.takes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <button type="button" className="btn lg primary" disabled={!tk || sending || !port} onClick={send}>{sending ? 'Mandando…' : port ? 'Mandar al K.O.' : 'Conecta el K.O.'}</button>
          <p className="dim" style={{ margin: 0, fontSize: 11 }}>La guía del K.O. no confirma que grabe notas que llegan por MIDI. Pruébalo y dinos si quedó en el patrón.</p>
        </section>
      </div>
    </div>
  );
}
