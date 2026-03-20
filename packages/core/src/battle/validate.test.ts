import { describe, expect, it } from "vitest";
import { TargetingKind } from "../enums/targeting-kind";
import { MockValidation } from "../testing/mock-validation";
import { validateBattleData } from "./validate";

const { validMove, validPokemon } = MockValidation;

describe("validateBattleData", () => {
  it("returns valid for correct data", () => {
    const result = validateBattleData({
      pokemon: [validPokemon],
      moves: [validMove],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("detects move without targeting", () => {
    const brokenMove = { ...validMove, id: "broken", targeting: undefined as never };
    const result = validateBattleData({
      pokemon: [{ ...validPokemon, movepool: ["broken"] }],
      moves: [brokenMove],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("no targeting");
  });

  it("detects move without effects", () => {
    const brokenMove = { ...validMove, id: "broken", effects: [] };
    const result = validateBattleData({
      pokemon: [{ ...validPokemon, movepool: ["broken"] }],
      moves: [brokenMove],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("no effects");
  });

  it("detects pokemon referencing unknown move", () => {
    const result = validateBattleData({
      pokemon: [{ ...validPokemon, movepool: ["nonexistent"] }],
      moves: [validMove],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("unknown move");
  });

  it("detects duplicate move ids", () => {
    const result = validateBattleData({
      pokemon: [validPokemon],
      moves: [validMove, validMove],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Duplicate move");
  });

  it("detects duplicate pokemon ids", () => {
    const result = validateBattleData({
      pokemon: [validPokemon, validPokemon],
      moves: [validMove],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Duplicate pokemon");
  });

  it("detects range min > max", () => {
    const brokenMove = {
      ...validMove,
      id: "broken",
      targeting: { kind: TargetingKind.Single, range: { min: 5, max: 2 } },
    };
    const result = validateBattleData({
      pokemon: [{ ...validPokemon, movepool: ["broken"] }],
      moves: [brokenMove],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("range min");
  });

  it("detects negative power", () => {
    const brokenMove = { ...validMove, id: "broken", power: -10 };
    const result = validateBattleData({
      pokemon: [{ ...validPokemon, movepool: ["broken"] }],
      moves: [brokenMove],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("negative power");
  });

  it("detects empty movepool", () => {
    const result = validateBattleData({
      pokemon: [{ ...validPokemon, movepool: [] }],
      moves: [validMove],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("empty movepool");
  });
});
