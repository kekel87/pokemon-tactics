import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAtlasBlobUrl,
  getAtlasJson,
  getItemIconCell,
  getItemIconSheetUrl,
  getOffsets,
  getPortraitCell,
  getPortraitSheetUrl,
  hasSprite,
  isBundleLoaded,
  loadSpriteBundle,
  resetSpriteBundleForTest,
} from "./sprite-bundle.js";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
const ATLAS_JSON = { frames: {}, meta: { size: { w: 64, h: 64 } } };

function buildBundle(): { bin: Uint8Array; manifest: unknown } {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(ATLAS_JSON));
  const bin = new Uint8Array(PNG_BYTES.length + jsonBytes.length);
  bin.set(PNG_BYTES, 0);
  bin.set(jsonBytes, PNG_BYTES.length);
  const manifest = {
    version: 2,
    portraitGrid: { cols: 32, cell: 40 },
    itemIconGrid: { cols: 16, cell: 24 },
    atlas: {
      pikachu: { png: [0, PNG_BYTES.length], json: [PNG_BYTES.length, jsonBytes.length] },
    },
    offsets: { pikachu: { footOffsetY: 4, headOffsetY: -6, shadowSize: 2 } },
    portraits: { pikachu: 35 },
    itemIcons: { "life-orb": 18 },
  };
  return { bin, manifest };
}

describe("sprite-bundle", () => {
  beforeEach(async () => {
    const { bin, manifest } = buildBundle();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("sprites.bin")) {
          return {
            ok: true,
            headers: { get: () => null },
            body: null,
            arrayBuffer: async () => bin.buffer,
          } as unknown as Response;
        }
        return { ok: true, json: async () => manifest } as unknown as Response;
      }),
    );
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: vi.fn(),
    });
    await loadSpriteBundle({ basePath: "assets/sprites" });
  });

  afterEach(() => {
    resetSpriteBundleForTest();
    vi.unstubAllGlobals();
  });

  it("loads the bundle and reports presence", () => {
    expect(isBundleLoaded()).toBe(true);
    expect(hasSprite("pikachu")).toBe(true);
    expect(hasSprite("missingno")).toBe(false);
  });

  it("slices and parses the atlas JSON from the .bin", () => {
    expect(getAtlasJson("pikachu")).toEqual(ATLAS_JSON);
  });

  it("returns the PMD offsets from the manifest", () => {
    expect(getOffsets("pikachu")).toEqual({ footOffsetY: 4, headOffsetY: -6, shadowSize: 2 });
  });

  it("mints a blob URL for the atlas PNG slice", () => {
    expect(getAtlasBlobUrl("pikachu")).toBe("blob:mock");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    getAtlasBlobUrl("pikachu");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("computes the portrait grid cell from the index", () => {
    expect(getPortraitCell("pikachu")).toEqual({ col: 3, row: 1, cols: 32, cell: 40 });
    expect(getPortraitCell("missingno")).toBeNull();
    expect(getPortraitSheetUrl()).toBe("assets/sprites/portraits.png");
  });

  it("computes the item-icon grid cell from the index", () => {
    // index 18 in a 16-col grid → col 2, row 1.
    expect(getItemIconCell("life-orb")).toEqual({ col: 2, row: 1, cols: 16, cell: 24 });
    expect(getItemIconCell("nonexistent-item")).toBeNull();
    expect(getItemIconSheetUrl()).toBe("assets/sprites/item-icons.png");
  });
});

describe("sprite-bundle item icons — older bundle (manifest v1, no item grid)", () => {
  afterEach(() => {
    resetSpriteBundleForTest();
    vi.unstubAllGlobals();
  });

  it("returns null when the cached manifest predates item icons", async () => {
    const jsonBytes = new TextEncoder().encode(JSON.stringify(ATLAS_JSON));
    const bin = new Uint8Array(PNG_BYTES.length + jsonBytes.length);
    bin.set(PNG_BYTES, 0);
    bin.set(jsonBytes, PNG_BYTES.length);
    const manifest = {
      version: 1,
      portraitGrid: { cols: 32, cell: 40 },
      atlas: {
        pikachu: { png: [0, PNG_BYTES.length], json: [PNG_BYTES.length, jsonBytes.length] },
      },
      offsets: {},
      portraits: {},
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("sprites.bin")) {
          return {
            ok: true,
            headers: { get: () => null },
            body: null,
            arrayBuffer: async () => bin.buffer,
          } as unknown as Response;
        }
        return { ok: true, json: async () => manifest } as unknown as Response;
      }),
    );
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:mock"), revokeObjectURL: vi.fn() });
    await loadSpriteBundle({ basePath: "assets/sprites" });

    expect(getItemIconCell("life-orb")).toBeNull();
  });
});

describe("sprite-bundle streaming path (content-length present)", () => {
  afterEach(() => {
    resetSpriteBundleForTest();
    vi.unstubAllGlobals();
  });

  it("reads the .bin via the progress reader and reports fractions", async () => {
    const { bin, manifest } = buildBundle();
    const half = Math.floor(bin.length / 2);
    const chunks = [bin.subarray(0, half), bin.subarray(half)];
    let next = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("sprites.bin")) {
          return {
            ok: true,
            headers: {
              get: (name: string) => (name === "content-length" ? String(bin.length) : null),
            },
            body: {
              getReader: () => ({
                read: async () =>
                  next < chunks.length
                    ? { done: false, value: chunks[next++] }
                    : { done: true, value: undefined },
              }),
            },
            arrayBuffer: async () => {
              throw new Error("must not be called when streaming");
            },
          } as unknown as Response;
        }
        return { ok: true, json: async () => manifest } as unknown as Response;
      }),
    );
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:mock"), revokeObjectURL: vi.fn() });

    const progress: number[] = [];
    await loadSpriteBundle({ basePath: "assets/sprites", onProgress: (f) => progress.push(f) });

    expect(isBundleLoaded()).toBe(true);
    expect(progress.at(-1)).toBe(1);
    expect(getAtlasJson("pikachu")).toEqual(ATLAS_JSON);
  });
});
