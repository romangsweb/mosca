import { useEffect, useState } from 'react';
import { session } from './engine/session.js';
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

const NAV = [
  ['estudio', 'Estudio', 'estudio'], ['equipo', 'Equipo', 'usb'], ['oido', 'Oído', 'oido'], ['datos', 'Datos', 'datos', true], ['sonido', 'Sonido', 'sonido'], ['tomas', 'Tomas', 'tomas'],
];
const PAGES = { estudio: Estudio, equipo: Equipo, oido: Oido, datos: Datos, sonido: Sonido, tomas: Tomas, cuenta: Cuenta };
const TIPS = {
  estudio: ['Gira Dulce y Amargo: es lo que prueba la mosca.', 'Pulsa Tocar (o la barra espaciadora). Cada neurona que dispara toca su pad.', 'Toca un pad o una neurona del cerebro para inspeccionarla.'],
  oido: ['Elige micrófono, un archivo o los deslizadores.', 'Graves, medios y agudos estimulan tres grupos de sensores de la antena.', 'La pista Oído suena en el grupo A del K.O. II.'],
  datos: ['Sube un CSV o usa el ejemplo.', 'Asigna columnas a sabores o sonidos.', 'Cada fila dura un compás: escucha cómo cambian tus datos.'],
  equipo: ['Elige tu aparato en la galería: K.O. II, TR-8S, Digitakt, Ableton y más.', 'Si no aparece, usa Personalizado y escribe sus notas.', 'Pulsa «Probar» para oír 8 notas antes de tocar.'],
  sonido: ['Librería: elige un kit y pulsa Escuchar.', 'Kit: qué voz tiene cada pad. Mutar respeta estos roles.', 'MIDI: reloj, latencia y control de efectos del K.O. II.'],
  tomas: ['Graba con el punto rojo o la tecla R.', 'Cada toma guarda las notas de todas las pistas.', 'Exporta a MIDI para tu DAW, o a WAV con los sonidos internos.'],
  cuenta: ['Inicia sesión para llevar tus ajustes a cualquier dispositivo.', 'Con cuenta, tus tomas se guardan en la nube.', 'Pro: modo Datos, tomas ilimitadas y WAV. Pruébalo 7 días gratis.'],
};
const SYNC_LABEL = { off: 'Guardado en este navegador', local: 'Guardado en este navegador', sincronizando: 'Sincronizando…', sincronizado: 'Sincronizado con tu cuenta', error: 'Sin conexión · guardado local' };
const initials = (s) => (s.alias || s.user?.email || 'FP').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || 'FP';
const route = () => (location.hash.replace(/^#\/?/, '') || 'estudio').split('?')[0];

function Position() {
  useTick(20);
  const n = session.s.playing ? session.live.step : 0;
  return <div className="pos mono" aria-label="Posición">{String(1 + Math.floor(n / 16)).padStart(3, '0')}.{1 + Math.floor((n % 16) / 4)}.{1 + (n % 4)}</div>;
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
      <span className={`chip hide-sm${ext || s.clockOut ? ' acc' : ''}`} title="Fuente del reloj">{ext ? 'SIGUE K.O.' : s.clockOut ? 'MAESTRO' : 'INTERNO'}</span>
    </div>
  );
}

export default function App() {
  const s = useS(), [page, setPage] = useState(route());
  useEffect(() => { const f = () => setPage(route()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { document.documentElement.dataset.theme = s.theme; }, [s.theme]);
  useEffect(() => { if (s.user && page === 'bienvenida') location.hash = '#/estudio'; }, [s.user, page]);
  useEffect(() => {
    const k = (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); session.toggle(); }
      if (e.key === 'r' || e.key === 'R') session.toggleRec();
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  if (!s.ready) return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--sub)' }}><div className="row"><Logo /> Cargando el cerebro…</div></div>;
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
          {NAV.map(([id, label, icon, pro]) => <a key={id} href={`#/${id}`} aria-current={page === id ? 'page' : undefined}><Icon name={icon} size={20} />{label}{pro && <span className="pro" title="Pro" />}</a>)}
          <span className="spacer" />
          <a href="#/cuenta?ayuda" aria-current={undefined}><Icon name="docs" size={20} />Docs</a>
          <a href="#/cuenta?ajustes" aria-current={page === 'cuenta' ? 'page' : undefined}><Icon name="ajustes" size={20} />Ajustes</a>
        </nav>
        <main className="main" id="main"><Page key={page} /></main>
      </div>
      <StatusBar s={s} />
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
      <span className="right">818 NEURONAS · FLYWIRE v630 · SHIU ET AL. 2024</span>
    </footer>
  );
}
