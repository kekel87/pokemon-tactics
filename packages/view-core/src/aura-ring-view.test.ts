import { AuraKind, Grid, type Position } from "@pokemon-tactic/core";
import { MockBattle, MockPokemon } from "@pokemon-tactic/core/testing";
import { describe, expect, it } from "vitest";
import { buildAuraRingSpecs } from "./aura-ring-view.js";
import { AURA_RING_COLOR_BY_KIND } from "./constants.js";

const GRID_SIZE = 9;

const grid = Grid.createFlat(GRID_SIZE, GRID_SIZE);
const zoneTiles = (center: Position, radius: number): readonly Position[] =>
  grid.getTilesInRange(center, 0, radius);

const stateWith = (
  pokemon: Parameters<typeof MockBattle.stateFrom>[0],
  auras: Parameters<typeof MockBattle.stateFrom>[3] = [],
) => MockBattle.stateFrom(pokemon, GRID_SIZE, GRID_SIZE, auras);

const teamAura = (kind: AuraKind, casterPokemonId: string, postedAtAction: number) => ({
  ...MockBattle.teamAura,
  kind,
  casterPokemonId,
  postedAtAction,
});

describe("buildAuraRingSpecs", () => {
  it("returns nothing when no aura is up", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "a", position: { x: 4, y: 4 } });
    expect(buildAuraRingSpecs(stateWith([caster]), zoneTiles)).toEqual([]);
  });

  it("builds one ring per team aura, tinted by kind", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "a", position: { x: 4, y: 4 } });
    const specs = buildAuraRingSpecs(
      stateWith([caster], [teamAura(AuraKind.Reflect, "a", 1)]),
      zoneTiles,
    );
    expect(specs).toHaveLength(1);
    expect(specs[0]?.id).toBe("reflect:a");
    expect(specs[0]?.color).toBe(AURA_RING_COLOR_BY_KIND[AuraKind.Reflect]);
    expect(specs[0]?.stackIndex).toBe(0);
    expect(specs[0]?.tiles).toHaveLength(25);
  });

  it("clips the zone to the map edge", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "a", position: { x: 0, y: 0 } });
    const specs = buildAuraRingSpecs(
      stateWith([caster], [teamAura(AuraKind.Mist, "a", 1)]),
      zoneTiles,
    );
    expect(specs[0]?.tiles).toHaveLength(10);
  });

  it("stacks a caster's auras by post order", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "a", position: { x: 4, y: 4 } });
    const state = stateWith(
      [caster],
      [
        teamAura(AuraKind.Safeguard, "a", 7),
        teamAura(AuraKind.Reflect, "a", 2),
        teamAura(AuraKind.LightScreen, "a", 4),
      ],
    );
    expect(
      buildAuraRingSpecs(state, zoneTiles).map((spec) => [spec.kind, spec.stackIndex]),
    ).toEqual([
      ["reflect", 0],
      ["light-screen", 1],
      ["safeguard", 2],
    ]);
  });

  it("breaks a tie on post order by kind", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "a", position: { x: 4, y: 4 } });
    const state = stateWith(
      [caster],
      [teamAura(AuraKind.Safeguard, "a", 3), teamAura(AuraKind.Mist, "a", 3)],
    );
    expect(buildAuraRingSpecs(state, zoneTiles).map((spec) => spec.kind)).toEqual([
      "mist",
      "safeguard",
    ]);
  });

  it("returns the same order for the same state", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "a", position: { x: 4, y: 4 } });
    const state = stateWith(
      [caster],
      [teamAura(AuraKind.Safeguard, "a", 7), teamAura(AuraKind.Reflect, "a", 2)],
    );
    expect(buildAuraRingSpecs(state, zoneTiles)).toEqual(buildAuraRingSpecs(state, zoneTiles));
  });

  it("draws Requiem with its own radius", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "a",
      position: { x: 4, y: 4 },
      perishAura: { turnsRemaining: 3, radius: 1 },
    });
    const specs = buildAuraRingSpecs(stateWith([caster]), zoneTiles);
    expect(specs).toHaveLength(1);
    expect(specs[0]?.kind).toBe("perish-aura");
    expect(specs[0]?.tiles).toHaveLength(5);
  });

  it("draws Brouhaha from the lock-in", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "a",
      position: { x: 4, y: 4 },
      lockInMoveId: "uproar",
      lockInTurnsRemaining: 2,
    });
    expect(buildAuraRingSpecs(stateWith([caster]), zoneTiles).map((spec) => spec.kind)).toEqual([
      "uproar",
    ]);
  });

  it("ignores a lock-in on another move", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "a",
      position: { x: 4, y: 4 },
      lockInMoveId: "outrage",
      lockInTurnsRemaining: 2,
    });
    expect(buildAuraRingSpecs(stateWith([caster]), zoneTiles)).toEqual([]);
  });

  it("stacks Requiem and Brouhaha above the team auras", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "a",
      position: { x: 4, y: 4 },
      perishAura: { turnsRemaining: 3, radius: 2 },
      lockInMoveId: "uproar",
      lockInTurnsRemaining: 2,
    });
    const specs = buildAuraRingSpecs(
      stateWith([caster], [teamAura(AuraKind.Reflect, "a", 1)]),
      zoneTiles,
    );
    expect(specs.map((spec) => spec.kind)).toEqual(["reflect", "perish-aura", "uproar"]);
    expect(specs.map((spec) => spec.stackIndex)).toEqual([0, 1, 2]);
  });

  it("drops an aura whose caster is knocked out", () => {
    const screenCaster = MockPokemon.fresh(MockPokemon.base, {
      id: "a",
      position: { x: 4, y: 4 },
      currentHp: 0,
    });
    const perishCaster = MockPokemon.fresh(MockPokemon.base, {
      id: "b",
      position: { x: 2, y: 2 },
      currentHp: 0,
      perishAura: { turnsRemaining: 3, radius: 2 },
    });
    const state = stateWith([screenCaster, perishCaster], [teamAura(AuraKind.Reflect, "a", 1)]);
    expect(buildAuraRingSpecs(state, zoneTiles)).toEqual([]);
  });

  it("follows the caster's live position", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "a", position: { x: 4, y: 4 } });
    const state = stateWith([caster], [teamAura(AuraKind.Reflect, "a", 1)]);
    const before = buildAuraRingSpecs(state, zoneTiles)[0]?.tiles;
    caster.position = { x: 0, y: 0 };
    const after = buildAuraRingSpecs(state, zoneTiles)[0]?.tiles;
    expect(after).not.toEqual(before);
    expect(after).toHaveLength(10);
  });

  it("stacks each caster independently", () => {
    const first = MockPokemon.fresh(MockPokemon.base, { id: "a", position: { x: 2, y: 2 } });
    const second = MockPokemon.fresh(MockPokemon.base, { id: "b", position: { x: 6, y: 6 } });
    const state = stateWith(
      [first, second],
      [teamAura(AuraKind.Reflect, "a", 1), teamAura(AuraKind.Mist, "b", 2)],
    );
    expect(
      buildAuraRingSpecs(state, zoneTiles).map((spec) => [spec.casterPokemonId, spec.stackIndex]),
    ).toEqual([
      ["a", 0],
      ["b", 0],
    ]);
  });
});
