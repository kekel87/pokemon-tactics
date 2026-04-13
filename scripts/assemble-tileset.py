#!/usr/bin/env python3
"""
Assemble the final custom tileset PNG by stacking per-terrain columns
vertically with an empty separator row between each group.

Inputs: one PNG column per terrain (produced by `build-terrain.py`).
Output: a single `<W>x<H>` PNG where W=32 and H = 32 * sum(rows_per_terrain + 1).

Layout (plan 050): groups are stacked top-to-bottom in this order, each
followed by one empty row. A "solid" group contributes 5 rows (full,
half-a, half-b, stairs-s, ramp-s); a "liquid" group contributes 1 row
(full only).

Usage:
  python3 scripts/assemble-tileset.py \
    --solid  herbe  tiles/work/col-herbe.png \
    --solid  roche  tiles/work/col-roche.png \
    --solid  sable  tiles/work/col-sable.png \
    --solid  path   tiles/work/col-path.png \
    --liquid eau    tiles/work/col-eau.png \
    --out    packages/renderer/public/assets/tilesets/terrain/custom-tileset.png

The order of --solid / --liquid flags on the command line IS the order in
which groups appear in the output (top-to-bottom).
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow is required.  pip install Pillow", file=sys.stderr)
    sys.exit(1)

TILE_W, TILE_H = 32, 32
ROWS_SOLID = 5
ROWS_LIQUID = 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    # Use a single ordered list of (type, name, path) so we preserve CLI order.
    parser.add_argument("--solid",  action="append", nargs=2, metavar=("NAME", "PATH"),
                        help="Solid terrain column (expects 5 rows)")
    parser.add_argument("--liquid", action="append", nargs=2, metavar=("NAME", "PATH"),
                        help="Liquid terrain column (expects 1 row)")
    parser.add_argument("--out", type=Path, required=True, help="Output tileset PNG")
    args, _ = parser.parse_known_args()

    # Reconstruct the ordered sequence from sys.argv so groups stay in CLI order.
    # argparse "append" collapses everything into two separate lists, losing order.
    groups: list[tuple[str, str, Path]] = []
    argv = sys.argv[1:]
    i = 0
    while i < len(argv):
        token = argv[i]
        if token in ("--solid", "--liquid") and i + 2 < len(argv):
            kind = "solid" if token == "--solid" else "liquid"
            groups.append((kind, argv[i + 1], Path(argv[i + 2])))
            i += 3
        else:
            i += 1

    if not groups:
        parser.error("at least one --solid or --liquid is required")

    for _, _, p in groups:
        if not p.exists():
            print(f"Error: column not found: {p}", file=sys.stderr); sys.exit(1)

    # Compute total height: sum of each group's rows, plus one separator row per group.
    total_rows = 0
    for kind, _, _ in groups:
        rows = ROWS_SOLID if kind == "solid" else ROWS_LIQUID
        total_rows += rows + 1  # +1 for the separator

    tileset = Image.new("RGBA", (TILE_W, TILE_H * total_rows), (0, 0, 0, 0))
    y_row = 0
    row_map: list[tuple[int, str, str]] = []

    for kind, name, path in groups:
        col = Image.open(path).convert("RGBA")
        n_rows = ROWS_SOLID if kind == "solid" else ROWS_LIQUID
        expected_h = TILE_H * n_rows
        if col.height != expected_h:
            print(
                f"Error: {name} ({kind}) column height is {col.height}, expected {expected_h}",
                file=sys.stderr,
            )
            sys.exit(1)
        tileset.paste(col, (0, y_row * TILE_H), col)
        for offset in range(n_rows):
            row_map.append((y_row + offset, name, kind))
        y_row += n_rows
        row_map.append((y_row, "(separator)", "-"))
        y_row += 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    tileset.save(args.out)

    print(f"Tileset saved: {args.out}  ({tileset.width}x{tileset.height}, {total_rows} rows)")
    print("\nRow → tile_id mapping (tile_id = row_index since width=1 column):")
    for row_idx, name, kind in row_map:
        print(f"  row {row_idx:2d} (tile_id {row_idx:2d}): {name}  [{kind}]")


if __name__ == "__main__":
    main()
