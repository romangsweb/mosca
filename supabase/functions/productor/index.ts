// Fly Punch · Productor IA (beta Pro). Recibe el análisis musical ya calculado en la app (tonalidad, acordes, choques,
// ajustes de las pistas) y le pide a Gemini una explicación, una progresión y ajustes. Nunca recibe datos personales:
// ni correo, ni id, ni nombres de tomas.
// Modos: 'productor' (armonía y ajustes), 'mosca' («Dile a la mosca»: tu frase → lo que siente) y 'variacion'
// (tu frase → una cadena de variaciones de la lista, aplicadas en la app), 'beat' (tu frase → un patrón de batería)
// 'mezcla' (medidas de cada pista + una referencia → niveles, EQ, filtro, saturación y envíos) y 'sonido'
// (tu descripción → parámetros del sintetizador de la app; el audio lo genera la app, no la IA).
// Secretos: GEMINI_API_KEY · opcionales: GEMINI_MODEL (gemini-3.1-flash-lite), IA_POR_USUARIO (15), IA_GLOBAL_MES (2000)
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const URL_ = Deno.env.get('SUPABASE_URL')!, MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';
const POR_USUARIO = +(Deno.env.get('IA_POR_USUARIO') || 15), GLOBAL = +(Deno.env.get('IA_GLOBAL_MES') || 2000);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const ESCALAS = ['menor_pent', 'mayor_pent', 'dorica', 'menor', 'mayor', 'frigia', 'lidia', 'mixolidia', 'armonica', 'melodica', 'frigia_dom', 'blues', 'hirajoshi', 'in_sen', 'hexatonos'];

const SISTEMA = `Eres el productor musical de Fly Punch, una app donde un cerebro simulado de mosca (conectoma FlyWire) dispara neuronas y cada disparo toca una nota. La mosca decide QUÉ notas suenan; tú no las reescribes. Tu trabajo: explicar en español claro lo que pasa en la armonía y proponer cambios que la app puede aplicar con un clic.
Reglas:
- Responde solo con el JSON pedido. Español de México, tono directo y amable, sin tecnicismos innecesarios (si usas uno, explícalo en 3–6 palabras).
- "explicacion": 2–4 frases sobre lo que tocó la mosca (tonalidad, qué tan estable, choques) y qué le falta.
- "progresion": grados de la escala de la pista (0 = I, 1 = ii, … 6 = VII), 2 a 8 compases, que den movimiento sin pelear con lo que toca la mosca. Si el usuario pide algo concreto, síguelo.
- "ajustes": solo los que cambiarías; deja fuera los demás. bpm 60–180, densidad 1–20 (más = más notas), swing 50–75, filtro 0–1 (1 = abierto), escala de esta lista: ${ESCALAS.join(', ')}; raiz 0–11 (0 = Do).
- "por_que": una frase sobre cómo suenan juntos esos cambios.`;

const SCHEMA = {
  type: 'OBJECT', required: ['explicacion', 'progresion', 'ajustes', 'por_que'],
  properties: {
    explicacion: { type: 'STRING' },
    progresion: { type: 'OBJECT', required: ['nombre', 'grados'], properties: { nombre: { type: 'STRING' }, grados: { type: 'ARRAY', items: { type: 'INTEGER' } } } },
    ajustes: { type: 'OBJECT', properties: { bpm: { type: 'INTEGER' }, densidad: { type: 'INTEGER' }, swing: { type: 'INTEGER' }, filtro: { type: 'NUMBER' }, escala: { type: 'STRING' }, raiz: { type: 'INTEGER' } } },
    por_que: { type: 'STRING' },
  },
};
// ---------- «Dile a la mosca» ----------
const ESTIMULOS = ['dulce', 'amargo', 'jon_ce', 'jon_f', 'jon_dm', 'vinagre', 'co2', 'geosmina', 'canto', 'cva', 'deseo', 'acercar', 'movimiento', 'luz'];
const SISTEMA_MOSCA = `Traduces lo que alguien le pide a una mosca de la fruta simulada (cerebro real del conectoma FlyWire) a los estímulos que siente. La mosca toca música: cada neurona que dispara toca una nota, así que lo que siente cambia cómo suena. Tú NO eliges notas: eliges qué siente.
Estímulos (0–200 Hz; 0 = nada, ~80 = medio, 150+ = fuerte):
- gusto: dulce (azúcar: ganas de comer, activa MN9), amargo (veneno: frena el comer)
- oído (órgano de Johnston): jon_ce (graves, vibración del canto), jon_f (medios), jon_dm (agudos: viento, gravedad)
- olfato: vinagre (fruta fermentada: atrae), co2 (alarma: repele), geosmina (moho: asco fuerte)
- cortejo: canto (canción del macho), cva (feromona), deseo (pC1: impulso interno de cortejar)
- visión: acercar (algo se le viene encima: huida), movimiento (el mundo se mueve: giro), luz (cambios de luz)
Otros: densidad 1–20 (milisegundos de cerebro por paso; más = más notas), intensidad 0–2 (multiplica todos los estímulos), bpm 60–180, swing 50–75, transicion_compases 0–8 (0 = de golpe).
Reglas:
- Responde solo con el JSON. "respuesta": 1–2 frases en primera persona, como si la mosca contara lo que siente ahora (con humor ligero, sin exagerar), en español de México.
- Prioriza los sentidos que SUENAN (vienen en el contexto); si pides algo de un sentido que no suena, dilo en la respuesta.
- Cambia solo lo necesario; los estímulos que no menciones se quedan como están. Para «más»/«menos», parte de los valores actuales.
- Nada de bpm ni swing salvo que el pedido hable de tempo o groove.`;
const SCHEMA_MOSCA = {
  type: 'OBJECT', required: ['respuesta', 'estimulos', 'transicion_compases'],
  properties: {
    respuesta: { type: 'STRING' },
    estimulos: { type: 'OBJECT', properties: Object.fromEntries(ESTIMULOS.map((k) => [k, { type: 'INTEGER' }])) },
    densidad: { type: 'INTEGER' }, intensidad: { type: 'NUMBER' }, bpm: { type: 'INTEGER' }, swing: { type: 'INTEGER' }, transicion_compases: { type: 'INTEGER' },
  },
};
// ---------- variaciones de una toma ----------
const OPS = ['mitad', 'doble', 'densa', 'escasa', 'invertida', 'respuesta', 'humanizar', 'cuantizar', 'transponer'];
const SISTEMA_VAR = `Conviertes lo que alguien pide para una toma musical en una cadena de 1 a 4 transformaciones de esta lista (se aplican en orden):
mitad (todo dura el doble), doble (el doble de rápido, repetido), densa (agrega repiques), escasa (quita relleno), invertida (al revés), respuesta (cada compás par contesta al anterior en espejo), humanizar (pequeñas variaciones de tiempo y fuerza), cuantizar (exacto a la semicorchea), transponer (valor = semitonos de −12 a 12, solo melodía).
Responde solo con el JSON: "nombre" (2–4 palabras para la toma nueva), "explicacion" (1 frase, español de México) y "ops". No repitas una transformación sin motivo.`;
const SCHEMA_VAR = { type: 'OBJECT', required: ['nombre', 'explicacion', 'ops'], properties: { nombre: { type: 'STRING' }, explicacion: { type: 'STRING' }, ops: { type: 'ARRAY', items: { type: 'OBJECT', required: ['op'], properties: { op: { type: 'STRING' }, valor: { type: 'INTEGER' } } } } } };
// ---------- generador de beat ----------
const VOCES = ['bombo', 'caja', 'palmas', 'hat', 'hat abierto', 'aro', 'tom', 'perc', 'bajo', 'zap'];
const KITS = ['analogo', 'lofi', 'metal', 'organico', 'insectos', 'boom', 'minimal', 'chip'];
const SISTEMA_BEAT = `Eres un productor que escribe patrones de batería para una caja de ritmos de un compás. Cada fila es una voz y una cadena de pasos (semicorcheas):
X = golpe fuerte, x = golpe normal, o = suave (fantasma), - = silencio. La cadena mide exactamente lo que diga "pasos" en el contexto.
Voces disponibles: ${VOCES.join(', ')}. Usa de 3 a 7 filas. Kits: ${KITS.join(', ')} (elige uno solo si el pedido sugiere un sonido).
Haz patrones musicales y reconocibles para el estilo pedido (boom bap, house, trap, reggaetón, techno, breakbeat…), con dinámica (no todo X). La mosca tocará encima, así que deja aire.
Responde solo con el JSON: "nombre" (2–4 palabras), "explicacion" (1 frase en español de México), "filas", y si aplica "bpm" (60–180), "swing" (50–75) y "kit".`;
const SCHEMA_BEAT = { type: 'OBJECT', required: ['nombre', 'explicacion', 'filas'], properties: { nombre: { type: 'STRING' }, explicacion: { type: 'STRING' }, bpm: { type: 'INTEGER' }, swing: { type: 'INTEGER' }, kit: { type: 'STRING' }, filas: { type: 'ARRAY', items: { type: 'OBJECT', required: ['voz', 'pasos'], properties: { voz: { type: 'STRING' }, pasos: { type: 'STRING' } } } } } };
// ---------- mezclar por mí ----------
const SISTEMA_MEZCLA = `Eres ingeniero de mezcla. Recibes medidas reales de cada pista (nivel RMS en dB y energía por banda: graves 30–150 Hz, medios 150–2k, agudos 2–6k, brillo 6–16k) y su canal actual, más una referencia de estilo.
Propón para cada pista (usa su id): nivel 0.2–1 (relativo; la más fuerte en 1), lo/mid/hi en dB de −12 a 12 (estantes en 120 Hz, campana en 1 kHz, estante en 6 kHz), filtro −1…1 (0 = abierto; negativo quita agudos, positivo quita graves), drive 0–1 (saturación), rev 0–1 y dly 0–1 (envíos).
Reglas: un solo dueño de los graves; cortes antes que realces; cambios moderados (±6 dB casi siempre basta); respeta el estilo pedido. Responde solo con el JSON: "explicacion" (2 frases, español de México) y "pistas".`;
const SCHEMA_MEZCLA = { type: 'OBJECT', required: ['explicacion', 'pistas'], properties: { explicacion: { type: 'STRING' }, pistas: { type: 'ARRAY', items: { type: 'OBJECT', required: ['id'], properties: { id: { type: 'STRING' }, nivel: { type: 'NUMBER' }, lo: { type: 'NUMBER' }, mid: { type: 'NUMBER' }, hi: { type: 'NUMBER' }, filtro: { type: 'NUMBER' }, drive: { type: 'NUMBER' }, rev: { type: 'NUMBER' }, dly: { type: 'NUMBER' } } } } } };
// ---------- diseñador de sonidos ----------
const PARAMS: [string, number, number][] = [['freq', 30, 2000], ['barrido', -48, 48], ['barrido_ms', 5, 600], ['ataque_ms', 0, 300], ['caida_ms', 20, 3000], ['ruido', 0, 1], ['ruido_color', 200, 14000], ['fm', 0, 1], ['fm_ratio', 0.5, 8], ['filtro', 100, 18000], ['resonancia', 0, 20], ['drive', 0, 1]];
const SISTEMA_SONIDO = `Eres diseñador de sonido de cajas de ritmos. Traduces una descripción a parámetros de un sintetizador sencillo: un oscilador (onda: sine, triangle, square, sawtooth) que arranca "barrido" semitonos arriba (o abajo si es negativo) de "freq" y llega a "freq" en "barrido_ms"; ruido mezclado (0–1) pasado por un filtro de banda en "ruido_color" Hz; FM opcional (fm 0–1 = cantidad, fm_ratio = razón: valores no enteros suenan metálicos); envolvente con "ataque_ms" y "caida_ms"; filtro pasa-bajos ("filtro" Hz, "resonancia" 0–20) y saturación ("drive" 0–1).
Referencias: bombo 808 ≈ sine, freq 45–60, barrido 24–36, barrido_ms 40–90, caída 600–1800. Caja ≈ triangle 180–220 Hz + ruido 0.6–0.8 en 3–5 kHz, caída 120–250. Hat ≈ ruido 0.6+ en 8–11 kHz + fm metálico, caída 30–120 (abierto 300–600).
Responde solo con el JSON: "nombre" (2–3 palabras), "explicacion" (1 frase, español de México), "voz" (la voz del kit que más se parece: ${VOCES.join(', ')}) y "params".`;
const SCHEMA_SONIDO = { type: 'OBJECT', required: ['nombre', 'explicacion', 'voz', 'params'], properties: { nombre: { type: 'STRING' }, explicacion: { type: 'STRING' }, voz: { type: 'STRING' }, params: { type: 'OBJECT', properties: { onda: { type: 'STRING' }, ...Object.fromEntries(PARAMS.map(([k]) => [k, { type: 'NUMBER' }])) } } } };
const clamp = (x: unknown, lo: number, hi: number) => (typeof x === 'number' && isFinite(x) ? Math.max(lo, Math.min(hi, x)) : undefined);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const auth = req.headers.get('Authorization') ?? '';
  const user = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await user.auth.getUser(); if (!u?.user) return json({ error: 'sin-sesion' }, 401);
  const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: pro } = await admin.rpc('is_pro', { uid: u.user.id }); if (!pro) return json({ error: 'pro' }, 403);

  let body: Record<string, unknown>; try { body = await req.json(); } catch { return json({ error: 'json' }, 400); }
  if (body.consulta === 'cuota') { const m = new Date().toISOString().slice(0, 7); const { data } = await admin.from('ia_uso').select('n').eq('user_id', u.user.id).eq('mes', m).maybeSingle(); return json({ quedan: Math.max(0, POR_USUARIO - (data?.n || 0)), de: POR_USUARIO }); }
  const modo = ['mosca', 'variacion', 'beat', 'mezcla', 'sonido'].includes(body.modo as string) ? body.modo as string : 'productor', ctx = JSON.stringify(body.contexto ?? {}).slice(0, 6000), pedido = String(body.pedido ?? '').slice(0, 240);
  if (modo !== 'productor' && modo !== 'mezcla' && !pedido.trim()) return json({ error: 'vacio' }, 400);

  const { data: quedan, error: qe } = await admin.rpc('ia_consumir', { uid: u.user.id, por_usuario: POR_USUARIO, global_max: GLOBAL });
  if (qe) return json({ error: 'cuota' }, 500);
  if (quedan === -1) return json({ error: 'sin-consultas', de: POR_USUARIO }, 429);
  if (quedan === -2) return json({ error: 'tope-global' }, 429);

  try {
    const r = await fetch(`${Deno.env.get('GEMINI_BASE') || 'https://generativelanguage.googleapis.com'}/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: modo === 'mosca' ? SISTEMA_MOSCA : modo === 'variacion' ? SISTEMA_VAR : modo === 'beat' ? SISTEMA_BEAT : modo === 'mezcla' ? SISTEMA_MEZCLA : modo === 'sonido' ? SISTEMA_SONIDO : SISTEMA }] },
        contents: [{ role: 'user', parts: [{ text: modo === 'mosca' ? `Estado actual (JSON):\n${ctx}\n\nLe dicen a la mosca: ${pedido}` : modo === 'variacion' ? `La toma (JSON):\n${ctx}\n\nVariación que piden: ${pedido}` : modo === 'beat' ? `Contexto (JSON):\n${ctx}\n\nBeat que piden: ${pedido}` : modo === 'mezcla' ? `Medidas y canales (JSON):\n${ctx}\n\nReferencia: ${pedido || 'una mezcla clara y equilibrada'}` : modo === 'sonido' ? `Sonido que piden: ${pedido}` : `Análisis de la app (JSON):\n${ctx}\n\nLo que pide el usuario: ${pedido || '(nada en especial: propón tú)'}` }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: modo === 'mosca' ? SCHEMA_MOSCA : modo === 'variacion' ? SCHEMA_VAR : modo === 'beat' ? SCHEMA_BEAT : modo === 'mezcla' ? SCHEMA_MEZCLA : modo === 'sonido' ? SCHEMA_SONIDO : SCHEMA, temperature: 0.8, maxOutputTokens: 1200 },
      }),
    });
    const out = await r.json(); if (!r.ok) throw new Error(out?.error?.message || `gemini ${r.status}`);
    const p = JSON.parse(out.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
    if (modo === 'sonido') {
      const pr = p.params || {}, params: Record<string, unknown> = { onda: ['sine', 'triangle', 'square', 'sawtooth'].includes(pr.onda) ? pr.onda : 'sine' };
      for (const [k, lo, hi] of PARAMS) { const v = clamp(pr[k], lo, hi); if (v !== undefined) params[k] = v; }
      return json({ nombre: String(p.nombre || 'Sonido').slice(0, 40), explicacion: String(p.explicacion || '').slice(0, 300), voz: VOCES.includes(p.voz) ? p.voz : 'perc', params, quedan, de: POR_USUARIO });
    }
    if (modo === 'mezcla') {
      const ids = Object.keys(((body.contexto as { pistas?: Record<string, unknown> })?.pistas) || {}), r2 = (x: unknown, lo: number, hi: number) => { const v = clamp(x, lo, hi); return v === undefined ? undefined : Math.round(v * 100) / 100; };
      const pistas = (Array.isArray(p.pistas) ? p.pistas : []).filter((x: { id?: string }) => ids.includes(x?.id as string)).map((x: Record<string, unknown>) => Object.fromEntries(Object.entries({ id: x.id, nivel: r2(x.nivel, 0.2, 1), lo: r2(x.lo, -12, 12), mid: r2(x.mid, -12, 12), hi: r2(x.hi, -12, 12), filtro: r2(x.filtro, -1, 1), drive: r2(x.drive, 0, 1), rev: r2(x.rev, 0, 1), dly: r2(x.dly, 0, 1) }).filter(([, v]) => v !== undefined)));
      if (!pistas.length) throw new Error('sin pistas');
      return json({ explicacion: String(p.explicacion || '').slice(0, 400), pistas, quedan, de: POR_USUARIO });
    }
    if (modo === 'beat') {
      const L = Math.max(4, Math.min(16, Math.round(Number((body.contexto as { pasos?: number })?.pasos) || 16)));
      const filas = (Array.isArray(p.filas) ? p.filas : []).filter((f: { voz?: string }) => VOCES.includes(f?.voz as string)).slice(0, 8)
        .map((f: { voz: string; pasos?: string }) => ({ voz: f.voz, pasos: String(f.pasos || '').replace(/[^Xxo\-]/g, '-').padEnd(L, '-').slice(0, L) })).filter((f: { pasos: string }) => /[Xxo]/.test(f.pasos));
      if (!filas.length) throw new Error('sin filas');
      return json({ nombre: String(p.nombre || 'Beat').slice(0, 40), explicacion: String(p.explicacion || '').slice(0, 300), filas, ...(clamp(p.bpm, 60, 180) ? { bpm: Math.round(clamp(p.bpm, 60, 180)!) } : {}), ...(clamp(p.swing, 50, 75) ? { swing: Math.round(clamp(p.swing, 50, 75)!) } : {}), ...(KITS.includes(p.kit) ? { kit: p.kit } : {}), quedan, de: POR_USUARIO });
    }
    if (modo === 'variacion') {
      const ops = (Array.isArray(p.ops) ? p.ops : []).filter((o: { op?: string }) => OPS.includes(o?.op as string)).slice(0, 4).map((o: { op: string; valor?: number }) => (o.op === 'transponer' ? { op: o.op, valor: Math.round(clamp(o.valor, -12, 12) ?? 0) } : { op: o.op }));
      if (!ops.length) throw new Error('sin operaciones');
      return json({ nombre: String(p.nombre || 'variación').slice(0, 40), explicacion: String(p.explicacion || '').slice(0, 300), ops, quedan, de: POR_USUARIO });
    }
    if (modo === 'mosca') {
      const est = Object.fromEntries(ESTIMULOS.map((k) => [k, clamp(p.estimulos?.[k], 0, 200)]).filter(([, v]) => v !== undefined).map(([k, v]) => [k, Math.round(v as number)]));
      const extra = { densidad: clamp(p.densidad, 1, 20), intensidad: clamp(p.intensidad, 0, 2), bpm: clamp(p.bpm, 60, 180), swing: clamp(p.swing, 50, 75) };
      return json({ respuesta: String(p.respuesta || '').slice(0, 400), estimulos: est, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)), transicion_compases: Math.round(clamp(p.transicion_compases, 0, 8) ?? 2), quedan, de: POR_USUARIO });
    }
    // lo que llega se valida: nada fuera de rango llega a la app
    const grados = (Array.isArray(p.progresion?.grados) ? p.progresion.grados : []).map((g: unknown) => clamp(g, 0, 6)).filter((g: unknown) => g !== undefined).map(Math.round).slice(0, 8);
    const a = p.ajustes || {}, ajustes = { bpm: clamp(a.bpm, 60, 180), densidad: clamp(a.densidad, 1, 20), swing: clamp(a.swing, 50, 75), filtro: clamp(a.filtro, 0, 1), escala: ESCALAS.includes(a.escala) ? a.escala : undefined, raiz: clamp(a.raiz, 0, 11) };
    return json({ explicacion: String(p.explicacion || '').slice(0, 900), progresion: grados.length >= 2 ? { nombre: String(p.progresion?.nombre || 'Progresión').slice(0, 60), grados } : null,
      ajustes: Object.fromEntries(Object.entries(ajustes).filter(([, v]) => v !== undefined)), por_que: String(p.por_que || '').slice(0, 300), quedan, de: POR_USUARIO, tokens: out.usageMetadata?.totalTokenCount ?? null });
  } catch (e) {
    await admin.rpc('ia_devolver', { uid: u.user.id }); // si falla, la consulta no cuenta
    console.error('productor', e); return json({ error: 'gemini' }, 502);
  }
});
