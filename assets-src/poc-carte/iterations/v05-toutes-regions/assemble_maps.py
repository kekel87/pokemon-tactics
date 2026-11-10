"""Réassemble les Town Maps des jeux (tuiles + tilemap + palette) en PNG RGB, une par région."""
import struct
import sys

import numpy as np
from PIL import Image

DL = sys.argv[1]
OUT = sys.argv[2]


def jasc(path):
    lines = open(path).read().split("\n")
    count = int(lines[2])
    return [tuple(map(int, lines[3 + i].split())) for i in range(count)]


def tiles_of(png_path, gray_levels=None):
    image = Image.open(png_path)
    if image.mode == "P":
        array = np.array(image)
    else:  # niveaux de gris : index = valeur / pas
        array = np.array(image.convert("L")).astype(int)
        array = (array * (gray_levels - 1) + 127) // 255
    rows, cols = array.shape[0] // 8, array.shape[1] // 8
    return [array[r * 8:(r + 1) * 8, c * 8:(c + 1) * 8] for r in range(rows) for c in range(cols)]


def render(entries, width, tiles, palette, entry_decoder):
    height = len(entries) // width
    out = np.zeros((height * 8, width * 8, 3), dtype=np.uint8)
    for i, entry in enumerate(entries):
        tile, hflip, vflip, bank = entry_decoder(entry)
        if tile >= len(tiles):
            continue
        block = tiles[tile]
        if hflip:
            block = block[:, ::-1]
        if vflip:
            block = block[::-1, :]
        colors = np.array([palette[min(bank * 16 + v, len(palette) - 1)] for v in range(16)], dtype=np.uint8)
        y, x = (i // width) * 8, (i % width) * 8
        out[y:y + 8, x:x + 8] = colors[np.clip(block, 0, 15)]
    return out


def gba_text(entry):
    return entry & 0x3FF, (entry >> 10) & 1, (entry >> 11) & 1, (entry >> 12) & 15


# Hoenn (Émeraude) : fond affine 8bpp, tilemap 64x64 d'un octet par tuile.
tiles = tiles_of(f"{DL}/pokeemerald/graphics/pokenav/region_map/map.png")
palette = jasc(f"{DL}/pokeemerald/graphics/pokenav/region_map/map.pal")
raw = open(f"{DL}/pokeemerald/graphics/pokenav/region_map/map.bin", "rb").read()
hoenn = np.zeros((64 * 8, 64 * 8, 3), dtype=np.uint8)
for i, tile in enumerate(raw):
    y, x = (i // 64) * 8, (i % 64) * 8
    block = tiles[tile].astype(int) if tile < len(tiles) else np.zeros((8, 8), int)
    # Les index du PNG sont absolus (palette chargée au slot 7 = index 112).
    block = np.where(block >= 112, block - 112, 0)
    hoenn[y:y + 8, x:x + 8] = np.array(palette, dtype=np.uint8)[np.clip(block, 0, len(palette) - 1)]
Image.fromarray(hoenn).save(f"{OUT}/hoenn_assembled.png")

# Sevii (Rouge Feu) : même format que Kanto, 30x20 entrées de 16 bits.
tiles = tiles_of(f"{DL}/pokefirered/graphics/region_map/region_map.png")
palette = jasc(f"{DL}/pokefirered/graphics/region_map/region_map.pal")
for name in ("sevii_123", "sevii_45", "sevii_67"):
    data = open(f"{DL}/pokefirered/graphics/region_map/{name}.bin", "rb").read()
    entries = struct.unpack(f"<{len(data) // 2}H", data)
    Image.fromarray(render(entries, 30, tiles, palette, gba_text)).save(f"{OUT}/{name}_assembled.png")

# Sinnoh (Platine) : NSCR = en-tête 0x24 octets puis entrées 16 bits.
for screen in ("top", "bottom"):
    base = f"{DL}/pokeplatinum/res/graphics/town_map/{screen}_screen"
    tiles = tiles_of(f"{base}_map_tiles.png", gray_levels=16)
    palette = jasc(f"{base}_map.pal")
    data = open(f"{base}_region_map_tilemap.NSCR", "rb").read()
    width_px, height_px = struct.unpack("<HH", data[0x18:0x1C])
    entries = struct.unpack(f"<{(len(data) - 0x24) // 2}H", data[0x24:])
    width = width_px // 8
    entries = entries[: width * (height_px // 8)]
    Image.fromarray(render(entries, width, tiles, palette, gba_text)).save(f"{OUT}/sinnoh_{screen}_assembled.png")

# Johto (Cristal) : 2bpp, une palette par tuile (town_map_palette_map.asm), tilemap d'un octet par tuile.
rgb = []
for line in open(f"{DL}/pokecrystal/gfx/pokegear/pokegear.pal"):
    line = line.strip()
    if line.startswith("RGB"):
        r, g, b = (int(v) for v in line[3:].split(","))
        rgb.append((r * 255 // 31, g * 255 // 31, b * 255 // 31))
palettes = [rgb[i * 4:(i + 1) * 4] for i in range(len(rgb) // 4)]
order = ["BORDER", "EARTH", "MOUNTAIN", "CITY", "POI", "POI_MTN"]
tile_palette = []
for line in open(f"{DL}/pokecrystal/gfx/pokegear/town_map_palette_map.asm"):
    if line.strip().startswith("townmappals"):
        names = [n.strip() for n in line.strip()[len("townmappals"):].split(",")]
        tile_palette += [order.index(n) for n in names]
tiles = tiles_of(f"{DL}/pokecrystal/gfx/pokegear/town_map.png", gray_levels=4)
for name in ("johto", "kanto"):
    raw = open(f"{DL}/pokecrystal/gfx/pokegear/{name}.bin", "rb").read()[:360]
    out = np.zeros((18 * 8, 20 * 8, 3), dtype=np.uint8)
    for i, tile in enumerate(raw):
        y, x = (i // 20) * 8, (i % 20) * 8
        # Valeur claire = index 0 dans le PNG en gris : on inverse.
        block = 3 - tiles[tile] if tile < len(tiles) else np.zeros((8, 8), int)
        out[y:y + 8, x:x + 8] = np.array(palettes[tile_palette[tile]], dtype=np.uint8)[block]
    Image.fromarray(out).save(f"{OUT}/{name}_gsc_assembled.png")
print("ok")
