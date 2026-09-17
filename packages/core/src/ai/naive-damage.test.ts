import { describe, expect, it } from "vitest";
import { MockMove } from "../testing/mock-move";
import { readNaiveDamage } from "./naive-damage";

describe("readNaiveDamage", () => {
  it("returns nothing for a move with no power", () => {
    expect(readNaiveDamage(MockMove.fresh(MockMove.status, { id: "growl" }))).toBeNull();
  });

  it("grows with base power, and with nothing else", () => {
    const weak = readNaiveDamage(MockMove.fresh(MockMove.physical, { id: "weak", power: 40 }));
    const strong = readNaiveDamage(MockMove.fresh(MockMove.physical, { id: "strong", power: 120 }));

    expect(weak).not.toBeNull();
    expect(strong).not.toBeNull();
    expect(strong?.min).toBeGreaterThan(weak?.min ?? 0);
  });

  it("applies the level-50 damage coefficient against an average defender", () => {
    expect(
      readNaiveDamage(MockMove.fresh(MockMove.physical, { id: "even", power: 100 }))?.min,
    ).toBe(46);
  });

  it("never reports a type effectiveness, so the scorer cannot read one", () => {
    expect(readNaiveDamage(MockMove.fresh(MockMove.physical, { id: "any", power: 80 }))).toEqual({
      min: 37,
      max: 37,
      effectiveness: 1,
    });
  });
});
