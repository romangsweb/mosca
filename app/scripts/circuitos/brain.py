# Simulador LIF de cerebro completo (modelo de Shiu et al. 2024), por eventos, en numpy.
import numpy as np, pandas as pd, scipy.sparse as sp, time
import os
DATOS = os.environ.get('FLYWIRE_DATOS', './datos/')  # clones de philshiu/Drosophila_brain_model (shiu/) y flyconnectome/flywire_annotations (ann/)
SH = DATOS + 'shiu/'
P = dict(v0=-52., vth=-45., tm=20., tau=5., trf=2.2, dly=1.8, wsyn=0.275, fpoi=250, dt=0.1)

class Brain:
    def __init__(s):
        comp = pd.read_csv(SH + 'Completeness_783.csv'); s.ids = comp.iloc[:, 0].astype('int64').values
        s.idx = {int(r): i for i, r in enumerate(s.ids)}; s.N = len(s.ids)
        c = pd.read_parquet(SH + 'Connectivity_783.parquet', columns=['Presynaptic_Index', 'Postsynaptic_Index', 'Excitatory x Connectivity'])
        s.pre = c['Presynaptic_Index'].values.astype(np.int32); s.post = c['Postsynaptic_Index'].values.astype(np.int32); s.cnt = c['Excitatory x Connectivity'].values.astype(np.float32)
        # Sin conexiones axo-axónicas KC→KC ni ORN→ORN: en este modelo LIF sin plasticidad ni inhibición del APL
        # realista provocan una avalancha (miles de Kenyon disparando). Se documenta en la app.
        a = pd.read_csv(DATOS + 'ann/supplemental_files/Supplemental_file1_neuron_annotations.tsv', sep='\t', low_memory=False, usecols=['root_id', 'cell_type', 'top_nt'])
        ct = dict(zip(a.root_id, a.cell_type.fillna('')))
        kind = np.array([1 if ct.get(int(r), '').startswith('KC') else 2 if ct.get(int(r), '').startswith('ORN_') else 0 for r in s.ids], np.int8)
        nt = dict(zip(a.root_id, a.top_nt.fillna('')))
        mod = np.array([nt.get(int(r), '') in ('dopamine', 'serotonin', 'octopamine') for r in s.ids])
        # también fuera la neuromodulación (dopamina, serotonina, octopamina): no es una sinapsis rápida excitadora
        # LN excitadoras del lóbulo antenal: en la mosca actúan sobre todo por uniones eléctricas; como sinapsis químicas
        # en este modelo encienden todo el lóbulo de golpe (todo o nada). Se quitan sus sinapsis excitadoras.
        eln = np.array([('LN' in ct.get(int(r), '')) and nt.get(int(r), '') == 'acetylcholine' for r in s.ids])
        bad = ((kind[s.pre] > 0) & (kind[s.pre] == kind[s.post])) | mod[s.pre] | (eln[s.pre] & (s.cnt > 0)); s.removed = int(bad.sum())
        s.pre, s.post, s.cnt = s.pre[~bad], s.post[~bad], s.cnt[~bad]
        s.W = sp.csr_matrix((s.cnt * P['wsyn'], (s.pre, s.post)), shape=(s.N, s.N))
    def run(s, stim, ms=1000, trials=3, seed=0):
        """stim: {nombre: (indices, hz)} → tasa media (Hz) por neurona"""
        rng = np.random.default_rng(seed); N = s.N; dt = P['dt']; steps = int(ms / dt); D = int(round(P['dly'] / dt))
        rates = np.zeros(N, np.float64); ip, iw = s.W.indptr, s.W
        for tr in range(trials):
            v = np.full(N, P['v0'], np.float32); g = np.zeros(N, np.float32); ref = np.zeros(N, np.float32); buf = np.zeros((D, N), np.float32); cnt = np.zeros(N, np.int32)
            drive = [(np.asarray(ix), hz * dt / 1000) for ix, hz in stim.values()]
            wp = P['fpoi'] * P['wsyn']
            for t in range(steps):
                slot = t % D; g += buf[slot]; buf[slot] = 0
                for ix, p in drive:
                    hit = ix[rng.random(len(ix)) < p]
                    if len(hit): np.add.at(g, hit, wp)
                act = ref <= 0
                v[act] += (P['v0'] - v[act] + g[act]) / P['tm'] * dt; g[act] -= g[act] / P['tau'] * dt
                ref -= dt
                sp_ = np.nonzero(v > P['vth'])[0]
                if len(sp_):
                    cnt[sp_] += 1; v[sp_] = P['v0']; g[sp_] = 0; ref[sp_] = P['trf']
                    # sinapsis de las que dispararon: reunir sus filas CSR y sumar con bincount (rápido aunque disparen miles)
                    st, en = ip[sp_], ip[sp_ + 1]; ln = en - st; tot = int(ln.sum())
                    if tot:
                        gi = np.repeat(st - np.concatenate(([0], np.cumsum(ln)[:-1])), ln) + np.arange(tot)
                        buf[slot] += np.bincount(s.W.indices[gi], weights=s.W.data[gi], minlength=N).astype(np.float32)  # llega tras el retardo
            rates += cnt / (ms / 1000)
        return rates / trials
