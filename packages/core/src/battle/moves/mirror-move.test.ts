import { describe, expect, it } from "vitest";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("mirror-move", () => {
  const user = () =>
    MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 1, y: 1 },
      moveIds: ["mirror-move"],
    });

  it("copies the selected target's last used move (identity revealed)", () => {
    const foe = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 1 },
      lastUsedMoveId: "razor-leaf",
    });
    const { engine } = buildMoveTestEngine([user(), foe], { random: () => 0 });

    const result = engine.prepareCalledMove("pidgey-1", "mirror-move", "foe-1");

    expect("failed" in result).toBe(false);
    if ("failed" in result) {
      return;
    }
    expect(result.reveal).toBe(true);
    expect(result.calledMoveId).toBe("razor-leaf");
  });

  it("fails when the target has not used a move yet", () => {
    const foe = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 1 },
    });
    const { engine } = buildMoveTestEngine([user(), foe], { random: () => 0 });

    const result = engine.prepareCalledMove("pidgey-1", "mirror-move", "foe-1");

    expect("failed" in result).toBe(true);
  });
});
