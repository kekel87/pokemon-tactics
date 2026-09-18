import { describe, expect, it } from "vitest";
import { DEFAULT_BATTLE_LEVEL } from "../battle/stat-calculator";
import { MockMove } from "../testing/mock-move";
import { readNaiveDamage } from "./naive-damage";

describe("readNaiveDamage", () => {
  it("returns nothing for a move with no power", () => {
    expect(
      readNaiveDamage(MockMove.fresh(MockMove.status, { id: "growl" }), DEFAULT_BATTLE_LEVEL),
    ).toBeNull();
  });

  it("grows with base power, and with nothing else", () => {
    const weak = readNaiveDamage(
      MockMove.fresh(MockMove.physical, { id: "weak", power: 40 }),
      DEFAULT_BATTLE_LEVEL,
    );
    const strong = readNaiveDamage(
      MockMove.fresh(MockMove.physical, { id: "strong", power: 120 }),
      DEFAULT_BATTLE_LEVEL,
    );

    expect(weak).not.toBeNull();
    expect(strong).not.toBeNull();
    expect(strong?.min).toBeGreaterThan(weak?.min ?? 0);
  });

  it("applies the level-50 damage coefficient against an average defender", () => {
    expect(
      readNaiveDamage(MockMove.fresh(MockMove.physical, { id: "even", power: 100 }), 50)?.min,
    ).toBe(46);
  });

  it("grows with the attacker's level, at equal base power", () => {
    const move = MockMove.fresh(MockMove.physical, { id: "even", power: 100 });

    expect(readNaiveDamage(move, 10)?.min).toBeLessThan(readNaiveDamage(move, 50)?.min ?? 0);
    expect(readNaiveDamage(move, 100)?.min).toBeGreaterThan(readNaiveDamage(move, 50)?.min ?? 0);
  });

  it("never reports a type effectiveness, so the scorer cannot read one", () => {
    expect(
      readNaiveDamage(MockMove.fresh(MockMove.physical, { id: "any", power: 80 }), 50),
    ).toEqual({
      min: 37,
      max: 37,
      effectiveness: 1,
    });
  });
});
