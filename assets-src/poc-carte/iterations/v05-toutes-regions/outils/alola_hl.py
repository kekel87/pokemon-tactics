import json, os, sys
import numpy as np
from PIL import Image
folder, matches = sys.argv[1], json.load(open(sys.argv[2]))
groups = {}
for n, m in matches.items():
    groups.setdefault(m["scale"], []).append(n)
out = {}
for s, names in groups.items():
    arrs = {n: np.array(Image.open(os.path.join(folder, n)).convert("RGB")).astype(int) for n in names}
    # placement de l'île = médiane des boîtes (ancrage commun)
    boxes = np.array([matches[n]["box"] for n in names]); X, Y = np.median(boxes[:, 0]), np.median(boxes[:, 1])
    med = np.median(np.stack(list(arrs.values())), axis=0)
    for n, a in arrs.items():
        d = np.abs(a - med).sum(-1)
        yellow = (a[..., 0] > 200) & (a[..., 1] > 190) & (a[..., 2] < 110)
        ys, xs = np.nonzero((d > 100) & yellow)
        if len(xs) < 5:
            ys, xs = np.nonzero(d > 150)
        if len(xs) < 5:
            out[n] = None; continue
        px, py = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
        # recadrage terre utilisé par match2 : recalcule le même décalage
        land = a[..., 2] < 170
        lys, lxs = np.nonzero(land)
        ox, oy = max(0, lxs.min() - 6), max(0, lys.min() - 6)
        bx, by = matches[n]["box"][:2]
        out[n] = (round(bx + (px - ox) * s, 1), round(by + (py - oy) * s, 1), int(len(xs)))
for n, v in sorted(out.items()):
    print(f"{n.replace('Alola_','').replace('_Map.png',''):35s} {v}")
json.dump(out, open(sys.argv[3], "w"), indent=0)
