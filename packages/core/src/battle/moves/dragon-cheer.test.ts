import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { PokemonType } from "../../enums/pokemon-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { PokemonInstance } from "../../types/pokemon-instance";

function setup(allyOverrides: Partial<PokemonInstance> = {}) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["dragon-cheer"],
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const ally = MockPokemon.fresh(MockPokemon.base, {
    id: "ally",
    playerId: PlayerId.Player1,
    position: { x: 1, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 90 },
    ...allyOverrides,
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 4, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([attacker, ally, foe]);
}

function useDragonCheer(engine: ReturnType<typeof setup>["engine"]) {
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "attacker",
    moveId: "dragon-cheer",
    targetPosition: { x: 1, y: 0 },
  });
}

describe("dragon-cheer", () => {
  it("raises a non-Dragon ally's crit stage by 1", () => {
    const { engine, state } = setup();

    const result = useDragonCheer(engine);

    expect(result.success).toBe(true);
    expect(state.pokemon.get("ally")?.critStageBoost).toBe(1);
  });

  it("raises a Dragon ally's crit stage by 2", () => {
    const { engine, state } = setup({ typeOverride: [PokemonType.Dragon] });

    const result = useDragonCheer(engine);

    expect(result.success).toBe(true);
    expect(state.pokemon.get("ally")?.critStageBoost).toBe(2);
  });
});
