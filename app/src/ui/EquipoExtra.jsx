import { useEffect, useState } from 'react';
import { session } from '../engine/session.js';
import { TARGETS, srcLabel, FREE_MAPPINGS } from '../engine/controls.js';
import { audioInputs, rawConstraints } from '../engine/capture.js';
import { useS, useTick, Icon } from './kit.jsx';

const ProNote = ({ feature, children }) => (
  <div className="well" style={{ padding: 12, fontSize: 12.5, lineHeight: 1.5, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
    <span className="badge-pro">PRO</span><span style={{ flex: 1, minWidth: 200 }}>{children}</span>
    <a href="#/cuenta?plan" className="btn acc">{session.canTrial ? 'Probar 7 días gratis' : 'Ver planes'}</a>
  </div>
);

// ---------- aprender controles ----------
export function Controles() {
  const s = useS(); useTick(10);
  const msg = session.live.lastMsg, fresh = msg && performance.now() - msg.at < 1500, groups = [...new Set(TARGETS.map((t) => t.group))];
  const full = session.mappingsFull, ins = session.ko.ports().inputs, raw = session.live.lastRaw && performance.now() - session.live.lastRaw.at < 4000 ? session.live.lastRaw : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cols" style={{ alignItems: 'stretch' }}>
        <p className="muted" style={{ margin: 0, flex: '999 1 420px', lineHeight: 1.55 }}>Usa el sidekick, el K.O. II o cualquier controlador MIDI para mover Fly Punch. Pulsa <strong style={{ color: 'var(--text)' }}>Aprender</strong> junto a un control y mueve la perilla, el fader o el pad del aparato: queda asignado. Los rangos (dulce, densidad…) necesitan una perilla o fader; las acciones aceptan también pads y teclas.</p>
        <div className="panel" style={{ flex: '1 1 280px', gap: 6, padding: 12, background: 'var(--screen)', color: '#ECECEE' }}>
          <span className="label" style={{ color: '#77777F' }}>Último mensaje recibido</span>
          <span className="mono" style={{ fontSize: 13, color: fresh ? '#FF6A1A' : '#8C8C94', transition: 'color .3s' }}>{msg ? srcLabel(msg) + ` · valor ${msg.val}` : session.ko.access ? 'Mueve algo en tu controlador…' : 'Permite MIDI para escuchar tus aparatos'}</span>
          {!session.ko.access && <button type="button" className="btn" style={{ alignSelf: 'flex-start', color: '#ECECEE', borderColor: 'rgba(255,255,255,.14)' }} onClick={() => session.connect()}>Permitir MIDI</button>}
          {raw && <span className="mono" style={{ fontSize: 10, color: '#77777F' }}>crudo: {raw.bytes.map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ')} · {raw.port}</span>}
          {session.ko.access && <span className="mono" style={{ fontSize: 10, color: '#77777F', lineHeight: 1.5 }}>Entradas MIDI que ve el navegador: {ins.length ? ins.join(' · ') : 'ninguna'}</span>}
        </div>
      </div>
      {full && <ProNote feature="controles">En Free puedes asignar {FREE_MAPPINGS} controles. Pro no tiene límite.</ProNote>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
        {groups.map((g) => (
          <section key={g} className="panel" style={{ gap: 6 }}>
            <h2>{g}</h2>
            {TARGETS.filter((t) => t.group === g).map((t) => {
              const m = s.mappings.find((x) => x.target === t.id), learning = s.learn === t.id;
              return (
                <div key={t.id} className="row" style={{ gap: 8, padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                  <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontSize: 13 }}>{t.label}{t.kind === 'range' && <span className="mono dim" style={{ fontSize: 10, marginLeft: 6 }}>{t.get(session)}</span>}</span>
                    <span className="mono muted" style={{ display: 'block', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{learning ? (t.kind === 'range' ? 'Mueve una perilla o fader…' : 'Toca un pad, tecla o botón…') : m ? srcLabel(m.src) : 'Sin asignar'}</span></span>
                  {m && !learning && <button type="button" className="iconbtn" aria-label={`Quitar control de ${t.label}`} onClick={() => session.unmap(t.id)}><Icon name="x" size={12} /></button>}
                  <button type="button" className={`btn ${learning ? 'acc' : ''}`} style={{ minWidth: 92 }} onClick={() => session.learn(t.id)}>{learning ? 'Escuchando…' : m ? 'Reasignar' : 'Aprender'}</button>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

// ---------- entrada de audio (grabar el sonido real) ----------
export function AudioIn() {
  const s = useS(), [inputs, setInputs] = useState([]), [level, setLevel] = useState(0), [err, setErr] = useState(null), pro = session.can('audio');
  const refresh = async () => setInputs(await audioInputs());
  const named = inputs.length > 0 && !inputs.every((d) => /^Entrada \d/.test(d.label)), hasSk = inputs.some((d) => /side|ep-?136|k\.?o/i.test(d.label));
  const scan = async () => { try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); st.getTracks().forEach((t) => t.stop()); } catch { setErr('El navegador no dio permiso de micrófono. Actívalo en el candado de la barra de direcciones.'); } refresh(); };
  useEffect(() => { refresh(); navigator.mediaDevices?.addEventListener?.('devicechange', refresh); return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refresh); }, []);
  const test = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(rawConstraints(s.audioIn)), ctx = session.synth.ensure(), an = ctx.createAnalyser(); an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an); const buf = new Float32Array(an.fftSize); refresh();
      const t0 = performance.now(), loop = () => { an.getFloatTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v)); setLevel(m); if (performance.now() - t0 < 6000) requestAnimationFrame(loop); else { stream.getTracks().forEach((t) => t.stop()); setLevel(0); } };
      loop();
    } catch { setErr('No pudimos abrir esa entrada. Revisa el permiso de micrófono del navegador.'); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 820 }}>
      <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>Conecta el sidekick (o cualquier interfaz) por USB: aparece como entrada de audio. Al grabar una toma, Fly Punch guarda también el <strong style={{ color: 'var(--text)' }}>sonido real</strong> de tus aparatos —la mezcla de tus dos K.O. II— además de las notas. Se exporta como WAV desde Tomas.</p>
      {!pro && <ProNote feature="audio">Grabar el audio real con cada toma es parte de Pro.</ProNote>}
      <section className="panel" style={{ opacity: pro ? 1 : 0.6 }}>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 260px' }}><label htmlFor="ain">Entrada de audio</label>
            <select id="ain" className="input" disabled={!pro} value={s.audioIn || ''} onChange={(e) => session.set({ audioIn: e.target.value || null }, true)}>
              <option value="">Predeterminada del sistema</option>
              {inputs.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select></div>
          <button type="button" className="btn lg" disabled={!pro} onClick={test}>Probar 6 s</button>
        </div>
        <div className="well" style={{ height: 10, overflow: 'hidden' }} aria-label="Nivel de entrada"><div style={{ height: '100%', width: `${Math.min(100, level * 110)}%`, background: level > 0.9 ? '#E5484D' : 'var(--acc)', transition: 'width .08s linear' }} /></div>
        <label className="row" style={{ gap: 10 }}><input type="checkbox" disabled={!pro} checked={!!s.captureAudio} onChange={(e) => session.set({ captureAudio: e.target.checked }, true)} style={{ width: 18, height: 18, accentColor: 'var(--acc)' }} />Grabar el audio real con cada toma</label>
        <div className="well" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="label">Entradas que ve el navegador</span>
          {named ? <span className="mono" style={{ fontSize: 11, lineHeight: 1.6 }}>{inputs.map((d) => d.label).join(' · ') || 'ninguna'}</span>
            : <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={scan}>Dar permiso y buscar entradas</button>}
          {named && !hasSk && <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: '#FF8A4D' }}>No aparece el sidekick. Si tampoco sale en «Configuración de Audio MIDI» de tu Mac, el problema está en la conexión: usa un cable USB-C de datos (no solo de carga) directo a la Mac y revisa en el sidekick el modo USB (botón de sistema bajo la tapa de pilas).</p>}
        </div>
        {err && <p role="alert" style={{ margin: 0, color: '#FF8A4D' }}>{err}</p>}
      </section>
      <p className="dim" style={{ margin: 0, fontSize: 11, lineHeight: 1.5 }}>El audio se guarda en este navegador (no en la nube) para no gastar espacio de tu cuenta. Las notas de la toma sí se sincronizan.</p>
    </div>
  );
}
