import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";

describe("lick", () => {
  it("deals damage to adjacent target", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["lick"],
      currentPp: { lick: 30 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);
    const hpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "lick",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(defender.id)?.currentHp).toBeLessThan(hpBefore);
  });

  it("applies paralysis when proc triggers", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["lick"],
      currentPp: { lick: 30 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "lick",
      targetPosition: { x: 1, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    const statusEvent = result.events.find(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.StatusApplied }> =>
        e.type === BattleEventType.StatusApplied,
    );
    expect(statusEvent?.status).toBe(StatusType.Paralyzed);
    expect(statusEvent?.targetId).toBe(defender.id);
    expect(state.pokemon.get(defender.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Paralyzed }),
    );
  });

  it("cannot hit out of range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["lick"],
      currentPp: { lick: 30 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "lick",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });
});
