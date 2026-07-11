import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("howl", () => {
  it("raises Attack by 1 for the caster and every ally within Manhattan radius 2", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["howl"],
      currentPp: { howl: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const allyNear = MockPokemon.fresh(MockPokemon.base, {
      id: "ally-near",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const allyFar = MockPokemon.fresh(MockPokemon.base, {
      id: "ally-far",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 40 },
    });
    const enemyNear = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy-near",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, allyNear, allyFar, enemyNear]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "howl",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get(caster.id)?.statStages[StatName.Attack]).toBe(1);
    expect(state.pokemon.get(allyNear.id)?.statStages[StatName.Attack]).toBe(1);
    expect(state.pokemon.get(allyFar.id)?.statStages[StatName.Attack]).toBe(0);
    expect(state.pokemon.get(enemyNear.id)?.statStages[StatName.Attack]).toBe(0);
  });
});
