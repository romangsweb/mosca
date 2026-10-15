import { useState } from 'react';
import { session, SENSES, SENSE_LABEL, CIRCUITS } from '../engine/session.js';
import { FEEDS, WIKIS } from '../engine/world.js';
import { useS, useTick, Icon, Seg } from '../ui/kit.jsx';

// Mundo en vivo: el clima de tu ciudad, los sismos del planeta, Wikipedia y el mercado tocan a la mosca en tiempo real.
const ALL_SENSES = Object.entries(SENSES).flatMap(([c, ks]) => ks.map((k) => [k, `${SENSE_LABEL[k]} · ${CIRCUITS[c]?.name || c}`]));
const fmt = (v, unit) => (v == null ? '—' : `${Math.abs(v) < 10 && unit !== '°C' ? (+v).toFixed(unit === '%' && Math.abs(v) < 1 ? 2 : 1) : Math.round(v)}${unit ? ` ${unit}` : ''}`);
const STATUS_COLOR = { 'en vivo': '#3DD68C', conectando: '#FFB37A', error: '#E5484D', apagado: '#55555C' };

function SenseSelect({ value, onChange, label }) {
  const audible = new Set(session.s.tracks.filter((t) => session.audible(t)).flatMap((t) => SENSES[t.sense] || []));
  return (
    <select className="input" aria-label={label} style={{ height: 30, fontSize: 12, width: 168, flex: 'none' }} value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— nada —</option>
      {ALL_SENSES.map(([k, l]) => <option key={k} value={k}>{l}{audible.has(k) ? '' : ' (sin pista)'}</option>)}
    </select>
  );
}

function Place({ c }) {
  const [q, setQ] = useState(''), [res, setRes] = useState(null), [busy, setBusy] = useState(false);
  const search = async (e) => { e.preventDefault(); if (!q.trim()) return; setBusy(true); try { setRes(await session.world.geocode(q.trim())); } catch { setRes([]); } setBusy(false); };
  const here = () => navigator.geolocation?.getCurrentPosition((p) => { session.setMundo('clima', { lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), place: 'Mi ubicación' }); setRes(null); }, () => setRes([]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <form className="row" style={{ gap: 6 }} onSubmit={search}>
        <input className="input" style={{ height: 30, fontSize: 12, flex: 1 }} placeholder={c.place} aria-label="Ciudad" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn" style={{ height: 30 }} disabled={busy}>{busy ? '…' : 'Buscar'}</button>
        <button type="button" className="btn" style={{ height: 30 }} onClick={here} title="Usar mi ubicación">Aquí</button>
      </form>
      {res && (res.length ? res.map((r) => <button key={`${r.lat},${r.lon}`} type="button" className="btn ghost" style={{ justifyContent: 'flex-start', height: 28, fontSize: 12 }} onClick={() => { session.setMundo('clima', r.name ? { place: r.name, lat: r.lat, lon: r.lon } : {}); setRes(null); setQ(''); }}>{r.name}</button>) : <span className="dim" style={{ fontSize: 11.5 }}>No encontramos ese lugar.</span>)}
    </div>
  );
}

function Feed({ id }) {
  const s = useS(), F = FEEDS[id], c = session.world.cfg(id), st = session.world.state(id), allowed = session.feedAllowed(id);
  const on = !!c.on && allowed, recent = performance.now() - (st.lastAt || 0) < 160;
  const setMap = (k, v) => session.setMundo(id, { map: { ...c.map, [k]: v } });
  return (
    <section className="panel" style={{ gap: 12, borderColor: on ? 'var(--acc)' : undefined }}>
      <div className="between" style={{ gap: 10 }}>
        <h2 className="row" style={{ gap: 8, fontSize: 15 }}><span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 8, background: recent ? 'var(--acc)' : 'var(--screen)', color: recent ? '#0B0B0C' : '#ECECEE', transition: 'background .12s' }}><Icon name={F.icon} size={16} /></span>{F.name}{!allowed && <span className="badge-pro">PRO</span>}{F.free && <span className="chip">GRATIS</span>}</h2>
        <label className="row" style={{ gap: 8, fontSize: 12 }}><span className="mono" style={{ fontSize: 10, color: STATUS_COLOR[on ? st.status : 'apagado'] }}>● {(on ? st.status : 'apagado').toUpperCase()}</span>
          <input type="checkbox" checked={on} onChange={(e) => session.setMundo(id, { on: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--acc)' }} aria-label={`Encender ${F.name}`} /></label>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>{F.desc}</p>
      {id === 'clima' && <><span className="mono" style={{ fontSize: 11 }}>{c.place?.toUpperCase()}</span><Place c={c} /></>}
      {id === 'wiki' && <Seg label="Wikipedia" items={WIKIS} value={c.wiki} onChange={(v) => session.setMundo('wiki', { wiki: v })} />}
      {id === 'mercado' && <Seg label="Moneda" items={[['BTC-USD', 'Bitcoin'], ['ETH-USD', 'Ethereum']]} value={c.product} onChange={(v) => session.setMundo('mercado', { product: v })} />}
      {st.error && on && <span style={{ color: '#FF8A4D', fontSize: 12 }}>{st.error}</span>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(F.channels).map(([k, [label, unit]]) => (
          <div key={k} className="row" style={{ gap: 8, fontSize: 12 }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>{label}<span className="mono" style={{ fontSize: 11, color: 'var(--acc)' }}>{on ? fmt(st.raw?.[k], unit) : '—'}</span></span>
            <div aria-hidden="true" style={{ width: 54, height: 5, borderRadius: 3, background: 'var(--line)' }}><div style={{ width: `${(on ? st.vals?.[k] || 0 : 0) * 100}%`, height: '100%', borderRadius: 3, background: 'var(--acc)' }} /></div>
            <SenseSelect label={`${label} estimula`} value={c.map?.[k]} onChange={(v) => setMap(k, v)} />
          </div>
        ))}
        {Object.entries(F.events).map(([k, [label]]) => (
          <div key={k} className="row" style={{ gap: 8, fontSize: 12 }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>{label}<span className="dim" style={{ fontSize: 11 }}>cada vez → un golpe</span></span>
            <SenseSelect label={`${label} golpea`} value={c.map?.[k]} onChange={(v) => setMap(k, v)} />
          </div>
        ))}
      </div>
      {id === 'sismos' && <label className="row" style={{ gap: 8, fontSize: 12 }}><input type="checkbox" checked={c.replay !== false} onChange={(e) => session.setMundo('sismos', { replay: e.target.checked })} style={{ accentColor: 'var(--acc)' }} />Al encender, repasar los sismos de la última hora (uno cada 0.7 s)</label>}
      <span className="mono dim" style={{ fontSize: 10 }}>{on ? `${st.count || 0} EVENTOS${st.at ? ` · ACTUALIZADO ${new Date(st.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : ''}` : ' '}</span>
    </section>
  );
}

export default function Mundo() {
  const s = useS(); useTick(12);
  const log = session.world.log, any = Object.keys(FEEDS).some((id) => s.mundo?.[id]?.on);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Mundo</h1><p>Lo que pasa en el planeta ahora mismo estimula a la mosca: el clima de tu ciudad, cada sismo, cada edición de Wikipedia, cada operación de bitcoin. Elige qué sentido toca cada cosa.</p></div>
        <div className="row">
          <label className="row" style={{ gap: 8, fontSize: 12 }}>Cuánto manda el mundo<input type="range" min={0} max={150} value={Math.round((s.mundo?.mix ?? 1) * 100)} onChange={(e) => session.set({ mundo: { ...s.mundo, mix: +e.target.value / 100 } }, true)} style={{ accentColor: 'var(--acc)' }} /><span className="mono" style={{ width: 40 }}>{Math.round((s.mundo?.mix ?? 1) * 100)}%</span></label>
          <button type="button" className="btn lg acc" onClick={() => session.toggle()}><Icon name={s.playing ? 'stop' : 'play'} size={13} fill="currentColor" />{s.playing ? 'Detener' : 'Tocar'}</button>
        </div>
      </div>
      <div className="cols" style={{ alignItems: 'stretch' }}>
        <div style={{ flex: '999 1 640px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
          {Object.keys(FEEDS).map((id) => <Feed key={id} id={id} />)}
        </div>
        <section className="panel" style={{ flex: '1 1 300px', background: 'var(--screen)', color: '#ECECEE', gap: 8, maxHeight: 720, overflow: 'hidden' }} aria-label="Lo que está pasando">
          <h2 style={{ color: '#ECECEE' }}>Ahora en el mundo</h2>
          {!any && <p style={{ margin: 0, fontSize: 12, color: '#8C8C94' }}>Enciende una fuente para ver aquí cada evento que le llega a la mosca.</p>}
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {log.slice(0, 26).map((e, i) => (
              <li key={`${e.at}-${i}`} className="row" style={{ gap: 8, fontSize: 11.5, opacity: Math.max(0.35, 1 - i * 0.03) }}>
                <span className="mono" style={{ fontSize: 9.5, color: '#77777F', width: 54 }}>{new Date(e.at).toLocaleTimeString('es-MX', { hour12: false })}</span>
                <Icon name={FEEDS[e.id].icon} size={12} /><span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.label}</span>
                <span aria-hidden="true" style={{ width: 4 + e.s * 26, height: 4, borderRadius: 2, background: '#FF6A1A' }} />
              </li>
            ))}
          </ol>
        </section>
      </div>
      <p className="dim" style={{ margin: 0, fontSize: 11 }}>Fuentes públicas y gratuitas: Open-Meteo, USGS, Wikimedia EventStreams y Coinbase. Las consultas salen de tu navegador. Un estímulo solo suena si alguna pista usa ese circuito: «(sin pista)» te avisa cuándo no.</p>
    </div>
  );
}
