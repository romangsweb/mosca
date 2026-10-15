import { useState } from 'react';
import { session } from '../engine/session.js';
import { CHARLA_DEFAULT, EXPR_DEFAULT, EXPR_SOURCES, EXPR_DESTS } from '../engine/ko.js';
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
          <label className="row" style={{ gap: 10, fontSize: 12 }}>Fuerza<input type="range" min={0} max={100} value={Math.round(c.fuerza * 100)} onChange={(ev) => setC({ fuerza: +ev.target.value / 100 })} style={{ flex: 1, accentColor: 'var(--acc)' }} /><span className="mono" style={{ width: 40 }}>{Math.round(c.fuerza * 100)}%</span></label>
          {c.modo === 'pregunta' && <>
            <Turno />
            <label className="row" style={{ gap: 8, fontSize: 12 }}><input type="checkbox" checked={c.eco} onChange={(ev) => setC({ eco: ev.target.checked })} style={{ accentColor: 'var(--acc)' }} />Eco: al contestar, la mosca vuelve a sentir tu frase (sale transformada por su cerebro)</label>
            <p className="dim" style={{ margin: 0, fontSize: 11.5 }}>Un compás tocas tú y la mosca solo escucha; el siguiente contesta ella. Funciona mejor con el K.O. siguiendo el reloj de Fly Punch o al revés (Sonido › MIDI y reloj).</p>
          </>}
          <p className="dim" style={{ margin: 0, fontSize: 11.5 }}>El K.O. manda MIDI por canal 1 de fábrica. Si no llega nada, revisa en el K.O.: SHIFT + SYSTEM → MIDI (110 = recibe todo, manda por canal 1).</p>
        </section>
      </div>
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
