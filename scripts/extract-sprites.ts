/**
 * PMDCollab Sprite Extraction Script
 *
 * Downloads sprites from PMDCollab/SpriteCollab repository,
 * parses AnimData.xml, and generates Phaser texture atlases + portraits.
 *
 * Usage: npx tsx scripts/extract-sprites.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { XMLParser } from "fast-xml-parser";
import sharp from "sharp";

interface SpriteConfig {
  pokedexEntries: PokedexEntry[];
  animations: string[];
  portraits: string[];
  directions: string[];
  baseUrl: string;
  outputDir: string;
}

interface PokedexEntry {
  number: string;
  name: string;
  form?: string;
}

interface ParsedAnimation {
  name: string;
  index: number;
  frameWidth: number;
  frameHeight: number;
  durations: number[];
  rushFrame?: number;
  hitFrame?: number;
  returnFrame?: number;
}

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: false;
  trimmed: false;
  spriteSourceSize: { x: 0; y: 0; w: number; h: number };
  sourceSize: { w: number; h: number };
}

interface AtlasMetadata {
  animations: Record<
    string,
    {
      frameWidth: number;
      frameHeight: number;
      durations: number[];
      rushFrame?: number;
      hitFrame?: number;
      returnFrame?: number;
    }
  >;
}

interface SpriteOffsets {
  footOffsetY: number;
  headOffsetY: number;
  bodyOffsetY: number;
  idleFrameHeight: number;
  shadowSize: number;
}

const ALL_DIRECTION_NAMES = [
  "South",
  "SouthEast",
  "East",
  "NorthEast",
  "North",
  "NorthWest",
  "West",
  "SouthWest",
];

const ROOT_DIR = resolve(import.meta.dirname, "..");

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseAnimData(xmlContent: string): ParsedAnimation[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name) => name === "Duration" || name === "Anim",
  });
  const parsed = parser.parse(xmlContent);
  const anims = parsed.AnimData.Anims.Anim;

  const animMap = new Map<string, ParsedAnimation>();

  for (const anim of anims) {
    if (anim.CopyOf !== undefined) {
      continue;
    }

    const durations = anim.Durations?.Duration ?? [];
    const durationArray = Array.isArray(durations) ? durations : [durations];

    animMap.set(anim.Name, {
      name: anim.Name,
      index: anim.Index,
      frameWidth: anim.FrameWidth,
      frameHeight: anim.FrameHeight,
      durations: durationArray.map(Number),
      rushFrame: anim.RushFrame,
      hitFrame: anim.HitFrame,
      returnFrame: anim.ReturnFrame,
    });
  }

  // Resolve CopyOf references — some animations are aliases of others in AnimData.xml
  for (const anim of anims) {
    if (anim.CopyOf !== undefined && !animMap.has(anim.Name)) {
      const source = animMap.get(anim.CopyOf);
      if (source) {
        animMap.set(anim.Name, { ...source, name: anim.Name, index: anim.Index });
      }
    }
  }

  return [...animMap.values()];
}

/**
 * PMDCollab spritesheets layout: columns = frames, rows = 8 directions.
 * Each cell is FrameWidth × FrameHeight pixels.
 */
async function extractFrames(
  sheetBuffer: Buffer,
  animation: ParsedAnimation,
  directionIndices: number[],
): Promise<{ direction: number; frameIndex: number; buffer: Buffer }[]> {
  const frameCount = animation.durations.length;
  const frames: { direction: number; frameIndex: number; buffer: Buffer }[] = [];

  const metadata = await sharp(sheetBuffer).metadata();
  const sheetWidth = metadata.width ?? 0;
  const sheetHeight = metadata.height ?? 0;

  for (const dirIndex of directionIndices) {
    for (let frameIdx = 0; frameIdx < frameCount; frameIdx++) {
      const x = frameIdx * animation.frameWidth;
      const y = dirIndex * animation.frameHeight;

      if (x + animation.frameWidth > sheetWidth || y + animation.frameHeight > sheetHeight) {
        continue;
      }

      const frameBuffer = await sharp(sheetBuffer)
        .extract({
          left: x,
          top: y,
          width: animation.frameWidth,
          height: animation.frameHeight,
        })
        .png()
        .toBuffer();

      frames.push({ direction: dirIndex, frameIndex: frameIdx, buffer: frameBuffer });
    }
  }

  return frames;
}

interface PackedFrame {
  key: string;
  buffer: Buffer;
  width: number;
  height: number;
  x: number;
  y: number;
}

function packFrames(allFrames: { key: string; buffer: Buffer; width: number; height: number }[]): {
  packed: PackedFrame[];
  atlasWidth: number;
  atlasHeight: number;
} {
  const sorted = [...allFrames].sort((a, b) => b.height - a.height || b.width - a.width);

  const maxWidth = 2048;
  const packed: PackedFrame[] = [];
  let currentX = 0;
  let currentY = 0;
  let rowHeight = 0;
  let atlasWidth = 0;

  for (const frame of sorted) {
    if (currentX + frame.width > maxWidth) {
      currentY += rowHeight;
      currentX = 0;
      rowHeight = 0;
    }

    packed.push({
      ...frame,
      x: currentX,
      y: currentY,
    });

    atlasWidth = Math.max(atlasWidth, currentX + frame.width);
    rowHeight = Math.max(rowHeight, frame.height);
    currentX += frame.width;
  }

  const atlasHeight = currentY + rowHeight;
  return { packed, atlasWidth, atlasHeight };
}

async function compositeAtlas(
  packed: PackedFrame[],
  width: number,
  height: number,
): Promise<Buffer> {
  const composites = packed.map((frame) => ({
    input: frame.buffer,
    left: frame.x,
    top: frame.y,
  }));

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

function buildAtlasJson(
  packed: PackedFrame[],
  atlasWidth: number,
  atlasHeight: number,
  animations: ParsedAnimation[],
  directionNames: string[],
): { atlas: Record<string, unknown>; metadata: AtlasMetadata } {
  const frames: Record<string, AtlasFrame> = {};

  for (const frame of packed) {
    frames[frame.key] = {
      frame: { x: frame.x, y: frame.y, w: frame.width, h: frame.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frame.width, h: frame.height },
      sourceSize: { w: frame.width, h: frame.height },
    };
  }

  const animationMetadata: AtlasMetadata["animations"] = {};
  for (const anim of animations) {
    animationMetadata[anim.name] = {
      frameWidth: anim.frameWidth,
      frameHeight: anim.frameHeight,
      durations: anim.durations,
      ...(anim.rushFrame !== undefined && { rushFrame: anim.rushFrame }),
      ...(anim.hitFrame !== undefined && { hitFrame: anim.hitFrame }),
      ...(anim.returnFrame !== undefined && { returnFrame: anim.returnFrame }),
    };
  }

  const atlas = {
    frames,
    meta: {
      app: "pokemon-tactics/extract-sprites",
      version: "1.0",
      image: "atlas.png",
      format: "RGBA8888",
      size: { w: atlasWidth, h: atlasHeight },
      scale: "1",
      animations: animationMetadata,
      directions: directionNames,
    },
  };

  return { atlas, metadata: { animations: animationMetadata } };
}

function parseShadowSize(xmlContent: string): number {
  const match = xmlContent.match(/<ShadowSize>(\d+)<\/ShadowSize>/);
  return match ? Number(match[1]) : 1;
}

async function parseOffsetsFromSheet(
  sheetBuffer: Buffer,
  frameWidth: number,
  frameHeight: number,
  directionIndex: number,
): Promise<{ headOffsetY: number; bodyOffsetY: number }> {
  const centerY = Math.floor(frameHeight / 2);

  const { data, info } = await sharp(sheetBuffer)
    .extract({
      left: 0,
      top: directionIndex * frameHeight,
      width: frameWidth,
      height: frameHeight,
    })
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  let headY = centerY;
  let bodyY = centerY;
  let foundHead = false;
  let foundBody = false;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      if (a === 0) continue;

      // BLACK pixel = head position
      if (!foundHead && r < 30 && g < 30 && b < 30 && a >= 250) {
        headY = y;
        foundHead = true;
      }
      // GREEN pixel = body center
      if (!foundBody && g >= 200 && r < 100 && b < 100 && a >= 250) {
        bodyY = y;
        foundBody = true;
      }
    }
  }

  return {
    headOffsetY: headY - centerY,
    bodyOffsetY: bodyY - centerY,
  };
}

async function downloadPortrait(
  baseUrl: string,
  pokedexNumber: string,
  emotion: string,
): Promise<Buffer> {
  const url = `${baseUrl}/portrait/${pokedexNumber}/${emotion}.png`;
  return fetchBuffer(url);
}

async function extractPokemon(entry: PokedexEntry, config: SpriteConfig): Promise<void> {
  const spritePath = entry.form ? `${entry.number}/${entry.form}` : entry.number;
  const spriteBaseUrl = `${config.baseUrl}/sprite/${spritePath}`;
  const outputPath = join(ROOT_DIR, config.outputDir, entry.name);

  console.log(`\n--- Extracting ${entry.name} (#${entry.number}) ---`);

  console.log("  Downloading AnimData.xml...");
  const animDataXml = await fetchText(`${spriteBaseUrl}/AnimData.xml`);
  const allAnimations = parseAnimData(animDataXml);

  const requestedAnimations = allAnimations.filter((anim) => config.animations.includes(anim.name));

  const missing = config.animations.filter(
    (name) => !requestedAnimations.some((a) => a.name === name),
  );
  if (missing.length > 0) {
    console.warn(`  Warning: animations not found: ${missing.join(", ")}`);
  }

  const directionIndices = config.directions.map((dir) => {
    const index = ALL_DIRECTION_NAMES.indexOf(dir);
    if (index === -1) throw new Error(`Unknown direction: ${dir}`);
    return index;
  });

  const allFrames: { key: string; buffer: Buffer; width: number; height: number }[] = [];

  for (const animation of requestedAnimations) {
    console.log(`  Downloading ${animation.name}-Anim.png...`);
    try {
      const sheetBuffer = await fetchBuffer(`${spriteBaseUrl}/${animation.name}-Anim.png`);

      const frames = await extractFrames(sheetBuffer, animation, directionIndices);

      for (const frame of frames) {
        const dirName = config.directions[directionIndices.indexOf(frame.direction)];
        const key = `${animation.name}-${dirName}-${frame.frameIndex}`;
        allFrames.push({
          key,
          buffer: frame.buffer,
          width: animation.frameWidth,
          height: animation.frameHeight,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  Warning: skipping ${animation.name} — ${message}`);
    }
  }

  console.log(`  Packing ${allFrames.length} frames into atlas...`);
  const { packed, atlasWidth, atlasHeight } = packFrames(allFrames);
  const atlasBuffer = await compositeAtlas(packed, atlasWidth, atlasHeight);
  const { atlas } = buildAtlasJson(
    packed,
    atlasWidth,
    atlasHeight,
    requestedAnimations,
    config.directions,
  );

  console.log("  Downloading portraits...");
  const portraitBuffers: { emotion: string; buffer: Buffer }[] = [];
  for (const emotion of config.portraits) {
    try {
      const portraitPath = entry.form ? `${entry.number}/${entry.form}` : entry.number;
      const buffer = await downloadPortrait(config.baseUrl, portraitPath, emotion);
      portraitBuffers.push({ emotion, buffer });
    } catch {
      console.warn(`  Warning: Could not download portrait "${emotion}", skipping`);
    }
  }

  console.log("  Extracting sprite offsets...");
  const idleAnim = requestedAnimations.find((a) => a.name === "Idle");
  const shadowSize = parseShadowSize(animDataXml);
  const footOffsetY = 4; // PMDCollab convention: WHITE pixel always at centerY + 4

  const idleFrameHeight = idleAnim?.frameHeight ?? 40;
  let spriteOffsets: SpriteOffsets = {
    footOffsetY,
    headOffsetY: -Math.floor(idleFrameHeight / 2),
    bodyOffsetY: -Math.floor(idleFrameHeight / 4),
    idleFrameHeight,
    shadowSize,
  };

  if (idleAnim) {
    const southWestIndex = ALL_DIRECTION_NAMES.indexOf("SouthWest");
    try {
      const offsetsSheet = await fetchBuffer(`${spriteBaseUrl}/Idle-Offsets.png`);
      const offsets = await parseOffsetsFromSheet(
        offsetsSheet,
        idleAnim.frameWidth,
        idleAnim.frameHeight,
        southWestIndex,
      );
      spriteOffsets = { ...spriteOffsets, ...offsets, idleFrameHeight };
      console.log(
        `  Offsets: head=${offsets.headOffsetY}, body=${offsets.bodyOffsetY}, shadow=${shadowSize}`,
      );
    } catch {
      console.warn("  Warning: Could not download Idle-Offsets.png, using defaults");
    }
  }

  console.log("  Downloading credits...");
  let credits = "";
  try {
    credits = await fetchText(`${spriteBaseUrl}/credits.txt`);
  } catch {
    console.warn("  Warning: Could not download credits.txt");
  }

  mkdirSync(outputPath, { recursive: true });

  writeFileSync(join(outputPath, "atlas.png"), atlasBuffer);
  writeFileSync(join(outputPath, "atlas.json"), JSON.stringify(atlas, null, 2));

  for (const { emotion, buffer } of portraitBuffers) {
    const filename = `portrait-${emotion.toLowerCase()}.png`;
    writeFileSync(join(outputPath, filename), buffer);
  }

  if (credits) {
    writeFileSync(join(outputPath, "credits.txt"), credits);
  }

  writeFileSync(join(outputPath, "offsets.json"), JSON.stringify(spriteOffsets, null, 2));

  console.log(
    `  Done! Atlas: ${atlasWidth}x${atlasHeight}, ${allFrames.length} frames, ${portraitBuffers.length} portrait(s)`,
  );
}

async function main(): Promise<void> {
  const configPath = join(ROOT_DIR, "scripts/sprite-config.json");
  const config: SpriteConfig = JSON.parse(readFileSync(configPath, "utf-8"));

  console.log("Pokemon Tactics — PMDCollab Sprite Extraction");
  console.log(`Pokemon: ${config.pokedexEntries.map((e) => e.name).join(", ")}`);
  console.log(`Animations: ${config.animations.join(", ")}`);
  console.log(`Directions: ${config.directions.length}`);
  console.log(`Portraits: ${config.portraits.join(", ")}`);

  for (const entry of config.pokedexEntries) {
    await extractPokemon(entry, config);
  }

  console.log("\nAll extractions complete!");
}

main().catch((error) => {
  console.error("Extraction failed:", error);
  process.exit(1);
});
