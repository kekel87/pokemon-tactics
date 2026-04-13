#!/usr/bin/env python3
"""
Build a 32x160 vertical tileset column for one terrain from a top + a side
texture. The column contains the 5 canonical tiles in this order (top→bottom):

  1. full        — unit cube
  2. half-a      — half-height, homogeneous flank (flank uses top texture)
  3. half-b      — half-height, generic flank (flank uses side texture)
  4. ramp-s      — slope descending south (cardinal S)
  5. stairs-s    — 4-step staircase rising north

East-facing variants (ramp-e, stairs-e) are produced at map-render time via
Tiled horizontal flip — they do not need to live in the tileset image.

Final tileset assembly is straightforward: concatenate one column per terrain
horizontally (15 terrains → 480×160 PNG).

Usage:
  python3 scripts/build-terrain-row.py \
    --name normal-grass \
    --top  forest-path-ground.png \
    --side lightning-field-ground.png \
    --out  col-normal-grass.png
"""

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow is required.  pip install Pillow", file=sys.stderr)
    sys.exit(1)

# Each entry: (tile_label, make-iso-tile shape, flank_texture_source)
#   flank_texture_source = "top" or "side" — which input goes to --side
TILES_SOLID = [
    ("full",     "full",     "side"),
    ("half-a",   "half",     "top"),   # homogeneous flank: flank = top texture
    ("half-b",   "half",     "side"),  # generic flank: flank = side texture
    ("stairs-s", "stairs-s", "side"),
    ("ramp-s",   "ramp-s",   "side"),
]

TILES_LIQUID = [
    ("full",     "full",     "side"),
]
TILE_W, TILE_H = 32, 32
SCRIPT_DIR = Path(__file__).resolve().parent
MAKE_TILE = SCRIPT_DIR / "make-iso-tile.py"


def render_shape(shape: str, top: Path, side: Path, out: Path) -> None:
    cmd = [
        sys.executable, str(MAKE_TILE),
        "--shape", shape,
        "--top",   str(top),
        "--side",  str(side),
        "--out",   str(out),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        raise RuntimeError(f"make-iso-tile.py failed for shape={shape}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a tileset column for one terrain.")
    parser.add_argument("--name", required=True,              help="Terrain name (used only for logging)")
    parser.add_argument("--type", choices=["solid", "liquid"], default="solid",
                        help="Terrain type. solid = 5 tiles, liquid = 1 tile (full only).")
    parser.add_argument("--top",  type=Path, required=True,   help="Flat top texture (any size)")
    parser.add_argument("--side", type=Path, default=None,    help="Flat side / dirt texture (defaults to --top, used for liquids)")
    parser.add_argument("--out",  type=Path, required=True,   help="Output PNG path")
    args = parser.parse_args()

    if args.side is None:
        args.side = args.top
    for p in [args.top, args.side]:
        if not p.exists():
            print(f"Error: not found: {p}", file=sys.stderr); sys.exit(1)

    tiles_spec = TILES_SOLID if args.type == "solid" else TILES_LIQUID

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        tiles = []
        for label, shape, flank_src in tiles_spec:
            side_texture = args.top if flank_src == "top" else args.side
            tile_path = tmp / f"{label}.png"
            render_shape(shape, args.top, side_texture, tile_path)
            tiles.append(Image.open(tile_path).convert("RGBA"))

        col = Image.new("RGBA", (TILE_W, TILE_H * len(tiles_spec)), (0, 0, 0, 0))
        for i, tile in enumerate(tiles):
            col.paste(tile, (0, i * TILE_H), tile)

        args.out.parent.mkdir(parents=True, exist_ok=True)
        col.save(args.out)

    layout = " → ".join(t[0] for t in tiles_spec)
    print(f"[{args.name}] Column saved: {args.out}  ({TILE_W}x{TILE_H * len(tiles_spec)}, type={args.type})")
    print(f"           Layout (top→bottom): {layout}")


if __name__ == "__main__":
    main()
