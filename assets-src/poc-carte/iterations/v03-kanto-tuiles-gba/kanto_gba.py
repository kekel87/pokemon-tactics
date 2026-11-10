"""V03 : Kanto avec les tuiles officielles de Rouge Feu / Vert Feuille (tileset général de pokefirered).

Repart de la V01 (relief calculé depuis la Town Map) mais rend chaque case de 16 px avec un metatile du jeu.
Usage : python3 kanto_gba.py <dossier kanto-pret> <dossier tileset general> <sortie.png>
"""
import random
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, sys.path[0])
from metatiles import load, render_meta  # noqa: E402

SOURCE, TILESET, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
CELL = 16          # un metatile
PER_TOWNMAP_PX = 2  # cases de 16 px par pixel de Town Map (240x160 -> 480x320 cases)
SCALE_DOWN = 4      # on ne garde qu'une case sur 4 pour la grille : 120x80 cases
GRID_W, GRID_H = 120, 80

# ---------- relief, comme en V01 ----------
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
for _ in range(40):
    unknown = height == UNKNOWN
    if not unknown.any():
        break
    padded = np.pad(height, 1, constant_values=UNKNOWN)
    total = np.zeros_like(height)
    count = np.zeros_like(height)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            n = padded[1 + dy:161 + dy, 1 + dx:241 + dx]
            k = n != UNKNOWN
            total += np.where(k, n, 0)
            count += k
    fill = unknown & (count > 0)
    height[fill] = total[fill] / count[fill]
height[height == UNKNOWN] = 0
height[:16, :] = 0
height[:, 216:] = 0

def value_noise(w, h, cell, seed):
    rng = np.random.default_rng(seed)
    grid = rng.random((h // cell + 2, w // cell + 2)).astype(np.float32)
    img = Image.fromarray(grid, mode="F").resize(((w // cell + 2) * cell, (h // cell + 2) * cell), Image.BICUBIC)
    return np.array(img)[:h, :w]

# Grille de cases : la Town Map (240x160) couvre 120x80 cases de 16 px.
H = np.array(Image.fromarray(height.astype(np.float32), mode="F").resize((GRID_W, GRID_H), Image.BICUBIC))
noise = value_noise(GRID_W, GRID_H, 6, 1) - 0.5
H = H + noise * 0.8 * np.clip(H, 0.2, 1.0) * np.clip(1.6 - H, 0, 1)
land = H > 0.55

def grow(mask):
    g = mask.copy()
    g[1:, :] |= mask[:-1, :]
    g[:-1, :] |= mask[1:, :]
    g[:, 1:] |= mask[:, :-1]
    g[:, :-1] |= mask[:, 1:]
    return g

coast = land & grow(~land)                 # terre au contact de l'eau
sand = land & (coast | (grow(coast) & (H < 1.6)))
rock = land & (H >= 5.4)
forest_noise = value_noise(GRID_W, GRID_H, 7, 11)
forest = land & ~sand & ~rock & (forest_noise > 0.58) & (H < 4.5)

# ---------- rendu des tuiles ----------
tiles, palettes, metas = load(TILESET)
cache = {}
def meta(index):
    if index not in cache:
        cache[index] = render_meta(tiles, palettes, metas[index])
    return cache[index]

canvas = Image.new("RGBA", (GRID_W * CELL, GRID_H * CELL))
random.seed(5)
GRASS = [1, 1, 1, 8, 9, 16, 17]
WATER = [[464, 465], [480, 481]]
SAND = [[258, 259], [276, 277]]

for y in range(GRID_H):
    for x in range(GRID_W):
        if not land[y, x]:
            index = WATER[y % 2][x % 2]
        elif rock[y, x]:
            index = 186
        elif sand[y, x]:
            index = SAND[y % 2][x % 2]
        else:
            index = random.choice(GRASS)
        canvas.paste(meta(index), (x * CELL, y * CELL))

# Falaises : bord inférieur de la roche (corniche de Rouge Feu)
for y in range(GRID_H - 1):
    for x in range(GRID_W):
        if rock[y, x] and not rock[y + 1, x] and land[y + 1, x]:
            canvas.paste(meta(184), (x * CELL, (y + 1) * CELL), meta(184))

# Forêts : blocs d'arbres 2 x 3 cases (haut, corps, tronc), alignés sur une grille de 2 x 2
for y in range(0, GRID_H - 2, 2):
    for x in range(0, GRID_W - 1, 2):
        if forest[y:y + 3, x:x + 2].all():
            covered = y >= 2 and forest[y - 2:y + 1, x:x + 2].all()
            top = (22, 23) if covered else (20, 21)
            for dx, (a, b, c) in enumerate(zip(top, (28, 29), (36, 37))):
                canvas.paste(meta(a), ((x + dx) * CELL, y * CELL), meta(a))
                canvas.paste(meta(b), ((x + dx) * CELL, (y + 1) * CELL), meta(b))
                canvas.paste(meta(c), ((x + dx) * CELL, (y + 2) * CELL), meta(c))
# Arbres isolés et fleurs dans les prairies
for _ in range(500):
    x, y = random.randrange(GRID_W), random.randrange(GRID_H - 2)
    if land[y:y + 3, x].all() and not (forest[y:y + 3, x].any() or sand[y:y + 3, x].any() or rock[y:y + 3, x].any()):
        for dy, index in enumerate((19, 27, 35)):
            canvas.paste(meta(index), (x * CELL, (y + dy) * CELL), meta(index))
for _ in range(250):
    x, y = random.randrange(GRID_W), random.randrange(GRID_H)
    if land[y, x] and not (forest[y, x] or sand[y, x] or rock[y, x]):
        canvas.paste(meta(4), (x * CELL, y * CELL), meta(4))

# ---------- routes, étapes, villes (grille des sections, comme en V01) ----------
header = open(f"{SOURCE}/kanto.h").read()
grid = [[c.strip() for c in row.split(",")] for row in re.findall(r"\{(MAPSEC_[^}]*)\}", header.split("[LAYER_DUNGEON]")[0])]
dungeon = [[c.strip() for c in row.split(",")] for row in re.findall(r"\{(MAPSEC_[^}]*)\}", header.split("[LAYER_DUNGEON]")[1])]
PX = CELL * GRID_W / 240  # pixels de sortie par pixel de Town Map
def center(col, row):
    return ((35.25 + 8 * col) * PX, (35.5 + 8 * row) * PX)

WATER_ROUTES = {"MAPSEC_ROUTE_19", "MAPSEC_ROUTE_20", "MAPSEC_ROUTE_21"}
CITIES = {
    "MAPSEC_PALLET_TOWN": "Bourg Palette", "MAPSEC_VIRIDIAN_CITY": "Jadielle", "MAPSEC_PEWTER_CITY": "Argenta",
    "MAPSEC_CERULEAN_CITY": "Azuria", "MAPSEC_VERMILION_CITY": "Carmin sur Mer", "MAPSEC_LAVENDER_TOWN": "Lavanville",
    "MAPSEC_CELADON_CITY": "Céladopole", "MAPSEC_SAFFRON_CITY": "Safrania", "MAPSEC_FUCHSIA_CITY": "Parmanie",
    "MAPSEC_CINNABAR_ISLAND": "Cramois'Île", "MAPSEC_INDIGO_PLATEAU": "Plateau Indigo",
}
PLACES = {
    "MAPSEC_VIRIDIAN_FOREST": "Forêt de Jade", "MAPSEC_MT_MOON": "Mont Sélénite", "MAPSEC_ROCK_TUNNEL": "Grotte",
    "MAPSEC_DIGLETTS_CAVE": "Cave Taupiqueur", "MAPSEC_KANTO_VICTORY_ROAD": "Route Victoire",
    "MAPSEC_CERULEAN_CAVE": "Caverne Azurée", "MAPSEC_POKEMON_TOWER": "Tour Pokémon", "MAPSEC_POWER_PLANT": "Centrale",
}
def kind(section):
    if section == "MAPSEC_NONE":
        return None
    if section in CITIES:
        return "city"
    if "ROUTE" in section:
        return "water" if section in WATER_ROUTES else "road"
    return None

draw = ImageDraw.Draw(canvas)
path_tile = meta(254)
links = []
for row in range(len(grid)):
    for col in range(len(grid[row])):
        if not kind(grid[row][col]):
            continue
        for dc, dr in ((1, 0), (0, 1)):
            r2, c2 = row + dr, col + dc
            if r2 < len(grid) and c2 < len(grid[r2]) and kind(grid[r2][c2]):
                links.append((center(col, row), center(c2, r2), "water" in (kind(grid[row][col]), kind(grid[r2][c2]))))
# Chemins de terre en tuiles du jeu (2 cases de large), pointillés blancs en mer
for (x1, y1), (x2, y2), is_water in links:
    steps = int(max(abs(x2 - x1), abs(y2 - y1)) // 8) + 1
    for i in range(steps + 1):
        x = x1 + (x2 - x1) * i / steps
        y = y1 + (y2 - y1) * i / steps
        if is_water:
            if i % 3 == 0:
                draw.rectangle([x - 2, y - 2, x + 2, y + 2], fill=(232, 240, 255))
        else:
            gx, gy = int(x // CELL), int(y // CELL)
            for ox in (0, -1):
                for oy in (0, -1):
                    canvas.paste(path_tile, ((gx + ox) * CELL + 8, (gy + oy) * CELL + 8))

# Étapes : une par case de route ; lieux annexes : marqueur distinct (losange)
for row in range(len(grid)):
    for col in range(len(grid[row])):
        k = kind(grid[row][col])
        if k in ("road", "water"):
            x, y = center(col, row)
            draw.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(255, 255, 255), outline=(40, 40, 56), width=2)
            draw.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(224, 56, 56) if k == "road" else (56, 112, 224))
font = ImageFont.truetype("/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf", 13)
def label(text, x, y):
    box = draw.textbbox((0, 0), text, font=font)
    w = box[2] - box[0]
    draw.rounded_rectangle([x - w / 2 - 5, y - 2, x + w / 2 + 5, y + 17], radius=3, fill=(248, 248, 240), outline=(40, 40, 56), width=2)
    draw.text((x - w / 2, y), text, fill=(40, 40, 56), font=font)
for row in range(len(dungeon)):
    for col in range(len(dungeon[row])):
        name = PLACES.get(dungeon[row][col])
        if name:
            x, y = center(col, row)
            x += 22
            y -= 18
            draw.polygon([(x, y - 9), (x + 9, y), (x, y + 9), (x - 9, y)], fill=(248, 200, 64), outline=(40, 40, 56))
            draw.polygon([(x, y - 4), (x + 4, y), (x, y + 4), (x - 4, y)], fill=(160, 96, 32))

# Villes : un Centre Pokémon du jeu (4 x 2 cases) sur une place de sable
TOWN = [[88, 89, 90, 91], [96, 97, 98, 99]]
done = set()
for row in range(len(grid)):
    for col in range(len(grid[row])):
        section = grid[row][col]
        if section not in CITIES or section in done:
            continue
        done.add(section)
        x, y = center(col, row)
        gx, gy = int(x // CELL) - 2, int(y // CELL) - 1
        for dy in range(-1, 3):
            for dx in range(-1, 5):
                canvas.paste(meta(SAND[(gy + dy) % 2][(gx + dx) % 2]), ((gx + dx) * CELL, (gy + dy) * CELL))
        for dy, line in enumerate(TOWN):
            for dx, index in enumerate(line):
                canvas.paste(meta(index), ((gx + dx) * CELL, (gy + dy) * CELL), meta(index))
        label(CITIES[section], x, y + 30)

canvas = canvas.crop((int(14 * PX), int(14 * PX), int(222 * PX), int(158 * PX)))
canvas.convert("RGB").save(OUT)
print(OUT, canvas.size)
