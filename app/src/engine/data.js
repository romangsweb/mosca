// Fly Punch · datos: CSV → columnas numéricas normalizadas (0–1) para estimular sentidos.
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  const first = text.split(/\r?\n/, 1)[0] || '';
  const sep = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((x) => x.trim() !== '')) rows.push(row); }
  const headers = rows.shift().map((h) => h.trim());
  const num = (v) => {
    const s = String(v ?? '').trim().replace(/[$€£%\s]/g, '');
    if (!/^-?[\d.,]+$/.test(s)) return null;
    const x = parseFloat(s.replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    return Number.isFinite(x) ? x : null;
  };
  const cols = headers.map((h, c) => ({ name: h, values: rows.map((r) => num(r[c])) }))
    .filter((c) => c.values.filter((v) => v !== null).length >= Math.max(2, rows.length * 0.6));
  for (const c of cols) {
    const vs = c.values.filter((v) => v !== null), mn = Math.min(...vs), mx = Math.max(...vs), span = mx - mn || 1;
    c.min = mn; c.max = mx; c.norm = c.values.map((v) => v === null ? 0 : (v - mn) / span);
  }
  const labelCol = headers.findIndex((h) => !cols.some((c) => c.name === h));
  return { headers, cols, rows: rows.length, labels: rows.map((r, i) => labelCol >= 0 ? String(r[labelCol]).trim() : `fila ${i + 1}`) };
}
// Datos sintéticos de ejemplo, claramente marcados como tales.
export function demoCSV() {
  const m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  let out = 'mes,ventas,devoluciones,visitas,quejas\n';
  for (let i = 0; i < 24; i++) {
    const t = i / 23, ventas = Math.round(120 + 80 * Math.sin(i / 3) + 60 * t), dev = Math.round(15 + (i > 14 ? 50 * (i - 14) / 9 : 5 * Math.sin(i)));
    out += `${m[i % 12]}-${i < 12 ? 25 : 26},${ventas},${dev},${Math.round(900 + 400 * Math.sin(i / 2 + 1))},${Math.round(5 + (i > 16 ? 30 * (i - 16) / 7 : 2 * Math.cos(i)))}\n`;
  }
  return out;
}
