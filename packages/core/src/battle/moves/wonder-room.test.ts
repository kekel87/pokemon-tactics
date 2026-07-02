import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { FieldGlobalKind } from "../../enums/field-global-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";
import { postFieldGlobalZone } from "../field-global-system";

// Zone Étrange (wonder-room) — move integration tests.

function damageTo(events: BattleEvent[], targetId: string): number {
  return events
    .filter(
      (event): event is Extract<BattleEvent, { type: typeof BattleEventType.DamageDealt }> =>
        event.type === BattleEventType.DamageDealt && event.targetId === targetId,
    )
    .reduce((sum, event) => sum + event.amount, 0);
}

function buildScenario() {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
    moveIds: ["tackle"],
    currentPp: { tackle: 10 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 6, y: 5 },
    combatStats: { hp: 200, attack: 50, defense: 200, spAttack: 50, spDefense: 20, speed: 50 },
  });
  return buildMoveTestEngine([caster, foe], { gridSize: 12 });
}

describe("wonder-room — zone posting", () => {
  it("posts a WonderRoom field-global zone", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
      moveIds: ["wonder-room"],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 9, y: 9 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe], { gridSize: 12 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "wonder-room",
      targetPosition: { x: 5, y: 5 },
    });

    expect(result.success).toBe(true);
    expect(state.fieldGlobalZones[0]?.kind).toBe(FieldGlobalKind.WonderRoom);
  });
});

describe("wonder-room — swaps the defender's Def and Sp.Def", () => {
  it("makes a physical hit read the defender's low Special Defense inside the zone", () => {
    const swapped = buildScenario();
    const swappedCaster = swapped.state.pokemon.get("caster");
    if (!swappedCaster) {
      throw new Error("missing caster");
    }
    postFieldGlobalZone(swapped.state, swappedCaster, FieldGlobalKind.WonderRoom);
    const swappedHit = swapped.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tackle",
      targetPosition: { x: 6, y: 5 },
    });

    const normal = buildScenario();
    const normalHit = normal.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tackle",
      targetPosition: { x: 6, y: 5 },
    });

    expect(damageTo(swappedHit.events, "foe")).toBeGreaterThan(damageTo(normalHit.events, "foe"));
  });
});
