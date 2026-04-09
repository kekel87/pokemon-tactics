import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { buildFallTestEngine } from "../testing/build-fall-test-engine";

describe("fall damage — knockback scenarios", () => {
  // Given attacker at h3 (2,2), target at h3 (3,2), tile (4,2) at h0
  // When knockback pushes target east to (4,2)
  // Then fall damage = 66% maxHp (tier 3)
  it("knockback from h3 to h0 deals 66% maxHp", () => {
    const heights = new Map([
      ["2,2", 3],
      ["3,2", 3],
      ["4,2", 0],
    ]);
    const { engine, target } = buildFallTestEngine({ x: 2, y: 2 }, { x: 3, y: 2 }, heights);

    const result = engine.submitAction("player-1", {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "test-knockback",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const fallEvents = result.events.filter((e) => e.type === BattleEventType.FallDamageDealt);
    expect(fallEvents).toHaveLength(1);

    const fallEvent = fallEvents[0];
    if (fallEvent?.type === BattleEventType.FallDamageDealt) {
      expect(fallEvent.amount).toBe(Math.floor(0.66 * 150));
      expect(fallEvent.heightDiff).toBe(3);
    }

    const expectedHp = 150 - Math.floor(0.66 * 150);
    expect(target.currentHp).toBeLessThanOrEqual(expectedHp);
  });

  // Given knockback from h4 to h0
  // Then 100% maxHp = KO
  it("knockback from h4 to h0 is lethal", () => {
    const heights = new Map([
      ["2,2", 4],
      ["3,2", 4],
      ["4,2", 0],
    ]);
    const { engine, target } = buildFallTestEngine({ x: 2, y: 2 }, { x: 3, y: 2 }, heights);

    const result = engine.submitAction("player-1", {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "test-knockback",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const koEvents = result.events.filter(
      (e) => e.type === BattleEventType.PokemonKo && e.pokemonId === "target",
    );
    expect(koEvents).toHaveLength(1);
    expect(target.currentHp).toBe(0);
  });

  // Given a Flying-type Pokemon knocked back from h3 to h0
  // Then no fall damage (immune)
  it("flying Pokemon takes no fall damage from knockback", () => {
    const heights = new Map([
      ["2,2", 3],
      ["3,2", 3],
      ["4,2", 0],
    ]);
    const { engine, target } = buildFallTestEngine(
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      heights,
      "pidgey",
    );

    const result = engine.submitAction("player-1", {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "test-knockback",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const fallEvents = result.events.filter((e) => e.type === BattleEventType.FallDamageDealt);
    expect(fallEvents).toHaveLength(0);
    expect(target.currentHp).toBeGreaterThan(0);
  });

  // Knockback to same height = no fall damage
  it("knockback at same height deals no fall damage", () => {
    const heights = new Map([
      ["2,2", 2],
      ["3,2", 2],
      ["4,2", 2],
    ]);
    const { engine } = buildFallTestEngine({ x: 2, y: 2 }, { x: 3, y: 2 }, heights);

    const result = engine.submitAction("player-1", {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "test-knockback",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const fallEvents = result.events.filter((e) => e.type === BattleEventType.FallDamageDealt);
    expect(fallEvents).toHaveLength(0);
  });

  // Knockback down 1 tile = safe landing, no damage
  it("knockback down 1 tile deals no fall damage (safe landing)", () => {
    const heights = new Map([
      ["2,2", 1],
      ["3,2", 1],
      ["4,2", 0],
    ]);
    const { engine } = buildFallTestEngine({ x: 2, y: 2 }, { x: 3, y: 2 }, heights);

    const result = engine.submitAction("player-1", {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "test-knockback",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const fallEvents = result.events.filter((e) => e.type === BattleEventType.FallDamageDealt);
    expect(fallEvents).toHaveLength(0);
  });
});
