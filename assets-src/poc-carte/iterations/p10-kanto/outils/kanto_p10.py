"""P10 : rend Kanto juste (réseau du jeu) et plus vivant (arbres), à partir du graphe de la P09 (japon-base.json).

- Réseau de Kanto refait d'après pokefirered (connexions de bord et warps, voir build/topologie-kanto.txt, sorti par
  topologie_pret.py) : une étape par case de route de la Town Map, les lieux traversés dans le chemin (Forêt de Jade
  sur la Route 2, Mont Sélénite entre Route 3 et Route 4, Grotte Sombre sur la Route 10, Route Victoire sur la Route
  23, Îles Écume sur la Route 20), les culs-de-sac en accès, les passages souterrains (Grotte Taupiqueur Route 2 /
  Route 11, Souterrain Routes 5 / 6 et 7 / 8) en tunnel.
- Liaisons vers le reste du Japon reprises (Routes 26 et 27, Route 22 vers Route 28, Train Magnétique, Flèche des Mers,
  Aquaria) ; train et bateaux retracés lisses (sans demi-tour, départ et arrivée tangents au quai).
- Noms géographiques réels retirés (mers, îles) ; seuls restent les noms de régions Pokémon.
- Arbres : forêt dense autour de la Forêt de Jade, bosquets dans les plaines, jamais sur un tracé ni une ville.

Usage (depuis p10-kanto) : python3 -P outils/kanto_p10.py build/japon-base.json layers japon.json
"""
import json
import math
import random
import sys

import numpy as np
from PIL import Image

BASE, LAYERS, OUT = sys.argv[1:4]
data = json.load(open(BASE))
Image.MAX_IMAGE_PIXELS = None
water_alpha = np.array(Image.open(f"{LAYERS}/01-eau.png").getchannel("A"))
ground = np.array(Image.open(f"{LAYERS}/02-terre.png"))
H, W = water_alpha.shape

# Case (colonne, ligne) de la Town Map de Rouge Feu -> pixel de zone (calé sur les villes de la P09 : exact).
CELL = 27.3
X0, Y0 = 1563.7 - 4 * CELL, 1967.8 - 11 * CELL


def cell(col, row):
    return (round(X0 + col * CELL, 1), round(Y0 + row * CELL, 1))


# ---------------------------------------------------------------------------- nœuds de Kanto
CITIES = {
    "Bourg Palette": ((4, 11), False), "Jadielle": ((4, 8), False), "Argenta": ((4, 4), False),
    "Azuria": ((14, 3), True), "Lavanville": ((18, 6), False), "Carmin sur Mer": ((14, 9), True),
    "Céladopole": ((11, 6), True), "Parmanie": ((12, 12), False), "Safrania": ((14, 6), True),
    "Cramois'Île": ((4, 14), False), "Plateau Indigo": ((2, 3), False),
}
# lieux : (nom, détail, style, case, traversé ?)
PLACES = [
    ("Forêt de Jade", None, "forest", (4, 6.15), True),
    ("Mont Sélénite", None, "cave", (9, 3), True),
    ("Grotte Sombre", None, "cave", (18, 3.55), True),
    ("Route Victoire", None, "cave", (2, 4), True),
    ("Îles Écume", None, "island", (8, 14), True),
    ("Grotte Taupiqueur", "entrée de la Route 2", "cave", (4.62, 4.8), False),
    ("Grotte Taupiqueur", "entrée de la Route 11", "cave", (15.0, 9.55), False),
    ("Souterrain", "entrée de la Route 5", "tunnel", (14.5, 4.75), False),
    ("Souterrain", "entrée de la Route 6", "tunnel", (14.5, 7.25), False),
    ("Souterrain", "entrée de la Route 7", "tunnel", (12.85, 6.45), False),
    ("Souterrain", "entrée de la Route 8", "tunnel", (15.4, 6.45), False),
    ("Caverne Azurée", None, "cave", (14.55, 2.45), False),
    ("Centrale", None, "plant", (18.75, 4.1), False),
    ("Tour Pokémon", None, "tower", (19.15, 5.55), False),
    ("Parc Safari", None, "forest", (12.55, 11.35), False),
    ("Manoir Pokémon", None, "ruins", (4.55, 13.55), False),
]

# Chemins : suite de villes (nom), lieux (nom ou (nom, détail)) et étapes ((col, ligne, route)).
#   kind = nature des arêtes ; une arête peut être forcée par un tuple (élément, kind) en tête de la suite suivante.
ROUTES = [
    ("route", ["Bourg Palette", (4, 10, "Route 1"), (4, 9, "Route 1"), "Jadielle"]),
    ("route", ["Jadielle", (4, 7, "Route 2"), "Forêt de Jade", (4, 5, "Route 2"), "Argenta"]),
    ("route", ["Argenta", (5, 4, "Route 3"), (6, 4, "Route 3"), (7, 4, "Route 3"), (8, 4, "Route 3"),
               (8, 3, "Route 4"), "Mont Sélénite", (10, 3, "Route 4"), (11, 3, "Route 4"), (12, 3, "Route 4"),
               (13, 3, "Route 4"), "Azuria"]),
    ("route", ["Azuria", (14, 2, "Route 24"), (14, 1, "Route 24"), (15, 1, "Route 25"), (16, 1, "Route 25")]),
    ("route", ["Azuria", (15, 3, "Route 9"), (16, 3, "Route 9"), (17, 3, "Route 9"), (18, 3, "Route 10"),
               "Grotte Sombre", (18, 4.5, "Route 10"), "Lavanville"]),
    ("route", ["Azuria", (14, 4, "Route 5"), (14, 5, "Route 5"), "Safrania"]),
    ("route", ["Safrania", (14, 7, "Route 6"), (14, 8, "Route 6"), "Carmin sur Mer"]),
    ("route", ["Céladopole", (12, 6, "Route 7"), (13, 6, "Route 7"), "Safrania"]),
    ("route", ["Safrania", (15, 6, "Route 8"), (16, 6, "Route 8"), (17, 6, "Route 8"), "Lavanville"]),
    ("route", ["Carmin sur Mer", (15, 9, "Route 11"), (16, 9, "Route 11"), (17, 9, "Route 11"), (18, 9, "Route 12")]),
    ("route", ["Lavanville", (18, 7, "Route 12"), (18, 8, "Route 12"), (18, 9, "Route 12"), (18, 10, "Route 12"),
               (18, 11, "Route 12"), (17, 11, "Route 13"), (16, 11, "Route 13"), (15, 11, "Route 14"),
               (15, 12, "Route 14"), (14, 12, "Route 15"), (13, 12, "Route 15"), "Parmanie"]),
    ("route", ["Céladopole", (10, 6, "Route 16"), (9, 6, "Route 16"), (8, 6, "Route 16"), (7, 6, "Route 16"),
               (7, 7, "Route 17"), (7, 8, "Route 17"), (7, 9, "Route 17"), (7, 10, "Route 17"), (7, 11, "Route 17"),
               (7, 12, "Route 18"), (8, 12, "Route 18"), (9, 12, "Route 18"), (10, 12, "Route 18"),
               (11, 12, "Route 18"), "Parmanie"]),
    ("route", ["Parmanie", (12, 13, "Route 19")]),
    ("surf", [(12, 13, "Route 19"), (12, 14, "Route 19"), (11, 14, "Route 20"), (10, 14, "Route 20"),
              (9, 14, "Route 20"), "Îles Écume", (7, 14, "Route 20"), (6, 14, "Route 20"), (5, 14, "Route 20"),
              "Cramois'Île"]),
    ("surf", ["Bourg Palette", (4, 12, "Route 21"), (4, 13, "Route 21"), "Cramois'Île"]),
    ("route", ["Jadielle", (3, 8, "Route 22"), (2, 8, "Route 22"), (2, 7, "Route 23"), (2, 6, "Route 23"),
               (2, 5, "Route 23"), "Route Victoire", "Plateau Indigo"]),
    # culs-de-sac et entrées de souterrains
    ("acces", [(4, 5, "Route 2"), ("Grotte Taupiqueur", "entrée de la Route 2")]),
    ("acces", [(15, 9, "Route 11"), ("Grotte Taupiqueur", "entrée de la Route 11")]),
    ("acces", [(14, 5, "Route 5"), ("Souterrain", "entrée de la Route 5")]),
    ("acces", [(14, 7, "Route 6"), ("Souterrain", "entrée de la Route 6")]),
    ("acces", [(13, 6, "Route 7"), ("Souterrain", "entrée de la Route 7")]),
    ("acces", [(15, 6, "Route 8"), ("Souterrain", "entrée de la Route 8")]),
    ("tunnel", [("Grotte Taupiqueur", "entrée de la Route 2"), ("Grotte Taupiqueur", "entrée de la Route 11")]),
    ("tunnel", [("Souterrain", "entrée de la Route 5"), ("Souterrain", "entrée de la Route 6")]),
    ("tunnel", [("Souterrain", "entrée de la Route 7"), ("Souterrain", "entrée de la Route 8")]),
    ("eau", ["Azuria", "Caverne Azurée"]),
    ("eau", [(18, 3, "Route 10"), "Centrale"]),
    ("acces", ["Lavanville", "Tour Pokémon"]),
    ("acces", ["Parmanie", "Parc Safari"]),
    ("acces", ["Cramois'Île", "Manoir Pokémon"]),
]
TUNNEL_NAME = {"Grotte Taupiqueur": "Grotte Taupiqueur", "Souterrain": "Souterrain"}

# ---------------------------------------------------------------------------- reconstruction du graphe
old_nodes = data["noeuds"]
old_edges = data["aretes"]
removed = {n["id"] for n in old_nodes if n["region"] == "Kanto"}
removed |= {568, 569}           # anciennes étapes de liaison posées sur la Route 22 (la Route 22 est refaite)
assert old_nodes[568]["region"] == "Liaison" and old_nodes[569]["region"] == "Liaison"
kept_old = [n for n in old_nodes if n["id"] not in removed]
remap = {}
nodes = []
for n in kept_old:
    remap[n["id"]] = len(nodes)
    n = dict(n)
    n["id"] = len(nodes)
    nodes.append(n)
edges = []
external = []          # arêtes qui touchaient Kanto, à rattacher
for e in old_edges:
    if e["a"] in removed and e["b"] in removed:
        continue                 # ancien tracé interne à Kanto : refait plus bas
    if e["a"] in removed or e["b"] in removed:
        external.append(e)
        continue
    e = dict(e)
    e["a"], e["b"] = remap[e["a"]], remap[e["b"]]
    edges.append(e)

key_to_id = {}


def add(node):
    node["id"] = len(nodes)
    nodes.append(node)
    return node["id"]


for name, ((col, row), big) in CITIES.items():
    x, y = cell(col, row)
    key_to_id[name] = add({"type": "ville", "name": name, "big": big, "region": "Kanto", "x": x, "y": y})
for name, detail, style, (col, row), traversed in PLACES:
    x, y = cell(col, row)
    node = {"type": "lieu", "name": name, "style": style, "region": "Kanto", "x": x, "y": y}
    if detail:
        node["detail"] = detail
    if traversed:
        node["traverse"] = True
    key_to_id[(name, detail) if detail else name] = add(node)


def node_id(item):
    if isinstance(item, tuple) and len(item) == 3:
        col, row, route = item
        key = ("etape", col, row)
        if key not in key_to_id:
            x, y = cell(col, row)
            water = route in ("Route 19", "Route 20", "Route 21") and key != ("etape", 12, 13)
            key_to_id[key] = add({"type": "etape", "water": water, "region": "Kanto", "route": route, "x": x, "y": y})
        return key_to_id[key]
    return key_to_id[item]


def length(points):
    return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:]))


def link(a, b, kind, name=None, points=None):
    if points is None:
        pa, pb = (nodes[a]["x"], nodes[a]["y"]), (nodes[b]["x"], nodes[b]["y"])
        points = [list(pa), list(pb)]
    points = [[round(x, 1), round(y, 1)] for x, y in points]
    edges.append({"a": a, "b": b, "kind": kind, "name": name, "length": round(length(points), 1), "points": points})


for kind, chain in ROUTES:
    ids = [node_id(item) for item in chain]
    for a, b in zip(ids, ids[1:]):
        name = None
        if kind == "tunnel":
            name = TUNNEL_NAME[nodes[a]["name"]]
        link(a, b, kind, name)

# ---------------------------------------------------------------------------- tracés lissés


def chaikin(points, rounds):
    pts = [tuple(p) for p in points]
    for _ in range(rounds):
        out = [pts[0]]
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            out.append((0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by))
            out.append((0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by))
        out.append(pts[-1])
        pts = out
    return pts


def resample(points, step):
    pts = np.asarray(points, float)
    seg = np.hypot(*np.diff(pts, axis=0).T)
    total = seg.sum()
    cum = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, total, max(2, int(total / step) + 1))
    return list(zip(np.interp(t, cum, pts[:, 0]), np.interp(t, cum, pts[:, 1])))


def max_turn(points):
    """Plus grand changement de cap (degrés) entre deux segments consécutifs, après rééchantillonnage à 3 px."""
    pts = np.asarray(resample(points, 3.0))
    d = np.diff(pts, axis=0)
    ang = np.degrees(np.arctan2(d[:, 1], d[:, 0]))
    turn = np.abs((np.diff(ang) + 180) % 360 - 180)
    return float(turn.max()) if len(turn) else 0.0


def smooth_track(waypoints, rounds=5):
    """Courbe lisse par les points de passage ; le premier et le dernier segment donnent la tangente au quai."""
    return chaikin(waypoints, rounds)


def on_water(points):
    pts = resample(points, 3.0)
    ok = [water_alpha[int(min(H - 1, max(0, y))), int(min(W - 1, max(0, x)))] > 0 for x, y in pts]
    return sum(ok) / len(ok)


def simplify(points, tolerance):
    """Ramer-Douglas-Peucker."""
    pts = np.asarray(points, float)
    if len(pts) < 3:
        return [tuple(p) for p in pts]
    a, b = pts[0], pts[-1]
    ab = b - a
    norm = np.hypot(*ab) or 1.0
    dist = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / norm
    k = int(np.argmax(dist))
    if dist[k] > tolerance:
        left = simplify(pts[:k + 1], tolerance)
        right = simplify(pts[k:], tolerance)
        return left[:-1] + right
    return [tuple(a), tuple(b)]


def unhook(points, radius):
    """Retire le crochet d'un bout de tracé : si le tracé repasse près de son point de départ après s'en être
    éloigné, on coupe tout ce qui précède son dernier passage dans le rayon (plus de demi-tour au quai)."""
    pts = [tuple(p) for p in points]
    start = pts[0]
    last = 0
    for i, (x, y) in enumerate(pts):
        if math.hypot(x - start[0], y - start[1]) < radius:
            last = i
    return [start] + pts[max(1, last):]


def ferry_path(points):
    pts = unhook(points, 40)
    pts = list(reversed(unhook(list(reversed(pts)), 40)))
    pts = simplify(pts, 6.0)
    return smooth_track(pts, 5)


# Train Magnétique : de la gare de Safrania vers l'ouest, au nord de Céladopole, entre Route 3 et Route 16, en
# travers de la Route 2 au sud de l'entrée de la Grotte Taupiqueur, puis par les montagnes du Chūbu (tunnels)
# jusqu'à Doublonville, où il arrive par le nord-est. Jamais sous Jadielle, jamais le long de la côte.
TRAIN_WAYPOINTS = [cell(14, 6), cell(13.4, 5.45), cell(12, 5.25), cell(10, 5.2), cell(7.5, 5.25), cell(5.5, 5.45),
                   cell(4, 5.5), cell(2.6, 5.55), cell(1.0, 5.9), (1380, 1900), (1240, 1950), (1120, 1985),
                   (1050, 2010)]


AQUARIA_WAYPOINTS = [(958, 1975), (952, 2110), (975, 2235), (1040, 2318), (1150, 2345), (1380, 2340), (1500, 2265),
                     (1565, 2160), (1625, 2045), (1720, 1965), (1795, 1928)]


def find(name, region):
    return next(n["id"] for n in nodes if n.get("name") == name and n["region"] == region)


rails = []
for e in external:
    a_old, b_old = e["a"], e["b"]
    if e["kind"] == "train":
        a, b = key_to_id["Safrania"], remap[b_old]
        line = smooth_track(TRAIN_WAYPOINTS + [(nodes[b]["x"], nodes[b]["y"])], 5)
        link(a, b, "train", e["name"], line)
        rails.append(line)
    elif e["kind"] == "ferry" and e["name"] == "Flèche des Mers":
        a, b = key_to_id["Carmin sur Mer"], remap[b_old]
        link(a, b, "ferry", e["name"], ferry_path(e["points"]))
    elif e["kind"] == "ferry" and e["name"] == "Aquaria":
        # Aquaria : d'Oliville vers le sud le long de la côte de Johto, large virage au cap, puis cap à l'est
        a, b = remap[a_old], key_to_id["Carmin sur Mer"]
        line = smooth_track([(nodes[a]["x"], nodes[a]["y"])] + AQUARIA_WAYPOINTS + [(nodes[b]["x"], nodes[b]["y"])], 5)
        link(a, b, "ferry", e["name"], line)
    elif e["name"] == "Routes 26 et 27" and b_old == 179:
        # Routes 26 et 27 : par le portail de la Ligue, elles mènent à la Route Victoire (comme dans Or et Argent)
        a, b = remap[a_old], key_to_id["Route Victoire"]
        pa = (nodes[a]["x"], nodes[a]["y"])
        pb = (nodes[b]["x"], nodes[b]["y"])
        link(a, b, "route", e["name"], [pa, (pa[0], pb[1]), pb])
    elif {a_old, b_old} & {568, 569}:
        if 570 in (a_old, b_old):
            a, b = node_id((2, 8, "Route 22")), remap[570]
            link(a, b, "route", "Route 22", [(nodes[a]["x"], nodes[a]["y"]), (nodes[b]["x"], nodes[b]["y"])])
    else:
        raise SystemExit(f"liaison non rattachée : {e['a']} -> {e['b']} {e['kind']} {e['name']}")

# Flèche des Mers entre les îles Sevii : mêmes bateaux, mêmes tracés lissés
for e in edges:
    if e["kind"] == "ferry" and e["name"] == "Flèche des Mers" and nodes[e["a"]]["region"] != "Kanto":
        e["points"] = [[round(x, 1), round(y, 1)] for x, y in ferry_path(e["points"])]
        e["length"] = round(length(e["points"]), 1)

for e in edges:
    if e["kind"] in ("train", "ferry"):
        print(f"  {e['kind']} {e['name']} : virage max {max_turn(e['points']):.0f} degrés / 3 px, "
              f"{on_water(e['points']):.0%} sur l'eau, {e['length']:.0f} px")

# Routes à pied posées sur la mer de la zone (Piste Cyclable de la Route 17, Route 18) : des ponts, comme la Piste
# Cyclable du jeu, qui est en partie sur pilotis.
bridges = 0
for e in edges:
    if e["kind"] == "route" and nodes[e["a"]]["region"] == "Kanto" and on_water(e["points"]) > 0.5:
        e["bridge"] = True
        bridges += 1
        for end in (e["a"], e["b"]):
            if nodes[end]["type"] == "etape":
                nodes[end]["water"] = False
print(f"  ponts : {bridges} tronçons de route sur l'eau")

# ---------------------------------------------------------------------------- arbres de Kanto
rng = random.Random(10)
KX0, KY0, KX1, KY1 = 1430, 1672, 2015, 2085
blocked = np.zeros((H, W), dtype=bool)
yy, xx = np.mgrid[0:H, 0:W]
land = (ground[..., 3] > 0)
r, g, b = (ground[..., i].astype(int) for i in range(3))
greenish = (g > r + 8) & (g > b + 20)            # herbe (pas de roche, de neige, de sable ni d'ocre clair)
ocher = (r >= g - 10) & (r > b + 40) & ~greenish  # pente ocre ou brune : sapins seulement, plus clairsemés
# distance aux tracés : chaque arête (hors tunnel et liaisons maritimes) bloque une bande
from PIL import ImageDraw  # noqa: E402

mask_img = Image.new("L", (W, H), 0)
draw = ImageDraw.Draw(mask_img)
for e in edges:
    if e["kind"] in ("tunnel",):
        continue
    width = {"route": 14, "acces": 11, "train": 16}.get(e["kind"], 10)
    draw.line([tuple(p) for p in e["points"]], fill=255, width=width)
for n in nodes:
    rad = {"ville": 40, "lieu": 15, "etape": 8}[n["type"]]
    draw.ellipse((n["x"] - rad, n["y"] - rad * 0.8, n["x"] + rad, n["y"] + rad * 0.9), fill=255)
blocked = np.array(mask_img) > 0
# le pied de l'arbre doit aussi laisser le sprite hors du tracé (il dépasse de ~20 px vers le haut)
blocked_up = blocked.copy()
for dy in range(1, 24, 2):
    blocked_up[dy:] |= blocked[:-dy]       # pied à y : le sprite monte jusqu'à y - 24, rien du tracé là-dessous


def value_noise(width, height, cell_size, seed):
    rs = np.random.default_rng(seed)
    grid = rs.random((height // cell_size + 2, width // cell_size + 2))
    small = Image.fromarray((grid * 255).astype(np.uint8))
    return np.array(small.resize((small.width * cell_size, small.height * cell_size), Image.BICUBIC),
                    dtype=np.float32)[:height, :width] / 255


noise = value_noise(W, H, 34, 5) * 0.65 + value_noise(W, H, 11, 6) * 0.35
forest_center = cell(4, 6)


def coast_ok(x, y):
    xi, yi = int(x), int(y)
    window = land[yi - 4:yi + 2, xi - 5:xi + 6]
    return window.size and window.all()


old_trees = [t for t in data["arbres"]]
kept_trees = []
for t in old_trees:
    x, y = t[0], t[1]
    if KX0 <= x <= KX1 and KY0 <= y <= KY1 and blocked_up[int(y), int(x)]:
        continue
    kept_trees.append(t)
dropped = len(old_trees) - len(kept_trees)
placed_pts = [(t[0], t[1]) for t in kept_trees if KX0 - 20 <= t[0] <= KX1 + 20 and KY0 - 20 <= t[1] <= KY1 + 20]
grid = {}


def near_tree(x, y, spacing):
    gx, gy = int(x // 8), int(y // 8)
    for i in range(gx - 2, gx + 3):
        for j in range(gy - 2, gy + 3):
            for px, py in grid.get((i, j), ()):
                if abs(px - x) < spacing and abs(py - y) < spacing * 0.7:
                    return True
    return False


def put(x, y):
    grid.setdefault((int(x // 8), int(y // 8)), []).append((x, y))


for px, py in placed_pts:
    put(px, py)
new_trees = []
K = 0.683
for y in np.arange(KY0, KY1, 4.0):
    for x in np.arange(KX0, KX1, 4.0):
        x_ = x + rng.uniform(-1.8, 1.8)
        y_ = y + rng.uniform(-1.8, 1.8)
        xi, yi = int(x_), int(y_)
        if not land[yi, xi] or blocked_up[yi, xi] or not coast_ok(x_, y_):
            continue
        d_forest = math.hypot((x_ - forest_center[0]) * 0.9, y_ - forest_center[1])
        if d_forest < 62:
            density, spacing = 0.95, 6.5          # Forêt de Jade : forêt dense
        elif d_forest < 85:
            density, spacing = 0.55, 7.5
        elif greenish[yi, xi]:
            v = noise[yi, xi]
            if v > 0.62:
                density, spacing = 0.9, 6.5       # bosquet
            elif v > 0.56:
                density, spacing = 0.3, 7.5       # lisière
            else:
                density, spacing = 0.02, 10.0     # arbre isolé
        elif ocher[yi, xi]:
            v = noise[yi, xi]
            density, spacing = (0.35, 8.0) if v > 0.62 else (0.0, 10.0)
        else:
            continue
        if rng.random() > density or near_tree(x_, y_, spacing):
            continue
        if ocher[yi, xi]:
            essence = 1                                # sapin sur les pentes
        elif d_forest < 85:
            essence = rng.choice([2, 2, 3, 1])         # Forêt de Jade : feuillus et quelques sapins
        else:
            essence = rng.choice([3, 3, 2])            # plaine : feuillus ronds surtout
        put(x_, y_)
        new_trees.append([round(x_, 1), round(y_, 1), essence, K])
trees = kept_trees + new_trees
trees.sort(key=lambda t: t[1])
print(f"  arbres : {len(old_trees)} -> {len(trees)} ({dropped} retirés sous un tracé, {len(new_trees)} ajoutés à Kanto)")

# ---------------------------------------------------------------------------- sortie
data["noeuds"] = nodes
data["aretes"] = edges
data["arbres"] = trees
data["mers"] = []                 # plus aucun nom géographique réel
data["natures"]["tunnel"] = "passage souterrain (Grotte Taupiqueur, Souterrain)"
json.dump(data, open(OUT, "w"), ensure_ascii=False)
counts = {}
for e in edges:
    counts[e["kind"]] = counts.get(e["kind"], 0) + 1
kanto = [n for n in nodes if n["region"] == "Kanto"]
print(f"  graphe : {len(nodes)} nœuds ({len(kanto)} à Kanto), {len(edges)} arêtes {counts}")

# contrôle : tout Kanto est relié, et la Forêt de Jade est sur le seul chemin à pied de Jadielle à Argenta
adj = {n["id"]: [] for n in nodes}
for e in edges:
    adj[e["a"]].append((e["b"], e))
    adj[e["b"]].append((e["a"], e))


def reachable(start, banned=(), kinds=None):
    seen, stack = {start}, [start]
    while stack:
        u = stack.pop()
        for v, e in adj[u]:
            if v in seen or v in banned or (kinds and e["kind"] not in kinds):
                continue
            seen.add(v)
            stack.append(v)
    return seen


everything = reachable(key_to_id["Bourg Palette"])
assert all(n["id"] in everything for n in kanto), "un nœud de Kanto est isolé"
foot = ("route", "acces")
for town_a, town_b, place in (("Jadielle", "Argenta", "Forêt de Jade"), ("Argenta", "Azuria", "Mont Sélénite"),
                              ("Jadielle", "Plateau Indigo", "Route Victoire")):
    without = reachable(key_to_id[town_a], banned={key_to_id[place]}, kinds=foot)
    ok = key_to_id[town_b] not in without
    print(f"  {town_a} -> {town_b} à pied sans passer par {place} : {'impossible (juste)' if ok else 'POSSIBLE'}")
