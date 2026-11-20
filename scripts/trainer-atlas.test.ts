import { describe, expect, it } from "vitest";
import {
  convertSpriteKilnAtlas,
  millisecondsToTicks,
  parseSpriteKilnFrameName,
  type SpriteKilnAtlas,
  type SpriteKilnFrame,
} from "./trainer-atlas.js";

const southFirst: SpriteKilnFrame = {
  frame: { x: 0, y: 0, w: 56, h: 56 },
  rotated: false,
  trimmed: false,
  spriteSourceSize: { x: 0, y: 0, w: 56, h: 56 },
  sourceSize: { w: 56, h: 56 },
  duration: 96,
};

describe("parseSpriteKilnFrameName", () => {
  it("maps animation, direction and index to PMD naming", () => {
    expect(parseSpriteKilnFrameName("celebrate_nw_7")).toEqual({
      animation: "Celebrate",
      direction: "NorthWest",
      index: 7,
    });
  });

  it("rejects an unknown direction", () => {
    expect(() => parseSpriteKilnFrameName("idle_x_0")).toThrow();
  });
});

describe("millisecondsToTicks", () => {
  it("rounds to 24 ms ticks and never returns 0", () => {
    expect(millisecondsToTicks(150)).toBe(6);
    expect(millisecondsToTicks(700)).toBe(29);
    expect(millisecondsToTicks(5)).toBe(1);
  });
});

describe("convertSpriteKilnAtlas", () => {
  const source: SpriteKilnAtlas = {
    frames: {
      walk_s_1: { ...southFirst, frame: { ...southFirst.frame, x: 56 }, duration: 120 },
      walk_s_0: southFirst,
      walk_e_0: { ...southFirst, frame: { ...southFirst.frame, x: 112 } },
    },
    meta: { size: { w: 168, h: 56 } },
  };
  const converted = convertSpriteKilnAtlas(source);

  it("renames every frame and drops the per-frame duration", () => {
    expect(Object.keys(converted.frames).sort()).toEqual([
      "Walk-East-0",
      "Walk-South-0",
      "Walk-South-1",
    ]);
    expect(converted.frames["Walk-South-1"]).not.toHaveProperty("duration");
  });

  it("lifts South durations, in frame order, into meta.animations", () => {
    expect(converted.meta.animations.Walk).toEqual({
      frameWidth: 56,
      frameHeight: 56,
      durations: [4, 5],
    });
  });
});
