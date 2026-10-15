// Fly Punch · Productor IA (beta Pro). Recibe el análisis musical ya calculado en la app (tonalidad, acordes, choques,
// ajustes de las pistas) y le pide a Gemini una explicación, una progresión y ajustes. Nunca recibe datos personales:
// ni correo, ni id, ni nombres de tomas.
// Dos modos: 'productor' (armonía y ajustes) y 'mosca' («Dile a la mosca»: tu frase → lo que siente la mosca).
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
  const modo = body.modo === 'mosca' ? 'mosca' : 'productor', ctx = JSON.stringify(body.contexto ?? {}).slice(0, 6000), pedido = String(body.pedido ?? '').slice(0, 240);
  if (modo === 'mosca' && !pedido.trim()) return json({ error: 'vacio' }, 400);

  const { data: quedan, error: qe } = await admin.rpc('ia_consumir', { uid: u.user.id, por_usuario: POR_USUARIO, global_max: GLOBAL });
  if (qe) return json({ error: 'cuota' }, 500);
  if (quedan === -1) return json({ error: 'sin-consultas', de: POR_USUARIO }, 429);
  if (quedan === -2) return json({ error: 'tope-global' }, 429);

  try {
    const r = await fetch(`${Deno.env.get('GEMINI_BASE') || 'https://generativelanguage.googleapis.com'}/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: modo === 'mosca' ? SISTEMA_MOSCA : SISTEMA }] },
        contents: [{ role: 'user', parts: [{ text: modo === 'mosca' ? `Estado actual (JSON):\n${ctx}\n\nLe dicen a la mosca: ${pedido}` : `Análisis de la app (JSON):\n${ctx}\n\nLo que pide el usuario: ${pedido || '(nada en especial: propón tú)'}` }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: modo === 'mosca' ? SCHEMA_MOSCA : SCHEMA, temperature: 0.8, maxOutputTokens: 1200 },
      }),
    });
    const out = await r.json(); if (!r.ok) throw new Error(out?.error?.message || `gemini ${r.status}`);
    const p = JSON.parse(out.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
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
