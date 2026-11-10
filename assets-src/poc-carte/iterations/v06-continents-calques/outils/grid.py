"""grid.py src out step [maxw] [crop x0,y0,x1,y1] : aperçu avec grille de coordonnées (coordonnées source)."""
import sys
from PIL import Image, ImageDraw, ImageFont
src, out, step = sys.argv[1], sys.argv[2], int(sys.argv[3])
maxw = int(sys.argv[4]) if len(sys.argv) > 4 else 1200
im = Image.open(src).convert("RGB")
ox = oy = 0
if len(sys.argv) > 5:
    x0, y0, x1, y1 = map(int, sys.argv[5].split(","))
    im = im.crop((x0, y0, x1, y1)); ox, oy = x0, y0
f = min(1.0, maxw / im.width) if maxw > 0 else 1.0
if maxw < 0: f = -maxw / 100
im = im.resize((int(im.width * f), int(im.height * f)), Image.LANCZOS)
d = ImageDraw.Draw(im)
font = ImageFont.truetype("/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf", 11)
start_x = (ox // step + 1) * step if ox % step else ox
for gx in range(start_x, ox + int(im.width / f) + 1, step):
    x = (gx - ox) * f
    d.line([(x, 0), (x, im.height)], fill=(255, 0, 255), width=1)
    d.text((x + 2, 2), str(gx), fill=(255, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
start_y = (oy // step + 1) * step if oy % step else oy
for gy in range(start_y, oy + int(im.height / f) + 1, step):
    y = (gy - oy) * f
    d.line([(0, y), (im.width, y)], fill=(255, 0, 255), width=1)
    d.text((2, y + 2), str(gy), fill=(255, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
im.save(out)
