import { useRef, useState } from 'react';
import { session, SENSE_LABEL } from '../engine/session.js';
import { parseCSV, demoCSV } from '../engine/data.js';
import { useS, useTick, Icon } from '../ui/kit.jsx';

const TARGETS = [['dulce', 'Dulce', 'Lo que quieres que la mosca "quiera comer".', 'var(--acc)'], ['amargo', 'Amargo', 'Lo que debería frenarla. Si domina, MN9 se apaga.', 'var(--steel)'], ['jon_ce', 'Graves (oído)', 'Vibración lenta en la antena.', 'var(--steel)'], ['jon_f', 'Medios (oído)', 'La zona de la voz.', 'var(--white)'], ['jon_dm', 'Agudos (oído)', 'Brillos y chasquidos.', 'var(--acc)']];

function Chart({ data, map }) {
  useTick(6);
  const W = 720, H = 220, n = data.rows, row = session.s.row, x = (i) => (n < 2 ? 0 : (i / (n - 1)) * W);
  const line = (vals, k = 1) => vals.map((v, i) => `${x(i).toFixed(1)},${(H - 14 - Math.min(1, v * k) * (H - 30)).toFixed(1)}`).join(' ');
  const hist = session.live.rowHist, played = Array.from({ length: n }, (_, i) => i).filter((i) => hist[i] != null);
  const used = TARGETS.filter(([k]) => map[k] !== undefined && map[k] !== '');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Valor de cada columna asignada y respuesta de MN9 por fila">
      <line x1="0" y1={H - 14} x2={W} y2={H - 14} stroke="rgba(255,255,255,.12)" />
      {used.map(([k, , , c]) => <polyline key={k} points={line(data.cols[map[k]].norm)} fill="none" stroke={c} strokeWidth="1.4" strokeDasharray="4 4" opacity="0.8" />)}
      <polyline points={played.map((i) => `${x(i).toFixed(1)},${(H - 14 - Math.min(1, hist[i] / 80) * (H - 30)).toFixed(1)}`).join(' ')} fill="none" stroke="#FF6A1A" strokeWidth="2.6" strokeLinejoin="round" />
      <line x1={x(row)} y1="0" x2={x(row)} y2={H - 14} stroke="#ECECEE" strokeWidth="1" />
      <text x="6" y="14" fill="#FF6A1A" fontFamily="JetBrains Mono, monospace" fontSize="11">MN9 (comer) — se dibuja mientras suena</text>
    </svg>
  );
}

export default function Datos() {
  const s = useS(), [step, setStep] = useState(s.data ? 3 : 1), [name, setName] = useState(s.dataName || ''), [err, setErr] = useState(null), fileIn = useRef(null);
  const load = (text, fname) => {
    try { const d = parseCSV(text); if (!d.cols.length) throw new Error(); session.live.rowHist = []; session.set({ data: d, dataName: fname, row: 0, dataMap: { dulce: 0, ...(d.cols[1] ? { amargo: 1 } : {}) } }); setName(fname); setStep(2); setErr(null); }
    catch { setErr('No encontramos columnas numéricas en ese archivo.'); }
  };
  const onFile = async (f) => { if (!f) return; load(await f.text(), f.name); };
  const clear = () => { session.set({ data: null, dataMap: {}, row: 0 }); setStep(1); };
  const STEPS = [['Sube tus datos', 'CSV o texto separado'], ['Asigna sentidos', 'Columnas → estímulos'], ['Escucha', 'Una fila por compás']];
  const d = s.data;
  return (
    <div className="page">
      <div className="page-head">
        <div><h1 className="row" style={{ gap: 10 }}>Que la mosca pruebe tus datos <span className="badge-pro">PRO</span></h1><p>Cada columna estimula un sentido y cada fila dura un compás. La mosca no entiende tus datos: reacciona al estímulo, y tú decides qué significa cada sabor.</p></div>
        {d && <button type="button" className="btn" onClick={clear}>Dejar de usar datos</button>}
      </div>
      <ol className="row" style={{ listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap', gap: 8 }} aria-label="Pasos">
        {STEPS.map(([t, sub], i) => (
          <li key={t} style={{ flex: '1 1 200px' }}>
            <button type="button" className="list-item" aria-pressed={step === i + 1} disabled={i > 0 && !d} onClick={() => setStep(i + 1)}>
              <span className="mono" style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 600, background: step > i + 1 ? 'var(--text)' : step === i + 1 ? 'var(--acc)' : 'var(--chip)', color: step >= i + 1 ? '#0B0B0C' : 'var(--sub)' }}>{step > i + 1 ? <Icon name="check" size={14} stroke={2.4} /> : i + 1}</span>
              <span><span style={{ display: 'block', fontWeight: 600 }}>{t}</span><span className="muted" style={{ fontSize: 12 }}>{sub}</span></span>
            </button>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="stage" style={{ minHeight: 380 }}>
          <div className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
            <svg className="border" aria-hidden="true"><rect x="1" y="1" rx="16" fill="rgba(255,255,255,.015)" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" strokeDasharray="8 4" style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }} /></svg>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: '#131315', display: 'grid', placeItems: 'center' }}><Icon name="datos" size={28} /></div>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Suelta un CSV</p>
            <p style={{ margin: 0, color: '#8C8C94' }}>Detectamos las columnas numéricas · tus datos no salen de tu navegador</p>
            <div className="row"><button type="button" className="btn lg primary" onClick={() => fileIn.current.click()}>Elegir archivo</button><button type="button" className="btn lg" style={{ color: '#ECECEE', borderColor: 'rgba(255,255,255,.12)' }} onClick={() => load(demoCSV(), 'ejemplo-sintetico.csv')}>Datos de ejemplo</button></div>
            <input ref={fileIn} type="file" accept=".csv,.tsv,.txt,text/csv" hidden onChange={(e) => onFile(e.target.files[0])} />
            {err && <p role="alert" style={{ margin: 0, color: '#FF8A4D' }}>{err}</p>}
          </div>
        </div>
      )}

      {step === 2 && d && (
        <div className="cols">
          <section className="panel" style={{ flex: '999 1 520px' }}>
            <div className="panel-head"><h2>{name}</h2><span className="mono muted" style={{ fontSize: 11 }}>{d.rows} FILAS · {d.cols.length} NUMÉRICAS</span></div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table mono"><thead><tr><th>{d.headers.find((h) => !d.cols.some((c) => c.name === h)) || '#'}</th>{d.cols.map((c, i) => { const used = Object.entries(s.dataMap).find(([, v]) => v === i); return <th key={c.name} style={{ textAlign: 'right', color: used ? 'var(--text)' : undefined, borderBottom: used ? '2px solid var(--acc)' : undefined }}>{c.name}{used ? ` · ${SENSE_LABEL[used[0]]}` : ''}</th>; })}</tr></thead>
                <tbody>{d.labels.slice(0, 10).map((l, r) => <tr key={r}><td className="muted">{l}</td>{d.cols.map((c) => <td key={c.name} style={{ textAlign: 'right' }}>{c.values[r] ?? '—'}</td>)}</tr>)}</tbody></table>
            </div>
          </section>
          <section className="panel" style={{ flex: '1 1 320px' }}>
            <h2>Asigna columnas a sentidos</h2>
            {TARGETS.map(([k, label, help, c]) => (
              <div key={k} className="field well" style={{ padding: 10 }}>
                <label htmlFor={`m-${k}`} className="row" style={{ gap: 8, color: 'var(--text)', fontWeight: 600 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />{label}</label>
                <select id={`m-${k}`} className="input" value={s.dataMap[k] ?? ''} onChange={(e) => { const m = { ...s.dataMap }; if (e.target.value === '') delete m[k]; else m[k] = +e.target.value; session.set({ dataMap: m }); }}>
                  <option value="">— sin usar —</option>{d.cols.map((col, i) => <option key={col.name} value={i}>{col.name}</option>)}
                </select>
                <span className="dim" style={{ fontSize: 11 }}>{help}</span>
              </div>
            ))}
            <div className="field"><label htmlFor="perRow">Duración de cada fila</label><select id="perRow" className="input" value={s.perRow} onChange={(e) => session.set({ perRow: +e.target.value }, true)}><option value={16}>1 compás</option><option value={8}>½ compás</option><option value={32}>2 compases</option></select></div>
            <button type="button" className="btn lg acc" onClick={() => { session.live.rowHist = []; session.set({ row: 0 }); if (!s.playing) session.play(); setStep(3); }}>Escuchar mis datos</button>
          </section>
        </div>
      )}

      {step === 3 && d && (
        <div className="cols">
          <section className="panel" style={{ flex: '999 1 520px', background: 'var(--screen)', color: '#ECECEE' }}>
            <div className="panel-head"><h2>Respuesta de la mosca, fila por fila</h2><span className="mono" style={{ fontSize: 12, color: 'var(--acc)' }}>FILA {s.row + 1} / {d.rows} · {String(d.labels[s.row]).toUpperCase()}</span></div>
            <Chart data={d} map={s.dataMap} />
            <div className="row" style={{ flexWrap: 'wrap', gap: '6px 16px' }}>{TARGETS.filter(([k]) => s.dataMap[k] !== undefined).map(([k, l, , c]) => <span key={k} className="mono" style={{ fontSize: 10, color: '#8C8C94' }}><span style={{ display: 'inline-block', width: 10, height: 2, background: c, marginRight: 6, verticalAlign: 'middle' }} />{l.toUpperCase()} = {d.cols[s.dataMap[k]].name}</span>)}</div>
          </section>
          <section className="panel" style={{ flex: '1 1 300px' }}>
            <h2>Reproducción</h2>
            <div className="well" style={{ height: 8, overflow: 'hidden' }}><div style={{ height: '100%', width: `${((s.row + 1) / d.rows) * 100}%`, background: 'var(--acc)', transition: 'width .3s' }} /></div>
            <div className="row"><button type="button" className="btn lg primary" style={{ flex: 1 }} onClick={() => session.toggle()}>{s.playing ? 'Detener' : 'Tocar'}</button><button type="button" className="btn lg" style={{ flex: 1 }} aria-pressed={s.rec} onClick={() => session.toggleRec()}>{s.rec ? 'Detener toma' : 'Grabar toma'}</button></div>
            <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.55 }}>Los datos sustituyen a las perillas mientras estén activos. Suena en las pistas que tengan ese sentido (Gusto → grupo {session.track('gusto').group}, Oído → grupo {session.track('oido').group}).</p>
            <a href="#/tomas" className="muted" style={{ fontSize: 12 }}>Ver tomas →</a>
          </section>
        </div>
      )}
    </div>
  );
}
