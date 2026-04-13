# scripts/

Utility scripts used during development. Not bundled in any package build.

## Terrain tileset pipeline (plan 050)

Five Python scripts that turn flat PMD textures into custom isometric tiles.
Requires Python 3.10+ and Pillow (`pip install Pillow`).

### Folder conventions

- `docs/references/pmd-tilesets/<terrain>/*.png` — original PMD Spriters Resource
  sheets, organised by terrain (rock, sand, water, ...). **Read-only references**,
  gitignored.
- `tiles/work/` — scratch space for the pipeline. Extracted 24×24 source textures,
  per-shape preview tiles, per-terrain columns, the assembled tileset, debug
  comparisons. Gitignored.
- `packages/renderer/public/assets/tilesets/terrain/tileset.png` — the
  final tileset image consumed by the renderer (committed).

### 1. `extract-pmd-tile.py` — lift tiles out of a PMD Spriters Resource sheet

The Pokemon Mystery Dungeon outdoor sheets from spriters-resource.com all
share the same grid layout:

| Property | Value |
|----------|-------|
| Tile size | 24×24 px |
| Step | 25 px (tile + 1 px cyan grid line) |
| Grid line colour | `(128, 255, 255)` |
| Background colour | `(0, 128, 128)` |
| Y origin (first tile row) | 163 |
| X origin | 8 or 9 — auto-detected by scanning for the first vertical grid line |

Usage:

```bash
# 1. Label every cell with col/row indices so you can pick what you want
python3 scripts/extract-pmd-tile.py path/to/sheet.png --scan

# 2. Extract one 24×24 tile at global (col, row)
python3 scripts/extract-pmd-tile.py path/to/sheet.png --col 13 --row 1
python3 scripts/extract-pmd-tile.py path/to/sheet.png --col 13 --row 1 --out custom.png
```

`--scan` writes `<sheet>_scan.png` next to the input. Cells full of background
are dimmed so the populated columns stand out.

Note: sheets vary in width and section layout (Ground/Water/etc are in
different columns depending on the dungeon). Always `--scan` a new sheet
before extracting from it.

### 2. `make-iso-tile.py` — build one isometric tile from two flat textures

Warps a top texture onto an iso diamond and a side texture onto the visible
flank parallelograms, then fills polygon-rasterisation gaps at the shared
edges. Output is a 32×32 PNG matching our canvas conventions.

Supported shapes:

| `--shape` | Description | Visible faces |
|-----------|-------------|---------------|
| `full` (default) | Unit cube | top + south flank + east flank |
| `half` | Half-height block | top (shifted down) + south + east (8 px deep) |
| `ramp-s` | Slope descending toward the viewer (cardinal S) | sloped top + east triangle |
| `stairs-s` | 4-step staircase ascending northward | 4 tops + 3 risers + 4 east walls |

East-facing variants (`ramp-e`, `stairs-e`) are produced at map-render time
via Tiled's horizontal flip bit — the renderer supports it
(`decodeTiledGid` in `packages/data/src/tiled/tiled-utils.ts`).

Usage:

```bash
python3 scripts/make-iso-tile.py \
  --top  forest-path-ground.png \
  --side lightning-field-ground.png \
  --out  tile.png

# Separate texture per flank (rare)
python3 scripts/make-iso-tile.py \
  --top top.png --side left.png --side-right right.png \
  --out tile.png

# Other shapes
python3 scripts/make-iso-tile.py --shape half     ...
python3 scripts/make-iso-tile.py --shape ramp-s   ...
python3 scripts/make-iso-tile.py --shape stairs-s ...
```

#### Canvas conventions

- 32×32 px canvas. Top face occupies `y=0..16`, base at `y=16..32`.
- Elevation 1 corresponds to the top of a flat cube (y=0..16); elevation 0
  to the base (y=16..32). One elevation unit = `DEPTH = 16` canvas px.
- Coordinate helpers: `iso(gx, gy, e)` projects grid (gx, gy) at elevation
  e onto the tile canvas.
- Brightness: top face 1.0, south flank 0.75, east flank 0.55.

Input textures can be any square resolution — PMD 24×24 works but any size
is accepted (AFFINE inverse maps the parallelogram back into the source
coordinate space).

### 3. `build-terrain.py` — one command, one full terrain column

Wraps `make-iso-tile.py` to produce all 5 canonical tiles and stacks them
into a single 32×160 vertical strip (top→bottom):

| Row | Tile | Shape | Flank texture |
|-----|------|-------|---------------|
| 0 | `full`     | full     | side |
| 1 | `half-a`   | half     | top  (homogeneous flank) |
| 2 | `half-b`   | half     | side (generic flank) |
| 3 | `ramp-s`   | ramp-s   | side |
| 4 | `stairs-s` | stairs-s | side |

```bash
python3 scripts/build-terrain.py --name normal-grass \
  --top  forest-path-ground.png \
  --side lightning-field-ground.png \
  --out  col-normal-grass.png
```

Final tileset assembly (per plan 050) stacks columns VERTICALLY with empty
separator rows between groups. See `docs/tileset-mapping.md` for the actual
layout in use.

### 4. `assemble-tileset.py` — stack terrain columns into the final tileset

Takes the per-terrain columns produced by `build-terrain.py` and concatenates
them vertically with an empty separator row between groups. The order of
`--solid` / `--liquid` arguments on the command line is the order of the
groups in the output (top-to-bottom).

```bash
python3 scripts/assemble-tileset.py \
  --solid  herbe  tiles/work/col-herbe.png \
  --solid  roche  tiles/work/col-roche.png \
  --solid  sable  tiles/work/col-sable.png \
  --solid  path   tiles/work/col-path.png \
  --liquid eau    tiles/work/col-eau.png \
  --out    packages/renderer/public/assets/tilesets/terrain/custom-tileset.png
```

The output is a `32 × (32 × total_rows)` PNG. For N solids + M liquids,
total_rows = 6*N + 2*M (5 role rows + 1 separator per solid, 1 + 1 per
liquid). The script prints the `row → tile_id → terrain` mapping so you can
update `docs/tileset-mapping.md` accordingly.

### External tileset reference

The final tileset lives at
`packages/renderer/public/assets/tilesets/terrain/tileset.png`, paired with
`tileset.tsj` (shared tile properties: terrain, height, slope). Every `.tmj`
in `packages/renderer/public/assets/maps/` references it via
`{ "firstgid": 1, "source": "../tilesets/terrain/tileset.tsj" }`. Edit
`tileset.tsj` once to update properties for all 24 maps at once.

One-shot migration scripts (JAO → custom, MVP 5-terrains → 15-terrains,
inline tilesets → external reference) were removed after migration — see
`docs/plans/050-custom-tileset.md` for the historical record if needed.

## Unrelated sprite scripts

- `extract-sprites.ts`, `sprite-config.json` — Pokemon sprite extraction
  pipeline (pre-PMD, used by the renderer). See file headers.
- `download-status-icons.ts`, `download-type-icons.ts` — one-shot
  downloaders for UI assets.
- `generate-golden-replay.ts` — regenerates golden replays for core tests.
