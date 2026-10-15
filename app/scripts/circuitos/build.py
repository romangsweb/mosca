# Construye circuito-v783.json: un solo cerebro con 4 circuitos (gusto, oído, olfato, cortejo) a partir de las simulaciones.
import json, numpy as np, pandas as pd
from brain import Brain, P, DATOS
b = Brain(); Z = np.load('./rates.npz')
a = pd.read_csv(DATOS + 'ann/supplemental_files/Supplemental_file1_neuron_annotations.tsv', sep='\t', low_memory=False).set_index('root_id')
old = json.load(open('../../public/data/circuito-multi.json'))
oldids = [int(x) for x in old['flywire_ids']]
CH = {'gusto': ['dulce', 'amargo'], 'oido': ['jon_ce', 'jon_f', 'jon_dm'], 'olfato': ['vinagre', 'co2', 'geosmina'], 'cortejo': ['canto', 'cva', 'deseo'], 'vision': ['acercar', 'movimiento', 'luz']}
G = {k: list(Z[f'G_{k}']) for m in CH.values() for k in m}
# T4/T5 son ~6000: en la app va una muestra al azar y cada una «representa» a las demás (sus sinapsis pesan total/muestra).
# Así el resto del circuito recibe en promedio la misma entrada que en el cerebro completo.
ESCALA = {}
rng = np.random.default_rng(783)
for k, nmax in (('movimiento', 160),):
    full = G[k]
    if len(full) > nmax:
        G[k] = sorted(int(i) for i in rng.choice(full, nmax, replace=False)); ESCALA.update({i: len(full) / nmax for i in G[k]})
R = {k: Z[k] for m in CH.values() for k in m}
sensors = set(i for v in G.values() for i in v)
STIM_ALL = set(int(i) for m in CH.values() for k in m for i in Z[f'G_{k}'])
ctg = a.cell_type.fillna('').to_dict()
keep = set(sensors) | set(b.idx[i] for i in oldids if i in b.idx)  # todo lo de antes que existe en v783
for m, chans in CH.items():
    if m in ('gusto', 'oido'): continue
    score = np.max([R[c] for c in chans], axis=0); score[list(sensors | STIM_ALL)] = 0  # nunca las estimuladas directamente (ni las T4/T5 fuera de la muestra)
    kc = np.array([str(ctg.get(int(r), '')).startswith('KC') for r in b.ids])
    s2 = score.copy(); s2[kc] = 0; top = np.argsort(-s2)[:320]; keep |= set(int(i) for i in top if s2[i] >= 5)
    s3 = score.copy(); s3[~kc] = 0; topk = np.argsort(-s3)[:40]; keep |= set(int(i) for i in topk if s3[i] >= 5)  # una muestra del cuerpo fungiforme
import re
CUR = {
  'olfato': [(r'^ORN_DM1$', 'vinagre'), (r'^ORN_V$', 'co2'), (r'^ORN_DA2$', 'geosmina'), (r'^DM1_lPN$', 'vinagre'), (r'^V_ilPN$', 'co2'), (r'^DA2_lPN$', 'geosmina'),
             (r'^lLN2F_b$', 'vinagre'), (r'^ALBN1$', 'vinagre'), (r'^LHAV3f1$', 'vinagre'), (r'^LHAV2d1$', 'geosmina'), (r'^LHAV2m1$', 'co2'), (r'^DNb05$', 'vinagre')],
  'cortejo': [(r'^JO-B', 'canto'), (r'^ORN_DA1$', 'cva'), (r'^pC1a$', 'deseo'), (r'^CB3876$', 'canto'), (r'^CB2789$', 'canto'), (r'^DA1_lPN$', 'cva'),
              (r'^pC1d$', 'deseo'), (r'^SMP555,SMP556$', 'deseo'), (r'^SMP553$', 'deseo'), (r'^DNp12$', 'canto'), (r'^LHPV12a1$', 'cva'), (r'^DNp37$', 'deseo')],
  # visión: detectores de acercamiento → fibra gigante (huida); movimiento T4 → HS/H2 (giro); ocelos → DNp18/DNb06
  'vision': [(r'^LPLC2$', 'acercar'), (r'^LC4$', 'acercar'), (r'^T4a$', 'movimiento'), (r'^OCG01a$', 'luz'), (r'^PVLP011$', 'acercar'), (r'^HSE$', 'movimiento'),
             (r'^H2$', 'movimiento'), (r'^LPi15$', 'movimiento'), (r'^DNp18$', 'luz'), (r'^DNb06$', 'luz'), (r'^DNp04$', 'acercar'), (r'^DNp01$', 'acercar')],
}
CUR_IDX = {}
for mname, picks in CUR.items():
    got = []
    for pat, ch in picks:
        cand = [b.idx[r] for r, t in ctg.items() if r in b.idx and re.match(pat, t) and b.idx[r] not in got]
        if any(i in STIM_ALL for i in cand): cand = [i for i in cand if i in set(G[ch])] or cand  # de las estimuladas, solo la muestra que va a la app
        i = max(cand, key=lambda i: R[ch][i]); got.append(i); keep.add(i)
    CUR_IDX[mname] = got
sub = np.array(sorted(keep)); loc = {int(g): i for i, g in enumerate(sub)}; n = len(sub)
print('neuronas', n)
# sinapsis dentro del subcircuito
m = np.isin(b.pre, sub) & np.isin(b.post, sub)
pre = np.array([loc[int(x)] for x in b.pre[m]]); post = np.array([loc[int(x)] for x in b.post[m]]); esc = np.array([ESCALA.get(int(x), 1.0) for x in b.pre[m]]); w = (b.cnt[m] * P['wsyn'] * esc).round(3)
print('sinapsis', len(pre))
ids = [int(b.ids[g]) for g in sub]
ann = a.reindex(ids)
cls = {'sensory': 'sensor', 'descending': 'descendente', 'ascending': 'ascendente', 'motor': 'motoneurona'}
clase = [cls.get(x, 'interneurona') if isinstance(x, str) else 'interneurona' for x in ann.super_class]
tipo = [(t if isinstance(t, str) and t else (h if isinstance(h, str) and h else 'sin nombre')) for t, h in zip(ann.cell_type, ann.hemibrain_type)]
nt = [x if isinstance(x, str) else 'desconocido' for x in ann.top_nt]
# signo por neurona: según sus sinapsis (Shiu: ACh +, GABA/Glu −)
sgn = np.zeros(n); np.add.at(sgn, pre, np.sign(w)); inh = [1 if sgn[i] < 0 else (1 if sgn[i] == 0 and nt[i] in ('gaba', 'glutamate') else 0) for i in range(n)]
pos = [[round(x * 0.004 - 495.2, 1), round(y * 0.004 - 247.15, 1), round(z * 0.04 - 139.65, 1)] for x, y, z in zip(ann.pos_x, ann.pos_y, ann.pos_z)]
aprox = [0 if np.isfinite(p[0]) else 1 for p in pos]; pos = [p if np.isfinite(p[0]) else [0, 0, 0] for p in pos]
grupos = {k: [loc[int(i)] for i in v] for k, v in G.items()}
resp = {k: [int(round(R[k][g])) for g in sub] for k in R}
mn9 = loc[b.idx[720575940660219265]]

def pad(i, sentido=None, cond=None):
    return {'idx': int(i), 'flywire_id': str(ids[i]), 'tipo': tipo[i], 'clase': clase[i], 'nt': nt[i], 'inhibidora': bool(inh[i]), 'sentido': sentido, 'cond': cond}
KEYS = ['.', '0', 'enter', '1', '2', '3', '4', '5', '6', '7', '8', '9']
modos = {}
# gusto y oído: los mismos pads de antes si existen en v783
for mname in ('gusto', 'oido'):
    pads = []
    for p in old['modos'][mname]['pads']:
        fid = int(p['flywire_id'])
        if fid in b.idx: pads.append({**pad(loc[b.idx[fid]], p['sentido'], p['cond']), 'tipo': p['tipo'], 'clase': p['clase']})
        else: pads.append(None)
    # reemplazo de los que ya no existen: el más activo de su misma clase que no esté usado
    sc = np.max([[resp[c][i] for i in range(n)] for c in CH[mname]], axis=0)
    for k, p in enumerate(pads):
        if p: continue
        o = old['modos'][mname]['pads'][k]; used = {q['idx'] for q in pads if q}
        cand = [i for i in np.argsort(-sc) if i not in used and clase[i] == o['clase'] and i not in set(x for v in grupos.values() for x in v)]
        pads[k] = pad(cand[0], o['sentido'], o['cond']); print(mname, 'reemplazo pad', k, o['tipo'], '→', tipo[cand[0]])
    modos[mname] = {'sentidos': old['modos'][mname]['sentidos'], 'pads': pads}

def build_mode(mname, out_pref):
    chans = CH[mname]; allsens = set(x for v in grupos.values() for x in v)
    pads = []
    for c in chans:  # un sensor (o neurona de entrada) por canal: la que más dispara con su estímulo
        g = grupos[c]; i = max(g, key=lambda i: resp[c][i]); pads.append(pad(i, c, c))
    sc = np.max([[resp[c][i] for i in range(n)] for c in chans], axis=0).astype(float)
    best_c = [chans[int(np.argmax([resp[c][i] for c in chans]))] for i in range(n)]
    # salida: preferida si responde; si no, la descendente más activa
    outi = next((i for i in range(n) if tipo[i] in out_pref and sc[i] >= 2), None)
    if outi is None: outi = max([i for i in range(n) if clase[i] in ('descendente', 'motoneurona') and i not in allsens], key=lambda i: sc[i])
    used = {p['idx'] for p in pads} | {outi}; seen = {}
    order = [i for i in np.argsort(-sc) if i not in used and i not in allsens and sc[i] >= 2]
    mids = []
    # diversidad: ≤2 del mismo tipo, al menos 3 inhibidoras, cubrir cada canal
    for c in chans:
        cand = next((i for i in order if best_c[i] == c and i not in mids), None)
        if cand is not None: mids.append(cand)
    inhs = [i for i in order if inh[i] and i not in mids]
    for i in inhs[:3]: mids.append(i)
    for i in order:
        if len(mids) >= 12 - len(pads) - 1: break
        if i in mids or seen.get(tipo[i], 0) >= 2 or (tipo[i].startswith('KC') and any(tipo[j].startswith('KC') for j in mids)): continue
        mids.append(i); seen[tipo[i]] = seen.get(tipo[i], 0) + 1
    mids = mids[:12 - len(pads) - 1]
    pads += [pad(i, None, best_c[i]) for i in mids]
    pads.append(pad(outi, None, best_c[outi]))
    return {'sentidos': chans, 'pads': pads}
def curated(mname):
    chans = CH[mname]; pads = []
    for (pat, ch), g in zip(CUR[mname], CUR_IDX[mname]):
        i = loc[g]; pads.append(pad(i, ch if i in set(grupos.get(ch, [])) else None, ch))
        if mname == 'vision' and pads[-1]['sentido']: pads[-1]['clase'] = 'sensor'  # entradas del ojo: se dibujan como sensores
    return {'sentidos': chans, 'pads': pads}
modos['olfato'] = curated('olfato')
modos['cortejo'] = curated('cortejo')
modos['vision'] = curated('vision')
for mname, md in modos.items():
    for k, p in enumerate(md['pads']): p['nota_off'] = k; p['pad'] = KEYS[k]
    print(mname, [(p['tipo'], p['clase'][:4], 'inh' if p['inhibidora'] else 'exc', max(resp[c][p['idx']] for c in CH[mname])) for p in md['pads']])
# conexiones para dibujar: las más fuertes por circuito
E = []
for mname, chans in CH.items():
    act = np.max([[resp[c][i] for i in range(n)] for c in chans], axis=0) >= 5
    ok = act[pre] & act[post]; ord_ = np.argsort(-np.abs(w) * ok)[: 700]
    E += [int(e) for e in ord_ if ok[e]]
E = sorted(set(E))
D = {'fuente': 'FlyWire v783 · modelo LIF de Shiu et al. 2024 (Nature), github.com/philshiu/Drosophila_brain_model (MIT) · tipos y posiciones: flyconnectome/flywire_annotations (Schlegel et al. 2024; Dorkenwald et al. 2024)',
     'params': old['params'], 'n': n, 'flywire_ids': [str(x) for x in ids], 'grupos': grupos,
     'syn': {'pre': pre.tolist(), 'post': post.tolist(), 'w': w.tolist()}, 'pos_um': pos, 'aprox': aprox, 'inh': inh, 'resp': resp,
     'edges': {'pre': pre[E].tolist(), 'post': post[E].tolist(), 'w': w[E].tolist()}, 'modos': modos, 'mn9': mn9,
     'salidas': {m: modos[m]['pads'][11]['idx'] for m in modos}}
json.dump(D, open('../../public/data/circuito-v783.json', 'w'), separators=(',', ':'))
import os; print('tamaño KB', os.path.getsize('../../public/data/circuito-v783.json') // 1024, 'vs antes', os.path.getsize('../../public/data/circuito-multi.json') // 1024)
