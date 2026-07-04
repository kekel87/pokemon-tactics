import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("memento", () => {
  it("drops the target's Attack and Sp. Atk by 2 and KOs the user", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["memento"],
      currentPp: { memento: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      definitionId: "pidgey",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "memento",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("foe")?.statStages[StatName.Attack]).toBe(-2);
    expect(state.pokemon.get("foe")?.statStages[StatName.SpAttack]).toBe(-2);
    expect(state.pokemon.get("user")?.currentHp).toBe(0);
    vi.restoreAllMocks();
  });
});
