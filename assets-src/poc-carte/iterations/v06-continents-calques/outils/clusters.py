"""clusters.py img k out.png [maxside] : k-means des couleurs, planche des centres + carte des classes."""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
img = Image.open(sys.argv[1]).convert("RGB")
k = int(sys.argv[2]); maxside = int(sys.argv[4]) if len(sys.argv) > 4 else 600
f = min(1, maxside / max(img.size)); img = img.resize((int(img.width * f), int(img.height * f)), Image.BOX)
a = np.array(img).reshape(-1, 3).astype(np.float32)
rng = np.random.default_rng(0)
sample = a[rng.choice(len(a), min(20000, len(a)), replace=False)]
c = sample[rng.choice(len(sample), k, replace=False)]
for _ in range(30):
    lab = np.argmin(((sample[:, None] - c[None]) ** 2).sum(-1), 1)
    c = np.array([sample[lab == i].mean(0) if (lab == i).any() else c[i] for i in range(k)])
lab = np.argmin(((a[:, None] - c[None]) ** 2).sum(-1), 1).reshape(img.height, img.width)
order = np.argsort([-(lab == i).sum() for i in range(k)])
font = ImageFont.truetype("/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf", 12)
sheet = Image.new("RGB", (img.width * 2 + 230, max(img.height, 22 * k)), (30, 30, 30))
sheet.paste(img, (0, 0))
false = np.zeros((img.height, img.width, 3), np.uint8)
vivid = np.array([(230,25,75),(60,180,75),(255,225,25),(0,130,200),(245,130,48),(145,30,180),(70,240,240),(240,50,230),(210,245,60),(250,190,212),(0,128,128),(220,190,255),(170,110,40),(255,250,200),(128,0,0),(170,255,195),(128,128,0),(255,215,180),(0,0,128),(128,128,128)])
for j, i in enumerate(order):
    false[lab == i] = vivid[j % 20]
sheet.paste(Image.fromarray(false), (img.width, 0))
d = ImageDraw.Draw(sheet)
for j, i in enumerate(order):
    y = 4 + j * 22; x = img.width * 2 + 8
    d.rectangle([x, y, x + 18, y + 16], fill=tuple(int(v) for v in c[i]))
    d.rectangle([x + 22, y, x + 40, y + 16], fill=tuple(int(v) for v in vivid[j % 20]))
    d.text((x + 46, y + 2), f"{j}: {tuple(int(v) for v in c[i])} {(lab == i).mean() * 100:.0f}%", fill=(255, 255, 255), font=font)
sheet.save(sys.argv[3])
