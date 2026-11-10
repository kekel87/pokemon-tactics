"""P10 : planche comparative des villes de Kanto (icône P09, miniature fidèle, variante isométrique), sur un fond
d'herbe de la carte.

Usage (depuis p10-kanto) : python3 -P outils/planche_villes.py villes planche-villes.png
"""
import sys

from PIL import Image, ImageDraw, ImageFont

root, out = sys.argv[1], sys.argv[2]
CITIES = [("Bourg Palette", "PalletTown", False), ("Jadielle", "ViridianCity", False), ("Argenta", "PewterCity", False),
          ("Azuria", "CeruleanCity", True), ("Lavanville", "LavenderTown", False),
          ("Carmin sur Mer", "VermilionCity", True), ("Céladopole", "CeladonCity", True),
          ("Parmanie", "FuchsiaCity", False), ("Safrania", "SaffronCity", True), ("Cramois'Île", "CinnabarIsland", False),
          ("Plateau Indigo", "IndigoPlateau_Exterior", False)]
FONT = ImageFont.truetype("/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf", 18)
SMALL = ImageFont.truetype("/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf", 15)
CELL_W, CELL_H, NAME_W, HEAD = 270, 230, 170, 40
GRASS = (116, 194, 72, 255)
sheet = Image.new("RGBA", (NAME_W + 3 * CELL_W, HEAD + len(CITIES) * CELL_H), (248, 244, 228, 255))
draw = ImageDraw.Draw(sheet)
for i, title in enumerate(["Icône P09 (×4)", "Miniature fidèle (pret)", "Variante isométrique"]):
    draw.text((NAME_W + i * CELL_W + CELL_W // 2, HEAD // 2), title, font=SMALL, fill=(40, 40, 56), anchor="mm")
for row, (name, slug, big) in enumerate(CITIES):
    y = HEAD + row * CELL_H
    draw.text((12, y + CELL_H // 2), name, font=FONT, fill=(40, 40, 56), anchor="lm")
    icon = Image.open(f"{root}/p09/{'grande' if big else 'petite'}.png")
    icon = icon.resize((icon.width * 4, icon.height * 4), Image.NEAREST)
    for col, image in enumerate([icon, Image.open(f"{root}/fidele/{slug}.png"), Image.open(f"{root}/iso/{slug}.png")]):
        x = NAME_W + col * CELL_W
        draw.rectangle((x + 6, y + 6, x + CELL_W - 6, y + CELL_H - 6), fill=GRASS)
        image = image.convert("RGBA")
        image.thumbnail((CELL_W - 24, CELL_H - 24), Image.LANCZOS if col else Image.NEAREST)
        sheet.alpha_composite(image, (x + (CELL_W - image.width) // 2, y + (CELL_H - image.height) // 2))
    draw.line((0, y, sheet.width, y), fill=(200, 188, 160), width=1)
sheet.convert("RGB").save(out)
print(out, sheet.size)
