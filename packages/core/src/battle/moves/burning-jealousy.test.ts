import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";

describe("burning-jealousy", () => {
  it("deals damage in a cone hitting a target in front", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      orientation: Direction.East,
      moveIds: ["burning-jealousy"],
      currentPp: { "burning-jealousy": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, foe], { random: () => 0 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "burning-jealousy",
      targetPosition: { x: 1, y: 2 },
    });

    expect(damageTo(result.events, "foe")).toBeGreaterThan(0);
  });

  it("hits multiple targets within the cone", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      orientation: Direction.East,
      moveIds: ["burning-jealousy"],
      currentPp: { "burning-jealousy": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe1 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const foe2 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-2",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 1 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });
    const { engine } = buildMoveTestEngine([attacker, foe1, foe2], { random: () => 0 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "burning-jealousy",
      targetPosition: { x: 1, y: 2 },
    });

    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents.length).toBeGreaterThanOrEqual(2);
  });

  it("does not hit a target behind the attacker", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.East,
      moveIds: ["burning-jealousy"],
      currentPp: { "burning-jealousy": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foeFront = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-front",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const foeBehind = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-behind",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });
    const { engine } = buildMoveTestEngine([attacker, foeFront, foeBehind], {
      gridSize: 6,
      random: () => 0,
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "burning-jealousy",
      targetPosition: { x: 3, y: 2 },
    });

    const damageEvents = result.events.filter(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt,
    );
    const hitIds = damageEvents.map((e) => e.targetId);
    expect(hitIds).toContain("foe-front");
    expect(hitIds).not.toContain("foe-behind");
  });

  it("applies burn when target has a fresh stat boost", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      orientation: Direction.East,
      moveIds: ["burning-jealousy"],
      currentPp: { "burning-jealousy": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      hasFreshStatBoost: true,
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe], { random: () => 0 });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "burning-jealousy",
      targetPosition: { x: 1, y: 2 },
    });

    const foeState = state.pokemon.get("foe")!;
    expect(foeState.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Burned }),
    );
  });

  it("does not apply burn when target has no fresh stat boost", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      orientation: Direction.East,
      moveIds: ["burning-jealousy"],
      currentPp: { "burning-jealousy": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe], { random: () => 0 });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "burning-jealousy",
      targetPosition: { x: 1, y: 2 },
    });

    const foeState = state.pokemon.get("foe")!;
    expect(foeState.statusEffects.some((s) => s.type === StatusType.Burned)).toBe(false);
  });
});
