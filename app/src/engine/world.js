// Fly Punch · Mundo en vivo: datos reales del mundo como estímulos de la mosca.
// Cada fuente da «canales» (valores que cambian despacio: temperatura, viento…) y «eventos» (cosas que pasan: un sismo,
// una edición en Wikipedia, una compra de bitcoin). Un canal fija un estímulo; un evento le da un golpe que se apaga solo.
// Todas las fuentes son públicas, gratuitas y sin clave; las peticiones salen de tu navegador (nada pasa por nuestro servidor).

export const FEEDS = {
  clima: {
    name: 'Clima', icon: 'sol', free: true,
    desc: 'El clima de tu ciudad ahora (Open-Meteo). Cambia despacio: úsalo como el estado de ánimo de la mosca.',
    channels: { temp: ['Temperatura', '°C', -5, 40], viento: ['Viento', 'km/h', 0, 60], rafagas: ['Ráfagas', 'km/h', 0, 90], lluvia: ['Lluvia', 'mm', 0, 8], humedad: ['Humedad', '%', 0, 100], nubes: ['Nubes', '%', 0, 100] },
    events: {},
    defaults: { map: { temp: 'dulce', viento: 'jon_ce', lluvia: 'amargo' }, place: 'Ciudad de México', lat: 19.43, lon: -99.13 },
  },
  sismos: {
    name: 'Sismos', icon: 'sismo',
    desc: 'Cada sismo del planeta en la última hora (USGS). Un golpe por sismo, más fuerte cuanto mayor la magnitud.',
    channels: { actividad: ['Sismos en la última hora', '', 0, 30] },
    events: { sismo: ['Cada sismo'] },
    defaults: { map: { sismo: 'amargo', actividad: 'co2' }, replay: true },
  },
  wiki: {
    name: 'Wikipedia en vivo', icon: 'wiki',
    desc: 'Cada edición que alguien hace ahora mismo en Wikipedia (Wikimedia EventStreams). Personas y bots, por separado.',
    channels: { ritmo: ['Ediciones por segundo', '/s', 0, 6] },
    events: { persona: ['Edición de una persona'], bot: ['Edición de un bot'], nueva: ['Artículo nuevo'] },
    defaults: { map: { persona: 'jon_dm', bot: 'jon_f', nueva: 'deseo' }, wiki: 'eswiki' },
  },
  mercado: {
    name: 'Bitcoin en vivo', icon: 'mercado',
    desc: 'Cada operación de bitcoin en Coinbase. Compras y ventas como golpes; el movimiento del precio como estímulo.',
    channels: { tendencia: ['Movimiento del precio (5 min)', '%', -0.5, 0.5] },
    events: { compra: ['Compra'], venta: ['Venta'] },
    defaults: { map: { compra: 'dulce', venta: 'amargo' }, product: 'BTC-USD' },
  },
};
export const WIKIS = [['eswiki', 'Español'], ['enwiki', 'Inglés'], ['all', 'Todas (muy rápido)']];
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const norm = (v, lo, hi) => clamp01((v - lo) / (hi - lo));

export class World {
  constructor(session) { this.S = session; this.st = {}; this.pulses = []; this.log = []; this.timers = {}; this.conns = {}; this.replayQ = []; }
  cfg(id) { return { ...FEEDS[id].defaults, ...(this.S.s.mundo?.[id] || {}) }; }
  state(id) { return (this.st[id] ||= { status: 'apagado', vals: {}, raw: {}, count: 0, at: 0 }); }
  set(id, patch) { Object.assign(this.state(id), patch); this.S.emit(); }
  // un evento: golpe al estímulo asignado y una línea en la bitácora
  event(id, ev, strength, label) {
    const st = this.state(id); st.count++; st.lastAt = performance.now();
    const sense = this.cfg(id).map?.[ev]; if (sense) this.pulses.push({ sense, s: clamp01(strength) * (this.S.s.mundo?.mix ?? 1), at: performance.now() });
    this.log.unshift({ id, ev, label, at: Date.now(), s: strength }); if (this.log.length > 40) this.log.length = 40;
  }
  // se llama en cada paso: canales fijan el estímulo, los golpes se suman y se apagan en ~300 ms
  apply(r) {
    const now = performance.now(), mix = this.S.s.mundo?.mix ?? 1;
    for (const id of Object.keys(FEEDS)) {
      const c = this.cfg(id); if (!c.on || !this.S.feedAllowed(id)) continue; const st = this.state(id);
      for (const [ch, sense] of Object.entries(c.map || {})) if (FEEDS[id].channels[ch] && sense && st.vals[ch] != null) r[sense] = st.vals[ch] * 200 * mix;
    }
    this.pulses = this.pulses.filter((p) => now - p.at < 600);
    const add = {}; for (const p of this.pulses) { const k = Math.exp(-(now - p.at) / 180); add[p.sense] = (add[p.sense] || 0) + p.s * 200 * k; }
    for (const [k, v] of Object.entries(add)) r[k] = (r[k] || 0) + Math.min(260, v);
    return r;
  }
  start(id) {
    this.stop(id); const c = this.cfg(id); this.set(id, { status: 'conectando', error: null });
    try { this[`start_${id}`](c); } catch (e) { this.set(id, { status: 'error', error: String(e.message || e) }); }
  }
  stop(id) {
    clearInterval(this.timers[id]); clearInterval(this.timers[`${id}2`]); this.timers[id] = null;
    const k = this.conns[id]; if (k) { try { k.close(); } catch {} this.conns[id] = null; }
    if (id === 'sismos') this.replayQ = [];
    if (this.st[id]) this.set(id, { status: 'apagado' });
  }
  syncAll() { for (const id of Object.keys(FEEDS)) { const on = this.cfg(id).on && (FEEDS[id].free || this.S.can('mundo')); const running = this.state(id).status !== 'apagado'; if (on && !running) this.start(id); if (!on && running) this.stop(id); } }

  // ---------- clima (Open-Meteo) ----------
  start_clima(c) {
    const load = async () => {
      try {
        const q = new URLSearchParams({ latitude: c.lat, longitude: c.lon, current: 'temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,wind_gusts_10m', timezone: 'auto' });
        const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?${q}`)).json(), cur = j.current; if (!cur) throw new Error(j.reason || 'sin datos');
        const raw = { temp: cur.temperature_2m, viento: cur.wind_speed_10m, rafagas: cur.wind_gusts_10m, lluvia: cur.precipitation, humedad: cur.relative_humidity_2m, nubes: cur.cloud_cover };
        const vals = Object.fromEntries(Object.entries(raw).map(([k, v]) => { const [, , lo, hi] = FEEDS.clima.channels[k]; return [k, norm(v, lo, hi)]; }));
        this.set('clima', { status: 'en vivo', raw, vals, at: Date.now(), error: null });
      } catch (e) { this.set('clima', { status: 'error', error: 'No se pudo leer el clima' }); }
    };
    load(); this.timers.clima = setInterval(load, 10 * 60 * 1000);
  }
  async geocode(name) {
    const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name, count: 5, language: 'es' })}`)).json();
    return (j.results || []).map((x) => ({ name: [x.name, x.admin1, x.country].filter(Boolean).join(', '), lat: x.latitude, lon: x.longitude }));
  }

  // ---------- sismos (USGS) ----------
  start_sismos(c) {
    const seen = this.seen ||= new Set(); let first = true;
    const load = async () => {
      try {
        const j = await (await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson')).json(), fs = j.features || [];
        const n = fs.length, raw = { actividad: n }, vals = { actividad: norm(n, 0, 30) };
        const fresh = fs.filter((f) => !seen.has(f.id)).sort((a, b) => a.properties.time - b.properties.time); fresh.forEach((f) => seen.add(f.id));
        const ev = (f) => this.event('sismos', 'sismo', norm(f.properties.mag ?? 1, 0, 6), `M${(f.properties.mag ?? 0).toFixed(1)} · ${f.properties.place || 'sin lugar'}`);
        // la primera vez: los de la última hora se reparten en un compás largo para que se escuchen; después, en vivo
        if (first && c.replay) { first = false; this.replayQ = fresh.slice(-24); } else { first = false; fresh.forEach(ev); }
        this.set('sismos', { status: 'en vivo', raw, vals, at: Date.now(), error: null, last: fs[0]?.properties });
      } catch { this.set('sismos', { status: 'error', error: 'No se pudo leer USGS' }); }
    };
    load(); this.timers.sismos = setInterval(load, 60 * 1000);
    this.timers.sismos2 = setInterval(() => { const f = this.replayQ.shift(); if (f) this.event('sismos', 'sismo', norm(f.properties.mag ?? 1, 0, 6), `M${(f.properties.mag ?? 0).toFixed(1)} · ${f.properties.place || ''}`); }, 700);
  }

  // ---------- Wikipedia (EventStreams, SSE) ----------
  start_wiki(c) {
    const es = new EventSource('https://stream.wikimedia.org/v2/stream/recentchange'); this.conns.wiki = es; const times = [];
    es.onopen = () => this.set('wiki', { status: 'en vivo', error: null });
    es.onerror = () => this.set('wiki', { status: es.readyState === 2 ? 'error' : 'conectando', error: es.readyState === 2 ? 'Se cortó la conexión' : null });
    es.onmessage = (m) => {
      let d; try { d = JSON.parse(m.data); } catch { return; }
      if (c.wiki !== 'all' && d.wiki !== c.wiki) return; if (d.type !== 'edit' && d.type !== 'new') return;
      const now = performance.now(); times.push(now); while (times.length && now - times[0] > 5000) times.shift();
      const st = this.state('wiki'); if (st.status !== 'en vivo') { st.status = 'en vivo'; st.error = null; } st.raw = { ritmo: times.length / 5 }; st.vals = { ritmo: norm(times.length / 5, 0, 6) };
      const size = Math.abs((d.length?.new || 0) - (d.length?.old || 0)), s = 0.25 + 0.75 * norm(Math.log10(1 + size), 0, 4);
      this.event('wiki', d.type === 'new' ? 'nueva' : d.bot ? 'bot' : 'persona', s, `${d.type === 'new' ? 'Nuevo' : d.bot ? 'Bot' : 'Edición'} · ${d.title}`);
    };
  }

  // ---------- mercado (Coinbase, WebSocket) ----------
  start_mercado(c) {
    const ws = new WebSocket('wss://ws-feed.exchange.coinbase.com'); this.conns.mercado = ws; const prices = [];
    ws.onopen = () => { ws.send(JSON.stringify({ type: 'subscribe', product_ids: [c.product || 'BTC-USD'], channels: ['matches'] })); this.set('mercado', { status: 'en vivo', error: null }); };
    ws.onerror = () => this.set('mercado', { status: 'error', error: 'No se pudo conectar a Coinbase' });
    ws.onclose = () => { if (this.conns.mercado === ws && this.cfg('mercado').on) setTimeout(() => this.conns.mercado === ws && this.start('mercado'), 3000); };
    let lastEv = 0;
    ws.onmessage = (m) => {
      let d; try { d = JSON.parse(m.data); } catch { return; } if (d.type !== 'match') return;
      const p = +d.price, now = performance.now(); prices.push([now, p]); while (prices.length && now - prices[0][0] > 300000) prices.shift();
      const ch = prices.length > 1 ? ((p - prices[0][1]) / prices[0][1]) * 100 : 0, st = this.state('mercado');
      st.raw = { tendencia: ch, precio: p }; st.vals = { tendencia: norm(ch, -0.5, 0.5) };
      if (now - lastEv < 60) return; lastEv = now; // como mucho ~16 golpes por segundo
      const usd = p * +d.size; this.event('mercado', d.side === 'buy' ? 'venta' : 'compra', 0.2 + 0.8 * norm(Math.log10(1 + usd), 1, 6), `${d.side === 'buy' ? 'Venta' : 'Compra'} · $${Math.round(usd).toLocaleString('es-MX')}`); // en Coinbase «side» es el lado de quien dejó la orden
    };
  }
}
