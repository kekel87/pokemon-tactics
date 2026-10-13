import type { BattleState, PokemonInstance } from "@pokemon-tactic/core";
import { MockPokemon } from "@pokemon-tactic/core/testing";
import { describe, expect, it } from "vitest";
import { createCombatSceneDouble } from "../testing/combat-scene-double";
import { spawnBillboardsFromState } from "./combat-screen";

function stateOf(...pokemon: PokemonInstance[]): BattleState {
  return { pokemon: new Map(pokemon.map((entry) => [entry.id, entry])) } as unknown as BattleState;
}

describe("spawnBillboardsFromState", () => {
  it("spawns a morphed Pokemon with the copied species as appearance and its own species as id", () => {
    const double = createCombatSceneDouble();
    const ditto = MockPokemon.fresh(MockPokemon.base, {
      id: "p1-ditto",
      definitionId: "ditto",
      transformState: { definitionId: "charmander" } as PokemonInstance["transformState"],
    });

    spawnBillboardsFromState(double.scene, stateOf(ditto));

    expect(double.spawns[0]).toMatchObject({ pokemonId: "ditto", appearanceId: "charmander" });
  });

  it("spawns a Pokemon behind a Clonage doll as substituted", () => {
    const double = createCombatSceneDouble();
    const cloned = MockPokemon.fresh(MockPokemon.base, { id: "p1-a", substituteHp: 12 });

    spawnBillboardsFromState(double.scene, stateOf(cloned));

    expect(double.spawns[0]?.substituted).toBe(true);
  });

  it("spawns an ordinary Pokemon with no appearance and no doll", () => {
    const double = createCombatSceneDouble();
    const ordinary = MockPokemon.fresh(MockPokemon.base, { id: "p2-a", definitionId: "bulbasaur" });

    const handles = spawnBillboardsFromState(double.scene, stateOf(ordinary));

    expect(double.spawns[0]).toMatchObject({ pokemonId: "bulbasaur", substituted: false, team: 2 });
    expect(double.spawns[0]?.appearanceId).toBeUndefined();
    expect(handles.has("p2-a")).toBe(true);
  });
});
