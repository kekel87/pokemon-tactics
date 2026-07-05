import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function makeCaster() {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["uproar", "tackle"],
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
}

function makeFoe(position: { x: number; y: number }) {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
}

describe("uproar", () => {
  it("locks the user in without ever confusing it", () => {
    const { engine, state } = buildMoveTestEngine([makeCaster(), makeFoe({ x: 1, y: 0 })]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "uproar",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.LockInStarted);
    expect(state.pokemon.get("attacker")?.lockInMoveId).toBe("uproar");
    expect(state.pokemon.get("attacker")?.volatileStatuses).not.toContainEqual(
      expect.objectContaining({ type: StatusType.Confused }),
    );
  });

  it("rouses a sleeping target within its aura when it starts", () => {
    const foe = makeFoe({ x: 1, y: 0 });
    foe.statusEffects.push({ type: StatusType.Asleep, remainingTurns: 3 });
    const { engine, state } = buildMoveTestEngine([makeCaster(), foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "uproar",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(
      state.pokemon
        .get("defender")
        ?.statusEffects.some((status) => status.type === StatusType.Asleep),
    ).toBe(false);
  });
});
