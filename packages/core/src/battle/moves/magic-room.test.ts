import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { FieldGlobalKind } from "../../enums/field-global-kind";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, buildMoveTestEngine, MockPokemon } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";
import { postFieldGlobalZone } from "../field-global-system";

// Zone Magique (magic-room) — move integration tests.

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
    heldItemId: HeldItemId.LifeOrb,
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 6, y: 5 },
    combatStats: { hp: 300, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
  });
  return buildItemTestEngine([caster, foe], 12, "caster");
}

describe("magic-room — zone posting", () => {
  it("posts a MagicRoom field-global zone", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
      moveIds: ["magic-room"],
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
      moveId: "magic-room",
      targetPosition: { x: 5, y: 5 },
    });

    expect(result.success).toBe(true);
    expect(state.fieldGlobalZones[0]?.kind).toBe(FieldGlobalKind.MagicRoom);
  });
});

describe("magic-room — suppresses held items", () => {
  it("nullifies the attacker's Life Orb damage boost inside the zone", () => {
    const suppressed = buildScenario();
    const suppressedCaster = suppressed.state.pokemon.get("caster");
    if (!suppressedCaster) {
      throw new Error("missing caster");
    }
    postFieldGlobalZone(suppressed.state, suppressedCaster, FieldGlobalKind.MagicRoom);
    const suppressedHit = suppressed.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tackle",
      targetPosition: { x: 6, y: 5 },
    });

    const boosted = buildScenario();
    const boostedHit = boosted.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tackle",
      targetPosition: { x: 6, y: 5 },
    });

    expect(damageTo(boostedHit.events, "foe")).toBeGreaterThan(
      damageTo(suppressedHit.events, "foe"),
    );
  });

  it("cancels the attacker's Life Orb recoil inside the zone", () => {
    const suppressed = buildScenario();
    const suppressedCaster = suppressed.state.pokemon.get("caster");
    if (!suppressedCaster) {
      throw new Error("missing caster");
    }
    postFieldGlobalZone(suppressed.state, suppressedCaster, FieldGlobalKind.MagicRoom);
    suppressed.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tackle",
      targetPosition: { x: 6, y: 5 },
    });
    expect(suppressed.state.pokemon.get("caster")?.currentHp).toBe(suppressedCaster.maxHp);

    const boosted = buildScenario();
    const boostedCaster = boosted.state.pokemon.get("caster");
    boosted.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tackle",
      targetPosition: { x: 6, y: 5 },
    });
    expect(boosted.state.pokemon.get("caster")?.currentHp).toBeLessThan(boostedCaster?.maxHp ?? 0);
  });
});
