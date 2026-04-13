import { describe, expect, it } from "vitest";
import { decodeTiledGid } from "./tiled-utils";

describe("decodeTiledGid", () => {
  it("returns tileId unchanged when no flip bits are set", () => {
    const result = decodeTiledGid(5);
    expect(result.tileId).toBe(5);
    expect(result.flipH).toBe(false);
    expect(result.flipV).toBe(false);
    expect(result.flipD).toBe(false);
  });

  it("decodes horizontal flip (bit 31)", () => {
    const rawGid = 0x80000001;
    const result = decodeTiledGid(rawGid);
    expect(result.tileId).toBe(1);
    expect(result.flipH).toBe(true);
    expect(result.flipV).toBe(false);
    expect(result.flipD).toBe(false);
  });

  it("decodes vertical flip (bit 30)", () => {
    const rawGid = 0x40000003;
    const result = decodeTiledGid(rawGid);
    expect(result.tileId).toBe(3);
    expect(result.flipH).toBe(false);
    expect(result.flipV).toBe(true);
    expect(result.flipD).toBe(false);
  });

  it("decodes diagonal flip (bit 29)", () => {
    const rawGid = 0x20000007;
    const result = decodeTiledGid(rawGid);
    expect(result.tileId).toBe(7);
    expect(result.flipD).toBe(true);
  });

  it("decodes combined horizontal + vertical flip", () => {
    const rawGid = 0xc0000002;
    const result = decodeTiledGid(rawGid);
    expect(result.tileId).toBe(2);
    expect(result.flipH).toBe(true);
    expect(result.flipV).toBe(true);
  });

  it("returns tileId 0 for empty tile (GID 0)", () => {
    const result = decodeTiledGid(0);
    expect(result.tileId).toBe(0);
    expect(result.flipH).toBe(false);
    expect(result.flipV).toBe(false);
  });
});
