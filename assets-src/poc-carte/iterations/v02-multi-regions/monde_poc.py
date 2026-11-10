"""POC : une carte du monde qui réunit plusieurs régions canon sur une mer commune.

Même méthode que le POC de Kanto (v01) : on part des Town Maps des jeux (réassemblées par
assemble_maps.py), on en tire un relief (teintes -> altitude), on le pose à l'échelle commune sur
une mer partagée, puis on lisse, ombre et décore, et on trace routes, étapes, villes et zones annexes.

Ajouter une région = ajouter une entrée à REGIONS (source, fichiers, cadrage, échelle, position,
noms) et, si besoin, une liaison à LINKS. Le code par région se limite aux lecteurs de format
(un par jeu source : firered, emerald, crystal, platinum).

Usage : python3 monde_poc.py <dl> <assembled> <kanto-pret> <sortie.png>
  dl         : fichiers bruts des dépôts pret (pokeemerald, pokecrystal, pokefirered, pokeplatinum)
  assembled  : sorties de assemble_maps.py (hoenn, johto_gsc, sevii_*)
  kanto-pret : kanto_assembled.png + kanto.h (Rouge Feu, v01)
"""
import json
import math
import random
import re
import struct
import sys
import zlib

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOTS = dict(zip(("dl", "assembled", "kanto"), sys.argv[1:4]))
OUT = sys.argv[4]
WORLD_W, WORLD_H = 3000, 2700
UNKNOWN = -1.0
FONT_PATH = "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf"


def path(spec):
    """'racine:chemin/relatif' -> chemin absolu."""
    root, relative = spec.split(":", 1)
    return f"{ROOTS[root]}/{relative}"


# ======================================================================
# Données : les régions et les liaisons
# ======================================================================
# crop = cadre lu dans la carte source (pixels natifs), scale = pixels du monde par pixel natif,
# origin = coin haut-gauche du cadre dans le monde. Une case de route vaut ~35 à 56 px du monde.
REGIONS = [
    {
        "name": "Kanto", "source": "firered", "label": ("KANTO", (2620, 1580)),
        "map": "kanto:kanto_assembled.png", "layout": "kanto:kanto.h",
        "crop": (14, 14, 222, 158), "scale": 5, "origin": (1900, 960), "fade": 0,
        "white_is_snow": True, "cut": {"top": 16, "left": 24, "right": 216},
        "cities": {
            "PALLET_TOWN": "Bourg Palette", "VIRIDIAN_CITY": "Jadielle", "PEWTER_CITY": "Argenta",
            "CERULEAN_CITY": "Azuria", "VERMILION_CITY": "Carmin sur Mer", "LAVENDER_TOWN": "Lavanville",
            "CELADON_CITY": "Céladopole", "SAFFRON_CITY": "Safrania", "FUCHSIA_CITY": "Parmanie",
            "CINNABAR_ISLAND": "Cramois'Île", "INDIGO_PLATEAU": "Plateau Indigo",
        },
        "big": ["CELADON_CITY", "SAFFRON_CITY", "VERMILION_CITY", "CERULEAN_CITY"],
    },
    {
        "name": "Johto", "source": "crystal", "label": ("JOHTO", (1180, 900)),
        "map": "assembled:johto_gsc_assembled.png", "landmarks": "dl:pokecrystal/data/maps/landmarks.asm",
        "crop": (8, 8, 152, 136), "scale": 7, "origin": (996, 967), "fade": 12, "pre_blur": 3,
        "cities": {
            "NewBarkTown": "Bourg Geon", "CherrygroveCity": "Ville Griotte", "VioletCity": "Mauville",
            "AzaleaTown": "Écorcia", "GoldenrodCity": "Doublonville", "EcruteakCity": "Rosalia",
            "OlivineCity": "Oliville", "CianwoodCity": "Irisia", "MahoganyTown": "Acajou",
            "BlackthornCity": "Ébènelle",
        },
        "big": ["GoldenrodCity", "EcruteakCity", "OlivineCity"],
        "annex": {
            "SproutTower": "tower", "RuinsOfAlph": "ruins", "UnionCave": "cave", "SlowpokeWell": "cave",
            "IlexForest": "forest", "RadioTower": "tower", "NationalPark": "forest", "TinTower": "tower",
            "BurnedTower": "tower", "Lighthouse": "tower", "BattleTower": "star", "WhirlIslands": "island",
            "MtMortar": "cave", "LakeOfRage": "lake", "IcePath": "cave", "DragonsDen": "cave",
            "DarkCave": "cave", "SilverCave": "cave",
        },
        # Routes 40 et 41 : en mer, d'Oliville à Irisia par les Îles Tourbillon (tuiles 8x8).
        "sea_chains": [[(4, 7), (3, 8), (3, 9), (3, 10), (3, 11), (3, 12), (2, 12)]],
    },
    {
        "name": "Hoenn", "source": "emerald", "label": ("HOENN", (560, 2580)),
        "map": "assembled:hoenn_assembled.png", "layout": "dl:pokeemerald/src/data/region_map/region_map_layout.h",
        "sections": "dl:pokeemerald/src/data/region_map/region_map_sections.json",
        "crop": (0, 8, 256, 160), "scale": 5, "origin": (20, 1800), "fade": 6,
        "cities": {
            "LITTLEROOT_TOWN": "Bourg-en-Vol", "OLDALE_TOWN": "Rosyères", "DEWFORD_TOWN": "Myokara",
            "LAVARIDGE_TOWN": "Vermilava", "FALLARBOR_TOWN": "Autéquia", "VERDANTURF_TOWN": "Vergazon",
            "PACIFIDLOG_TOWN": "Pacifiville", "PETALBURG_CITY": "Clémenti-Ville", "SLATEPORT_CITY": "Poivressel",
            "MAUVILLE_CITY": "Lavandia", "RUSTBORO_CITY": "Mérouville", "FORTREE_CITY": "Cimetronelle",
            "LILYCOVE_CITY": "Nénucrique", "MOSSDEEP_CITY": "Algatia", "SOOTOPOLIS_CITY": "Atalanopolis",
            "EVER_GRANDE_CITY": "Éternara",
        },
        "big": ["SLATEPORT_CITY", "MAUVILLE_CITY", "RUSTBORO_CITY", "LILYCOVE_CITY", "MOSSDEEP_CITY"],
        "water_routes": [105, 106, 107, 108, 109, 122, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134],
        "annex": ["GRANITE_CAVE", "MT_CHIMNEY", "SAFARI_ZONE", "BATTLE_FRONTIER", "PETALBURG_WOODS",
                  "RUSTURF_TUNNEL", "ABANDONED_SHIP", "NEW_MAUVILLE", "METEOR_FALLS", "MT_PYRE", "SHOAL_CAVE",
                  "SEAFLOOR_CAVERN", "VICTORY_ROAD", "CAVE_OF_ORIGIN", "SKY_PILLAR", "SOUTHERN_ISLAND",
                  "DESERT_RUINS", "ANCIENT_TOMB", "ISLAND_CAVE", "SEALED_CHAMBER", "FIERY_PATH", "SCORCHED_SLAB",
                  "MIRAGE_ISLAND"],
    },
    {
        "name": "Sinnoh", "source": "platinum", "label": ("SINNOH", (1950, 60)),
        "dir": "dl:pokeplatinum/res/graphics/town_map",
        "fly": "dl:pokeplatinum/src/applications/town_map/fly_locations.c",
        "crop": (21, 0, 237, 164), "scale": 5, "origin": (1890, 20), "fade": 8,
        "snow": (63, 0, 140, 64),   # nord enneigé (Frimapic, routes 216-217), en pixels natifs
        "cities": {
            "TWINLEAF_TOWN": "Bonaugure", "SANDGEM_TOWN": "Littorella", "FLOAROMA_TOWN": "Floraville",
            "SOLACEON_TOWN": "Bonville", "CELESTIC_TOWN": "Célestia", "JUBILIFE_CITY": "Féli-Cité",
            "CANALAVE_CITY": "Joliberges", "OREBURGH_CITY": "Charbourg", "ETERNA_CITY": "Vestigion",
            "HEARTHOME_CITY": "Unionpolis", "PASTORIA_CITY": "Verchamps", "VEILSTONE_CITY": "Voilaroc",
            "SUNYSHORE_CITY": "Rivamar", "SNOWPOINT_CITY": "Frimapic", "FIGHT_AREA": "Aire de Combat",
            "SURVIVAL_AREA": "Aire de Survie", "RESORT_AREA": "Aire de Détente", "POKEMON_LEAGUE": "Ligue Pokémon",
        },
        # Pas de table de position lisible pour les lieux (tmap_block.dat absent du dépôt) :
        # cases de la grille du jeu (7 px) posées à la main, approximatives. Les lacs viennent des données.
        "annex": [
            ((7, 16), "forest"),   # Forêt de Vestigion
            ((6, 19), "plant"),    # Vallée Éolienne
            ((5, 17), "plant"),    # Forge Fuego
            ((12, 18), "cave"),    # Mont Couronné
            ((13, 13), "ruins"),   # Colonnes Lances
            ((16, 20), "tower"),   # Tour Perdue
            ((3, 15), "island"),   # Île de Fer
            ((8, 25), "cave"),     # Mine de Charbourg
            ((9, 20), "cave"),     # Grotte Égarée
            ((17, 26), "forest"),  # Grand Marais
            ((26, 19), "cave"),    # Route Victoire
            ((23, 9), "cave"),     # Mont Abrupt
            ((11, 4), "ruins"),    # Temple de Frimapic
            ((9, 28), "star"),     # Parc des Amis (Route 221)
        ],
    },
    *[
        {
            "name": f"Sevii {part}", "source": "firered", "label": ("ÎLES SEVII", (1680, 2320)) if part == "123" else None,
            "map": f"assembled:sevii_{part}_assembled.png",
            "layout": f"dl:pokefirered/src/data/region_map/region_map_layout_sevii_{part}.h",
            "crop": crop, "scale": 4, "origin": origin, "fade": 6,
            "cut": {"left": 24, "right": 216, "box": (190, 136, 240, 160)},
            "cities": {
                "ONE_ISLAND": "Île 1", "TWO_ISLAND": "Île 2", "THREE_ISLAND": "Île 3", "FOUR_ISLAND": "Île 4",
                "FIVE_ISLAND": "Île 5", "SIX_ISLAND": "Île 6", "SEVEN_ISLAND": "Île 7",
            },
            "map_annex": ["NAVEL_ROCK", "BIRTH_ISLAND", "MEMORIAL_PILLAR", "TRAINER_TOWER"],
            # Sur ces cartes, les îles sont surtout peintes en ocre (couleurs de route ailleurs) : c'est du sol.
            "extra_colors": {(238, 230, 115): 1, (230, 164, 0): 1.5, (238, 189, 57): 1.5, (230, 222, 164): 1,
                             (205, 205, 148): 1},
        }
        for part, crop, origin in (("123", (30, 45, 200, 155), (1560, 1770)),
                                   ("45", (45, 50, 200, 155), (2330, 1760)),
                                   ("67", (45, 25, 200, 150), (2330, 2160)))
    ],
]

# Un point de liaison : ("city", région, nom), ("native", région, x, y) ou ("corner", i, j) = x du point i,
# y du point j de la même liaison ; un 4e/5e élément optionnel (dx, dy) décale le point dans le monde.
LINKS = [
    # Johto -> Kanto par la terre : Route 27 (est), Chutes Tohjo, Route 26 (nord), Plateau Indigo.
    {"water": False, "points": [("city", "Johto", "Bourg Geon"), ("corner", 3, 0, -50, 0),
                                ("corner", 3, 3, -50, 0), ("city", "Kanto", "Plateau Indigo", -20, 10)]},
    # Kanto -> Mont Argenté : Route 22 puis Route 28, vers l'ouest.
    {"water": False, "points": [("native", "Kanto", 51.25, 99.5), ("corner", 2, 0),
                                ("native", "Johto", 148, 68, 18, 0)]},
    # Kanto -> Îles Sevii par la mer (bateau de Cramois'Île), puis le chapelet des îles.
    {"water": True, "points": [("city", "Kanto", "Cramois'Île"), ("city", "Sevii 123", "Île 1")]},
    {"water": True, "points": [("city", "Sevii 123", "Île 1"), ("city", "Sevii 123", "Île 2")]},
    {"water": True, "points": [("city", "Sevii 123", "Île 2"), ("city", "Sevii 123", "Île 3")]},
    {"water": True, "points": [("city", "Sevii 123", "Île 3"), ("city", "Sevii 45", "Île 4")]},
    {"water": True, "points": [("city", "Sevii 45", "Île 4"), ("city", "Sevii 45", "Île 5")]},
    {"water": True, "points": [("city", "Sevii 45", "Île 5"), ("city", "Sevii 67", "Île 6")]},
    {"water": True, "points": [("city", "Sevii 67", "Île 6"), ("city", "Sevii 67", "Île 7")]},
    # Johto -> Hoenn par la mer : Irisia -> Nénucrique.
    {"water": True, "points": [("city", "Johto", "Irisia"), ("city", "Johto", "Irisia", -60, 190),
                               ("city", "Hoenn", "Nénucrique", 170, -40), ("city", "Hoenn", "Nénucrique")]},
    # Kanto -> Sinnoh par la mer : du bout de la Route 25 vers Rivamar.
    {"water": True, "points": [("native", "Kanto", 163.25, 43.5), ("native", "Kanto", 163.25, 43.5, 40, -160),
                               ("city", "Sinnoh", "Rivamar", 0, 150), ("city", "Sinnoh", "Rivamar")]},
]

# ======================================================================
# Outils communs
# ======================================================================
def fill_unknown(height):
    """Bouche les pixels inconnus (routes, icônes) avec la moyenne des voisins connus."""
    h, w = height.shape
    for _ in range(60):
        unknown = height == UNKNOWN
        if not unknown.any():
            break
        padded = np.pad(height, 1, constant_values=UNKNOWN)
        total = np.zeros_like(height)
        count = np.zeros_like(height)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                neighbour = padded[1 + dy:h + 1 + dy, 1 + dx:w + 1 + dx]
                known = neighbour != UNKNOWN
                total += np.where(known, neighbour, 0)
                count += known
        fill = unknown & (count > 0)
        height[fill] = total[fill] / count[fill]
    height[height == UNKNOWN] = 0
    return height


def height_from_colors(pixels, table):
    height = np.full(pixels.shape[:2], UNKNOWN)
    for color, value in table.items():
        height[np.all(pixels == color, axis=-1)] = value
    return height


def box_blur(field, passes, radius=1):
    size = 2 * radius + 1
    for _ in range(passes):
        padded = np.pad(field, radius, mode="edge")
        field = sum(padded[radius + dy:radius + dy + field.shape[0], radius + dx:radius + dx + field.shape[1]]
                    for dy in range(-radius, radius + 1) for dx in range(-radius, radius + 1)) / (size * size)
    return field


def value_noise(width, height_px, cell, seed):
    rng = np.random.default_rng(seed)
    grid_values = rng.random((height_px // cell + 2, width // cell + 2)).astype(np.float32)
    image = Image.fromarray(grid_values, mode="F").resize(((width // cell + 2) * cell, (height_px // cell + 2) * cell),
                                                          Image.BICUBIC)
    return np.array(image)[:height_px, :width]


def parse_layout(text):
    """Grille(s) MAPSEC d'un fichier region_map_layout*.h, préfixe MAPSEC_ retiré."""
    layers = text.split("[LAYER_DUNGEON]") if "[LAYER_DUNGEON]" in text else [text]
    return [[[cell.strip().replace("MAPSEC_", "") for cell in row.split(",")]
             for row in re.findall(r"\{(MAPSEC_[^}]*)\}", layer)] for layer in layers]


def style_of(section):
    """Pictogramme d'une zone annexe d'après son identifiant."""
    for keys, style in ((("FOREST", "WOODS", "BUSH", "SAFARI", "PARK", "MARSH"), "forest"),
                        (("TOWER", "PILLAR"), "tower"),
                        (("PLANT", "MAUVILLE"), "plant"),
                        (("RUINS", "CHAMBER", "TOMB", "SLAB"), "ruins"),
                        (("LAKE",), "lake"),
                        (("ISLAND", "NAVEL", "SHIP"), "island"),
                        (("CAVE", "TUNNEL", "MT_", "ROAD", "HOLE", "FALLS", "CAVERN", "PATH", "DEN"), "cave")):
        if any(key in section for key in keys):
            return style
    return "star"


def grid_links(grid, kind_of, center, water=frozenset()):
    """Liens entre cases voisines de la grille (routes et villes), comme le POC de Kanto.

    Les liens mer-mer forment un arbre couvrant (Kruskal) : une étendue de cases maritimes devient
    un réseau de chemins au lieu d'un quadrillage.
    """
    links, sea_edges = [], []
    for row in range(len(grid)):
        for col in range(len(grid[row])):
            if not kind_of(grid[row][col]):
                continue
            for dcol, drow in ((1, 0), (0, 1)):
                r2, c2 = row + drow, col + dcol
                if r2 >= len(grid) or c2 >= len(grid[r2]) or not kind_of(grid[r2][c2]):
                    continue
                here, there = (col, row) in water, (c2, r2) in water
                link = (center(col, row), center(c2, r2), here or there)
                (sea_edges.append(((col, row), (c2, r2), link)) if here and there else links.append(link))
    parent = {}

    def root(node):
        while parent.get(node, node) != node:
            node = parent[node]
        return node
    for a, b, link in sea_edges:
        ra, rb = root(a), root(b)
        if ra != rb:
            parent[ra] = rb
            links.append(link)
    return links


class Region:
    """Une région : relief natif, transformation vers le monde, et ses éléments en coordonnées natives."""

    def __init__(self, spec, height):
        self.spec = spec
        self.name = spec["name"]
        x0, y0, x1, y1 = self.crop = spec["crop"]
        field = height[y0:y1, x0:x1].astype(np.float32)
        if spec.get("pre_blur"):
            field = box_blur(field, spec["pre_blur"])
        fade = spec.get("fade", 0)
        if fade:   # bord du cadre : la terre s'enfonce dans la mer, avec un bord irrégulier
            yy, xx = np.indices(field.shape)
            border = np.minimum.reduce([xx, yy, field.shape[1] - 1 - xx, field.shape[0] - 1 - yy]).astype(np.float32)
            wobble = value_noise(field.shape[1], field.shape[0], 5, zlib.crc32(self.name.encode())) - 0.5
            field = field * np.clip((border + wobble * fade * 1.6) / fade, 0, 1)
        self.field = field
        self.scale = spec["scale"]
        self.world_origin = spec["origin"]
        self.cities = []      # (x, y, nom, grande)
        self.steps = []       # (x, y, eau)
        self.links = []       # ((x, y), (x, y), eau)
        self.dungeons = []    # (x, y, style)

    def world(self, x, y):
        return ((x - self.crop[0]) * self.scale + self.world_origin[0],
                (y - self.crop[1]) * self.scale + self.world_origin[1])

    def height_at(self, x, y):
        fx = min(max(int(x - self.crop[0]), 0), self.field.shape[1] - 1)
        fy = min(max(int(y - self.crop[1]), 0), self.field.shape[0] - 1)
        return self.field[fy, fx]

    def paste_into(self, world_height):
        out_w = int(round(self.field.shape[1] * self.scale))
        out_h = int(round(self.field.shape[0] * self.scale))
        big = np.array(Image.fromarray(self.field, mode="F").resize((out_w, out_h), Image.BICUBIC))
        x, y = int(round(self.world_origin[0])), int(round(self.world_origin[1]))
        target = world_height[y:y + out_h, x:x + out_w]
        np.maximum(target, big[:target.shape[0], :target.shape[1]], out=target)

    def city(self, label):
        for x, y, name, _ in self.cities:
            if name == label:
                return self.world(x, y)
        raise KeyError(f"{self.name}: {label}")


# ======================================================================
# Lecteurs de format, un par jeu source
# ======================================================================
FR_HEIGHT = {
    (164, 180, 255): 0, (156, 213, 255): 0, (82, 148, 213): 0, (90, 172, 230): 0, (0, 0, 0): 0, (255, 255, 255): 0,
    (24, 131, 8): 1, (57, 164, 49): 1, (57, 172, 8): 2, (82, 213, 49): 2, (82, 205, 8): 3,
    (115, 230, 32): 4, (172, 246, 57): 5,
    (115, 115, 115): 5.9, (164, 164, 164): 6.1, (65, 65, 74): 5.9, (230, 230, 238): 6.3,
}


def load_firered(spec):
    """Rouge Feu (Kanto, Sevii) : Town Map 240x160, grille de sections 22x15 à deux couches."""
    pixels = np.array(Image.open(path(spec["map"])).convert("RGB").resize((240, 160), Image.NEAREST))
    table = dict(FR_HEIGHT)
    if spec.get("white_is_snow"):
        table[(255, 255, 255)] = 6.3
    table.update(spec.get("extra_colors", {}))
    height = fill_unknown(height_from_colors(pixels, table))
    cut = spec.get("cut", {})
    if "top" in cut:
        height[:cut["top"], :] = 0
    if "left" in cut:
        height[:, :cut["left"]] = np.minimum(height[:, :cut["left"]], 0)
    if "right" in cut:
        height[:, cut["right"]:] = 0
    if "box" in cut:
        bx0, by0, bx1, by1 = cut["box"]
        height[by0:by1, bx0:bx1] = 0
    region = Region(spec, height)
    grid, dungeon_grid = parse_layout(open(path(spec["layout"])).read())
    cities, big, annex = spec["cities"], set(spec.get("big", [])), set(spec.get("map_annex", []))
    center = lambda col, row: (35.25 + 8 * col, 35.5 + 8 * row)  # noqa: E731

    def kind(section):
        if section == "NONE" or section in annex:
            return None
        return "city" if section in cities else "route"
    water, seen = set(), set()
    for row in range(len(grid)):
        for col in range(len(grid[row])):
            section, (x, y) = grid[row][col], center(col, row)
            if kind(section) == "route":
                is_water = region.height_at(x, y) < 0.5
                if is_water:
                    water.add((col, row))
                region.steps.append((x, y, is_water))
            elif kind(section) == "city" and section not in seen:
                seen.add(section)
                region.cities.append((x, y, cities[section], section in big))
            elif section in annex:
                region.dungeons.append((x, y, style_of(section)))
    region.links = grid_links(grid, kind, center, water)
    for row in range(len(dungeon_grid)):
        for col in range(len(dungeon_grid[row])):
            if dungeon_grid[row][col] != "NONE":
                region.dungeons.append((*center(col, row), style_of(dungeon_grid[row][col])))
    return region


def load_emerald(spec):
    """Émeraude (Hoenn) : carte du PokéNav, grille 28x15 à une couche, sections avec position (json)."""
    pixels = np.array(Image.open(path(spec["map"])).convert("RGB"))
    table = {
        (156, 213, 255): 0, (164, 180, 255): 0, (74, 156, 230): 0, (41, 131, 230): 0, (65, 106, 205): 0,
        (32, 74, 197): 0, (0, 115, 172): 0, (0, 57, 139): 0, (123, 180, 213): 0,
        (0, 115, 0): 1, (57, 172, 8): 2, (98, 213, 0): 3, (172, 238, 49): 4.3, (213, 255, 123): 5.9,
    }
    region = Region(spec, fill_unknown(height_from_colors(pixels, table)))
    (grid,) = parse_layout(open(path(spec["layout"])).read())
    cities, big = spec["cities"], set(spec.get("big", []))
    water_sections = {f"ROUTE_{n}" for n in spec.get("water_routes", [])}
    center = lambda col, row: (8 * (col + 1) + 4, 8 * (row + 2) + 4)  # noqa: E731

    def kind(section):
        if section in cities:
            return "city"
        return "route" if section.startswith("ROUTE_") else None
    city_cells, water = {}, set()
    for row in range(len(grid)):
        for col in range(len(grid[row])):
            section = grid[row][col]
            if kind(section) == "route":
                region.steps.append((*center(col, row), section in water_sections))
                if section in water_sections:
                    water.add((col, row))
            elif kind(section) == "city":
                city_cells.setdefault(section, []).append(center(col, row))
    for section, cells in city_cells.items():   # une ville sur plusieurs cases : au centre de ses cases
        region.cities.append((sum(c[0] for c in cells) / len(cells), sum(c[1] for c in cells) / len(cells),
                              cities[section], section in big))
    region.links = grid_links(grid, kind, center, water)
    for section in json.load(open(path(spec["sections"])))["map_sections"]:
        short = section["id"].replace("MAPSEC_", "")
        if short in spec.get("annex", []):
            cx = section["x"] + (section["width"] - 1) / 2
            cy = section["y"] + (section["height"] - 1) / 2
            region.dungeons.append((*center(cx, cy), style_of(short)))
    return region


def load_crystal(spec):
    """Cristal (Johto) : carte du Pokématos en tuiles 8x8, lieux en pixels (landmarks.asm)."""
    pixels = np.array(Image.open(path(spec["map"])).convert("RGB"))
    green, brown, blue, cream = (0, 255, 0), (123, 57, 0), (0, 0, 255), (230, 255, 164)
    is_green, is_brown = np.all(pixels == green, axis=-1), np.all(pixels == brown, axis=-1)
    # Les montagnes, en aplat sur la carte, montent vers leur centre (distance au bord approchée par flou).
    mountain = box_blur(is_brown.astype(np.float32), 3, radius=2) ** 1.3
    height = np.full(pixels.shape[:2], UNKNOWN)
    height[is_green | is_brown] = (1.5 + 4.6 * mountain)[is_green | is_brown]
    height[np.all(pixels == blue, axis=-1)] = 0
    road_tiles = set()
    for ty in range(pixels.shape[0] // 8):
        for tx in range(pixels.shape[1] // 8):
            block = (slice(ty * 8, ty * 8 + 8), slice(tx * 8, tx * 8 + 8))
            blues = int(np.all(pixels[block] == blue, axis=-1).sum())
            creams = int(np.all(pixels[block] == cream, axis=-1).sum())
            frame = tx in (0, 19) or ty in (0, 17) or (ty == 16 and tx >= 14)   # cadre et cartouche « JOHTO »
            if frame:
                height[block] = 0
            elif blues >= 16:   # tuile de mer : les rayures claires sont de l'eau
                height[block] = np.where(is_green[block], height[block], 0)
            elif creams >= 20:
                road_tiles.add((tx, ty))
    region = Region(spec, fill_unknown(height))
    landmark = {name: (int(x), int(y)) for x, y, name in
                re.findall(r"landmark\s+(-?\d+),\s*(-?\d+),\s*(\w+)Name", open(path(spec["landmarks"])).read())}
    region.landmark = landmark
    center = lambda tx, ty: (8 * tx + 4, 8 * ty + 4)  # noqa: E731
    city_tiles = set()
    for key, label in spec["cities"].items():
        x, y = landmark[key]
        region.cities.append((x, y, label, key in spec.get("big", [])))
        city_tiles.add((x // 8, y // 8))
    for key, style in spec.get("annex", {}).items():
        region.dungeons.append((*landmark[key], style))
    walkable = road_tiles | city_tiles
    region.steps += [(*center(*tile), False) for tile in road_tiles - city_tiles]
    for tx, ty in walkable:
        for dx, dy in ((1, 0), (0, 1)):
            if (tx + dx, ty + dy) in walkable:
                region.links.append((center(tx, ty), center(tx + dx, ty + dy), False))
    for chain in spec.get("sea_chains", []):
        region.steps += [(*center(*tile), True) for tile in chain[1:-1]]
        region.links += [(center(*a), center(*b), True) for a, b in zip(chain, chain[1:])]
    return region


def nscr_index_image(tiles_png, tilemap_path):
    """Image d'index (0-15) d'une couche NSCR de DS, depuis la planche de tuiles 4bpp en niveaux de gris."""
    sheet = np.array(Image.open(tiles_png).convert("L")).astype(int) // 17
    per_row = sheet.shape[1] // 8
    data = open(tilemap_path, "rb").read()
    width_px, height_px = struct.unpack("<HH", data[0x18:0x1C])
    width = width_px // 8
    entries = struct.unpack(f"<{width * (height_px // 8)}H", data[0x24:0x24 + width * (height_px // 8) * 2])
    out = np.zeros((height_px, width_px), dtype=int)
    for i, entry in enumerate(entries):
        tile = entry & 0x3FF
        block = sheet[(tile // per_row) * 8:(tile // per_row) * 8 + 8, (tile % per_row) * 8:(tile % per_row) * 8 + 8]
        if (entry >> 10) & 1:
            block = block[:, ::-1]
        if (entry >> 11) & 1:
            block = block[::-1, :]
        out[(i // width) * 8:(i // width) * 8 + 8, (i % width) * 8:(i % width) * 8 + 8] = block
    return out


def load_platinum(spec):
    """Platine (Sinnoh) : écran du haut de la Carte, couche relief + couche routes, grille de 7 px."""
    directory = path(spec["dir"])
    relief = nscr_index_image(f"{directory}/top_screen_map_tiles.png", f"{directory}/top_screen_region_bg_tilemap.NSCR")
    roads = nscr_index_image(f"{directory}/top_screen_map_tiles.png", f"{directory}/top_screen_region_map_tilemap.NSCR")
    x0, _, x1, y1 = spec["crop"]
    # Couche relief : 4/5/6 mer, 8 lacs, 3 plaine, 11 collines, 10 montagne ; le reste (côtes) se bouche.
    height = np.full(relief.shape, UNKNOWN)
    for index, value in ((4, 0), (5, 0), (6, 0), (8, 0), (3, 1.5), (11, 3.0), (10, 5.0)):
        height[relief == index] = value
    height[:, :x0] = 0
    height[:, x1:] = 0
    height[y1:, :] = 0
    region = Region(spec, fill_unknown(height))
    road = roads == 5          # cœur des bandes de route (7 = contour, 3/4 = lacs)
    road[:, :x0] = road[:, x1:] = False
    road[y1:, :] = False
    center = lambda i, j: (7 * i + 24.5, 7 * j - 35.5)  # noqa: E731  (calé sur la couche routes)
    is_water = lambda x, y: relief[int(y), int(x)] in (4, 5, 6)  # noqa: E731
    shape_cells = {"1x1_SQUARE": [(0, 0)], "VERTICAL": [(0, 0), (0, 1)], "HORIZONTAL": [(0, 0), (1, 0)],
                   "2x2_SQUARE": [(0, 0), (1, 0), (0, 1), (1, 1)], "TOP_RIGHT_ANGLE": [(0, 0), (1, 0), (1, 1)],
                   "TOP_LEFT_ANGLE": [(0, 0), (1, 0), (0, 1)], "SMALL_RECTANGLE": [(0, 0)]}
    fly = re.findall(r"MAP_HEADER_(\w+),.*?FLY_LOCATION_SHAPE_(\w+).*?spriteX = (\d+) \* TOWN_MAP_GRID_SPACING",
                     open(path(spec["fly"])).read(), re.S)
    fly_y = re.findall(r"spriteY = (\d+) \* TOWN_MAP_GRID_SPACING", open(path(spec["fly"])).read())
    occupied = {}
    for (header, shape, gx), gy in zip(fly, fly_y):
        label = spec["cities"].get(header)
        if not label or label in [c[2] for c in region.cities]:
            continue
        cells = [(int(gx) + dx, int(gy) + dy) for dx, dy in shape_cells[shape]]
        x = sum(center(*c)[0] for c in cells) / len(cells)
        y = sum(center(*c)[1] for c in cells) / len(cells)
        region.cities.append((x, y, label, shape == "2x2_SQUARE"))
        occupied.update({c: (x, y) for c in cells})
    road_cells = {(i, j) for i in range(32) for j in range(5, 30)
                  if 0 <= center(i, j)[1] < road.shape[0] and road[int(center(i, j)[1]), int(center(i, j)[0])]}
    road_cells |= set(occupied)
    for cell in road_cells - set(occupied):
        region.steps.append((*center(*cell), is_water(*center(*cell))))
    for i, j in road_cells:
        for other in ((i + 1, j), (i, j + 1)):
            if other not in road_cells or (occupied.get((i, j)) and occupied.get((i, j)) == occupied.get(other)):
                continue
            (ax, ay), (bx, by) = center(i, j), center(*other)
            if not road[int((ay + by) / 2), int((ax + bx) / 2)]:
                continue
            a, b = occupied.get((i, j), center(i, j)), occupied.get(other, center(*other))
            region.links.append((a, b, is_water(*a) or is_water(*b)))
    for cell, style in spec.get("annex", []):
        region.dungeons.append((*center(*cell), style))
    lakes = np.isin(roads, (3, 4))   # les lacs sont dessinés sur la couche routes
    lakes[:, :x0] = False
    seen = np.zeros_like(lakes)
    for sy, sx in zip(*np.nonzero(lakes)):
        if seen[sy, sx]:
            continue
        stack, members = [(sy, sx)], []
        seen[sy, sx] = True
        while stack:
            y, x = stack.pop()
            members.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < lakes.shape[0] and 0 <= nx < lakes.shape[1] and lakes[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        if len(members) > 20:
            region.dungeons.append((np.mean([m[1] for m in members]), np.mean([m[0] for m in members]), "lake"))
    return region


LOADERS = {"firered": load_firered, "emerald": load_emerald, "crystal": load_crystal, "platinum": load_platinum}
regions = [LOADERS[spec["source"]](spec) for spec in REGIONS]
by_name = {region.name: region for region in regions}

# ======================================================================
# Relief du monde : chaque région posée sur la mer commune, puis le traitement du POC de Kanto
# ======================================================================
world_height = np.zeros((WORLD_H, WORLD_W), dtype=np.float32)
for region in regions:
    region.paste_into(world_height)

W, Hpx = WORLD_W, WORLD_H
noise = (value_noise(W, Hpx, 18, 1) - 0.5) * 0.9 + (value_noise(W, Hpx, 6, 2) - 0.5) * 0.35
H = box_blur(world_height, 6, radius=2)
H = H + noise * np.clip(H, 0.2, 1.0) * np.clip(1.6 - H, 0, 1) + noise * 0.3 * (H > 1.2)
land = H > 0.55


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


water_distance = distance_to(land, 30)
land_distance = distance_to(~land, 6)

PALETTE = {
    "deep": (40, 96, 184), "sea": (64, 136, 224), "shallow": (104, 176, 240), "foam": (216, 240, 255),
    "sand": (240, 224, 160), "sand_dark": (216, 192, 128),
    "grass": [(72, 168, 56), (96, 192, 64), (128, 208, 72), (160, 224, 96), (192, 236, 128)],
    "grass_shadow": [(48, 128, 48), (64, 152, 56), (96, 176, 64), (128, 192, 80), (160, 208, 104)],
    "snowy": [(200, 216, 232), (216, 228, 240), (228, 236, 246), (238, 242, 250), (246, 248, 252)],
    "snowy_shadow": [(168, 184, 208), (184, 200, 220), (200, 212, 228), (212, 222, 236), (224, 230, 242)],
    "rock": (152, 144, 136), "rock_shadow": (112, 104, 100), "snow": (240, 244, 252),
    "road": (224, 184, 112), "road_edge": (152, 104, 56),
}
out = np.zeros((Hpx, W, 3), dtype=np.uint8)
gy, gx = np.gradient(H)
facing_light = (gx + gy) < -0.01
in_shadow = (gx + gy) > 0.02

out[~land] = PALETTE["deep"]
out[~land & (water_distance <= 22)] = PALETTE["sea"]
out[~land & (water_distance <= 7)] = PALETTE["shallow"]
ripple = (value_noise(W, Hpx, 10, 7) > 0.78) & (water_distance > 9) & ((np.indices((Hpx, W))[0] % 4) == 0)
out[~land & ripple] = PALETTE["shallow"]
out[~land & (water_distance <= 1)] = PALETTE["foam"]

# Zones enneigées (spec "snow") : même relief, palette froide, bord adouci par du bruit.
snowy_zone = np.zeros((Hpx, W), dtype=bool)
snow_noise = (value_noise(W, Hpx, 70, 5) - 0.5) * 170
yy, xx = np.indices((Hpx, W))
for region in regions:
    if "snow" in region.spec:
        sx0, sy0, sx1, sy1 = region.spec["snow"]
        (wx0, wy0), (wx1, wy1) = region.world(sx0, sy0), region.world(sx1, sy1)
        snowy_zone |= (xx > wx0 + snow_noise) & (xx < wx1 + snow_noise) & (yy > wy0) & (yy < wy1 + snow_noise)

levels = np.clip(np.floor(H - 0.55).astype(int), 0, 4)
for level in range(5):
    band = land & (levels == level) & (H < 5.6)
    for zone, light, dark in ((~snowy_zone, "grass", "grass_shadow"), (snowy_zone, "snowy", "snowy_shadow")):
        part = band & zone
        out[part] = PALETTE[light][level]
        out[part & in_shadow] = PALETTE[dark][level]
        out[part & facing_light & (level < 4)] = PALETTE[light][min(level + 1, 4)]
edge = np.zeros_like(land)
edge[1:, :] |= levels[1:, :] != levels[:-1, :]
edge[:, 1:] |= levels[:, 1:] != levels[:, :-1]
out[land & edge & (H < 5.6)] = [tuple(int(c * 0.82) for c in PALETTE["grass_shadow"][0])]
rock = land & (H >= 5.6)
out[rock] = PALETTE["rock"]
out[rock & in_shadow] = PALETTE["rock_shadow"]
out[land & (H >= 6.15)] = PALETTE["snow"]
beach = land & (land_distance <= 3) & (H < 2.2) & ~snowy_zone
out[beach] = PALETTE["sand"]
out[beach & (land_distance == 1)] = PALETTE["sand_dark"]

image = Image.fromarray(out)
draw = ImageDraw.Draw(image)

random.seed(3)


def tree(x, y, snowy=False):
    draw.rectangle([x - 1, y + 3, x, y + 5], fill=(104, 64, 32))
    if snowy:   # sapin enneigé
        draw.polygon([(x - 4, y + 3), (x + 3, y + 3), (x, y - 5)], fill=(40, 96, 72), outline=(24, 64, 48))
        draw.point([(x - 1, y - 3), (x, y - 3), (x - 2, y)], fill=(240, 244, 252))
        return
    draw.ellipse([x - 4, y - 4, x + 3, y + 3], fill=(32, 104, 40), outline=(16, 64, 24))
    draw.point([(x - 2, y - 2), (x - 1, y - 2)], fill=(80, 160, 64))


forest_noise = value_noise(W, Hpx, 30, 11)
for _ in range(22000):
    x, y = random.randrange(W), random.randrange(Hpx)
    if land[y, x] and land_distance[y, x] > 5 and H[y, x] < 3.2 and forest_noise[y, x] > 0.62:
        tree(x, y, snowy_zone[y, x])

# ======================================================================
# Routes, étapes, liaisons entre régions
# ======================================================================
road_segments, sea_segments, step_points = [], [], []
for region in regions:
    for start, end, is_water in region.links:
        (sea_segments if is_water else road_segments).append((region.world(*start), region.world(*end)))
    step_points += [(*region.world(x, y), is_water) for x, y, is_water in region.steps]


def resolve(point):
    """Point ("city", ...) ou ("native", ...) d'une liaison -> coordonnées du monde, décalage compris."""
    kind, name, *args = point
    if kind == "city":
        (x, y), offset = by_name[name].city(args[0]), args[1:]
    else:
        (x, y), offset = by_name[name].world(args[0], args[1]), args[2:]
    dx, dy = offset if offset else (0, 0)
    return x + dx, y + dy


for link in LINKS:
    base = [None if p[0] == "corner" else resolve(p) for p in link["points"]]
    points = []
    for p, b in zip(link["points"], base):
        if b is None:   # coin : x d'un point, y d'un autre (les coins ne visent pas d'autres coins)
            _, i, j, *offset = p
            dx, dy = offset if offset else (0, 0)
            b = (base[i][0] + dx, base[j][1] + dy)
        points.append(b)
    target = sea_segments if link["water"] else road_segments
    for a, b in zip(points, points[1:]):
        target.append((a, b))
        count = max(1, round(math.dist(a, b) / 44))
        step_points += [(a[0] + (b[0] - a[0]) * k / count, a[1] + (b[1] - a[1]) * k / count, link["water"])
                        for k in range(1, count)]
    step_points += [(*corner, link["water"]) for corner in points[1:-1]]

for a, b in sea_segments:
    dashes = max(2, int(math.dist(a, b) / 9))
    for i in range(0, dashes, 2):
        p = (a[0] + (b[0] - a[0]) * i / dashes, a[1] + (b[1] - a[1]) * i / dashes)
        q = (a[0] + (b[0] - a[0]) * (i + 1) / dashes, a[1] + (b[1] - a[1]) * (i + 1) / dashes)
        draw.line([p, q], fill=PALETTE["foam"], width=3)
for a, b in road_segments:
    draw.line([a, b], fill=PALETTE["road_edge"], width=9)
for a, b in road_segments:
    draw.line([a, b], fill=PALETTE["road"], width=5)
for x, y, is_water in step_points:
    draw.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(255, 255, 255), outline=(56, 56, 72), width=2)
    draw.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(64, 120, 224) if is_water else (224, 64, 64))

# ======================================================================
# Zones annexes : losange crème + pictogramme (distinct du rond des étapes)
# ======================================================================
cities_world = [(*region.world(x, y), name, big) for region in regions for x, y, name, big in region.cities]
annexes = [[region.world(x, y)[0] + 14, region.world(x, y)[1] - 14, style]
           for region in regions for x, y, style in region.dungeons]
for _ in range(12):   # écarte les losanges des villes et les uns des autres
    for marker in annexes:
        for cx, cy, _, _ in cities_world:
            d = math.dist(marker[:2], (cx, cy))
            if d < 30:
                ux, uy = ((marker[0] - cx) / d, (marker[1] - cy) / d) if d > 0.1 else (0.7, -0.7)
                marker[0], marker[1] = cx + ux * 30, cy + uy * 30
        for other in annexes:
            d = math.dist(marker[:2], other[:2])
            if other is not marker and d < 24:
                ux, uy = ((marker[0] - other[0]) / d, (marker[1] - other[1]) / d) if d > 0.1 else (1, 0)
                marker[0] += ux * (24 - d) / 2
                marker[1] += uy * (24 - d) / 2


def annex(x, y, style):
    draw.polygon([(x, y - 13), (x + 13, y), (x, y + 13), (x - 13, y)], fill=(248, 240, 208), outline=(56, 56, 72), width=2)
    if style == "cave":
        draw.pieslice([x - 8, y - 6, x + 8, y + 10], 180, 360, fill=(120, 104, 88), outline=(64, 52, 44))
        draw.pieslice([x - 4, y - 1, x + 4, y + 9], 180, 360, fill=(24, 20, 20))
    elif style == "forest":
        for ox, oy in ((-4, 1), (4, 1), (0, -4)):
            draw.ellipse([x + ox - 4, y + oy - 4, x + ox + 4, y + oy + 4], fill=(32, 104, 40), outline=(16, 64, 24))
    elif style == "tower":
        draw.rectangle([x - 3, y - 5, x + 3, y + 7], fill=(160, 120, 200), outline=(80, 48, 112))
        draw.polygon([(x - 5, y - 5), (x + 5, y - 5), (x, y - 10)], fill=(96, 64, 144))
    elif style == "plant":
        draw.polygon([(x + 1, y - 9), (x - 5, y + 1), (x - 1, y + 1), (x - 2, y + 9), (x + 5, y - 2), (x + 1, y - 2)],
                     fill=(248, 208, 48), outline=(152, 112, 16))
    elif style == "ruins":
        for ox in (-5, 0, 5):
            draw.rectangle([x + ox - 1, y - 5, x + ox + 1, y + 6], fill=(200, 184, 152), outline=(112, 96, 72))
        draw.rectangle([x - 7, y - 7, x + 7, y - 5], fill=(176, 160, 128), outline=(112, 96, 72))
    elif style == "lake":
        draw.ellipse([x - 8, y - 5, x + 8, y + 5], fill=(80, 152, 232), outline=(40, 88, 168))
        draw.line([x - 4, y - 1, x + 2, y - 1], fill=(216, 240, 255))
    elif style == "island":
        draw.ellipse([x - 8, y + 1, x + 8, y + 7], fill=(80, 152, 232))
        draw.ellipse([x - 6, y - 4, x + 6, y + 4], fill=(96, 176, 72), outline=(48, 112, 40))
    else:
        points = [(x + (8 if k % 2 == 0 else 3.5) * math.cos(-math.pi / 2 + k * math.pi / 5),
                   y + (8 if k % 2 == 0 else 3.5) * math.sin(-math.pi / 2 + k * math.pi / 5)) for k in range(10)]
        draw.polygon(points, fill=(248, 200, 48), outline=(152, 104, 16))


for x, y, style in annexes:
    annex(x, y, style)

# ======================================================================
# Villes et étiquettes
# ======================================================================
def house(x, y, roof):
    draw.rectangle([x - 4, y - 1, x + 4, y + 5], fill=(248, 240, 224), outline=(72, 56, 48))
    draw.polygon([(x - 6, y - 1), (x + 6, y - 1), (x, y - 7)], fill=roof, outline=(72, 40, 40))
    draw.rectangle([x - 1, y + 2, x + 1, y + 5], fill=(104, 72, 48))


for x, y, name, big in cities_world:
    draw.ellipse([x - 16, y - 13, x + 16, y + 15], fill=(200, 184, 152), outline=(120, 96, 72), width=2)
    spots = [(-7, -1, (216, 72, 56)), (7, -1, (64, 112, 200)), (0, 8, (216, 72, 56))]
    if big:
        spots += [(-8, 9, (96, 168, 88)), (8, 9, (232, 160, 48))]
    for ox, oy, roof in spots:
        house(int(x + ox), int(y + oy), roof)

font = ImageFont.truetype(FONT_PATH, 13)
placed = [(x - 17, y - 14, x + 17, y + 16) for x, y, _, _ in cities_world]
placed += [(x - 13, y - 13, x + 13, y + 13) for x, y, _ in annexes]
steps_boxes = [(x - 6, y - 6, x + 6, y + 6) for x, y, _ in step_points]


def overlaps(box, boxes):
    return any(not (box[2] < b[0] or box[0] > b[2] or box[3] < b[1] or box[1] > b[3]) for b in boxes)


for x, y, name, _ in cities_world:   # étiquette sous la ville, sinon au-dessus, à droite, à gauche...
    width = draw.textbbox((0, 0), name, font=font)[2]
    candidates = ((x - width / 2, y + 18), (x - width / 2, y - 36), (x + 20, y - 8), (x - 20 - width, y - 8),
                  (x + 14, y + 14), (x - 14 - width, y + 14), (x + 14, y - 32), (x - 14 - width, y - 32),
                  (x - width / 2, y + 36), (x - width / 2, y - 54))
    # D'abord une place qui ne cache ni ville, ni zone annexe, ni étape ; sinon seulement ni ville ni annexe.
    choice = None
    for boxes in (placed + steps_boxes, placed):
        for tx, ty in candidates:
            box = (tx - 4, ty - 2, tx + width + 4, ty + 16)
            if not overlaps(box, boxes):
                choice = (tx, ty, box)
                break
        if choice:
            break
    tx, ty, box = choice or (*candidates[0], (candidates[0][0] - 4, candidates[0][1] - 2,
                                              candidates[0][0] + width + 4, candidates[0][1] + 16))
    placed.append(box)
    draw.rounded_rectangle(box, radius=3, fill=(248, 248, 240), outline=(56, 56, 72), width=2)
    draw.text((tx, ty - 1), name, fill=(40, 40, 56), font=font)

title_font = ImageFont.truetype(FONT_PATH, 44)
for spec in REGIONS:
    if spec.get("label"):
        text, (x, y) = spec["label"]
        draw.text((x, y), text, font=title_font, fill=(248, 248, 240), stroke_width=4, stroke_fill=(40, 56, 104))

# Cartouche : titre et légende dans la mer du nord-ouest
draw.rounded_rectangle([40, 40, 660, 330], radius=8, fill=(248, 244, 228), outline=(56, 56, 72), width=3)
draw.text((64, 58), "Monde Pokémon (POC)", font=ImageFont.truetype(FONT_PATH, 30), fill=(40, 40, 56))
small = ImageFont.truetype(FONT_PATH, 16)
draw.ellipse([54, 99, 86, 127], fill=(200, 184, 152), outline=(120, 96, 72), width=2)
house(63, 111, (216, 72, 56))
house(77, 111, (64, 112, 200))
draw.text((100, 103), "Ville (nom français officiel)", font=small, fill=(40, 40, 56))
for legend_y, dot, text in ((156, (224, 64, 64), "Étape de route (une par case de la Town Map)"),
                            (190, (64, 120, 224), "Étape en mer (Surf, ferry)")):
    draw.ellipse([65, legend_y - 5, 75, legend_y + 5], fill=(255, 255, 255), outline=(56, 56, 72), width=2)
    draw.ellipse([68, legend_y - 2, 72, legend_y + 2], fill=dot)
    draw.text((100, legend_y - 9), text, font=small, fill=(40, 40, 56))
for k, style in enumerate(("cave", "forest", "tower", "plant", "ruins", "lake", "island", "star")):
    annex(70 + k * 32, 236, style)
draw.text((60, 258), "Zones annexes : grotte, forêt, tour, centrale,", font=small, fill=(40, 40, 56))
draw.text((60, 280), "ruines, lac, île, autre", font=small, fill=(40, 40, 56))

draw.rectangle([0, 0, image.width - 1, image.height - 1], outline=(56, 56, 72), width=4)
draw.rectangle([4, 4, image.width - 5, image.height - 5], outline=(232, 216, 176), width=2)
image.save(OUT)
print(OUT, image.size, "villes", len(cities_world), "étapes", len(step_points), "annexes", len(annexes))
