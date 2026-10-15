import { useEffect, useMemo, useRef, useState } from 'react';
import { session } from '../engine/session.js';
import { compas } from '../engine/compas.js';
import { NOTE_NAMES } from '../engine/devices.js';
import { useS, Icon, Seg } from './kit.jsx';

// Editor de notas de una toma: mover, borrar, agregar, cuantizar y cambiar la fuerza de lo que tocó la mosca.
// No toca la original: guarda una toma nueva.
const ROW = 20, LABEL = 128, VEL_H = 64;
const GRIDS = [['0.5', '1/32'], ['1', '1/16'], ['2', '1/8'], ['4', '1/4']];
const noteName = (n) => `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
let uid = 0;

export default function NoteEditor({ take, onClose }) {
  useS();
  const stepMs = 60000 / (take.bpm || 110) / 4, C = compas(take.compas);
  const [evs, setEvs] = useState(() => take.events.map((e) => ({ ...e, _id: ++uid })));
  const [hist, setHist] = useState({ past: [], fut: [] });
  const [tid, setTid] = useState(take.tracks[0]?.id), [sel, setSel] = useState(() => new Set());
  const [grid, setGrid] = useState('1'), [snap, setSnap] = useState(true), [strength, setStrength] = useState(100), [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(false), [saving, setSaving] = useState(false), [msg, setMsg] = useState(null), [, force] = useState(0);
  const cv = useRef(null), vcv = useRef(null), drag = useRef(null), scroller = useRef(null);
  const W = 22 * zoom, gridSteps = +grid;
  const tr = take.tracks.find((t) => t.id === tid) || take.tracks[0];
  const mine = evs.filter((e) => e.track === tr.id), melodic = mine.some((e) => e.voice === 'tono');
  const steps = Math.max(C.len * 2, Math.ceil(Math.max(take.durMs, ...evs.map((e) => e.t + stepMs)) / stepMs) + C.len);

  // filas: en ritmo, los 12 pads (con su neurona y sonido); en melodía, las notas que se usaron (con margen)
  const rows = useMemo(() => {
    if (melodic) {
      const ns = mine.map((e) => e.note), hi = Math.max(...ns, 60) + 2, lo = Math.min(...ns, 48) - 2;
      return Array.from({ length: hi - lo + 1 }, (_, i) => { const n = hi - i; return { key: n, label: noteName(n), black: [1, 3, 6, 8, 10].includes(((n % 12) + 12) % 12) }; });
    }
    const cur = session.track(tr.id), pads = cur ? session.pads(cur) : [];
    return Array.from({ length: 12 }, (_, k) => {
      const ex = mine.find((e) => e.pad === k), r = cur ? session.route(cur, k) : {};
      return { key: k, label: ex?.neuron || pads[k]?.tipo || `Pad ${k + 1}`, voice: ex?.voice || r.voice || 'perc', note: ex?.note ?? r.note ?? 36 + k, ch: ex?.ch ?? cur?.ch ?? 1 };
    });
  }, [tr.id, melodic, evs.length]);
  const rowOf = (e) => rows.findIndex((r) => r.key === (melodic ? e.note : e.pad));

  const commit = (next) => { setHist((h) => ({ past: [...h.past.slice(-60), evs], fut: [] })); setEvs(next); };
  const undo = () => setHist((h) => { if (!h.past.length) return h; setEvs(h.past[h.past.length - 1]); return { past: h.past.slice(0, -1), fut: [evs, ...h.fut] }; });
  const redo = () => setHist((h) => { if (!h.fut.length) return h; setEvs(h.fut[0]); return { past: [...h.past, evs], fut: h.fut.slice(1) }; });
  const targets = () => (sel.size ? mine.filter((e) => sel.has(e._id)) : mine);
  const del = () => { if (!sel.size) return; commit(evs.filter((e) => !sel.has(e._id))); setSel(new Set()); };
  const quantize = () => {
    const ids = new Set(targets().map((e) => e._id)), g = gridSteps * stepMs, k = strength / 100;
    commit(evs.map((e) => (ids.has(e._id) ? { ...e, t: Math.max(0, e.t + (Math.round(e.t / g) * g - e.t) * k) } : e)));
  };
  // cambiar de fila: en ritmo cambia el pad (y su nota y sonido); en melodía cambia la nota
  const toRow = (e, ri) => { const r = rows[Math.max(0, Math.min(rows.length - 1, ri))]; return melodic ? { ...e, note: r.key } : { ...e, pad: r.key, note: r.note, voice: r.voice, neuron: r.label }; };

  // ---------- dibujo ----------
  useEffect(() => {
    const c = cv.current, g = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio), w = steps * W, h = rows.length * ROW;
    c.width = w * dpr; c.height = h * dpr; c.style.width = `${w}px`; c.style.height = `${h}px`; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0E0E10'; g.fillRect(0, 0, w, h);
    rows.forEach((r, i) => { if (r.black || i % 2) { g.fillStyle = r.black ? '#141418' : '#121215'; g.fillRect(0, i * ROW, w, ROW); } });
    for (let s = 0; s <= steps; s++) { const bar = s % C.len === 0, beat = C.pulsos.includes(s % C.len); g.fillStyle = bar ? 'rgba(255,255,255,.22)' : beat ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.035)'; g.fillRect(Math.round(s * W), 0, 1, h); }
    const d = drag.current;
    for (const e of mine) {
      let x = (e.t / stepMs) * W, ri = rowOf(e);
      if (d?.mode === 'move' && sel.has(e._id)) { x = (d.preview.get(e._id).t / stepMs) * W; ri = d.preview.get(e._id).ri; }
      if (ri < 0) continue;
      const on = sel.has(e._id), a = 0.35 + (e.vel / 127) * 0.65, wd = melodic ? Math.max(6, W * 0.9) : Math.max(5, Math.min(W * 0.75, 14));
      g.fillStyle = on ? `rgba(236,236,238,${a})` : e.chord ? `rgba(125,147,178,${a})` : `rgba(255,106,26,${a})`; g.fillRect(x + 1, ri * ROW + 3, wd, ROW - 6);
      if (on) { g.strokeStyle = '#FFFFFF'; g.lineWidth = 1; g.strokeRect(x + 1.5, ri * ROW + 3.5, wd - 1, ROW - 7); }
    }
    if (d?.mode === 'box') { g.fillStyle = 'rgba(255,106,26,.12)'; g.strokeStyle = 'rgba(255,106,26,.8)'; const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1); g.fillRect(x, y, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0)); g.strokeRect(x + 0.5, y + 0.5, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0)); }
    if (playing && session.takeT0) { const px = ((performance.now() - session.takeT0) / stepMs) * W; g.fillStyle = '#ECECEE'; g.fillRect(px, 0, 1.5, h); }
    // fuerza (velocidad)
    const v = vcv.current, vg = v.getContext('2d'); v.width = w * dpr; v.height = VEL_H * dpr; v.style.width = `${w}px`; v.style.height = `${VEL_H}px`; vg.setTransform(dpr, 0, 0, dpr, 0, 0);
    vg.fillStyle = '#0B0B0C'; vg.fillRect(0, 0, w, VEL_H);
    for (const e of mine) { const x = (e.t / stepMs) * W, hh = (e.vel / 127) * (VEL_H - 6); vg.fillStyle = sel.has(e._id) ? '#ECECEE' : 'rgba(255,106,26,.85)'; vg.fillRect(x + 1, VEL_H - hh, 3, hh); }
  });
  useEffect(() => { if (!playing) return; let raf; const f = () => { force((x) => x + 1); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, [playing]);

  // ---------- ratón ----------
  const pos = (ev) => { const r = cv.current.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  const hit = (x, y) => { const ri = Math.floor(y / ROW); for (let i = mine.length - 1; i >= 0; i--) { const e = mine[i], ex = (e.t / stepMs) * W, wd = melodic ? Math.max(6, W * 0.9) : Math.max(5, Math.min(W * 0.75, 14)); if (rowOf(e) === ri && x >= ex - 2 && x <= ex + wd + 3) return e; } return null; };
  const down = (ev) => {
    ev.currentTarget.setPointerCapture(ev.pointerId); const [x, y] = pos(ev), e = hit(x, y);
    if (e) {
      let s2 = sel; if (ev.shiftKey) { s2 = new Set(sel); s2.has(e._id) ? s2.delete(e._id) : s2.add(e._id); } else if (!sel.has(e._id)) s2 = new Set([e._id]);
      setSel(s2); drag.current = { mode: 'move', x0: x, y0: y, preview: new Map(mine.filter((m) => s2.has(m._id)).map((m) => [m._id, { t: m.t, ri: rowOf(m) }])), moved: false, ids: s2 };
    } else { if (!ev.shiftKey) setSel(new Set()); drag.current = { mode: 'box', x0: x, y0: y, x1: x, y1: y, base: ev.shiftKey ? new Set(sel) : new Set() }; }
  };
  const move = (ev) => {
    const d = drag.current; if (!d) return; const [x, y] = pos(ev);
    if (d.mode === 'move') {
      const g = gridSteps * stepMs, dtRaw = ((x - d.x0) / W) * stepMs, dt = snap ? Math.round(dtRaw / g) * g : dtRaw, dr = Math.round((y - d.y0) / ROW);
      d.moved = d.moved || Math.abs(x - d.x0) > 3 || Math.abs(y - d.y0) > 3;
      for (const m of mine) if (d.ids.has(m._id)) d.preview.set(m._id, { t: Math.max(0, m.t + dt), ri: rowOf(m) + dr });
    } else { d.x1 = x; d.y1 = y; const t0 = (Math.min(d.x0, x) / W) * stepMs, t1 = (Math.max(d.x0, x) / W) * stepMs, r0 = Math.floor(Math.min(d.y0, y) / ROW), r1 = Math.floor(Math.max(d.y0, y) / ROW);
      setSel(new Set([...d.base, ...mine.filter((m) => m.t >= t0 - stepMs * 0.3 && m.t <= t1 && rowOf(m) >= r0 && rowOf(m) <= r1).map((m) => m._id)])); }
    force((x) => x + 1); // redibujar
  };
  const up = () => {
    const d = drag.current; drag.current = null; if (!d) return;
    if (d.mode === 'move' && d.moved) commit(evs.map((e) => { const p = d.preview.get(e._id); return p && d.ids.has(e._id) ? toRow({ ...e, t: p.t }, p.ri) : e; }));
    else force((x) => x + 1);
  };
  const dbl = (ev) => {
    const [x, y] = pos(ev); if (hit(x, y)) return; const g = gridSteps * stepMs, tRaw = (x / W) * stepMs, t = snap ? Math.floor(tRaw / g) * g : tRaw, ri = Math.floor(y / ROW);
    const base = mine[0] || { track: tr.id, ch: tr.ch ?? 1, vel: 100, voice: 'perc', pad: 0, note: 36 }, e = toRow({ ...base, _id: ++uid, t, vel: 100, chord: undefined, track: tr.id }, ri);
    commit([...evs, e]); setSel(new Set([e._id]));
  };
  const velAt = (ev) => {
    const r = vcv.current.getBoundingClientRect(), x = ev.clientX - r.left, v = Math.max(1, Math.min(127, Math.round((1 - (ev.clientY - r.top) / VEL_H) * 127)));
    const near = (sel.size ? mine.filter((e) => sel.has(e._id)) : mine).filter((e) => Math.abs((e.t / stepMs) * W - x) < Math.max(6, W / 2));
    if (!near.length) return null; const ids = new Set(near.map((e) => e._id)); return evs.map((e) => (ids.has(e._id) ? { ...e, vel: v } : e));
  };
  const vDown = (ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); const n = velAt(ev); if (n) { commit(n); drag.current = { mode: 'vel' }; } };
  const vMove = (ev) => { if (drag.current?.mode !== 'vel') return; const n = velAt(ev); if (n) setEvs(n); };

  // ---------- teclado ----------
  useEffect(() => {
    const k = (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') { if (sel.size) setSel(new Set()); else onClose(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(); }
      else if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key === 'a') { e.preventDefault(); setSel(new Set(mine.map((m) => m._id))); }
      else if (e.key === 'q' || e.key === 'Q') quantize();
      else if (sel.size && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault(); const dt = e.key === 'ArrowLeft' ? -gridSteps * stepMs : e.key === 'ArrowRight' ? gridSteps * stepMs : 0, dr = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        commit(evs.map((m) => (sel.has(m._id) ? toRow({ ...m, t: Math.max(0, m.t + dt) }, rowOf(m) + dr) : m)));
      }
      e.stopPropagation();
    };
    addEventListener('keydown', k, true); return () => removeEventListener('keydown', k, true);
  });
  useEffect(() => () => session.stopTake(), []);

  const edited = () => { const out = evs.map(({ _id, ...e }) => ({ ...e, step: Math.round(e.t / stepMs) })).sort((a, b) => a.t - b.t); return { ...take, events: out, durMs: Math.max(take.durMs, (out.at(-1)?.t || 0) + stepMs * 2) }; };
  const preview = () => { if (playing) { session.stopTake(); setPlaying(false); return; } session.playTake(edited(), () => setPlaying(false)); setPlaying(true); };
  const save = async () => { setSaving(true); try { const id = await session.saveEditedTake(take, edited()); setMsg(id ? 'Guardada como toma nueva.' : 'Llegaste al límite de tomas del plan Free.'); if (id) setTimeout(() => onClose(id), 700); } catch { setMsg('No se pudo guardar.'); } setSaving(false); };
  const changed = hist.past.length > 0;

  return (
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label={`Editar notas de ${take.name}`}>
      <div className="modal" style={{ width: 'min(1320px, calc(100vw - 32px))', maxWidth: 'none', maxHeight: 'calc(100vh - 32px)', gap: 12 }}>
        <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div><h2 style={{ fontSize: 18 }}>Editar notas · {take.name}</h2><span className="muted" style={{ fontSize: 12 }}>Arrastra para mover · doble clic agrega · Supr borra · Q cuantiza · ⌘Z deshace · Mayús+clic suma a la selección</span></div>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn" onClick={preview}><Icon name={playing ? 'stop' : 'play'} size={12} fill="currentColor" />{playing ? 'Detener' : 'Escuchar'}</button>
            <button type="button" className="iconbtn" aria-label="Deshacer" disabled={!hist.past.length} onClick={undo}><Icon name="deshacer" size={14} /></button>
            <button type="button" className="btn" onClick={() => onClose()}>Cerrar</button>
            <button type="button" className="btn primary" disabled={!changed || saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar como toma nueva'}</button>
          </div>
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {take.tracks.length > 1 && <Seg label="Pista" items={take.tracks.map((t) => [t.id, t.name])} value={tr.id} onChange={(v) => { setTid(v); setSel(new Set()); }} />}
          <span className="row" style={{ gap: 6, fontSize: 12 }}>Rejilla<Seg label="Rejilla" items={GRIDS} value={grid} onChange={setGrid} /></span>
          <label className="row" style={{ gap: 6, fontSize: 12 }}><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} style={{ accentColor: 'var(--acc)' }} />Imán</label>
          <span className="row" style={{ gap: 6, fontSize: 12 }}>Fuerza<input type="range" min={10} max={100} step={10} value={strength} onChange={(e) => setStrength(+e.target.value)} style={{ width: 90, accentColor: 'var(--acc)' }} /><span className="mono" style={{ width: 36 }}>{strength}%</span></span>
          <button type="button" className="btn" onClick={quantize} title="Lleva las notas a la rejilla (Q). Con fuerza menor a 100 % conserva algo del groove original.">Cuantizar {sel.size ? `${sel.size} notas` : 'todo'}</button>
          <button type="button" className="btn" disabled={!sel.size} onClick={del}><Icon name="basura" size={13} />Borrar</button>
          <span className="row" style={{ gap: 6, fontSize: 12, marginLeft: 'auto' }}>Zoom<input type="range" min={0.5} max={2.5} step={0.25} value={zoom} onChange={(e) => setZoom(+e.target.value)} style={{ width: 80, accentColor: 'var(--acc)' }} /></span>
        </div>
        <div style={{ display: 'flex', minHeight: 0, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ width: LABEL, flex: 'none', background: 'var(--screen)', borderRight: '1px solid rgba(255,255,255,.08)' }}>
            {rows.map((r) => <div key={r.key} className="mono" style={{ height: ROW, lineHeight: `${ROW}px`, padding: '0 8px', fontSize: 10, color: r.black ? '#8C8C94' : '#C4C4CA', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: r.black ? '#141418' : undefined }} title={r.voice ? `${r.label} · ${r.voice}` : r.label}>{r.label}{r.voice && <span style={{ color: '#55555C' }}> · {r.voice}</span>}</div>)}
            <div className="mono" style={{ height: VEL_H, padding: 8, fontSize: 9.5, color: '#77777F', borderTop: '1px solid rgba(255,255,255,.08)' }}>FUERZA<br />arrastra</div>
          </div>
          <div ref={scroller} style={{ overflow: 'auto', flex: 1, maxHeight: 'calc(100vh - 260px)' }}>
            <canvas ref={cv} style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onDoubleClick={dbl} aria-label="Notas de la pista" />
            <canvas ref={vcv} style={{ display: 'block', cursor: 'ns-resize', touchAction: 'none', borderTop: '1px solid rgba(255,255,255,.08)' }} onPointerDown={vDown} onPointerMove={vMove} onPointerUp={() => (drag.current = null)} aria-label="Fuerza de cada nota" />
          </div>
        </div>
        <div className="between mono" style={{ fontSize: 10.5, color: 'var(--dim)' }}>
          <span>{mine.length} NOTAS EN {tr.name.toUpperCase()} · {sel.size} SELECCIONADAS · {C.name} · {take.bpm} BPM</span>
          <span aria-live="polite" style={{ color: 'var(--acc)' }}>{msg}</span>
        </div>
      </div>
    </div>
  );
}
