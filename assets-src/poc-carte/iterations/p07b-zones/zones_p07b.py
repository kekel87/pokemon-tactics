"""Pré-itération P07b : quatre grandes zones séparées (Japon, Europe, Unys, Alola), chacune à son zoom.

Dans une zone, la vraie terre (Natural Earth 1:50m) est rendue dans le style de la V06 (bandes de relief, mer à
bandes, écume), puis chaque région de la V06 est posée sur son empreinte réelle : terrain, arbres (sans rochers ni
montagnes), routes, accès, étapes mis à l'échelle de la zone ; villes, zones annexes et étiquettes posées en
« vignettes » à une taille minimale lisible, à côté de leur point. Soudure : dans le cadre d'une région, sa terre
et sa mer priment ; sur ses côtés ouverts (et partout en mode « union »), la vraie terre comble la mer de la
région ; au bord du cadre, fondu des deux champs de terre sur une bande bruitée.

Usage : python3 -P zones_p07b.py <dossier v06> <dossier natural-earth> <dossier de sortie>
Sorties : zone-japon.png, zone-europe.png, zone-unys.png, zone-alola.png, zones-planche.png
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
TREES_MIN_SCALE = 0.6      # sous cette échelle, les arbres de la V06 deviennent des points : on les retire
ICON_MIN_SCALE = 0.62      # villes et zones annexes jamais plus petites que ça (vignettes)
LABEL_MIN_SCALE = 0.85     # étiquettes jamais plus petites que ça
ANNEX_LABEL_MIN_SCALE = 0.7  # en dessous, les étiquettes des zones annexes ne s'affichent que s'il y a la place

PALETTE = {
    "abyss": (32, 80, 168), "deep": (40, 96, 184), "sea": (56, 128, 216), "shallow": (96, 168, 232),
    "shoal": (136, 200, 240), "foam": (232, 248, 255), "surf": (200, 232, 252),
    "sand": (240, 224, 160), "sand_dark": (216, 192, 128),
    "grass": [(72, 168, 56), (96, 192, 64), (128, 208, 72), (160, 224, 96), (192, 236, 128)],
    "grass_shadow": [(48, 128, 48), (64, 152, 56), (96, 176, 64), (128, 192, 80), (160, 208, 104)],
    "rock": (152, 144, 136), "rock_shadow": (112, 104, 100), "snow": (240, 244, 252),
}

# ======================================================================
# Données : zones et régions
# ======================================================================
# Région : layer = calque de la V06 ; anchor = point du monde V06 (ville repère) ou None (centre du terrain) ;
# at = (lon, lat) où tombe ce point ; km = kilomètres par pixel de la V06 ; rot = 0 ou 90 (horaire) ;
# mode = "region" (la région prime dans son cadre) ou "union" (vraie terre + terre de la région) ;
# open = côtés du cadre (repère de la zone) où la vraie terre prolonge la région.
# drop = anneaux Natural Earth retirés : (pays, boîte lon/lat qui contient le centre de l'anneau).
ZONES = {
    "japon": {
        "box": (126.2, 28.3, 146.6, 46.1), "km_px": 0.6,
        "regions": [
            {"name": "Sinnoh", "layer": "sinnoh", "anchor": None, "at": (142.75, 43.35), "km": 0.43,
             "mode": "region", "open": "", "title": (145.0, 45.0)},
            {"name": "Septentria", "layer": "septentria", "anchor": None, "at": (140.85, 39.75), "km": 0.56,
             "mode": "union", "open": "NSEW", "title": (142.9, 40.3)},
            {"name": "Kanto", "layer": "kanto", "anchor": (5816, 1825), "at": (139.75, 35.69), "km": 0.273,
             "mode": "region", "open": "NW", "title": (141.4, 36.0)},
            {"name": "Johto", "layer": "johto", "anchor": (4772, 1966), "at": (135.3, 34.69), "km": 0.40,
             "mode": "region", "open": "EWN", "title": (135.7, 36.75)},
            {"name": "Hoenn", "layer": "hoenn", "anchor": None, "at": (130.35, 31.5), "km": 0.45, "rot": 90,
             "mode": "region", "open": "N", "title": (127.6, 31.6)},
            {"name": "Îles Sevii", "layer": "sevii-123", "anchor": None, "at": (139.35, 33.85), "km": 0.273,
             "mode": "region", "open": "", "title": (142.1, 32.6)},
            {"name": None, "layer": "sevii-45", "anchor": None, "at": (140.45, 32.65), "km": 0.273,
             "mode": "region", "open": ""},
            {"name": None, "layer": "sevii-67", "anchor": None, "at": (140.0, 31.35), "km": 0.273,
             "mode": "region", "open": ""},
        ],
        "drop": [("Japan", (139.0, 41.25, 146.5, 45.7)),     # Hokkaidō -> Sinnoh
                 ("Japan", (128.3, 29.0, 132.1, 33.93)),     # Kyūshū -> Hoenn
                 ("Japan", (138.2, 29.0, 142.0, 34.62))],    # îles Izu -> Sevii
        "sea_labels": [("Mer du Japon", (134.6, 39.4)), ("Océan Pacifique", (143.6, 34.3)),
                       ("Corée", (127.6, 36.6)), ("Russie", (135.5, 45.2)), ("Sakhaline", (143.4, 46.0)),
                       ("Shikoku", (133.4, 33.15)), ("Mer de Chine orientale", (127.0, 29.6))],
    },
    "europe": {
        "box": (-11.5, 35.2, 15.5, 60.3), "km_px": 1.0,
        "regions": [
            {"name": "Galar", "layer": "galar", "anchor": None, "at": (-2.0, 54.75), "km": 0.82,
             "mode": "region", "open": "", "title": (-8.6, 56.8)},
            {"name": "Kalos", "layer": "kalos", "anchor": (922, 1517), "at": (2.35, 48.6), "km": 1.0,
             "mode": "union", "open": "NSEW", "title": (-7.6, 47.6)},
            {"name": "Paldea", "layer": "paldea", "anchor": None, "at": (-3.7, 39.95), "km": 1.0,
             "mode": "region", "open": "N", "open_band": 150, "title": (3.6, 38.9)},
        ],
        "drop": [("United Kingdom", (-6.0, 49.0, 2.5, 61.0)), ("Isle of Man", (-6, 53, -4, 55)),
                 ("Spain", (-10.0, 35.0, 4.6, 44.2)), ("Portugal", (-10.0, 36.0, -6.0, 42.5)),
                 ("Gibraltar", (-6, 35, -5, 37)), ("Andorra", (1, 42, 2, 43))],
        "sea_labels": [("Mer du Nord", (3.2, 55.7)), ("Manche", (-3.8, 49.85)), ("Océan Atlantique", (-9.2, 45.7)),
                       ("Mer Méditerranée", (6.8, 37.2)), ("Irlande", (-8.2, 53.3)), ("Allemagne", (10.5, 51.0)),
                       ("Italie", (11.8, 43.6)), ("Maroc", (-6.0, 35.45))],
    },
    "unys": {
        "box": (-78.6, 38.0, -69.6, 43.8), "km_px": 0.3,
        "regions": [
            {"name": "Unys", "layer": "unys", "anchor": (9858, 1473), "at": (-74.0, 40.72), "km": 0.31,
             "mode": "region", "open": "NW", "open_band": 150, "title": (-72.6, 40.05)},
        ],
        "drop": [("United States of America", (-74.1, 40.5, -71.8, 41.2))],   # Long Island -> Unys
        "sea_labels": [("Océan Atlantique", (-71.5, 38.9)), ("Pennsylvanie", (-77.2, 41.3)),
                       ("Nouvelle-Angleterre", (-71.6, 42.9)), ("Baie de la Delaware", (-75.7, 38.6))],
    },
    "alola": {
        "box": (-162.6, 17.2, -152.6, 24.0), "km_px": 0.53,
        "regions": [
            {"name": "Alola", "layer": "alola", "anchor": None, "at": (-157.6, 20.55), "km": 0.53,
             "mode": "region", "open": "", "title": (-157.6, 23.2)},
        ],
        "drop": [("United States of America", (-163, 17, -152, 24))],
        "sea_labels": [("Océan Pacifique", (-154.6, 17.9))],
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
        # saut de pointeur : chaque pixel prend l'étiquette de son étiquette
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


# ======================================================================
# Sources de la V06
# ======================================================================
print("lecture des calques V06", flush=True)
NATURE = {name: Image.open(os.path.join(V06, "layers", f"{name}.png")).convert("RGBA")
          for name in ("02-terre", "04-routes", "05-acces", "06-etapes", "07-zones-annexes", "08-villes", "09-etiquettes")}
DECOR = json.load(open(os.path.join(V06, "decor.json")))["decor"]
SPRITES = {}
DECOR_REGION = {"sevii-123": "Sevii 123", "sevii-45": "Sevii 45", "sevii-67": "Sevii 67"}


def sprite(name):
    if name not in SPRITES:
        SPRITES[name] = Image.open(os.path.join(V06, "sprites", f"{name}.png")).convert("RGBA")
    return SPRITES[name]


class Source:
    """Une région de la V06 découpée par nature, sans rochers ni montagnes ni grand titre."""

    def __init__(self, layer, with_trees):
        region_alpha = Image.open(os.path.join(V06, "layers", "regions", f"{layer}.png")).getchannel("A")
        self.box = region_alpha.getbbox()
        x0, y0, x1, y1 = self.box
        mask = np.array(region_alpha.crop(self.box)) > 0
        self.size = (x1 - x0, y1 - y0)

        def cut(name):
            array = np.array(NATURE[name].crop(self.box))
            array[~mask] = 0
            return array

        terre = cut("02-terre")
        self.land = terre[..., 3] > 0
        ys, xs = np.nonzero(self.land)
        self.land_box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        self.terrain = Image.fromarray(terre, "RGBA")
        if with_trees:
            region_name = DECOR_REGION.get(layer, layer.capitalize())
            for item in sorted(DECOR, key=lambda e: e["y"]):
                if item["region"] == region_name and item["type"] == "arbre":
                    s = sprite(item["essence"])
                    self.terrain.alpha_composite(s, (int(item["x"] - s.width // 2 - x0), int(item["y"] - s.height + 1 - y0)))
        self.lines = Image.new("RGBA", self.size, (0, 0, 0, 0))
        for name in ("04-routes", "05-acces", "06-etapes"):
            self.lines.alpha_composite(Image.fromarray(cut(name), "RGBA"))
        # vignettes
        self.icons = []    # (kind, bbox, image)
        for name, kind in (("08-villes", "city"), ("07-zones-annexes", "annex")):
            array = cut(name)
            labels, boxes = components(array[..., 3] > 0)
            for k, (a, b, c, d) in enumerate(boxes):
                if (c - a) * (d - b) < 30:
                    continue
                piece = array[b:d, a:c].copy()
                piece[labels[b:d, a:c] != k] = 0
                self.icons.append((kind, (a, b, c, d), Image.fromarray(piece, "RGBA")))
        array = cut("09-etiquettes")
        labels, boxes = components(array[..., 3] > 0)
        self.labels = []
        for k, (a, b, c, d) in enumerate(boxes):
            if d - b > 27 or (c - a) * (d - b) < 40:   # lettres du grand titre de région, poussières
                continue
            piece = array[b:d, a:c].copy()
            piece[labels[b:d, a:c] != k] = 0
            self.labels.append(((a, b, c, d), Image.fromarray(piece, "RGBA")))


# ======================================================================
# Rendu d'une zone
# ======================================================================
def render_zone(key, spec):
    lon0, lat0, lon1, lat1 = spec["box"]
    km_px = spec["km_px"]
    phi = math.radians((lat0 + lat1) / 2)
    px_lon = 111.32 * math.cos(phi) / km_px
    px_lat = 110.57 / km_px
    W, H = int((lon1 - lon0) * px_lon), int((lat1 - lat0) * px_lat)
    print(f"zone {key} : {W} x {H}", flush=True)

    def project(lon, lat):
        return ((lon - lon0) * px_lon, (lat1 - lat) * px_lat)

    # ---------------------------------------------------------- vraie terre
    countries = json.load(open(os.path.join(NE_DIR, "ne_50m_admin_0_countries.geojson")))["features"]
    real_image = Image.new("L", (W * 2, H * 2), 0)
    draw = ImageDraw.Draw(real_image)
    for feature in countries:
        admin = feature["properties"]["ADMIN"]
        geometry = feature["geometry"]
        polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
        for polygon in polygons:
            ring = np.array(polygon[0], float)
            if ring[:, 0].max() < lon0 - 2 or ring[:, 0].min() > lon1 + 2 or ring[:, 1].max() < lat0 - 2 or ring[:, 1].min() > lat1 + 2:
                continue
            cx, cy = ring[:, 0].mean(), ring[:, 1].mean()
            if any(admin == country and b[0] <= cx <= b[2] and b[1] <= cy <= b[3] for country, b in spec["drop"]):
                continue
            pts = [((lon - lon0) * px_lon * 2, (lat1 - lat) * px_lat * 2) for lon, lat in ring]
            draw.polygon(pts, fill=255)
    lakes = json.load(open(os.path.join(NE_DIR, "ne_50m_lakes.geojson")))["features"]
    for feature in lakes:
        if (feature["properties"].get("scalerank") or 9) > 3:
            continue
        geometry = feature["geometry"]
        polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
        for polygon in polygons:
            pts = [((lon - lon0) * px_lon * 2, (lat1 - lat) * px_lat * 2) for lon, lat in polygon[0]]
            draw.polygon(pts, fill=0)
    real = np.array(real_image.resize((W, H), Image.BOX), dtype=np.float32) / 255
    del real_image, draw

    # ---------------------------------------------------------- régions posées
    field = blur(real, 1.2)
    placed = []
    for region in spec["regions"]:
        scale = region["km"] / km_px
        source = Source(region["layer"], with_trees=scale >= TREES_MIN_SCALE)
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

        def place_image(image):
            if rot == 90:
                image = image.transpose(Image.Transpose.ROTATE_270)
            size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
            resized = image.resize(size, Image.LANCZOS if scale < 1 else Image.NEAREST)
            canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            canvas.paste(resized, (round(ox), round(oy)), resized)
            return canvas

        terrain = place_image(source.terrain)
        terrain_alpha = np.array(terrain.getchannel("A"), dtype=np.float32) / 255
        # le terrain est opaque sur la terre : alpha bas = arbres débordant en mer, on garde la terre seule
        land_mask = Image.fromarray((source.land * 255).astype(np.uint8))
        land_layer = np.array(place_image(Image.merge("RGBA", [land_mask] * 4)).getchannel("A"), dtype=np.float32) / 255
        lines = place_image(source.lines)
        # cadre de la région dans la zone
        lx0, ly0, lx1, ly1 = source.land_box
        corners = [to_zone(lx0, ly0), to_zone(lx1, ly1)]
        fx0, fx1 = sorted(c[0] for c in corners)
        fy0, fy1 = sorted(c[1] for c in corners)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        band = max(18.0, 40 * min(1.0, scale))
        wobble = (value_noise(W, H, 37, len(placed) + 3) - 0.5) * band * 0.9
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
        # fondu des couleurs : plus large sur les côtés ouverts, où le terrain de la région rejoint la vraie terre
        color_band = 3.0 * band
        reach = [np.clip((sides[side] + wobble) / (color_band if side in region["open"] else band * 0.62), 0, 1)
                 for side in "NSEW"]
        color = np.minimum.reduce(reach)
        region_field = np.maximum(blur(land_layer, 1.0), field * u)
        field = w * region_field + (1 - w) * field
        placed.append({"region": region, "source": source, "scale": scale, "to_zone": to_zone, "terrain": terrain,
                       "terrain_alpha": terrain_alpha, "land": land_layer, "lines": lines, "w": w, "u": u, "color": color,
                       "frame": (fx0, fy0, fx1, fy1)})
        print(f"  {region['layer']} : échelle {scale:.3f}, cadre {int(fx0)},{int(fy0)} {int(fx1)},{int(fy1)}", flush=True)

    noise = (value_noise(W, H, 23, 41) - 0.5) * 0.18
    land = (field + noise * np.clip(1 - np.abs(field - 0.5) * 2, 0, 1)) > 0.5

    # ---------------------------------------------------------- eau (style V06)
    rng = np.random.default_rng(17)
    yy, xx = np.indices((H, W), dtype=np.int32)
    checker = ((xx + yy) % 2) == 0
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

    # ---------------------------------------------------------- vraie terre coloriée (style V06, relief seul)
    geography = json.load(open(os.path.join(NE_DIR, "ne_50m_geography_regions_polys.geojson")))["features"]
    ranges_image = Image.new("L", (W, H), 0)
    rd = ImageDraw.Draw(ranges_image)
    for feature in geography:
        if feature["properties"]["FEATURECLA"] != "Range/mtn":
            continue
        geometry = feature["geometry"]
        polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
        for polygon in polygons:
            pts = [project(lon, lat) for lon, lat in polygon[0]]
            if len(pts) > 2:
                rd.polygon(pts, fill=255)
    ranges = soft_large(np.array(ranges_image) > 0, 4, 3)
    inland = soft_large(land, 8, 4)
    hills = value_noise(W, H, 170, 21)
    # relief calme, surtout dans les deux premiers niveaux comme le terrain des régions (pas de grand aplat clair)
    height = 0.9 + 0.35 * np.clip((inland - 0.5) * 2, 0, 1) + 1.0 * (hills - 0.5) + 1.4 * np.clip(ranges * 1.4, 0, 1) ** 1.6
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
    del height, gx, gy, levels, edge, ranges, inland, hills

    # ---------------------------------------------------------- terrain des régions par-dessus
    canvas = Image.fromarray(image, "RGB").convert("RGBA")
    for p in placed:
        # là où la vraie terre prolonge la région, la plage de la région s'efface sur 6 px (pas de couture de sable)
        foreign_land = land & (p["land"] < 0.5)
        fade = np.clip((distance_to(foreign_land, 7).astype(np.float32) - 1) / 6, 0, 1)
        alpha = p["terrain_alpha"] * p["color"] * fade
        alpha *= land | (p["terrain_alpha"] > 0.5) & (p["land"] < 0.5)   # arbres débordants gardés
        layer = np.array(p["terrain"])
        layer[..., 3] = (alpha * 255).astype(np.uint8)
        canvas.alpha_composite(Image.fromarray(layer, "RGBA"))
    for p in placed:
        canvas.alpha_composite(p["lines"])

    # ---------------------------------------------------------- vignettes : villes, zones annexes, étiquettes
    taken = []

    def free(box, ignore=None):
        return all(not (box[0] < b[2] and box[2] > b[0] and box[1] < b[3] and box[3] > b[1]) for b in taken if b is not ignore)

    labels_to_place = []
    for p in placed:
        source, scale, to_zone = p["source"], p["scale"], p["to_zone"]
        k_icon = max(scale, ICON_MIN_SCALE)
        k_label = max(scale, LABEL_MIN_SCALE)
        icon_boxes = []
        for kind, (a, b, c, d), sticker in source.icons:
            zx, zy = to_zone((a + c) / 2, (b + d) / 2)
            size = (max(1, round(sticker.width * k_icon)), max(1, round(sticker.height * k_icon)))
            s = sticker.resize(size, Image.LANCZOS if k_icon < 1 else Image.NEAREST)
            box = (zx - size[0] / 2, zy - size[1] / 2, zx + size[0] / 2, zy + size[1] / 2)
            canvas.alpha_composite(s, (round(box[0]), round(box[1])))
            taken.append(box)
            icon_boxes.append((kind, (a, b, c, d), (zx, zy), box))
        for (a, b, c, d), sticker in source.labels:
            lcx, lcy = (a + c) / 2, (b + d) / 2
            best, best_d = None, 1e9
            for kind, (ia, ib, ic, id_), center, zbox in icon_boxes:
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
    labels_to_place.sort(key=lambda item: (item[0], item[2][1]))
    dropped = 0
    for priority, s, (zx, zy), (ox, oy), zbox, kind, scale in labels_to_place:
        w2, h2 = s.width / 2, s.height / 2
        candidates = [(ox, oy), (-ox, oy)]
        if zbox is not None:
            iw2, ih2 = (zbox[2] - zbox[0]) / 2, (zbox[3] - zbox[1]) / 2
            candidates += [(iw2 + w2 + 2, 0), (-(iw2 + w2 + 2), 0), (0, -(ih2 + h2 + 1)), (0, ih2 + h2 + 1)]
        chosen = None
        for cx_, cy_ in candidates:
            box = (zx + cx_ - w2, zy + cy_ - h2, zx + cx_ + w2, zy + cy_ + h2)
            if box[0] < 4 or box[1] < 4 or box[2] > W - 4 or box[3] > H - 4:
                continue
            if free(box, ignore=zbox):
                chosen = box
                break
        if chosen is None:
            if kind == "annex" and scale < ANNEX_LABEL_MIN_SCALE:
                dropped += 1
                continue
            chosen = (zx + ox - w2, zy + oy - h2, zx + ox + w2, zy + oy + h2)
        canvas.alpha_composite(s, (round(chosen[0]), round(chosen[1])))
        taken.append(chosen)
    print(f"  étiquettes de zones annexes retirées faute de place : {dropped}", flush=True)

    # ---------------------------------------------------------- noms de mers et de pays, titres de régions
    draw = ImageDraw.Draw(canvas)
    sea_font = ImageFont.truetype(FONT_ITALIC, 30 if W > 2600 else 26)
    for text, (lon, lat) in spec["sea_labels"]:
        x, y = project(lon, lat)
        bbox = draw.textbbox((x, y), text, font=sea_font, anchor="mm")
        if bbox[0] < 6 or bbox[2] > W - 6 or bbox[1] < 6 or bbox[3] > H - 6:
            continue
        on_land = land[int(np.clip(y, 0, H - 1)), int(np.clip(x, 0, W - 1))]
        draw.text((x, y), text, font=sea_font, anchor="mm",
                  fill=(64, 104, 56) if on_land else (176, 212, 248))
    title_font = ImageFont.truetype(FONT, 46)
    for p in placed:
        region = p["region"]
        if region.get("name") and region.get("title"):
            x, y = project(*region["title"])
            draw.text((x, y), region["name"].upper(), font=title_font, anchor="mm", fill=(248, 248, 240),
                      stroke_width=5, stroke_fill=(40, 56, 104))

    # ---------------------------------------------------------- nuages au bord (repris de la V06)
    canvas.alpha_composite(clouds(W, H, [p["frame"] for p in placed], key))

    # cartouche
    draw = ImageDraw.Draw(canvas)
    title = f"Zone {key.capitalize()} · esquisse P07b · {km_px:g} km par pixel"
    font = ImageFont.truetype(FONT, 26)
    tb = draw.textbbox((0, 0), title, font=font)
    bx, by = 24, H - (tb[3] - tb[1]) - 46
    draw.rounded_rectangle([bx, by, bx + tb[2] + 32, by + tb[3] + 22], radius=8, fill=(248, 244, 228),
                           outline=(56, 56, 72), width=3)
    draw.text((bx + 16, by + 10), title, font=font, fill=(40, 40, 56))
    draw.rectangle([0, 0, W - 1, H - 1], outline=(56, 56, 72), width=4)
    draw.rectangle([4, 4, W - 5, H - 5], outline=(232, 216, 176), width=2)
    path = os.path.join(OUT, f"zone-{key}.png")
    canvas.convert("RGB").save(path)
    print("  ->", path, flush=True)
    return path


def clouds(W, H, frames, key):
    """Bancs de cumulus V06 le long du bord, jamais sur le cadre d'une région."""
    rng = random.Random(zlib.crc32(key.encode()))
    banks = []
    step = 230
    perimeter = []
    for x in range(-40, W + 40, step):
        perimeter += [(x, -30), (x, H + 30)]
    for y in range(-40, H + 40, step):
        perimeter += [(-30, y), (W + 30, y)]
    for x, y in perimeter:
        rx, ry = rng.randint(150, 230), rng.randint(100, 150)
        cx, cy = x + rng.randint(-50, 50), y + rng.randint(-30, 30)
        if any(cx + rx > f[0] - 40 and cx - rx < f[2] + 40 and cy + ry > f[1] - 40 and cy - ry < f[3] + 40 for f in frames):
            continue
        banks.append((cx, cy, rx, ry))
    half = Image.new("RGBA", (W // 2, H // 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (W // 2, H // 2), (0, 0, 0, 0))
    body_draw, shadow_draw = ImageDraw.Draw(half), ImageDraw.Draw(shadow)
    for cx, cy, rx, ry in banks:
        puffs = []
        for _ in range(int(rx * ry / 900)):
            angle, radius = rng.random() * math.tau, math.sqrt(rng.random())
            px, py = cx + math.cos(angle) * rx * radius * 0.85, cy + math.sin(angle) * ry * radius * 0.75
            puffs.append((py, px, rng.uniform(26, 60) * (1.15 - radius * 0.5)))
        puffs.sort()
        for py, px, size in puffs:
            h = size / 2
            shadow_draw.ellipse([(px + 40) / 2 - h, (py + 46) / 2 - h * 0.7, (px + 40) / 2 + h, (py + 46) / 2 + h * 0.7],
                                fill=(16, 32, 72, 70))
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
    full.alpha_composite(half.resize((W, H), Image.NEAREST))
    return full


os.makedirs(OUT, exist_ok=True)
only = sys.argv[4].split(",") if len(sys.argv) > 4 else list(ZONES)
paths = [render_zone(key, ZONES[key]) for key in only]

# Planche : les quatre zones côte à côte, même hauteur.
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
        d.text((x, gap), f"{key.capitalize()} ({ZONES[key]['km_px']:g} km/px)", font=font, fill=(240, 240, 240))
        x += t.width + gap
    sheet.save(os.path.join(OUT, "zones-planche.png"))
    print("planche", sheet.size)
