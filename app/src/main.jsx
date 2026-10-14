import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { session } from './engine/session.js';
import './styles.css';

window.flypunch = session; // útil para depurar desde la consola
// Chrome/Edge: guardar la invitación a instalar para mostrarla en Ajustes
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__fpInstall = e; dispatchEvent(new Event('fp-install')); });
createRoot(document.getElementById('root')).render(<App />);
session.load();
// app instalable (PWA): en producción registramos el service worker para abrir rápido y sin conexión
if ('serviceWorker' in navigator && import.meta.env.PROD) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('sw', e)));
