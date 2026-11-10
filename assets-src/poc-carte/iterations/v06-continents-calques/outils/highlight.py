"""highlight.py base1[,base2] dir : pour chaque vignette de lieu, centre et boîte de la zone qui diffère de la carte de base."""
import sys, os, json
import numpy as np
from PIL import Image
if sys.argv[1] == "median":
    files = [os.path.join(sys.argv[2], n) for n in sorted(os.listdir(sys.argv[2]))]
    arrs = [np.array(Image.open(f).convert("RGB")).astype(int) for f in files]
    shape = max(set(a.shape for a in arrs), key=lambda s: sum(a.shape == s for a in arrs))
    bases = [np.median(np.stack([a for a in arrs if a.shape == shape]), axis=0).astype(int)]
    Image.fromarray(bases[0].astype(np.uint8)).save(sys.argv[3] if len(sys.argv) > 3 else "/dev/null", format="PNG")
else:
    bases = [np.array(Image.open(b).convert("RGB")).astype(int) for b in sys.argv[1].split(",")]
out = {}
for name in sorted(os.listdir(sys.argv[2])):
    im = np.array(Image.open(os.path.join(sys.argv[2], name)).convert("RGB")).astype(int)
    best = None
    for k, b in enumerate(bases):
        if b.shape != im.shape:
            continue
        d = np.abs(im - b).sum(-1)
        score = (d > 60).sum()
        if best is None or score < best[0]:
            best = (score, k, d)
    if best is None:
        continue
    score, k, d = best
    ys, xs = np.nonzero(d > 90)
    if len(xs) == 0:
        out[name] = None; continue
    out[name] = dict(base=k, n=int(len(xs)), cx=round(float(xs.mean()), 1), cy=round(float(ys.mean()), 1),
                     box=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())])
print(json.dumps(out, indent=0, ensure_ascii=False))
