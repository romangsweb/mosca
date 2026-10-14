// Fly Punch · K.O.–sidekick (EP-136). Mapa MIDI oficial (guía de Teenage Engineering, «system settings»):
//   sale del sidekick: canal 1 = tira 1, canal 2 = tira 2 · gain 20 · botón gain 21 · cue 3 · fx 14 · EQ alto 22 / medio 23 / bajo 24 · fader 7
//   (manteniendo SELECT: 25, 26, 52, 15, 27, 28, 29, 9) · pad de fuerza CC 1 en canal 3 · palanca = pitch bend canal 3
//   entra al sidekick (canal 1–2): fader 7 · gain 20 · EQ 22/23/24 · pan 10 · compresión 12 · saturación 13 · cantidad de FX 1
//   tipo de FX = program change 1–6 · parámetro de FX = pitch bend · canal 3: modo cue maestro 27, modo FX maestro 28 · CC 122 = control local
export const SK_MATCH = /EP-?136|sidekick/i;
export const SK_FX = ['Filtro', 'Delay', 'Cinta', 'Loop', 'Trémolo', 'Sirena'];
const cc = (ch, num) => ({ type: 'cc', ch, num });

// Mapa sugerido: la tira 1 es la pista Gusto (K.O. II #1) y la tira 2 la pista Oído (K.O. II #2).
// Las 4 primeras caben en Free; el resto es Pro (controles ilimitados).
export const SK_PRESET = [
  { target: 'lvl_gusto', src: cc(1, 7), label: 'Fader 1' },
  { target: 'lvl_oido', src: cc(2, 7), label: 'Fader 2' },
  { target: 'dulce', src: cc(1, 20), label: 'Gain 1' },
  { target: 'amargo', src: cc(2, 20), label: 'Gain 2' },
  { target: 'jon_dm', src: cc(1, 22), label: 'EQ alto 1' },
  { target: 'jon_f', src: cc(1, 23), label: 'EQ medio 1' },
  { target: 'jon_ce', src: cc(1, 24), label: 'EQ bajo 1' },
  { target: 'density', src: cc(2, 22), label: 'EQ alto 2' },
  { target: 'swing', src: cc(2, 23), label: 'EQ medio 2' },
  { target: 'kit_vol', src: cc(2, 24), label: 'EQ bajo 2' },
  { target: 'mute_gusto', src: cc(1, 3), label: 'Cue 1' },
  { target: 'mute_oido', src: cc(2, 3), label: 'Cue 2' },
  { target: 'mutar', src: cc(1, 14), label: 'FX 1' },
  { target: 'next', src: cc(2, 14), label: 'FX 2' },
  { target: 'play', src: cc(1, 21), label: 'Botón gain 1' },
  { target: 'rec', src: cc(2, 21), label: 'Botón gain 2' },
];

// salida: la elegida a mano → la que se llama como el sidekick → la que se llama igual que su entrada
export const skPorts = (ko, outName = null) => {
  if (!ko.access) return { input: null, output: null };
  const ins = [...ko.access.inputs.values()], outs = [...ko.access.outputs.values()], input = ins.find((p) => SK_MATCH.test(p.name)) || null;
  const output = (outName && outs.find((p) => p.name === outName)) || outs.find((p) => SK_MATCH.test(p.name)) || (input && outs.find((p) => p.name === input.name)) || null;
  return { input, output };
};

// Fly Punch → sidekick: mover su mezcla y sus efectos
export const skSend = {
  fader: (out, strip, v01) => out?.send([0xB0 | (strip - 1), 7, Math.round(Math.max(0, Math.min(1, v01)) * 127)]),
  fxAmount: (out, strip, v) => out?.send([0xB0 | (strip - 1), 1, Math.max(0, Math.min(127, Math.round(v)))]),
  fxType: (out, strip, i) => out?.send([0xC0 | (strip - 1), i]), // program change 0–5 = efectos 1–6
  local: (out, on) => [0, 1, 2].forEach((c) => out?.send([0xB0 | c, 122, on ? 127 : 0])),
};
