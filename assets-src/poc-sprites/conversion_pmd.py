"""Ramène une image générée (cases de 16 px) à un sprite au rendu PMD : trois tons par matière, contour noir.

Chaque case prend sa couleur dominante une fois ramenée sur la palette PMD de Red (trois tons par matière,
comme les sprites officiels). Un pixel isolé, entouré d'une même couleur sur ses quatre côtés, prend cette
couleur (bruit de génération). Un contour noir d'un pixel ferme la silhouette là où la génération l'a laissé
ouvert.
usage : python3 conversion_pmd.py <image.png> <sortie.png> [taille_case]
"""
import sys

import numpy as np
from PIL import Image

PALETTE = np.array([
    (0, 0, 0),
    (40, 32, 48), (88, 72, 96),  # cheveux
    (128, 32, 32), (208, 60, 48), (255, 106, 90),  # casquette, gilet
    (176, 112, 80), (230, 168, 128), (255, 216, 176),  # peau
    (32, 40, 80), (52, 104, 168), (90, 146, 208),  # jean, tee-shirt
    (176, 136, 48), (240, 192, 64), (255, 232, 144),  # sac
    (143, 151, 159), (199, 199, 207), (255, 255, 255),  # blanc
])
BLACK = 0

source, output = sys.argv[1:3]
cell = int(sys.argv[3]) if len(sys.argv) > 3 else 16
image = np.array(Image.open(source).convert("RGB")).astype(int)
rows, columns = image.shape[0] // cell, image.shape[1] // cell
indices = np.full((rows, columns), -1)
for row in range(rows):
    for column in range(columns):
        block = image[row * cell:(row + 1) * cell, column * cell:(column + 1) * cell].reshape(-1, 3)
        if (block.min(1) > 225).mean() > 0.5:
            continue
        pixels = block[block.min(1) <= 225]
        nearest = ((pixels[:, None, :] - PALETTE[None, :, :]) ** 2).sum(2).argmin(1)
        indices[row, column] = np.bincount(nearest).argmax()

cleaned = indices.copy()
for row in range(1, rows - 1):
    for column in range(1, columns - 1):
        around = {indices[row - 1, column], indices[row + 1, column], indices[row, column - 1], indices[row, column + 1]}
        if len(around) == 1 and indices[row, column] != BLACK:
            (cleaned[row, column],) = around

opaque = cleaned >= 0
padded = np.pad(opaque, 1)
ring = np.zeros_like(padded)
for shift_y, shift_x in ((1, 0), (-1, 0), (0, 1), (0, -1)):
    ring |= np.roll(np.roll(padded, shift_y, 0), shift_x, 1)
ring = ring[1:-1, 1:-1] & ~opaque
touches_light = np.zeros_like(opaque)
not_black = opaque & (cleaned != BLACK)
for shift_y, shift_x in ((1, 0), (-1, 0), (0, 1), (0, -1)):
    touches_light |= np.roll(np.roll(not_black, shift_y, 0), shift_x, 1)
cleaned[ring & touches_light] = BLACK

sprite = np.zeros((rows, columns, 4), dtype=np.uint8)
mask = cleaned >= 0
sprite[mask, :3] = PALETTE[cleaned[mask]]
sprite[mask, 3] = 255
result = Image.fromarray(sprite)
result.crop(result.getbbox()).save(output)
