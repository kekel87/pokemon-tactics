import { describe, expect, it } from "vitest";
import { Direction } from "../enums/direction";
import { MockBattle } from "../testing/mock-battle";
import {
  FacingZone,
  getFacingModifier,
  getFacingZone,
  getOppositeDirection,
} from "./facing-modifier";

describe("getOppositeDirection", () => {
  it("North ↔ South", () => {
    expect(getOppositeDirection(Direction.North)).toBe(Direction.South);
    expect(getOppositeDirection(Direction.South)).toBe(Direction.North);
  });

  it("East ↔ West", () => {
    expect(getOppositeDirection(Direction.East)).toBe(Direction.West);
    expect(getOppositeDirection(Direction.West)).toBe(Direction.East);
  });
});

describe("getFacingZone", () => {
  describe("defender facing North", () => {
    const def = {
      ...MockBattle.player2Slow,
      position: { x: 5, y: 5 },
      orientation: Direction.North,
    };

    it("attack from North → Front", () => {
      expect(getFacingZone({ x: 5, y: 3 }, def)).toBe(FacingZone.Front);
    });

    it("attack from South → Back", () => {
      expect(getFacingZone({ x: 5, y: 7 }, def)).toBe(FacingZone.Back);
    });

    it("attack from East → Flank", () => {
      expect(getFacingZone({ x: 7, y: 5 }, def)).toBe(FacingZone.Flank);
    });

    it("attack from West → Flank", () => {
      expect(getFacingZone({ x: 3, y: 5 }, def)).toBe(FacingZone.Flank);
    });
  });

  describe("defender facing South", () => {
    const def = {
      ...MockBattle.player2Slow,
      position: { x: 5, y: 5 },
      orientation: Direction.South,
    };

    it("attack from South → Front", () => {
      expect(getFacingZone({ x: 5, y: 7 }, def)).toBe(FacingZone.Front);
    });

    it("attack from North → Back", () => {
      expect(getFacingZone({ x: 5, y: 3 }, def)).toBe(FacingZone.Back);
    });

    it("attack from East → Flank", () => {
      expect(getFacingZone({ x: 7, y: 5 }, def)).toBe(FacingZone.Flank);
    });

    it("attack from West → Flank", () => {
      expect(getFacingZone({ x: 3, y: 5 }, def)).toBe(FacingZone.Flank);
    });
  });

  describe("defender facing East", () => {
    const def = {
      ...MockBattle.player2Slow,
      position: { x: 5, y: 5 },
      orientation: Direction.East,
    };

    it("attack from East → Front", () => {
      expect(getFacingZone({ x: 7, y: 5 }, def)).toBe(FacingZone.Front);
    });

    it("attack from West → Back", () => {
      expect(getFacingZone({ x: 3, y: 5 }, def)).toBe(FacingZone.Back);
    });

    it("attack from North → Flank", () => {
      expect(getFacingZone({ x: 5, y: 3 }, def)).toBe(FacingZone.Flank);
    });

    it("attack from South → Flank", () => {
      expect(getFacingZone({ x: 5, y: 7 }, def)).toBe(FacingZone.Flank);
    });
  });

  describe("defender facing West", () => {
    const def = {
      ...MockBattle.player2Slow,
      position: { x: 5, y: 5 },
      orientation: Direction.West,
    };

    it("attack from West → Front", () => {
      expect(getFacingZone({ x: 3, y: 5 }, def)).toBe(FacingZone.Front);
    });

    it("attack from East → Back", () => {
      expect(getFacingZone({ x: 7, y: 5 }, def)).toBe(FacingZone.Back);
    });

    it("attack from North → Flank", () => {
      expect(getFacingZone({ x: 5, y: 3 }, def)).toBe(FacingZone.Flank);
    });

    it("attack from South → Flank", () => {
      expect(getFacingZone({ x: 5, y: 7 }, def)).toBe(FacingZone.Flank);
    });
  });
});

describe("getFacingModifier", () => {
  it("Front → 0.85", () => {
    expect(getFacingModifier(FacingZone.Front)).toBe(0.85);
  });

  it("Flank → 1.0", () => {
    expect(getFacingModifier(FacingZone.Flank)).toBe(1.0);
  });

  it("Back → 1.15", () => {
    expect(getFacingModifier(FacingZone.Back)).toBe(1.15);
  });
});
