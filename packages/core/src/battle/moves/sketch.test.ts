import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("sketch", () => {
  it("replaces its own slot with the target's last used move", () => {
    const user = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 1, y: 1 },
      moveIds: ["sketch", "quick-attack"],
    });
    const foe = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 1 },
      lastUsedMoveId: "sludge-bomb",
    });
    const { engine, state } = buildMoveTestEngine([user, foe], { random: () => 0 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "sketch",
      targetPosition: { x: 2, y: 1 },
    });

    expect(result.success).toBe(true);
    expect(
      result.events.some(
        (event) =>
          event.type === BattleEventType.MoveCopied && event.copiedMoveId === "sludge-bomb",
      ),
    ).toBe(true);
    expect(state.pokemon.get(user.id)?.moveIds).toContain("sludge-bomb");
    expect(state.pokemon.get(user.id)?.moveIds).not.toContain("sketch");
  });

  it("fails when the target has not used a move yet", () => {
    const user = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 1, y: 1 },
      moveIds: ["sketch", "quick-attack"],
    });
    const foe = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 1 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe], { random: () => 0 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "sketch",
      targetPosition: { x: 2, y: 1 },
    });

    expect(result.events.some((event) => event.type === BattleEventType.MoveCopyFailed)).toBe(true);
    expect(state.pokemon.get(user.id)?.moveIds).toContain("sketch");
  });
});
