#!/usr/bin/env python3
"""
Build a 32x32 isometric tile from two flat textures.

Shapes:
  full    — block cube (default)
  half    — half-height block
  ramp-s  — ramp sloping down toward south (front). East variant via horizontal flip.

Usage:
  python3 scripts/make-iso-tile.py --top top.png --side side.png --out tile.png
  python3 scripts/make-iso-tile.py --top top.png --side side.png --shape half  --out half.png
  python3 scripts/make-iso-tile.py --top top.png --side side.png --shape ramp-s --out ramp.png
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageEnhance
except ImportError:
    print("Error: Pillow is required.  pip install Pillow", file=sys.stderr)
    sys.exit(1)

TILE_W  = 32
TILE_H  = 32
TOP_H   = 16   # height of the diamond top face
DEPTH   = 16   # height of the side faces

# Uniform shading on left/right flanks: the renderer obtains the east variant
# of ramps/stairs by flipping the south variant horizontally (sprite.setFlipX).
# Any asymmetry between LEFT_BRIGHTNESS and RIGHT_BRIGHTNESS produces a visible
# seam between flipped and non-flipped neighbours. Using a single mid value
# trades the illusion of a south-east light source for a clean join. Decision
# #258 (plan 055).
LEFT_BRIGHTNESS  = 0.65
RIGHT_BRIGHTNESS = 0.65


def project(src: Image.Image, canvas_size: tuple[int, int], data: tuple, poly: list) -> Image.Image:
    """Warp src with Image.AFFINE (inverse mapping) then mask with polygon."""
    src_rgba = src.convert("RGBA")
    warped = src_rgba.transform(canvas_size, Image.AFFINE, data, Image.NEAREST)
    mask = Image.new("L", canvas_size, 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255, outline=255)
    layer = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    layer.paste(warped, mask=mask)
    return layer


def darken(img: Image.Image, factor: float) -> Image.Image:
    return ImageEnhance.Brightness(img.convert("RGBA")).enhance(factor)


# ── AFFINE inverse helpers ───────────────────────────────────────────────────
# For each destination pixel (dx, dy) the AFFINE sampler reads src at
#   (a*dx + b*dy + c, d*dx + e*dy + f)
# Given 3 corner constraints (dst→src) we can solve the coefficients.

def affine_from_3_corners(
    src_size: tuple[int, int],
    dst_tl: tuple[int, int], dst_tr: tuple[int, int], dst_bl: tuple[int, int],
) -> tuple:
    """
    Return AFFINE data mapping a parallelogram in dst space to src (sw×sh).
    dst_tl → src (0,0), dst_tr → src (sw,0), dst_bl → src (0,sh).
    """
    sw, sh = src_size
    dtx1, dty1 = dst_tl
    dtx2, dty2 = dst_tr
    dtx3, dty3 = dst_bl

    # Vector basis in dst: u = TR - TL, v = BL - TL. Any dst point P = TL + α*u + β*v
    # maps to src (α*sw, β*sh). Solve α, β from dst.
    ux, uy = dtx2 - dtx1, dty2 - dty1
    vx, vy = dtx3 - dtx1, dty3 - dty1
    # α = (dx - dtx1) * 1/det * (vy) + (dy - dty1) * 1/det * (-vx)
    # β = (dx - dtx1) * 1/det * (-uy) + (dy - dty1) * 1/det * (ux)
    det = ux * vy - uy * vx
    if det == 0:
        raise ValueError("Degenerate parallelogram")
    a =  sw *  vy / det
    b =  sw * -vx / det
    c =  sw * (-dtx1 *  vy + dty1 *  vx) / det
    d =  sh * -uy / det
    e =  sh *  ux / det
    f =  sh * ( dtx1 *  uy - dty1 *  ux) / det
    return (a, b, c, d, e, f)


# ── Shape renderers ──────────────────────────────────────────────────────────

def render_full(top: Image.Image, side_l: Image.Image, side_r: Image.Image) -> Image.Image:
    """Full block cube (default)."""
    size = (TILE_W, TILE_H)

    # Top diamond: src TL→top, TR→right, BL→left  (BR=bottom derived)
    top_data = affine_from_3_corners(
        top.size, (TILE_W // 2, 0), (TILE_W, TOP_H // 2), (0, TOP_H // 2),
    )
    top_poly = [
        (TILE_W // 2, 0), (TILE_W, TOP_H // 2),
        (TILE_W // 2, TOP_H), (0, TOP_H // 2),
    ]

    left_data = affine_from_3_corners(
        side_l.size, (0, TOP_H // 2), (TILE_W // 2, TOP_H), (0, TOP_H // 2 + DEPTH),
    )
    left_poly = [
        (0, TOP_H // 2), (TILE_W // 2, TOP_H),
        (TILE_W // 2, TILE_H), (0, TOP_H // 2 + DEPTH),
    ]

    right_data = affine_from_3_corners(
        side_r.size, (TILE_W // 2, TOP_H), (TILE_W, TOP_H // 2), (TILE_W // 2, TILE_H),
    )
    right_poly = [
        (TILE_W // 2, TOP_H), (TILE_W, TOP_H // 2),
        (TILE_W, TOP_H // 2 + DEPTH), (TILE_W // 2, TILE_H),
    ]

    silhouette = [
        (TILE_W // 2, 0), (TILE_W, TOP_H // 2),
        (TILE_W, TOP_H // 2 + DEPTH), (TILE_W // 2, TILE_H),
        (0, TOP_H // 2 + DEPTH), (0, TOP_H // 2),
    ]

    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, project(top,                              size, top_data,   top_poly))
    canvas = Image.alpha_composite(canvas, project(darken(side_l, LEFT_BRIGHTNESS),  size, left_data,  left_poly))
    canvas = Image.alpha_composite(canvas, project(darken(side_r, RIGHT_BRIGHTNESS), size, right_data, right_poly))
    return fill_silhouette_gaps(canvas, silhouette)


def render_half(top: Image.Image, side_l: Image.Image, side_r: Image.Image) -> Image.Image:
    """Half-height block: top shifted down, flanks half as deep."""
    size = (TILE_W, TILE_H)
    half_depth = DEPTH // 2
    y_top_apex = TILE_H - TOP_H - half_depth          # 32 - 16 - 8 = 8
    y_top_mid  = y_top_apex + TOP_H // 2              # 16
    y_top_base = y_top_apex + TOP_H                   # 24

    top_data = affine_from_3_corners(
        top.size, (TILE_W // 2, y_top_apex), (TILE_W, y_top_mid), (0, y_top_mid),
    )
    top_poly = [
        (TILE_W // 2, y_top_apex), (TILE_W, y_top_mid),
        (TILE_W // 2, y_top_base), (0, y_top_mid),
    ]

    left_data = affine_from_3_corners(
        side_l.size, (0, y_top_mid), (TILE_W // 2, y_top_base), (0, y_top_mid + half_depth),
    )
    left_poly = [
        (0, y_top_mid), (TILE_W // 2, y_top_base),
        (TILE_W // 2, TILE_H), (0, y_top_mid + half_depth),
    ]

    right_data = affine_from_3_corners(
        side_r.size, (TILE_W // 2, y_top_base), (TILE_W, y_top_mid), (TILE_W // 2, TILE_H),
    )
    right_poly = [
        (TILE_W // 2, y_top_base), (TILE_W, y_top_mid),
        (TILE_W, y_top_mid + half_depth), (TILE_W // 2, TILE_H),
    ]

    silhouette = [
        (TILE_W // 2, y_top_apex), (TILE_W, y_top_mid),
        (TILE_W, y_top_mid + half_depth), (TILE_W // 2, TILE_H),
        (0, y_top_mid + half_depth), (0, y_top_mid),
    ]

    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, project(top,                              size, top_data,   top_poly))
    canvas = Image.alpha_composite(canvas, project(darken(side_l, LEFT_BRIGHTNESS),  size, left_data,  left_poly))
    canvas = Image.alpha_composite(canvas, project(darken(side_r, RIGHT_BRIGHTNESS), size, right_data, right_poly))
    return fill_silhouette_gaps(canvas, silhouette)


def render_ramp_s(top: Image.Image, side_l: Image.Image, side_r: Image.Image) -> Image.Image:
    """
    Pente S — ramp descending from elevation 1 on the NORTH edge (NW-NE)
    to elevation 0 on the SOUTH edge (SW-SE). The slope is cardinal:
    the entire N-edge is high, the entire S-edge is low. East variant
    via horizontal flip in Tiled.

    Top surface corners (canvas):
      NW_elev1 = (16,  0)    NE_elev1 = (32,  8)
      SW_elev0 = ( 0, 24)    SE_elev0 = (16, 32)

    Side walls (east and west) are visible trapezoids below the sloped top;
    the left face darker, the right face darkest (same convention as full).
    """
    size = (TILE_W, TILE_H)

    # Flat-top reference corners (elev 0): NW=(16,16), NE=(32,24), SE=(16,32), SW=(0,24).
    # Ramp top corners: N-edge lifted by DEPTH (elev 1), S-edge kept at elev 0.
    NW = (TILE_W // 2, 0)
    NE = (TILE_W,      TOP_H // 2)
    SE = (TILE_W // 2, TILE_H)
    SW = (0,           TILE_H - TOP_H // 2)

    # Map source (0,0)(sw,0)(0,sh) onto NW/NE/SW of the parallelogram.
    top_data = affine_from_3_corners(top.size, NW, NE, SW)
    top_poly = [NW, NE, SE, SW]

    # Only the east-facing wall is visible from the iso viewpoint.
    # West, north and south walls are either hidden behind the tile body or
    # collapse to zero height (south edge of the top rests on the elev-0 base).
    E_base_N = (TILE_W, TOP_H + TOP_H // 2)   # (32, 24)
    right_data = affine_from_3_corners(side_r.size, NE, SE, E_base_N)
    right_poly = [NE, SE, E_base_N]

    # side_l is accepted for API parity with the other shapes but unused here.
    _ = side_l

    silhouette = [NW, NE, E_base_N, SE, SW]

    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, project(top,                              size, top_data,   top_poly))
    canvas = Image.alpha_composite(canvas, project(darken(side_r, RIGHT_BRIGHTNESS), size, right_data, right_poly))
    return fill_silhouette_gaps(canvas, silhouette)


# ── Isometric projection helper ──────────────────────────────────────────────

def iso(gx: float, gy: float, e: float) -> tuple[int, int]:
    """Project grid (gx, gy) at elevation e onto our 32×32 tile canvas.

    Convention: gy increases going SOUTH (toward viewer), gx going EAST.
    Elevation 0 sits on the base; elevation 1 corresponds to the top face of
    a full cube. The mapping is: base footprint diamond occupies the lower
    half of the canvas, elev 1 top diamond occupies the upper half.
    """
    x = (gx - gy) * (TILE_W / 2) + TILE_W / 2
    y = (gx + gy) * (TOP_H / 2) - e * DEPTH + TOP_H
    return (round(x), round(y))


# ── Stairs renderer ──────────────────────────────────────────────────────────

def render_stairs_s(top: Image.Image, side_l: Image.Image, side_r: Image.Image) -> Image.Image:
    """
    4-step stairs rising from elevation 0 (south/front) to elevation 1 (north/back).
    East variant via horizontal flip in Tiled.

    Each step occupies 1/4 of the N-S axis and sits at elev i/4 (i=1..4). The
    visible geometry per step is: top surface + south-facing riser + east-facing
    wall. West and north walls are hidden behind the tile body.
    """
    size = (TILE_W, TILE_H)
    N = 4  # step count

    faces = []  # (src, brightness, dst_TL, dst_TR, dst_BL, poly)

    for i in range(1, N + 1):
        # Step i occupies footprint strip gy ∈ [(N-i)/N, (N+1-i)/N] at elev i/N.
        # i=1 → southernmost/lowest, i=N → northernmost/highest.
        gy_n = (N - i) / N          # north edge of step i (smaller gy)
        gy_s = (N + 1 - i) / N      # south edge of step i
        e    = i / N                # step elevation
        e_below = (i - 1) / N       # elevation of the step immediately south

        # Step top surface (diamond patch) NW → NE → SE → SW
        tNW = iso(0, gy_n, e);  tNE = iso(1, gy_n, e)
        tSE = iso(1, gy_s, e);  tSW = iso(0, gy_s, e)
        faces.append(("top", top, 1.0, tNW, tNE, tSW, [tNW, tNE, tSE, tSW]))

        # East wall (gx = 1, gy ∈ [gy_n, gy_s], E ∈ [0, e])
        eTB = iso(1, gy_n, e);      eTF = iso(1, gy_s, e)
        eBF = iso(1, gy_s, 0.0);    eBB = iso(1, gy_n, 0.0)
        faces.append(("east", side_r, RIGHT_BRIGHTNESS, eTB, eTF, eBB, [eTB, eTF, eBF, eBB]))

        # South-facing riser (gy = gy_s, E ∈ [e_below, e], gx ∈ [0, 1])
        # The riser sits on top of the step directly to the south; below step 1
        # it rests on the base (e_below = 0).
        rTL = iso(0, gy_s, e);      rTR = iso(1, gy_s, e)
        rBR = iso(1, gy_s, e_below); rBL = iso(0, gy_s, e_below)
        faces.append(("riser", side_l, LEFT_BRIGHTNESS, rTL, rTR, rBL, [rTL, rTR, rBR, rBL]))

    # Draw back-to-front: for each step (i from N down to 1), east wall → top → riser.
    # This order ensures the southern steps occlude northern-face remnants.
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    # Sort by step: faces list is already step 1, step 2, ... step N — each with
    # (top, east, riser). We want step N first (back), step 1 last (front).
    per_step: list[list] = [[] for _ in range(N)]
    for idx, entry in enumerate(faces):
        step_idx = idx // 3
        per_step[step_idx].append(entry)

    for step_entries in reversed(per_step):
        # Within a step: east wall first (back), top, then riser (front).
        for kind, src, brightness, TL, TR, BL, poly in step_entries:
            data = affine_from_3_corners(src.size, TL, TR, BL)
            tinted = src if brightness == 1.0 else darken(src, brightness)
            canvas = Image.alpha_composite(canvas, project(tinted, size, data, poly))

    # Silhouette: back edge + east wall + south base + west zigzag on steps.
    silhouette = [iso(0, 0, 1.0), iso(1, 0, 1.0), iso(1, 0, 0.0),
                  iso(1, 1, 0.0), iso(0, 1, 0.0)]
    # West side zigzag going north: step 1 SW → step 1 NW → step 2 SW → ... → step N SW.
    for i in range(1, N + 1):
        gy_s = (N + 1 - i) / N
        gy_n = (N - i) / N
        e    = i / N
        silhouette.append(iso(0, gy_s, e))
        silhouette.append(iso(0, gy_n, e))

    return fill_silhouette_gaps(canvas, silhouette)


# ── Silhouette gap filler ────────────────────────────────────────────────────

def fill_silhouette_gaps(canvas: Image.Image, silhouette_poly: list) -> Image.Image:
    """Patch transparent pixels inside the silhouette by copying a nearest neighbor."""
    silhouette = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(silhouette).polygon(silhouette_poly, fill=255, outline=255)

    canvas_px = canvas.load()
    sil_px = silhouette.load()
    W, H = canvas.size
    for y in range(H):
        for x in range(W):
            if sil_px[x, y] and canvas_px[x, y][3] == 0:
                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and canvas_px[nx, ny][3] > 0:
                        canvas_px[x, y] = canvas_px[nx, ny]
                        break
    return canvas


# ── Dispatcher / CLI ─────────────────────────────────────────────────────────

RENDERERS = {
    "full":     render_full,
    "half":     render_half,
    "ramp-s":   render_ramp_s,
    "stairs-s": render_stairs_s,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a 32x32 isometric tile from flat textures.")
    parser.add_argument("--top",        type=Path, required=True)
    parser.add_argument("--side",       type=Path, required=True, help="Side texture (left face, and right if --side-right omitted)")
    parser.add_argument("--side-right", type=Path, default=None,  help="Separate texture for the right face")
    parser.add_argument("--shape",      choices=list(RENDERERS), default="full", help="Tile geometry (default: full)")
    parser.add_argument("--out",        type=Path, required=True)
    args = parser.parse_args()

    for p in [args.top, args.side]:
        if not p.exists():
            print(f"Error: not found: {p}", file=sys.stderr); sys.exit(1)

    top    = Image.open(args.top)
    side_l = Image.open(args.side)
    side_r = Image.open(args.side_right) if args.side_right else side_l

    tile = RENDERERS[args.shape](top, side_l, side_r)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    tile.save(args.out)
    print(f"Tile saved: {args.out}  ({TILE_W}x{TILE_H}, shape={args.shape})")


if __name__ == "__main__":
    main()
