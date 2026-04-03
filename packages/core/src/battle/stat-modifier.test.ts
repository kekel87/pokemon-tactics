import { describe, expect, it } from "vitest";
import { StatusType } from "../enums/status-type";
import { clampStages, computeMovement, getEffectiveStat, getStatMultiplier, isMajorStatus } from "./stat-modifier";

describe("getStatMultiplier", () => {
  it("returns 1 for stage 0", () => {
    expect(getStatMultiplier(0)).toBe(1);
  });

  it("returns correct multipliers for positive stages", () => {
    expect(getStatMultiplier(1)).toBeCloseTo(1.5);
    expect(getStatMultiplier(2)).toBeCloseTo(2);
    expect(getStatMultiplier(3)).toBeCloseTo(2.5);
    expect(getStatMultiplier(4)).toBeCloseTo(3);
    expect(getStatMultiplier(5)).toBeCloseTo(3.5);
    expect(getStatMultiplier(6)).toBeCloseTo(4);
  });

  it("returns correct multipliers for negative stages", () => {
    expect(getStatMultiplier(-1)).toBeCloseTo(2 / 3);
    expect(getStatMultiplier(-2)).toBeCloseTo(0.5);
    expect(getStatMultiplier(-3)).toBeCloseTo(0.4);
    expect(getStatMultiplier(-4)).toBeCloseTo(1 / 3);
    expect(getStatMultiplier(-5)).toBeCloseTo(2 / 7);
    expect(getStatMultiplier(-6)).toBeCloseTo(0.25);
  });
});

describe("getEffectiveStat", () => {
  it("applies multiplier to base stat", () => {
    expect(getEffectiveStat(100, 0)).toBe(100);
    expect(getEffectiveStat(100, 1)).toBe(150);
    expect(getEffectiveStat(100, -1)).toBe(66);
  });
});

describe("clampStages", () => {
  it("adds change to current within bounds", () => {
    expect(clampStages(0, 1)).toBe(1);
    expect(clampStages(0, -1)).toBe(-1);
    expect(clampStages(3, 2)).toBe(5);
  });

  it("clamps at +6", () => {
    expect(clampStages(5, 3)).toBe(6);
    expect(clampStages(6, 1)).toBe(6);
  });

  it("clamps at -6", () => {
    expect(clampStages(-5, -3)).toBe(-6);
    expect(clampStages(-6, -1)).toBe(-6);
  });
});

describe("isMajorStatus", () => {
  it("returns true for major statuses", () => {
    expect(isMajorStatus(StatusType.Burned)).toBe(true);
    expect(isMajorStatus(StatusType.Paralyzed)).toBe(true);
    expect(isMajorStatus(StatusType.Poisoned)).toBe(true);
    expect(isMajorStatus(StatusType.BadlyPoisoned)).toBe(true);
    expect(isMajorStatus(StatusType.Frozen)).toBe(true);
    expect(isMajorStatus(StatusType.Asleep)).toBe(true);
  });

  it("returns false for volatile statuses", () => {
    expect(isMajorStatus(StatusType.Confused)).toBe(false);
  });
});

describe("computeMovement", () => {
  describe("threshold boundaries at stage 0", () => {
    it("returns 2 for speed <= 20", () => {
      expect(computeMovement(5, 0)).toBe(2);
      expect(computeMovement(15, 0)).toBe(2);
      expect(computeMovement(20, 0)).toBe(2);
    });

    it("returns 3 for speed 21-45", () => {
      expect(computeMovement(21, 0)).toBe(3);
      expect(computeMovement(30, 0)).toBe(3);
      expect(computeMovement(45, 0)).toBe(3);
    });

    it("returns 4 for speed 46-85", () => {
      expect(computeMovement(46, 0)).toBe(4);
      expect(computeMovement(65, 0)).toBe(4);
      expect(computeMovement(85, 0)).toBe(4);
    });

    it("returns 5 for speed 86-170", () => {
      expect(computeMovement(86, 0)).toBe(5);
      expect(computeMovement(120, 0)).toBe(5);
      expect(computeMovement(150, 0)).toBe(5);
      expect(computeMovement(170, 0)).toBe(5);
    });

    it("returns 6 for speed 171-340", () => {
      expect(computeMovement(171, 0)).toBe(6);
      expect(computeMovement(200, 0)).toBe(6);
      expect(computeMovement(340, 0)).toBe(6);
    });

    it("returns 7 for speed >= 341", () => {
      expect(computeMovement(341, 0)).toBe(7);
      expect(computeMovement(500, 0)).toBe(7);
    });
  });

  describe("with positive speed stages (Agility)", () => {
    it("Bulbasaur (45) with +2 stages: effective 90 -> move 5", () => {
      expect(computeMovement(45, 2)).toBe(5);
    });

    it("Pikachu (90) with +2 stages: effective 180 -> move 6", () => {
      expect(computeMovement(90, 2)).toBe(6);
    });

    it("Electrode (150) with +2 stages: effective 300 -> move 6", () => {
      expect(computeMovement(150, 2)).toBe(6);
    });

    it("Electrode (150) with +4 stages: effective 450 -> move 7", () => {
      expect(computeMovement(150, 4)).toBe(7);
    });
  });

  describe("with negative speed stages", () => {
    it("Pikachu (90) with -2 stages: effective 45 -> move 3", () => {
      expect(computeMovement(90, -2)).toBe(3);
    });

    it("Slowpoke (15) with -6 stages: effective 3 -> move 2 (floor)", () => {
      expect(computeMovement(15, -6)).toBe(2);
    });

    it("speed 1 with -6 stages: effective 0 -> move 2 (floor)", () => {
      expect(computeMovement(1, -6)).toBe(2);
    });
  });

  describe("roster examples at stage 0", () => {
    it("Slowpoke (15) -> 2", () => expect(computeMovement(15, 0)).toBe(2));
    it("Geodude (20) -> 2", () => expect(computeMovement(20, 0)).toBe(2));
    it("Snorlax (30) -> 3", () => expect(computeMovement(30, 0)).toBe(3));
    it("Machop (35) -> 3", () => expect(computeMovement(35, 0)).toBe(3));
    it("Bulbasaur (45) -> 3", () => expect(computeMovement(45, 0)).toBe(3));
    it("Eevee (55) -> 4", () => expect(computeMovement(55, 0)).toBe(4));
    it("Growlithe (60) -> 4", () => expect(computeMovement(60, 0)).toBe(4));
    it("Gastly (80) -> 4", () => expect(computeMovement(80, 0)).toBe(4));
    it("Pikachu (90) -> 5", () => expect(computeMovement(90, 0)).toBe(5));
    it("Charizard (100) -> 5", () => expect(computeMovement(100, 0)).toBe(5));
    it("Jolteon (130) -> 5", () => expect(computeMovement(130, 0)).toBe(5));
    it("Electrode (150) -> 5", () => expect(computeMovement(150, 0)).toBe(5));
  });
});
