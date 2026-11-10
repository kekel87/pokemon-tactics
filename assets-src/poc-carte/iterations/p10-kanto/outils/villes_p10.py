"""P10 : rend la vraie carte de chaque ville de Kanto depuis pokefirered (layout map.bin + tilesets primaire et
secondaire), puis en tire une miniature fidèle (recadrée sur la ville, réduite, liseré doux).

Usage (depuis p10-kanto) : python3 -P outils/villes_p10.py telechargements/pret villes
Sorties : villes/rendu/<ville>.png (carte entière, 16 px par bloc), villes/fidele/<ville>.png (miniature).
"""
import json
import os
import re
import struct
import sys

import numpy as np
from PIL import Image, ImageFilter

PRET, OUT = sys.argv[1], sys.argv[2]
PRIMARY_TILES = 640          # Rouge Feu : 640 tuiles et 640 blocs dans le tileset primaire, palettes 0 à 6
PRIMARY_PALS = 7

# ville (nom FR) -> (carte pret, recadrage en blocs (x0, y0, x1, y1) ou None = carte entière)
CITIES = {
    "Bourg Palette": ("PalletTown", (2, 1, 22, 19)),
    "Jadielle": ("ViridianCity", (6, 3, 42, 37)),
    "Argenta": ("PewterCity", (5, 4, 45, 37)),
    "Azuria": ("CeruleanCity", (4, 2, 46, 36)),
    "Lavanville": ("LavenderTown", (1, 1, 23, 19)),
    "Carmin sur Mer": ("VermilionCity", (3, 3, 45, 39)),
    "Céladopole": ("CeladonCity", (3, 3, 57, 37)),
    "Parmanie": ("FuchsiaCity", (3, 3, 45, 37)),
    "Safrania": ("SaffronCity", (8, 8, 58, 50)),
    "Cramois'Île": ("CinnabarIsland", (0, 0, 24, 20)),
    "Plateau Indigo": ("IndigoPlateau_Exterior", (0, 0, 24, 20)),
}


def load_pal(path):
    lines = open(path).read().split("\n")[3:19]
    return np.array([[int(v) for v in line.split()] for line in lines if line.strip()], dtype=np.uint8)


def tileset_dir(name):
    text = open(os.path.join(PRET, "src/data/tilesets/metatiles.h")).read()
    match = re.search(r"gMetatiles_" + name + r"\[\] = INCBIN_U16\(\"([^\"]*)/metatiles.bin\"\)", text)
    return os.path.join(PRET, match.group(1))


def load_tileset(folder):
    tiles = np.array(Image.open(os.path.join(folder, "tiles.png")))
    if tiles.ndim == 3:
        raise SystemExit(f"tiles.png non indexé : {folder}")
    cols = tiles.shape[1] // 8
    count = (tiles.shape[0] // 8) * cols
    blocks = tiles.reshape(tiles.shape[0] // 8, 8, cols, 8).transpose(0, 2, 1, 3).reshape(count, 8, 8)
    pals = [load_pal(os.path.join(folder, "palettes", f"{i:02d}.pal")) for i in range(13)]
    raw = open(os.path.join(folder, "metatiles.bin"), "rb").read()
    metas = np.array(struct.unpack(f"<{len(raw) // 2}H", raw), dtype=np.uint16).reshape(-1, 8)
    return blocks, pals, metas


def render_layout(width, height, blockdata, primary, secondary):
    p_tiles, p_pals, p_metas = primary
    s_tiles, s_pals, s_metas = secondary
    palettes = [p_pals[i] if i < PRIMARY_PALS else s_pals[i] for i in range(13)]
    cache = {}

    def metatile(mid):
        if mid in cache:
            return cache[mid]
        meta = p_metas[mid] if mid < PRIMARY_TILES else s_metas[mid - PRIMARY_TILES]
        out = np.zeros((16, 16, 3), dtype=np.uint8)
        for layer in range(2):
            for k in range(4):
                entry = int(meta[layer * 4 + k])
                index, hflip, vflip, pal = entry & 0x3FF, (entry >> 10) & 1, (entry >> 11) & 1, entry >> 12
                source = p_tiles if index < PRIMARY_TILES else s_tiles
                local = index if index < PRIMARY_TILES else index - PRIMARY_TILES
                if local >= len(source) or pal >= 13:
                    continue
                px = source[local]
                if hflip:
                    px = px[:, ::-1]
                if vflip:
                    px = px[::-1, :]
                y, x = (k // 2) * 8, (k % 2) * 8
                color = palettes[pal][px]
                if layer == 1:
                    keep = px != 0
                    out[y:y + 8, x:x + 8][keep] = color[keep]
                else:
                    out[y:y + 8, x:x + 8] = color
        cache[mid] = out
        return out

    image = np.zeros((height * 16, width * 16, 3), dtype=np.uint8)
    for by in range(height):
        for bx in range(width):
            image[by * 16:by * 16 + 16, bx * 16:bx * 16 + 16] = metatile(int(blockdata[by * width + bx]) & 0x3FF)
    return image


def miniature(image, crop):
    """Recadre la ville, réduit de moitié (2 px par bloc = 8 px) en gardant les contours, adoucit le bord."""
    x0, y0, x1, y1 = crop
    piece_array = image[y0 * 16:y1 * 16, x0 * 16:x1 * 16]
    # herbe claire de la ville rendue transparente : bâtiments, chemins, eau et arbres posés sur le terrain de la carte
    r, g, b = (piece_array[..., i].astype(int) for i in range(3))
    grass = (g - r > 45) & (g > 150) & (g - b > 15)
    grass_mask = Image.fromarray(np.where(grass, 0, 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))
    piece = Image.fromarray(piece_array)
    small = piece.resize((piece.width // 2, piece.height // 2), Image.LANCZOS)
    small = small.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    w, h = small.size
    yy, xx = np.mgrid[0:h, 0:w]
    # bord doux en rectangle arrondi : la carte de la ville se fond dans le terrain
    margin = 8
    dx = np.clip(np.maximum(margin - xx, xx - (w - 1 - margin)), 0, None)
    dy = np.clip(np.maximum(margin - yy, yy - (h - 1 - margin)), 0, None)
    distance = np.hypot(dx, dy)
    alpha = np.clip(1 - distance / margin, 0, 1) ** 1.4
    solid = np.array(grass_mask.resize((w, h), Image.BOX), dtype=np.float32) / 255
    solid = np.clip((solid - 0.25) / 0.5, 0, 1)
    rgba = np.dstack([np.array(small), (alpha * solid * 255).astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def main():
    layouts = {item["id"]: item for item in json.load(open(os.path.join(PRET, "data/layouts/layouts.json")))["layouts"]
               if "id" in item}
    os.makedirs(os.path.join(OUT, "rendu"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "fidele"), exist_ok=True)
    primary = load_tileset(tileset_dir("General"))
    for french, (map_name, crop) in CITIES.items():
        info = json.load(open(os.path.join(PRET, "data/maps", map_name, "map.json")))
        layout = layouts[info["layout"]]
        secondary_name = layout["secondary_tileset"].replace("gTileset_", "")
        secondary = load_tileset(tileset_dir(secondary_name))
        raw = open(os.path.join(PRET, layout["blockdata_filepath"]), "rb").read()
        blockdata = struct.unpack(f"<{len(raw) // 2}H", raw)
        image = render_layout(layout["width"], layout["height"], blockdata, primary, secondary)
        slug = map_name
        Image.fromarray(image).save(os.path.join(OUT, "rendu", f"{slug}.png"))
        thumb = miniature(image, crop or (0, 0, layout["width"], layout["height"]))
        thumb.save(os.path.join(OUT, "fidele", f"{slug}.png"))
        print(f"  {french} : {layout['width']} x {layout['height']} blocs, miniature {thumb.size}")


main()
