"""P10 : lit les map.json de pokefirered (connexions de bord et warps) et sort le réseau de Kanto au niveau des
cartes extérieures et des donjons : quelle carte mène à quelle autre, en traversant portiques et maisons.

Usage (depuis p10-kanto) : python3 -P outils/topologie_pret.py telechargements/pret/data/maps > build/topologie-kanto.txt
"""
import json
import os
import sys
from collections import defaultdict

root = sys.argv[1]
maps = {}
for name in os.listdir(root):
    path = os.path.join(root, name, "map.json")
    if os.path.exists(path):
        maps[name] = json.load(open(path))
by_id = {m["id"]: name for name, m in maps.items()}

DUNGEONS = ("ViridianForest", "MtMoon", "DiglettsCave", "RockTunnel", "UndergroundPath", "VictoryRoad",
            "SeafoamIslands", "PowerPlant", "CeruleanCave", "SafariZone", "PokemonTower", "PokemonMansion")


def outdoor(name):
    return name.startswith("Route") and "_" not in name or name in (
        "PalletTown", "ViridianCity", "PewterCity", "CeruleanCity", "LavenderTown", "VermilionCity", "CeladonCity",
        "FuchsiaCity", "CinnabarIsland", "SaffronCity", "IndigoPlateau_Exterior")


def dungeon(name):
    return any(name.startswith(d) for d in DUNGEONS)


def group(name):
    for d in DUNGEONS:
        if name.startswith(d):
            return d
    return name


def neighbours(name):
    m = maps[name]
    for c in m.get("connections") or []:
        target = by_id.get(c["map"])
        if target:
            yield target, f"bord {c['direction']}"
    for w in m.get("warp_events") or []:
        target = by_id.get(w["dest_map"])
        if target:
            yield target, f"warp ({w['x']},{w['y']})"


edges = defaultdict(set)
for name in maps:
    if not (outdoor(name) or dungeon(name)):
        continue
    # parcours à travers les cartes intérieures (portiques, maisons), jusqu'à une autre carte extérieure ou un donjon
    seen, stack = {name}, [(name, None)]
    while stack:
        current, how = stack.pop()
        for target, via in neighbours(current):
            if target in seen:
                continue
            seen.add(target)
            if outdoor(target) or dungeon(target):
                if group(target) != group(name):
                    edges[group(name)].add((group(target), how or via))
            elif not target.startswith(("Route", )) or "_" in target:
                stack.append((target, how or via))

kanto = [n for n in sorted(edges) if outdoor(n) or n in DUNGEONS]
for name in kanto:
    targets = sorted({t for t, _ in edges[name]})
    print(f"{name}: {', '.join(targets)}")
