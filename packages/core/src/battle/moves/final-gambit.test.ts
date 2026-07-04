import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("final-gambit", () => {
  it("deals fixed damage equal to the user's current HP, then KOs the user", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      currentHp: 120,
      maxHp: 200,
      moveIds: ["final-gambit"],
      currentPp: { "final-gambit": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      definitionId: "pidgey",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "final-gambit",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBe(500 - 120);
    expect(state.pokemon.get("user")?.currentHp).toBe(0);
    vi.restoreAllMocks();
  });

  it("does nothing to a Ghost target and leaves the user alive (immunity → no connect)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      currentHp: 120,
      maxHp: 200,
      moveIds: ["final-gambit"],
      currentPp: { "final-gambit": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      definitionId: "gastly",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      currentHp: 300,
      maxHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "final-gambit",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBe(300);
    expect(state.pokemon.get("user")?.currentHp).toBe(120);
    vi.restoreAllMocks();
  });
});
