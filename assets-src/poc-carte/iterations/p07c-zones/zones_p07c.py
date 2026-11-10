"""Pré-itération P07c : zones séparées (Japon, Europe en deux variantes, Unys, Alola), recadrées au plus près.

Repart de la P07b (zones_p07b.py). Dans une zone, la vraie terre (Natural Earth 1:50m) est rendue dans le style
de la V06, chaque région de la V06 est posée sur son empreinte réelle, et la vraie terre sans contenu est cachée
sous des bancs de nuages. Nouveautés de la P07c :
- cadre de chaque zone calculé sur les régions (marge en km), Unys zoomé ×2 ;
- nuages posés sur la terre loin de tout contenu, plus le bord ;
- arbres reposés droits après transformation (Hoenn tournée), et un calque par nature ;
- liaisons officielles redessinées dans la zone (Train Magnétique, routes 26/27 et 22/28, Flèche des Mers,
  Aquaria) ; liaisons de la V06 et morceaux d'étiquettes coupés retirés des régions ;
- relief tiré du vrai relief (Alpes et Pyrénées de Natural Earth, Massif central, Jura, Vosges tracés à la main
  d'après leur emprise réelle), montagnes seulement là ;
- Galar découpée dans la Grande-Bretagne retournée (nord en bas), Paldea soudée par des Pyrénées enneigées ;
- Europe B : Paldea sur l'Espagne seule, vrai Portugal gardé à l'ouest ;
- Septentria : la Route de Septentria finit sur l'arrêt de bus (sud de Septentria, Bulbapedia « Kitakami Road »).

Usage : python3 -P zones_p07c.py <dossier v06> <dossier natural-earth> <dossier de sortie> [zones,séparées,par,virgules]
Sorties : zone-japon.png, zone-europe-a.png, zone-europe-b.png, zone-unys.png, zone-alola.png, zones-planche.png,
layers/<zone>/NN-nature.png (leur superposition redonne l'image).
"""
import json
import math
import os
import random
import sys
import zlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

Image.MAX_IMAGE_PIXELS = None
V06, NE_DIR, OUT = sys.argv[1:4]
FONT = "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf"
FONT_ITALIC = "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Italic.ttf"
TREE_MIN_SCALE = 0.6       # arbres jamais plus petits ; en dessous, on en garde une part (densité conservée)
ICON_MIN_SCALE = 0.62      # villes et zones annexes jamais plus petites que ça (vignettes)
STICKER_MAX_SCALE = 1.0    # vignettes et étiquettes jamais agrandies (nettes même quand la zone zoome)
LABEL_MIN_SCALE = 0.85
ANNEX_LABEL_MIN_SCALE = 0.7
CLOUD_CLEARANCE = 64       # la terre à plus de cette distance (px) de tout contenu passe sous les nuages

PALETTE = {
    "abyss": (32, 80, 168), "deep": (40, 96, 184), "sea": (56, 128, 216), "shallow": (96, 168, 232),
    "shoal": (136, 200, 240), "foam": (232, 248, 255), "surf": (200, 232, 252),
    "sand": (240, 224, 160), "sand_dark": (216, 192, 128),
    "grass": [(72, 168, 56), (96, 192, 64), (128, 208, 72), (160, 224, 96), (192, 236, 128)],
    "grass_shadow": [(48, 128, 48), (64, 152, 56), (96, 176, 64), (128, 192, 80), (160, 208, 104)],
    "snow": (240, 244, 252), "snow_shade": (220, 228, 244), "snow_shadow": (196, 208, 232),
    "road": (224, 184, 112), "road_edge": (152, 104, 56),
}

# ======================================================================
# Relief réel (sources des montagnes)
# ======================================================================
# Natural Earth 1:50m n'a, en Europe de l'Ouest, que les Alpes et les Pyrénées. Les trois autres massifs sont tracés
# à la main sur leur emprise réelle (lon, lat), en gros : Massif central (Cantal, Auvergne, Cévennes), Jura (arc
# Genève-Bâle), Vosges (Ballon d'Alsace au Donon).
HAND_RANGES = {
    "Massif central": [(2.2, 45.0), (2.5, 45.8), (3.3, 46.1), (4.2, 45.7), (4.5, 44.9), (3.9, 44.2), (3.1, 44.0),
                       (2.4, 44.4)],
    "Jura": [(5.45, 46.15), (5.85, 46.05), (6.4, 46.45), (7.0, 46.95), (7.55, 47.35), (7.3, 47.55), (6.6, 47.25),
             (6.0, 46.85), (5.55, 46.5)],
    "Vosges": [(6.75, 47.75), (7.15, 47.8), (7.35, 48.1), (7.35, 48.55), (7.15, 48.8), (6.95, 48.6), (6.8, 48.2)],
}
# Massifs posés en montagnes : (nom, source, sprite par défaut, sprite des cœurs hauts ou None, densité)
EUROPE_RANGES = [
    ("Alpes", "ne:ALPS", "montagne-grise", "montagne-enneigee", 0.75),
    ("Jura", "hand", "montagne", None, 0.8),
    ("Vosges", "hand", "montagne", "montagne-enneigee", 0.8),
    ("Massif central", "hand", "montagne", None, 0.7),
]

# ======================================================================
# Données : zones, régions, liaisons
# ======================================================================
# Région : layer = calque de la V06 ; anchor = point du monde V06 (ville repère) ou None (centre du terrain) ;
# at = (lon, lat) où tombe ce point ; km = kilomètres par pixel de la V06 ; rot = 0 ou 90 (horaire) ;
# mode = "region" (la région prime dans son cadre) ou "union" (vraie terre + terre de la région) ;
# open = côtés du cadre (repère de la zone) où la vraie terre prolonge la région.
# Zone : km_px, lat_ref (latitude de la projection), margin = marge en km autour des régions (O, S, E, N),
# drop = anneaux Natural Earth retirés : (pays, boîte lon/lat qui contient le centre de l'anneau).
# Points des liaisons : ("v06", calque, x, y) = point du monde V06 posé avec sa région ; ("ll", lon, lat).
# Positions V06 relevées sur le calque des villes : Safrania 5816,1828 ; Carmin sur Mer 5816,1948 ;
# Jadielle 5416,1908 ; Plateau Indigo 5336,1708 ; Mont Argenté 5228,1816 ; Doublonville 4732,1937 ;
# Oliville 4652,1777 ; Bourg Geon 5172,1977 ; Île 1 4863,2509 ; Île 2 5119,2541 ; Île 3 5407,2637 ;
# Île 4 5637,2351 ; Île 5 6053,2575 ; Île 6 6085,2883 ; Île 7 5701,2979 ; fin de la Route de Septentria 5945,1366.
JAPAN_LINKS = [
    # Train Magnétique (Or, Argent, Cristal, HeartGold, SoulSilver) : Safrania -> Doublonville, au nord de la baie
    # de Kanto, puis à travers le Chūbu jusqu'à Johto (Bulbapedia : voie en partie souterraine côté Johto).
    {"kind": "rail", "label": "Train Magnétique", "label_at": 0.5,
     "points": [("v06", "kanto", 5816, 1828), ("v06", "johto", 5100, 1885), ("v06", "johto", 4935, 1880),
                ("v06", "johto", 4732, 1937)]},
    # Route 27 puis Route 26 : Bourg Geon -> Chutes Tohjo -> Route Victoire -> Plateau Indigo (tracé de la V06).
    {"kind": "road", "label": "Routes 26 et 27", "label_at": 0.3,
     "points": [("v06", "johto", 5172, 1977), ("v06", "johto", 5262, 1977), ("corner", 1, 3, 0, 0),
                ("v06", "kanto", 5336, 1708)]},
    # Route 22 puis Route 28 : Jadielle -> Mont Argenté (tracé de la V06, dans le repère de Kanto).
    {"kind": "road", "label": None, "end": ("cave", "Mont Argenté"),
     "points": [("v06", "kanto", 5416, 1908), ("v06", "kanto", 5250, 1908), ("v06", "kanto", 5250, 1810)]},
    # Flèche des Mers (Rouge Feu, Vert Feuille) : Carmin sur Mer -> Île 1, puis les îles dans l'ordre.
    {"kind": "ferry", "label": "Flèche des Mers", "label_at": 0.55,
     "points": [("v06", "kanto", 5816, 1948), ("v06", "sevii-123", 4863, 2509)]},
    {"kind": "ferry", "label": None,
     "points": [("v06", "sevii-123", 4863, 2509), ("v06", "sevii-123", 5119, 2541), ("v06", "sevii-123", 5407, 2637),
                ("v06", "sevii-45", 5637, 2351), ("v06", "sevii-45", 6053, 2575), ("v06", "sevii-67", 6085, 2883),
                ("v06", "sevii-67", 5701, 2979)]},
    # Aquaria (Or, Argent, Cristal, HeartGold, SoulSilver) : Oliville -> Carmin sur Mer, par le sud.
    {"kind": "ferry", "label": "Aquaria", "label_at": 0.5,
     "points": [("v06", "johto", 4652, 1777), ("ll", 135.6, 33.75), ("ll", 138.2, 34.2), ("v06", "kanto", 5816, 1948)]},
]

JAPON = {
    "km_px": 0.6, "lat_ref": 37.2, "margin": (110, 80, 110, 70),
    "regions": [
        {"name": "Sinnoh", "layer": "sinnoh", "anchor": None, "at": (142.75, 43.35), "km": 0.43,
         "mode": "region", "open": "", "title": (145.3, 45.2)},
        {"name": "Septentria", "layer": "septentria", "anchor": None, "at": (140.85, 39.75), "km": 0.56,
         "mode": "union", "open": "NSEW", "title": (143.1, 40.3),
         "terminus": {"at": (5945, 1372), "name": "Arrêt de bus"}},
        {"name": "Kanto", "layer": "kanto", "anchor": (5816, 1825), "at": (139.75, 35.69), "km": 0.273,
         "mode": "region", "open": "NW", "title": (141.35, 36.05)},
        {"name": "Johto", "layer": "johto", "anchor": (4772, 1966), "at": (135.3, 34.69), "km": 0.40,
         "mode": "region", "open": "EN", "title": (135.7, 36.75)},
        {"name": "Hoenn", "layer": "hoenn", "anchor": None, "at": (130.35, 31.5), "km": 0.45, "rot": 90,
         "mode": "region", "open": "N", "title": (132.3, 30.3)},
        {"name": "Îles Sevii", "layer": "sevii-123", "anchor": None, "at": (139.35, 33.85), "km": 0.273,
         "mode": "region", "open": "", "title": (143.1, 32.75)},
        {"name": None, "layer": "sevii-45", "anchor": None, "at": (140.45, 32.65), "km": 0.273,
         "mode": "region", "open": ""},
        {"name": None, "layer": "sevii-67", "anchor": None, "at": (140.0, 31.35), "km": 0.273,
         "mode": "region", "open": ""},
    ],
    "drop": [("Japan", (139.0, 41.25, 146.5, 45.7)),     # Hokkaidō -> Sinnoh
             ("Japan", (128.3, 29.0, 132.1, 33.93)),     # Kyūshū -> Hoenn
             ("Japan", (138.2, 29.0, 142.0, 34.62))],    # îles Izu -> Sevii
    "sea_labels": [("Mer du Japon", (135.6, 39.6)), ("Océan Pacifique", (143.4, 34.6)),
                   ("Mer de Chine orientale", (127.6, 30.2)), ("Shikoku", (133.4, 33.6))],
    "links": JAPAN_LINKS, "ranges": [],
}


def europe(variant):
    """Zone Europe. A : Paldea sur toute la péninsule (Portugal compris, comme la P07b) ; B : Paldea sur
    l'Espagne seule, vrai Portugal gardé à l'ouest."""
    if variant == "a":
        paldea = {"name": "Paldea", "layer": "paldea", "anchor": None, "at": (-3.7, 39.95), "km": 1.0,
                  "mode": "region", "open": "N", "open_band": 150, "title": (4.6, 39.2), "pyrenees": True}
        drop_portugal = [("Portugal", (-10.0, 36.0, -6.0, 42.5))]
        labels = []
        include = []
    else:
        # Espagne sans le Portugal : de la frontière (≈ -7° E) au cap de Creus (3,3° E) ; Paldea réduite à 0,95 km
        # par pixel et décalée vers l'est. Le côté ouest est ouvert : le vrai Portugal prolonge Paldea.
        paldea = {"name": "Paldea", "layer": "paldea", "anchor": None, "at": (-1.85, 40.0), "km": 0.95,
                  "mode": "region", "open": "NW", "open_band": 150, "color_band": 70, "title": (4.9, 39.2),
                  "pyrenees": True, "border": "Portugal"}
        drop_portugal = []
        labels = [("Portugal", (-8.05, 39.75))]
        include = [(-10.1, 38.7)]
    return {
        "km_px": 1.0, "lat_ref": 47.75, "margin": (70, 50, 90, 50),
        "regions": [
            {"name": "Galar", "layer": "galar", "anchor": None, "at": (-2.0, 54.75), "km": 0.82,
             "mode": "region", "open": "", "title": (-6.7, 57.2), "shape": "great-britain-flipped",
             "color_band": 60},
            {"name": "Kalos", "layer": "kalos", "anchor": (922, 1517), "at": (2.35, 48.6), "km": 1.0,
             "mode": "union", "open": "NSEW", "title": (-5.6, 47.6)},
            paldea,
        ],
        "drop": [("United Kingdom", (-6.0, 49.0, 2.5, 61.0)), ("Isle of Man", (-6, 53, -4, 55)),
                 ("Spain", (-10.0, 35.0, 4.6, 44.2)), ("Gibraltar", (-6, 35, -5, 37)),
                 ("Andorra", (1, 42, 2, 43))] + drop_portugal,
        "sea_labels": [("Mer du Nord", (3.0, 55.6)), ("Manche", (-3.6, 49.9)), ("Océan Atlantique", (-8.6, 45.6)),
                       ("Mer Méditerranée", (5.8, 41.6))] + labels,
        "links": [], "ranges": EUROPE_RANGES, "include": include,
    }


ZONES = {
    "japon": JAPON,
    "europe-a": europe("a"),
    "europe-b": europe("b"),
    "unys": {
        # Unys (New York + nord-est du New Jersey) zoomée ×2 : la région occupe l'essentiel de l'image.
        "km_px": 0.155, "lat_ref": 40.7, "margin": (14, 12, 14, 12),
        "regions": [
            {"name": "Unys", "layer": "unys", "anchor": (9858, 1473), "at": (-74.0, 40.72), "km": 0.31,
             "mode": "region", "open": "NW", "open_band": 300, "title": (-72.85, 40.2)},
        ],
        "drop": [("United States of America", (-74.1, 40.5, -71.8, 41.2))],   # Long Island -> Unys
        "sea_labels": [("Océan Atlantique", (-72.7, 39.95))],
        "links": [], "ranges": [],
    },
    "alola": {
        "km_px": 0.53, "lat_ref": 20.6, "margin": (40, 40, 40, 60),
        "regions": [
            {"name": "Alola", "layer": "alola", "anchor": None, "at": (-157.6, 20.55), "km": 0.53,
             "mode": "region", "open": "", "title": (-156.2, 22.2)},
        ],
        "drop": [("United States of America", (-163, 17, -152, 24))],
        "sea_labels": [("Océan Pacifique", (-155.4, 18.6))],
        "links": [], "ranges": [],
    },
}

# ======================================================================
# Outils
# ======================================================================
def value_noise(width, height, cell, seed):
    rng = np.random.default_rng(seed)
    grid = rng.random((height // cell + 2, width // cell + 2)).astype(np.float32)
    image = Image.fromarray(grid, mode="F").resize(((width // cell + 2) * cell, (height // cell + 2) * cell), Image.BICUBIC)
    return np.array(image)[:height, :width]


def distance_to(mask, steps):
    distance = np.full(mask.shape, steps + 1, dtype=np.int16)
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


def dilate(mask, steps):
    return distance_to(mask, steps) <= steps


def blur(field, radius):
    """Flou quasi gaussien : trois flous en boîte séparables (sommes cumulées)."""
    r = max(1, int(round(radius)))
    out = field.astype(np.float32)
    for _ in range(3):
        for axis in (0, 1):
            padded = np.pad(out, [(r + 1, r) if a == axis else (0, 0) for a in (0, 1)], mode="edge")
            c = np.cumsum(padded, axis=axis, dtype=np.float64)
            n = out.shape[axis]
            hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
            lo = np.take(c, np.arange(0, n), axis=axis)
            out = ((hi - lo) / (2 * r + 1)).astype(np.float32)
    return out


def soft_large(mask, factor, radius):
    h, w = mask.shape
    small = Image.fromarray((mask * 255).astype(np.uint8)).resize((max(1, w // factor), max(1, h // factor)), Image.BOX)
    small = small.filter(ImageFilter.GaussianBlur(radius))
    return np.array(small.resize((w, h), Image.BILINEAR), dtype=np.float32) / 255


def components(mask):
    """Étiquetage 4-connexe par propagation du minimum ; renvoie (labels, liste de bbox)."""
    h, w = mask.shape
    big = np.int32(h * w + 1)
    labels = np.where(mask, np.arange(h * w, dtype=np.int32).reshape(h, w), big)
    while True:
        before = labels
        m = labels.copy()
        np.minimum(m[1:, :], labels[:-1, :], out=m[1:, :])
        np.minimum(m[:-1, :], labels[1:, :], out=m[:-1, :])
        np.minimum(m[:, 1:], labels[:, :-1], out=m[:, 1:])
        np.minimum(m[:, :-1], labels[:, 1:], out=m[:, :-1])
        m = np.where(mask, m, big)
        flat = m.ravel()
        valid = flat < big
        flat2 = flat.copy()
        flat2[valid] = np.minimum(flat[valid], flat[flat[valid]])
        labels = flat2.reshape(h, w)
        if np.array_equal(labels, before):
            break
    out = []
    ids = np.unique(labels[mask])
    final = np.full((h, w), -1, dtype=np.int32)
    for k, ident in enumerate(ids):
        ys, xs = np.nonzero(labels == ident)
        final[ys, xs] = k
        out.append((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    return final, out


def catmull_rom(points, samples=14):
    if len(points) < 3:
        return [tuple(p) for p in points]
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for k in range(samples):
            t = k / samples
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(tuple(points[-1]))
    return out


def resample(line, spacing):
    out, left = [], spacing / 2
    for a, b in zip(line, line[1:]):
        length = math.dist(a, b)
        position = left
        while position < length:
            out.append((a[0] + (b[0] - a[0]) * position / length, a[1] + (b[1] - a[1]) * position / length))
            position += spacing
        left = position - length
    return out


def point_at(line, fraction):
    lengths = [math.dist(a, b) for a, b in zip(line, line[1:])]
    target = sum(lengths) * fraction
    for (a, b), length in zip(zip(line, line[1:]), lengths):
        if target <= length and length > 0:
            return (a[0] + (b[0] - a[0]) * target / length, a[1] + (b[1] - a[1]) * target / length)
        target -= length
    return line[-1]


def dashed(draw, line, color, dash, gap, width):
    """Pointillés continus le long d'une polyligne (le motif ne repart pas à chaque segment)."""
    drawing, left = True, dash
    for a, b in zip(line, line[1:]):
        length = math.dist(a, b)
        position = 0.0
        while position < length:
            piece = min(left, length - position)
            if drawing:
                p = (a[0] + (b[0] - a[0]) * position / length, a[1] + (b[1] - a[1]) * position / length)
                q = (a[0] + (b[0] - a[0]) * (position + piece) / length, a[1] + (b[1] - a[1]) * (position + piece) / length)
                draw.line([p, q], fill=color, width=width)
            position += piece
            left -= piece
            if left <= 0:
                drawing = not drawing
                left = dash if drawing else gap


def sticker_label(text, small):
    """Étiquette au style de la V06 : cartouche crème, texte sombre."""
    font = ImageFont.truetype(FONT, 10 if small else 13)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    l, t, r, b = probe.textbbox((0, 0), text, font=font)
    pad_x, pad_y = (4, 2) if small else (5, 3)
    image = Image.new("RGBA", (r - l + 2 * pad_x + 2, b - t + 2 * pad_y + 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    if small:
        d.rounded_rectangle([0, 0, image.width - 1, image.height - 1], radius=2, fill=(248, 244, 228, 225),
                            outline=(120, 108, 88), width=1)
    else:
        d.rounded_rectangle([0, 0, image.width - 1, image.height - 1], radius=3, fill=(248, 248, 240),
                            outline=(56, 56, 72), width=2)
    d.text((pad_x + 1 - l, pad_y + 1 - t), text, font=font, fill=(40, 40, 56))
    return image


def annex_icon(style):
    """Losange de zone annexe au style de la V06 (grotte seulement, pour l'instant)."""
    image = Image.new("RGBA", (28, 28), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    x, y = 14, 14
    d.polygon([(x, y - 13), (x + 13, y), (x, y + 13), (x - 13, y)], fill=(248, 240, 208), outline=(56, 56, 72), width=2)
    if style == "cave":
        d.pieslice([x - 8, y - 6, x + 8, y + 10], 180, 360, fill=(120, 104, 88), outline=(64, 52, 44))
        d.pieslice([x - 4, y - 1, x + 4, y + 9], 180, 360, fill=(24, 20, 20))
    return image


def grid_path(points, passable, penalty, clearance_weight=3.0):
    """Plus court chemin sur une grille réduite (×3) : passable = où l'on peut aller, penalty = surcoût par pixel
    (routes et vignettes à éviter) ; coût plus fort près du bord du passable (on reste au large des côtes). D'un
    point d'étape à l'autre ; les extrémités hors du passable (ports, gares) y sont reliées au plus court."""
    import heapq
    f = 3
    H, W = passable.shape
    hs, ws = H // f, W // f
    small = np.array(Image.fromarray((~passable[:hs * f, :ws * f] * 255).astype(np.uint8)).resize((ws, hs), Image.BOX)) > 100
    small_penalty = np.array(Image.fromarray(penalty[:hs * f, :ws * f].astype(np.float32), mode="F").resize((ws, hs), Image.BOX))
    near = distance_to(small, 8).astype(np.float32)
    cost = 1 + clearance_weight * np.clip(8 - near, 0, 8) / 8 + small_penalty
    cost[small] = np.inf

    def snap(x, y):
        cx, cy = int(x // f), int(y // f)
        for r in range(0, 40):
            best, best_d = None, 1e9
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    if max(abs(dx), abs(dy)) != r:
                        continue
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < ws and 0 <= ny < hs and not small[ny, nx] and near[ny, nx] >= 2:
                        dd = math.hypot(dx, dy)
                        if dd < best_d:
                            best, best_d = (nx, ny), dd
            if best is not None:
                return best
        return (cx, cy)

    out = [points[0]]
    for a, b in zip(points, points[1:]):
        start, goal = snap(*a), snap(*b)
        dist = {start: 0.0}
        prev = {}
        heap = [(0.0, start)]
        while heap:
            d, node = heapq.heappop(heap)
            if node == goal:
                break
            if d > dist.get(node, 1e18):
                continue
            x, y = node
            for dx, dy, step in ((1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, 1.414), (1, -1, 1.414),
                                 (-1, 1, 1.414), (-1, -1, 1.414)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < ws and 0 <= ny < hs and cost[ny, nx] < np.inf:
                    nd = d + step * cost[ny, nx]
                    if nd < dist.get((nx, ny), 1e18):
                        dist[(nx, ny)] = nd
                        prev[(nx, ny)] = node
                        heapq.heappush(heap, (nd, (nx, ny)))
        cells = [goal]
        while cells[-1] != start and cells[-1] in prev:
            cells.append(prev[cells[-1]])
        cells.reverse()
        coarse = [((cx + 0.5) * f, (cy + 0.5) * f) for cx, cy in cells[4:-4:7]]
        out += coarse
        out.append(b)
    return catmull_rom(out, samples=6)


def bus_stop_icon():
    """Losange de zone annexe (style V06) avec un petit car : l'arrêt où le car de Paldea dépose le joueur."""
    image = Image.new("RGBA", (28, 28), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    x, y = 14, 14
    d.polygon([(x, y - 13), (x + 13, y), (x, y + 13), (x - 13, y)], fill=(248, 240, 208), outline=(56, 56, 72), width=2)
    d.rounded_rectangle([x - 7, y - 5, x + 7, y + 4], radius=2, fill=(232, 176, 48), outline=(120, 80, 24))
    d.rectangle([x - 5, y - 3, x - 1, y - 1], fill=(200, 232, 248))
    d.rectangle([x + 1, y - 3, x + 5, y - 1], fill=(200, 232, 248))
    d.ellipse([x - 5, y + 3, x - 2, y + 6], fill=(48, 48, 56))
    d.ellipse([x + 2, y + 3, x + 5, y + 6], fill=(48, 48, 56))
    return image


# ======================================================================
# Sources de la V06
# ======================================================================
print("lecture des calques V06", flush=True)
NATURE = {name: Image.open(os.path.join(V06, "layers", f"{name}.png")).convert("RGBA")
          for name in ("02-terre", "04-routes", "05-acces", "06-etapes", "07-zones-annexes", "08-villes", "09-etiquettes")}
LINKS_V06 = Image.open(os.path.join(V06, "layers", "regions", "liaisons.png")).getchannel("A")
DECOR = json.load(open(os.path.join(V06, "decor.json")))["decor"]
SPRITES = {}
DECOR_REGION = {"sevii-123": "Sevii 123", "sevii-45": "Sevii 45", "sevii-67": "Sevii 67"}
COUNTRIES = json.load(open(os.path.join(NE_DIR, "ne_50m_admin_0_countries.geojson")))["features"]
LAKES = json.load(open(os.path.join(NE_DIR, "ne_50m_lakes.geojson")))["features"]
GEOGRAPHY = json.load(open(os.path.join(NE_DIR, "ne_50m_geography_regions_polys.geojson")))["features"]


def sprite(name):
    if name not in SPRITES:
        SPRITES[name] = Image.open(os.path.join(V06, "sprites", f"{name}.png")).convert("RGBA")
    return SPRITES[name]


def polygons_of(feature):
    geometry = feature["geometry"]
    return geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]


class Source:
    """Une région de la V06 découpée par nature, sans rochers ni montagnes ni grand titre, sans les liaisons de la
    V06 ni les morceaux d'étiquettes ou de vignettes coupés par le bord de sa part du monde."""

    def __init__(self, layer):
        region_alpha = Image.open(os.path.join(V06, "layers", "regions", f"{layer}.png")).getchannel("A")
        self.box = region_alpha.getbbox()
        x0, y0, x1, y1 = self.box
        mask = np.array(region_alpha.crop(self.box)) > 0
        self.size = (x1 - x0, y1 - y0)
        links = np.array(LINKS_V06.crop(self.box)) > 0

        def cut(name):
            array = np.array(NATURE[name].crop(self.box))
            array[~mask] = 0
            return array

        def whole(name):
            """Composantes du calque entier (non découpé, cadre élargi de 3 px) : celles qui débordent de la part de
            la région ont été coupées par la découpe de la V06."""
            pad = 3
            big = np.array(NATURE[name].crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad)))
            big_mask = np.zeros(big.shape[:2], dtype=bool)
            big_mask[pad:-pad, pad:-pad] = mask
            labels, boxes = components(big[..., 3] > 0)
            outside = (big[..., 3] > 0) & ~big_mask
            cut_ids = set(np.unique(labels[outside]).tolist()) - {-1}
            full = big[pad:-pad, pad:-pad].copy()
            full[~mask] = 0
            labels = labels[pad:-pad, pad:-pad]
            h, w = mask.shape
            boxes = [(max(0, a - pad), max(0, b - pad), min(w, c - pad), min(h, d - pad)) for a, b, c, d in boxes]
            return full, labels, boxes, cut_ids

        terre = cut("02-terre")
        self.land = terre[..., 3] > 0
        ys, xs = np.nonzero(self.land)
        self.land_box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        self.terrain = Image.fromarray(terre, "RGBA")
        region_name = DECOR_REGION.get(layer, layer.capitalize())
        self.trees = [(item["x"] - x0, item["y"] - y0, item["essence"]) for item in DECOR
                      if item["region"] == region_name and item["type"] == "arbre"]
        # tracés sans les liaisons de la V06 (elles sont redessinées par zone), sans les miettes qui en restent
        lines = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
        for name in ("04-routes", "05-acces", "06-etapes"):
            piece = cut(name)
            over = piece[..., 3] > 0
            lines[over] = piece[over]
        lines[dilate(links, 1)] = 0
        for ex0, ey0, ex1, ey1 in ERASE.get(layer, []):
            lines[max(0, ey0 - y0):max(0, ey1 - y0), max(0, ex0 - x0):max(0, ex1 - x0)] = 0
        near_links = dilate(links, 8)
        labels, boxes = components(lines[..., 3] > 0)
        removed = 0
        for k, (a, b, c, d) in enumerate(boxes):
            if (c - a) * (d - b) < 120 and (near_links[b:d, a:c] & (labels[b:d, a:c] == k)).any():
                lines[b:d, a:c][labels[b:d, a:c] == k] = 0
                removed += 1
        self.lines = Image.fromarray(lines, "RGBA")
        # vignettes
        self.icons = []    # (kind, bbox, image)
        dropped = 0
        for name, kind in (("08-villes", "city"), ("07-zones-annexes", "annex")):
            array, labels, boxes, cut_ids = whole(name)
            for k, (a, b, c, d) in enumerate(boxes):
                if (c - a) * (d - b) < 30 or not array[b:d, a:c][labels[b:d, a:c] == k, 3].any():
                    continue
                own = labels[b:d, a:c] == k
                if k in cut_ids:
                    dropped += 1
                    continue
                piece = array[b:d, a:c].copy()
                piece[~own] = 0
                self.icons.append((kind, (a, b, c, d), Image.fromarray(piece, "RGBA")))
        array, labels, boxes, cut_ids = whole("09-etiquettes")
        self.labels = []
        for k, (a, b, c, d) in enumerate(boxes):
            if d - b > 27 or (c - a) * (d - b) < 40:   # lettres du grand titre de région, poussières
                continue
            own = labels[b:d, a:c] == k
            if not array[b:d, a:c][own, 3].any():
                continue
            if k in cut_ids:
                dropped += 1
                continue
            piece = array[b:d, a:c].copy()
            piece[~own] = 0
            self.labels.append(((a, b, c, d), Image.fromarray(piece, "RGBA")))
        print(f"  source {layer} : {dropped} vignettes ou étiquettes coupées retirées, {removed} miettes de tracés",
              flush=True)


SOURCES = {}
# Bouts de tracé de la V06 qui finissent dans le vide (boîtes en pixels du monde V06) : à Unys, la Route 17 partait
# de Renouet vers l'ouest sans rien au bout ; on la fait finir au carrefour du Labo P2.
ERASE = {"unys": [(10128, 1594, 10177, 1613)]}


def source_of(layer):
    if layer not in SOURCES:
        SOURCES[layer] = Source(layer)
    return SOURCES[layer]


# ======================================================================
# Rendu d'une zone
# ======================================================================
def region_extent_km(region, source):
    """Boîte de la terre de la région autour de son point d'ancrage, en km (x vers l'est, y vers le sud)."""
    lx0, ly0, lx1, ly1 = source.land_box
    if region["anchor"] is None:
        ax, ay = (lx0 + lx1) / 2, (ly0 + ly1) / 2
    else:
        ax, ay = region["anchor"][0] - source.box[0], region["anchor"][1] - source.box[1]
    corners = [(lx0, ly0), (lx1, ly1)]
    if region.get("rot", 0) == 90:
        sh = source.size[1]
        corners = [(sh - y, x) for x, y in corners]
        ax, ay = sh - ay, ax
    xs = sorted((c[0] - ax) * region["km"] for c in corners)
    ys = sorted((c[1] - ay) * region["km"] for c in corners)
    return xs[0], ys[0], xs[1], ys[1]


def render_zone(key, spec):
    km_px = spec["km_px"]
    phi = math.radians(spec["lat_ref"])
    px_lon = 111.32 * math.cos(phi) / km_px
    px_lat = 110.57 / km_px
    # cadre de la zone : les régions et leur marge (km)
    mw, ms, me, mn = spec["margin"]
    lon_min = lat_min = 1e9
    lon_max = lat_max = -1e9
    for region in spec["regions"]:
        source = source_of(region["layer"])
        kx0, ky0, kx1, ky1 = region_extent_km(region, source)
        lon, lat = region["at"]
        k_lon = 111.32 * math.cos(phi)
        lon_min = min(lon_min, lon + (kx0 - mw) / k_lon)
        lon_max = max(lon_max, lon + (kx1 + me) / k_lon)
        lat_max = max(lat_max, lat - (ky0 - mn) / 110.57)
        lat_min = min(lat_min, lat - (ky1 + ms) / 110.57)
    for lon, lat in spec.get("include", []):
        lon_min, lon_max = min(lon_min, lon), max(lon_max, lon)
        lat_min, lat_max = min(lat_min, lat), max(lat_max, lat)
    lon0, lat0, lon1, lat1 = lon_min, lat_min, lon_max, lat_max
    W, H = int((lon1 - lon0) * px_lon), int((lat1 - lat0) * px_lat)
    print(f"zone {key} : {W} x {H}, lon {lon0:.2f}..{lon1:.2f}, lat {lat0:.2f}..{lat1:.2f}", flush=True)

    def project(lon, lat):
        return ((lon - lon0) * px_lon, (lat1 - lat) * px_lat)

    def unproject(x, y):
        return (lon0 + x / px_lon, lat1 - y / px_lat)

    def rasterize(rings, scale=2, fill=255, image=None):
        own = image is None
        if own:
            image = Image.new("L", (W * scale, H * scale), 0)
        draw = ImageDraw.Draw(image)
        for ring in rings:
            pts = [((lon - lon0) * px_lon * scale, (lat1 - lat) * px_lat * scale) for lon, lat in ring]
            if len(pts) > 2:
                draw.polygon(pts, fill=fill)
        if own:
            return np.array(image.resize((W, H), Image.BOX), dtype=np.float32) / 255
        return image

    # ---------------------------------------------------------- vraie terre
    real_image = Image.new("L", (W * 2, H * 2), 0)
    keep_rings = []
    for feature in COUNTRIES:
        admin = feature["properties"]["ADMIN"]
        for polygon in polygons_of(feature):
            ring = np.array(polygon[0], float)
            if ring[:, 0].max() < lon0 - 2 or ring[:, 0].min() > lon1 + 2 or ring[:, 1].max() < lat0 - 2 or ring[:, 1].min() > lat1 + 2:
                continue
            cx, cy = ring[:, 0].mean(), ring[:, 1].mean()
            if any(admin == country and b[0] <= cx <= b[2] and b[1] <= cy <= b[3] for country, b in spec["drop"]):
                continue
            keep_rings.append((admin, ring))
    rasterize([ring for _, ring in keep_rings], image=real_image)
    lake_rings = [polygon[0] for feature in LAKES if (feature["properties"].get("scalerank") or 9) <= 3
                  for polygon in polygons_of(feature)]
    rasterize(lake_rings, fill=0, image=real_image)
    real = np.array(real_image.resize((W, H), Image.BOX), dtype=np.float32) / 255
    del real_image

    # ---------------------------------------------------------- régions posées
    field = blur(real, 1.2)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    placed = {}
    for index, region in enumerate(spec["regions"]):
        scale = region["km"] / km_px
        source = source_of(region["layer"])
        rot = region.get("rot", 0)
        sw, sh = source.size
        if region["anchor"] is None:
            lx0, ly0, lx1, ly1 = source.land_box
            ax, ay = (lx0 + lx1) / 2, (ly0 + ly1) / 2
        else:
            ax, ay = region["anchor"][0] - source.box[0], region["anchor"][1] - source.box[1]
        zx, zy = project(*region["at"])

        def rotate_point(x, y, sh=sh, rot=rot):
            return (sh - y, x) if rot == 90 else (x, y)

        rax, ray = rotate_point(ax, ay)
        ox, oy = zx - rax * scale, zy - ray * scale

        def to_zone(x, y, rotate_point=rotate_point, ox=ox, oy=oy, scale=scale):
            rx, ry = rotate_point(x, y)
            return ox + rx * scale, oy + ry * scale

        def place_image(image, rot=rot, scale=scale, ox=ox, oy=oy):
            if rot == 90:
                image = image.transpose(Image.Transpose.ROTATE_270)
            size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
            resized = image.resize(size, Image.LANCZOS if scale < 1 else Image.NEAREST)
            canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            canvas.paste(resized, (round(ox), round(oy)), resized)
            return canvas

        terrain = place_image(source.terrain)
        terrain_alpha = np.array(terrain.getchannel("A"), dtype=np.float32) / 255
        land_mask = Image.fromarray((source.land * 255).astype(np.uint8))
        land_layer = np.array(place_image(Image.merge("RGBA", [land_mask] * 4)).getchannel("A"), dtype=np.float32) / 255
        lines = place_image(source.lines)
        lx0, ly0, lx1, ly1 = source.land_box
        corners = [to_zone(lx0, ly0), to_zone(lx1, ly1)]
        fx0, fx1 = sorted(c[0] for c in corners)
        fy0, fy1 = sorted(c[1] for c in corners)
        land_field = blur(land_layer, 1.0)
        terrain_frame = (fx0, fy0, fx1, fy1)
        if region.get("shape") == "great-britain-flipped":
            land_field, (fx0, fy0, fx1, fy1) = great_britain_flipped(W, H, terrain_frame, land_layer, lines)
        band = max(18.0, 40 * min(1.0, scale))
        wobble = (value_noise(W, H, 37, index + 3) - 0.5) * band * 0.9
        sides = {"W": xx - fx0, "E": fx1 - xx, "N": yy - fy0, "S": fy1 - yy}
        inside = np.minimum.reduce(list(sides.values())) + wobble
        w = np.clip(inside / band, 0, 1)
        if region["mode"] == "union":
            u = np.ones_like(w)
        else:
            u = np.zeros_like(w)
            open_band = region.get("open_band", band * 2.2)
            for side in region["open"]:
                u = np.maximum(u, np.clip(1 - (sides[side] + wobble - open_band) / band, 0, 1))
        # fondu des couleurs du terrain de la région, mesuré sur son propre cadre
        tx0, ty0, tx1, ty1 = terrain_frame
        tsides = {"W": xx - tx0, "E": tx1 - xx, "N": yy - ty0, "S": ty1 - yy}
        color_band = region.get("color_band", 3.0 * band)
        if region.get("shape"):
            reach = [np.clip((tsides[side] + wobble) / color_band, 0, 1) for side in "NSEW"]
        else:
            reach = [np.clip((tsides[side] + wobble) / (color_band if side in region["open"] else band * 0.62), 0, 1)
                     for side in "NSEW"]
        color = np.minimum.reduce(reach)
        region_field = np.maximum(land_field, field * u)
        field = w * region_field + (1 - w) * field
        placed[region["layer"]] = {
            "region": region, "source": source, "scale": scale, "to_zone": to_zone, "terrain": terrain,
            "terrain_alpha": terrain_alpha, "land": land_layer, "lines": lines, "color": color,
            "frame": (fx0, fy0, fx1, fy1), "terrain_frame": terrain_frame}
        print(f"  {region['layer']} : échelle {scale:.3f}, cadre {int(fx0)},{int(fy0)} {int(fx1)},{int(fy1)}", flush=True)
    del yy, xx

    noise = (value_noise(W, H, 23, 41) - 0.5) * 0.18
    land = (field + noise * np.clip(1 - np.abs(field - 0.5) * 2, 0, 1)) > 0.5
    del field

    # ---------------------------------------------------------- eau (style V06)
    rng = np.random.default_rng(17)
    gy_, gx_ = np.indices((H, W), dtype=np.int32)
    checker = ((gx_ + gy_) % 2) == 0
    del gy_, gx_
    deep_distance = distance_to(land, 70)
    wd = deep_distance + (value_noise(W, H, 26, 31) - 0.5) * 7 + (value_noise(W, H, 9, 32) - 0.5) * 2
    image = np.zeros((H, W, 3), dtype=np.uint8)
    image[:] = PALETTE["abyss"]
    band_index = np.zeros((H, W), dtype=np.int8)
    for index, (limit, color) in enumerate(((62, "deep"), (28, "sea"), (10, "shallow"), (4, "shoal")), start=1):
        inside = wd <= limit
        edge = (wd > limit) & (wd <= limit + 2.2) & checker
        image[inside | edge] = PALETTE[color]
        band_index[inside | edge] = index
    image[(deep_distance == 4) & (value_noise(W, H, 5, 33) > 0.42)] = PALETTE["surf"]
    image[deep_distance == 1] = PALETTE["foam"]
    image[(deep_distance == 2) & checker] = PALETTE["foam"]
    wave_colors = np.array([(72, 128, 216), (80, 144, 224), (104, 168, 240), (152, 208, 248), (184, 228, 252),
                            (200, 236, 252)], dtype=np.uint8)
    cy, cx = np.mgrid[0:H:13, 0:W:22]
    keep = rng.random(cy.shape) < 0.6
    cy = (cy + rng.integers(0, 11, cy.shape))[keep]
    cx = (cx + rng.integers(0, 16, cx.shape))[keep]
    for dy, dx in ((1, 0), (0, 1), (0, 2), (1, 3), (1, 4), (0, 5)):
        py, px = np.clip(cy + dy, 0, H - 1), np.clip(cx + dx, 0, W - 1)
        ok = (deep_distance[py, px] > 5) & ~land[py, px]
        image[py[ok], px[ok]] = wave_colors[band_index[py[ok], px[ok]]]
    del wd, band_index

    # ---------------------------------------------------------- relief réel : Natural Earth + massifs tracés
    ne_ranges = {}
    for feature in GEOGRAPHY:
        if feature["properties"]["FEATURECLA"] == "Range/mtn":
            ne_ranges.setdefault(feature["properties"]["NAME"], []).extend(p[0] for p in polygons_of(feature))
    range_rings = [ring for rings in ne_ranges.values() for ring in rings] + list(HAND_RANGES.values())
    ranges_soft = soft_large(rasterize(range_rings, scale=1) > 0.5, 4, 3)
    inland = soft_large(land, 8, 4)
    hills = value_noise(W, H, 170, 21)
    height = 0.9 + 0.35 * np.clip((inland - 0.5) * 2, 0, 1) + 1.0 * (hills - 0.5) + 1.4 * np.clip(ranges_soft * 1.4, 0, 1) ** 1.6
    height += (value_noise(W, H, 40, 1) - 0.5) * 0.3 + (value_noise(W, H, 11, 2) - 0.5) * 0.12
    gy, gx = np.gradient(blur(height, 3))
    facing_light, in_shadow = (gx + gy) < -0.004, (gx + gy) > 0.006
    levels = np.clip(np.floor(height - 0.55).astype(int), 0, 4)
    for level in range(5):
        part = land & (levels == level)
        image[part] = PALETTE["grass"][level]
        image[part & in_shadow] = PALETTE["grass_shadow"][level]
        image[part & facing_light & (level < 4)] = PALETTE["grass"][min(level + 1, 4)]
    edge = np.zeros_like(land)
    edge[1:, :] |= levels[1:, :] != levels[:-1, :]
    edge[:, 1:] |= levels[:, 1:] != levels[:, :-1]
    image[land & edge] = tuple(int(c * 0.82) for c in PALETTE["grass_shadow"][0])
    land_distance = distance_to(~land, 4)
    beach = land & (land_distance <= 3) & (height < 2.4)
    image[beach] = PALETTE["sand"]
    image[beach & (land_distance == 1)] = PALETTE["sand_dark"]
    del height, gx, gy, levels, edge, ranges_soft, inland, hills, land_distance

    layers = {}
    water = np.zeros((H, W, 4), dtype=np.uint8)
    water[..., :3] = image
    water[..., 3] = np.where(land, 0, 255)
    layers["01-eau"] = Image.fromarray(water, "RGBA")
    ground = np.zeros((H, W, 4), dtype=np.uint8)
    ground[..., :3] = image
    ground[..., 3] = np.where(land, 255, 0)
    terre = Image.fromarray(ground, "RGBA")
    del water, ground, image

    # ---------------------------------------------------------- terrain des régions par-dessus
    visible = {}   # part visible du terrain de chaque région (pour poser ses arbres)
    for layer_name, p in placed.items():
        foreign_land = land & (p["land"] < 0.5)
        fade = np.clip((distance_to(foreign_land, 7).astype(np.float32) - 1) / 6, 0, 1)
        alpha = p["terrain_alpha"] * p["color"] * fade * land
        layer = np.array(p["terrain"])
        layer[..., 3] = (alpha * 255).astype(np.uint8)
        terre.alpha_composite(Image.fromarray(layer, "RGBA"))
        visible[layer_name] = alpha
    # Portugal (Europe B) : frontière en pointillé entre la vraie terre du Portugal et Paldea
    for p in placed.values():
        country = p["region"].get("border")
        if country:
            rings = [ring for admin, ring in keep_rings if admin == country]
            mask = (rasterize(rings) > 0.5) & land & (visible[p["region"]["layer"]] < 0.5)
            border = mask & dilate(land & ~mask, 1) & ~dilate(~land, 3)
            ys, xs = np.nonzero(border)
            dots = ((xs + ys) // 3) % 2 == 0
            array = np.array(terre)
            array[ys[dots], xs[dots]] = (120, 88, 64, 255)
            terre = Image.fromarray(array, "RGBA")
    layers["02-terre"] = terre

    # ---------------------------------------------------------- tracés des régions
    routes = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for p in placed.values():
        routes.alpha_composite(p["lines"])
    layers["05-routes"] = routes

    # ---------------------------------------------------------- liaisons officielles
    liaisons = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    link_lines, link_labels, end_markers = [], [], []
    k_line = min(1.0, max(0.55, sum(p["scale"] for p in placed.values()) / len(placed)))
    for link in spec["links"]:
        base = []
        for point in link["points"]:
            if point[0] == "v06":
                p = placed[point[1]]
                base.append(p["to_zone"](point[2] - p["source"].box[0], point[3] - p["source"].box[1]))
            elif point[0] == "ll":
                base.append(project(point[1], point[2]))
            else:
                base.append(None)
        points = []
        for point, b in zip(link["points"], base):
            if b is None:
                _, i, j, dx, dy = point
                b = (base[i][0] + dx, base[j][1] + dy)
            points.append(b)
        if link["kind"] == "road":
            line = points
        elif link["kind"] == "ferry":
            line = grid_path(points, ~land, np.zeros(land.shape, dtype=np.float32))
        else:
            # voie ferrée : sur la terre, en évitant villes et lieux, en ne coupant les routes que s'il le faut
            penalty = dilate(np.array(routes.getchannel("A")) > 0, 4).astype(np.float32) * 30
            for p in placed.values():
                for _, (a, b, c, d), _ in p["source"].icons:
                    x0_, y0_ = p["to_zone"](a, b)
                    x1_, y1_ = p["to_zone"](c, d)
                    xa, xb = sorted((x0_, x1_))
                    ya, yb = sorted((y0_, y1_))
                    penalty[max(0, int(ya) - 10):int(yb) + 10, max(0, int(xa) - 10):int(xb) + 10] += 30
            penalty += (~land).astype(np.float32) * 6   # un pont est possible, mais coûte
            line = grid_path(points, np.ones_like(land), penalty, clearance_weight=0)
        draw_link(liaisons, link["kind"], line, k_line)
        link_lines.append(line)
        on_land = np.mean([land[int(np.clip(y, 0, H - 1)), int(np.clip(x, 0, W - 1))] for x, y in resample(line, 4)])
        print(f"  liaison {link['kind']} {link.get('label') or ''} : {on_land:.0%} sur terre", flush=True)
        if link.get("label"):
            link_labels.append((link["label"], point_at(line, link["label_at"])))
        if link.get("end"):
            end_markers.append((link["end"], line[-1]))
    layers["06-liaisons"] = liaisons

    # ---------------------------------------------------------- vignettes : villes, zones annexes, étiquettes
    lieux = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    etiquettes = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    taken = []

    def free(box, ignore=None):
        return all(not (box[0] < b[2] and box[2] > b[0] and box[1] < b[3] and box[3] > b[1]) for b in taken if b is not ignore)

    labels_to_place = []
    for p in placed.values():
        source, scale, to_zone = p["source"], p["scale"], p["to_zone"]
        k_icon = min(max(scale, ICON_MIN_SCALE), STICKER_MAX_SCALE)
        k_label = min(max(scale, LABEL_MIN_SCALE), STICKER_MAX_SCALE)
        icon_boxes = []
        stickers = list(source.icons)
        terminus = p["region"].get("terminus")
        if terminus:
            tx, ty = terminus["at"][0] - source.box[0], terminus["at"][1] - source.box[1]
            stickers.append(("annex", (tx - 14, ty - 14, tx + 14, ty + 14), bus_stop_icon()))
        for kind, (a, b, c, d), sticker in stickers:
            zx, zy = to_zone((a + c) / 2, (b + d) / 2)
            size = (max(1, round(sticker.width * k_icon)), max(1, round(sticker.height * k_icon)))
            s = sticker.resize(size, Image.LANCZOS if k_icon < 1 else Image.NEAREST)
            box = (zx - size[0] / 2, zy - size[1] / 2, zx + size[0] / 2, zy + size[1] / 2)
            lieux.alpha_composite(s, (round(box[0]), round(box[1])))
            taken.append(box)
            icon_boxes.append((kind, (a, b, c, d), (zx, zy), box))
        source_labels = list(source.labels)
        if terminus:
            image = sticker_label(terminus["name"], small=True)
            tx, ty = terminus["at"][0] - source.box[0], terminus["at"][1] - source.box[1]
            source_labels.append(((tx + 17, ty - image.height // 2, tx + 17 + image.width, ty + image.height // 2 + 1), image))
        for (a, b, c, d), sticker in source_labels:
            lcx, lcy = (a + c) / 2, (b + d) / 2
            best, best_d = None, 1e9
            label_kind = "city" if d - b >= 17 else "annex"   # étiquettes de ville en 13 px, de lieu en 10 px
            for kind, (ia, ib, ic, id_), center, zbox in icon_boxes:
                if kind != label_kind:
                    continue
                icx, icy = (ia + ic) / 2, (ib + id_) / 2
                dx = max(a - icx, 0, icx - c)
                dy = max(b - icy, 0, icy - d)
                dist = math.hypot(dx, dy)
                if dist < best_d:
                    best, best_d = (kind, (icx, icy), center, zbox), dist
            size = (max(1, round(sticker.width * k_label)), max(1, round(sticker.height * k_label)))
            s = sticker.resize(size, Image.LANCZOS if k_label < 1 else Image.NEAREST)
            if best is not None and best_d < 60:
                kind, (icx, icy), (zx, zy), zbox = best
                offset = ((lcx - icx) * k_label, (lcy - icy) * k_label)
                priority = 0 if kind == "city" else 1
            else:
                kind, zbox = "other", None
                zx, zy = to_zone(lcx, lcy)
                offset = (0.0, 0.0)
                priority = 2
            labels_to_place.append((priority, s, (zx, zy), offset, zbox, kind, scale))
    for (style, text), (x, y) in end_markers:
        icon = annex_icon(style)
        icon = icon.resize((round(icon.width * 0.7), round(icon.height * 0.7)), Image.LANCZOS)
        box = (x - icon.width / 2, y - icon.height / 2, x + icon.width / 2, y + icon.height / 2)
        lieux.alpha_composite(icon, (round(box[0]), round(box[1])))
        taken.append(box)
        label = sticker_label(text, small=True)
        labels_to_place.append((1, label, (x, y), (icon.width / 2 + label.width / 2 + 2, 0.0), box, "annex", 1.0))
    for text, (x, y) in link_labels:
        labels_to_place.append((3, sticker_label(text, small=True), (x, y), (0.0, -12.0), None, "link", 1.0))
    labels_to_place.sort(key=lambda item: (item[0], item[2][1]))
    dropped = 0
    for priority, s, (zx, zy), (ox, oy), zbox, kind, scale in labels_to_place:
        w2, h2 = s.width / 2, s.height / 2
        candidates = [(ox, oy), (-ox, oy)]
        if zbox is not None:
            iw2, ih2 = (zbox[2] - zbox[0]) / 2, (zbox[3] - zbox[1]) / 2
            candidates += [(iw2 + w2 + 2, 0), (-(iw2 + w2 + 2), 0), (0, -(ih2 + h2 + 1)), (0, ih2 + h2 + 1)]
        if kind == "link":
            candidates += [(0, 12), (w2 + 8, 0), (-w2 - 8, 0), (0, -26), (0, 26)]
        chosen = None
        for cx_, cy_ in candidates:
            box = (zx + cx_ - w2, zy + cy_ - h2, zx + cx_ + w2, zy + cy_ + h2)
            if box[0] < 4 or box[1] < 4 or box[2] > W - 4 or box[3] > H - 4:
                continue
            if free(box, ignore=zbox):
                chosen = box
                break
        if chosen is None:
            if kind != "city":
                dropped += 1
                continue
            chosen = (zx + ox - w2, zy + oy - h2, zx + ox + w2, zy + oy + h2)
        etiquettes.alpha_composite(s, (round(chosen[0]), round(chosen[1])))
        taken.append(chosen)
    print(f"  étiquettes de zones annexes retirées faute de place : {dropped}", flush=True)
    layers["07-lieux"] = lieux
    layers["08-etiquettes"] = etiquettes

    # ---------------------------------------------------------- contenu : ce que les nuages et le relief évitent
    content = np.zeros((H, W), dtype=bool)
    for p in placed.values():
        content |= (np.array(p["lines"].getchannel("A")) > 0)
        content |= (p["land"] > 0.5) & (visible[p["region"]["layer"]] > 0.3)
    content |= np.array(liaisons.getchannel("A")) > 0
    for box in taken:
        x0_, y0_, x1_, y1_ = (int(max(0, box[0])), int(max(0, box[1])), int(min(W, box[2])), int(min(H, box[3])))
        content[y0_:y1_, x0_:x1_] = True

    # les Pyrénées (soudure Paldea-France), le pays gardé à côté d'une région (Portugal) et les massifs réels proches
    # d'une région restent hors des nuages
    for p in placed.values():
        country = p["region"].get("border")
        if country:
            content |= (rasterize([ring for admin, ring in keep_rings if admin == country]) > 0.5) & land
    core = content.copy()
    for p in placed.values():
        if p["region"].get("pyrenees"):
            fx0, fy0, fx1, fy1 = p["terrain_frame"]
            content[max(0, int(fy0) - 110):int(fy0) + 40, max(0, int(fx0)):int(fx1)] |= land[max(0, int(fy0) - 110):int(fy0) + 40, max(0, int(fx0)):int(fx1)]
    range_masks = []
    for name, origin, base_sprite, high_sprite, density in spec["ranges"]:
        rings = ne_ranges.get(origin[3:], []) if origin.startswith("ne:") else [HAND_RANGES[name]]
        mask = rasterize(rings, scale=1) > 0.5
        range_masks.append((name, mask, base_sprite, high_sprite, density))
    if range_masks:
        f = 8
        small = np.zeros((H // f + 1, W // f + 1), dtype=bool)
        ys, xs = np.nonzero(core)
        small[ys // f, xs // f] = True
        near = np.array(Image.fromarray(dilate(small, 140 // f).astype(np.uint8) * 255).resize((W, H), Image.NEAREST)) > 0
        for _, mask, *_ in range_masks:
            content |= mask & land & near

    # ---------------------------------------------------------- nuages : bord + terre sans contenu
    cloud_layer, cloud_cover = clouds(W, H, content, land, key)
    layers["09-nuages"] = cloud_layer

    # ---------------------------------------------------------- relief : Pyrénées et massifs réels
    relief = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    occupied = np.zeros((H, W), dtype=bool)          # pied des montagnes : les arbres n'y poussent pas
    avoid = dilate(np.array(routes.getchannel("A")) > 0, 4) | dilate(np.array(liaisons.getchannel("A")) > 0, 4)
    for box in taken:
        x0_, y0_, x1_, y1_ = (int(max(0, box[0] - 1)), int(max(0, box[1] - 1)), int(min(W, box[2] + 1)), int(min(H, box[3] + 1)))
        avoid[y0_:y1_, x0_:x1_] = True
    mountains = []
    for p in placed.values():
        if p["region"].get("pyrenees"):
            mountains += pyrenees(relief, p, land, visible[p['region']['layer']], avoid, cloud_cover, W, H)
    for name, mask, base_sprite, high_sprite, density in range_masks:
        mountains += range_mountains(mask, land, avoid, cloud_cover, base_sprite, high_sprite, density, name)
    mountains.sort(key=lambda m: m[1])
    for x, y, name in mountains:
        s = sprite(name)
        relief.alpha_composite(s, (int(x - s.width // 2), int(y - s.height + 1)))
        occupied[max(0, y - s.height + 4):y + 4, max(0, x - s.width // 2):x + s.width // 2] = True
    print(f"  montagnes posées : {len(mountains)}", flush=True)
    layers["03-relief"] = relief

    # ---------------------------------------------------------- arbres, droits, après transformation
    arbres = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    trees = []
    for layer_name, p in placed.items():
        scale = p["scale"]
        k_tree = max(scale, TREE_MIN_SCALE)
        keep_share = min(1.0, (scale / k_tree) ** 2)
        for x, y, essence in p["source"].trees:
            if keep_share < 1 and (zlib.crc32(f"{x},{y}".encode()) % 1000) / 1000 >= keep_share:
                continue
            zx, zy = p["to_zone"](x, y)
            ix, iy = int(round(zx)), int(round(zy))
            if not (0 <= ix < W and 0 <= iy < H):
                continue
            if visible[layer_name][iy, ix] < 0.5 or occupied[iy, ix] or cloud_cover[iy, ix]:
                continue
            trees.append((zy, zx, essence, k_tree))
    trees.sort()
    resized = {}
    for zy, zx, essence, k in trees:
        if (essence, k) not in resized:
            s = sprite(essence)
            size = (max(1, round(s.width * k)), max(1, round(s.height * k)))
            resized[(essence, k)] = s.resize(size, Image.LANCZOS if k < 1 else Image.NEAREST)
        s = resized[(essence, k)]
        arbres.alpha_composite(s, (int(round(zx - s.width / 2)), int(round(zy - s.height + 1))))
    print(f"  arbres posés : {len(trees)}", flush=True)
    layers["04-arbres"] = arbres

    # ---------------------------------------------------------- noms de mers et de pays, titres de régions
    noms = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(noms)
    sea_font = ImageFont.truetype(FONT_ITALIC, 30 if W > 2600 else 26)
    for text, (lon, lat) in spec["sea_labels"]:
        x, y = project(lon, lat)
        bbox = draw.textbbox((x, y), text, font=sea_font, anchor="mm")
        if bbox[0] < 6 or bbox[2] > W - 6 or bbox[1] < 6 or bbox[3] > H - 6:
            continue
        if cloud_cover[int(bbox[1]):int(bbox[3]), int(bbox[0]):int(bbox[2])].any():
            continue
        on_land = land[int(np.clip(y, 0, H - 1)), int(np.clip(x, 0, W - 1))]
        draw.text((x, y), text, font=sea_font, anchor="mm", fill=(64, 104, 56) if on_land else (176, 212, 248))
    title_font = ImageFont.truetype(FONT, 46)
    for p in placed.values():
        region = p["region"]
        if region.get("name") and region.get("title"):
            x, y = project(*region["title"])
            draw.text((x, y), region["name"].upper(), font=title_font, anchor="mm", fill=(248, 248, 240),
                      stroke_width=5, stroke_fill=(40, 56, 104))
    layers["10-noms"] = noms

    # cartouche et cadre
    cadre = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(cadre)
    title = f"Zone {key.replace('-', ' ').capitalize()} · esquisse P07c · {km_px:g} km par pixel"
    font = ImageFont.truetype(FONT, 26)
    tb = draw.textbbox((0, 0), title, font=font)
    bx, by = 24, H - (tb[3] - tb[1]) - 46
    draw.rounded_rectangle([bx, by, bx + tb[2] + 32, by + tb[3] + 22], radius=8, fill=(248, 244, 228),
                           outline=(56, 56, 72), width=3)
    draw.text((bx + 16, by + 10), title, font=font, fill=(40, 40, 56))
    draw.rectangle([0, 0, W - 1, H - 1], outline=(56, 56, 72), width=4)
    draw.rectangle([4, 4, W - 5, H - 5], outline=(232, 216, 176), width=2)
    layers["11-cadre"] = cadre

    # ---------------------------------------------------------- calques et image
    layer_dir = os.path.join(OUT, "layers", key)
    os.makedirs(layer_dir, exist_ok=True)
    final = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    for name in sorted(layers):
        layers[name].save(os.path.join(layer_dir, f"{name}.png"))
        final.alpha_composite(layers[name])
    path = os.path.join(OUT, f"zone-{key}.png")
    final.convert("RGB").save(path)
    print("  ->", path, flush=True)
    return path


def draw_link(image, kind, line, k):
    """Liaisons : voie ferrée (traverses + rail), route V06 avec étapes, pointillé maritime avec étapes bleues."""
    d = ImageDraw.Draw(image)
    if kind == "rail":
        d.line(line, fill=(72, 64, 64), width=max(5, round(7 * k)), joint="curve")
        d.line(line, fill=(168, 152, 136), width=max(3, round(5 * k)), joint="curve")
        half = max(4, round(6 * k))
        samples = resample(line, max(5, round(7 * k)))
        for i, (x, y) in enumerate(samples):
            a = samples[max(0, i - 1)]
            b = samples[min(len(samples) - 1, i + 1)]
            tx, ty = b[0] - a[0], b[1] - a[1]
            n = math.hypot(tx, ty) or 1
            nx, ny = -ty / n, tx / n
            d.line([(x - nx * half, y - ny * half), (x + nx * half, y + ny * half)], fill=(104, 72, 48), width=2)
        d.line(line, fill=(56, 56, 72), width=2, joint="curve")
    elif kind == "road":
        d.line(line, fill=PALETTE["road_edge"], width=max(5, round(9 * k)), joint="curve")
        for x, y in line[1:-1]:
            r = max(2, round(4 * k))
            d.ellipse([x - r, y - r, x + r, y + r], fill=PALETTE["road_edge"])
        d.line(line, fill=PALETTE["road"], width=max(3, round(5 * k)), joint="curve")
        for x, y in line[1:-1]:
            r = max(1, round(2 * k))
            d.ellipse([x - r, y - r, x + r, y + r], fill=PALETTE["road"])
        for x, y in resample(line, 42 * k)[1:-1] if len(line) > 1 else []:
            r = max(3, round(5 * k))
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255), outline=(56, 56, 72), width=2)
            d.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=(224, 64, 64))
    else:
        dashed(d, line, PALETTE["foam"], dash=max(4, round(6 * k)), gap=max(4, round(6 * k)), width=max(2, round(3 * k)))
        steps = resample(line, 42 * k * 1.6)
        ends = (line[0], line[-1])
        for x, y in steps:
            if min(math.dist((x, y), e) for e in ends) < 20:
                continue
            r = max(3, round(5 * k))
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255), outline=(56, 56, 72), width=2)
            d.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=(64, 120, 224))


def great_britain_flipped(W, H, frame, land_layer, lines):
    """Galar = Grande-Bretagne à l'envers (Bulbapedia) : la vraie côte de Grande-Bretagne (Natural Earth),
    retournée nord-sud (Winscor/Londres en haut, l'Écosse en bas, le pays de Galles reste à l'ouest), étirée sur le
    cadre de la carte de Galar ; les tracés de Galar, élargis, sont toujours gardés à terre. Les lacs intérieurs de
    la carte de Galar restent en eau."""
    ring = None
    for feature in COUNTRIES:
        if feature["properties"]["ADMIN"] == "United Kingdom":
            for polygon in polygons_of(feature):
                r = np.array(polygon[0], float)
                if ring is None or len(r) > len(ring):
                    ring = r
    lon_a, lon_b = ring[:, 0].min(), ring[:, 0].max()
    lat_a, lat_b = ring[:, 1].min(), ring[:, 1].max()
    fx0, fy0, fx1, fy1 = frame
    fw, fh = fx1 - fx0, fy1 - fy0
    tx0, tx1 = fx0 - 0.16 * fw, fx1 + 0.12 * fw
    ty0, ty1 = fy0 - 0.03 * fh, fy1 + 0.04 * fh
    pts = [((tx0 + (lon - lon_a) / (lon_b - lon_a) * (tx1 - tx0)) * 2,
            (ty0 + (lat - lat_a) / (lat_b - lat_a) * (ty1 - ty0)) * 2) for lon, lat in ring]   # retourné : sud en bas -> nord en bas
    image = Image.new("L", (W * 2, H * 2), 0)
    ImageDraw.Draw(image).polygon(pts, fill=255)
    shape = np.array(image.resize((W, H), Image.BOX), dtype=np.float32) / 255
    keep = dilate(np.array(lines.getchannel("A")) > 0, 12)
    # la côte est celle de la Grande-Bretagne retournée ; de la carte du jeu, on ne garde que l'eau enfermée (lacs)
    x0, y0, x1, y1 = (max(0, int(v)) for v in frame)
    water = land_layer[y0:y1, x0:x1] < 0.5
    labels, boxes = components(water)
    lakes = np.zeros((H, W), dtype=bool)
    for k, (a, b, c, d) in enumerate(boxes):
        if a > 0 and b > 0 and c < x1 - x0 and d < y1 - y0:
            lakes[y0 + b:y0 + d, x0 + a:x0 + c] |= labels[b:d, a:c] == k
    galar = np.maximum(shape, keep.astype(np.float32))
    galar[lakes & ~keep] = 0
    galar = blur(galar, 1.0)
    ys, xs = np.nonzero(galar > 0.5)
    return galar, (float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max()))


def range_mountains(mask, land, avoid, cloud_cover, base_sprite, high_sprite, density, name):
    """Montagnes posées sur la ligne de crête d'un massif réel : on part des points les plus éloignés du bord du
    massif (son axe) et on n'en garde que la bande centrale, espacée ; sprite enneigé sur le cœur quand le massif
    en a un. Jamais sur un tracé, une vignette, sous les nuages ni en mer."""
    H, W = mask.shape
    if not mask.any():
        return []
    depth = distance_to(~mask, 80).astype(np.float32)
    usable = mask & land & ~cloud_cover
    if not usable.any():
        return []
    top = depth[usable].max()
    floor = max(3.0, top * (0.4 if top < 40 else 0.62))
    rng = np.random.default_rng(zlib.crc32(name.encode()))
    ys, xs = np.nonzero(usable & (depth >= floor))
    order = np.argsort(-(depth[ys, xs] + rng.random(len(ys)) * 2.5))
    s = sprite(base_sprite)
    gap_x, gap_y = s.width * 0.95 / math.sqrt(density), s.height * 0.85 / math.sqrt(density)
    chosen = []
    for k in order[:60000]:
        px, py = int(xs[k]), int(ys[k])
        if any(((px - cx) / gap_x) ** 2 + ((py - cy) / gap_y) ** 2 < 1 for cx, cy, _ in chosen):
            continue
        foot = (slice(max(0, py - s.height + 4), py + 1), slice(max(0, px - s.width // 2), px + s.width // 2))
        if avoid[foot].any() or not land[foot].all() or cloud_cover[foot].any():
            continue
        high = high_sprite is not None and depth[py, px] >= top * 0.7
        chosen.append((px, py, high_sprite if high else base_sprite))
    print(f"    massif {name} : {len(chosen)} montagnes (crête à {top:.0f} px du bord)", flush=True)
    return chosen


def pyrenees(relief, p, land, visible, avoid, cloud_cover, W, H):
    """Pyrénées : Paldea est soudée à la France par sa bordure nord. On suit la soudure colonne par colonne (premier
    pixel du terrain de Paldea sous de la terre française), on y pose la chaîne d'une côte à l'autre, et la neige du
    nord de Paldea la prolonge en fondu (bord bruité tramé) au lieu de s'arrêter net."""
    fx0, fy0, fx1, fy1 = (int(v) for v in p["terrain_frame"])
    seam = {}
    for x in range(max(0, fx0), min(W, fx1)):
        column = visible[max(0, fy0 - 30):min(H, fy0 + 320), x] > 0.5
        hits = np.nonzero(column)[0]
        if len(hits) == 0:
            continue
        y = hits[0] + max(0, fy0 - 30)
        above = y - 14
        if above > 0 and land[above, x] and visible[above, x] < 0.3:
            seam[x] = y
    if not seam:
        return []
    xs = np.array(sorted(seam))
    ys = np.array([seam[x] for x in xs], dtype=np.float32)
    ys = np.array([np.median(ys[max(0, i - 25):i + 26]) for i in range(len(ys))])
    seam_y = np.full(W, -1.0, dtype=np.float32)
    seam_y[xs] = ys
    terrain = np.array(p["terrain"])
    # colonnes enneigées du nord de Paldea (sous la soudure)
    snowy_cols = []
    for x, y in zip(xs, ys):
        patch = terrain[int(y):int(y) + 90, x]
        white = (patch[:, 0] > 222) & (patch[:, 1] > 226) & (patch[:, 2] > 232) & (patch[:, 3] > 0)
        if white.sum() > 12:
            snowy_cols.append(x)
    noise = value_noise(W, H, 19, 77) - 0.5
    gy_, gx_ = np.indices((H, W))
    checker = ((gx_ + gy_) % 2) == 0
    snow_alpha = np.zeros((H, W), dtype=np.float32)
    if snowy_cols:
        sx0, sx1 = min(snowy_cols), max(snowy_cols)
        across = np.clip(np.minimum(gx_ - (sx0 - 50), (sx1 + 70) - gx_) / 60, 0, 1)
        sy = np.interp(np.arange(W), xs, ys).astype(np.float32)[None, :]
        vertical = np.clip(1 - np.abs(gy_ - sy) / 70, 0, 1)
        snow_alpha = np.clip(across * vertical * 1.7 + noise * 0.9 - 0.3, 0, 1)
    snow = land & ((snow_alpha > 0.55) | ((snow_alpha > 0.35) & checker))
    shade = value_noise(W, H, 9, 78)
    array = np.array(relief)
    array[snow] = (*PALETTE["snow"], 255)
    array[snow & (shade > 0.62)] = (*PALETTE["snow_shade"], 255)
    array[snow & (shade > 0.8) & checker] = (*PALETTE["snow_shadow"], 255)
    relief.paste(Image.fromarray(array, "RGBA"))
    # montagnes : deux rangées décalées à cheval sur la soudure, enneigées au droit de la neige
    rng = random.Random(4207)
    base = sprite("montagne")
    mountains = []
    for row_index, dy in enumerate((-16, 0, 16)):
        x = xs.min() + 8 + (13 if row_index % 2 else 0)
        while x <= xs.max() - 8:
            if seam_y[int(x)] >= 0:
                px, py = int(x + rng.uniform(-3, 3)), int(seam_y[int(x)] + dy + rng.uniform(-2, 2))
                foot = (slice(max(0, py - 8), py + 1), slice(max(0, px - base.width // 2 + 6), px + base.width // 2 - 6))
                if 0 <= py < H and not avoid[foot].any() and not cloud_cover[py, px] and land[foot].mean() > 0.8:
                    name = "montagne-enneigee" if snow_alpha[py, px] > 0.3 or rng.random() < 0.3 else "montagne-grise"
                    mountains.append((px, py, name))
            x += base.width * 0.55
    print(f"    Pyrénées : soudure sur {len(xs)} colonnes, {len(mountains)} montagnes, neige sur {int(snow.sum())} px",
          flush=True)
    return mountains


def clouds(W, H, content, land, key):
    """Bancs de cumulus V06 : au bord de la zone et posés sur la vraie terre loin de tout contenu, jamais sur le
    contenu. Renvoie le calque et le masque de ce qu'ils couvrent."""
    rng = random.Random(zlib.crc32(key.encode()))
    f = 8
    hs, ws = H // f + 1, W // f + 1
    small_content = np.zeros((hs, ws), dtype=bool)
    ys, xs = np.nonzero(content)
    small_content[ys // f, xs // f] = True
    small_land = np.array(Image.fromarray((land * 255).astype(np.uint8)).resize((ws, hs), Image.BOX)) > 127
    clearance = distance_to(small_content, 80).astype(np.float32) * f
    banks = []
    step = 64
    for gy in range(-step // 2, H + step, step):
        for gx in range(-step // 2, W + step, step):
            cx, cy = gx + rng.randint(-20, 20), gy + rng.randint(-14, 14)
            sx, sy = min(ws - 1, max(0, cx // f)), min(hs - 1, max(0, cy // f))
            room = clearance[sy, sx]
            border = cx < 70 or cy < 70 or cx > W - 70 or cy > H - 70
            hidden = small_land[sy, sx] and room > CLOUD_CLEARANCE
            if not (hidden or (border and room > 70)):
                continue
            rx = min(room - 40, rng.randint(90, 170))
            if rx < 46:
                continue
            ry = rx * rng.uniform(0.55, 0.72)
            banks.append((cx, cy, rx, ry))
    half = Image.new("RGBA", (W // 2, H // 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (W // 2, H // 2), (0, 0, 0, 0))
    body_draw, shadow_draw = ImageDraw.Draw(half), ImageDraw.Draw(shadow)
    banks.sort(key=lambda b: b[1])
    for cx, cy, rx, ry in banks:
        puffs = []
        for _ in range(int(rx * ry / 900)):
            angle, radius = rng.random() * math.tau, math.sqrt(rng.random())
            px, py = cx + math.cos(angle) * rx * radius * 0.85, cy + math.sin(angle) * ry * radius * 0.75
            puffs.append((py, px, rng.uniform(26, 60) * (1.15 - radius * 0.5)))
        puffs.sort()
        for py, px, size in puffs:
            h = size / 2
            shadow_draw.ellipse([(px + 22) / 2 - h, (py + 26) / 2 - h * 0.7, (px + 22) / 2 + h, (py + 26) / 2 + h * 0.7],
                                fill=(16, 32, 72, 60))
        for py, px, size in puffs:
            x, y, h = px / 2, py / 2, size / 2
            body_draw.ellipse([x - h - 1, y - h * 0.75 - 1, x + h + 1, y + h * 0.75 + 1], fill=(152, 168, 200, 255))
        for py, px, size in puffs:
            x, y, h = px / 2, py / 2, size / 2
            body_draw.ellipse([x - h, y - h * 0.75, x + h, y + h * 0.75], fill=(208, 220, 240, 255))
        for py, px, size in puffs:
            x, y, h = px / 2, py / 2, size / 2
            body_draw.ellipse([x - h * 0.92, y - h * 0.75, x + h * 0.85, y + h * 0.45], fill=(248, 250, 255, 255))
        for py, px, size in puffs:
            x, y, h = px / 2, py / 2, size / 2
            body_draw.ellipse([x - h * 0.55, y - h * 0.62, x + h * 0.05, y - h * 0.2], fill=(255, 255, 255, 255))
    full = shadow.resize((W, H), Image.NEAREST)
    body = half.resize((W, H), Image.NEAREST)
    cover = np.array(body.getchannel("A")) > 0
    # l'ombre ne salit jamais le contenu
    shadow_array = np.array(full)
    shadow_array[content] = 0
    full = Image.fromarray(shadow_array, "RGBA")
    full.alpha_composite(body)
    print(f"  nuages : {len(banks)} bancs, {cover.mean():.0%} de l'image", flush=True)
    return full, cover


os.makedirs(OUT, exist_ok=True)
only = sys.argv[4].split(",") if len(sys.argv) > 4 else list(ZONES)
for key in only:
    render_zone(key, ZONES[key])

# Planche : les zones côte à côte, même hauteur.
all_paths = [os.path.join(OUT, f"zone-{key}.png") for key in ZONES]
if all(os.path.exists(p) for p in all_paths):
    target_h = 900
    thumbs = []
    for p in all_paths:
        im = Image.open(p)
        thumbs.append(im.resize((round(im.width * target_h / im.height), target_h), Image.LANCZOS))
    gap = 24
    sheet = Image.new("RGB", (sum(t.width for t in thumbs) + gap * (len(thumbs) + 1), target_h + 2 * gap + 50), (40, 44, 56))
    d = ImageDraw.Draw(sheet)
    x = gap
    font = ImageFont.truetype(FONT, 30)
    for key, t in zip(ZONES, thumbs):
        sheet.paste(t, (x, gap + 50))
        d.text((x, gap), f"{key.replace('-', ' ').capitalize()} ({ZONES[key]['km_px']:g} km/px)", font=font, fill=(240, 240, 240))
        x += t.width + gap
    sheet.save(os.path.join(OUT, "zones-planche.png"))
    print("planche", sheet.size)
