"""Ramène une image générée sur une grille de cases (16 px par défaut) à un sprite d'un pixel par case.

Chaque case prend sa couleur dominante, une fois ses pixels ramenés sur la palette imposée ; si un quart
de la case est sombre, la case prend la couleur sombre dominante (yeux, traits fins, contour).
Le fond (blanc, ou une teinte proche) devient transparent ; un contour sombre d'un pixel est ajouté.
Variables : CONTOUR=0 sans contour ajouté, SOMBRE=0 sans la règle du sombre.
usage : python3 grille.py <image.png> <palette.png> <sortie.png> [taille_case] [decalage_x] [decalage_y]
"""
import os
import sys
import numpy as np
from PIL import Image

source, palette_path, output = sys.argv[1:4]
cell = int(sys.argv[4]) if len(sys.argv) > 4 else 16
offset_x = int(sys.argv[5]) if len(sys.argv) > 5 else 0
offset_y = int(sys.argv[6]) if len(sys.argv) > 6 else 0
OUTLINE = (16, 16, 24)
WITH_OUTLINE = os.environ.get("CONTOUR", "1") == "1"
KEEP_DARK = os.environ.get("SOMBRE", "1") == "1"

image = np.array(Image.open(source).convert("RGB")).astype(int)[offset_y:, offset_x:]
palette = np.array(Image.open(palette_path).convert("RGB")).reshape(-1, 3).astype(int)
palette = np.array([color for color in palette if tuple(color) != (255, 0, 255)])
rows, columns = image.shape[0] // cell, image.shape[1] // cell
sprite = np.zeros((rows, columns, 4), dtype=np.uint8)
for row in range(rows):
    for column in range(columns):
        block = image[row * cell:(row + 1) * cell, column * cell:(column + 1) * cell].reshape(-1, 3)
        background = (block.min(1) > 225).mean()
        if background > 0.5:
            continue
        pixels = block[block.min(1) <= 225]
        nearest = ((pixels[:, None, :] - palette[None, :, :]) ** 2).sum(2).argmin(1)
        darkness = palette[nearest].sum(1)
        dark = nearest[darkness < 150]
        chosen = np.bincount(dark).argmax() if KEEP_DARK and len(dark) >= 0.25 * len(nearest) else np.bincount(nearest).argmax()
        sprite[row, column, :3] = palette[chosen]
        sprite[row, column, 3] = 255
opaque = sprite[:, :, 3] > 0
grown = opaque.copy()
for shift_y, shift_x in ((1, 0), (-1, 0), (0, 1), (0, -1)):
    grown |= np.roll(np.roll(opaque, shift_y, 0), shift_x, 1)
ring = grown & ~opaque
if WITH_OUTLINE:
    sprite[ring] = (*OUTLINE, 255)
result = Image.fromarray(sprite)
result.crop(result.getbbox()).save(output)
