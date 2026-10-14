import { useEffect, useState } from 'react';
import { session } from '../engine/session.js';
import { useS, Seg, Icon } from '../ui/kit.jsx';

const DOCS = [
  ['Primeros pasos', <>
    <p>Conecta el K.O. II con un cable USB-C de datos <strong>directo a la computadora</strong> (los docks a veces bloquean el MIDI). Abre Fly Punch en Chrome o Edge y pulsa <code>Conectar K.O. II</code> arriba a la derecha.</p>
    <p>En el K.O. II elige un kit y deja el grupo <code>C</code> para la pista Gusto y el grupo <code>A</code> para Oído. Pulsa <code>Tocar</code> (o la barra espaciadora).</p></>],
  ['Cómo piensa la mosca', <>
    <p>Fly Punch simula 818 neuronas reales del conectoma <strong>FlyWire</strong> (v630) con el modelo de Shiu et al. (Nature, 2024): cada neurona acumula voltaje, dispara al pasar un umbral y empuja a las neuronas a las que está conectada, con los pesos medidos en el conectoma.</p>
    <p>Los sabores y sonidos entran como disparos al azar en los sensores. Lo que oyes es la respuesta del circuito: por ejemplo, el amargo activa inhibidoras que apagan a MN9, la neurona que hace comer a la mosca.</p>
    <p>Es un modelo simplificado: reproduce bien qué neuronas se activan, no su biología completa.</p></>],
  ['Pistas, grupos y Mutar', <>
    <p>Hay una pista por sentido. Cada una toca un grupo del K.O. II (A–D = notas 36–83). Las pistas comparten el mismo cerebro: si suena el amargo, también cambia lo que pasa en el resto.</p>
    <p><strong>Mutar</strong> reparte al azar las neuronas entre los pads, pero respetando su papel: motoneuronas a graves, interneuronas a medios, sensores e inhibidoras a agudos. Dile en <code>Sonido → Kit y pistas</code> qué sonido tiene cada pad de tu kit para que el reparto tenga sentido. Siempre puedes deshacer.</p></>],
  ['Grabar y exportar', <>
    <p>El punto rojo graba las notas de todas las pistas. Las tomas se guardan en este navegador (5 en Free). Exporta a <code>.mid</code> para tu DAW, a <code>.csv</code> para analizar los disparos o a <code>.wav</code> con las voces internas.</p>
    <p>Para el audio real de tu kit: graba la salida del K.O. II con una interfaz, o activa <code>Fly Punch marca el tempo</code> y graba los patrones en el propio K.O. II.</p></>],
  ['Ajustes del K.O. II', <>
    <p>Los ajustes se cambian con <code>SHIFT + ERASE</code>, el código y <code>ENTER</code>:</p>
    <p><code>110</code> recibir en todos los canales · <code>101</code> recibir reloj (Fly Punch maestro) · <code>102</code> enviar reloj (el K.O. II marca el tempo) · <code>100</code> sin reloj.</p>
    <p>Los efectos responden a <code>CC 12</code> (perilla X) y <code>CC 13</code> (perilla Y). Fly Punch los mueve si activas «La mosca mueve los efectos».</p></>],
  ['Solución de problemas', <>
    <p><strong>No aparece el K.O. II:</strong> conéctalo sin dock, usa Chrome o Edge y acepta el permiso de MIDI.</p>
    <p><strong>No suenan las notas:</strong> revisa que el grupo de la pista coincida con el kit que tienes cargado y que el código 110 esté activo.</p>
    <p><strong>Suena tarde:</strong> sube «Compensar latencia» en Sonido → K.O. II y MIDI.</p></>],
];

export default function Cuenta() {
  const s = useS(), q = location.hash.split('?')[1], [tab, setTab] = useState(['perfil', 'plan', 'ajustes', 'ayuda'].includes(q) ? q : 'perfil'), [yearly, setYearly] = useState(false);
  useEffect(() => { const f = () => { const q2 = location.hash.split('?')[1]; if (q2) setTab(q2); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const exportAll = () => { const blob = new Blob([JSON.stringify({ app: 'fly-punch', version: 1, takes: s.takes }, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fly-punch-respaldo.json'; a.click(); };
  return (
    <div className="page" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', maxWidth: 1180 }}>
      <nav aria-label="Secciones de la cuenta" style={{ flex: '0 1 200px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[['perfil', 'Perfil'], ['plan', 'Plan'], ['ajustes', 'Ajustes'], ['ayuda', 'Ayuda y documentación']].map(([id, l]) => <button key={id} type="button" className="btn ghost" aria-pressed={tab === id} style={{ justifyContent: 'flex-start', height: 40 }} onClick={() => { setTab(id); history.replaceState(null, '', `#/cuenta?${id}`); }}>{l}</button>)}
      </nav>
      <div style={{ flex: '1 1 600px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {tab === 'perfil' && (
          <section className="panel" style={{ gap: 18, padding: 22 }}>
            <h1>Perfil</h1>
            <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
              <span style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--well)', border: '1px solid var(--line2)', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 20 }}>{(s.alias || s.user?.email || 'FP').slice(0, 2).toUpperCase()}</span>
              <div><div style={{ fontWeight: 600, fontSize: 15 }}>{s.alias || (s.user ? s.user.email : 'Invitado')}</div><div className="muted">{s.user ? `${s.user.email} · plan ${s.plan === 'pro' ? 'Pro' : 'Free'} · ${s.sync === 'sincronizado' ? 'sincronizado' : s.sync === 'error' ? 'sin conexión' : 'sincronizando…'}` : 'Sin cuenta · todo se guarda en este navegador'}</div></div>
              {s.user ? <button type="button" className="btn lg" style={{ marginLeft: 'auto' }} onClick={() => session.logout()}>Cerrar sesión</button>
                : <a className="btn lg primary" style={{ marginLeft: 'auto' }} href="#/bienvenida" aria-disabled={s.sync === 'off'}>{s.sync === 'off' ? 'Cuentas no configuradas' : 'Iniciar sesión o crear cuenta'}</a>}
            </div>
            <div className="field"><label htmlFor="alias">Nombre artístico</label><input id="alias" className="input" value={s.alias} placeholder="Peso Mosca" onChange={(e) => session.set({ alias: e.target.value }, true)} /></div>
            <div className="row"><div className="stat"><div className="label">Tomas</div><div className="v">{s.takes.length} / 5</div></div><div className="stat"><div className="label">Notas grabadas</div><div className="v">{s.takes.reduce((a, t) => a + t.events.length, 0)}</div></div><div className="stat"><div className="label">Pistas</div><div className="v">{s.tracks.length}</div></div></div>
            <div className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={exportAll}><Icon name="bajar" size={14} />Exportar respaldo (.json)</button>
              {s.user && <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>Tus ajustes de sonido, pistas y kit viajan con tu cuenta. Las tomas siguen en este navegador (llegan a la nube en el paso 2).</span>}
            </div>
          </section>
        )}
        {tab === 'plan' && (
          <>
            <div className="between" style={{ flexWrap: 'wrap' }}><div><h1>Plan</h1><p className="muted" style={{ margin: '4px 0 0' }}>Gusto, Oído y la exportación MIDI son gratis.</p></div><Seg label="Facturación" items={[['m', 'Mensual'], ['a', 'Anual']]} value={yearly ? 'a' : 'm'} onChange={(v) => setYearly(v === 'a')} /></div>
            <div className="cols" style={{ gap: 16 }}>
              {[['Free', s.plan === 'free' ? 'TU PLAN' : '', '$0', 'para siempre', ['Gusto y Oído (micrófono y archivos)', '2 pistas en el K.O. II', '5 tomas en este navegador', 'Exportar a MIDI y CSV'], 'Plan actual', false],
                ['Pro', s.plan === 'pro' ? 'TU PLAN' : 'PRÓXIMAMENTE', '[PRECIO]', yearly ? '/ año' : '/ mes', ['Modo Datos (CSV → sentidos)', '4 pistas (grupos A–D)', 'Tomas ilimitadas en la nube', 'Exportar WAV y presets de kit', 'Más circuitos: agua, olfato, novedad'], 'Avísame', true]].map(([n, tag, price, per, feats, cta, pro]) => (
                <article key={n} className="panel" style={{ flex: '1 1 300px', padding: 22, gap: 14, borderColor: pro ? 'var(--acc)' : undefined }}>
                  <div className="between"><h2 style={{ fontSize: 18 }}>{n}</h2><span className="label" style={{ color: pro ? 'var(--acc)' : undefined }}>{tag}</span></div>
                  <div><span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.02em' }}>{price}</span><span className="muted"> {per}</span></div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>{feats.map((f) => <li key={f} className="row" style={{ alignItems: 'flex-start', color: 'var(--sub)' }}><span style={{ color: pro ? 'var(--acc)' : 'var(--sub)' }}><Icon name="check" size={16} stroke={2.4} /></span>{f}</li>)}</ul>
                  <button type="button" className={`btn lg ${pro ? 'acc' : ''}`} style={{ marginTop: 'auto' }} disabled={!pro}>{cta}</button>
                </article>
              ))}
            </div>
            <p className="dim" style={{ margin: 0, fontSize: 12 }}>Precios por definir. Mientras tanto, las funciones Pro están abiertas para probarlas.</p>
          </>
        )}
        {tab === 'ajustes' && (
          <section className="panel" style={{ gap: 0, padding: 22 }}>
            <h1 style={{ marginBottom: 6 }}>Ajustes</h1>
            <div className="setting"><div><div className="t">K.O. II</div><div className="d">{s.ko.output ? `Conectado: ${s.ko.output}` : s.ko.error || 'No detectado. Conéctalo directo por USB-C y usa Chrome o Edge.'}</div></div><button type="button" className="btn" onClick={() => session.connect()}><span className={`status-dot${s.ko.output ? ' on' : ''}`} />{s.ko.output ? 'Volver a buscar' : 'Conectar'}</button></div>
            <div className="setting"><div><div className="t">Tema</div><div className="d">La pantalla del cerebro se queda oscura en los dos temas, como el display de un aparato.</div></div><Seg label="Tema" items={[['noche', 'Noche'], ['dia', 'Día']]} value={s.theme} onChange={(v) => session.set({ theme: v }, true)} /></div>
            <div className="setting"><div><div className="t">Guía en pantalla</div><div className="d">Tres pasos cortos arriba de cada sección.</div></div><Seg label="Guía" items={[['on', 'Visible'], ['off', 'Oculta']]} value={s.guide ? 'on' : 'off'} onChange={(v) => session.set({ guide: v === 'on' }, true)} /></div>
            <div className="setting"><div><div className="t">MIDI, reloj y latencia</div><div className="d">Se ajustan en Sonido → K.O. II y MIDI.</div></div><a className="btn" href="#/sonido">Abrir</a></div>
          </section>
        )}
        {tab === 'ayuda' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 style={{ marginBottom: 6 }}>Ayuda y documentación</h1>
            {DOCS.map(([t, body], i) => <details key={t} className="doc-item" open={i === 0}><summary>{t}</summary><div className="doc">{body}</div></details>)}
            <p className="dim" style={{ fontSize: 11, lineHeight: 1.6 }}>Datos: FlyWire v630 · Shiu et al. 2024 (Nature), github.com/philshiu/Drosophila_brain_model (MIT) · anotaciones: Schlegel et al. 2024; Dorkenwald et al. 2024.</p>
          </section>
        )}
      </div>
    </div>
  );
}
