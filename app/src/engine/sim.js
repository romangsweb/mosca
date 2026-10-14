// Fly Punch · simulación LIF del subcircuito (mismas ecuaciones y parámetros que Shiu et al. 2024, model.py).
// Acepta varios sentidos a la vez: { dulce: 150, amargo: 40, jon_ce: 0, ... } en Hz de estímulo.
export class Circuit {
  constructor(D) {
    const N = this.N = D.n, P = this.P = D.params;
    const off = new Int32Array(N + 1); for (const p of D.syn.pre) off[p + 1]++; for (let i = 0; i < N; i++) off[i + 1] += off[i];
    const tgt = new Int32Array(D.syn.pre.length), wt = new Float32Array(D.syn.pre.length), fill = off.slice(0, N);
    D.syn.pre.forEach((p, k) => { const j = fill[p]++; tgt[j] = D.syn.post[k]; wt[j] = D.syn.w[k]; });
    this.off = off; this.tgt = tgt; this.wt = wt; this.groups = D.grupos;
    this.isInput = new Uint8Array(N); for (const g of Object.values(D.grupos)) for (const i of g) this.isInput[i] = 1;
    this.v = new Float32Array(N); this.g = new Float32Array(N); this.ref = new Float32Array(N);
    this.buf = new Float32Array(P.delay_steps * N); this.counts = new Uint16Array(N); this.silenced = new Set();
    this.reset();
  }
  reset() { this.v.fill(this.P.v0); this.g.fill(0); this.ref.fill(0); this.buf.fill(0); this.t = 0; }
  advance(ms, rates) {
    const { N, P, v, g, ref, buf, counts, off, tgt, wt, isInput, silenced, groups } = this;
    counts.fill(0);
    const steps = Math.max(1, Math.round(ms / P.dt)), dly = P.delay_steps;
    const drive = Object.entries(rates).filter(([k, hz]) => hz > 0 && groups[k]).map(([k, hz]) => [groups[k], hz * P.dt / 1000]);
    for (let s = 0; s < steps; s++, this.t++) {
      const slot = (this.t % dly) * N;
      for (let i = 0; i < N; i++) { g[i] += buf[slot + i]; buf[slot + i] = 0; }
      for (const [ids, p] of drive) for (const i of ids) if (Math.random() < p) g[i] += P.w_poi;
      for (let i = 0; i < N; i++) {
        if (ref[i] <= 0) { v[i] += (P.v0 - v[i] + g[i]) / P.tm * P.dt; g[i] -= g[i] / P.tau * P.dt; }
        ref[i] -= P.dt;
      }
      for (let i = 0; i < N; i++) {
        if (v[i] > P.vth) {
          counts[i]++; v[i] = P.v0; g[i] = 0; ref[i] = isInput[i] ? 0 : P.trf;
          if (!silenced.has(i)) for (let k = off[i]; k < off[i + 1]; k++) buf[slot + tgt[k]] += wt[k];
        }
      }
    }
    return counts;
  }
}
