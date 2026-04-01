import { describe, expect, it } from "vitest";
import { validateMapDefinition } from "@pokemon-tactic/core";
import { sandboxArena } from "./sandbox-arena";

describe("sandboxArena", () => {
  it("passes map validation", () => {
    const result = validateMapDefinition(sandboxArena);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("is a 6x6 grid with 2 spawn zones of 1 position each", () => {
    expect(sandboxArena.width).toBe(6);
    expect(sandboxArena.height).toBe(6);

    const format = sandboxArena.formats[0]!;
    expect(format.teamCount).toBe(2);
    expect(format.maxPokemonPerTeam).toBe(1);
    expect(format.spawnZones[0]!.positions).toEqual([{ x: 3, y: 4 }]);
    expect(format.spawnZones[1]!.positions).toEqual([{ x: 3, y: 1 }]);
  });
});
