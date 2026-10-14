// Fly Punch · iconografía propia (24×24, trazo). Se encienden con currentColor; apagados se ven como segmentos tenues.
const S = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  cerebro: S('<ellipse cx="4.6" cy="12" rx="2.7" ry="5.4"/><ellipse cx="19.4" cy="12" rx="2.7" ry="5.4"/><path d="M7.6 9c1-3 2.9-4.4 4.4-4.4S15.4 6 16.4 9c.8 2.4.5 6-1.5 7.5-1.1.9-2.1 1-2.9 1s-1.8-.1-2.9-1C7.1 15 6.8 11.4 7.6 9z"/><path d="M9.6 10.4c1.2-1 3.6-1 4.8 0"/><path d="M12 13v3.6"/>'),
  gusto: S('<path d="M12 3c3.5 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.5-6.5 6-11z"/><path d="M9.4 14.6a2.6 2.6 0 0 0 2.6 2.6"/>'),
  oido: S('<path d="M6 20c0-6 2-11 6-14"/><circle cx="12.9" cy="5.3" r="1.4"/><path d="M15.4 10.2a4 4 0 0 1 0 4.8"/><path d="M18 8a7.5 7.5 0 0 1 0 9"/>'),
  datos: S('<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M3.5 9.5h17M3.5 14h17M9.5 5v14"/>'),
  play: S('<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/>'),
  stop: S('<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" stroke="none"/>'),
  midi: S('<path d="M9 3v5M15 3v5"/><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 16.5V21"/>'),
  sync: S('<path d="M5 12a7 7 0 0 1 12-5l2-2v6h-6l2.5-2.5A4.6 4.6 0 0 0 7.3 12"/><path d="M19 12a7 7 0 0 1-12 5l-2 2v-6h6l-2.5 2.5A4.6 4.6 0 0 0 16.7 12"/>'),
  nota: S('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  mic: S('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
  archivo: S('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 14v3M12 11v6M15 13v4"/>'),
  mano: S('<path d="M5 6h14M5 12h14M5 18h14"/><circle cx="9" cy="6" r="1.8" fill="currentColor"/><circle cx="15" cy="12" r="1.8" fill="currentColor"/><circle cx="8" cy="18" r="1.8" fill="currentColor"/>'),
  reset: S('<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 3.5v5h5"/>'),
  tabla: S('<path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/><path d="M12.5 13.5h5M12.5 16.5h3"/>'),
};
// Mosca personaje (48×46): cada parte es un segmento que se enciende.
export const FLY = `<svg viewBox="0 0 48 46" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <g data-p="alasArriba"><path d="M20.5 21C11 15 5 9 6.5 4.5c4.5 1.5 10 7 15 14"/><path d="M27.5 21C37 15 43 9 41.5 4.5c-4.5 1.5-10 7-15 14"/></g>
  <g data-p="alasAbajo"><path d="M20.5 24C11 28 6 34 7 38.5c4.5-.5 10-5.5 14.5-12"/><path d="M27.5 24C37 28 42 34 41 38.5c-4.5-.5-10-5.5-14.5-12"/></g>
  <g data-p="cuerpo"><ellipse cx="24" cy="12" rx="6" ry="8"/><path d="M18.6 9.5h10.8M18.4 13h11.2M19 16.4h10"/><circle cx="24" cy="23" r="4.4"/><circle cx="24" cy="31" r="3.8"/><circle cx="20.9" cy="31" r="1.5" fill="currentColor"/><circle cx="27.1" cy="31" r="1.5" fill="currentColor"/></g>
  <g data-p="patas"><path d="M20 21.5l-6-3.5M20 24l-6.5 1.5M20.6 26.2l-5 5.2M28 21.5l6-3.5M28 24l6.5 1.5M27.4 26.2l5 5.2"/></g>
  <g data-p="acicalar"><path d="M20.8 26.6l-2.6 5.6 3.4 3.8M27.2 26.6l2.6 5.6-3.4 3.8"/></g>
  <g data-p="antenas"><path d="M22.6 34.3l-1.7 3.4M25.4 34.3l1.7 3.4"/></g>
  <g data-p="ondas"><path d="M14.5 38.5a6 6 0 0 1-2.5-4M11 41a10 10 0 0 1-4-7M33.5 38.5a6 6 0 0 0 2.5-4M37 41a10 10 0 0 0 4-7"/></g>
  <g data-p="proboscide"><path d="M24 35v5.2"/></g>
  <g data-p="gota"><path d="M24 41.6c1 1.3 1.7 2.1 1.7 2.8a1.7 1.7 0 0 1-3.4 0c0-.7.7-1.5 1.7-2.8z" fill="currentColor"/></g>
  <g data-p="hoja"><path d="M34 27h9v12h-9z"/><path d="M36 30.5h5M36 33.5h5M36 36.5h3"/></g>
  <g data-p="notas"><path d="M40 4v6.5M40 4l4-1v6"/><circle cx="38.7" cy="10.6" r="1.4" fill="currentColor"/><circle cx="42.7" cy="9.2" r="1.4" fill="currentColor"/></g>
</svg>`;
