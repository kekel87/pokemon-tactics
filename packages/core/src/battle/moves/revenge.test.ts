import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";

function damageTo(events: BattleEvent[], targetId: string): number {
  return events
    .filter(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt,
    )
    .filter((e) => e.targetId === targetId)
    .reduce((sum, e) => sum + e.amount, 0);
}

describe("revenge", () => {
  it("deals damage to an adjacent target", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["revenge"],
      currentPp: { revenge: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "revenge",
      targetPosition: { x: 1, y: 0 },
    });

    expect(damageTo(result.events, "defender")).toBeGreaterThan(0);
  });

  it("does not reach a target out of range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["revenge"],
      currentPp: { revenge: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "revenge",
      targetPosition: { x: 2, y: 0 },
    });

    expect(damageTo(result.events, "defender")).toBe(0);
  });

  it("roughly doubles damage when attacker was hit by enemy since last action", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["revenge"],
      currentPp: { revenge: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      lastActedAtAction: 1,
      lastDamagedByEnemyAtAction: 5,
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });
    state.actionCounter = 6;

    const normal = (() => {
      const a2 = MockPokemon.fresh(MockPokemon.base, {
        id: "attacker2",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["revenge"],
        currentPp: { revenge: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const d2 = MockPokemon.fresh(MockPokemon.base, {
        id: "defender2",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: e2 } = buildMoveTestEngine([a2, d2], { random: () => 0.5 });
      return damageTo(
        e2.submitAction(PlayerId.Player1, {
          kind: ActionKind.UseMove,
          pokemonId: "attacker2",
          moveId: "revenge",
          targetPosition: { x: 1, y: 0 },
        }).events,
        "defender2",
      );
    })();

    const boosted = damageTo(
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: attacker.id,
        moveId: "revenge",
        targetPosition: { x: 1, y: 0 },
      }).events,
      "defender",
    );

    expect(boosted).toBeGreaterThanOrEqual(normal * 1.8);
    expect(boosted).toBeLessThanOrEqual(normal * 2.2);
  });

  it("does not double when damage stamp is older than last action", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["revenge"],
      currentPp: { revenge: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      lastActedAtAction: 5,
      lastDamagedByEnemyAtAction: 3,
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });
    state.actionCounter = 6;

    const normal = (() => {
      const a2 = MockPokemon.fresh(MockPokemon.base, {
        id: "attacker2",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["revenge"],
        currentPp: { revenge: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const d2 = MockPokemon.fresh(MockPokemon.base, {
        id: "defender2",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: e2 } = buildMoveTestEngine([a2, d2], { random: () => 0.5 });
      return damageTo(
        e2.submitAction(PlayerId.Player1, {
          kind: ActionKind.UseMove,
          pokemonId: "attacker2",
          moveId: "revenge",
          targetPosition: { x: 1, y: 0 },
        }).events,
        "defender2",
      );
    })();

    const stale = damageTo(
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: attacker.id,
        moveId: "revenge",
        targetPosition: { x: 1, y: 0 },
      }).events,
      "defender",
    );

    expect(stale).toBeGreaterThanOrEqual(normal * 0.9);
    expect(stale).toBeLessThanOrEqual(normal * 1.1);
  });
});
