import { isIOS, isStandalone } from './ui/Install.jsx';
import { Component, useEffect, useState } from 'react';
import { session } from './engine/session.js';
import { COMPASES, compas, posLabel } from './engine/compas.js';
import { useS, useTick, Icon, Logo } from './ui/kit.jsx';
import { TrialBadge } from './ui/Paywall.jsx';
import Estudio from './pages/Estudio.jsx';
import Oido from './pages/Oido.jsx';
import Datos from './pages/Datos.jsx';
import Sonido from './pages/Sonido.jsx';
import Tomas from './pages/Tomas.jsx';
import Cuenta from './pages/Cuenta.jsx';
import Bienvenida from './pages/Bienvenida.jsx';
import Equipo from './pages/Equipo.jsx';
import Cancion from './pages/Cancion.jsx';
import Mezcla from './pages/Mezcla.jsx';
import Escuchar from './pages/Escuchar.jsx';
import Directo from './pages/Directo.jsx';

const NAV = [
  ['estudio', 'Estudio', 'estudio'], ['mezcla', 'Mezcla', 'mezcla'], ['cancion', 'Canción', 'cancion', true], ['directo', 'Directo', 'directo', true], null,
  ['sonido', 'Sonido', 'sonido'], ['oido', 'Oído', 'oido'], ['datos', 'Datos', 'datos', true], null,
  ['tomas', 'Tomas', 'tomas'], ['equipo', 'Equipo', 'usb'],
];
const PAGES = { directo: Directo, estudio: Estudio, equipo: Equipo, mezcla: Mezcla, cancion: Cancion, oido: Oido, datos: Datos, sonido: Sonido, tomas: Tomas, cuenta: Cuenta };
const TIPS = {
  estudio: ['Gira Dulce y Amargo: es lo que prueba la mosca.', 'Pulsa Tocar (o la barra espaciadora). Cada neurona que dispara toca su pad.', 'Toca un pad o una neurona del cerebro para inspeccionarla.'],
  oido: ['Elige micrófono, un archivo o los deslizadores.', 'Graves, medios y agudos estimulan tres grupos de sensores de la antena.', 'La pista Oído suena en el grupo A del K.O. II.'],
  datos: ['Sube un CSV o usa el ejemplo.', 'Asigna columnas a sabores o sonidos.', 'Cada fila dura un compás: escucha cómo cambian tus datos.'],
  equipo: ['Aparato principal: elige en la galería (K.O. II, TR-8S, Digitakt, Ableton…).', 'Controles: aprende las perillas del sidekick o de cualquier controlador.', 'Audio: graba la mezcla real de tus aparatos con cada toma.'],
  directo: ['Lanza escenas con clic o con las teclas 1–8: entran al siguiente compás.', 'Pon cada pista del lado A o B y cruza con el crossfader.', 'Pulsa MIDI en una macro y mueve un fader del sidekick para asignarlo.'],
  mezcla: ['Destino: cada pista va al aparato, al kit de la compu o a ambos.', 'Pro: un aparato por pista, p. ej. dos K.O. II.', 'Entrada: la mezcla del sidekick vuelve aquí y se graba con cada toma.'],
  cancion: ['Ajusta lo que suena y guárdalo en una casilla de Escenas (o crea la canción de ejemplo).', 'Pulsa una escena para añadirla al Arreglo y elige sus compases.', 'Toca: la mosca cambia de escena al compás.'],
  sonido: ['Kits: pulsa Escuchar y luego «Usar este kit».', 'Pads y voces: qué golpe toca cada pad. Mutar respeta estos roles.', 'MIDI y reloj: tempo compartido, latencia y efectos del K.O. II.'],
  tomas: ['Graba con el punto rojo o la tecla R.', 'Cada toma guarda las notas de todas las pistas.', 'Exporta a MIDI para tu DAW, o a WAV con los sonidos internos.'],
  cuenta: ['Inicia sesión para llevar tus ajustes a cualquier dispositivo.', 'Con cuenta, tus tomas se guardan en la nube.', 'Pro: modo Datos, tomas ilimitadas y WAV. Pruébalo 7 días gratis.'],
};
const SYNC_LABEL = { off: 'Guardado en este navegador', local: 'Guardado en este navegador', sincronizando: 'Sincronizando…', sincronizado: 'Sincronizado con tu cuenta', error: 'Sin conexión · guardado local' };
const initials = (s) => (s.alias || s.user?.email || 'FP').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || 'FP';
// Si una sección falla, no se queda la pantalla en negro: se muestra cómo salir.
class Boundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('Fly Punch', err, info?.componentStack); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="stage" style={{ flexDirection: 'column', gap: 14, textAlign: 'center', padding: 24, minHeight: 360 }}>
        <h2 style={{ fontSize: 20 }}>Algo falló en esta sección</h2>
        <p style={{ margin: 0, color: '#A6A6AE', maxWidth: 460 }}>Tus tomas y ajustes están a salvo. Vuelve al estudio o recarga la página; si se repite, cuéntanos qué hiciste.</p>
        <code style={{ fontSize: 11, color: '#77777F', maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(this.state.err?.message || this.state.err)}</code>
        <div className="row"><a className="btn lg primary" href="#/estudio" onClick={() => this.setState({ err: null })}>Volver al estudio</a><button type="button" className="btn lg" style={{ color: '#ECECEE', borderColor: 'rgba(255,255,255,.12)' }} onClick={() => location.reload()}>Recargar</button></div>
      </div>
    );
  }
}
const route = () => (location.hash.replace(/^#\/?/, '') || 'estudio').split('?')[0];

function Position() {
  useTick(20);
  const n = session.s.playing ? session.live.step : 0;
  return <div className="pos mono" aria-label="Posición">{posLabel(session.C, n)}</div>;
}
function Transport({ s }) {
  const ext = session.ko.hasExternalClock;
  return (
    <div className="transport" role="group" aria-label="Transporte">
      <button type="button" className="tbtn rec" aria-pressed={s.rec} aria-label={s.rec ? 'Detener grabación' : 'Grabar'} title="Grabar (R)" onClick={() => session.toggleRec()}><span className="dot" /></button>
      <button type="button" className="tbtn play" aria-pressed={s.playing} onClick={() => session.toggle()} title="Tocar / detener (espacio)"><Icon name={s.playing ? 'stop' : 'play'} size={14} fill="currentColor" />{s.playing ? 'Detener' : 'Tocar'}</button>
      <span className="tdiv" /><Position /><span className="tdiv" />
      <div className="bpm">
        <button type="button" aria-label="Bajar tempo" onClick={() => session.setBpm(s.bpm - 1)} disabled={ext}>−</button>
        <label className="sr" htmlFor="bpm">Tempo</label>
        <input id="bpm" type="number" value={ext ? Math.round(session.ko.bpm) : s.bpm} disabled={ext} onChange={(e) => session.setBpm(+e.target.value || 110)} />
        <button type="button" aria-label="Subir tempo" onClick={() => session.setBpm(s.bpm + 1)} disabled={ext}>+</button>
        <span className="mono muted" style={{ fontSize: 10, marginRight: 6 }}>BPM</span>
      </div>
      <label className="sr" htmlFor="compas">Compás</label>
      <select id="compas" className="tsel mono hide-sm" value={s.compas || '4/4'} title={`Compás · ${compas(s.compas).desc}`} onChange={(e) => session.setCompas(e.target.value)}>
        {Object.entries(COMPASES).map(([id, c]) => <option key={id} value={id}>{c.name}</option>)}
      </select>
      <button type="button" className="tbtn hide-sm" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', padding: '0 8px' }} title="Toca al ritmo para marcar el tempo (T)" disabled={ext} onClick={() => session.tap()}>TAP</button>
      <button type="button" className="tbtn" aria-pressed={!!s.metro} aria-label="Metrónomo" title="Metrónomo (M)" onClick={() => session.set({ metro: !s.metro }, true)} style={s.metro ? { color: 'var(--acc)' } : undefined}><Icon name="metro" size={16} /></button>
      {s.counting && <span className="chip acc" aria-live="polite">CUENTA</span>}
      <span className={`chip hide-sm clk${ext || s.clockOut || session.followLocked ? ' acc' : ''}`} title="Fuente del reloj">{ext ? 'SIGUE K.O.' : session.followLocked && s.follow?.tempo !== false ? 'ACOMPAÑA' : s.clockOut ? 'MAESTRO' : 'INTERNO'}</span>
    </div>
  );
}

export default function App() {
  const s = useS(), [page, setPage] = useState(route());
  useEffect(() => { const f = () => setPage(route()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { document.documentElement.dataset.theme = s.theme; }, [s.theme]);
  useEffect(() => { if (s.ready && isIOS && !isStandalone() && !s.installHint && !s.notice) session.set({ notice: 'instalar' }); }, [s.ready]);
  useEffect(() => { if (s.user && page === 'bienvenida') location.hash = '#/estudio'; }, [s.user, page]);
  useEffect(() => {
    const k = (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); session.toggle(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? session.redo() : session.undo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'r' || e.key === 'R') session.toggleRec();
      if (e.key === 'm' || e.key === 'M') session.set({ metro: !session.s.metro }, true);
      if (e.key === 't' || e.key === 'T') session.tap();
      if (e.key === 'g' || e.key === 'G') session.feedback(1);
      if (e.key === 'n' || e.key === 'N') session.feedback(-1);
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  if (!s.ready) return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--sub)', textAlign: 'center', padding: 24 }}>
      {s.loadError ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}><Logo /><strong style={{ color: 'var(--text)' }}>No pudimos cargar el cerebro</strong><span style={{ maxWidth: 420 }}>Revisa tu conexión y recarga. Si tienes otra pestaña de Fly Punch abierta, ciérrala.</span><code style={{ fontSize: 11 }}>{s.loadError}</code><button type="button" className="btn lg primary" onClick={() => location.reload()}>Recargar</button></div>
        : <div className="row"><Logo /> Cargando el cerebro…</div>}
    </div>
  );
  if (page.startsWith('t/')) return <Escuchar shareId={page.slice(2)} />; // toma compartida: sin cuenta ni bienvenida
  if (!s.onboarded || page === 'bienvenida') return <Bienvenida />;
  const Page = PAGES[page] || Estudio;
  const night = s.theme === 'noche';
  return (
    <div className="app">
      <header className="topbar">
        <div className="side">
          <a href="#/estudio" className="brand" aria-label="Fly Punch, ir al estudio"><Logo /></a>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <label className="sr" htmlFor="sess">Nombre de la sesión</label>
            <input id="sess" className="sessname" value={s.sessionName} onChange={(e) => session.set({ sessionName: e.target.value }, true)} />
            <span className="muted hide-sm" style={{ fontSize: 11 }}>{SYNC_LABEL[s.sync] || SYNC_LABEL.local}</span>
          </div>
        </div>
        <Transport s={s} />
        <div className="side right">
          <a href="#/equipo" className="btn ghost hide-sm" title={s.ko.output ? `Conectado: ${s.ko.output}` : 'Elegir y conectar un aparato'}>
            <span className={`status-dot${s.ko.output || session.profile.kind === 'interno' ? ' on' : ''}`} />{session.profile.kind === 'interno' ? 'Sonido interno' : s.ko.output ? session.profile.name : `Conectar ${session.profile.name}`}
          </a>
          <TrialBadge />
          <button type="button" className="iconbtn" aria-label="Deshacer" title="Deshacer (⌘Z)" disabled={!s.canUndo} onClick={() => session.undo()}><Icon name="deshacer" size={15} /></button>
          <button type="button" className="iconbtn" aria-label="Rehacer" title="Rehacer (⇧⌘Z)" disabled={!s.canRedo} onClick={() => session.redo()}><Icon name="deshacer" size={15} style={{ transform: 'scaleX(-1)' }} /></button>
          <button type="button" className="btn" aria-pressed={s.guide} onClick={() => session.set({ guide: !s.guide }, true)}>Guía</button>
          <button type="button" className="iconbtn" aria-label={night ? 'Cambiar a tema día' : 'Cambiar a tema noche'} onClick={() => session.set({ theme: night ? 'dia' : 'noche' }, true)}><Icon name={night ? 'sol' : 'luna'} size={15} /></button>
          <a href="#/cuenta" className="avatar" aria-label={`Cuenta, plan ${s.plan}`}><span className="mono muted" style={{ fontSize: 9, letterSpacing: '.1em' }}>{!s.user ? 'INVITADO' : session.onTrial ? 'PRUEBA' : s.plan.toUpperCase()}</span><span>{initials(s)}</span></a>
        </div>
      </header>
      {s.guide && TIPS[page] && (
        <div className="guide" role="note">
          {TIPS[page].map((t, i) => <span key={i}><span className="n">{i + 1}</span>{t}</span>)}
          <a href="#/cuenta?ayuda" style={{ marginLeft: 'auto', textDecoration: 'underline', textUnderlineOffset: 3 }}>Documentación</a>
          <button type="button" className="iconbtn" style={{ border: 0 }} aria-label="Cerrar guía" onClick={() => session.set({ guide: false }, true)}><Icon name="x" size={14} /></button>
        </div>
      )}
      <div className="body">
        <nav className="rail" aria-label="Secciones">
          {NAV.map((n, i) => (!n ? <span key={`sep${i}`} className="rail-sep" aria-hidden="true" />
            : <a key={n[0]} href={`#/${n[0]}`} aria-current={page === n[0] ? 'page' : undefined}><Icon name={n[2]} size={20} />{n[1]}{n[3] && <span className="pro" title="Pro" />}</a>))}
          <span className="spacer" />
          <a href="#/cuenta?ayuda" aria-current={undefined}><Icon name="docs" size={20} />Docs</a>
          <a href="#/cuenta?ajustes" aria-current={page === 'cuenta' ? 'page' : undefined}><Icon name="ajustes" size={20} />Ajustes</a>
        </nav>
        <main className="main" id="main"><Boundary key={page}><Page /></Boundary></main>
      </div>
      <StatusBar s={s} />
      {s.notice === 'restauracion' && (
        <div className="toast" role="status">No se pudo abrir el guardado de este navegador. Si tienes otra pestaña de Fly Punch abierta, ciérrala y recarga.<button type="button" className="btn" onClick={() => location.reload()}>Recargar</button><button type="button" className="iconbtn" aria-label="Cerrar" onClick={() => session.set({ notice: null })}><Icon name="x" size={14} /></button></div>
      )}
      {s.notice === 'audio' && (
        <div className="toast" role="alert">No pudimos abrir la entrada de audio: la toma se grabó solo con notas. Revisa Equipo → Audio.<button type="button" className="iconbtn" aria-label="Cerrar" onClick={() => session.set({ notice: null })}><Icon name="x" size={14} /></button></div>
      )}
      {s.notice === 'instalar' && (
        <div className="toast" role="status"><span>Para usar Fly Punch como app en tu iPad: <strong>Compartir → Agregar a pantalla de inicio</strong>. Si no oyes nada, revisa que el iPad no esté en silencio.</span><button type="button" className="iconbtn" aria-label="Cerrar" onClick={() => session.set({ notice: null, installHint: true }, true)}><Icon name="x" size={14} /></button></div>
      )}
      {s.notice === 'congelar' && (
        <div className="toast" role="status">Para congelar, dale a Tocar: se guarda el último compás que tocó la mosca en esta pista.<button type="button" className="iconbtn" aria-label="Cerrar" onClick={() => session.set({ notice: null })}><Icon name="x" size={14} /></button></div>
      )}
      {s.notice === 'pro' && (
        <div className="toast" role="status"><span><strong>Ya eres Pro.</strong> Gracias por apoyar Fly Punch: todo está desbloqueado en tus dispositivos.</span><button type="button" className="iconbtn" aria-label="Cerrar" onClick={() => session.set({ notice: null })}><Icon name="x" size={14} /></button></div>
      )}
      {s.notice === 'limite' && (
        <div className="toast" role="status">Llegaste a 5 tomas guardadas en el plan Free. <a href="#/tomas" className="btn" onClick={() => session.set({ notice: null })}>Ver tomas</a><button type="button" className="iconbtn" aria-label="Cerrar" onClick={() => session.set({ notice: null })}><Icon name="x" size={14} /></button></div>
      )}
    </div>
  );
}

function StatusBar({ s }) {
  useTick(4);
  const L = session.live, eat = L.mn9 > 15;
  return (
    <footer className="statusbar">
      <span style={{ color: 'var(--text)' }}>{!s.playing ? 'EN PAUSA' : s.rec ? '● GRABANDO' : eat ? 'COMIENDO' : 'TOCANDO'}</span>
      <span>{s.playing ? L.active : 0} NEURONAS ACTIVAS</span>
      <span>{s.ko.output ? `MIDI OUT · ${s.ko.output}` : `${session.profile.name.toUpperCase()} · ${session.monitorOn ? 'SONIDO INTERNO' : 'SIN CONEXIÓN'}`}</span>
      {s.latency > 0 && <span>LATENCIA −{s.latency} ms</span>}
      <span className="right">{session.D?.n || ''} NEURONAS · FLYWIRE v783 · SHIU ET AL. 2024</span>
    </footer>
  );
}
