import { describe, expect, it } from "vitest";
import { canTraverse } from "./height-traversal";

describe("canTraverse", () => {
  it("allows flat movement (same height)", () => {
    expect(canTraverse(1, 1, false)).toBe(true);
  });

  it("allows climbing a half-tile (0 → 0.5)", () => {
    expect(canTraverse(0, 0.5, false)).toBe(true);
  });

  it("allows climbing a half-tile (0.5 → 1.0)", () => {
    expect(canTraverse(0.5, 1.0, false)).toBe(true);
  });

  it("blocks climbing a full tile directly (0 → 1.0)", () => {
    expect(canTraverse(0, 1.0, false)).toBe(false);
  });

  it("blocks climbing more than a half-tile (0 → 0.6)", () => {
    expect(canTraverse(0, 0.6, false)).toBe(false);
  });

  it("blocks climbing 1.5 tiles (0 → 1.5)", () => {
    expect(canTraverse(0, 1.5, false)).toBe(false);
  });

  it("allows descending a half-tile (1.0 → 0.5)", () => {
    expect(canTraverse(1.0, 0.5, false)).toBe(true);
  });

  it("allows descending a full tile (1.0 → 0)", () => {
    expect(canTraverse(1.0, 0, false)).toBe(true);
  });

  it("blocks descending more than a full tile (2.0 → 0)", () => {
    expect(canTraverse(2.0, 0, false)).toBe(false);
  });

  it("blocks descending 3 tiles (3.0 → 0)", () => {
    expect(canTraverse(3.0, 0, false)).toBe(false);
  });

  it("blocks descending 1.5 tiles (1.5 → 0)", () => {
    expect(canTraverse(1.5, 0, false)).toBe(false);
  });

  describe("flying", () => {
    it("allows climbing a full tile", () => {
      expect(canTraverse(0, 1.0, true)).toBe(true);
    });

    it("allows climbing 3 tiles", () => {
      expect(canTraverse(0, 3.0, true)).toBe(true);
    });

    it("allows descending any height", () => {
      expect(canTraverse(3.0, 0, true)).toBe(true);
    });
  });

  describe("ramp traversal (multi-step)", () => {
    it("can climb a full tile via ramp: 0 → 0.5 then 0.5 → 1.0", () => {
      expect(canTraverse(0, 0.5, false)).toBe(true);
      expect(canTraverse(0.5, 1.0, false)).toBe(true);
    });

    it("can climb 2 tiles via ramp: 0 → 0.5 → 1.0 → 1.5 → 2.0", () => {
      expect(canTraverse(0, 0.5, false)).toBe(true);
      expect(canTraverse(0.5, 1.0, false)).toBe(true);
      expect(canTraverse(1.0, 1.5, false)).toBe(true);
      expect(canTraverse(1.5, 2.0, false)).toBe(true);
    });
  });
});
