import { useEffect, useState } from 'react';
import { Icon } from './kit.jsx';

// ¿Dónde corre? iPad/iPhone (Safari o Chrome en iOS: sin Web MIDI) · app instalada (pantalla completa)
export const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const isStandalone = () => typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);

// Chrome/Edge en computadora o Android ofrecen instalar con un botón; en iPad se hace desde Compartir.
export function InstallApp() {
  const [prompt, setPrompt] = useState(() => window.__fpInstall || null), [done, setDone] = useState(isStandalone());
  useEffect(() => { const f = () => setPrompt(window.__fpInstall); const g = () => setDone(true); addEventListener('fp-install', f); addEventListener('appinstalled', g); return () => { removeEventListener('fp-install', f); removeEventListener('appinstalled', g); }; }, []);
  if (done) return <span className="chip acc">INSTALADA</span>;
  if (prompt) return <button type="button" className="btn acc" onClick={async () => { prompt.prompt(); const r = await prompt.userChoice; if (r.outcome === 'accepted') setDone(true); window.__fpInstall = null; setPrompt(null); }}><Icon name="bajar" size={14} />Instalar Fly Punch</button>;
  if (isIOS) return <span className="muted" style={{ fontSize: 12, maxWidth: 300 }}>En Safari: botón <strong style={{ color: 'var(--text)' }}>Compartir</strong> → <strong style={{ color: 'var(--text)' }}>Agregar a pantalla de inicio</strong>.</span>;
  return <span className="muted" style={{ fontSize: 12, maxWidth: 300 }}>En Chrome o Edge: el ícono de instalar en la barra de direcciones, o menú → «Instalar Fly Punch».</span>;
}
