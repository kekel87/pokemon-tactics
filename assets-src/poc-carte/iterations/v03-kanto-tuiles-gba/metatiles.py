"""Rend les metatiles d'un tileset pret (Gen 3) : tiles.png 4bpp + palettes JASC + metatiles.bin."""
import struct, sys
from PIL import Image, ImageDraw
import numpy as np

def load_pal(path):
    lines = open(path).read().split("\n")[3:19]
    return [tuple(int(v) for v in l.split()) for l in lines if l.strip()]

def load(folder, npal=7):
    tiles = np.array(Image.open(f"{folder}/tiles.png"))  # indices 0..15
    pals = [load_pal(f"{folder}/{i:02d}.pal") for i in range(npal)]
    raw = open(f"{folder}/metatiles.bin", "rb").read()
    metas = [struct.unpack("<8H", raw[i:i + 16]) for i in range(0, len(raw), 16)]
    return tiles, pals, metas

def tile_pixels(tiles, index):
    cols = tiles.shape[1] // 8
    r, c = divmod(index, cols)
    if r * 8 >= tiles.shape[0]:
        return None
    return tiles[r * 8:r * 8 + 8, c * 8:c * 8 + 8]

def render_meta(tiles, pals, meta):
    out = np.zeros((16, 16, 4), dtype=np.uint8)
    for layer in range(2):
        for k in range(4):
            entry = meta[layer * 4 + k]
            index, hflip, vflip, pal = entry & 0x3FF, (entry >> 10) & 1, (entry >> 11) & 1, entry >> 12
            px = tile_pixels(tiles, index)
            if px is None or pal >= len(pals):
                continue
            if hflip: px = px[:, ::-1]
            if vflip: px = px[::-1, :]
            y, x = (k // 2) * 8, (k % 2) * 8
            for yy in range(8):
                for xx in range(8):
                    v = px[yy, xx]
                    if v == 0 and layer == 1:
                        continue
                    if v == 0 and layer == 0:
                        pass
                    out[y + yy, x + xx] = (*pals[pal][v], 255)
    return Image.fromarray(out, "RGBA")

if __name__ == "__main__":
    folder, outpath = sys.argv[1], sys.argv[2]
    tiles, pals, metas = load(folder)
    n = len(metas)
    per = 16
    scale = 3
    sheet = Image.new("RGB", (per * 16 * scale, ((n + per - 1) // per) * (16 * scale + 10)), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    for i, m in enumerate(metas):
        img = render_meta(tiles, pals, m).resize((16 * scale, 16 * scale), Image.NEAREST)
        x, y = (i % per) * 16 * scale, (i // per) * (16 * scale + 10)
        sheet.paste(img, (x, y + 10), img)
        d.text((x + 1, y), str(i), fill=(255, 255, 0))
    sheet.save(outpath)
    print(n, sheet.size)
