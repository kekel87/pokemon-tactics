"""Exporte le champ de hauteur H de la V06 (et sa neige de climat) : exécute monde_v06.py jusqu'au calcul de
desert_zone (ligne qui commence par « desert_zone = continental »), puis sauve H (float16) et snowy_zone.

Usage (depuis v06-continents-calques) :
  python3 -P ../p07d-zones/outils/export_hauteurs_v06.py monde_v06.py <sortie.npz> sources assembled ../../../kanto-pret sources-officielles sources-v06
"""
import sys

import numpy as np

script, out = sys.argv[1], sys.argv[2]
sys.argv = [script] + sys.argv[3:] + ["/dev/null"]
lines = open(script).read().split("\n")
stop = next(i for i, line in enumerate(lines) if line.startswith("desert_zone = continental"))
namespace = {"__name__": "v06", "__file__": script}
exec(compile("\n".join(lines[:stop + 1]), script, "exec"), namespace)
np.savez_compressed(out, H=namespace["H"].astype(np.float16), snowy=namespace["snowy_zone"],
                    land=namespace["land"])
print("export", out, namespace["H"].shape, float(namespace["H"].max()))
