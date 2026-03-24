import { describe, expect, it } from "vitest";

import { TargetingKind } from "../enums/targeting-kind";
import { MockPokemon } from "../testing";
import type { TraversalContext } from "../types/traversal-context";
import { Grid } from "./Grid";
import { resolveTargeting } from "./targeting";

describe("resolveTargeting", () => {
  const grid = Grid.createFlat(8, 8);

  describe("single", () => {
    it("should return target if in range", () => {
      const caster = { ...MockPokemon.base, position: { x: 2, y: 2 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
        caster,
        { x: 4, y: 2 },
        grid,
      );
      expect(result).toEqual([{ x: 4, y: 2 }]);
    });

    it("should return empty if out of range", () => {
      const caster = { ...MockPokemon.base, position: { x: 0, y: 0 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
        caster,
        { x: 5, y: 5 },
        grid,
      );
      expect(result).toEqual([]);
    });

    it("should return empty if too close", () => {
      const caster = { ...MockPokemon.base, position: { x: 2, y: 2 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Single, range: { min: 2, max: 4 } },
        caster,
        { x: 3, y: 2 },
        grid,
      );
      expect(result).toEqual([]);
    });

    it("should return empty if target is out of bounds", () => {
      const caster = { ...MockPokemon.base, position: { x: 0, y: 0 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Single, range: { min: 1, max: 10 } },
        caster,
        { x: -1, y: 0 },
        grid,
      );
      expect(result).toEqual([]);
    });
  });

  describe("self", () => {
    it("should return caster position", () => {
      const caster = { ...MockPokemon.base, position: { x: 3, y: 3 } };
      const result = resolveTargeting({ kind: TargetingKind.Self }, caster, { x: 0, y: 0 }, grid);
      expect(result).toEqual([{ x: 3, y: 3 }]);
    });
  });

  describe("cross", () => {
    it("should return cross-shaped tiles centered on target", () => {
      const caster = { ...MockPokemon.base, position: { x: 0, y: 0 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Cross, range: { min: 1, max: 4 }, size: 3 },
        caster,
        { x: 4, y: 4 },
        grid,
      );
      expect(result).toHaveLength(5);
      expect(result).toContainEqual({ x: 4, y: 4 });
      expect(result).toContainEqual({ x: 3, y: 4 });
      expect(result).toContainEqual({ x: 5, y: 4 });
      expect(result).toContainEqual({ x: 4, y: 3 });
      expect(result).toContainEqual({ x: 4, y: 5 });
    });

    it("should clip cross at grid edge", () => {
      const caster = { ...MockPokemon.base, position: { x: 0, y: 0 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Cross, range: { min: 0, max: 0 }, size: 3 },
        caster,
        { x: 0, y: 0 },
        grid,
      );
      expect(result).toHaveLength(3);
    });
  });

  describe("zone", () => {
    it("should return diamond of tiles around caster", () => {
      const caster = { ...MockPokemon.base, position: { x: 4, y: 4 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Zone, radius: 1 },
        caster,
        { x: 0, y: 0 },
        grid,
      );
      expect(result).toHaveLength(5);
      expect(result).toContainEqual({ x: 4, y: 4 });
    });
  });

  describe("line", () => {
    it("should return tiles in a line east", () => {
      const caster = { ...MockPokemon.base, position: { x: 1, y: 4 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Line, length: 3 },
        caster,
        { x: 5, y: 4 },
        grid,
      );
      expect(result).toEqual([
        { x: 2, y: 4 },
        { x: 3, y: 4 },
        { x: 4, y: 4 },
      ]);
    });

    it("should return tiles in a line west", () => {
      const caster = { ...MockPokemon.base, position: { x: 5, y: 4 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Line, length: 3 },
        caster,
        { x: 2, y: 4 },
        grid,
      );
      expect(result).toEqual([
        { x: 4, y: 4 },
        { x: 3, y: 4 },
        { x: 2, y: 4 },
      ]);
    });

    it("should return tiles in a line north", () => {
      const caster = { ...MockPokemon.base, position: { x: 4, y: 5 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Line, length: 3 },
        caster,
        { x: 4, y: 1 },
        grid,
      );
      expect(result).toEqual([
        { x: 4, y: 4 },
        { x: 4, y: 3 },
        { x: 4, y: 2 },
      ]);
    });

    it("should return tiles in a line south", () => {
      const caster = { ...MockPokemon.base, position: { x: 4, y: 1 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Line, length: 3 },
        caster,
        { x: 4, y: 5 },
        grid,
      );
      expect(result).toEqual([
        { x: 4, y: 2 },
        { x: 4, y: 3 },
        { x: 4, y: 4 },
      ]);
    });

    it("should stop at grid edge", () => {
      const caster = { ...MockPokemon.base, position: { x: 6, y: 4 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Line, length: 5 },
        caster,
        { x: 7, y: 4 },
        grid,
      );
      expect(result).toEqual([{ x: 7, y: 4 }]);
    });
  });

  describe("cone", () => {
    it("should return a cone east", () => {
      const caster = { ...MockPokemon.base, position: { x: 2, y: 4 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Cone, range: { min: 1, max: 2 }, width: 3 },
        caster,
        { x: 5, y: 4 },
        grid,
      );
      expect(result).toHaveLength(6);
    });

    it("should return a cone north", () => {
      const caster = { ...MockPokemon.base, position: { x: 4, y: 5 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Cone, range: { min: 1, max: 2 }, width: 3 },
        caster,
        { x: 4, y: 1 },
        grid,
      );
      expect(result).toHaveLength(6);
      expect(result).toContainEqual({ x: 4, y: 4 });
      expect(result).toContainEqual({ x: 3, y: 4 });
      expect(result).toContainEqual({ x: 5, y: 4 });
    });

    it("should clip cone at grid edge", () => {
      const caster = { ...MockPokemon.base, position: { x: 0, y: 4 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Cone, range: { min: 1, max: 1 }, width: 3 },
        caster,
        { x: 0, y: 0 },
        grid,
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it("should handle cone center going out of bounds", () => {
      const caster = { ...MockPokemon.base, position: { x: 7, y: 4 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Cone, range: { min: 1, max: 3 }, width: 3 },
        caster,
        { x: 10, y: 4 },
        grid,
      );
      expect(result.length).toBeLessThan(9);
    });
  });

  describe("dash", () => {
    it("should return last reachable tile when dashing east with no obstacles", () => {
      const caster = { ...MockPokemon.base, position: { x: 1, y: 4 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Dash, maxDistance: 3 },
        caster,
        { x: 4, y: 4 },
        grid,
      );
      expect(result).toEqual([{ x: 4, y: 4 }]);
    });

    it("should return last reachable tile when dashing north", () => {
      const caster = { ...MockPokemon.base, position: { x: 4, y: 5 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Dash, maxDistance: 3 },
        caster,
        { x: 4, y: 0 },
        grid,
      );
      expect(result).toEqual([{ x: 4, y: 2 }]);
    });

    it("should return last reachable tile when dashing west", () => {
      const caster = { ...MockPokemon.base, position: { x: 5, y: 4 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Dash, maxDistance: 2 },
        caster,
        { x: 0, y: 4 },
        grid,
      );
      expect(result).toEqual([{ x: 3, y: 4 }]);
    });

    it("should return last reachable tile when dashing south", () => {
      const caster = { ...MockPokemon.base, position: { x: 4, y: 1 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Dash, maxDistance: 2 },
        caster,
        { x: 4, y: 7 },
        grid,
      );
      expect(result).toEqual([{ x: 4, y: 3 }]);
    });

    it("should return empty when dashing out of bounds", () => {
      const caster = { ...MockPokemon.base, position: { x: 1, y: 0 } };
      const result = resolveTargeting(
        { kind: TargetingKind.Dash, maxDistance: 5 },
        caster,
        { x: 1, y: -5 },
        grid,
      );
      expect(result).toEqual([]);
    });

    it("should return only the first enemy tile", () => {
      const gridWithEnemy = Grid.createFlat(8, 8);
      gridWithEnemy.setOccupant({ x: 3, y: 4 }, "enemy-1");

      const caster = { ...MockPokemon.base, position: { x: 1, y: 4 } };
      const traversalContext: TraversalContext = { allyIds: new Set(), canTraverseEnemies: false };
      const result = resolveTargeting(
        { kind: TargetingKind.Dash, maxDistance: 5 },
        caster,
        { x: 6, y: 4 },
        gridWithEnemy,
        traversalContext,
      );
      expect(result).toEqual([{ x: 3, y: 4 }]);
    });

    it("should skip allies and return first enemy tile", () => {
      const gridWithAlly = Grid.createFlat(8, 8);
      gridWithAlly.setOccupant({ x: 2, y: 4 }, "ally-1");
      gridWithAlly.setOccupant({ x: 4, y: 4 }, "enemy-1");

      const caster = { ...MockPokemon.base, position: { x: 1, y: 4 } };
      const traversalContext: TraversalContext = {
        allyIds: new Set(["ally-1"]),
        canTraverseEnemies: false,
      };
      const result = resolveTargeting(
        { kind: TargetingKind.Dash, maxDistance: 5 },
        caster,
        { x: 6, y: 4 },
        gridWithAlly,
        traversalContext,
      );
      expect(result).toEqual([{ x: 4, y: 4 }]);
    });

    it("should return last reachable tile when traversing enemies (Flying/Ghost)", () => {
      const gridWithEnemy = Grid.createFlat(8, 8);
      gridWithEnemy.setOccupant({ x: 3, y: 4 }, "enemy-1");

      const caster = { ...MockPokemon.base, position: { x: 1, y: 4 } };
      const traversalContext: TraversalContext = { allyIds: new Set(), canTraverseEnemies: true };
      const result = resolveTargeting(
        { kind: TargetingKind.Dash, maxDistance: 5 },
        caster,
        { x: 6, y: 4 },
        gridWithEnemy,
        traversalContext,
      );
      expect(result).toEqual([{ x: 6, y: 4 }]);
    });
  });
});
