"""P10 : détoure les nuages générés (fond magenta), les réduit en vrai pixel art et quantifie la palette.

Usage (depuis p10-kanto) : python3 -P outils/detourer_nuages.py generation sprites/nuages 11 22 33 44
"""
import sys

import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
for seed in sys.argv[3:]:
    im = np.array(Image.open(f"{src}/nuage-brut-{seed}.png").convert("RGB")).astype(int)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    magenta = (r > 140) & (g < 140) & (b > 60) & (r - g > 90)
    alpha = (~magenta).astype(np.uint8) * 255
    rgba = np.dstack([im.astype(np.uint8), alpha])
    image = Image.fromarray(rgba, "RGBA")
    box = image.getchannel("A").point(lambda v: 255 if v else 0).getbbox()
    image = image.crop(box)
    w, h = image.size
    target = 84
    small = image.resize((target, max(1, round(h * target / w))), Image.BOX)
    arr = np.array(small)
    a = arr[..., 3]
    arr[..., 3] = np.where(a > 150, 255, 0)
    # couleurs : quantification à 7 teintes, rien de rose
    rgb = Image.fromarray(arr[..., :3]).quantize(7, method=Image.Quantize.MEDIANCUT).convert("RGB")
    arr[..., :3] = np.array(rgb)
    rr, gg, bb = arr[..., 0].astype(int), arr[..., 1].astype(int), arr[..., 2].astype(int)
    pink = (rr > bb) & (arr[..., 3] > 0)
    arr[pink, :3] = (120, 160, 210)
    # liseré d'un pixel bleu-gris tout autour (comme les nuages de la V06)
    solid = arr[..., 3] > 0
    edge = solid & ~(np.roll(solid, 1, 0) & np.roll(solid, -1, 0) & np.roll(solid, 1, 1) & np.roll(solid, -1, 1))
    arr[edge, :3] = (104, 136, 192)
    Image.fromarray(arr, "RGBA").save(f"{out}/nuage-{seed}.png")
    print(seed, Image.fromarray(arr).size)
