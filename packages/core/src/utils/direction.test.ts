import { describe, expect, it } from "vitest";
import { Direction } from "../enums/direction";
import { directionFromTo, getPerpendicularOffsets, stepInDirection } from "./direction";

describe("directionFromTo", () => {
  it("returns East for positive x delta", () => {
    expect(directionFromTo({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(Direction.East);
  });

  it("returns West for negative x delta", () => {
    expect(directionFromTo({ x: 1, y: 0 }, { x: 0, y: 0 })).toBe(Direction.West);
  });

  it("returns South for positive y delta", () => {
    expect(directionFromTo({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(Direction.South);
  });

  it("returns North for negative y delta", () => {
    expect(directionFromTo({ x: 0, y: 1 }, { x: 0, y: 0 })).toBe(Direction.North);
  });

  it("prefers x axis when deltas are equal", () => {
    expect(directionFromTo({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(Direction.East);
  });
});

describe("stepInDirection", () => {
  it("steps North", () => {
    expect(stepInDirection({ x: 2, y: 3 }, Direction.North, 2)).toEqual({ x: 2, y: 1 });
  });

  it("steps South", () => {
    expect(stepInDirection({ x: 2, y: 3 }, Direction.South, 1)).toEqual({ x: 2, y: 4 });
  });

  it("steps East", () => {
    expect(stepInDirection({ x: 2, y: 3 }, Direction.East, 3)).toEqual({ x: 5, y: 3 });
  });

  it("steps West", () => {
    expect(stepInDirection({ x: 2, y: 3 }, Direction.West, 1)).toEqual({ x: 1, y: 3 });
  });
});

describe("getPerpendicularOffsets", () => {
  it("returns x offsets for North", () => {
    expect(getPerpendicularOffsets(Direction.North)).toEqual([
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ]);
  });

  it("returns x offsets for South", () => {
    expect(getPerpendicularOffsets(Direction.South)).toEqual([
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ]);
  });

  it("returns y offsets for East", () => {
    expect(getPerpendicularOffsets(Direction.East)).toEqual([
      { x: 0, y: -1 },
      { x: 0, y: 1 },
    ]);
  });

  it("returns y offsets for West", () => {
    expect(getPerpendicularOffsets(Direction.West)).toEqual([
      { x: 0, y: -1 },
      { x: 0, y: 1 },
    ]);
  });
});
