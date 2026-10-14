// Fly Punch · simulación LIF del subcircuito (mismas ecuaciones y parámetros que Shiu et al. 2024, model.py).
export class Circuit {
  constructor(D) {
    const N = this.N = D.n, P = this.P = D.params;
    const off = new Int32Array(N + 1); for (const p of D.syn.pre) off[p + 1]++; for (let i = 0; i < N; i++) off[i + 1] += off[i];
    const tgt = new Int32Array(D.syn.pre.length), wt = new Float32Array(D.syn.pre.length), fill = off.slice(0, N);
    D.syn.pre.forEach((p, k) => { const j = fill[p]++; tgt[j] = D.syn.post[k]; wt[j] = D.syn.w[k]; });
    Object.assign(this, { off, tgt, wt, sugar: D.sugar, isSugar: new Uint8Array(N) });
    D.sugar.forEach((i) => this.isSugar[i] = 1);
    this.v = new Float32Array(N); this.g = new Float32Array(N); this.ref = new Float32Array(N);
    this.buf = new Float32Array(P.delay_steps * N); this.counts = new Uint16Array(N); this.silenced = new Set();
    this.reset();
  }
  reset() { this.v.fill(this.P.v0); this.g.fill(0); this.ref.fill(0); this.buf.fill(0); this.t = 0; }
  // Avanza `ms` de tiempo neuronal con estímulo de azúcar `sugarHz`; devuelve disparos por neurona.
  advance(ms, sugarHz) {
    const { N, P, v, g, ref, buf, counts, off, tgt, wt, isSugar, silenced } = this;
    counts.fill(0);
    const steps = Math.max(1, Math.round(ms / P.dt)), p = sugarHz * P.dt / 1000, dly = P.delay_steps;
    for (let s = 0; s < steps; s++, this.t++) {
      const slot = (this.t % dly) * N;
      for (let i = 0; i < N; i++) { g[i] += buf[slot + i]; buf[slot + i] = 0; }
      for (const i of this.sugar) if (Math.random() < p) g[i] += P.w_poi;
      for (let i = 0; i < N; i++) {
        if (ref[i] <= 0) { v[i] += (P.v0 - v[i] + g[i]) / P.tm * P.dt; g[i] -= g[i] / P.tau * P.dt; }
        ref[i] -= P.dt;
      }
      for (let i = 0; i < N; i++) {
        if (v[i] > P.vth) {
          counts[i]++; v[i] = P.v0; g[i] = 0; ref[i] = isSugar[i] ? 0 : P.trf;
          if (!silenced.has(i)) for (let k = off[i]; k < off[i + 1]; k++) buf[slot + tgt[k]] += wt[k];
        }
      }
    }
    return counts;
  }
}
