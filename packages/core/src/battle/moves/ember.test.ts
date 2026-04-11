import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockBattle, MockPokemon } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";

describe("ember", () => {
  it("deals damage at max range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);
    const hpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "ember",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(defender.id)?.currentHp).toBeLessThan(hpBefore);
  });

  it("applies burn when proc triggers", () => {
    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.squirtle, {
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
      moveId: "ember",
      targetPosition: { x: 1, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    const statusEvent = result.events.find(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.StatusApplied }> =>
        e.type === BattleEventType.StatusApplied,
    );
    expect(statusEvent?.status).toBe(StatusType.Burned);
    expect(statusEvent?.targetId).toBe(defender.id);
    expect(state.pokemon.get(defender.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Burned }),
    );
  });

  it("cannot hit beyond max range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "ember",
      targetPosition: { x: 5, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });

  it("hits a target standing on top of a pillar (no universal height reach limit for ranged shots)", () => {
    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defenderOnPillar = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defenderOnPillar]);
    MockBattle.setTile(state, 2, 0, { height: 2 });
    const hpBefore = state.pokemon.get(defenderOnPillar.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "ember",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get(defenderOnPillar.id)?.currentHp).toBeLessThan(hpBefore);
  });
});
