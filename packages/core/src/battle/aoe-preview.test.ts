import { describe, it, expect } from "vitest";
import { getAoePreview } from "./aoe-preview";
import { TargetingKind } from "../enums/targeting-kind";
import { Grid } from "../grid/Grid";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { TargetingPattern } from "../types/targeting-pattern";

describe("getAoePreview", () => {
  const grid = Grid.createFlat(12, 12);
  const caster: PokemonInstance = {
    id: "caster",
    definitionId: "bulbasaur",
    playerId: "player-1",
    level: 50,
    currentHp: 100,
    maxHp: 100,
    baseStats: { hp: 45, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 },
    combatStats: { hp: 100, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 },
    derivedStats: { movement: 3, jump: 1, initiative: 45 },
    statStages: { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
    statusEffects: [],
    position: { x: 5, y: 5 },
    orientation: "south",
    moveIds: ["tackle"],
    currentPp: { tackle: 35 },
  };

  it("should return empty array for invalid target position", () => {
    const targetingPattern: TargetingPattern = { kind: TargetingKind.Single, range: { min: 1, max: 1 } };
    const targetPosition: Position = { x: 20, y: 20 };
    const result = getAoePreview(targetingPattern, caster, targetPosition, grid);
    expect(result).toEqual([]);
  });

  it("should return correct positions for Single targeting", () => {
    const targetingPattern: TargetingPattern = { kind: TargetingKind.Single, range: { min: 1, max: 1 } };
    const targetPosition: Position = { x: 5, y: 6 };
    const result = getAoePreview(targetingPattern, caster, targetPosition, grid);
    expect(result).toEqual([{ x: 5, y: 6 }]);
  });

  it("should return correct positions for Cone targeting", () => {
    const targetingPattern: TargetingPattern = { kind: TargetingKind.Cone, range: { min: 1, max: 3 } };
    const targetPosition: Position = { x: 5, y: 8 };
    const result = getAoePreview(targetingPattern, caster, targetPosition, grid);
    expect(result).toContainEqual({ x: 5, y: 6 });
    expect(result).toContainEqual({ x: 5, y: 7 });
    expect(result).toContainEqual({ x: 5, y: 8 });
  });

  it("should return correct positions for Cross targeting", () => {
    const targetingPattern: TargetingPattern = { kind: TargetingKind.Cross, size: 3 };
    const targetPosition: Position = { x: 5, y: 5 };
    const result = getAoePreview(targetingPattern, caster, targetPosition, grid);
    expect(result).toContainEqual({ x: 4, y: 5 });
    expect(result).toContainEqual({ x: 5, y: 5 });
    expect(result).toContainEqual({ x: 6, y: 5 });
    expect(result).toContainEqual({ x: 5, y: 4 });
    expect(result).toContainEqual({ x: 5, y: 6 });
  });

  it("should return correct positions for Zone targeting", () => {
    const targetingPattern: TargetingPattern = { kind: TargetingKind.Zone, radius: 1 };
    const targetPosition: Position = { x: 5, y: 5 };
    const result = getAoePreview(targetingPattern, caster, targetPosition, grid);
    expect(result).toContainEqual({ x: 5, y: 5 });
    expect(result).toContainEqual({ x: 4, y: 5 });
    expect(result).toContainEqual({ x: 6, y: 5 });
    expect(result).toContainEqual({ x: 5, y: 4 });
    expect(result).toContainEqual({ x: 5, y: 6 });
  });
});
