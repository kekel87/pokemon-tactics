import { describe, expect, it } from "vitest";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("copycat", () => {
  const user = () =>
    MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 1, y: 1 },
      moveIds: ["copycat"],
    });
  const foe = () =>
    MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
    });

  it("copies the last move used by anyone (identity revealed)", () => {
    const { engine, state } = buildMoveTestEngine([user(), foe()], { random: () => 0 });
    state.lastMoveUsedGlobally = "ember";

    const result = engine.prepareCalledMove("pidgey-1", "copycat");

    expect("failed" in result).toBe(false);
    if ("failed" in result) {
      return;
    }
    expect(result.reveal).toBe(true);
    expect(result.calledMoveId).toBe("ember");
  });

  it("fails when no move has been used yet", () => {
    const { engine } = buildMoveTestEngine([user(), foe()], { random: () => 0 });

    const result = engine.prepareCalledMove("pidgey-1", "copycat");

    expect("failed" in result).toBe(true);
  });
});
