"""Montre en texte le visage d'images d'un atlas SpriteKiln, pour vérifier les yeux sans regarder d'image.

`#` = encre des yeux, `.` = autre pixel opaque, espace = transparent. Les `--lignes` (12 par défaut) lignes sous le haut de la silhouette ; une pose basse (K.O.) ou une main levée en demande plus.
Par défaut l'encre est #0c0a10, le ton le plus sombre de la rampe des yeux du gabarit (`--encre RRGGBB` sinon).
usage : python3 verifier_yeux.py <atlas.json> <clip> [<directions> [<images>]] [--encre RRGGBB] [--lignes 12]
  ex. : python3 verifier_yeux.py out/red2/red2.json command s,se,e 3,4
"""
import json
import sys
from pathlib import Path

from PIL import Image

def main():
    arguments = sys.argv[1:]
    ink = (0x0C, 0x0A, 0x10)
    if "--encre" in arguments:
        position = arguments.index("--encre")
        ink = tuple(int(arguments[position + 1][i:i + 2], 16) for i in (0, 2, 4))
        del arguments[position:position + 2]
    line_count = 12
    if "--lignes" in arguments:
        position = arguments.index("--lignes")
        line_count = int(arguments[position + 1])
        del arguments[position:position + 2]
    atlas, clip = Path(arguments[0]), arguments[1]
    directions = arguments[2].split(",") if len(arguments) > 2 else ["s", "se", "e", "sw"]
    data = json.loads(atlas.read_text())
    sheet = Image.open(atlas.with_name(data["meta"]["image"])).convert("RGBA")
    count = sum(1 for name in data["frames"] if name.startswith(f"{clip}_s_"))
    frames = [int(f) for f in arguments[3].split(",")] if len(arguments) > 3 else range(count)
    for direction in directions:
        blocks = []
        for index in frames:
            box = data["frames"][f"{clip}_{direction}_{index}"]["frame"]
            image = sheet.crop((box["x"], box["y"], box["x"] + box["w"], box["y"] + box["h"]))
            bounds = image.getchannel("A").point(lambda a: 255 if a == 255 else 0).getbbox()
            lines = []
            if bounds is None:
                blocks.append((f"{direction} {index} (vide)", [""] * line_count))
                continue
            for y in range(bounds[1], min(bounds[1] + line_count, image.height)):
                row = ""
                for x in range(bounds[0], bounds[2]):
                    pixel = image.getpixel((x, y))
                    row += "#" if pixel[3] == 255 and pixel[:3] == ink else ("." if pixel[3] == 255 else " ")
                lines.append(row)
            lines += [""] * (line_count - len(lines))
            blocks.append((f"{direction} {index}", lines))
        width = max(len(line) for _, lines in blocks for line in lines) + 3
        print("".join(f"{name:<{width}}" for name, _ in blocks))
        for row in range(line_count):
            print("".join(f"{lines[row]:<{width}}" for _, lines in blocks))
        print()


if __name__ == "__main__":
    main()
