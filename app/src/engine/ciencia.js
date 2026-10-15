// Fly Punch · la ciencia detrás: divulgación de cada circuito, de cada clase de neurona y de neuronas concretas, y los
// mensajes con los que «la mosca te cuenta» lo que pasa mientras toca. Todo describe lo que se sabe de la mosca real;
// el modelo es una simplificación (ver «Cómo funciona el modelo»).

export const MODELO = [
  'Cada neurona del modelo es un acumulador: suma lo que le mandan sus vecinas y, cuando pasa un umbral, dispara y se descarga. Es el modelo «integra y dispara».',
  'Quién le habla a quién, y con cuánta fuerza, no lo inventamos: es el número real de sinapsis medido en FlyWire, el mapa completo del cerebro de una mosca (≈139 mil neuronas, 2024).',
  'Las excitadoras empujan y las inhibidoras (GABA y glutamato, en la mosca) frenan. El cerebro de la mosca no es una IA ni una red neuronal artificial: es la red real, con reglas sencillas (Shiu et al., Nature 2024). Las herramientas de IA de Fly Punch solo cambian lo que siente o transforman lo que tocó.',
  'Cada disparo de una neurona elegida es una nota. Por eso lo que oyes no es aleatorio: es cómo responde ese circuito a lo que le das.',
];

export const POR_QUE = 'Elegimos circuitos donde la ciencia sabe qué hace la salida: comer, limpiarse, acercarse o huir de un olor, cortejar y escapar. Así cada nota tiene un significado biológico, no es ruido al azar.';

export const SENTIDOS = {
  gusto: {
    titulo: 'Gusto: comer o no comer',
    bio: 'La mosca prueba con la probóscide —su «lengua»— y hasta con las patas. Neuronas gustativas detectan azúcar o amargo. El azúcar excita un camino que llega a MN9, la motoneurona que extiende la probóscide para comer; el amargo activa inhibidoras que la frenan.',
    salida: 'MN9 · extender la probóscide (comer)',
    musica: 'Los sensores tocan agudos, las interneuronas medios y MN9 con las motoneuronas los graves: cuando la mosca «quiere comer», suena el bajo.',
    dato: 'Con este circuito se validó el modelo: predijo qué neuronas se activan cuando la mosca prueba azúcar, y los experimentos lo confirmaron.',
    fuente: 'Shiu et al., Nature 2024',
  },
  oido: {
    titulo: 'Oído: una antena que escucha',
    bio: 'La mosca no tiene orejas: oye con la antena. El órgano de Johnston, en su base, tiene cientos de neuronas que sienten cómo vibra o se dobla. Unas responden a vibraciones rápidas, como un canto; otras a empujones lentos, como el viento o la gravedad.',
    salida: 'Neuronas descendentes del acicalamiento de las antenas',
    musica: 'Los tres grupos del órgano de Johnston entran como graves, medios y agudos de tu micrófono o de los deslizadores; la salida es el impulso de limpiarse.',
    dato: 'Cuando algo le toca o mueve la antena, la mosca se la limpia con las patas delanteras: ese reflejo empieza en estas neuronas.',
    fuente: 'Hampel et al., eLife 2015 · Shiu et al. 2024',
  },
  olfato: {
    titulo: 'Olfato: acercarse o huir',
    bio: 'Cada tipo de neurona olfativa tiene un receptor, y todas las de un tipo se juntan en un «glomérulo» del lóbulo antenal: DM1 (vinagre, fruta fermentada), V (CO₂, alarma) y DA2 (geosmina, el olor de bacterias dañinas). Neuronas de proyección llevan el olor al cuerno lateral, que decide de forma innata si acercarse o alejarse.',
    salida: 'Cuerno lateral → neuronas descendentes',
    musica: 'Vinagre, CO₂ y geosmina despiertan glomérulos distintos: cada olor pinta el patrón con sus propias neuronas.',
    dato: 'La geosmina es el olor a tierra mojada que a nosotros nos gusta; para la mosca es una alarma tan fuerte que deja de comer y de poner huevos ahí.',
    fuente: 'Stensmyr et al., Cell 2012',
  },
  cortejo: {
    titulo: 'Cortejo: tres señales y un interruptor',
    bio: 'El cortejo junta tres cosas: el canto del macho (la vibración de sus alas, que la antena capta), la feromona cVA (glomérulo DA1) y un estado interno. Las neuronas pC1 funcionan como un interruptor de ganas sociales: cuando las señales coinciden, se activan neuronas descendentes que cambian lo que hace el cuerpo.',
    salida: 'pC1 → neuronas descendentes del cortejo',
    musica: 'Canto, feromona y pC1 son tres entradas que se suman: con una sola casi no pasa nada; con las tres, el circuito se enciende.',
    dato: 'El canto del macho es un pulso con unos 35 milisegundos entre golpes; cada especie tiene su propio ritmo, y la hembra lo reconoce.',
    fuente: 'Zhou et al., Neuron 2014',
  },
  vision: {
    titulo: 'Visión: el reflejo de escape',
    bio: 'La mosca ve con miles de facetas. Detectores especializados reaccionan a algo que se acerca rápido (LPLC2 y LC4) y avisan a la fibra gigante, la neurona del escape. Otras (T4 → células HS) miden el movimiento de lado para estabilizar el vuelo, y los ocelos —tres ojitos en la frente— sienten cambios de luz.',
    salida: 'Fibra gigante (DNp01) · saltar y huir',
    musica: 'Acerca la mano a la cámara y la fibra gigante dispara: el sonido del escape. El movimiento de lado enciende las células HS.',
    dato: 'Por eso es tan difícil atrapar una mosca: del estímulo al salto pasan unos pocos milisegundos por este camino.',
    fuente: 'von Reyn et al., Nature Neurosci. 2014',
  },
};

export const CLASES = {
  sensor: ['Sensor', 'Recibe el mundo: azúcar, vibración, olor, luz. En la música: agudos, porque es lo primero que reacciona.'],
  interneurona: ['Interneurona', 'Procesa y decide dentro del cerebro. En la música: medios.'],
  descendente: ['Descendente', 'Lleva la decisión del cerebro al cordón nervioso, la «médula» de la mosca. En la música: graves.'],
  ascendente: ['Ascendente', 'Trae información del cuerpo al cerebro.'],
  motoneurona: ['Motoneurona', 'Mueve un músculo: es la acción final. En la música: graves.'],
};
export const INHIBIDORA = 'Es inhibidora: frena a otras neuronas. Suena más suave, como nota fantasma.';

// neuronas con nombre propio (tipos de FlyWire en los circuitos de la app)
export const NEURONAS = [
  [/^MN9$/, 'La motoneurona que extiende la probóscide: si dispara, la mosca come.'],
  [/^LB/, 'Neurona gustativa de una cerda del labelo, la punta de la probóscide.'],
  [/^JO-/, 'Neurona del órgano de Johnston: siente cómo vibra o se dobla la antena.'],
  [/^ORN_DM1/, 'Neurona olfativa del glomérulo DM1: huele ésteres de fruta fermentada, como el vinagre.'],
  [/^ORN_V$/, 'Neurona olfativa del glomérulo V: huele CO₂, una señal de alarma.'],
  [/^ORN_DA2/, 'Neurona olfativa del glomérulo DA2: huele geosmina, el olor de bacterias dañinas.'],
  [/^ORN_DA1/, 'Neurona olfativa del glomérulo DA1: huele la feromona cVA.'],
  [/_l?PN$|_lPN|_ilPN/, 'Neurona de proyección: lleva el olor del lóbulo antenal a centros superiores.'],
  [/^LH/, 'Neurona del cuerno lateral: decide de forma innata si un olor atrae o repele.'],
  [/^pC1/, 'pC1: el «interruptor» del estado social; integra canto y feromona.'],
  [/^LPLC2|^LC4/, 'Detector de algo que se acerca rápido (looming): avisa a la fibra gigante.'],
  [/^DNp01$/, 'La fibra gigante: la neurona del escape. Si dispara, la mosca salta.'],
  [/^T4|^T5/, 'Detector de movimiento: mide hacia dónde se mueve lo que ve.'],
  [/^HS|^H2$/, 'Célula del sistema horizontal: siente giros para estabilizar el vuelo.'],
  [/^OCG/, 'Neurona de los ocelos, los tres ojitos de la frente: sienten cambios de luz.'],
  [/^DN/, 'Neurona descendente: lleva una orden del cerebro al cuerpo.'],
];
export function describe(p) {
  const n = NEURONAS.find(([re]) => re.test(p.tipo || ''));
  return [n ? n[1] : CLASES[p.clase]?.[1] || '', p.inhibidora ? INHIBIDORA : ''].filter(Boolean).join(' ');
}

// lo que significa cada estímulo (para cuando lo mueves)
export const ESTIMULO = {
  dulce: 'Azúcar en la probóscide: excita el camino del gusto hacia MN9.',
  amargo: 'Amargo: activa inhibidoras que frenan a MN9, las ganas de comer.',
  jon_ce: 'Vibración lenta de la antena (graves): el grupo del órgano de Johnston que siente empujones y viento.',
  jon_f: 'Vibración media de la antena: otro grupo del órgano de Johnston.',
  jon_dm: 'Vibración rápida de la antena (agudos).',
  vinagre: 'Olor a fruta fermentada: despierta el glomérulo DM1, que atrae.',
  co2: 'CO₂: el glomérulo V, una alarma.',
  geosmina: 'Geosmina: el glomérulo DA2, asco y huida.',
  canto: 'El canto del macho: vibración de alas que la antena capta.',
  cva: 'La feromona cVA: glomérulo DA1.',
  deseo: 'pC1: el estado interno de ganas sociales.',
  acercar: 'Algo se acerca: LPLC2 y LC4 avisan a la fibra gigante.',
  movimiento: 'El mundo se mueve de lado: T4/T5 hasta las células HS.',
  luz: 'Cambio de luz en los ocelos.',
};

// lo que «cuenta» la mosca cuando una salida se enciende (umbral en Hz)
export const SALIDAS = {
  gusto: [40, () => 'MN9 está disparando: en una mosca real, la probóscide se extendería para comer. Por eso suena el bajo de Gusto.'],
  oido: [30, () => 'Se activaron las neuronas del acicalamiento: una mosca real se limpiaría las antenas con las patas.'],
  olfato: [30, (inp) => ((inp.vinagre || 0) >= (inp.co2 || 0) + (inp.geosmina || 0) ? 'El olor a fruta llegó al cuerno lateral: la mosca se acercaría a buscarla.' : 'Alarma en el cuerno lateral (CO₂ o geosmina): la mosca se alejaría de ahí.')],
  cortejo: [30, () => 'Canto, feromona y pC1 coinciden: se encendieron las descendentes del cortejo.'],
  vision: [25, () => '¡La fibra gigante disparó! En una mosca real, eso es un salto de escape en milisegundos.'],
};
