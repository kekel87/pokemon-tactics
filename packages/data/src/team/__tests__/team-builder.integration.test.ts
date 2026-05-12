import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportTeamToShowdown, importShowdownTeam, validateTeamSet } from "@pokemon-tactic/core";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildTeamBuilderRegistry,
  resetTeamBuilderRegistryForTests,
} from "../team-builder-registry";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const fixtureText = readFileSync(path.join(fixturesDir, "showdown-team-roster.txt"), "utf8");

describe("Team Builder integration — Showdown round-trip", () => {
  beforeAll(() => {
    resetTeamBuilderRegistryForTests();
  });

  it("imports the 6-mon fixture without errors", () => {
    const registry = buildTeamBuilderRegistry();
    const result = importShowdownTeam(fixtureText, registry.importRegistry);
    expect(result.team).not.toBeNull();
    expect(result.team!.slots).toHaveLength(6);
    const slotIds = result.team!.slots.map((s) => s.pokemonId);
    expect(slotIds).toEqual(["charizard", "snorlax", "alakazam", "gengar", "dragonite", "starmie"]);
  });

  it("validates the imported team as legal", () => {
    const registry = buildTeamBuilderRegistry();
    const { team } = importShowdownTeam(fixtureText, registry.importRegistry);
    const validation = validateTeamSet(team!, { registry: registry.validator });
    expect(validation.errors, JSON.stringify(validation.errors, null, 2)).toEqual([]);
  });

  it("round-trip export-then-reimport preserves slots and core fields", () => {
    const registry = buildTeamBuilderRegistry();
    const { team } = importShowdownTeam(fixtureText, registry.importRegistry);
    const exported = exportTeamToShowdown(team!, registry.exportRegistry);
    const reimported = importShowdownTeam(exported, registry.importRegistry);
    expect(reimported.team).not.toBeNull();
    expect(reimported.team!.slots).toHaveLength(6);

    for (let i = 0; i < 6; i++) {
      const a = team!.slots[i]!;
      const b = reimported.team!.slots[i]!;
      expect(b.pokemonId).toBe(a.pokemonId);
      expect(b.ability).toBe(a.ability);
      expect(b.heldItemId).toBe(a.heldItemId);
      expect(b.nature).toBe(a.nature);
      expect(b.moveIds).toEqual(a.moveIds);
      expect(b.gender).toBe(a.gender);
      const totalA = Object.values(a.statSpread).reduce((s, v) => s + (v ?? 0), 0);
      const totalB = Object.values(b.statSpread).reduce((s, v) => s + (v ?? 0), 0);
      expect(Math.abs(totalA - totalB)).toBeLessThanOrEqual(6);
    }
  });
});
