import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("destiny-bond", () => {
  it("drags the killer down when the caster is KO'd before its next turn", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      currentHp: 1,
      maxHp: 200,
      moveIds: ["destiny-bond"],
      currentPp: { "destiny-bond": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      definitionId: "pidgey",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      currentHp: 300,
      maxHp: 300,
      moveIds: ["tackle"],
      currentPp: { tackle: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "destiny-bond",
      targetPosition: { x: 2, y: 2 },
    });

    engine.pinActiveForTest("foe");
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "foe",
      moveId: "tackle",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.pokemon.get("caster")?.currentHp).toBe(0);
    expect(state.pokemon.get("foe")?.currentHp).toBe(0);
    vi.restoreAllMocks();
  });
});
