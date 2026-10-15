// Fly Punch · enlace corto de una toma compartida (Cloudflare Pages Function): /t/<id>
// Las redes (WhatsApp, X, Facebook, iMessage…) no ejecutan JavaScript ni leen lo que va después de «#», así que esta página
// les da título, descripción e imagen (Open Graph) y a las personas las manda al instante a la app: /#/t/<id>.
// Usa las mismas variables que la app (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY) y solo lee tomas públicas.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function onRequestGet({ params, env, request }) {
  const id = String(params.id || '').toLowerCase(), origin = new URL(request.url).origin;
  if (!/^[a-z0-9]{8,16}$/.test(id)) return Response.redirect(`${origin}/`, 302);
  let t = null;
  try {
    const base = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY;
    if (base && key) { const r = await fetch(`${base}/rest/v1/takes?select=name,bpm,dur_ms,n_events,author&share_id=eq.${id}&public=eq.true&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }); if (r.ok) t = (await r.json())[0] || null; }
  } catch { /* sin vista previa, pero el enlace sigue funcionando */ }
  const app = `${origin}/#/t/${id}`, secs = t ? Math.round((t.dur_ms || 0) / 1000) : 0;
  const title = t ? `«${t.name}»${t.author ? ` de ${t.author}` : ''} · Fly Punch` : 'Fly Punch · un cerebro real de mosca toca música';
  const desc = t ? `Un cerebro real de mosca tocó esta música: ${t.bpm} BPM · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} · ${t.n_events} notas. Escúchala y mira el cerebro tocando.` : 'Escucha la toma y mira el cerebro de la mosca tocando.';
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta property="og:type" content="music.song"><meta property="og:site_name" content="Fly Punch"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(`${origin}/t/${id}`)}"><meta property="og:image" content="${origin}/og/toma.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Un cerebro de mosca tocando música">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${origin}/og/toma.jpg">
<meta http-equiv="refresh" content="0;url=${esc(app)}"><link rel="canonical" href="${esc(`${origin}/t/${id}`)}">
<style>body{margin:0;background:#0B0B0C;color:#ECECEE;font:15px/1.5 Inter,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}a{color:#FF6A1A}</style></head>
<body><p>Abriendo la toma… <a href="${esc(app)}">Ábrela aquí</a></p><script>location.replace(${JSON.stringify(app)})</script></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
