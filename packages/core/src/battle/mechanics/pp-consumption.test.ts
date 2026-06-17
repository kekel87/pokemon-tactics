import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

// The PP-usage mechanism was removed in the Charge Time migration (Round-Robin dropped): no
// `currentPp`, no per-use decrement, no `ActionError.NoPpLeft` ever emitted. The two original tests
// ("decrements PP by 1 after using a move" and "cannot use a move with 0 PP") are obsolete and have
// been removed. This guard documents the new behaviour: a move always resolves regardless of PP.
describe("PP consumption — removed with the Charge Time migration", () => {
  it("never rejects a move for lack of PP", () => {
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
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

    expect(result.success).toBe(true);
  });
});
