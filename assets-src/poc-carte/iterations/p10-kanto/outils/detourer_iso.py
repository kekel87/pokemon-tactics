"""P10 : détoure les variantes isométriques générées (fond magenta), recadre et réduit à 240 px de large.

Usage (depuis p10-kanto) : python3 -P outils/detourer_iso.py generation/iso villes/iso
(Lavanville : la version « tour » graine 7, où la Tour Pokémon est vraiment une tour.)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
CHOICE = {"LavenderTown": "iso-brut-LavenderTown-tour-7.png"}
NAMES = ["PalletTown", "ViridianCity", "PewterCity", "CeruleanCity", "LavenderTown", "VermilionCity", "CeladonCity",
         "FuchsiaCity", "SaffronCity", "CinnabarIsland", "IndigoPlateau_Exterior"]
for name in NAMES:
    im = np.array(Image.open(os.path.join(src, CHOICE.get(name, f"iso-brut-{name}.png"))).convert("RGB")).astype(int)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    background = (g < 95) & (r > 120) & (b > 70) & (r - g > 80) & (b - g > 40)
    alpha = Image.fromarray(np.where(background, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
    rgba = Image.fromarray(np.dstack([im.astype(np.uint8), np.array(alpha)]), "RGBA")
    rgba = rgba.crop(alpha.getbbox())
    w = 240
    small = rgba.resize((w, round(rgba.height * w / rgba.width)), Image.LANCZOS)
    a = np.array(small)
    a[..., 3] = np.where(a[..., 3] > 128, 255, 0)
    Image.fromarray(a, "RGBA").save(os.path.join(out, f"{name}.png"))
    print(name, small.size)
