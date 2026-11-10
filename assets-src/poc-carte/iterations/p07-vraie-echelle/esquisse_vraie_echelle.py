"""Pré-itération P07 : planisphère à la vraie échelle, Japon au centre, empreinte réelle de chaque région.
Usage : python3 -P esquisse_vraie_echelle.py <ne_50m_land.geojson> <sortie_dossier>"""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont

LAND, OUT = sys.argv[1], sys.argv[2]
CENTER_LON = 140.0
FONT = "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf"
# Empreinte réelle (lon min, lat min, lon max, lat max) de chaque région, d'après ses modèles admis.
REGIONS = {
    "Kanto": ((138.4, 34.9, 140.9, 37.2), (230, 80, 60)),
    "Johto": ((134.0, 33.6, 137.4, 35.8), (240, 170, 40)),
    "Hoenn": ((129.5, 31.0, 132.1, 34.0), (60, 170, 90)),
    "Sinnoh": ((139.8, 41.4, 145.8, 45.5), (90, 120, 230)),
    "Septentria": ((139.6, 37.7, 142.1, 41.3), (170, 90, 200)),
    "Îles Sevii": ((139.0, 32.4, 140.4, 34.6), (60, 190, 200)),
    "Unys": ((-75.6, 39.8, -72.4, 41.6), (210, 60, 140)),
    "Kalos": ((-4.8, 45.5, 8.2, 51.1), (40, 110, 200)),
    "Galar": ((-6.2, 50.0, 1.8, 58.7), (200, 40, 60)),
    "Paldea": ((-9.5, 36.0, 3.3, 43.8), (230, 130, 30)),
    "Alola": ((-160.5, 18.9, -154.8, 22.3), (240, 90, 160)),
}

def shift(lon):
    return (lon - CENTER_LON + 180.0) % 360.0 - 180.0

def project(lon, lat, width, height, box):
    x0, y0, x1, y1 = box   # fenêtre en degrés décalés
    return ((shift(lon) - x0) / (x1 - x0) * width, (y1 - lat) / (y1 - y0) * height)

def rings(geometry):
    polys = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    for poly in polys:
        yield poly[0]

def render(name, box, width, label_size):
    height = int(width * (box[3] - box[1]) / (box[2] - box[0]))
    img = Image.new("RGB", (width, height), (36, 92, 168))
    draw = ImageDraw.Draw(img)
    for feature in json.load(open(LAND))["features"]:
        for ring in rings(feature["geometry"]):
            # longitudes déroulées en continu, puis le polygone est dessiné aussi décalé de ±360°
            unwrapped, prev = [], None
            for lon, lat in ring:
                s = shift(lon)
                if prev is not None:
                    while s - prev > 180: s -= 360
                    while s - prev < -180: s += 360
                unwrapped.append((s, lat)); prev = s
            for offset in (-360, 0, 360):
                pts = [((s + offset - box[0]) / (box[2] - box[0]) * width, (box[3] - lat) / (box[3] - box[1]) * height)
                       for s, lat in unwrapped]
                if len(pts) > 2:
                    draw.polygon(pts, fill=(120, 176, 96), outline=(88, 140, 72))
    font = ImageFont.truetype(FONT, label_size)
    for label, ((a, b, c, d), color) in REGIONS.items():
        x0, y1 = project(a, b, width, height, box); x1, y0 = project(c, d, width, height, box)
        if x1 < 0 or x0 > width or y1 < 0 or y0 > height: continue
        draw.rectangle((x0, y0, x1, y1), outline=color, width=3)
        draw.rectangle((x0 + 2, y0 + 2, x1 - 2, y1 - 2), outline=(255, 255, 255), width=1)
        draw.text((x1 + 6, y0), label, font=font, fill=(255, 255, 255), stroke_width=3, stroke_fill=color)
    img.save(os.path.join(OUT, name))
    return img.size

# Monde entier, Japon au centre, sans les pôles.
print("monde", render("p07-monde.png", (-180, -60, 180, 80), 3600, 20))
# Japon, Europe, Unys, Alola à la même échelle (25 px par degré) pour comparer les tailles.
print("japon", render("p07-japon.png", (shift(126), 28, shift(148), 47), 22 * 40, 16))
print("europe", render("p07-europe.png", (shift(-12), 34, shift(14), 60), 26 * 40, 16))
print("unys", render("p07-unys.png", (shift(-80), 37, shift(-68), 45), 12 * 40, 16))
print("alola", render("p07-alola.png", (shift(-162), 17, shift(-153), 24), 9 * 40, 16))
