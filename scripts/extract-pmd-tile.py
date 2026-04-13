#!/usr/bin/env python3
"""
Extract a single tile from a PMD (Pokemon Mystery Dungeon) Spriters Resource sheet.

All outdoor PMD sheets share the tile geometry:
  - Tile size: 24x24 px
  - Step:      25 px (tile + 1px grid line)
  - Grid line color: (128, 255, 255)
  - Background color: (0, 128, 128)

Grid origin (X0, Y0) is auto-detected per sheet by scanning for the first grid
lines. Most sheets have Y0≈163, but some (e.g. magma-cavern) have the grid
shifted down by ~50px because of a wider label header.

WARNING: each sheet has its own section layout (Legend | Walls | Wall Alt 1
| ... | Ground | ... | Water | Water Sparkle). Always regenerate a --scan
and inspect the per-sheet header labels before picking columns.

Usage:
  # Extract tile at global col=12, row=0
  python3 scripts/extract-pmd-tile.py sheet.png --col 12 --row 0

  # Generate a labeled contact sheet
  python3 scripts/extract-pmd-tile.py sheet.png --scan

  # Override auto-detected grid origin (rarely needed)
  python3 scripts/extract-pmd-tile.py sheet.png --col 28 --row 1 --y0 215
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Error: Pillow is required. Install it with: pip install Pillow", file=sys.stderr)
    sys.exit(1)

# PMD outdoor sheet constants
STEP = 25
TILE = 24
GRID_COLOR = (128, 255, 255)
BG_COLOR = (0, 128, 128)

Y0_DEFAULT = 163     # fallback if auto-detect fails
Y0_MIN = 100         # lowest plausible grid origin (below header boxes)
Y0_MAX = 260         # highest plausible grid origin
X0_MAX = 25          # horizontal search range for X0


def detect_y0(sheet: Image.Image) -> int:
    """Auto-detect tile origin Y by finding the first horizontal grid line.

    A horizontal grid line is a row where many consecutive pixels from the
    left side are GRID_COLOR. The tile row starts at y = line + 1.
    """
    rgb = sheet.convert("RGB")
    w = min(sheet.width, 200)
    for y in range(Y0_MIN, min(Y0_MAX, sheet.height)):
        hits = sum(1 for x in range(w) if rgb.getpixel((x, y))[:3] == GRID_COLOR)
        if hits >= w // 3:
            return y + 1
    return Y0_DEFAULT


def detect_x0(sheet: Image.Image, y0: int) -> int:
    """Auto-detect tile origin X by finding the first vertical grid line."""
    rgb = sheet.convert("RGB")
    for x in range(min(X0_MAX, sheet.width)):
        hits = sum(1 for y in range(y0, min(y0 + TILE, sheet.height)) if rgb.getpixel((x, y))[:3] == GRID_COLOR)
        if hits >= TILE // 2:
            return x + 1  # tile starts one pixel after the grid line
    return 9  # fallback


def grid_bounds(x0: int, y0: int, sheet_width: int, sheet_height: int) -> tuple[int, int]:
    """Return (n_cols, n_rows) available in this sheet."""
    n_cols = (sheet_width - x0) // STEP
    n_rows = (sheet_height - y0) // STEP
    return n_cols, n_rows


def extract_tile(sheet: Image.Image, col: int, row: int, y0_override: int | None = None) -> Image.Image:
    """Extract the 24x24 tile at (col, row) from an open PMD sheet."""
    y0 = y0_override if y0_override is not None else detect_y0(sheet)
    x0 = detect_x0(sheet, y0)
    width, height = sheet.size
    n_cols, n_rows = grid_bounds(x0, y0, width, height)

    if col < 0 or col >= n_cols:
        raise ValueError(f"col={col} out of range [0, {n_cols - 1}]")
    if row < 0 or row >= n_rows:
        raise ValueError(f"row={row} out of range [0, {n_rows - 1}]")

    x = x0 + col * STEP
    y = y0 + row * STEP
    return sheet.convert("RGBA").crop((x, y, x + TILE, y + TILE))


def generate_scan(sheet: Image.Image, out_path: Path, y0_override: int | None = None) -> None:
    """
    Build a labeled contact sheet showing all tiles with col/row indices.
    Empty tiles (all BG_COLOR or GRID_COLOR) are shown with a dim overlay.
    """
    rgb = sheet.convert("RGB")
    width, height = sheet.size
    y0 = y0_override if y0_override is not None else detect_y0(sheet)
    x0 = detect_x0(sheet, y0)
    n_cols, n_rows = grid_bounds(x0, y0, width, height)

    scale = 3
    label_h = 14
    cell = TILE * scale
    margin = 2
    img_w = n_cols * (cell + margin) + margin
    img_h = n_rows * (cell + margin) + margin + label_h + 4

    out = Image.new("RGB", (img_w, img_h), (40, 40, 40))
    draw = ImageDraw.Draw(out)

    try:
        font = ImageFont.truetype("/usr/share/fonts/liberation/LiberationMono-Regular.ttf", 10)
    except Exception:
        font = ImageFont.load_default()

    for row in range(n_rows):
        for col in range(n_cols):
            tile = extract_tile(sheet, col, row, y0_override=y0).convert("RGB")
            pixels = list(tile.getdata())
            is_empty = all(p == BG_COLOR or p == GRID_COLOR for p in pixels)

            px = margin + col * (cell + margin)
            py = label_h + 4 + margin + row * (cell + margin)

            scaled = tile.resize((cell, cell), Image.NEAREST)
            out.paste(scaled, (px, py))

            if is_empty:
                overlay = Image.new("RGBA", (cell, cell), (0, 0, 0, 140))
                out.paste(Image.new("RGB", (cell, cell), (20, 20, 20)), (px, py), overlay)

    # Column labels at top
    for col in range(n_cols):
        px = margin + col * (cell + margin) + cell // 2 - 6
        draw.text((px, 2), str(col), fill=(200, 200, 200), font=font)

    # Row labels on left
    for row in range(n_rows):
        py = label_h + 4 + margin + row * (cell + margin) + cell // 2 - 5
        draw.text((2, py), str(row), fill=(200, 200, 200), font=font)

    out.save(out_path)
    print(f"Scan saved: {out_path}  ({n_cols} cols x {n_rows} rows, y0={y0}, x0={x0})")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract tiles from PMD Spriters Resource sheets.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("sheet", type=Path, help="Path to the PMD sheet PNG")
    parser.add_argument("--col", type=int, help="Global column index (0-indexed)")
    parser.add_argument("--row", type=int, help="Row index (0-indexed)")
    parser.add_argument("--out", type=Path, help="Output path (default: auto-named next to sheet)")
    parser.add_argument("--scan", action="store_true", help="Generate a labeled contact sheet")
    parser.add_argument("--y0", type=int, default=None, help="Override auto-detected grid origin Y")
    args = parser.parse_args()

    if not args.sheet.exists():
        print(f"Error: sheet not found: {args.sheet}", file=sys.stderr)
        sys.exit(1)

    sheet = Image.open(args.sheet)

    if args.scan:
        scan_out = args.out or args.sheet.parent / f"{args.sheet.stem}_scan.png"
        generate_scan(sheet, scan_out, y0_override=args.y0)
        return

    if args.col is None or args.row is None:
        parser.error("--col and --row are required unless --scan is used")

    tile = extract_tile(sheet, args.col, args.row, y0_override=args.y0)

    out_path = args.out or args.sheet.parent / f"{args.sheet.stem}_c{args.col}_r{args.row}.png"

    tile.save(out_path)
    print(f"Tile saved: {out_path}")


if __name__ == "__main__":
    main()
