import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("alluring-voice", () => {
  it("deals damage to an adjacent target", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["alluring-voice"],
      currentPp: { "alluring-voice": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender], { random: () => 0 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "alluring-voice",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
  });

  it("does not reach a target out of range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["alluring-voice"],
      currentPp: { "alluring-voice": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender], { random: () => 0 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "alluring-voice",
      targetPosition: { x: 4, y: 0 },
    });

    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.DamageDealt);
  });

  it("applies confusion when target has a fresh stat boost", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["alluring-voice"],
      currentPp: { "alluring-voice": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      hasFreshStatBoost: true,
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], { random: () => 0 });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "alluring-voice",
      targetPosition: { x: 1, y: 0 },
    });

    const defenderState = state.pokemon.get("defender")!;
    expect(defenderState.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Confused }),
    );
  });

  it("does not apply confusion when target has no fresh stat boost", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["alluring-voice"],
      currentPp: { "alluring-voice": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], { random: () => 0 });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "alluring-voice",
      targetPosition: { x: 1, y: 0 },
    });

    const defenderState = state.pokemon.get("defender")!;
    expect(defenderState.volatileStatuses.some((v) => v.type === StatusType.Confused)).toBe(false);
  });

  it("applies confusion when target received an ally stat boost (auto-boost scenario)", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["alluring-voice"],
      currentPp: { "alluring-voice": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.South,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      hasFreshStatBoost: true,
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], { random: () => 0 });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "alluring-voice",
      targetPosition: { x: 1, y: 0 },
    });

    const defenderState = state.pokemon.get("defender")!;
    expect(defenderState.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Confused }),
    );
  });
});
