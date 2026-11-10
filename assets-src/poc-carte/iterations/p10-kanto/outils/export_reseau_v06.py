"""Exporte le réseau de la V06 (villes, étapes, zones annexes, routes, liaisons maritimes, accès) en pixels du monde
V06 : exécute monde_v06.py jusqu'au calcul des accès des zones annexes (ligne « font = ImageFont.truetype(FONT_PATH,
13) » exclue), puis sauve les éléments de chaque région.

Usage (depuis v06-continents-calques) :
  python3 -P ../p09-prototype/outils/export_reseau_v06.py monde_v06.py <sortie.json> sources assembled ../../../kanto-pret sources-officielles sources-v06
"""
import json
import sys

script, out = sys.argv[1], sys.argv[2]
sys.argv = [script] + sys.argv[3:] + ["/dev/null"]
lines = open(script).read().split("\n")
stop = next(i for i, line in enumerate(lines) if line.startswith("font = ImageFont.truetype(FONT_PATH, 13)"))
namespace = {"__name__": "v06", "__file__": script}
exec(compile("\n".join(lines[:stop]), script, "exec"), namespace)


def pts(line):
    return [[round(float(x), 2), round(float(y), 2)] for x, y in line]


result = {}
for name, e in namespace["elements"].items():
    result[name] = {
        "cities": [{"x": float(x), "y": float(y), "name": n, "big": bool(b)} for x, y, n, b in e.cities],
        "steps": [{"x": float(x), "y": float(y), "water": bool(w)} for x, y, w in e.steps],
        "annexes": [{"x": float(x), "y": float(y), "style": s, "name": n, "anchor": [float(a[0]), float(a[1])]}
                    for x, y, s, n, a in e.annexes],
        "roads": [pts(line) for line in e.roads],
        "seas": [pts(line) for line in e.seas],
        "access": [{"line": pts(line), "water": bool(w)} for line, w in e.access],
    }
json.dump(result, open(out, "w"), ensure_ascii=False)
print("export", out, {k: (len(v["cities"]), len(v["steps"])) for k, v in result.items()})
