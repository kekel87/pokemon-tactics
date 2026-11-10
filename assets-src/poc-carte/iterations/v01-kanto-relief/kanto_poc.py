"""POC : une carte du monde de Kanto plus jolie, calculée depuis la Town Map de Rouge Feu / Vert Feuille.

Entrées : la Town Map réassemblée (kanto_assembled.png, 960x640 = 240x160 x4) et la grille des sections
de pokefirered (kanto.h, 22x15). Sortie : kanto-poc.png.
"""
import math
import random
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SOURCE = sys.argv[1]
OUT = sys.argv[2]
SCALE = 6  # pixels de sortie par pixel de la Town Map d'origine

# ---------- 1. Lecture de la Town Map et classement des couleurs ----------
original = Image.open(f"{SOURCE}/kanto_assembled.png").convert("RGB").resize((240, 160), Image.NEAREST)
pixels = np.array(original)
HEIGHT_OF = {
    (164, 180, 255): 0, (156, 213, 255): 0, (82, 148, 213): 0, (90, 172, 230): 0, (0, 0, 0): 0,
    (24, 131, 8): 1, (57, 164, 49): 1, (57, 172, 8): 2, (82, 213, 49): 2, (82, 205, 8): 3,
    (115, 230, 32): 4, (172, 246, 57): 5,
    (115, 115, 115): 5.9, (164, 164, 164): 6.1, (65, 65, 74): 5.9, (230, 230, 238): 6.3, (255, 255, 255): 6.3,
}
UNKNOWN = -1.0
height = np.full((160, 240), UNKNOWN)
for color, value in HEIGHT_OF.items():
    height[np.all(pixels == color, axis=-1)] = value
# Routes, marqueurs et magenta : on bouche avec la moyenne des voisins connus (plusieurs passes).
for _ in range(40):
    unknown = height == UNKNOWN
    if not unknown.any():
        break
    padded = np.pad(height, 1, constant_values=UNKNOWN)
    total = np.zeros_like(height)
    count = np.zeros_like(height)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            neighbour = padded[1 + dy:161 + dy, 1 + dx:241 + dx]
            known = neighbour != UNKNOWN
            total += np.where(known, neighbour, 0)
            count += known
    fill = unknown & (count > 0)
    height[fill] = total[fill] / count[fill]
height[height == UNKNOWN] = 0
# Le bord noir hors cadre devient de la mer.
height[:16, :] = 0
height[:, :24] = np.minimum(height[:, :24], 0)
height[:, 216:] = 0

# ---------- 2. Relief agrandi, lissé, avec un bruit de détail ----------
def upscale(field):
    image = Image.fromarray(field.astype(np.float32), mode="F")
    return np.array(image.resize((240 * SCALE, 160 * SCALE), Image.BICUBIC))

def value_noise(width, height_px, cell, seed):
    rng = np.random.default_rng(seed)
    grid = rng.random((height_px // cell + 2, width // cell + 2)).astype(np.float32)
    image = Image.fromarray(grid, mode="F").resize(((width // cell + 2) * cell, (height_px // cell + 2) * cell), Image.BICUBIC)
    return np.array(image)[:height_px, :width]

H = upscale(height)
W, Hpx = 240 * SCALE, 160 * SCALE
noise = (value_noise(W, Hpx, 18, 1) - 0.5) * 0.9 + (value_noise(W, Hpx, 6, 2) - 0.5) * 0.35
def blur(field, passes):
    for _ in range(passes):
        padded = np.pad(field, 2, mode="edge")
        field = sum(padded[2 + dy:2 + dy + field.shape[0], 2 + dx:2 + dx + field.shape[1]] for dy in range(-2, 3) for dx in range(-2, 3)) / 25
    return field

H = blur(H, 6)
H = H + noise * np.clip(H, 0.2, 1.0) * np.clip(1.6 - H, 0, 1) + noise * 0.3 * (H > 1.2)
land = H > 0.55

# Distance à la côte (en pixels de sortie), par dilatations successives.
def distance_to(mask, steps):
    distance = np.full(mask.shape, steps + 1, dtype=np.int32)
    current = mask.copy()
    distance[current] = 0
    for step in range(1, steps + 1):
        grown = current.copy()
        grown[1:, :] |= current[:-1, :]
        grown[:-1, :] |= current[1:, :]
        grown[:, 1:] |= current[:, :-1]
        grown[:, :-1] |= current[:, 1:]
        distance[grown & ~current] = step
        current = grown
    return distance

water_distance = distance_to(land, 30)      # pour l'eau : distance à la terre
land_distance = distance_to(~land, 6)       # pour la terre : distance à l'eau

# ---------- 3. Palette et coloriage ----------
PALETTE = {
    "deep": (40, 96, 184), "sea": (64, 136, 224), "shallow": (104, 176, 240), "foam": (216, 240, 255),
    "sand": (240, 224, 160), "sand_dark": (216, 192, 128),
    "grass": [(72, 168, 56), (96, 192, 64), (128, 208, 72), (160, 224, 96), (192, 236, 128)],
    "grass_shadow": [(48, 128, 48), (64, 152, 56), (96, 176, 64), (128, 192, 80), (160, 208, 104)],
    "rock": (152, 144, 136), "rock_shadow": (112, 104, 100), "snow": (240, 244, 252),
    "road": (224, 184, 112), "road_edge": (152, 104, 56),
}
out = np.zeros((Hpx, W, 3), dtype=np.uint8)
gy, gx = np.gradient(H)
facing_light = (gx + gy) < -0.01   # lumière venant du nord-ouest
in_shadow = (gx + gy) > 0.02

# Eau
out[~land] = PALETTE["deep"]
out[~land & (water_distance <= 22)] = PALETTE["sea"]
out[~land & (water_distance <= 7)] = PALETTE["shallow"]
ripple = (value_noise(W, Hpx, 10, 7) > 0.78) & (water_distance > 9) & ((np.indices((Hpx, W))[0] % 4) == 0)
out[~land & ripple] = PALETTE["shallow"]
out[~land & (water_distance <= 1)] = PALETTE["foam"]

# Terre : bandes d'altitude
levels = np.clip(np.floor(H - 0.55).astype(int), 0, 4)
for level in range(5):
    band = land & (levels == level) & (H < 5.6)
    out[band] = PALETTE["grass"][level]
    out[band & in_shadow] = PALETTE["grass_shadow"][level]
    out[band & facing_light & (level < 4)] = PALETTE["grass"][min(level + 1, 4)]
# Contours d'altitude : une ligne plus sombre à chaque changement de bande
edge = np.zeros_like(land)
edge[1:, :] |= levels[1:, :] != levels[:-1, :]
edge[:, 1:] |= levels[:, 1:] != levels[:, :-1]
out[land & edge & (H < 5.6)] = [tuple(int(c * 0.82) for c in PALETTE["grass_shadow"][0])]
# Montagnes
rock = land & (H >= 5.6)
out[rock] = PALETTE["rock"]
out[rock & in_shadow] = PALETTE["rock_shadow"]
out[land & (H >= 6.15)] = PALETTE["snow"]
# Plages
beach = land & (land_distance <= 3) & (H < 2.2)
out[beach] = PALETTE["sand"]
out[beach & (land_distance == 1)] = PALETTE["sand_dark"]

image = Image.fromarray(out)
draw = ImageDraw.Draw(image)

# ---------- 4. Arbres sur les zones basses et forestières ----------
random.seed(3)
def tree(x, y):
    draw.rectangle([x - 1, y + 3, x, y + 5], fill=(104, 64, 32))
    draw.ellipse([x - 4, y - 4, x + 3, y + 3], fill=(32, 104, 40), outline=(16, 64, 24))
    draw.point([(x - 2, y - 2), (x - 1, y - 2)], fill=(80, 160, 64))

forest_noise = value_noise(W, Hpx, 30, 11)
for _ in range(2600):
    x, y = random.randrange(W), random.randrange(Hpx)
    if land[y, x] and land_distance[y, x] > 5 and H[y, x] < 3.2 and forest_noise[y, x] > 0.62:
        tree(x, y)

# ---------- 5. Routes, étapes, villes, lieux ----------
header = open(f"{SOURCE}/kanto.h").read()
map_layer = header.split("[LAYER_DUNGEON]")[0]
rows = re.findall(r"\{(MAPSEC_[^}]*)\}", map_layer)
grid = [[cell.strip() for cell in row.split(",")] for row in rows]
dungeon_layer = header.split("[LAYER_DUNGEON]")[1]
dungeon_rows = [[c.strip() for c in row.split(",")] for row in re.findall(r"\{(MAPSEC_[^}]*)\}", dungeon_layer)]

def center(col, row):
    return ((35.25 + 8 * col) * SCALE, (35.5 + 8 * row) * SCALE)

WATER_ROUTES = {"MAPSEC_ROUTE_19", "MAPSEC_ROUTE_20", "MAPSEC_ROUTE_21"}
CITIES = {
    "MAPSEC_PALLET_TOWN": "Bourg Palette", "MAPSEC_VIRIDIAN_CITY": "Jadielle", "MAPSEC_PEWTER_CITY": "Argenta",
    "MAPSEC_CERULEAN_CITY": "Azuria", "MAPSEC_VERMILION_CITY": "Carmin sur Mer", "MAPSEC_LAVENDER_TOWN": "Lavanville",
    "MAPSEC_CELADON_CITY": "Céladopole", "MAPSEC_SAFFRON_CITY": "Safrania", "MAPSEC_FUCHSIA_CITY": "Parmanie",
    "MAPSEC_CINNABAR_ISLAND": "Cramois'Île", "MAPSEC_INDIGO_PLATEAU": "Plateau Indigo",
}
def kind(section):
    if section == "MAPSEC_NONE":
        return None
    if section in CITIES:
        return "city"
    if "ROUTE" in section:
        return "water" if section in WATER_ROUTES else "road"
    return None

links = []
for row in range(len(grid)):
    for col in range(len(grid[row])):
        here = kind(grid[row][col])
        if not here:
            continue
        for dcol, drow in ((1, 0), (0, 1)):
            r2, c2 = row + drow, col + dcol
            if r2 >= len(grid) or c2 >= len(grid[r2]):
                continue
            there = kind(grid[r2][c2])
            if not there:
                continue
            is_water = "water" in (here, there)
            links.append((center(col, row), center(c2, r2), is_water))

for start, end, is_water in links:
    if is_water:
        steps = 9
        for i in range(steps):
            if i % 2 == 0:
                a = (start[0] + (end[0] - start[0]) * i / steps, start[1] + (end[1] - start[1]) * i / steps)
                b = (start[0] + (end[0] - start[0]) * (i + 1) / steps, start[1] + (end[1] - start[1]) * (i + 1) / steps)
                draw.line([a, b], fill=PALETTE["foam"], width=3)
    else:
        draw.line([start, end], fill=PALETTE["road_edge"], width=9)
for start, end, is_water in links:
    if not is_water:
        draw.line([start, end], fill=PALETTE["road"], width=5)

# Étapes : une par case de route (les « ticks » cliquables du modèle arrêté)
for row in range(len(grid)):
    for col in range(len(grid[row])):
        section = grid[row][col]
        if kind(section) in ("road", "water"):
            x, y = center(col, row)
            draw.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(255, 255, 255), outline=(56, 56, 72), width=2)
            draw.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(224, 64, 64) if kind(section) == "road" else (64, 120, 224))

# Lieux spéciaux (grottes, forêt, tour, centrale)
DUNGEON_STYLE = {
    "MAPSEC_VIRIDIAN_FOREST": "forest", "MAPSEC_MT_MOON": "cave", "MAPSEC_ROCK_TUNNEL": "cave",
    "MAPSEC_DIGLETTS_CAVE": "cave", "MAPSEC_KANTO_VICTORY_ROAD": "cave", "MAPSEC_CERULEAN_CAVE": "cave",
    "MAPSEC_POKEMON_TOWER": "tower", "MAPSEC_POWER_PLANT": "plant",
}
for row in range(len(dungeon_rows)):
    for col in range(len(dungeon_rows[row])):
        style = DUNGEON_STYLE.get(dungeon_rows[row][col])
        if not style:
            continue
        x, y = center(col, row)
        x += 14
        y -= 12
        if style == "cave":
            draw.pieslice([x - 9, y - 7, x + 9, y + 11], 180, 360, fill=(120, 104, 88), outline=(64, 52, 44), width=2)
            draw.pieslice([x - 4, y - 1, x + 4, y + 9], 180, 360, fill=(24, 20, 20))
        elif style == "forest":
            for ox, oy in ((-6, 2), (6, 2), (0, -5)):
                tree(int(x + ox), int(y + oy))
        elif style == "tower":
            draw.rectangle([x - 4, y - 10, x + 4, y + 6], fill=(160, 120, 200), outline=(80, 48, 112), width=2)
            draw.polygon([(x - 6, y - 10), (x + 6, y - 10), (x, y - 17)], fill=(96, 64, 144))
        elif style == "plant":
            draw.rectangle([x - 7, y - 4, x + 7, y + 6], fill=(200, 200, 208), outline=(96, 96, 104), width=2)
            draw.polygon([(x - 2, y - 2), (x + 2, y - 2), (x - 1, y + 3), (x + 3, y + 3), (x - 3, y + 8), (x - 1, y + 3), (x - 4, y + 3)], fill=(248, 208, 48))

# Villes : petites maisons, toits colorés, plus grandes pour les villes importantes
BIG = {"MAPSEC_CELADON_CITY", "MAPSEC_SAFFRON_CITY", "MAPSEC_VERMILION_CITY", "MAPSEC_CERULEAN_CITY"}
def house(x, y, roof):
    draw.rectangle([x - 4, y - 1, x + 4, y + 5], fill=(248, 240, 224), outline=(72, 56, 48))
    draw.polygon([(x - 6, y - 1), (x + 6, y - 1), (x, y - 7)], fill=roof, outline=(72, 40, 40))
    draw.rectangle([x - 1, y + 2, x + 1, y + 5], fill=(104, 72, 48))

font = ImageFont.truetype('/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf', 12)
labels = []
for row in range(len(grid)):
    for col in range(len(grid[row])):
        section = grid[row][col]
        if section not in CITIES or section in [l[0] for l in labels]:
            continue
        x, y = center(col, row)
        draw.ellipse([x - 16, y - 13, x + 16, y + 15], fill=(200, 184, 152), outline=(120, 96, 72), width=2)
        spots = [(-7, -1, (216, 72, 56)), (7, -1, (64, 112, 200)), (0, 8, (216, 72, 56))]
        if section in BIG:
            spots += [(-8, 9, (96, 168, 88)), (8, 9, (232, 160, 48))]
        for ox, oy, roof in spots:
            house(int(x + ox), int(y + oy), roof)
        labels.append((section, x, y))

for section, x, y in labels:
    text = CITIES[section]
    box = draw.textbbox((0, 0), text, font=font)
    width = box[2] - box[0]
    tx, ty = x - width / 2, y + 18
    draw.rounded_rectangle([tx - 4, ty - 2, tx + width + 4, ty + 16], radius=3, fill=(248, 248, 240), outline=(56, 56, 72), width=2)
    draw.text((tx, ty), text, fill=(40, 40, 56), font=font)

# Cadre et recadrage sur la région
image = image.crop((14 * SCALE, 14 * SCALE, 222 * SCALE, 158 * SCALE))
frame = ImageDraw.Draw(image)
frame.rectangle([0, 0, image.width - 1, image.height - 1], outline=(56, 56, 72), width=4)
frame.rectangle([4, 4, image.width - 5, image.height - 5], outline=(232, 216, 176), width=2)
image.save(OUT)
print(OUT, image.size)
