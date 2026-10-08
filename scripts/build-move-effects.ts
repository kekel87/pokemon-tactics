/**
 * Move-effect sheet build (plan 234, VFX lot 2a).
 *
 * Downloads the PMD Origins particles the generic move effects use (PMDCollab/RawAsset, no licence
 * of its own: rips of the Mystery Dungeon games) into `assets-src/effects/pmdo/` — gitignored
 * source/cache, like the per-Pokémon sprite folders — then packs them into ONE shipped sheet,
 * `packages/app/public/assets/effects/move-effects.png`, and writes its index as a generated module,
 * `packages/render-babylon/src/move-effect-atlas.ts`. One file added to the build, whatever the
 * number of effects (itch.io's 1000-file wall, decision-1138).
 *
 * A RawAsset particle strip is `<Name>.<Mode>.png`: square frames side by side, one row per
 * direction (`None` / `Dir1` = one row, `DirN` = N rows) — the frame size is the row height.
 *
 * Usage: pnpm build-move-effects (re-downloads only what is missing from the cache)
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const ROOT_DIR = resolve(import.meta.dirname, "..");
const CACHE_DIR = join(ROOT_DIR, "assets-src/effects/pmdo");
const SHEET_PATH = join(ROOT_DIR, "packages/app/public/assets/effects/move-effects.png");
const ATLAS_MODULE_PATH = join(ROOT_DIR, "packages/render-babylon/src/move-effect-atlas.ts");
const RAW_ASSET_URL = "https://raw.githubusercontent.com/PMDCollab/RawAsset/master";
const SHEET_WIDTH = 2048;
const PADDING = 1;

/**
 * Beam parts (`Beam/<Name>/{Head,Body,Tail}.png`) are not square: their frame count comes from the
 * beam's BeamData.xml (`TotalFrames`), given here.
 */
const BEAM_FRAMES: Readonly<Record<string, number>> = {
  "beam-body": 14,
  "beam-head": 14,
};

/** Sheet entry key → RawAsset path. */
const SOURCES: Readonly<Record<string, string>> = {
  "beam-body": "Beam/Column_White/Body.png",
  "beam-head": "Beam/Column_White/Head.png",
  "mark-bite": "Particle/Bite.Dir8.png",
  "mark-slash": "Particle/Slash_RSE.None.png",
  "mark-claw": "Particle/Scratch.Dir1.png",
  "mark-jab": "Particle/Fury_Attack.Dir8.png",
  "wide-slash": "Particle/Wide_Slash.Dir8.png",
  "mark-punch": "Particle/Print_Fist.None.png",
  "mark-kick": "Particle/Print_Foot.None.png",
  "mark-chop": "Particle/Print_Hand.None.png",
  gust: "Particle/Gust_Wind.None.png",
  notes: "Particle/Music_Notes.None.png",
  cry: "Particle/Growl.Dir8.png",
  gaze: "Particle/Leer.None.png",
  screen: "Particle/Screen_RSE_Gray.None.png",
  hit: "Particle/Hit_Neutral.None.png",
  "hit-strong": "Particle/Hit_Super_Effective.None.png",
  orb: "Particle/Light_Ball_White.None.png",
  puff: "Particle/Puff_White.None.png",
  smoke: "Particle/Smoke_White.None.png",
  ring: "Particle/Circle_White_Out.None.png",
  wave: "Particle/Wave_Circle_White.Dir5.png",
  "stat-line": "Particle/Stat_White_Line.Dir1.png",
  "stat-ring": "Particle/Stat_White_Ring.None.png",
  sparkle: "Particle/Sparkle_RSE.None.png",
  "status-burned": "Particle/Burned.None.png",
  "status-poisoned": "Particle/Bubbles_Purple.None.png",
  "status-asleep": "Particle/Sleep_Z.None.png",
  "status-paralyzed": "Particle/Spark.None.png",
  "status-frozen": "Particle/Ice_Pieces.None.png",
  "status-confused": "Particle/Emote_Question.None.png",
  "status-infatuated": "Particle/Charm_Heart.None.png",
  shield: "Particle/Protect.None.png",
  "blocked-ring": "Particle/Circle_Small_Blue_In.None.png",
  "heal-sparkle": "Particle/Event_Gather_Sparkle.None.png",
  "projectile-fire": "Particle/Ember.None.png",
  "projectile-grass": "Particle/Razor_Leaf.None.png",
  "projectile-ice": "Particle/Ice_Ball.None.png",
  "projectile-ghost": "Particle/Shadow_Ball.None.png",
  "projectile-ground": "Particle/Mud_Shot_Ball.None.png",
  "projectile-steel": "Particle/Metal_Ball_Ranger.None.png",
  "projectile-dragon": "Particle/Dragon_Pulse_Ball.None.png",
  "projectile-rock": "Particle/Rock_Pieces.None.png",
};

/**
 * Strips drawn in colour that the move's type should tint instead: turned to light greys here, so
 * the tint (a multiply) gives the type's colour rather than a muddy mix.
 */
const GREYED = new Set([
  "mark-slash",
  "mark-claw",
  "mark-jab",
  "mark-punch",
  "mark-kick",
  "mark-chop",
  "wide-slash",
]);

/** Direction rows of a strip, from its RawAsset name: `.None` / `.Dir1` = 1, `.DirN` = N. */
function rowsOf(path: string): number {
  return Number(/\.Dir(\d+)\./.exec(path)?.[1] ?? 1);
}

interface Entry {
  key: string;
  file: string;
  width: number;
  height: number;
  rows: number;
  frames: number;
}

async function ensureCached(key: string, path: string): Promise<string> {
  const file = join(CACHE_DIR, `${key}.png`);
  if (existsSync(file)) {
    return file;
  }
  const url = `${RAW_ASSET_URL}/${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

async function main(): Promise<void> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const entries: Entry[] = [];
  for (const [key, path] of Object.entries(SOURCES)) {
    const file = await ensureCached(key, path);
    const metadata = await sharp(readFileSync(file)).metadata();
    if (metadata.width === undefined || metadata.height === undefined) {
      throw new Error(`Unreadable image: ${file}`);
    }
    const rows = rowsOf(path);
    // Square frames side by side, one row per direction — unless the strip says otherwise (beams).
    const frames = BEAM_FRAMES[key] ?? metadata.width / (metadata.height / rows);
    entries.push({ key, file, width: metadata.width, height: metadata.height, rows, frames });
  }

  // Shelf packing, tallest first: the sheet is small (a few hundred kB), no need for better.
  const placed: { entry: Entry; x: number; y: number }[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let shelfHeight = 0;
  for (const entry of [...entries].sort((a, b) => b.height - a.height)) {
    if (entry.width > SHEET_WIDTH) {
      throw new Error(`${entry.key} is wider than the sheet (${entry.width}px)`);
    }
    if (cursorX + entry.width > SHEET_WIDTH) {
      cursorX = 0;
      cursorY += shelfHeight + PADDING;
      shelfHeight = 0;
    }
    placed.push({ entry, x: cursorX, y: cursorY });
    cursorX += entry.width + PADDING;
    shelfHeight = Math.max(shelfHeight, entry.height);
  }
  const sheetHeight = cursorY + shelfHeight;

  mkdirSync(join(SHEET_PATH, ".."), { recursive: true });
  await sharp({
    create: {
      width: SHEET_WIDTH,
      height: sheetHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(
      await Promise.all(
        placed.map(async ({ entry, x, y }) => ({
          input: GREYED.has(entry.key)
            ? await sharp(entry.file).modulate({ saturation: 0, brightness: 1.6 }).png().toBuffer()
            : entry.file,
          left: x,
          top: y,
        })),
      ),
    )
    .png({ compressionLevel: 9 })
    .toFile(SHEET_PATH);

  const lines = placed
    .sort((a, b) => a.entry.key.localeCompare(b.entry.key))
    .map(({ entry, x, y }) => {
      const frameWidth = entry.width / entry.frames;
      const frameHeight = entry.height / entry.rows;
      return `  "${entry.key}": { x: ${x}, y: ${y}, frameWidth: ${frameWidth}, frameHeight: ${frameHeight}, frames: ${entry.frames}, rows: ${entry.rows} },`;
    });
  const module = `// Generated by scripts/build-move-effects.ts — do not edit (plan 234).

/** Where each effect strip sits in \`assets/effects/move-effects.png\`, in sheet pixels. */
export interface MoveEffectStrip {
  x: number;
  y: number;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  /** One row per direction (PMD Dir8 order: Down, DownLeft, Left, UpLeft, Up, UpRight, Right, DownRight). */
  rows: number;
}

export const MOVE_EFFECT_SHEET_URL = "assets/effects/move-effects.png";
export const MOVE_EFFECT_SHEET_WIDTH = ${SHEET_WIDTH};
export const MOVE_EFFECT_SHEET_HEIGHT = ${sheetHeight};

export const MOVE_EFFECT_STRIPS = {
${lines.join("\n")}
} as const satisfies Record<string, MoveEffectStrip>;

export type MoveEffectStripKey = keyof typeof MOVE_EFFECT_STRIPS;
`;
  writeFileSync(ATLAS_MODULE_PATH, module);
  // Through the project formatter, so a rebuild never leaves a lint diff behind.
  execFileSync("pnpm", ["exec", "biome", "format", "--write", ATLAS_MODULE_PATH], {
    cwd: ROOT_DIR,
  });
  console.log(`move-effects.png ${SHEET_WIDTH}×${sheetHeight}, ${entries.length} strips`);
}

await main();
