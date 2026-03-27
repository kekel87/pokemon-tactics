import { describe, it, expect, beforeEach } from "vitest";
import { BattleEngine } from "./BattleEngine";
import { MockBattle } from "../testing/mock-battle";
import { MockPokemon } from "../testing/mock-pokemon";
import { MockValidation } from "../testing/mock-validation";
import { TargetingKind } from "../enums/targeting-kind";
import type { Position } from "../types/position";

describe("BattleEngine.getAoePreview", () => {
  let engine: BattleEngine;
  let bulbasaurId: string;

  beforeEach(() => {
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, { position: { x: 5, y: 5 } });
    const state = MockBattle.stateFrom([bulbasaur], 12, 12);
    const moveRegistry = new Map<string, any>();
    moveRegistry.set("tackle", {
      id: "tackle",
      name: "Tackle",
      type: "normal",
      category: "physical",
      power: 40,
      accuracy: 100,
      pp: 35,
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
      effects: [{ kind: "damage" }],
    });
    moveRegistry.set("ember", {
      id: "ember",
      name: "Ember",
      type: "fire",
      category: "special",
      power: 40,
      accuracy: 100,
      pp: 25,
      targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
      effects: [{ kind: "damage" }],
    });
    moveRegistry.set("night-shade", {
      id: "night-shade",
      name: "Night Shade",
      type: "ghost",
      category: "special",
      power: 0,
      accuracy: 100,
      pp: 15,
      targeting: { kind: TargetingKind.Cross, size: 3 },
      effects: [{ kind: "damage" }],
    });
    moveRegistry.set("vine-whip", {
      id: "vine-whip",
      name: "Vine Whip",
      type: "grass",
      category: "physical",
      power: 45,
      accuracy: 100,
      pp: 25,
      targeting: { kind: TargetingKind.Zone, radius: 1 },
      effects: [{ kind: "damage" }],
    });
    moveRegistry.set("ice-beam", {
      id: "ice-beam",
      name: "Ice Beam",
      type: "ice",
      category: "special",
      power: 90,
      accuracy: 100,
      pp: 10,
      targeting: { kind: TargetingKind.Blast, range: { min: 1, max: 10 }, radius: 1 },
      effects: [{ kind: "damage" }],
    });
    engine = new BattleEngine(state, moveRegistry);
    bulbasaurId = bulbasaur.id;
  });

  it("should return empty array for unknown pokemon", () => {
    const result = engine.getAoePreview("unknown", "tackle", { x: 5, y: 5 });
    expect(result).toEqual([]);
  });

  it("should return empty array for unknown move", () => {
    const result = engine.getAoePreview(bulbasaurId, "unknown-move", { x: 5, y: 5 });
    expect(result).toEqual([]);
  });

  it("should return correct positions for Single targeting", () => {
    const result = engine.getAoePreview(bulbasaurId, "tackle", { x: 5, y: 6 });
    expect(result).toEqual([{ x: 5, y: 6 }]);
  });

  it("should return correct positions for Cone targeting", () => {
    const result = engine.getAoePreview(bulbasaurId, "ember", { x: 5, y: 8 });
    expect(result).toContainEqual({ x: 5, y: 6 });
    expect(result).toContainEqual({ x: 5, y: 7 });
    expect(result).toContainEqual({ x: 5, y: 8 });
  });

  it("should return correct positions for Cross targeting", () => {
    const result = engine.getAoePreview(bulbasaurId, "night-shade", { x: 5, y: 5 });
    expect(result).toContainEqual({ x: 4, y: 5 });
    expect(result).toContainEqual({ x: 5, y: 5 });
    expect(result).toContainEqual({ x: 6, y: 5 });
    expect(result).toContainEqual({ x: 5, y: 4 });
    expect(result).toContainEqual({ x: 5, y: 6 });
  });

  it("should return correct positions for Zone targeting", () => {
    const result = engine.getAoePreview(bulbasaurId, "vine-whip", { x: 5, y: 5 });
    expect(result).toContainEqual({ x: 5, y: 5 });
    expect(result).toContainEqual({ x: 4, y: 5 });
    expect(result).toContainEqual({ x: 6, y: 5 });
    expect(result).toContainEqual({ x: 5, y: 4 });
    expect(result).toContainEqual({ x: 5, y: 6 });
  });

  it("should return correct positions for Blast targeting", () => {
    const result = engine.getAoePreview(bulbasaurId, "ice-beam", { x: 5, y: 8 });
    expect(result).toContainEqual({ x: 5, y: 8 });
    expect(result).toContainEqual({ x: 4, y: 8 });
    expect(result).toContainEqual({ x: 6, y: 8 });
    expect(result).toContainEqual({ x: 5, y: 7 });
    expect(result).toContainEqual({ x: 5, y: 9 });
  });
});
