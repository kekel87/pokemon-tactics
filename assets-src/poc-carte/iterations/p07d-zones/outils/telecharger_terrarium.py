"""Télécharge les tuiles Terrarium (AWS Open Data « elevation-tiles-prod », PNG, h = R*256 + G + B/256 - 32768)
qui couvrent une boîte lon/lat, au zoom donné. Usage : python3 -P telecharger_terrarium.py <dossier> <zoom> lon0 lat0 lon1 lat1"""
import math
import os
import sys
import time
import urllib.request

out, z = sys.argv[1], int(sys.argv[2])
lon0, lat0, lon1, lat1 = map(float, sys.argv[3:7])
n = 2 ** z


def tile(lon, lat):
    r = math.radians(lat)
    return int((lon + 180) / 360 * n), int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)


xa, ya = tile(lon0, lat1)
xb, yb = tile(lon1, lat0)
count = 0
for x in range(xa, xb + 1):
    for y in range(ya, yb + 1):
        path = os.path.join(out, f"{z}-{x}-{y}.png")
        if os.path.exists(path):
            continue
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
        request = urllib.request.Request(url, headers={"User-Agent": "pokemon-tactics-map-poc/0.1"})
        with urllib.request.urlopen(request, timeout=30) as response:
            open(path, "wb").write(response.read())
        count += 1
        time.sleep(0.1)
print("tuiles téléchargées", count, "x", xa, xb, "y", ya, yb)
