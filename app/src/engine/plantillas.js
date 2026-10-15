// Fly Punch · plantillas por género: un punto de partida que suena bien en 30 segundos (tempo, kit, patrón de batería en
// «Ambos» para que la mosca toque encima, escala y progresión de la melodía, lo que siente la mosca). Luego se rompe a gusto.
// Patrones: X fuerte · x normal · o fantasma · - silencio (16 pasos)
const P = (filas) => ({ len: 16, filas: Object.entries(filas).map(([voz, pasos]) => ({ voz, vels: [...pasos].map((c) => ({ X: 122, x: 98, o: 58 })[c] || 0) })) });
const NADA = { dulce: 0, amargo: 0, jon_ce: 0, jon_f: 0, jon_dm: 0, vinagre: 0, co2: 0, geosmina: 0, canto: 0, cva: 0, deseo: 0, acercar: 0, movimiento: 0, luz: 0 };
export const PLANTILLAS = [
  { id: 'house', nombre: 'House con la mosca hambrienta', desc: 'Cuatro al piso, hats a contratiempo y una melodía dórica que sube cuando la mosca huele fruta.', bpm: 124, swing: 54, kit: 'analogo', density: 5, inputs: { ...NADA, dulce: 175, vinagre: 90, jon_f: 60 },
    ritmo: P({ bombo: 'X---X---X---X---', hat: '--x---x---x---x-', palmas: '----x-------x---', perc: '-o-----o-o-----o' }),
    melodia: { scale: 'dorica', root: 57, chord: 'nota', prog: 'dos', arp: { modo: 'arriba', rate: '1/16', oct: 1 } }, armonia: { on: true, modo: 'acordes' } },
  { id: 'lofi', nombre: 'Lo-fi melancólico', desc: 'Boom bap lento con swing, acordes de séptima y la melodía filtrada, como en cinta.', bpm: 82, swing: 64, kit: 'lofi', density: 3, inputs: { ...NADA, dulce: 90, amargo: 40, jon_ce: 80, jon_f: 40 },
    ritmo: P({ bombo: 'X-----x-X--o----', caja: '----X-------X--o', hat: 'x-o-x-o-x-o-x-ox' }),
    melodia: { scale: 'menor_pent', root: 50, chord: 'septima', prog: 'epica', strip: { filtro: -0.35, hi: -3 } }, armonia: { on: true, modo: 'ambos' } },
  { id: 'techno', nombre: 'Techno nervioso', desc: 'Bombo seco, percusión que no para y un arpegio frigio: la mosca huele CO₂ y se pone en alerta.', bpm: 132, swing: 50, kit: 'metal', density: 10, inputs: { ...NADA, co2: 150, dulce: 60, jon_dm: 120 },
    ritmo: P({ bombo: 'X---X---X---X---', hat: '--x---x---x---x-', 'hat abierto': '------x-------x-', perc: 'o-o-o-o-o-o-o-o-', aro: '---x-----x--x---' }),
    melodia: { scale: 'frigia', root: 52, chord: 'nota', prog: 'ninguna', arp: { modo: 'arribaabajo', rate: '1/16', oct: 2 } }, armonia: { on: false } },
  { id: 'trap', nombre: 'Trap oscuro', desc: 'Medio tiempo, hats con redobles y una melodía armónica menor sobre un 808 largo.', bpm: 140, swing: 52, kit: 'boom', density: 6, inputs: { ...NADA, amargo: 120, geosmina: 80, jon_ce: 140 },
    ritmo: P({ bombo: 'X------x--X-----', caja: '--------X-------', hat: 'x-x-x-xxx-x-x-xx', 'hat abierto': '-----------x----' }),
    melodia: { scale: 'armonica', root: 48, chord: 'nota', prog: 'andaluza' }, armonia: { on: true, modo: 'bajo' } },
  { id: 'reggaeton', nombre: 'Reggaetón', desc: 'El dembow de siempre y una progresión pop en menor; la mosca enamorada.', bpm: 95, swing: 50, kit: 'boom', density: 5, inputs: { ...NADA, canto: 150, deseo: 140, dulce: 100 },
    ritmo: P({ bombo: 'X---X---X---X---', caja: '---x--x----x--x-', hat: 'x-x-x-x-x-x-x-x-' }),
    melodia: { scale: 'menor', root: 57, chord: 'triada', prog: 'pop' }, armonia: { on: true, modo: 'acordes' } },
  { id: 'ambiente', nombre: 'Ambiente para soñar', desc: 'Casi sin batería, arpegios lentos en dos octavas y acordes largos. La mosca tranquila.', bpm: 88, swing: 50, kit: 'organico', density: 2, inputs: { ...NADA, dulce: 60, luz: 40, jon_f: 30 },
    ritmo: P({ perc: '--o-------o-----', tom: 'x---------------', hat: '------o-------o-' }),
    melodia: { scale: 'mayor_pent', root: 60, chord: 'nota', prog: 'pop', arp: { modo: 'arribaabajo', rate: '1/8', oct: 2 }, rev: 0.45, dly: 0.3 }, armonia: { on: true, modo: 'acordes' } },
];
// qué partes necesitan Pro (para avisar antes de aplicar)
export const necesitaPro = (S, p) => [!S.kitAllowed(p.kit) && 'su kit', !S.can('melodia') && 'la melodía', p.armonia?.on && !S.can('armonia') && 'la armonía', p.melodia?.strip && !S.can('canal') && 'el canal'].filter(Boolean);
// aplica: la pista 1 (Gusto) toca la batería; la 2 (Oído) la melodía
export function aplicarPlantilla(S, p) {
  const [t1, t2] = S.s.tracks, m = p.melodia || {};
  S.batch(() => {
    S.setBpm(p.bpm); S.set({ swing: p.swing, density: p.density, inputs: { ...S.s.inputs, ...p.inputs } }, true);
    if (S.kitAllowed(p.kit)) S.setKit(p.kit);
    if (t1) { S.setTrack(t1.id, { mode: 'ritmo', mute: false, solo: false, fill: 'redoble' }); S.applyPattern(t1.id, { ...p.ritmo, nombre: p.nombre }); }
    if (t2) {
      const mel = S.can('melodia');
      S.setTrack(t2.id, { mute: false, solo: false, mode: mel ? 'melodia' : 'ritmo', play: 'vivo', ...(mel ? { scale: m.scale, root: m.root, chord: m.chord, prog: m.prog, arp: m.arp || null } : {}), rev: m.rev ?? t2.rev, dly: m.dly ?? t2.dly, ...(m.strip && S.can('canal') ? { strip: m.strip } : { strip: null }) });
    }
    if (S.can('armonia')) S.set({ armonia: { ...(S.s.armonia || {}), ...p.armonia } }, true);
  });
  if (!S.s.playing) S.toggle();
  S.tourMark('plantilla');
}
