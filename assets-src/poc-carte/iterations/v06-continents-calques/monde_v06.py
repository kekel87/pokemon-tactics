"""POC V06 : la carte du monde de la V05 posée sur les vrais continents, décor varié, calques par nature.

Reprend la V05 (toutes les régions, relief des Town Maps, routes, étapes, villes, zones annexes, un calque par
région, version grisée). Nouveautés : terre hors régions tirée de Natural Earth 1:50m (domaine public), déformée
par colonnes de longitude pour s'emboîter autour des régions (voir « Continents réels ») ; mer de nuages sur
l'intérieur de l'Eurasie ; eau refaite dans l'esprit GBA ; neige texturée ; décor de sprites GBA détourés
(feuillus, sapins, sapins enneigés, palmiers, arbres tropicaux, montagnes, rochers : sprites_v06.py) ; accès
tracés des zones annexes vers le réseau ; un calque PNG par nature + decor.json.

Usage (depuis ce dossier) :
  python3 -P sprites_v06.py sources-v06 tree-sprite.png sprites
  python3 -P monde_v06.py sources assembled ../../../kanto-pret sources-officielles sources-v06 monde-v06.png
Sorties : monde-v06.png, monde-v06-grisee.png (seules Kanto, Johto, Hoenn, Sinnoh disponibles), decor.json,
  layers/NN-<nature>.png (superposés dans l'ordre = monde-v06.png, vérifié en fin de script),
  layers/regions/<région>.png, layers/regions/continents.png, layers/regions/liaisons.png
"""
import json
import math
import os
import random
import re
import struct
import sys
import zlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOTS = dict(zip(("dl", "assembled", "kanto", "officiel", "v06"), sys.argv[1:6]))
OUT = sys.argv[6]
HERE = os.path.dirname(os.path.abspath(__file__))
WORLD_W, WORLD_H = 10700, 3260
UNKNOWN = -1.0
FONT_PATH = "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf"
STEP_SPACING = 42          # distance entre deux étapes d'une route tracée à la main (pixels du monde)
TREE_MARGIN = 7            # écart minimal entre un arbre et n'importe quel tracé


def path(spec):
    """'racine:chemin/relatif' -> chemin absolu."""
    root, relative = spec.split(":", 1)
    return f"{ROOTS[root]}/{relative}"


# ======================================================================
# Données : les régions et les liaisons
# ======================================================================
# crop = cadre lu dans la carte source (pixels natifs), scale = pixels du monde par pixel natif,
# origin = coin haut-gauche du cadre dans le monde, fade = largeur (pixels du monde) du bord où la terre
# s'enfonce dans la mer. state = "available" | "locked" | "hidden".
# Échelle commune visée : 35 à 45 pixels du monde par case de route des jeux 2D, soit 80 à 200 pixels
# entre deux villes voisines.
# Groupes (distances compressées) : Europe (Galar, Kalos, Paldea) à l'ouest, Japon (Kanto, Johto, Hoenn,
# Sinnoh, Septentria, Sevii) au centre, Alola au sud-est, Unys à l'est.
JAPAN = (3250, 0)   # décalage du groupe Japon (repère de la V02)


def japan(x, y):
    return (x + JAPAN[0], y + JAPAN[1])


REGIONS = [
    {
        "name": "Kanto", "source": "firered", "state": "available", "label": ("KANTO", (950, 560)),
        "map": "kanto:kanto_assembled.png", "layout": "kanto:kanto.h",
        "crop": (14, 14, 222, 158), "scale": 5, "origin": japan(1900, 1480), "fade": 0,
        "white_is_snow": True, "cut": {"top": 16, "left": 24, "right": 216},
        "cities": {
            "PALLET_TOWN": "Bourg Palette", "VIRIDIAN_CITY": "Jadielle", "PEWTER_CITY": "Argenta",
            "CERULEAN_CITY": "Azuria", "VERMILION_CITY": "Carmin sur Mer", "LAVENDER_TOWN": "Lavanville",
            "CELADON_CITY": "Céladopole", "SAFFRON_CITY": "Safrania", "FUCHSIA_CITY": "Parmanie",
            "CINNABAR_ISLAND": "Cramois'Île", "INDIGO_PLATEAU": "Plateau Indigo",
        },
        "big": ["CELADON_CITY", "SAFFRON_CITY", "VERMILION_CITY", "CERULEAN_CITY"],
        "annex_names": {
            "VIRIDIAN_FOREST": "Forêt de Jade", "MT_MOON": "Mont Sélénite", "ROCK_TUNNEL": "Grotte Sombre",
            "DIGLETTS_CAVE": "Grotte Taupiqueur", "KANTO_VICTORY_ROAD": "Route Victoire",
            "CERULEAN_CAVE": "Caverne Azurée", "POKEMON_TOWER": "Tour Pokémon",
            "POWER_PLANT": "Centrale abandonnée", "SEAFOAM_ISLANDS": "Îles Écume",
            "POKEMON_MANSION": "Manoir Pokémon", "KANTO_SAFARI_ZONE": "Parc Safari",
        },
    },
    {
        "name": "Johto", "source": "crystal", "state": "available", "label": ("JOHTO", (30, -80)),
        "map": "assembled:johto_gsc_assembled.png", "landmarks": "dl:pokecrystal/data/maps/landmarks.asm",
        "crop": (8, 8, 152, 136), "scale": 5, "origin": japan(1262, 1516), "fade": 60, "pre_blur": 3,
        "cities": {
            "NewBarkTown": "Bourg Geon", "CherrygroveCity": "Ville Griotte", "VioletCity": "Mauville",
            "AzaleaTown": "Écorcia", "GoldenrodCity": "Doublonville", "EcruteakCity": "Rosalia",
            "OlivineCity": "Oliville", "CianwoodCity": "Irisia", "MahoganyTown": "Acajou",
            "BlackthornCity": "Ébènelle",
        },
        "big": ["GoldenrodCity", "EcruteakCity", "OlivineCity"],
        "annex": {
            "SproutTower": ("tower", "Tour Chétiflor"), "RuinsOfAlph": ("ruins", "Ruines d'Alpha"),
            "UnionCave": ("cave", "Caves Jumelles"), "SlowpokeWell": ("cave", "Puits Ramoloss"),
            "IlexForest": ("forest", "Bois aux Chênes"), "RadioTower": ("tower", "Tour Radio"),
            "NationalPark": ("forest", "Parc Naturel"), "TinTower": ("tower", "Tour Carillon"),
            "BurnedTower": ("tower", "Tour Cendrée"), "Lighthouse": ("tower", "Phare"),
            "BattleTower": ("star", "Tour de Combat"), "WhirlIslands": ("island", "Tourb'Îles"),
            "MtMortar": ("cave", "Mont Creuset"), "LakeOfRage": ("lake", "Lac Colère"),
            "IcePath": ("cave", "Route de Glace"), "DragonsDen": ("cave", "Antre du Dragon"),
            "DarkCave": ("cave", "Antre Noir"), "SilverCave": ("cave", "Mont Argenté"),
        },
        # Routes 40 et 41 : en mer, d'Oliville à Irisia par les Tourb'Îles (tuiles 8x8).
        "sea_chains": [[(4, 7), (3, 8), (3, 9), (3, 10), (3, 11), (3, 12), (2, 12)]],
    },
    {
        "name": "Hoenn", "source": "emerald", "state": "available", "label": ("HOENN", (420, 790)),
        "map": "assembled:hoenn_assembled.png", "layout": "dl:pokeemerald/src/data/region_map/region_map_layout.h",
        "sections": "dl:pokeemerald/src/data/region_map/region_map_sections.json",
        "crop": (0, 8, 256, 160), "scale": 5, "origin": japan(300, 2380), "fade": 30,
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
        # Routes maritimes : une étape par route, une seule liaison par chapelet (pas de quadrillage).
        "sea_paths": [
            ["ROUTE_104", "ROUTE_105", "ROUTE_106", "DEWFORD_TOWN", "ROUTE_107", "ROUTE_108", "ROUTE_109",
             "SLATEPORT_CITY"],
            ["LILYCOVE_CITY", "ROUTE_124", "MOSSDEEP_CITY", "ROUTE_127", "ROUTE_128", "EVER_GRANDE_CITY"],
            ["ROUTE_124", "ROUTE_126", "SOOTOPOLIS_CITY"],
            ["EVER_GRANDE_CITY", "ROUTE_129", "ROUTE_130", "ROUTE_131", "PACIFIDLOG_TOWN", "ROUTE_132",
             "ROUTE_133", "ROUTE_134", "SLATEPORT_CITY"],
            ["ROUTE_121", "ROUTE_122", "ROUTE_123"],
        ],
        "annex": {
            "GRANITE_CAVE": "Grotte Granite", "MT_CHIMNEY": "Mont Chimnée", "SAFARI_ZONE": "Parc Safari",
            "BATTLE_FRONTIER": "Zone de Combat", "PETALBURG_WOODS": "Bois Clémenti",
            "RUSTURF_TUNNEL": "Tunnel Mérazon", "ABANDONED_SHIP": "Épave", "NEW_MAUVILLE": "New Lavandia",
            "METEOR_FALLS": "Site Météore", "MT_PYRE": "Mont Mémoria", "SHOAL_CAVE": "Grotte Tréfonds",
            "SEAFLOOR_CAVERN": "Caverne Fondmer", "VICTORY_ROAD": "Route Victoire",
            "CAVE_OF_ORIGIN": "Grotte Origine", "SKY_PILLAR": "Pilier Céleste", "SOUTHERN_ISLAND": "Île du Sud",
            "DESERT_RUINS": "Ruines Désert", "ANCIENT_TOMB": "Tombeau Antique", "ISLAND_CAVE": "Grotte de l'Îlot",
            "SEALED_CHAMBER": "Sanctuaire", "FIERY_PATH": "Chemin Ardent", "SCORCHED_SLAB": "Grotte Zénith",
            "MIRAGE_ISLAND": "Île Mirage",
        },
    },
    {
        "name": "Sinnoh", "source": "platinum", "state": "available", "label": ("SINNOH", (-260, 40)),
        "dir": "dl:pokeplatinum/res/graphics/town_map",
        "fly": "dl:pokeplatinum/src/applications/town_map/fly_locations.c",
        "crop": (21, 0, 237, 164), "scale": 5, "origin": japan(2050, 40), "fade": 40,
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
            ((7, 16), "forest", "Forêt de Vestigion"), ((6, 19), "plant", "Parc Éolien"),
            ((5, 17), "plant", "Forge Fuego"), ((12, 18), "cave", "Mont Couronné"),
            ((13, 13), "ruins", "Colonnes Lances"), ((16, 20), "tower", "Tour Perdue"),
            ((3, 15), "island", "Île de Fer"), ((8, 25), "cave", "Mine de Charbourg"),
            ((9, 20), "cave", "Grotte des Égarés"), ((17, 26), "forest", "Grand Marais"),
            ((26, 19), "cave", "Route Victoire"), ((23, 9), "cave", "Mont Abrupt"),
            ((11, 4), "ruins", "Temple de Frimapic"), ((9, 28), "star", "Parc des Amis"),
        ],
        # Lacs détectés sur la carte : du nord au sud, puis d'ouest en est.
        "lake_names": {"north": "Lac Savoir", "west": "Lac Vérité", "east": "Lac Courage"},
    },
    *[
        {
            "name": f"Sevii {part}", "source": "firered", "state": "available",
            "label": ("ÎLES SEVII", (120, 560)) if part == "123" else None,
            "map": f"assembled:sevii_{part}_assembled.png",
            "layout": f"dl:pokefirered/src/data/region_map/region_map_layout_sevii_{part}.h",
            "crop": crop, "scale": 4, "origin": japan(*origin), "fade": 24,
            "cut": {"left": 24, "right": 216, "box": (190, 136, 240, 160)},
            "cities": {
                "ONE_ISLAND": "Île 1", "TWO_ISLAND": "Île 2", "THREE_ISLAND": "Île 3", "FOUR_ISLAND": "Île 4",
                "FIVE_ISLAND": "Île 5", "SIX_ISLAND": "Île 6", "SEVEN_ISLAND": "Île 7",
            },
            "map_annex": ["NAVEL_ROCK", "BIRTH_ISLAND", "MEMORIAL_PILLAR", "TRAINER_TOWER"],
            "annex_names": {
                "NAVEL_ROCK": "Roc Nombri", "BIRTH_ISLAND": "Île Aurore", "MEMORIAL_PILLAR": "Mémorial",
                "TRAINER_TOWER": "Tour Dresseurs", "BERRY_FOREST": "Bois Baies", "MT_EMBER": "Mont Braise",
                "ICEFALL_CAVE": "Grotte de Glace", "LOST_CAVE": "Grotte Perdue", "ALTERING_CAVE": "Grotte Métamo",
                "DOTTED_HOLE": "Trou Percé", "PATTERN_BUSH": "Forbuissons", "TANOBY_CHAMBERS": "Chambres Tanoby",
            },
            # Sur ces cartes, les îles sont surtout peintes en ocre (couleurs de route ailleurs) : c'est du sol.
            "extra_colors": {(238, 230, 115): 1, (230, 164, 0): 1.5, (238, 189, 57): 1.5, (230, 222, 164): 1,
                             (205, 205, 148): 1},
        }
        for part, crop, origin in (("123", (30, 45, 200, 155), (1560, 2290)),
                                   ("45", (45, 50, 200, 155), (2330, 2280)),
                                   ("67", (45, 25, 200, 150), (2330, 2680)))
    ],
    {
        # Septentria (Kitakami, extension d'Écarlate / Violet) : vallée sans mer, entre Kanto et Sinnoh.
        # Carte officielle Kitakami.png (3400x3400) ; lieux placés par corrélation des vignettes officielles.
        "name": "Septentria", "source": "official", "state": "available", "label": ("SEPTENTRIA", (-470, 160)),
        "map": "officiel:Kitakami.png", "crop": (150, 150, 3300, 3300), "scale": 0.13,
        "origin": japan(2500, 1010), "fade": 95, "work": 700, "round": True,
        "colors": {
            (105, 160, 101): 1.9, (175, 158, 128): 3.7, (128, 175, 95): 1.5, (121, 168, 91): 1.6,
            (148, 196, 129): 1.4, (205, 190, 159): 4.7, (152, 140, 119): 3.4, (229, 222, 202): 5.8,
            (167, 202, 118): 1.3, (135, 176, 105): 1.5, (120, 172, 182): 1.2, (81, 124, 82): 2.2,
        },
        "cities": [("Jaderaude", 1959, 2488, False)],
        "annex": [
            ("Mont Strueux", 1590, 1634, "cave"), ("Lac Cristallin", 1620, 1684, "lake"),
            ("Forêt Ternelle", 2543, 756, "forest"), ("Lande de la Quiétude", 765, 648, "star"),
            ("Plaine des Glycines", 560, 1500, "star"), ("Gorge de la Corne", 2871, 1676, "cave"),
            ("Grotte Douche Froide", 2137, 1612, "cave"), ("Gueule du Monstre", 1795, 2014, "cave"),
            ("Rives du Confluent", 2949, 2689, "lake"), ("Terres Vierges de Septentria", 2338, 710, "forest"),
        ],
        "routes": [
            (False, ["Jaderaude", (1640, 2700), (1649, 2881)]),                     # Route de Septentria
            (False, ["Jaderaude", (1575, 2506), (1150, 2350), (800, 1900), "Plaine des Glycines"]),  # Coteau Pommes
            (False, ["Jaderaude", (2365, 2634), "Rives du Confluent"]),             # Sentier de la Liesse
            (False, ["Jaderaude", (1900, 2200), "Gueule du Monstre"]),
            (False, ["Rives du Confluent", (2900, 2200), "Gorge de la Corne", (2700, 1200), "Forêt Ternelle"]),
            (False, ["Plaine des Glycines", (650, 1100), "Lande de la Quiétude"]),
        ],
    },
    {
        # Galar : mosaïque des captures de la carte de Bouclier / Épée (même zoom), assemblée par
        # corrélation de phase ; villes et lieux = position du curseur sur chaque capture.
        "name": "Galar", "source": "official", "state": "available", "label": ("GALAR", (620, 260)),
        "map": "officiel:galar_mosaique.png", "crop": (60, 0, 1880, 4380), "scale": 0.27,
        "origin": (400, 50), "fade": 60, "work": 900,
        "colors": {
            (102, 186, 193): 0, (50, 149, 165): 0, (175, 193, 195): 0.9, (177, 202, 74): 1.4,
            (126, 175, 77): 2.6, (86, 137, 49): 3.2, (185, 178, 147): 3.4, (174, 141, 84): 3.4,
            (118, 117, 107): 4.6, (140, 146, 164): 5.0, (95, 169, 118): 2.2, (236, 71, 88): UNKNOWN,
        },
        # Au nord (Kickenham, Ludester, Winscor), le gris bleuté des montagnes est de la neige, pas un lac.
        "zone_colors": [((60, 0, 1880, 1700), {(175, 193, 195): 5.6})],
        "snow_colors": [(175, 193, 195)], "snow_rows": (0, 1700),
        "cities": [
            ("Paddoxton", 976, 4217, False), ("Brasswick", 976, 3888, False), ("Motorby", 908, 2665, True),
            ("Greenbury", 438, 2286, False), ("Skifford", 1365, 2283, False), ("Old Chister", 451, 1649, False),
            ("Corrifey", 364, 1144, False), ("Kickenham", 933, 1871, True), ("Ludester", 1540, 1302, True),
            ("Smashings", 1676, 1866, False), ("Winscor", 932, 330, True),
        ],
        "annex": [
            ("Forêt de Sleepwood", 659, 4255, "forest"), ("Mine de Galar", 320, 2530, "cave"),
            ("Mine de Galar n° 2", 1393, 2500, "cave"), ("Forêt de Lumirinth", 451, 1300, "forest"),
            ("Tunnel de la Route 9", 1404, 1871, "cave"), ("Terres Sauvages", 900, 3150, "forest"),
            ("Lac Ouragan", 760, 2039, "lake"), ("Tour en ruines", 700, 2981, "ruins"),
        ],
        "routes": [
            (False, ["Paddoxton", "Brasswick"]),                                                    # Route 1
            (False, ["Brasswick", (1170, 3830), (1170, 3680), (1290, 3640)]),                      # Route 2
            (False, ["Brasswick", (970, 3560), (868, 3515), (770, 3338), (760, 3100), "Tour en ruines",
                     (908, 2862), "Motorby"]),                                                      # Terres Sauvages sud
            (False, ["Motorby", (533, 2660), (320, 2660), "Mine de Galar", (320, 2380), "Greenbury"]),  # Routes 3-4
            (False, ["Greenbury", "Skifford"]),                                                     # Route 5
            (False, ["Skifford", "Mine de Galar n° 2", (1300, 2660), (1195, 2660), "Motorby"]),
            (False, ["Motorby", (1060, 2700), (1069, 2494), (1040, 2249), (960, 2149), (1020, 2007),
                     "Kickenham"]),                                                                 # Terres Sauvages nord
            (False, ["Kickenham", (545, 1871), (545, 1660), "Old Chister"]),                        # Route 6
            (False, ["Old Chister", "Forêt de Lumirinth", "Corrifey"]),
            (False, ["Kickenham", (1256, 1871), (1256, 1711), (1333, 1589), (1378, 1489), (1378, 1311),
                     "Ludester"]),                                                                  # Routes 7-8
            (False, ["Ludester", (1700, 1311), (1700, 1556), (1611, 1667), (1556, 1756), (1556, 1871),
                     "Smashings"]),                                                                 # Route 9
            (False, [(1256, 1871), "Tunnel de la Route 9", (1556, 1871)]),
            (False, ["Kickenham", (944, 1300), (944, 1044), (1062, 978), (1062, 880), (933, 844),
                     "Winscor"]),                                                                   # Route 10
        ],
    },
    {
        # Kalos : carte du jeu (X / Y) des vignettes officielles 256x168, base = leur médiane.
        "name": "Kalos", "source": "official", "state": "available", "label": ("KALOS", (900, 330)),
        "map": "officiel:kalos_base_mediane.png", "crop": (8, 10, 256, 160), "scale": 3.6,
        "origin": (475, 1290), "fade": 90, "pre_blur": 1,
        "colors": {
            (44, 131, 191): 0, (92, 187, 238): 0, (45, 106, 120): 0, (75, 137, 142): 0.2,
            (123, 115, 69): 3.4, (100, 147, 101): 1.6, (137, 133, 85): 3.0, (107, 93, 53): 4.2,
            (85, 115, 82): 2.0, (128, 171, 128): 1.4, (67, 75, 66): UNKNOWN, (45, 52, 50): UNKNOWN,
            (241, 240, 238): UNKNOWN, (186, 187, 185): UNKNOWN, (30, 160, 230): UNKNOWN, (230, 110, 40): UNKNOWN,
        },
        "clear_markers": 9,
        "cities": [
            ("Bourg Croquis", 169, 142, False), ("Quarellis", 169, 124, False), ("Neuvartault", 157, 95.5, False),
            ("Illumis", 132, 62, True), ("Fort-Vanitas", 104, 97, False), ("Roche-sur-Gliffe", 57, 127, False),
            ("Relifac-le-Haut", 44, 96, False), ("Cromlac'h", 23, 80, False), ("Yantreizh", 37, 61, False),
            ("Port Tempères", 87, 50, True), ("Romant-sous-Bois", 131, 19, False), ("La Frescale", 174, 50, False),
            ("Flusselles", 223.5, 64.7, True), ("Mozheim", 236.6, 77.4, False),
            ("Auffrac-les-Congères", 216, 94.5, False), ("Batisques", 191, 155.5, False),
            ("Ligue Pokémon", 187, 73, False),
        ],
        "annex": [
            ("Forêt de Neuvartault", 169, 108, "forest"), ("Palais Chaydeuvre", 74, 75, "star"),
            ("Cave Connecterre", 56, 97, "cave"), ("Grotte Miroitante", 31, 67, "cave"),
            ("Grotte Étincelante", 92, 127, "cave"), ("Baie Azur", 71, 46, "island"),
            ("Antre Néréen", 63, 30, "cave"), ("Centrale de Kalos", 97, 68, "plant"),
            ("Hôtel Désolation", 151, 44, "ruins"), ("Caverne Gelée", 184, 39, "cave"),
            ("Village Pokémon", 205, 127, "forest"), ("Chambre Néant", 177, 101, "ruins"),
            ("Grotte Coda", 245, 63, "cave"), ("Route Victoire", 187, 92, "cave"),
            ("Usine de Poké Balls", 131, 10.5, "plant"),
        ],
        "routes": [
            (False, ["Bourg Croquis", "Quarellis", "Forêt de Neuvartault", "Neuvartault", "Illumis"]),
            (False, ["Illumis", "Fort-Vanitas", "Palais Chaydeuvre"]),
            (False, ["Fort-Vanitas", "Cave Connecterre", "Relifac-le-Haut"]),
            (False, ["Relifac-le-Haut", "Roche-sur-Gliffe", "Grotte Étincelante"]),
            (False, ["Relifac-le-Haut", "Cromlac'h", "Grotte Miroitante", "Yantreizh", "Port Tempères", "Illumis"]),
            (True, ["Port Tempères", "Baie Azur", "Antre Néréen"]),
            (False, ["Illumis", "Romant-sous-Bois", "La Frescale", "Illumis"]),
            (False, ["La Frescale", "Flusselles", "Mozheim", "Auffrac-les-Congères"]),
            (False, ["Auffrac-les-Congères", (187, 94), "Route Victoire", "Ligue Pokémon"]),
            (False, ["Neuvartault", (187, 94)]),
            (False, ["Auffrac-les-Congères", "Village Pokémon"]),
        ],
    },
    {
        # Paldea : carte officielle Paldea.png (3000x3000) ; lieux placés par corrélation des vignettes.
        "name": "Paldea", "source": "official", "state": "available", "label": ("PALDEA", (990, 380)),
        "map": "officiel:Paldea.png", "crop": (120, 330, 2960, 2960), "scale": 0.34,
        "origin": (190, 1950), "fade": 0, "work": 900,
        "colors": {
            (85, 149, 163): 0, (73, 114, 133): 0, (108, 160, 171): 0, (204, 174, 127): 2.2,
            (180, 155, 113): 3.2, (157, 190, 109): 1.4, (168, 201, 119): 1.8, (174, 205, 219): 4.4,
            (168, 140, 102): 3.8, (128, 144, 130): 1.6, (124, 161, 96): 2.0, (162, 176, 174): 3.0,
        },
        # Le cratère (Zone Zéro) a la couleur de la mer profonde : c'est un plateau, pas de l'eau.
        "zone_water": [((1080, 1480, 1780, 2120), 3.0)],
        "snow_colors": [(174, 205, 219)],
        "cities": [
            ("Cuchalaga", 1460, 2865, False), ("Plato Real", 1440, 2610, False), ("Mesaledo", 1399, 2251, True),
            ("Cuencia", 2268, 2197, False), ("Levalendura", 2484, 1717, True), ("Pinchoria", 1883, 1610, False),
            ("Jarramanca", 893, 1578, True), ("Porto Marinada", 302, 1479, False), ("Mezclamora", 1195, 1374, False),
            ("Frigao", 1637, 854, False), ("Alforneira", 509, 2647, False), ("Sevaro", 858, 2295, False),
            ("Ligue Pokémon", 1204, 2052, False),
        ],
        "annex": [
            ("Zone Zéro", 1425, 1816, "ruins"), ("Caverne de la Crique", 1495, 2712, "cave"),
            ("Grotte d'Alforneira", 504, 2569, "cave"), ("Tunnel Mezcla-Pincho", 1533, 1418, "cave"),
            ("Mont Nappé", 1500, 1036, "cave"), ("Désert Rôtissable", 589, 1609, "star"),
            ("Lac Asrol", 800, 876, "lake"), ("Bosquet Tagué", 1954, 1261, "forest"),
            ("Forêt Toastée", 663, 588, "forest"),
        ],
        "routes": [
            (False, ["Cuchalaga", (1456, 2789), "Plato Real", (1581, 2547), "Mesaledo"]),
            (False, ["Mesaledo", (1858, 2216), "Cuencia"]),
            (False, ["Cuencia", (2231, 2009), (2292, 1815), "Levalendura"]),
            (False, ["Levalendura", (2291, 1459), "Pinchoria"]),
            (False, ["Pinchoria", "Mont Nappé", "Frigao"]),
            (False, ["Mesaledo", (1009, 2163), "Sevaro"]),
            (False, ["Sevaro", (658, 1932), "Jarramanca"]),
            (False, ["Jarramanca", "Désert Rôtissable", (563, 1430), "Porto Marinada"]),
            (False, ["Jarramanca", "Mezclamora", (1300, 1200), "Mont Nappé"]),
            (False, ["Mesaledo", "Ligue Pokémon"]),
            (False, ["Plato Real", (1014, 2553), (535, 2627), "Alforneira"]),
            (False, ["Frigao", (2149, 821), (2430, 800)]),
            (False, ["Mont Nappé", (1317, 600), "Lac Asrol", "Forêt Toastée"]),
        ],
    },
    {
        # Alola : carte du jeu (Ultra-Soleil / Ultra-Lune, 400x240) ; lieux des îles Mele-Mele et Akala par
        # corrélation des vignettes officielles, ceux d'Ula-Ula et de Poni placés à la main sur la carte.
        "name": "Alola", "source": "official", "state": "available", "label": ("ALOLA", (430, 640)),
        "map": "officiel:Alola_USUM.png", "crop": (0, 12, 395, 218), "scale": 3.0,
        "origin": (6900, 2480), "fade": 0, "pre_blur": 1,
        "colors": {
            (1, 162, 230): 0, (7, 178, 230): 0, (0, 145, 237): 0, (0, 127, 238): 0, (63, 178, 238): 0,
            (20, 191, 229): 0, (0, 107, 239): 0, (30, 105, 160): 0, (21, 73, 225): 0,
            (124, 135, 88): 1.6, (32, 61, 36): 2.4, (49, 98, 96): 1.8, (92, 78, 48): 3.8, (188, 182, 142): 1.2,
            (60, 120, 60): 1.8, (150, 110, 70): 3.2, (230, 230, 235): 5.6, (150, 150, 150): 1.4,
        },
        "cities": [
            ("Lili'i", 136, 44, False), ("Ekaeka", 118, 66, True), ("Ho'ohale", 236, 87, True),
            ("Ohana", 253, 64, False), ("Konikoni", 224, 104, False), ("Malié", 350, 147, True),
            ("Kokohio", 310, 124, False), ("Village Toko", 320, 188, False), ("Village Flottant", 35, 128, False),
            ("Ligue Pokémon", 331, 167, False),
        ],
        "annex": [
            ("Grotte Verdoyante", 112, 42, "cave"), ("Jardin de Mele-Mele", 141, 33, "forest"),
            ("Colline Dicarat", 153, 80, "cave"), ("Ruines du Conflit", 150, 26, "ruins"),
            ("Colline Clapotis", 248, 47, "lake"), ("Parc Volcanique", 276, 44, "cave"),
            ("Jungle Sombrefeuille", 238, 58, "forest"), ("Colline Memento", 243, 112, "ruins"),
            ("Club Hano-Hano", 283, 90, "star"), ("Paradis Æther", 155, 140, "island"),
            ("Observatoire", 366, 152, "tower"), ("Désert Haina", 348, 178, "star"),
            ("Île Noadkoko", 13, 123, "island"), ("Grand Canyon de Poni", 57, 103, "cave"),
            ("Arbre de Combat", 57, 82, "tower"), ("Prairie de Poni", 40, 112, "forest"),
        ],
        "routes": [
            (False, ["Ekaeka", (152, 70), "Lili'i"]),
            (False, ["Ekaeka", "Grotte Verdoyante", "Jardin de Mele-Mele"]),
            (False, ["Ho'ohale", "Ohana", "Colline Clapotis"]),
            (False, ["Ohana", (273, 70), "Parc Volcanique"]),
            (False, [(273, 70), (262, 95), "Konikoni"]),
            (False, ["Malié", "Observatoire"]),
            (False, ["Malié", (348, 168), "Village Toko", "Ligue Pokémon"]),
            (False, ["Village Toko", (308, 175), (306, 150), "Kokohio"]),
            (False, ["Village Flottant", "Prairie de Poni", "Grand Canyon de Poni", "Arbre de Combat"]),
            # Une seule liaison maritime pour le chapelet d'îles.
            (True, ["Ekaeka", (110, 86), (180, 97), "Ho'ohale", (214, 97), (228, 127), (300, 104), (364, 128), "Malié"]),
            (True, [(228, 127), (150, 168), (90, 142), "Village Flottant"]),
            (True, [(180, 97), "Paradis Æther"]),
        ],
    },
    {
        # Unys : carte du jeu (Noir 2 / Blanc 2, 256x168) ; lieux = surlignage de chaque vignette officielle
        # par différence avec la carte de base.
        "name": "Unys", "source": "official", "state": "available", "label": ("UNYS", (360, 600)),
        "map": "officiel:Unova_2.png", "crop": (0, 0, 256, 168), "scale": 3.4,
        "origin": (9450, 1060), "fade": 110, "pre_blur": 1,
        "colors": {
            (62, 151, 193): 0, (37, 127, 173): 0, (27, 95, 156): 0, (97, 183, 214): 0,
            (28, 47, 36): 2.6, (39, 68, 47): 2.0, (47, 85, 57): 1.6, (65, 118, 71): 1.3, (158, 158, 91): 1.2,
            (96, 126, 103): 3.4, (186, 189, 167): 5.2, (57, 88, 91): 1.8, (246, 184, 50): UNKNOWN,
            (0, 131, 65): UNKNOWN, (240, 240, 240): UNKNOWN, (41, 41, 41): UNKNOWN, (173, 140, 66): UNKNOWN,
            (214, 165, 57): UNKNOWN, (255, 189, 49): UNKNOWN,
        },
        "clear_markers": 5,
        "cities": [
            ("Renouet", 231.5, 157.5, False), ("Arabelle", 231.5, 137.5, False), ("Ogoesse", 227.5, 117.5, False),
            ("Maillard", 202.5, 117.5, False), ("Volucité", 131.5, 129.5, True), ("Méanville", 131.5, 90.5, True),
            ("Port Yoneuve", 73.5, 90.5, True), ("Parsemille", 39.5, 66.5, False), ("Flocombe", 73.5, 42.5, False),
            ("Janusia", 131.5, 42.5, True), ("Entrelasque", 189.5, 42.5, False), ("Vaguelone", 223.5, 66.5, False),
            ("Ville Noire", 189.5, 90.5, False), ("Pavonnay", 13.5, 152.5, False), ("Amaillide", 32.5, 127, False),
            ("Ondes-sur-Mer", 68.5, 126.5, False), ("Arpentières", 186.5, 67, False), ("Papeloa", 235, 35.5, False),
            ("Rotombourg", 6.5, 29.5, False), ("Ligue Pokémon", 169.5, 14.5, False),
        ],
        "annex": [
            ("Vestiges du Rêve", 238.5, 117.5, "ruins"), ("Forêt d'Empoigne", 193.5, 124.5, "forest"),
            ("Désert Délassant", 122.5, 103.5, "star"), ("Château Enfoui", 114.5, 103.5, "ruins"),
            ("Grotte Électrolithe", 41.5, 79.5, "cave"), ("Mont Foré", 71.5, 54.5, "cave"),
            ("Tour Dragospire", 65.5, 30.5, "tower"), ("Tour des Cieux", 53.5, 49.5, "tower"),
            ("Grotte Cyclopéenne", 207.5, 35.5, "cave"), ("Autel Abondance", 196.5, 76.5, "ruins"),
            ("Île Liberté", 73.5, 144.5, "island"), ("Route Victoire", 183.5, 15.5, "cave"),
            ("Bois des Illusions", 145.5, 83.5, "forest"), ("Pokéwood", 64, 115, "star"),
            ("Galerie Concorde", 131.5, 103.5, "star"), ("Pokémon World Tournament", 76.5, 102.5, "star"),
            ("Mont Renenvers", 205.5, 66.5, "cave"), ("Manoir de l'Étrange", 197.5, 58.5, "ruins"),
            ("Égouts de Volucité", 155.5, 142.5, "cave"), ("Ruines des Abysses", 241.5, 62.5, "ruins"),
            ("Grotte Littorale", 234.5, 52.5, "cave"), ("Heylink", 131.5, 66.5, "star"),
            ("Veine Souterraine", 214.5, 109.5, "cave"), ("Grotte Parsemille", 63.5, 70.5, "cave"),
            ("Route Bardane", 71.5, 76.5, "cave"), ("Ranch d'Amaillide", 40.5, 117.5, "forest"),
            ("Caverne des Esprits", 40.5, 137.5, "cave"), ("Tourbière Flocombe", 87.5, 35.5, "lake"),
            ("Labo P2", 213.5, 150.5, "plant"), ("Z.I. d'Ondes-sur-Mer", 63.5, 137.5, "plant"),
            ("Tour Union", 98.5, 156.5, "tower"), ("Aquatube", 251.5, 53, "star"),
        ],
        "routes": [
            (False, ["Renouet", "Arabelle", (230, 125), "Ogoesse", "Maillard", "Volucité"]),   # Routes 1-3, Pont Sagiciel
            (True, ["Renouet", (214, 160), (203, 160)]),                                        # Routes 17-18
            (False, ["Volucité", "Galerie Concorde", "Méanville"]),                             # Route 4
            (False, ["Méanville", (119.5, 90.5), (103.5, 88.5), "Port Yoneuve"]),               # Route 5, pont
            (False, ["Méanville", (159.5, 88.5), "Ville Noire"]),                               # Routes 16, 15
            (False, ["Port Yoneuve", "Parsemille", "Flocombe"]),                                # Routes 6-7
            (False, ["Port Yoneuve", "Pokémon World Tournament"]),
            (False, ["Flocombe", (103.5, 40.5), "Janusia", (159.5, 40.5), "Entrelasque"]),     # Routes 8-12
            (False, ["Entrelasque", "Vaguelone", "Ville Noire"]),                               # Routes 13-14
            (False, ["Arpentières", "Mont Renenvers", "Vaguelone"]),
            (True, ["Vaguelone", (232, 59), "Papeloa"]),                                        # Baie, Route 21
            (False, ["Papeloa", "Grotte Cyclopéenne", (195.5, 35.5), (195.5, 15.5), "Route Victoire",
                     "Ligue Pokémon"]),                                                         # Routes 22-23
            (False, ["Pavonnay", (13.5, 132), "Amaillide", "Ondes-sur-Mer"]),                   # Routes 19-20
            (True, ["Ondes-sur-Mer", (100, 140), "Volucité"]),
        ],
    },
]

# Un point de liaison : ("city", région, nom), ("native", région, x, y) ou ("corner", i, j) = x du point i,
# y du point j de la même liaison ; un 4e/5e élément optionnel (dx, dy) décale le point dans le monde.
# "bend" : pour une liaison maritime à deux points, flèche de la courbe (pixels du monde, signe = côté).
LINKS = [
    # Johto -> Kanto par la terre : Route 27 (est), Chutes Tohjo, Route 26 (nord), Plateau Indigo.
    {"water": False, "points": [("city", "Johto", "Bourg Geon"), ("corner", 3, 0, -40, 0),
                                ("corner", 3, 3, -40, 0), ("city", "Kanto", "Plateau Indigo", -20, 10)]},
    # Kanto -> Mont Argenté : Route 22 puis Route 28, vers l'ouest.
    {"water": False, "points": [("native", "Kanto", 51.25, 99.5), ("corner", 2, 0),
                                ("native", "Johto", 148, 68, 18, 0)]},
    # Kanto -> Îles Sevii par la mer (bateau de Cramois'Île), puis le chapelet des îles : une seule liaison.
    {"water": True, "points": [("city", "Kanto", "Cramois'Île"), ("city", "Sevii 123", "Île 1"),
                               ("city", "Sevii 123", "Île 2"), ("city", "Sevii 123", "Île 3"),
                               ("city", "Sevii 45", "Île 4"), ("city", "Sevii 45", "Île 5"),
                               ("city", "Sevii 67", "Île 6"), ("city", "Sevii 67", "Île 7")]},
    # Johto -> Hoenn par la mer : Irisia -> Nénucrique.
    {"water": True, "bend": -120, "points": [("city", "Johto", "Irisia"), ("city", "Hoenn", "Nénucrique")]},
    # Kanto -> Septentria -> Sinnoh : du bout de la Route 25 vers la Route de Septentria, puis vers Rivamar.
    {"water": True, "bend": 60, "points": [("native", "Kanto", 163.25, 43.5), ("native", "Septentria", 1649, 2950)]},
    {"water": True, "bend": -60, "points": [("native", "Septentria", 2572, 400), ("city", "Sinnoh", "Rivamar")]},
    # Europe : Galar -> Kalos (Skifford -> Port Tempères), Kalos -> Paldea (Roche-sur-Gliffe -> côte nord).
    {"water": True, "bend": -90, "points": [("city", "Galar", "Skifford"), ("city", "Kalos", "Port Tempères")]},
    {"water": True, "bend": 40, "points": [("city", "Kalos", "Roche-sur-Gliffe"), ("native", "Paldea", 1317, 420)]},
]

DEMO_AVAILABLE = {"Kanto", "Johto", "Hoenn", "Sinnoh"}

# ======================================================================
# Outils communs
# ======================================================================
def fill_unknown(height):
    """Bouche les pixels inconnus (routes, icônes) avec la moyenne des voisins connus."""
    h, w = height.shape
    for _ in range(80):
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


def height_from_nearest(pixels, table):
    """Hauteur de la couleur de référence la plus proche (cartes officielles, couleurs lissées)."""
    colors = np.array(list(table.keys()), dtype=np.float32)
    values = np.array(list(table.values()), dtype=np.float32)
    flat = pixels.reshape(-1, 3).astype(np.float32)
    best = np.zeros(len(flat), dtype=np.int32)
    best_distance = np.full(len(flat), np.inf, dtype=np.float32)
    for k, color in enumerate(colors):
        distance = ((flat - color) ** 2).sum(-1)
        closer = distance < best_distance
        best[closer], best_distance[closer] = k, distance[closer]
    return values[best].reshape(pixels.shape[:2]), best.reshape(pixels.shape[:2])


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
                        (("RUINS", "CHAMBER", "TOMB", "SLAB", "MANSION"), "ruins"),
                        (("LAKE",), "lake"),
                        (("ISLAND", "NAVEL", "SHIP"), "island"),
                        (("CAVE", "TUNNEL", "MT_", "ROAD", "HOLE", "FALLS", "CAVERN", "PATH", "DEN"), "cave")):
        if any(key in section for key in keys):
            return style
    return "star"


def grid_links(grid, kind_of, center, water=frozenset()):
    """Liens entre cases voisines de la grille (routes et villes).

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
    """Une région : relief (posé dans le monde), transformation native -> monde, éléments en natif."""

    def __init__(self, spec, height):
        self.spec = spec
        self.name = spec["name"]
        x0, y0, x1, y1 = self.crop = spec["crop"]
        # Le relief peut être lu à une résolution de travail différente de la carte native.
        self.field_scale = height.shape[1] / (x1 - x0) if spec.get("field_is_cropped") else 1.0
        if spec.get("field_is_cropped"):
            field = height.astype(np.float32)
        else:
            field = height[y0:y1, x0:x1].astype(np.float32)
        if spec.get("pre_blur"):
            field = box_blur(field, spec["pre_blur"])
        self.field = field
        self.scale = spec["scale"]
        self.world_origin = spec["origin"]
        self.cities = []        # (x, y, nom, grande)
        self.steps = []         # (x, y, eau)
        self.links = []         # ((x, y), (x, y), eau)
        self.sea_paths = []     # [(x, y), ...] : liaisons maritimes tracées d'un seul trait
        self.road_paths = []    # [(x, y), ...] : routes tracées à la main
        self.dungeons = []      # (x, y, style, nom)

    def world(self, x, y):
        return ((x - self.crop[0]) * self.scale + self.world_origin[0],
                (y - self.crop[1]) * self.scale + self.world_origin[1])

    def height_at(self, x, y):
        fx = min(max(int((x - self.crop[0]) * self.field_scale), 0), self.field.shape[1] - 1)
        fy = min(max(int((y - self.crop[1]) * self.field_scale), 0), self.field.shape[0] - 1)
        return self.field[fy, fx]

    def world_field(self):
        """Relief à la résolution du monde, bord fondu dans la mer (largeur "fade" en pixels du monde)."""
        x0, y0, x1, y1 = self.crop
        out_w, out_h = int(round((x1 - x0) * self.scale)), int(round((y1 - y0) * self.scale))
        big = np.array(Image.fromarray(self.field, mode="F").resize((out_w, out_h), Image.BICUBIC))
        fade = self.spec.get("fade", 0)
        if fade:
            yy, xx = np.indices(big.shape)
            border = np.minimum.reduce([xx, yy, out_w - 1 - xx, out_h - 1 - yy]).astype(np.float32)
            if self.spec.get("round"):   # bord en ellipse (Septentria) plutôt qu'en rectangle
                ellipse = np.sqrt(((xx - out_w / 2) / (out_w / 2)) ** 2 + ((yy - out_h / 2) / (out_h / 2)) ** 2)
                border = np.minimum(border, (1 - ellipse) * min(out_w, out_h) / 2)
            seed = zlib.crc32(self.name.encode())
            wobble = (value_noise(out_w, out_h, 45, seed) - 0.5) * 1.2 + (value_noise(out_w, out_h, 14, seed + 1) - 0.5) * 0.5
            big = big * np.clip((border + wobble * fade * 1.4) / fade, 0, 1)
        return big

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
    names = spec.get("annex_names", {})
    center = lambda col, row: (35.25 + 8 * col, 35.5 + 8 * row)  # noqa: E731

    def kind(section):
        if section == "NONE" or section in annex:
            return None
        return "city" if section in cities else "route"
    water, seen, seen_annex = set(), set(), set()
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
            elif section in annex and section not in seen_annex:
                seen_annex.add(section)
                region.dungeons.append((x, y, style_of(section), names.get(section, "")))
    region.links = grid_links(grid, kind, center, water)
    for row in range(len(dungeon_grid)):
        for col in range(len(dungeon_grid[row])):
            section = dungeon_grid[row][col]
            if section != "NONE" and section not in seen_annex:
                seen_annex.add(section)
                region.dungeons.append((*center(col, row), style_of(section), names.get(section, "")))
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
        return "route" if section.startswith("ROUTE_") and section not in water_sections else None
    cells = {}
    for row in range(len(grid)):
        for col in range(len(grid[row])):
            cells.setdefault(grid[row][col], []).append(center(col, row))
            if kind(grid[row][col]) == "route":
                region.steps.append((*center(col, row), False))
    city_at = {}
    for section in cities:
        if section in cells:
            points = cells[section]
            city_at[section] = (sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points))
            region.cities.append((*city_at[section], cities[section], section in big))
    region.links = grid_links(grid, kind, center)
    # Routes maritimes : une étape au centre de chaque route, reliées en chapelets.
    for chain in spec.get("sea_paths", []):
        points = [None] * len(chain)
        for k, section in enumerate(chain):
            if section in city_at:
                points[k] = city_at[section]
            elif section in water_sections:
                group = cells[section]
                points[k] = (sum(p[0] for p in group) / len(group), sum(p[1] for p in group) / len(group))
        for k, section in enumerate(chain):   # route terrestre : sa case la plus proche du voisin
            if points[k] is None:
                neighbour = points[k + 1] if k + 1 < len(chain) and points[k + 1] else points[k - 1]
                points[k] = min(cells[section], key=lambda p: math.dist(p, neighbour))
        region.sea_paths.append(points)
        region.steps += [(*p, True) for p, section in zip(points, chain) if section in water_sections]
    for section in json.load(open(path(spec["sections"])))["map_sections"]:
        short = section["id"].replace("MAPSEC_", "")
        if short in spec.get("annex", {}):
            cx = section["x"] + (section["width"] - 1) / 2
            cy = section["y"] + (section["height"] - 1) / 2
            region.dungeons.append((*center(cx, cy), style_of(short), spec["annex"][short]))
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
    center = lambda tx, ty: (8 * tx + 4, 8 * ty + 4)  # noqa: E731
    city_tiles = set()
    for key, label in spec["cities"].items():
        x, y = landmark[key]
        region.cities.append((x, y, label, key in spec.get("big", [])))
        city_tiles.add((x // 8, y // 8))
    for key, (style, label) in spec.get("annex", {}).items():
        region.dungeons.append((*landmark[key], style, label))
    walkable = road_tiles | city_tiles
    region.steps += [(*center(*tile), False) for tile in road_tiles - city_tiles]
    for tx, ty in walkable:
        for dx, dy in ((1, 0), (0, 1)):
            if (tx + dx, ty + dy) in walkable:
                region.links.append((center(tx, ty), center(tx + dx, ty + dy), False))
    for chain in spec.get("sea_chains", []):
        region.steps += [(*center(*tile), True) for tile in chain[1:-1]]
        region.sea_paths.append([center(*tile) for tile in chain])
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
    for cell, style, label in spec.get("annex", []):
        region.dungeons.append((*center(*cell), style, label))
    lakes = np.isin(roads, (3, 4))   # les lacs sont dessinés sur la couche routes
    lakes[:, :x0] = False
    seen = np.zeros_like(lakes)
    found = []
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
            found.append((np.mean([m[1] for m in members]), np.mean([m[0] for m in members])))
    names = spec.get("lake_names", {})
    if found:
        north = min(found, key=lambda p: p[1])
        rest = sorted([p for p in found if p is not north], key=lambda p: p[0])
        labels = [(north, names.get("north", ""))] + [(p, names.get("west" if k == 0 else "east", ""))
                                                       for k, p in enumerate(rest)]
        for (x, y), label in labels:
            region.dungeons.append((x, y, "lake", label))
    return region


def load_official(spec):
    """Carte officielle (illustration ou carte du jeu) : relief par couleur la plus proche, lieux en données."""
    image = Image.open(path(spec["map"])).convert("RGB").crop(spec["crop"])
    work = spec.get("work")
    if work and max(image.size) > work:
        factor = work / max(image.size)
        image = image.resize((round(image.width * factor), round(image.height * factor)), Image.BOX)
    pixels = np.array(image)
    height, _ = height_from_nearest(pixels, spec["colors"])
    x0, y0, x1, y1 = spec["crop"]
    field_scale = pixels.shape[1] / (x1 - x0)
    yy, xx = np.indices(height.shape)
    native_x, native_y = xx / field_scale + x0, yy / field_scale + y0
    for (bx0, by0, bx1, by1), table in spec.get("zone_colors", []):
        inside = (native_x >= bx0) & (native_x < bx1) & (native_y >= by0) & (native_y < by1)
        for color, value in table.items():
            match = np.abs(pixels.astype(int) - color).sum(-1) < 40
            height[inside & match] = value
    radius = spec.get("clear_markers")
    if radius:   # pastilles de la carte source (villes, lieux) : effacées puis rebouchées par les voisins
        for _, x, y, *_ in spec.get("cities", []) + spec.get("annex", []):
            height[(native_x - x) ** 2 + (native_y - y) ** 2 <= radius * radius] = UNKNOWN
    for (bx0, by0, bx1, by1), value in spec.get("zone_water", []):   # eau qui n'en est pas (cratère)
        inside = (native_x >= bx0) & (native_x < bx1) & (native_y >= by0) & (native_y < by1)
        height[inside & (height <= 0)] = value
    height = fill_unknown(height.astype(np.float64))
    spec = dict(spec, field_is_cropped=True)
    region = Region(spec, height)
    if spec.get("snow_colors"):
        snow = np.zeros(height.shape, dtype=np.float32)
        for color in spec["snow_colors"]:
            snow = np.maximum(snow, (np.abs(pixels.astype(int) - color).sum(-1) < 40).astype(np.float32))
        if "snow_rows" in spec:
            snow[(native_y < spec["snow_rows"][0]) | (native_y >= spec["snow_rows"][1])] = 0
        region.snow_field = box_blur(snow, 4, radius=2)
    for name, x, y, big in spec.get("cities", []):
        region.cities.append((x, y, name, big))
    for name, x, y, style in spec.get("annex", []):
        region.dungeons.append((x, y, style, name))
    places = {name: (x, y) for name, x, y, _ in spec.get("cities", [])}
    places.update({name: (x, y) for name, x, y, _ in spec.get("annex", [])})
    for is_water, nodes in spec.get("routes", []):
        points = [places[node] if isinstance(node, str) else node for node in nodes]
        (region.sea_paths if is_water else region.road_paths).append(points)
    return region


LOADERS = {"firered": load_firered, "emerald": load_emerald, "crystal": load_crystal, "platinum": load_platinum,
           "official": load_official}
regions = [LOADERS[spec["source"]](spec) for spec in REGIONS]
by_name = {region.name: region for region in regions}
print("régions chargées", flush=True)

# ======================================================================
# Relief du monde : chaque région posée sur la mer commune, propriétaire de chaque pixel
# ======================================================================
W, Hpx = WORLD_W, WORLD_H
world_height = np.zeros((Hpx, W), dtype=np.float32)
owner = np.full((Hpx, W), -1, dtype=np.int16)
snow_world = np.zeros((Hpx, W), dtype=np.float32)
for index, region in enumerate(regions):
    big = region.world_field()
    x, y = int(round(region.world_origin[0])), int(round(region.world_origin[1]))
    target = world_height[y:y + big.shape[0], x:x + big.shape[1]]
    big = big[:target.shape[0], :target.shape[1]]
    claim = (big > target) & (big > 0.05)
    target[claim] = big[claim]
    owner[y:y + big.shape[0], x:x + big.shape[1]][claim] = index
    region.box = (x, y, x + big.shape[1], y + big.shape[0])
    if hasattr(region, "snow_field"):
        snow = np.array(Image.fromarray(region.snow_field, mode="F").resize((big.shape[1], big.shape[0]), Image.BILINEAR))
        np.maximum(snow_world[y:y + big.shape[0], x:x + big.shape[1]], snow, out=snow_world[y:y + big.shape[0], x:x + big.shape[1]])

# ======================================================================
# Continents réels (Natural Earth 1:50m, domaine public), déformés autour des régions
# ======================================================================
# Déformation par colonnes : x ne dépend que de la longitude (fonction croissante, par morceaux), y dépend de la
# latitude par une table propre à chaque colonne de longitude, interpolée entre colonnes. Chaque colonne est
# croissante en latitude, donc la carte ne se replie jamais. Les tables font tomber le lieu réel de chaque région
# sur son dessin : Royaume-Uni -> Galar, France -> Kalos, péninsule Ibérique -> Paldea, Kyushu -> Hoenn,
# Kansai -> Johto, Kanto -> Kanto, Tohoku -> Septentria, Hokkaido -> Sinnoh, Hawaï -> Alola, New York -> Unys.
# Distances compressées : l'Eurasie tient en ~2 700 pixels, le Pacifique en ~1 600, l'Amérique du Nord en ~2 300.
# Les pays que les régions remplacent sont retirés ; ailleurs la terre réelle s'arrête au bord du cadre des régions.
X_ANCHORS = [(-40, -1500), (-10.5, 120), (-9.3, 190), (-6, 400), (-4.8, 475), (1.8, 900), (3.3, 1000), (8.2, 1368),
             (15, 1600), (20, 1720), (30, 1880), (40, 2020), (60, 2280), (80, 2520), (100, 2760), (110, 2880),
             (120, 3020), (125, 3220), (129.5, 3550), (132, 4350), (134, 4650), (136.5, 4950), (138.5, 5200),
             (139.5, 5450), (140.5, 5800), (142, 6150), (145.8, 6380), (150, 6520), (160, 6700), (199.7, 6900),
             (205.2, 8085), (236, 8350), (245, 8630), (255, 8880), (265, 9120), (275, 9300), (280, 9380),
             (284, 9450), (288.5, 10320), (292, 10450), (300, 10650), (330, 11900)]
_EU = [(90, -3000), (72, -1400), (66, -800), (60, -150), (58.7, 50), (50.4, 1233), (50.0, 1290), (43.0, 1830),
       (42.8, 1950), (36, 2844), (33, 3080), (30, 3260), (0, 6000)]
_T40 = [(90, -2500), (75, -900), (60, 0), (55, 400), (45, 1300), (40, 1900), (35, 2500), (30, 3000), (20, 3800), (0, 6000)]
_T100 = [(90, -2500), (75, -800), (60, -50), (50, 650), (40, 1450), (30, 2350), (25, 2850), (20, 3300), (0, 6000)]
_KR = [(90, -2500), (60, -400), (50, 250), (43, 800), (38.6, 1400), (34.5, 2150), (31, 2700), (25, 3300), (0, 6000)]
_JPW = [(90, -2500), (55, -450), (46, 0), (43, 650), (36.6, 1516), (33.5, 2156), (33.2, 2380), (30.5, 3140), (28, 3500),
        (0, 6000)]
_JPE = [(90, -2500), (52, -400), (45.5, 40), (41.4, 860), (41.2, 1010), (38.5, 1420), (37, 1480), (34.9, 2200),
        (30, 3000), (0, 6000)]
_T160 = [(90, -2500), (60, -600), (52, -100), (45, 500), (30, 1800), (20, 2800), (0, 5000)]
_HI = [(90, -2500), (60, -800), (52, -300), (40, 1000), (30, 1800), (22.3, 2480), (18.9, 3098), (15, 3500), (0, 5000)]
_NAW = [(90, -2500), (70, -1200), (60, -500), (49, 400), (40, 1300), (32, 2000), (25, 2600), (15, 3500), (0, 5000)]
_UNY = [(90, -2500), (60, -600), (50, 300), (45, 700), (42.8, 1060), (40.4, 1631), (38, 1900), (30, 2700), (25, 3150),
        (18, 3800), (0, 5000)]
COLUMNS = [(-40, _EU), (10, _EU), (40, _T40), (100, _T100), (125, _KR), (129.5, _JPW), (133.5, _JPW), (138.3, _JPE),
           (145.8, _JPE), (160, _T160), (199.7, _HI), (205.2, _HI), (236, _NAW), (284, _UNY), (330, _UNY)]
# Pays remplacés par une région (ou hors champ et coupés par le méridien de raccord).
DROPPED_COUNTRIES = {"Japan", "United Kingdom", "France", "Spain", "Portugal", "Andorra", "Gibraltar", "Isle of Man",
                     "Jersey", "Guernsey", "Monaco", "Greenland", "Antarctica"}
_XL = np.array([a for a, _ in X_ANCHORS], float)
_XX = np.array([b for _, b in X_ANCHORS], float)
_CL = np.array([c for c, _ in COLUMNS], float)
_TABLES = [(np.array([a for a, _ in t][::-1], float), np.array([b for _, b in t][::-1], float)) for _, t in COLUMNS]


def unwrap(lon):
    return np.where(lon < -40, lon + 360, lon)


def warp(lon, lat):
    """(longitude, latitude) en degrés -> (x, y) du monde."""
    lon, lat = unwrap(np.asarray(lon, float)), np.asarray(lat, float)
    x = np.interp(lon, _XL, _XX)
    k = np.clip(np.searchsorted(_CL, lon) - 1, 0, len(_CL) - 2)
    t = np.clip((lon - _CL[k]) / (_CL[k + 1] - _CL[k]), 0, 1)
    y = np.zeros_like(lon)
    for index, (lats, ys) in enumerate(_TABLES):
        column = np.interp(lat, lats, ys)
        y += np.where(k == index, column * (1 - t), 0) + np.where(k + 1 == index, column * t, 0)
    return np.c_[x, y]


def rings(feature):
    geometry = feature["geometry"]
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    for polygon in polygons:
        ring = np.array(polygon[0], float)
        lon = unwrap(ring[:, 0])
        if lon.max() - lon.min() > 200:
            continue
        yield ring


def rasterize(features, value=255, image=None, keep=lambda feature, ring: True):
    image = image or Image.new("L", (W, Hpx), 0)
    draw = ImageDraw.Draw(image)
    for feature in features:
        for ring in rings(feature):
            if not keep(feature, ring):
                continue
            points = warp(ring[:, 0], ring[:, 1])
            if points[:, 0].max() < -50 or points[:, 0].min() > W + 50 or points[:, 1].max() < -50 or points[:, 1].min() > Hpx + 50:
                continue
            draw.polygon([tuple(p) for p in points], fill=value)
    return image


def natural_earth(name):
    return json.load(open(f"{ROOTS['v06']}/natural-earth/{name}.geojson"))["features"]


def not_hawaii(feature, ring):
    return not (feature["properties"]["ADMIN"] == "United States of America" and ring[:, 0].max() < -150
                and ring[:, 1].max() < 25)


countries = [f for f in natural_earth("ne_50m_admin_0_countries") if f["properties"]["ADMIN"] not in DROPPED_COUNTRIES]
real_image = rasterize(countries, keep=not_hawaii)
big_lakes = [f for f in natural_earth("ne_50m_lakes") if (f["properties"].get("scalerank") or 9) <= 3]
rasterize(big_lakes, 0, real_image)
geography = natural_earth("ne_50m_geography_regions_polys")
classes = lambda *names: [f for f in geography if f["properties"]["FEATURECLA"] in names]  # noqa: E731
real_land = np.array(real_image) > 0
del real_image


def soft(mask_image, factor, radius):
    """Masque adouci : calculé en petit (facteur), flou gaussien, remis à la taille du monde, 0..1."""
    small = mask_image.resize((W // factor, Hpx // factor), Image.BOX).filter(ImageFilter.GaussianBlur(radius))
    return np.array(small.resize((W, Hpx), Image.BILINEAR), dtype=np.float32) / 255


inland = soft(Image.fromarray((real_land * 255).astype(np.uint8)), 8, 4)
# Hautes chaînes (roche et neige) ; les autres chaînes restent des collines.
HIGH_RANGES = {"ALPS", "PYRENEES", "CAUCASUS MTS.", "HIMALAYAS", "KARAKORAM RA.", "PAMIRS", "HINDU KUSH", "TIAN SHAN",
               "KUNLUN MOUNTAINS", "ROCKY MOUNTAINS", "ALASKA RANGE", "SIERRA NEVADA", "CASCADE RANGE",
               "COAST MOUNTAINS", "HAUT ATLAS", "ATLAS MOUNTAINS", "ALTAY MOUNTAINS", "ZAGROS MOUNTAINS",
               "ELBURZ MTS.", "SIKHOTE-ALIN’ RANGE", "Hamgyong Mts.", "KJØLEN MOUNTAINS", "Dinaric Alps",
               "CARPATHIAN MOUNTAINS", "APPENNINI", "Balkan Mts.", "Cord. Cantábrica", "SIERRA MADRE OCCIDENTAL",
               "SIERRA MADRE ORIENTAL", "CHUGACH MTS.", "SELWYN MTS.", "MACKENZIE MTS."}
mountain_features = classes("Range/mtn")
ranges = soft(rasterize([f for f in mountain_features if f["properties"]["NAME"] in HIGH_RANGES]), 4, 3)
low_ranges = soft(rasterize([f for f in mountain_features if f["properties"]["NAME"] not in HIGH_RANGES]), 4, 3)
plateaus = soft(rasterize(classes("Plateau")), 8, 3)
desert = soft(rasterize(classes("Desert")), 8, 2) > 0.45
hills = value_noise(W, Hpx, 90, 21)
real_height = real_land * (1.05 + 1.1 * np.clip((inland - 0.5) * 2, 0, 1) + 0.9 * (hills - 0.5)
                           + 1.2 * plateaus + 4.8 * np.clip(ranges * 1.4, 0, 1) ** 1.6
                           + 1.6 * np.clip(low_ranges * 1.4, 0, 1))
range_field = np.where(real_land, ranges, 0).astype(np.float32)
del inland, plateaus, hills, ranges, low_ranges

# Dans le cadre d'une région, la terre réelle ne s'avance que sur la bande de fondu du bord (raccord sans couture).
for region in regions:
    x0, y0, x1, y1 = region.box
    band = max(region.spec.get("fade", 0), 40)
    yy_, xx_ = np.mgrid[y0:y1, x0:x1]
    inside = np.minimum.reduce([xx_ - x0, yy_ - y0, x1 - 1 - xx_, y1 - 1 - yy_]).astype(np.float32)
    wobble = (value_noise(x1 - x0, y1 - y0, 40, zlib.crc32(region.name.encode()) + 9) - 0.5) * band
    real_height[y0:y1, x0:x1] *= np.clip(1 - (inside + wobble) / band, 0, 1)
    # Autour du cadre (160 px), la terre réelle reste basse : pas de chaîne collée au bord d'une région.
    gx0, gy0, gx1, gy1 = max(0, x0 - 160), max(0, y0 - 160), min(W, x1 + 160), min(Hpx, y1 + 160)
    yy_, xx_ = np.mgrid[gy0:gy1, gx0:gx1]
    outside = np.maximum.reduce([x0 - xx_, xx_ - (x1 - 1), y0 - yy_, yy_ - (y1 - 1), np.zeros_like(xx_)]).astype(np.float32)
    outside += (value_noise(gx1 - gx0, gy1 - gy0, 60, zlib.crc32(region.name.encode()) + 5) - 0.5) * 140
    ceiling = 1.9 + np.clip(outside / 160, 0, 1) * 8 + (value_noise(gx1 - gx0, gy1 - gy0, 23, 77) - 0.5) * 1.2
    patch = real_height[gy0:gy1, gx0:gx1]
    np.minimum(patch, ceiling, out=patch)
CONTINENTS = len(regions)   # propriétaire de la terre réelle
claim = (real_height > world_height) & (real_height > 0.05)
world_height[claim] = real_height[claim]
owner[claim] = CONTINENTS
del real_height, claim

# Latitude de chaque pixel du monde (inverse exacte de la déformation, colonne par colonne) : climat du décor.
column_lon = np.interp(np.arange(W), _XX, _XL)
lat_grid = np.linspace(-10, 89, 397)
lat_field = np.zeros((Hpx, W), dtype=np.float32)
grid_y = warp(np.repeat(column_lon, len(lat_grid)), np.tile(lat_grid, W))[:, 1].reshape(W, len(lat_grid))
for column in range(W):
    lat_field[:, column] = np.interp(np.arange(Hpx), grid_y[column][::-1], lat_grid[::-1])
del grid_y
print("continents posés", flush=True)

noise = (value_noise(W, Hpx, 18, 1) - 0.5) * 0.9 + (value_noise(W, Hpx, 6, 2) - 0.5) * 0.35
H = box_blur(world_height, 6, radius=2)
H = H + noise * np.clip(H, 0.2, 1.0) * np.clip(1.6 - H, 0, 1) + noise * 0.3 * (H > 1.2)
land = H > 0.55
del world_height


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
land_distance = distance_to(~land, 8)

# Propriétaire : la terre garde la région qui l'a posée ; la mer proche (30 px) prend la terre la plus proche.
owner[~land] = -1
for _ in range(36):
    unassigned = owner < 0
    if not (unassigned & (water_distance <= 30)).any():
        break
    grown = owner.copy()
    for shifted in (np.roll(owner, 1, 0), np.roll(owner, -1, 0), np.roll(owner, 1, 1), np.roll(owner, -1, 1)):
        take = (grown < 0) & (shifted >= 0)
        grown[take] = shifted[take]
    owner = np.where(unassigned & ((water_distance <= 30) | land), grown, owner)
print("relief posé", flush=True)

PALETTE = {
    "abyss": (32, 80, 168), "deep": (40, 96, 184), "sea": (56, 128, 216), "shallow": (96, 168, 232),
    "shoal": (136, 200, 240), "foam": (232, 248, 255), "surf": (200, 232, 252),
    "sand": (240, 224, 160), "sand_dark": (216, 192, 128),
    "grass": [(72, 168, 56), (96, 192, 64), (128, 208, 72), (160, 224, 96), (192, 236, 128)],
    "grass_shadow": [(48, 128, 48), (64, 152, 56), (96, 176, 64), (128, 192, 80), (160, 208, 104)],
    "snowy": [(200, 216, 232), (216, 228, 240), (228, 236, 246), (238, 242, 250), (246, 248, 252)],
    "snowy_shadow": [(168, 184, 208), (184, 200, 220), (200, 212, 228), (212, 222, 236), (224, 230, 242)],
    "desert": [(224, 196, 128), (232, 208, 144), (236, 216, 156), (240, 224, 168), (244, 232, 184)],
    "desert_shadow": [(192, 160, 104), (208, 176, 120), (216, 188, 132), (224, 200, 144), (232, 212, 160)],
    "rock": (152, 144, 136), "rock_shadow": (112, 104, 100), "snow": (240, 244, 252),
    "road": (224, 184, 112), "road_edge": (152, 104, 56), "path": (232, 208, 152), "path_edge": (168, 128, 80),
}
yy, xx = np.indices((Hpx, W), dtype=np.int32)
rng = np.random.default_rng(17)
checker = ((xx + yy) % 2) == 0

# ---------------------------------------------------------------- eau (calque à part)
# Esprit GBA : bandes de profondeur qui suivent la côte (bord bruité, transition en damier), écume blanche au
# contact, ressac en pointillé, vaguelettes « ~ » semées au hasard (jamais une tuile répétée), reflets rares.
deep_distance = distance_to(land, 70)
wobble = (value_noise(W, Hpx, 26, 31) - 0.5) * 7 + (value_noise(W, Hpx, 9, 32) - 0.5) * 2
wd = deep_distance + wobble
water = np.zeros((Hpx, W, 3), dtype=np.uint8)
water[:] = PALETTE["abyss"]
band_index = np.zeros((Hpx, W), dtype=np.int8)
for index, (limit, color) in enumerate(((62, "deep"), (28, "sea"), (10, "shallow"), (4, "shoal")), start=1):
    inside = wd <= limit
    edge = (wd > limit) & (wd <= limit + 2.2) & checker
    water[inside | edge] = PALETTE[color]
    band_index[inside | edge] = index
del wd, wobble
water[(deep_distance == 4) & (value_noise(W, Hpx, 5, 33) > 0.42)] = PALETTE["surf"]
water[deep_distance == 1] = PALETTE["foam"]
water[(deep_distance == 2) & checker] = PALETTE["foam"]
wave_colors = np.array([(72, 128, 216), (80, 144, 224), (104, 168, 240), (152, 208, 248), (184, 228, 252),
                        (200, 236, 252)], dtype=np.uint8)
cell_w, cell_h = 22, 13
cy, cx = np.mgrid[0:Hpx:cell_h, 0:W:cell_w]
keep = rng.random(cy.shape) < 0.6
cy = (cy + rng.integers(0, cell_h - 2, cy.shape))[keep]
cx = (cx + rng.integers(0, cell_w - 6, cx.shape))[keep]
for dy, dx in ((1, 0), (0, 1), (0, 2), (1, 3), (1, 4), (0, 5)):   # « ~ »
    py, px = np.clip(cy + dy, 0, Hpx - 1), np.clip(cx + dx, 0, W - 1)
    ok = (deep_distance[py, px] > 5) & ~land[py, px]
    water[py[ok], px[ok]] = wave_colors[band_index[py[ok], px[ok]]]
sparkle = (~land) & (deep_distance > 6) & (deep_distance < 30) & (rng.random((Hpx, W)) < 0.0015)
water[sparkle] = (248, 252, 255)
del band_index, sparkle, cy, cx, keep

# ---------------------------------------------------------------- terre (régions et continents réels)
out = np.zeros((Hpx, W, 3), dtype=np.uint8)
gy, gx = np.gradient(H)
facing_light = (gx + gy) < -0.01
in_shadow = (gx + gy) > 0.02
del gx, gy

# Zones enneigées : boîte native ("snow"), couleurs de neige de la carte officielle ("snow_colors"), et sur les
# continents le grand nord (au-delà de 60° en Europe, de 54° ailleurs).
snowy_zone = snow_world > 0.5
snow_noise = (value_noise(W, Hpx, 70, 5) - 0.5) * 170
for region in regions:
    if "snow" in region.spec:
        sx0, sy0, sx1, sy1 = region.spec["snow"]
        (wx0, wy0), (wx1, wy1) = region.world(sx0, sy0), region.world(sx1, sy1)
        snowy_zone |= (xx > wx0 + snow_noise) & (xx < wx1 + snow_noise) & (yy > wy0) & (yy < wy1 + snow_noise)
continental = owner == CONTINENTS
cold_line = np.where(column_lon[None, :] < 30, 60.0, 54.0) + snow_noise / 60
snowy_zone |= continental & (lat_field > cold_line)
desert_zone = continental & desert & ~snowy_zone
del snow_world, snow_noise, cold_line, desert

levels = np.clip(np.floor(H - 0.55).astype(int), 0, 4)
for level in range(5):
    band = land & (levels == level) & (H < 5.6)
    for zone, light, dark in ((~snowy_zone & ~desert_zone, "grass", "grass_shadow"),
                              (snowy_zone, "snowy", "snowy_shadow"), (desert_zone, "desert", "desert_shadow")):
        part = band & zone
        out[part] = PALETTE[light][level]
        out[part & in_shadow] = PALETTE[dark][level]
        out[part & facing_light & (level < 4)] = PALETTE[light][min(level + 1, 4)]
edge = np.zeros_like(land)
edge[1:, :] |= levels[1:, :] != levels[:-1, :]
edge[:, 1:] |= levels[:, 1:] != levels[:, :-1]
out[land & edge & (H < 5.6) & ~snowy_zone & ~desert_zone] = [tuple(int(c * 0.82) for c in PALETTE["grass_shadow"][0])]
out[land & edge & (H < 5.6) & snowy_zone] = PALETTE["snowy_shadow"][0]
out[land & edge & (H < 5.6) & desert_zone] = PALETTE["desert_shadow"][0]
rock = land & (H >= 5.6)
out[rock] = PALETTE["rock"]
out[rock & in_shadow] = PALETTE["rock_shadow"]
peak = land & (H >= 6.15)
out[peak] = PALETTE["snow"]
beach = land & (land_distance <= 3) & (H < 2.2) & ~snowy_zone
out[beach] = PALETTE["sand"]
out[beach & (land_distance == 1)] = PALETTE["sand_dark"]

# Neige texturée : congères « ‿ » bleutées et éclats blancs semés au hasard, ombre en damier au pied des pentes.
snow_cover = land & (snowy_zone | peak) & ~beach
seed = snow_cover & (rng.random((Hpx, W)) < 0.018)
sy_, sx_ = np.nonzero(seed)
for dy, dx, color in ((0, 0, (168, 188, 216)), (1, 1, (168, 188, 216)), (1, 2, (168, 188, 216)), (0, 3, (168, 188, 216)),
                      (-1, 1, (255, 255, 255)), (-1, 2, (255, 255, 255))):
    py, px = np.clip(sy_ + dy, 0, Hpx - 1), np.clip(sx_ + dx, 0, W - 1)
    ok = snow_cover[py, px]
    out[py[ok], px[ok]] = color
out[snow_cover & in_shadow & checker] = PALETTE["snowy_shadow"][1]
out[snow_cover & (rng.random((Hpx, W)) < 0.004)] = (255, 255, 255)
# Désert : grains sombres épars.
out[desert_zone & ~rock & (rng.random((Hpx, W)) < 0.02)] = PALETTE["desert_shadow"][1]
del levels, edge, facing_light, in_shadow, beach, seed, sy_, sx_, snow_cover
print("terrain colorié", flush=True)

# ======================================================================
# Géométrie de tous les éléments, en coordonnées du monde, par région
# ======================================================================
def catmull_rom(points, samples=10):
    """Courbe lisse passant par les points (liaisons maritimes)."""
    if len(points) < 3:
        return list(points)
    padded = [points[0]] + list(points) + [points[-1]]
    curve = []
    for k in range(1, len(padded) - 2):
        p0, p1, p2, p3 = padded[k - 1], padded[k], padded[k + 1], padded[k + 2]
        for s in range(samples):
            t = s / samples
            curve.append(tuple(0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t
                                      + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t ** 3) for i in range(2)))
    curve.append(points[-1])
    return curve


def bent(a, b, bend):
    """Arc de cercle approché (courbe de Bézier quadratique) entre deux points, flèche « bend »."""
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    length = math.dist(a, b) or 1
    cx, cy = mx - (b[1] - a[1]) / length * bend, my + (b[0] - a[0]) / length * bend
    return [((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * cx + t * t * b[0],
             (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * cy + t * t * b[1]) for t in (k / 24 for k in range(25))]


def resample(curve, spacing):
    """Points régulièrement espacés le long d'une polyligne (hors extrémités)."""
    lengths = [math.dist(a, b) for a, b in zip(curve, curve[1:])]
    total = sum(lengths)
    count = max(1, round(total / spacing))
    targets = [total * k / count for k in range(1, count)]
    out_points, run, index = [], 0.0, 0
    for target in targets:
        while index < len(lengths) - 1 and run + lengths[index] < target:
            run += lengths[index]
            index += 1
        t = (target - run) / (lengths[index] or 1)
        a, b = curve[index], curve[index + 1]
        out_points.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out_points


class Elements:
    """Ce qu'une région (ou les liaisons) dessine par-dessus le terrain, en coordonnées du monde."""

    def __init__(self):
        self.roads = []        # polylignes de route
        self.seas = []         # polylignes maritimes (pointillés)
        self.steps = []        # (x, y, eau)
        self.cities = []       # (x, y, nom, grande)
        self.annexes = []      # [x, y, style, nom, (ancre x, ancre y)]
        self.labels = []       # (box, texte, police, est_ville)
        self.title = None      # (texte, (x, y))
        self.access = []       # (polyligne, eau) : accès d'une zone annexe


elements = {}
for region in regions:
    e = elements[region.name] = Elements()
    e.cities = [(*region.world(x, y), name, big) for x, y, name, big in region.cities]
    for start, end, is_water in region.links:
        (e.seas if is_water else e.roads).append([region.world(*start), region.world(*end)])
    e.steps = [(*region.world(x, y), is_water) for x, y, is_water in region.steps]
    city_points = [(x, y) for x, y, _, _ in e.cities]
    for points in region.road_paths:
        line = [region.world(*p) for p in points]
        e.roads.append(line)
        e.steps += [(x, y, False) for x, y in resample(line, STEP_SPACING)
                    if all(math.dist((x, y), c) > 24 for c in city_points)]
    for points in region.sea_paths:
        line = catmull_rom([region.world(*p) for p in points])
        e.seas.append(line)
        if region.spec["source"] == "official":
            e.steps += [(x, y, True) for x, y in resample(line, STEP_SPACING * 1.6)
                        if all(math.dist((x, y), c) > 26 for c in city_points)]
    e.annexes = [[*region.world(x, y), style, name, region.world(x, y)] for x, y, style, name in region.dungeons]
    if region.spec.get("label"):
        text, (dx, dy) = region.spec["label"]
        e.title = (text, (region.world_origin[0] + dx, region.world_origin[1] + dy))

# Les étapes trop proches l'une de l'autre (grilles qui se recouvrent, chapelets) : on n'en garde qu'une.
for e in elements.values():
    kept = []
    for step in e.steps:
        if all(math.dist(step[:2], other[:2]) > 16 for other in kept):
            kept.append(step)
    e.steps = kept


def resolve(point):
    """Point ("city", ...) ou ("native", ...) d'une liaison -> coordonnées du monde, décalage compris."""
    kind, name, *args = point
    if kind == "city":
        (x, y), offset = by_name[name].city(args[0]), args[1:]
    else:
        (x, y), offset = by_name[name].world(args[0], args[1]), args[2:]
    dx, dy = offset if offset else (0, 0)
    return x + dx, y + dy


link_elements = []   # (Elements, noms des régions reliées)
for link in LINKS:
    base = [None if p[0] == "corner" else resolve(p) for p in link["points"]]
    points = []
    for p, b in zip(link["points"], base):
        if b is None:   # coin : x d'un point, y d'un autre (les coins ne visent pas d'autres coins)
            _, i, j, *offset = p
            dx, dy = offset if offset else (0, 0)
            b = (base[i][0] + dx, base[j][1] + dy)
        points.append(b)
    e = Elements()
    names = {p[1] for p in link["points"] if p[0] != "corner"}
    if link["water"]:
        line = bent(points[0], points[1], link.get("bend", 0)) if len(points) == 2 else catmull_rom(points)
        e.seas.append(line)
        ends = [resolve(p) for p in link["points"] if p[0] != "corner"]
        e.steps += [(x, y, True) for x, y in resample(line, STEP_SPACING * 1.6)
                    if all(math.dist((x, y), c) > 26 for c in ends)]
    else:
        e.roads.append(points)
        e.steps += [(x, y, False) for x, y in resample(points, STEP_SPACING)]
    link_elements.append((e, names))

# Zones annexes : losange décalé de leur point, écarté des villes et des autres losanges.
all_cities = [c for e in elements.values() for c in e.cities]
all_annexes = [a for e in elements.values() for a in e.annexes]
for marker in all_annexes:
    marker[0] += 14
    marker[1] -= 14
for _ in range(14):
    for marker in all_annexes:
        for cx, cy, _, _ in all_cities:
            d = math.dist(marker[:2], (cx, cy))
            if d < 30:
                ux, uy = ((marker[0] - cx) / d, (marker[1] - cy) / d) if d > 0.1 else (0.7, -0.7)
                marker[0], marker[1] = cx + ux * 30, cy + uy * 30
        for other in all_annexes:
            d = math.dist(marker[:2], other[:2])
            if other is not marker and d < 26:
                ux, uy = ((marker[0] - other[0]) / d, (marker[1] - other[1]) / d) if d > 0.1 else (1, 0)
                marker[0] += ux * (26 - d) / 2
                marker[1] += uy * (26 - d) / 2

# Accès des zones annexes : un court tracé du losange vers le point du réseau (route, liaison, étape, ville) le
# plus proche du lieu réel de la zone ; en pointillé maritime si la zone est une île ou si le tracé passe sur l'eau.
network = []   # (ax, ay, bx, by)
for e in list(elements.values()) + [e for e, _ in link_elements]:
    for line in e.roads + e.seas:
        network += [(a[0], a[1], b[0], b[1]) for a, b in zip(line, line[1:])]
    network += [(x, y, x, y) for x, y, *_ in e.steps + e.cities]
network = np.array(network, dtype=np.float64)


def nearest_on_network(px, py):
    ax, ay, bx, by = network.T
    dx, dy = bx - ax, by - ay
    length2 = dx * dx + dy * dy
    t = np.clip(np.where(length2 > 0, ((px - ax) * dx + (py - ay) * dy) / np.where(length2 > 0, length2, 1), 0), 0, 1)
    qx, qy = ax + t * dx, ay + t * dy
    k = int(np.argmin((qx - px) ** 2 + (qy - py) ** 2))
    return float(qx[k]), float(qy[k])


for e in elements.values():
    for x, y, style, _, (anchor_x, anchor_y) in e.annexes:
        tx, ty = nearest_on_network(anchor_x, anchor_y)
        if math.dist((x, y), (tx, ty)) < 15:
            continue
        samples = [(x + (tx - x) * k / 10, y + (ty - y) * k / 10) for k in range(11)]
        on_water = sum(not land[min(Hpx - 1, max(0, int(sy))), min(W - 1, max(0, int(sx)))] for sx, sy in samples)
        e.access.append(([(x, y), (tx, ty)], style == "island" or on_water > 5))

# ======================================================================
# Occupation : ce que les étiquettes évitent (dur = villes, losanges, étiquettes ; doux = routes, étapes)
# ======================================================================
font = ImageFont.truetype(FONT_PATH, 13)
small_font = ImageFont.truetype(FONT_PATH, 10)
title_font = ImageFont.truetype(FONT_PATH, 44)
LEGEND_BOX = (7000, 1200, 7620, 1490)

soft_image = Image.new("L", (W, Hpx), 0)
soft = ImageDraw.Draw(soft_image)
all_elements = list(elements.values()) + [e for e, _ in link_elements]
for e in all_elements:
    for line in e.roads:
        soft.line(line, fill=255, width=11)
    for line in e.seas:
        soft.line(line, fill=255, width=5)
    for line, _ in e.access:
        soft.line(line, fill=255, width=5)
    for x, y, _ in e.steps:
        soft.ellipse([x - 6, y - 6, x + 6, y + 6], fill=255)
soft_mask = np.array(soft_image) > 0
hard_mask = np.zeros((Hpx, W), dtype=bool)


def mark(mask, box):
    x0, y0, x1, y1 = (int(max(0, box[0])), int(max(0, box[1])), int(min(W, box[2] + 1)), int(min(Hpx, box[3] + 1)))
    mask[y0:y1, x0:x1] = True


for x, y, _, _ in all_cities:
    mark(hard_mask, (x - 17, y - 14, x + 17, y + 16))
for x, y, *_ in all_annexes:
    mark(hard_mask, (x - 14, y - 14, x + 14, y + 14))
mark(hard_mask, LEGEND_BOX)
for e in elements.values():
    if e.title:
        text, (tx, ty) = e.title
        width = ImageDraw.Draw(Image.new("L", (1, 1))).textbbox((0, 0), text, font=title_font, stroke_width=4)[2]
        e.title_box = (tx - 4, ty - 4, tx + width + 4, ty + 54)
        mark(hard_mask, e.title_box)


def box_cost(box):
    x0, y0, x1, y1 = (int(box[0]), int(box[1]), int(box[2]) + 1, int(box[3]) + 1)
    if x0 < 8 or y0 < 8 or x1 > W - 8 or y1 > Hpx - 8:
        return 10 ** 9
    return int(hard_mask[y0:y1, x0:x1].sum()) * 1000 + int(soft_mask[y0:y1, x0:x1].sum())


measure = ImageDraw.Draw(Image.new("L", (1, 1)))
crowded = []   # étiquettes qui n'ont trouvé aucune place libre (relecture)
for e in elements.values():   # villes d'abord : sous la ville, sinon au-dessus, à droite, à gauche...
    for x, y, name, _ in e.cities:
        width = measure.textbbox((0, 0), name, font=font)[2]
        candidates = [(x - width / 2, y + 18), (x - width / 2, y - 36), (x + 20, y - 8), (x - 20 - width, y - 8),
                      (x + 14, y + 14), (x - 14 - width, y + 14), (x + 14, y - 32), (x - 14 - width, y - 32),
                      (x - width / 2, y + 36), (x - width / 2, y - 54), (x + 20, y + 4), (x - 20 - width, y + 4),
                      (x + 20, y - 22), (x - 20 - width, y - 22), (x + 4, y + 22), (x - 4 - width, y + 22),
                      (x + 4, y - 40), (x - 4 - width, y - 40)]
        scored = [(box_cost((tx - 4, ty - 4, tx + width + 4, ty + 17)) + k, tx, ty) for k, (tx, ty) in enumerate(candidates)]
        cost, tx, ty = min(scored)
        if cost >= 1000:
            crowded.append(name)
        box = (tx - 4, ty - 4, tx + width + 4, ty + 17)
        mark(hard_mask, box)
        e.labels.append((box, name, font, True))
for e in elements.values():   # puis les zones annexes, en petit
    for x, y, _, name, _ in e.annexes:
        if not name:
            continue
        width = measure.textbbox((0, 0), name, font=small_font)[2]
        candidates = []
        for distance in (16, 30, 44, 60, 76):
            candidates += [(x + distance, y - 6), (x - distance - width, y - 6), (x - width / 2, y + distance - 2),
                           (x - width / 2, y - distance - 10), (x + distance - 4, y + distance - 12),
                           (x - distance - width + 4, y + distance - 12), (x + distance - 4, y - distance),
                           (x - distance - width + 4, y - distance)]
        scored = [(box_cost((tx - 2, ty - 2, tx + width + 2, ty + 13)) + k, tx, ty) for k, (tx, ty) in enumerate(candidates)]
        cost, tx, ty = min(scored)
        if cost >= 1000:
            crowded.append(name)
        box = (tx - 2, ty - 2, tx + width + 2, ty + 13)
        mark(hard_mask, box)
        e.labels.append((box, name, small_font, False))
print("étiquettes placées ; sans place libre :", crowded or "aucune", flush=True)


# ======================================================================
# Décor : montagnes, rochers, arbres de plusieurs essences, tenus à distance de tout tracé
# ======================================================================
keepout_image = Image.new("L", (W, Hpx), 0)
keep = ImageDraw.Draw(keepout_image)
m = TREE_MARGIN
for e in all_elements:
    for line in e.roads:
        keep.line(line, fill=255, width=9 + 2 * m)
        for x, y in line:
            keep.ellipse([x - 4 - m, y - 4 - m, x + 4 + m, y + 4 + m], fill=255)
    for line in e.seas:
        keep.line(line, fill=255, width=3 + 2 * m)
    for line, _ in e.access:
        keep.line(line, fill=255, width=5 + 2 * m)
    for x, y, _ in e.steps:
        keep.ellipse([x - 5 - m, y - 5 - m, x + 5 + m, y + 5 + m], fill=255)
    for x, y, *_ in e.annexes:
        keep.polygon([(x, y - 13 - m), (x + 13 + m, y), (x, y + 13 + m), (x - 13 - m, y)], fill=255)
    for x, y, _, _ in e.cities:
        keep.ellipse([x - 16 - m, y - 13 - m, x + 16 + m, y + 15 + m], fill=255)
    for box, *_ in e.labels:
        keep.rectangle([box[0] - m, box[1] - m, box[2] + m, box[3] + m], fill=255)
    if getattr(e, "title_box", None):
        keep.rectangle(e.title_box, fill=255)
keep.rectangle([LEGEND_BOX[0] - 10, LEGEND_BOX[1] - 10, LEGEND_BOX[2] + 10, LEGEND_BOX[3] + 10], fill=255)
keepout = np.array(keepout_image) > 0
del keepout_image
integral = np.zeros((Hpx + 1, W + 1), dtype=np.int32)
integral[1:, 1:] = keepout.cumsum(0).cumsum(1)


def blocked(x0, y0, x1, y1):
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(Hpx, y1)
    return integral[y1, x1] - integral[y0, x1] - integral[y1, x0] + integral[y0, x0] > 0


SPRITES = {name: Image.open(os.path.join(HERE, "sprites", f"{name}.png")).convert("RGBA")
           for name in ("feuillu", "feuillu-rond", "sapin", "sapin-enneige", "palmier", "tropical", "montagne",
                        "montagne-grise", "montagne-enneigee", "rocher", "rocher-force", "rocher-casse")}
KIND = {"montagne": "montagne", "montagne-grise": "montagne", "montagne-enneigee": "montagne", "rocher": "rocher",
        "rocher-force": "rocher", "rocher-casse": "rocher"}
OWNER_NAMES = [region.name for region in regions] + ["Continents"]
occupied = np.zeros((Hpx, W), dtype=bool)   # emprise des montagnes et rochers déjà posés
decor = []   # (y du pied, x, essence, propriétaire)
random.seed(3)


def fits(x, y, sprite, margin=1):
    """Toute l'emprise du sprite (posé par le pied) est libre, sur la terre et sur un seul propriétaire."""
    w, h = sprite.size
    x0, y0 = x - w // 2, y - h + 1
    if x0 < 2 or y0 < 2 or x0 + w >= W - 2 or y >= Hpx - 3 or not land[y, x] or owner[y, x] < 0:
        return False
    if blocked(x0 - margin, y0 - margin, x0 + w + margin, y + 2 + margin):
        return False
    probes = [(x, y), (x, y0 + h // 4), (x0 + 1, y - h // 3), (x0 + w - 2, y - h // 3), (x0 + 1, y), (x0 + w - 2, y)]
    return all(land[py, px] and owner[py, px] == owner[y, x] for px, py in probes)


def place(x, y, name, shrink=0.0):
    sprite = SPRITES[name]
    w, h = sprite.size
    decor.append((y, x, name, int(owner[y, x])))
    if name in KIND:
        sx, sy = int(w * shrink / 2), int(h * shrink / 2)
        occupied[y - h + 1 + sy:y + 1 - sy, x - w // 2 + sx:x - w // 2 + w - sx] = True


def free(x, y, sprite, shrink=0.0):
    w, h = sprite.size
    sx, sy = int(w * shrink / 2), int(h * shrink / 2)
    return not occupied[max(0, y - h + 1 + sy):y + 1 - sy, max(0, x - w // 2 + sx):x - w // 2 + w - sx].any()


# 1. Montagnes : sur les reliefs hauts (régions et chaînes réelles), en massifs qui se chevauchent un peu.
for gy_ in range(30, Hpx, 22):
    for gx_ in range(20, W, 30):
        x, y = gx_ + random.randrange(-8, 9), gy_ + random.randrange(-5, 6)
        if not (0 <= x < W and 0 <= y < Hpx) or not land[y, x] or random.random() > 0.55:
            continue
        mountainous = (range_field[y, x] > 0.45 and H[y, x] >= 3.6 if owner[y, x] == CONTINENTS
                       else H[y, x] >= 4.6 or (snowy_zone[y, x] and H[y, x] >= 3.2 and random.random() < 0.5))
        if not mountainous:
            continue
        if snowy_zone[y, x] or H[y, x] >= 6.0:
            name = "montagne-enneigee"
        elif desert_zone[y, x] or (owner[y, x] == CONTINENTS and random.random() < 0.5):
            name = "montagne-grise"
        else:
            name = random.choice(("montagne", "montagne", "montagne-grise"))
        if fits(x, y, SPRITES[name], 2) and free(x, y, SPRITES[name], 0.3):
            place(x, y, name, 0.3)
# 2. Rochers : épars sur les pentes, plus nombreux dans les déserts et au bord des montagnes.
for _ in range(26000):
    x, y = random.randrange(W), random.randrange(Hpx)
    if not land[y, x] or land_distance[y, x] <= 3:
        continue
    chance = 0.5 if desert_zone[y, x] else 0.25 if 2.6 <= H[y, x] < 6 else 0.02
    if random.random() > chance:
        continue
    name = random.choice(("rocher", "rocher-force", "rocher-casse"))
    if fits(x, y, SPRITES[name], 2) and free(x, y, SPRITES[name]):
        place(x, y, name)

# 3. Arbres : l'essence suit le climat (latitude réelle, neige, région), en bosquets homogènes.
forest_noise = value_noise(W, Hpx, 30, 11)
species_noise = value_noise(W, Hpx, 55, 12)
hoenn = by_name["Hoenn"].box
galar = by_name["Galar"].box
COLD_REGIONS = {"Sinnoh", "Septentria"}


def species(x, y):
    name = OWNER_NAMES[owner[y, x]]
    pick = species_noise[y, x]
    if snowy_zone[y, x]:
        return "sapin-enneige" if pick > 0.25 else "sapin"
    tropical = (name == "Alola" or (name == "Continents" and lat_field[y, x] < 24)
                or (name == "Hoenn" and y > hoenn[1] + 0.55 * (hoenn[3] - hoenn[1])))
    if tropical:
        return "palmier" if pick > 0.42 else "tropical" if pick < 0.2 else "feuillu-rond"
    boreal = (name in COLD_REGIONS or (name == "Continents" and lat_field[y, x] > 48)
              or (name == "Galar" and y < (galar[1] + galar[3]) / 2) or H[y, x] > 3.4)
    if boreal:
        return "sapin" if pick > 0.3 else "feuillu"
    return "feuillu-rond" if pick > 0.58 else "sapin" if pick < 0.2 else "feuillu"


def tree_ok(x, y, name, max_height):
    if not (0 <= x < W and 0 <= y < Hpx) or not land[y, x] or land_distance[y, x] <= 6 or H[y, x] >= max_height:
        return False
    if desert_zone[y, x]:
        return False
    sprite = SPRITES[name]
    return fits(x, y, sprite) and free(x, y, sprite)


for gy_ in range(0, Hpx, 11):
    for gx_ in range(0, W, 12):
        x = gx_ + random.randrange(-3, 4) + (6 if (gy_ // 11) % 2 else 0)
        y = gy_ + random.randrange(-2, 3)
        if not (0 <= x < W and 0 <= y < Hpx) or owner[y, x] < 0:
            continue
        lush = snowy_zone[y, x] or OWNER_NAMES[owner[y, x]] in ("Alola", "Hoenn")
        threshold = 0.66 if owner[y, x] == CONTINENTS else 0.55 if lush else 0.62
        if forest_noise[y, x] > threshold:
            name = species(x, y)
            if tree_ok(x, y, name, 4.4):
                place(x, y, name)
for _ in range(3000):   # quelques arbres isolés dans les prairies
    x, y = random.randrange(W), random.randrange(Hpx)
    if land[y, x] and owner[y, x] >= 0 and forest_noise[y, x] < 0.5:
        name = species(x, y)
        if tree_ok(x, y, name, 4):
            place(x, y, name)
decor.sort()
counts_by_kind = {}
for _, _, name, _ in decor:
    counts_by_kind[name] = counts_by_kind.get(name, 0) + 1
print("décor :", len(decor), counts_by_kind, flush=True)

# ======================================================================
# Dessin : une pièce (canevas) par propriétaire et par calque de nature
# ======================================================================
class Canvas:
    """Image RGBA d'une partie du monde ; les coordonnées passées sont celles du monde."""

    def __init__(self, box):
        self.ox, self.oy = int(box[0]), int(box[1])
        self.image = Image.new("RGBA", (max(1, int(box[2]) - self.ox), max(1, int(box[3]) - self.oy)), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.image)

    def t(self, points):
        return [(x - self.ox, y - self.oy) for x, y in points]

    def b(self, box):
        return [box[0] - self.ox, box[1] - self.oy, box[2] - self.ox, box[3] - self.oy]


def draw_annex(c, x, y, style):
    d, (x, y) = c.draw, (x - c.ox, y - c.oy)
    d.polygon([(x, y - 13), (x + 13, y), (x, y + 13), (x - 13, y)], fill=(248, 240, 208), outline=(56, 56, 72), width=2)
    if style == "cave":
        d.pieslice([x - 8, y - 6, x + 8, y + 10], 180, 360, fill=(120, 104, 88), outline=(64, 52, 44))
        d.pieslice([x - 4, y - 1, x + 4, y + 9], 180, 360, fill=(24, 20, 20))
    elif style == "forest":
        for ox, oy in ((-4, 1), (4, 1), (0, -4)):
            d.ellipse([x + ox - 4, y + oy - 4, x + ox + 4, y + oy + 4], fill=(32, 104, 40), outline=(16, 64, 24))
    elif style == "tower":
        d.rectangle([x - 3, y - 5, x + 3, y + 7], fill=(160, 120, 200), outline=(80, 48, 112))
        d.polygon([(x - 5, y - 5), (x + 5, y - 5), (x, y - 10)], fill=(96, 64, 144))
    elif style == "plant":
        d.polygon([(x + 1, y - 9), (x - 5, y + 1), (x - 1, y + 1), (x - 2, y + 9), (x + 5, y - 2), (x + 1, y - 2)],
                  fill=(248, 208, 48), outline=(152, 112, 16))
    elif style == "ruins":
        for ox in (-5, 0, 5):
            d.rectangle([x + ox - 1, y - 5, x + ox + 1, y + 6], fill=(200, 184, 152), outline=(112, 96, 72))
        d.rectangle([x - 7, y - 7, x + 7, y - 5], fill=(176, 160, 128), outline=(112, 96, 72))
    elif style == "lake":
        d.ellipse([x - 8, y - 5, x + 8, y + 5], fill=(80, 152, 232), outline=(40, 88, 168))
        d.line([x - 4, y - 1, x + 2, y - 1], fill=(216, 240, 255))
    elif style == "island":
        d.ellipse([x - 8, y + 1, x + 8, y + 7], fill=(80, 152, 232))
        d.ellipse([x - 6, y - 4, x + 6, y + 4], fill=(96, 176, 72), outline=(48, 112, 40))
    else:
        points = [(x + (8 if k % 2 == 0 else 3.5) * math.cos(-math.pi / 2 + k * math.pi / 5),
                   y + (8 if k % 2 == 0 else 3.5) * math.sin(-math.pi / 2 + k * math.pi / 5)) for k in range(10)]
        d.polygon(points, fill=(248, 200, 48), outline=(152, 104, 16))


def draw_house(d, x, y, roof):
    d.rectangle([x - 4, y - 1, x + 4, y + 5], fill=(248, 240, 224), outline=(72, 56, 48))
    d.polygon([(x - 6, y - 1), (x + 6, y - 1), (x, y - 7)], fill=roof, outline=(72, 40, 40))
    d.rectangle([x - 1, y + 2, x + 1, y + 5], fill=(104, 72, 48))


def dashed(c, line, color=PALETTE["foam"], dash=6, gap=6, width=3):
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
                c.draw.line(c.t([p, q]), fill=color, width=width)
            position += piece
            left -= piece
            if left <= 0:
                drawing = not drawing
                left = dash if drawing else gap


def draw_routes(c, e):
    for line in e.seas:
        dashed(c, line)
    for line in e.roads:
        c.draw.line(c.t(line), fill=PALETTE["road_edge"], width=9, joint="curve")
        for x, y in line[1:-1]:
            c.draw.ellipse(c.b((x - 4, y - 4, x + 4, y + 4)), fill=PALETTE["road_edge"])
    for line in e.roads:
        c.draw.line(c.t(line), fill=PALETTE["road"], width=5, joint="curve")
        for x, y in line[1:-1]:
            c.draw.ellipse(c.b((x - 2, y - 2, x + 2, y + 2)), fill=PALETTE["road"])


def draw_access(c, e):
    for line, is_water in e.access:
        if is_water:
            dashed(c, line, color=PALETTE["surf"], dash=4, gap=4, width=2)
    for line, is_water in e.access:
        if not is_water:
            c.draw.line(c.t(line), fill=PALETTE["path_edge"], width=5)
            for x, y in line:
                c.draw.ellipse(c.b((x - 2, y - 2, x + 2, y + 2)), fill=PALETTE["path_edge"])
    for line, is_water in e.access:
        if not is_water:
            c.draw.line(c.t(line), fill=PALETTE["path"], width=3)


def draw_steps(c, e):
    for x, y, is_water in e.steps:
        c.draw.ellipse(c.b((x - 5, y - 5, x + 5, y + 5)), fill=(255, 255, 255), outline=(56, 56, 72), width=2)
        c.draw.ellipse(c.b((x - 2, y - 2, x + 2, y + 2)), fill=(64, 120, 224) if is_water else (224, 64, 64))


def draw_annexes(c, e):
    for x, y, style, _, _ in e.annexes:
        draw_annex(c, x, y, style)


def draw_cities(c, e):
    for x, y, _, big in e.cities:
        c.draw.ellipse(c.b((x - 16, y - 13, x + 16, y + 15)), fill=(200, 184, 152), outline=(120, 96, 72), width=2)
        spots = [(-7, -1, (216, 72, 56)), (7, -1, (64, 112, 200)), (0, 8, (216, 72, 56))]
        if big:
            spots += [(-8, 9, (96, 168, 88)), (8, 9, (232, 160, 48))]
        for ox, oy, roof in spots:
            draw_house(c.draw, int(x + ox - c.ox), int(y + oy - c.oy), roof)


def draw_labels(c, e):
    for box, text, label_font, is_city in e.labels:
        if is_city:
            c.draw.rounded_rectangle(c.b(box), radius=3, fill=(248, 248, 240), outline=(56, 56, 72), width=2)
            c.draw.text((box[0] + 4 - c.ox, box[1] + 4 - c.oy), text, fill=(40, 40, 56), font=label_font)
        else:
            c.draw.rounded_rectangle(c.b(box), radius=2, fill=(248, 244, 228, 225), outline=(120, 108, 88), width=1)
            c.draw.text((box[0] + 2 - c.ox, box[1] + 2 - c.oy), text, fill=(72, 60, 48), font=label_font)
    if e.title:
        text, (tx, ty) = e.title
        c.draw.text((tx - c.ox, ty - c.oy), text, font=title_font, fill=(248, 248, 240), stroke_width=4,
                    stroke_fill=(40, 56, 104))


def bounds(e):
    xs, ys = [], []
    for line in e.roads + e.seas + [line for line, _ in e.access]:
        xs += [p[0] for p in line]
        ys += [p[1] for p in line]
    for item in e.steps + e.cities + e.annexes:
        xs.append(item[0])
        ys.append(item[1])
    for box, *_ in e.labels:
        xs += [box[0], box[2]]
        ys += [box[1], box[3]]
    if getattr(e, "title_box", None):
        xs += [e.title_box[0], e.title_box[2]]
        ys += [e.title_box[1], e.title_box[3]]
    return (max(0, int(min(xs)) - 40), max(0, int(min(ys)) - 40), min(W, int(max(xs)) + 40), min(Hpx, int(max(ys)) + 40))


# Calques de nature, du dessous vers le dessus. "eau", "nuages" et "legende-cadre" sont d'un seul tenant.
LAYERS = ["eau", "terre", "decor", "routes", "acces", "etapes", "zones-annexes", "villes", "etiquettes", "nuages",
          "legende-cadre"]
ELEMENT_DRAWERS = {"routes": draw_routes, "acces": draw_access, "etapes": draw_steps, "zones-annexes": draw_annexes,
                   "villes": draw_cities, "etiquettes": draw_labels}
pieces = {name: [] for name in LAYERS}   # calque -> [(Canvas, propriétaires)]

for index, owner_name in enumerate(OWNER_NAMES):
    mine = (owner == index) & land
    rows, cols = np.nonzero(mine.any(1))[0], np.nonzero(mine.any(0))[0]
    if not len(rows):
        continue
    box = (int(cols.min()), max(0, int(rows.min()) - 60), int(cols.max()) + 1, int(rows.max()) + 1)
    x0, y0, x1, y1 = box
    terrain = Canvas(box)
    rgba = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
    rgba[..., :3] = out[y0:y1, x0:x1]
    rgba[..., 3] = np.where(mine[y0:y1, x0:x1], 255, 0)
    terrain.image = Image.fromarray(rgba, "RGBA")
    pieces["terre"].append((terrain, {owner_name}))
    trees = Canvas(box)
    for y, x, name, who in decor:   # de l'arrière vers l'avant
        if who == index:
            sprite = SPRITES[name]
            trees.image.alpha_composite(sprite, (int(x - sprite.width // 2 - x0), int(y - sprite.height + 1 - y0)))
    pieces["decor"].append((trees, {owner_name}))
del out
for region in regions:
    e = elements[region.name]
    for layer, drawer in ELEMENT_DRAWERS.items():
        c = Canvas(bounds(e))
        drawer(c, e)
        pieces[layer].append((c, {region.name}))
for e, names in link_elements:
    for layer in ("routes", "etapes"):
        c = Canvas(bounds(e))
        ELEMENT_DRAWERS[layer](c, e)
        pieces[layer].append((c, set(names)))
water_canvas = Canvas((0, 0, W, Hpx))
water_canvas.image = Image.fromarray(water).convert("RGBA")
pieces["eau"].append((water_canvas, set()))
del water

# Nuages : bancs de cumulus en pixel art (dessinés à mi-résolution puis agrandis), avec leur ombre portée,
# posés là où la géographie est la plus comprimée (Asie centrale, Pacifique nord, intérieur de l'Amérique).
# Mer de nuages sur l'intérieur de l'Eurasie (la partie la plus comprimée) : seules restent visibles l'Europe
# autour de Kalos et la côte asiatique face au Japon. Quelques bancs isolés ailleurs.
_sea_rng = random.Random(11)
CLOUD_BANKS = []
for _y in range(60, 3320, 190):   # bord gauche et bord droit qui ondulent d'une rangée à l'autre
    _left = 2000 + int(110 * math.sin(_y / 420)) + _sea_rng.randint(-50, 50)
    _right = 2860 + int(90 * math.sin(_y / 300 + 1.3)) + _sea_rng.randint(-50, 50)
    for _x in range(_left, _right, 180):
        CLOUD_BANKS.append((_x + _sea_rng.randint(-40, 40), _y + _sea_rng.randint(-40, 40), _sea_rng.randint(160, 220),
                            _sea_rng.randint(120, 170)))
CLOUD_BANKS += [(6800, 400, 260, 140), (7700, 1950, 300, 150), (8650, 900, 280, 170), (8800, 1700, 240, 140),
                (1500, 2700, 170, 100)]


def clouds_image():
    half = Image.new("RGBA", (W // 2, Hpx // 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (W // 2, Hpx // 2), (0, 0, 0, 0))
    body_draw, shadow_draw = ImageDraw.Draw(half), ImageDraw.Draw(shadow)
    cloud_rng = random.Random(7)
    for cx, cy, rx, ry in CLOUD_BANKS:
        puffs = []
        for _ in range(int(rx * ry / 900)):
            angle, radius = cloud_rng.random() * math.tau, math.sqrt(cloud_rng.random())
            px, py = cx + math.cos(angle) * rx * radius * 0.85, cy + math.sin(angle) * ry * radius * 0.75
            size = cloud_rng.uniform(26, 60) * (1.15 - radius * 0.5)
            puffs.append((py, px, size))
        puffs.sort()
        for py, px, size in puffs:
            h = size / 2
            shadow_draw.ellipse([(px + 40) / 2 - h, (py + 46) / 2 - h * 0.7, (px + 40) / 2 + h, (py + 46) / 2 + h * 0.7],
                                fill=(16, 32, 72, 70))
        for py, px, size in puffs:   # contour, ombre propre du bas, corps, reflet
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
    full = shadow.resize((W, Hpx), Image.NEAREST)
    full.alpha_composite(half.resize((W, Hpx), Image.NEAREST))
    return full


cloud_canvas = Canvas((0, 0, W, Hpx))
cloud_canvas.image = clouds_image()
pieces["nuages"].append((cloud_canvas, set()))


def draw_legend(draw):
    x0, y0, x1, y1 = LEGEND_BOX
    draw.rounded_rectangle([x0, y0, x1, y1], radius=8, fill=(248, 244, 228), outline=(56, 56, 72), width=3)
    draw.text((x0 + 24, y0 + 18), "Monde Pokémon (POC V06)", font=ImageFont.truetype(FONT_PATH, 30), fill=(40, 40, 56))
    small = ImageFont.truetype(FONT_PATH, 16)
    draw.ellipse([x0 + 14, y0 + 59, x0 + 46, y0 + 87], fill=(200, 184, 152), outline=(120, 96, 72), width=2)
    draw_house(draw, x0 + 23, y0 + 71, (216, 72, 56))
    draw_house(draw, x0 + 37, y0 + 71, (64, 112, 200))
    draw.text((x0 + 60, y0 + 63), "Ville (nom français officiel)", font=small, fill=(40, 40, 56))
    for legend_y, dot, text in ((y0 + 116, (224, 64, 64), "Étape de route"), (y0 + 150, (64, 120, 224), "Étape en mer (Surf, ferry)")):
        draw.ellipse([x0 + 25, legend_y - 5, x0 + 35, legend_y + 5], fill=(255, 255, 255), outline=(56, 56, 72), width=2)
        draw.ellipse([x0 + 28, legend_y - 2, x0 + 32, legend_y + 2], fill=dot)
        draw.text((x0 + 60, legend_y - 9), text, font=small, fill=(40, 40, 56))
    legend = Canvas((0, 0, 1, 1))
    legend.draw = draw
    for k, style in enumerate(("cave", "forest", "tower", "plant", "ruins", "lake", "island", "star")):
        draw_annex(legend, x0 + 30 + k * 32, y0 + 196, style)
    draw.text((x0 + 20, y0 + 218), "Zones annexes, reliées au réseau par un sentier :", font=small, fill=(40, 40, 56))
    draw.text((x0 + 20, y0 + 240), "grotte, forêt, tour, centrale, ruines, lac, île, autre.", font=small, fill=(40, 40, 56))
    draw.text((x0 + 20, y0 + 262), "Grisé = indisponible. Terres hors régions : Natural Earth.", font=small, fill=(40, 40, 56))


frame_canvas = Canvas((0, 0, W, Hpx))
frame_draw = frame_canvas.draw
draw_legend(frame_draw)
frame_draw.rectangle([0, 0, W - 1, Hpx - 1], outline=(56, 56, 72), width=4)
frame_draw.rectangle([4, 4, W - 5, Hpx - 5], outline=(232, 216, 176), width=2)
pieces["legende-cadre"].append((frame_canvas, set()))
print("calques dessinés", flush=True)

# ======================================================================
# Composition selon l'état des régions, sorties, vérification
# ======================================================================
def greyed(image):
    """Pièce d'une région indisponible : couleurs ramenées à un gris clair, transparence conservée."""
    array = np.array(image).astype(np.float32)
    grey = array[..., 0] * 0.3 + array[..., 1] * 0.59 + array[..., 2] * 0.11
    tone = grey * 0.45 + 118
    array[..., :3] = np.stack([tone * 0.97, tone * 0.98, tone * 1.02], axis=-1)
    return Image.fromarray(np.clip(array, 0, 255).astype(np.uint8), "RGBA")


def compose_layer(layer, states):
    image = Image.new("RGBA", (W, Hpx), (0, 0, 0, 0))
    for c, names in pieces[layer]:
        if any(states.get(n) == "hidden" for n in names):
            continue
        piece = greyed(c.image) if any(states.get(n) == "locked" for n in names) else c.image
        image.alpha_composite(piece, (c.ox, c.oy))
    return image


def compose(states, keep_layers=False):
    layers_out, image = {}, None
    for layer in LAYERS:
        part = compose_layer(layer, states)
        if keep_layers:
            layers_out[layer] = part
        if image is None:
            image = part.copy()
        else:
            image.alpha_composite(part)
    return image.convert("RGB"), layers_out


base, extension = os.path.splitext(OUT)
all_available = {name: "available" for name in OWNER_NAMES}
final, layer_images = compose(all_available, keep_layers=True)
final.save(OUT)
demo = {name: ("available" if name in DEMO_AVAILABLE else "locked") for name in OWNER_NAMES}
compose(demo)[0].save(f"{base}-grisee{extension}")

layer_dir = os.path.join(os.path.dirname(os.path.abspath(OUT)), "layers")
os.makedirs(os.path.join(layer_dir, "regions"), exist_ok=True)
for k, layer in enumerate(LAYERS, start=1):
    layer_images[layer].save(os.path.join(layer_dir, f"{k:02d}-{layer}.png"))
del layer_images
for owner_name in OWNER_NAMES:   # calques par région (V05) : toutes les natures d'une région, liaisons à part
    full = Image.new("RGBA", (W, Hpx), (0, 0, 0, 0))
    for layer in LAYERS:
        for c, names in pieces[layer]:
            if names == {owner_name}:
                full.alpha_composite(c.image, (c.ox, c.oy))
    full.save(os.path.join(layer_dir, "regions", f"{owner_name.lower().replace(' ', '-')}.png"))
links_image = Image.new("RGBA", (W, Hpx), (0, 0, 0, 0))
for layer in LAYERS:
    for c, names in pieces[layer]:
        if len(names) > 1:
            links_image.alpha_composite(c.image, (c.ox, c.oy))
links_image.save(os.path.join(layer_dir, "regions", "liaisons.png"))

with open(os.path.join(os.path.dirname(os.path.abspath(OUT)), "decor.json"), "w") as handle:
    json.dump({"monde": [W, Hpx], "pose": "x, y = pied du sprite (bas centre), en pixels du monde",
               "sprites": {name: list(SPRITES[name].size) for name in SPRITES},
               "decor": [{"x": x, "y": y, "type": KIND.get(name, "arbre"), "essence": name,
                          "region": OWNER_NAMES[who]} for y, x, name, who in decor]},
              handle, ensure_ascii=False, indent=0)

# Vérification : les calques relus sur disque, superposés dans l'ordre, redonnent l'image finale.
check = None
for k, layer in enumerate(LAYERS, start=1):
    part = Image.open(os.path.join(layer_dir, f"{k:02d}-{layer}.png")).convert("RGBA")
    check = part if check is None else Image.alpha_composite(check, part)
difference = np.abs(np.array(check.convert("RGB")).astype(np.int16) - np.array(Image.open(OUT).convert("RGB")).astype(np.int16))
print("vérification des calques : pixels différents", int((difference.max(-1) > 0).sum()), "écart max", int(difference.max()))
counts = {k: sum(len(getattr(e, k)) for e in elements.values()) for k in ("cities", "steps", "annexes", "access")}
print(OUT, (W, Hpx), counts, "décor", len(decor), counts_by_kind)
