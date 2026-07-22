/**
 * Held-item icon extraction (plan 168).
 *
 * Pokémon Showdown does NOT serve an individual PNG for every item under
 * `sprites/itemicons/` — only a legacy subset (single-word item names) has one.
 * The complete, authoritative source is the combined spritesheet
 * `sprites/itemicons-sheet.png` (16 columns × 24px cells), indexed by each item's
 * `spritenum` field in `data/items.js`.
 *
 * This script downloads both, maps every `HeldItemId` (kebab) → Showdown id
 * (`toShowdownId`) → `spritenum`, and slices its 24×24 cell out of the sheet into
 * `packages/app/public/assets/sprites/item-icons/<kebab-id>.png`.
 *
 * The per-item PNGs are gitignored source/cache — `pack-sprites.ts` composites them
 * into the shipped `item-icons.png`. Run before `pnpm pack-sprites`.
 *
 * Usage: pnpm extract-item-icons
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { HeldItemId } from "../packages/core/src/enums/held-item-id.js";
import { toShowdownId } from "../packages/core/src/team/showdown-id.js";

const ROOT_DIR = resolve(import.meta.dirname, "..");
const OUTPUT_DIR = join(ROOT_DIR, "packages/app/public/assets/sprites/item-icons");
const SHEET_URL = "https://play.pokemonshowdown.com/sprites/itemicons-sheet.png";
const ITEMS_DATA_URL = "https://play.pokemonshowdown.com/data/items.js";
const ICON_COLS = 16;
const ICON_CELL = 24;

/**
 * Extract each item's `spritenum` from Showdown's `data/items.js` without eval.
 *
 * The file is minified to a single line: `exports.BattleItems = {abomasite:{name:
 * "Abomasnow",spritenum:575,fling:{...}},...}`. `spritenum` can sit before OR after a
 * nested object, so we split top-level item blocks by walking brace depth (string-aware),
 * then read each block's own `spritenum`. Avoids running remote code.
 */
async function fetchItemSpritenums(): Promise<Map<string, number>> {
  const response = await fetch(ITEMS_DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${ITEMS_DATA_URL}: ${response.status}`);
  }
  const source = await response.text();
  const spritenums = new Map<string, number>();
  const keyStart = /([a-z0-9]+):\{/y; // sticky: match an item key exactly at `cursor`
  const start = source.indexOf("{");
  let cursor = start + 1;
  while (cursor < source.length) {
    keyStart.lastIndex = cursor;
    const keyMatch = keyStart.exec(source);
    if (!keyMatch) {
      break; // reached the closing `}` of BattleItems (or end)
    }
    const itemId = keyMatch[1];
    // Walk the item's brace-balanced block, honoring string literals.
    let depth = 1;
    let index = keyStart.lastIndex;
    let inString: string | null = null;
    for (; index < source.length && depth > 0; index += 1) {
      const char = source[index];
      if (inString) {
        if (char === "\\") {
          index += 1;
        } else if (char === inString) {
          inString = null;
        }
      } else if (char === '"' || char === "'") {
        inString = char;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
      }
    }
    const block = source.slice(keyStart.lastIndex, index);
    const spriteMatch = /spritenum:(\d+)/.exec(block);
    if (spriteMatch) {
      spritenums.set(itemId, Number(spriteMatch[1]));
    }
    // Skip the trailing `,` (or land on `}`) before the next item key.
    cursor = source[index] === "," ? index + 1 : index;
  }
  if (spritenums.size === 0) {
    throw new Error("Parsed no spritenum from items.js — Showdown format may have changed.");
  }
  return spritenums;
}

async function fetchSheet(): Promise<Buffer> {
  const response = await fetch(SHEET_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${SHEET_URL}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main(): Promise<void> {
  const [spritenums, sheet] = await Promise.all([fetchItemSpritenums(), fetchSheet()]);
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const kebabIds = Object.values(HeldItemId);
  const missing: string[] = [];
  let written = 0;

  for (const kebabId of kebabIds) {
    const showdownId = toShowdownId(kebabId);
    const spritenum = spritenums.get(showdownId);
    if (spritenum === undefined) {
      missing.push(`${kebabId} (showdown="${showdownId}")`);
      continue;
    }
    const left = (spritenum % ICON_COLS) * ICON_CELL;
    const top = Math.floor(spritenum / ICON_COLS) * ICON_CELL;
    const icon = await sharp(sheet)
      .extract({ left, top, width: ICON_CELL, height: ICON_CELL })
      .png()
      .toBuffer();
    writeFileSync(join(OUTPUT_DIR, `${kebabId}.png`), icon);
    written += 1;
  }

  if (missing.length > 0) {
    throw new Error(
      `No spritenum for ${missing.length} item(s) — cannot resolve an icon:\n  ${missing.join("\n  ")}`,
    );
  }
  console.log(
    `Extracted ${written}/${kebabIds.length} item icons (${ICON_CELL}×${ICON_CELL}) → ${OUTPUT_DIR}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
