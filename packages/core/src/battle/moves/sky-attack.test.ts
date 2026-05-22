import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("sky-attack", () => {
  it("T1 charge locks caster on sky-attack without dealing damage", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["sky-attack"],
      currentPp: { "sky-attack": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "sky-attack",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveCharging);
    expect(state.pokemon.get(defender.id)?.currentHp).toBe(MockPokemon.charmander.currentHp);
  });

  it("T2 applies Flinch volatile on the target with 30% chance", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["sky-attack"],
      currentPp: { "sky-attack": 4 },
      chargingMove: { moveId: "sky-attack", targetPosition: { x: 0, y: 0 } },
      lockedMoveId: "sky-attack",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "sky-attack",
      targetPosition: { x: 2, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    const defenderAfter = state.pokemon.get(defender.id);
    expect(defenderAfter?.currentHp).toBeGreaterThan(0);
    expect(defenderAfter?.volatileStatuses.some((v) => v.type === StatusType.Flinch)).toBe(true);
  });

  it("T2 skips Flinch when chance roll fails", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["sky-attack"],
      currentPp: { "sky-attack": 4 },
      chargingMove: { moveId: "sky-attack", targetPosition: { x: 0, y: 0 } },
      lockedMoveId: "sky-attack",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      currentHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "sky-attack",
      targetPosition: { x: 2, y: 0 },
    });

    vi.restoreAllMocks();

    const defenderAfter = state.pokemon.get(defender.id);
    expect(defenderAfter?.volatileStatuses.some((v) => v.type === StatusType.Flinch)).toBe(false);
  });
});
