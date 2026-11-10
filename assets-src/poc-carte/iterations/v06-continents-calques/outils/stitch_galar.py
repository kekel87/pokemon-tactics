"""Assemble les captures de la carte de Galar (même zoom) par corrélation de phase, puis repère le curseur de chaque lieu."""
import os, sys, json
import numpy as np
from PIL import Image
src, out_png, out_json = sys.argv[1], sys.argv[2], sys.argv[3]
F = 4
names = [n for n in sorted(os.listdir(src)) if "Battle_Tower" not in n]
full = {n: np.array(Image.open(os.path.join(src, n)).convert("RGB")) for n in names}
small = {n: np.array(Image.fromarray(a).resize((a.shape[1] // F, a.shape[0] // F), Image.BOX).convert("L")).astype(np.float32) for n, a in full.items()}
h, w = next(iter(small.values())).shape

def correlate(a, b):
    """décalage (dx, dy) tel que b(x) = a(x + d) : b est vue à la position de a + d."""
    A = np.fft.fft2(a - a.mean(), s=(2 * h, 2 * w)); B = np.fft.fft2(b - b.mean(), s=(2 * h, 2 * w))
    R = A * np.conj(B); R /= np.abs(R) + 1e-6
    r = np.real(np.fft.ifft2(R))
    dy, dx = np.unravel_index(np.argmax(r), r.shape)
    if dy > h: dy -= 2 * h
    if dx > w: dx -= 2 * w
    return int(dx), int(dy)

def overlap_error(a, b, dx, dy):
    ax0, ay0 = max(0, dx), max(0, dy); ax1, ay1 = min(w, w + dx), min(h, h + dy)
    if ax1 - ax0 < w * 0.25 or ay1 - ay0 < h * 0.25:
        return 1e9
    pa = a[ay0:ay1, ax0:ax1]; pb = b[ay0 - dy:ay1 - dy, ax0 - dx:ax1 - dx]
    return float(np.median(np.abs(pa - pb)))

pos = {names[0]: (0, 0)}
pending = set(names[1:])
while pending:
    best = None
    for n in pending:
        for m, (mx, my) in pos.items():
            dx, dy = correlate(small[m], small[n])
            err = overlap_error(small[m], small[n], dx, dy)
            if best is None or err < best[0]:
                best = (err, n, mx + dx, my + dy)
    err, n, x, y = best
    if err > 6:
        print("arrêt, erreur", err, "pour", sorted(pending)); break
    pos[n] = (x, y); pending.discard(n)
    print(f"{n:45s} {x*F:6d} {y*F:6d} err {err:.1f}", flush=True)
# Affinage à pleine résolution autour de la position trouvée (±F)
minx = min(p[0] for p in pos.values()) * F; miny = min(p[1] for p in pos.values()) * F
W = max(p[0] for p in pos.values()) * F - minx + 1920; H = max(p[1] for p in pos.values()) * F - miny + 1080
stack_sum = np.zeros((H, W, 3), np.float64); stack_n = np.zeros((H, W), np.int32)
layers = []
for n, (x, y) in pos.items():
    X, Y = x * F - minx, y * F - miny
    layers.append((n, X, Y))
# mosaïque par médiane (retire curseurs et surlignages)
mosaic = np.zeros((H, W, 3), np.uint8)
# médiane par bandes : on empile les images couvrant chaque bande de 270 lignes
for y0 in range(0, H, 270):
    y1 = min(H, y0 + 270)
    cover = [(n, X, Y) for n, X, Y in layers if Y < y1 and Y + 1080 > y0]
    band = np.full((len(cover), y1 - y0, W, 3), np.nan, np.float32)
    for k, (n, X, Y) in enumerate(cover):
        sy0, sy1 = max(y0, Y), min(y1, Y + 1080)
        band[k, sy0 - y0:sy1 - y0, X:X + 1920] = full[n][sy0 - Y:sy1 - Y]
    med = np.nanmedian(band, axis=0)
    mosaic[y0:y1] = np.nan_to_num(med, nan=0).astype(np.uint8)
Image.fromarray(mosaic).save(out_png)
# curseur : zone qui diffère le plus de la mosaïque, couleur blanche du sourire
cursors = {}
for n, X, Y in layers:
    d = np.abs(full[n].astype(int) - mosaic[Y:Y + 1080, X:X + 1920].astype(int)).sum(-1)
    white = (full[n].min(-1) > 235)
    m = (d > 120) & white
    ys, xs = np.nonzero(m)
    if len(xs) < 30:
        cursors[n] = None; continue
    # plus grand amas : médiane robuste
    cx, cy = np.median(xs), np.median(ys)
    sel = (np.abs(xs - cx) < 40) & (np.abs(ys - cy) < 40)
    cursors[n] = (round(float(xs[sel].mean()) + X, 1), round(float(ys[sel].mean()) + Y, 1), int(sel.sum()))
json.dump({"size": [W, H], "cursors": cursors, "frames": {n: [X, Y] for n, X, Y in layers}}, open(out_json, "w"), indent=0)
print(W, H)
