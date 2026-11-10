"""match.py big.png dir out.json scales : place chaque vignette (recadrage de la grande carte) par corrélation normalisée."""
import os, sys, json
import numpy as np
from PIL import Image
big_path, folder, out_path = sys.argv[1:4]
scales = [float(s) for s in sys.argv[4].split(",")]
D = int(os.environ.get("MATCH_D", "4"))
big_img = Image.open(big_path).convert("RGB")
big = np.array(big_img.resize((big_img.width // D, big_img.height // D), Image.BOX).convert("L")).astype(np.float64)
BH, BW = big.shape
F = np.fft.rfft2(big)
F2 = np.fft.rfft2(big ** 2)

def ncc(t):
    th, tw = t.shape
    t = t - t.mean(); tn = np.sqrt((t ** 2).sum()) + 1e-9
    k = np.zeros((BH, BW)); k[:th, :tw] = t[::-1, ::-1]
    num = np.fft.irfft2(F * np.fft.rfft2(k), s=(BH, BW))
    ones = np.zeros((BH, BW)); ones[:th, :tw] = 1
    O = np.fft.rfft2(ones)
    s1 = np.fft.irfft2(F * O, s=(BH, BW)); s2 = np.fft.irfft2(F2 * O, s=(BH, BW))
    var = np.maximum(s2 - s1 ** 2 / (th * tw), 1e-6)
    r = num / (np.sqrt(var) * tn)
    r[:th - 1, :] = -1; r[:, :tw - 1] = -1     # fenêtre entièrement dans la carte
    y, x = np.unravel_index(np.argmax(r), r.shape)
    return float(r[y, x]), x - tw + 1, y - th + 1

res = {}
for name in sorted(os.listdir(folder)):
    crop = Image.open(os.path.join(folder, name)).convert("RGB")
    arr = np.array(crop).astype(int)
    pink = ((arr[..., 0] > 200) & (arr[..., 1] < 90) & (arr[..., 2] > 70) & (arr[..., 2] < 200)) if os.environ.get("MATCH_HL", "pink") == "pink" else ((arr[..., 0] > 210) & (arr[..., 1] > 210) & (arr[..., 2] < 90))
    ox = oy = 0
    if os.environ.get("MATCH_LANDCROP"):
        land = arr[..., 2] < 170
        ys_, xs_ = np.nonzero(land)
        ox, oy = max(0, xs_.min() - 6), max(0, ys_.min() - 6)
        crop = crop.crop((ox, oy, min(crop.width, xs_.max() + 7), min(crop.height, ys_.max() + 7)))
    best = None
    for s in scales:
        w, h = max(8, round(crop.width * s / D)), max(8, round(crop.height * s / D))
        if w >= BW or h >= BH:
            continue
        t = np.array(crop.resize((w, h), Image.BOX).convert("L")).astype(np.float64)
        score, x, y = ncc(t)
        if best is None or score > best[0]:
            best = (score, s, x * D, y * D)
    score, s, X, Y = best
    if pink.sum() > 20:
        ys, xs = np.nonzero(pink)
        px, py = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    else:
        px, py = crop.width / 2, crop.height / 2
    res[name] = dict(score=round(score, 3), scale=s, x=int(round(X + (px - ox) * s)), y=int(round(Y + (py - oy) * s)), box=[int(X), int(Y), round(X + crop.width * s), round(Y + crop.height * s)])
    print(f"{name:55s} {score:.3f} s={s} -> ({res[name]['x']},{res[name]['y']})", flush=True)
json.dump(res, open(out_path, "w"), indent=0)
