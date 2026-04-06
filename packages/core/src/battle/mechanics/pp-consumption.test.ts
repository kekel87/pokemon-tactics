import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("PP consumption", () => {
  it("decrements PP by 1 after using a move", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });

    const { engine, state } = buildMoveTestEngine([charmander, bulbasaur]);
    const pokemon = state.pokemon.get("charmander-1")!;
    const ppBefore = pokemon.currentPp.ember!;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "charmander-1",
      moveId: "ember",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(pokemon.currentPp.ember).toBe(ppBefore - 1);

    vi.restoreAllMocks();
  });

  it("cannot use a move with 0 PP", () => {
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentPp: { ember: 0, scratch: 35, smokescreen: 20, "dragon-breath": 20 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });

    const { engine } = buildMoveTestEngine([charmander, bulbasaur]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "charmander-1",
      moveId: "ember",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.NoPpLeft);
  });
});
