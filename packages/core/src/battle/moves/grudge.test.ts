import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("grudge", () => {
  it("permanently locks the killing move on the attacker when the caster is KO'd", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      currentHp: 1,
      maxHp: 200,
      moveIds: ["grudge"],
      currentPp: { grudge: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
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
    const { engine, state } = buildMoveTestEngine([caster, ally, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "grudge",
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
    expect(state.pokemon.get("foe")?.grudgeLockedMoveIds).toContain("tackle");
    vi.restoreAllMocks();
  });
});
