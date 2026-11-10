import json, sys, os
from PIL import Image
d = sys.argv[1]; out = sys.argv[2]
data = json.load(open(os.path.join(d, "decor.json")))
W, H = data["monde"]
sprites = {n: Image.open(os.path.join(d, "sprites", n + ".png")).convert("RGBA") for n in data["sprites"]}
decor = Image.new("RGBA", (W, H))
trees = sorted((e for e in data["decor"] if e["type"] == "arbre"), key=lambda e: (e["y"], e["x"]))
for e in trees:
    s = sprites[e["essence"]]; w, h = s.size
    decor.alpha_composite(s, (e["x"] - w // 2, e["y"] - h + 1))
base = Image.new("RGBA", (W, H), (0, 0, 0, 255))
for name in sorted(os.listdir(os.path.join(d, "layers"))):
    if not name.endswith(".png"): continue
    layer = decor if name.startswith("03-") else Image.open(os.path.join(d, "layers", name)).convert("RGBA")
    base.alpha_composite(layer)
base.convert("RGB").save(out)
print(len(trees), "arbres")
