/**
 * Sprite bundle packer (plan 135).
 *
 * Reads the per-Pokemon sprite folders emitted by `extract-sprites.ts`
 * (`<outputDir>/<name>/{atlas.png,atlas.json,offsets.json,portrait-normal.png}`)
 * and packs them into THREE shipped files, so the itch.io 1000-file limit no
 * longer scales with the roster size:
 *
 *   - `sprites.bin`            — every atlas.png + atlas.json concatenated raw.
 *   - `sprites-manifest.json`  — light index: byte ranges into the .bin, PMD
 *                                offsets, portrait cell index.
 *   - `portraits.png`          — single sheet of the 40x40 portraits (grid).
 *
 * Runtime (packages/view-core/src/sprite-bundle.ts) downloads the .bin once at
 * boot, then slices per-Pokemon blobs on demand (lazy GPU upload — VRAM stays
 * per-combatant). The per-Pokemon folders remain on disk as source/cache but are
 * gitignored and never shipped.
 *
 * Usage: pnpm pack-sprites   (run after `pnpm extract-sprites`)
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { HeldItemId } from "../packages/core/src/enums/held-item-id.js";

interface SpriteConfig {
  pokedexEntries: { name: string }[];
  outputDir: string;
}

/** Byte range `[offset, length]` into `sprites.bin`. */
type ByteRange = [number, number];

interface ManifestEntry {
  png: ByteRange;
  json: ByteRange;
}

interface SpriteOffsets {
  footOffsetY: number;
  headOffsetY: number;
  shadowSize: number;
}

interface SpriteManifest {
  version: number;
  /** Grid geometry of `portraits.png`. */
  portraitGrid: { cols: number; cell: number };
  /** Grid geometry of `item-icons.png`. */
  itemIconGrid: { cols: number; cell: number };
  /** Per-Pokemon byte ranges into `sprites.bin`. */
  atlas: Record<string, ManifestEntry>;
  /** Per-Pokemon PMD grounding offsets (small — inlined here, not in the .bin). */
  offsets: Record<string, SpriteOffsets>;
  /** Per-Pokemon portrait cell index into `portraits.png`. */
  portraits: Record<string, number>;
  /** Per-item icon cell index into `item-icons.png` (keyed by HeldItemId). */
  itemIcons: Record<string, number>;
}

const ROOT_DIR = resolve(import.meta.dirname, "..");
const MANIFEST_VERSION = 2;
const PORTRAIT_CELL = 40;
const PORTRAIT_COLS = 32;
const ITEM_ICON_CELL = 24;
const ITEM_ICON_COLS = 16;

function loadConfig(): SpriteConfig {
  const configPath = join(ROOT_DIR, "scripts/sprite-config.json");
  return JSON.parse(readFileSync(configPath, "utf-8")) as SpriteConfig;
}

/** Names to pack, in `sprite-config` order, restricted to folders that actually carry an atlas. */
function resolvePackOrder(config: SpriteConfig, spritesRoot: string): string[] {
  const ordered = config.pokedexEntries.map((entry) => entry.name);
  // Any extra folder on disk not listed in the config (manual additions) is appended,
  // sorted, so the bundle stays deterministic and nothing silently drops out.
  const onDisk = readdirSync(spritesRoot).filter((name) =>
    statSync(join(spritesRoot, name)).isDirectory(),
  );
  const extra = onDisk.filter((name) => !ordered.includes(name)).sort();
  return [...ordered, ...extra].filter((name) => existsSync(join(spritesRoot, name, "atlas.png")));
}

async function main(): Promise<void> {
  const config = loadConfig();
  const spritesRoot = join(ROOT_DIR, config.outputDir);
  const bundleDir = resolve(spritesRoot, "..");

  const names = resolvePackOrder(config, spritesRoot);
  if (names.length === 0) {
    throw new Error(`No sprite folders found under ${spritesRoot} — run extract-sprites first.`);
  }

  const binChunks: Buffer[] = [];
  let cursor = 0;
  const atlas: SpriteManifest["atlas"] = {};
  const offsets: SpriteManifest["offsets"] = {};
  const portraits: SpriteManifest["portraits"] = {};
  const portraitComposites: sharp.OverlayOptions[] = [];
  let portraitIndex = 0;

  const append = (buffer: Buffer): ByteRange => {
    const range: ByteRange = [cursor, buffer.length];
    binChunks.push(buffer);
    cursor += buffer.length;
    return range;
  };

  for (const name of names) {
    const dir = join(spritesRoot, name);
    const pngBuffer = readFileSync(join(dir, "atlas.png"));
    const jsonBuffer = readFileSync(join(dir, "atlas.json"));

    atlas[name] = { png: append(pngBuffer), json: append(jsonBuffer) };

    const rawOffsets = JSON.parse(readFileSync(join(dir, "offsets.json"), "utf-8")) as {
      footOffsetY?: number;
      headOffsetY?: number;
      shadowSize?: number;
    };
    offsets[name] = {
      footOffsetY: rawOffsets.footOffsetY ?? 4,
      headOffsetY: rawOffsets.headOffsetY ?? 0,
      shadowSize: rawOffsets.shadowSize ?? 1,
    };

    const portraitPath = join(dir, "portrait-normal.png");
    if (existsSync(portraitPath)) {
      const col = portraitIndex % PORTRAIT_COLS;
      const row = Math.floor(portraitIndex / PORTRAIT_COLS);
      portraitComposites.push({
        input: portraitPath,
        left: col * PORTRAIT_CELL,
        top: row * PORTRAIT_CELL,
      });
      portraits[name] = portraitIndex;
      portraitIndex += 1;
    }
  }

  // item-icons.png — grid sheet of the held-item icons, indexed by HeldItemId.
  // Source PNGs (24×24) live gitignored under `<bundleDir>/item-icons/`, produced
  // by `extract-item-icons.ts`. Packed here into one sheet so the runtime loads a
  // single image (mirror of portraits.png).
  const itemIconsDir = join(bundleDir, "item-icons");
  const itemIcons: SpriteManifest["itemIcons"] = {};
  const itemIconComposites: sharp.OverlayOptions[] = [];
  let itemIconIndex = 0;
  const missingItemIcons: string[] = [];
  for (const itemId of Object.values(HeldItemId)) {
    const iconPath = join(itemIconsDir, `${itemId}.png`);
    if (!existsSync(iconPath)) {
      missingItemIcons.push(itemId);
      continue;
    }
    const col = itemIconIndex % ITEM_ICON_COLS;
    const row = Math.floor(itemIconIndex / ITEM_ICON_COLS);
    itemIconComposites.push({
      input: iconPath,
      left: col * ITEM_ICON_CELL,
      top: row * ITEM_ICON_CELL,
    });
    itemIcons[itemId] = itemIconIndex;
    itemIconIndex += 1;
  }
  if (missingItemIcons.length > 0) {
    throw new Error(
      `Missing ${missingItemIcons.length} item icon PNG(s) — run \`pnpm extract-item-icons\` first:\n  ${missingItemIcons.join(", ")}`,
    );
  }

  // sprites.bin
  const bin = Buffer.concat(binChunks);
  writeFileSync(join(bundleDir, "sprites.bin"), bin);

  // item-icons.png — grid (cols × ceil(N/cols) cells of 24×24).
  const itemIconRows = Math.max(1, Math.ceil(itemIconIndex / ITEM_ICON_COLS));
  const itemIconSheet = await sharp({
    create: {
      width: ITEM_ICON_COLS * ITEM_ICON_CELL,
      height: itemIconRows * ITEM_ICON_CELL,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(itemIconComposites)
    .png()
    .toBuffer();
  writeFileSync(join(bundleDir, "item-icons.png"), itemIconSheet);

  // portraits.png — grid sheet (cols × ceil(N/cols) cells of 40×40).
  const portraitRows = Math.max(1, Math.ceil(portraitIndex / PORTRAIT_COLS));
  const portraitSheet = await sharp({
    create: {
      width: PORTRAIT_COLS * PORTRAIT_CELL,
      height: portraitRows * PORTRAIT_CELL,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(portraitComposites)
    .png()
    .toBuffer();
  writeFileSync(join(bundleDir, "portraits.png"), portraitSheet);

  // sprites-manifest.json
  const manifest: SpriteManifest = {
    version: MANIFEST_VERSION,
    portraitGrid: { cols: PORTRAIT_COLS, cell: PORTRAIT_CELL },
    itemIconGrid: { cols: ITEM_ICON_COLS, cell: ITEM_ICON_CELL },
    atlas,
    offsets,
    portraits,
    itemIcons,
  };
  writeFileSync(join(bundleDir, "sprites-manifest.json"), JSON.stringify(manifest));

  const mb = (bytes: number): string => `${(bytes / 1_048_576).toFixed(1)} MB`;
  console.log(
    `Packed ${names.length} sprites → sprites.bin (${mb(bin.length)}), ` +
      `${portraitIndex} portraits → portraits.png (${PORTRAIT_COLS}×${portraitRows}), ` +
      `${itemIconIndex} item icons → item-icons.png (${ITEM_ICON_COLS}×${itemIconRows}), ` +
      `manifest v${MANIFEST_VERSION}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
