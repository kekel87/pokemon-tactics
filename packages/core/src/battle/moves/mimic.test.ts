import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("mimic", () => {
  const buildUser = (slotMove: string) =>
    MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 1, y: 1 },
      moveIds: [slotMove, "quick-attack"],
    });

  it("replaces its own slot with the target's last used move", () => {
    const user = buildUser("mimic");
    const foe = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 1 },
      lastUsedMoveId: "razor-leaf",
    });
    const { engine, state } = buildMoveTestEngine([user, foe], { random: () => 0 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "mimic",
      targetPosition: { x: 2, y: 1 },
    });

    expect(result.success).toBe(true);
    expect(
      result.events.some(
        (event) => event.type === BattleEventType.MoveCopied && event.copiedMoveId === "razor-leaf",
      ),
    ).toBe(true);
    expect(state.pokemon.get(user.id)?.moveIds).toContain("razor-leaf");
    expect(state.pokemon.get(user.id)?.moveIds).not.toContain("mimic");
  });

  it("fails when the target has not used a move yet", () => {
    const user = buildUser("mimic");
    const foe = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 1 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe], { random: () => 0 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "mimic",
      targetPosition: { x: 2, y: 1 },
    });

    expect(result.events.some((event) => event.type === BattleEventType.MoveCopyFailed)).toBe(true);
    expect(state.pokemon.get(user.id)?.moveIds).toContain("mimic");
  });
});
