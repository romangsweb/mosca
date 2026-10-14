import json, pandas as pd, numpy as np
from brain import Brain, DATOS
b = Brain()
a = pd.read_csv(DATOS + 'ann/supplemental_files/Supplemental_file1_neuron_annotations.tsv', sep='\t', low_memory=False)
a = a[a.root_id.isin(b.idx)].set_index('root_id')
d = json.load(open('../../public/data/circuito-multi.json'))
old = [int(x) for x in d['flywire_ids']]
grp = lambda key: [b.idx[old[i]] for i in d['grupos'][key] if old[i] in b.idx]
ct = a.cell_type.fillna('')
by = lambda pat: [b.idx[r] for r in a.index[ct.str.match(pat)]]
G = {
  'dulce': grp('dulce'), 'amargo': grp('amargo'), 'jon_ce': grp('jon_ce'), 'jon_f': grp('jon_f'), 'jon_dm': grp('jon_dm'),
  'vinagre': by(r'^ORN_(DM1|VA2)$'), 'co2': by(r'^ORN_V$'), 'geosmina': by(r'^ORN_DA2$'),
  'canto': by(r'^JO-B'), 'cva': by(r'^ORN_DA1$'), 'deseo': by(r'^pC1[a-e]$'),
}
print({k: len(v) for k, v in G.items()})
import os
R = dict(np.load('./rates_part.npz')) if os.path.exists('./rates_part.npz') else {}
for k, ix in G.items():
    if k in R: continue
    R[k] = b.run({k: (ix, 150)}, ms=1000, trials=2, seed=sum(map(ord, k))); print(k, 'activas>=10Hz', int((R[k] >= 10).sum()), flush=True); np.savez('./rates_part.npz', **R)
np.savez('./rates.npz', **R, **{f'G_{k}': np.array(v) for k, v in G.items()})
