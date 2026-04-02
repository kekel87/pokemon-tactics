import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("slash", () => {
  it("hits targets in slash arc", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.East,
      moveIds: ["slash"],
      currentPp: { slash: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foeFront = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-front",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const foeDiag = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-diag",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 1 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });
    const { engine } = buildMoveTestEngine([user, foeFront, foeDiag]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "slash",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents).toHaveLength(2);
    vi.restoreAllMocks();
  });
});
