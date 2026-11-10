"""Sprites de décor de la V06, détourés (fond transparent), à taille native, tirés des tilesets GBA de pret.

Usage : python3 -P sprites_v06.py <sources-v06> <tree-sprite.png> <dossier de sortie>
Sources : pokefirered (tileset général, Îles 6-7), pokeemerald (tileset général, Vermilava, Algatia),
sprites d'objets (rochers) ; variantes enneigées et grises recolorées à partir de ces pixels. Chaque sprite est posé par le pied (bas centre).
"""
import struct
import sys

import numpy as np
from PIL import Image

SRC, TREE_PATH, OUT = sys.argv[1:4]
T = f"{SRC}/tilesets"


def palette(path):
    lines = open(path).read().split("\n")[3:19]
    return [tuple(int(v) for v in line.split()) for line in lines if line.strip()]


def tileset(game, secondary=None):
    """Metatiles d'un tileset (secondaire avec son primaire) -> fonction de rendu d'une grille."""
    primary = f"{T}/{game}/primary/general"
    count, primary_pals = (512, 6) if game == "pokeemerald" else (640, 7)
    tiles_p = np.array(Image.open(f"{primary}/tiles.png"))
    tiles_s = np.array(Image.open(f"{T}/{game}/secondary/{secondary}/tiles.png")) if secondary else None
    pals = [palette(f"{primary}/palettes/{i:02d}.pal") for i in range(16)]
    if secondary:
        pals = pals[:primary_pals] + [palette(f"{T}/{game}/secondary/{secondary}/palettes/{i:02d}.pal")
                                      for i in range(16)][primary_pals:]
    raw = open(f"{T}/{game}/secondary/{secondary}/metatiles.bin" if secondary else f"{primary}/metatiles.bin", "rb").read()
    metas = [struct.unpack("<8H", raw[i:i + 16]) for i in range(0, len(raw), 16)]

    def tile(index):
        source = tiles_p
        if index >= count:
            source, index = tiles_s, index - count
        row, col = divmod(index, source.shape[1] // 8)
        return source[row * 8:row * 8 + 8, col * 8:col * 8 + 8] % 16

    def render(ids, layers=(0, 1)):
        out = np.zeros((16 * len(ids), 16 * len(ids[0]), 4), np.uint8)
        for j, row in enumerate(ids):
            for i, meta_index in enumerate(row):
                if meta_index is None:
                    continue
                meta = metas[meta_index]
                for layer in layers:
                    for k in range(4):
                        entry = meta[layer * 4 + k]
                        px = tile(entry & 0x3FF)
                        if (entry >> 10) & 1:
                            px = px[:, ::-1]
                        if (entry >> 11) & 1:
                            px = px[::-1, :]
                        colors = np.array(pals[entry >> 12], np.uint8)
                        y, x = j * 16 + (k // 2) * 8, i * 16 + (k % 2) * 8
                        block = out[y:y + 8, x:x + 8]
                        opaque = px != 0
                        block[opaque, :3] = colors[px[opaque]]
                        block[opaque, 3] = 255
        return out
    return render


def colors_of(rgba):
    return {tuple(c) for c in rgba[rgba[..., 3] > 0][:, :3]}


def remove_colors(rgba, colors):
    out = rgba.copy()
    flat = out[..., :3].reshape(-1, 3)
    mask = np.array([tuple(c) in colors for c in flat]).reshape(out.shape[:2])
    out[mask, 3] = 0
    return out


def largest_component(rgba):
    """Garde la plus grande tache opaque (4-connexité) : retire les miettes de fond restées."""
    opaque = rgba[..., 3] > 0
    labels = np.zeros(opaque.shape, np.int32)
    best, best_size, current = 0, 0, 0
    for y, x in zip(*np.nonzero(opaque)):
        if labels[y, x]:
            continue
        current += 1
        stack, size = [(y, x)], 0
        labels[y, x] = current
        while stack:
            cy, cx = stack.pop()
            size += 1
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < opaque.shape[0] and 0 <= nx < opaque.shape[1] and opaque[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = current
                    stack.append((ny, nx))
        if size > best_size:
            best, best_size = current, size
    out = rgba.copy()
    out[labels != best, 3] = 0
    return out


def flood_background(rgba):
    """Retire le fond relié aux bords : couleurs des bords haut, gauche et droit, propagées depuis les bords."""
    h, w = rgba.shape[:2]
    border = np.concatenate([rgba[0], rgba[:, 0], rgba[:, -1], rgba[: h // 3, 0], rgba[: h // 3, -1]])
    background = {tuple(c[:3]) for c in border if c[3] > 0}
    key = [[tuple(rgba[y, x, :3]) in background for x in range(w)] for y in range(h)]
    seen = np.zeros((h, w), bool)
    stack = [(y, x) for y in range(h) for x in (0, w - 1)] + [(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)]
    while stack:
        y, x = stack.pop()
        if not (0 <= y < h and 0 <= x < w) or seen[y, x] or not key[y][x]:
            continue
        seen[y, x] = True
        stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    out = rgba.copy()
    out[seen, 3] = 0
    return out


def trim(rgba):
    ys, xs = np.nonzero(rgba[..., 3])
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def snowy(rgba, amount):
    """Neige posée sur les pixels éclairés du haut du sprite (variante enneigée, dérivée de l'original)."""
    out = rgba.copy().astype(np.float32)
    h = out.shape[0]
    light = out[..., :3].sum(-1)
    opaque = out[..., 3] > 0
    order = np.sort(light[opaque])
    threshold = order[int(len(order) * (1 - amount))]
    rows = np.arange(h)[:, None] < h * 0.85
    cap = opaque & (light >= threshold) & rows
    out[cap, :3] = np.where(light[cap, None] > order[int(len(order) * 0.92)], (248, 252, 255), (216, 228, 244))
    mid = opaque & ~cap & (light >= order[int(len(order) * 0.35)]) & rows
    out[mid, :3] = out[mid, :3] * 0.55 + np.array((150, 170, 196)) * 0.45
    return out.astype(np.uint8)


def recolor(rgba, matrix):
    out = rgba.copy().astype(np.float32)
    out[..., :3] = np.clip(out[..., :3] @ np.array(matrix, np.float32).T, 0, 255)
    return out.astype(np.uint8)


def save(name, rgba):
    Image.fromarray(trim(rgba), "RGBA").save(f"{OUT}/{name}.png")


def main():
    import os
    os.makedirs(OUT, exist_ok=True)
    fr = tileset("pokefirered")
    em = tileset("pokeemerald")
    sevii = tileset("pokefirered", "sevii_islands_67")
    lava = tileset("pokeemerald", "lavaridge")
    moss = tileset("pokeemerald", "mossdeep")
    grass = colors_of(fr([[1, 8, 9]])) | colors_of(em([[1, 2]])) | colors_of(fr([[24, 25]]))
    sand = colors_of(fr([[192, 193, 202, 203]])) | colors_of(em([[126, 142]]))

    tree = np.array(Image.open(TREE_PATH).convert("RGBA"))
    save("feuillu", tree)                                        # Rouge Feu (V04)
    trunk = tree[-9:]                                            # tronc + ombre au sol du même arbre

    # Feuillu rond : couronne d'Émeraude (calque haut du metatile 14) sur le tronc de Rouge Feu.
    crown = trim(em([[14]], (1,)))
    round_tree = np.zeros((crown.shape[0] + 7, 16, 4), np.uint8)
    round_tree[-9:] = trunk
    ox = (16 - crown.shape[1]) // 2
    opaque = crown[..., 3] > 0
    round_tree[:crown.shape[0], ox:ox + crown.shape[1]][opaque] = crown[opaque]
    save("feuillu-rond", round_tree)

    # Sapin : deux étages du conifère des Îles 6-7 (calque haut), tronc de Rouge Feu.
    cone = trim(sevii([[142, 143]], (1,)))
    ch, cw = cone.shape[:2]
    pine = np.zeros((ch + 7 + 7, max(cw, 16), 4), np.uint8)
    tx = (pine.shape[1] - 16) // 2
    pine[-9:, tx:tx + 16] = trunk
    ox = (pine.shape[1] - cw) // 2
    for top, piece in ((7, cone), (0, cone)):                    # étage bas d'abord, puis le haut par-dessus
        sub = piece
        if top == 0:                                             # étage haut rétréci d'un pixel de chaque côté
            sub = piece.copy()
            sub[:, :3, 3] = 0
            sub[:, -3:, 3] = 0
        opaque = sub[..., 3] > 0
        pine[top:top + ch, ox:ox + cw][opaque] = sub[opaque]
    save("sapin", pine)
    save("sapin-enneige", snowy(pine, 0.4))

    # Palmier : palme de Vermilava (calque haut du metatile 6) sur un tronc annelé aux couleurs du tronc RF.
    frond = trim(remove_colors(lava([[6]], (0, 1)), grass | colors_of(lava([[5]], (0,)))))
    frond = largest_component(frond)
    frond = trim(frond)
    fh, fw = frond.shape[:2]
    trunk_colors = sorted(colors_of(tree[-9:-3]), key=lambda c: int(c[0]) + int(c[1]) + int(c[2]))
    dark, light = trunk_colors[0], trunk_colors[len(trunk_colors) // 2]
    palm = np.zeros((fh + 14, max(fw, 16), 4), np.uint8)
    cx = palm.shape[1] // 2
    for k in range(16):                                          # tronc légèrement courbe, anneaux sombres
        y = palm.shape[0] - 1 - k
        x = cx - 1 + (1 if k > 9 else 0)
        palm[y, x:x + 2, :3] = dark if k % 3 == 0 else light
        palm[y, x:x + 2, 3] = 255
        palm[y, x + 2, :3] = dark
        palm[y, x + 2, 3] = 255
    ox = (palm.shape[1] - fw) // 2 + 1
    opaque = frond[..., 3] > 0
    palm[:fh, ox:ox + fw][opaque] = frond[opaque]
    save("palmier", palm)

    # Arbre tropical d'Algatia (2 x 3 metatiles, calque haut).
    save("tropical", largest_component(moss([[258, 259], [274, 275], [290, 291]], (1,))))

    # Montagne : butte rocheuse d'Émeraude (metatiles 104-106 / 120-122), fond d'herbe retiré par remplissage.
    mound = largest_component(flood_background(em([[104, 105, 106], [120, 121, 122]])))
    save("montagne", mound)
    save("montagne-grise", recolor(mound, [[0.55, 0.3, 0.15], [0.5, 0.4, 0.15], [0.45, 0.35, 0.3]]))
    save("montagne-enneigee", snowy(mound, 0.3))

    # Rochers : rocher d'Émeraude posé sur l'eau (calque haut, déjà détouré), rochers d'objets de Rouge Feu.
    save("rocher", em([[189]], (1,)))
    for name, path in (("rocher-force", "objects/firered_strength_boulder.png"),
                       ("rocher-casse", "objects/firered_rock_smash_rock.png")):
        image = Image.open(f"{SRC}/{path}")
        indices = np.array(image)[:, :16]
        rgb = np.array(image.convert("RGB"))[:, :16]
        rgba = np.dstack([rgb, np.where(indices == 0, 0, 255).astype(np.uint8)])
        save(name, rgba)
    print("sprites écrits dans", OUT)


main()
