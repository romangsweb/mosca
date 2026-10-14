import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { session } from './engine/session.js';
import './styles.css';

window.flypunch = session; // útil para depurar desde la consola
createRoot(document.getElementById('root')).render(<App />);
session.load();
