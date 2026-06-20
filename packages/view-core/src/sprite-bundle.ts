/**
 * Sprite bundle loader (plan 135) — engine-agnostic.
 *
 * Sprites ship as THREE files (built by `scripts/pack-sprites.ts`) so the itch.io
 * 1000-file cap no longer scales with the roster:
 *   - `sprites.bin`           — every per-Pokemon `atlas.png` + `atlas.json` concatenated.
 *   - `sprites-manifest.json` — byte ranges into the .bin + PMD offsets + portrait cell index.
 *   - `portraits.png`         — single sheet of 40x40 portraits.
 *
 * The whole `.bin` is downloaded once at boot (behind the splash screen, with a
 * progress callback), kept in memory, and sliced per-Pokemon on demand. Texture upload
 * to the GPU stays lazy (only combatants) — the renderer turns a sliced blob URL into a
 * texture. No HTTP Range, no CDN: self-contained, offline after first load (browser cache).
 */

import type { AtlasJson } from "./pmd-animation-controller.js";

/** Byte range `[offset, length]` into `sprites.bin`. */
type ByteRange = [number, number];

interface SpriteManifestEntry {
  png: ByteRange;
  json: ByteRange;
}

export interface SpriteOffsets {
  footOffsetY: number;
  headOffsetY: number;
  shadowSize: number;
}

/** Cell geometry into `portraits.png` for CSS `background-position`. */
export interface PortraitCell {
  col: number;
  row: number;
  cols: number;
  cell: number;
}

interface SpriteManifest {
  version: number;
  portraitGrid: { cols: number; cell: number };
  atlas: Record<string, SpriteManifestEntry>;
  offsets: Record<string, SpriteOffsets>;
  portraits: Record<string, number>;
}

interface LoadedBundle {
  bin: Uint8Array;
  manifest: SpriteManifest;
  portraitSheetUrl: string;
}

/** Optional progress reporter for the splash screen: fraction in [0, 1]. */
export type SpriteBundleProgress = (fraction: number) => void;

const DEFAULT_BASE_PATH = "assets/sprites";

let bundle: LoadedBundle | null = null;
let loadPromise: Promise<void> | null = null;
// Per-Pokemon blob URLs minted from `.bin` slices, kept for the whole session: one URL per id,
// SHARED across every billboard of that species (e.g. two Pikachu), so it is never revoked while
// a battle could reference it. Each billboard makes its own Babylon `Texture` over the shared URL
// (independent UV, shared GPU texture) and disposes that texture on teardown — freeing VRAM while
// the cheap URL string is reused next battle. Only `resetSpriteBundleForTest` revokes them.
const atlasBlobUrls = new Map<string, string>();
/** Parsed atlas JSON cache (the heavy frame data lives in the .bin, parsed lazily per id). */
const atlasJsonCache = new Map<string, AtlasJson>();

/** Read the `.bin` with progress, falling back to a plain `arrayBuffer()` when the stream/length is unavailable. */
async function fetchBinWithProgress(
  url: string,
  onProgress?: SpriteBundleProgress,
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch sprite bundle ${url}: ${response.status} ${response.statusText}`,
    );
  }
  const total = Number(response.headers.get("content-length") ?? 0);
  // Only acquire the reader when we can show real progress (content-length known). Acquiring
  // it locks the body, so when length is absent (gzip / chunked transfer — common on CDNs and
  // the dev server for a big file) we must fall back to `arrayBuffer()` WITHOUT having locked
  // the stream, otherwise it throws "body stream is locked" and the splash fails to load.
  const reader = total > 0 ? response.body?.getReader() : undefined;
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    onProgress?.(1);
    return buffer;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    received += value.length;
    onProgress?.(Math.min(1, received / total));
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

/**
 * Download + parse the sprite bundle once. Idempotent: concurrent / repeat calls share the
 * same in-flight promise. Rejects on network/parse failure (the splash surfaces a retry).
 */
export function loadSpriteBundle(
  options: { basePath?: string; onProgress?: SpriteBundleProgress } = {},
): Promise<void> {
  if (bundle) {
    options.onProgress?.(1);
    return Promise.resolve();
  }
  if (loadPromise) {
    return loadPromise;
  }
  const basePath = options.basePath ?? DEFAULT_BASE_PATH;
  loadPromise = (async () => {
    const [bin, manifestResponse] = await Promise.all([
      fetchBinWithProgress(`${basePath}/sprites.bin`, options.onProgress),
      fetch(`${basePath}/sprites-manifest.json`),
    ]);
    if (!manifestResponse.ok) {
      throw new Error(`Failed to fetch sprite manifest: ${manifestResponse.status}`);
    }
    const manifest = (await manifestResponse.json()) as SpriteManifest;
    bundle = {
      bin,
      manifest,
      portraitSheetUrl: `${basePath}/portraits.png`,
    };
  })();
  // On failure, clear the latch so a retry can re-attempt.
  loadPromise = loadPromise.catch((error: unknown) => {
    loadPromise = null;
    throw error;
  });
  return loadPromise;
}

export function isBundleLoaded(): boolean {
  return bundle !== null;
}

export function hasSprite(id: string): boolean {
  return bundle?.manifest.atlas[id] !== undefined;
}

function requireBundle(): LoadedBundle {
  if (!bundle) {
    throw new Error("Sprite bundle not loaded — call loadSpriteBundle() at boot first.");
  }
  return bundle;
}

function sliceRange(bin: Uint8Array, [offset, length]: ByteRange): Uint8Array {
  return bin.subarray(offset, offset + length);
}

/** Slice the `.bin` for `id`'s atlas PNG into a reusable object URL (minted once per id). */
export function getAtlasBlobUrl(id: string): string {
  const existing = atlasBlobUrls.get(id);
  if (existing) {
    return existing;
  }
  const loaded = requireBundle();
  const entry = loaded.manifest.atlas[id];
  if (!entry) {
    throw new Error(`Sprite "${id}" not in bundle.`);
  }
  const pngBytes = sliceRange(loaded.bin, entry.png);
  // Copy into a standalone ArrayBuffer — a subarray view onto the shared .bin can't be
  // handed to Blob without pinning the whole buffer per slice.
  const blob = new Blob([pngBytes.slice()], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  atlasBlobUrls.set(id, url);
  return url;
}

export function getAtlasJson(id: string): AtlasJson {
  const cached = atlasJsonCache.get(id);
  if (cached) {
    return cached;
  }
  const loaded = requireBundle();
  const entry = loaded.manifest.atlas[id];
  if (!entry) {
    throw new Error(`Sprite "${id}" not in bundle.`);
  }
  const jsonBytes = sliceRange(loaded.bin, entry.json);
  const json = JSON.parse(new TextDecoder().decode(jsonBytes)) as AtlasJson;
  atlasJsonCache.set(id, json);
  return json;
}

export function getOffsets(id: string): SpriteOffsets {
  const loaded = requireBundle();
  return loaded.manifest.offsets[id] ?? { footOffsetY: 4, headOffsetY: 0, shadowSize: 1 };
}

/** Everything a renderer needs to show `id`: sliced PNG blob URL + parsed atlas JSON + offsets. */
export function getResolvedAtlas(id: string): {
  atlasBlobUrl: string;
  atlasJson: AtlasJson;
  offsets: SpriteOffsets;
} {
  return {
    atlasBlobUrl: getAtlasBlobUrl(id),
    atlasJson: getAtlasJson(id),
    offsets: getOffsets(id),
  };
}

export function getPortraitSheetUrl(): string {
  return requireBundle().portraitSheetUrl;
}

/** Cell of `id` in `portraits.png` (for CSS background-position), or null if it has no portrait. */
export function getPortraitCell(id: string): PortraitCell | null {
  const loaded = requireBundle();
  const index = loaded.manifest.portraits[id];
  if (index === undefined) {
    return null;
  }
  const { cols, cell } = loaded.manifest.portraitGrid;
  return { col: index % cols, row: Math.floor(index / cols), cols, cell };
}

/** Test-only: reset module state so each test starts from an unloaded bundle. */
export function resetSpriteBundleForTest(): void {
  for (const url of atlasBlobUrls.values()) {
    URL.revokeObjectURL(url);
  }
  atlasBlobUrls.clear();
  atlasJsonCache.clear();
  bundle = null;
  loadPromise = null;
}
