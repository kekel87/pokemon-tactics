import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { FieldTerrain } from "../../enums/field-terrain";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { postFieldTerrain } from "../field-terrain-system";

// Monte-Tension (rising-voltage) — ×2 power when the TARGET stands on Electric Terrain

function makeCaster() {
  // Caster at y=1, target at y=5: the r3 zone centered on the target (y 2..8) does NOT reach the
  // caster, so the attacker ×1.3 Electric boost never confounds the target ×2 measurement.
  return MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 1 },
    moveIds: ["rising-voltage"],
    currentPp: { "rising-voltage": 20 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
}

function damageFrom(targetDefinitionId: string, onElectric: boolean) {
  const caster = makeCaster();
  const target = MockPokemon.fresh(MockPokemon.base, {
    id: "target",
    definitionId: targetDefinitionId,
    playerId: PlayerId.Player2,
    position: { x: 5, y: 5 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine, state } = buildMoveTestEngine([caster, target], {
    gridSize: 10,
    random: () => 0.5,
  });
  if (onElectric) {
    postFieldTerrain(state, target, FieldTerrain.Electric);
  }
  const hpBefore = target.currentHp;
  const result = engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: caster.id,
    moveId: "rising-voltage",
    targetPosition: { x: 5, y: 5 },
  });
  expect(result.success).toBe(true);
  expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
  return hpBefore - (state.pokemon.get(target.id)?.currentHp ?? 0);
}

describe("rising-voltage — target on Electric Terrain", () => {
  it("deals roughly double when the grounded target is on Electric Terrain", () => {
    // "test" = typeless mock (grounded, neutral to Electric).
    const base = damageFrom("test", false);
    const boosted = damageFrom("test", true);
    expect(boosted).toBeGreaterThan(base * 1.6);
  });

  it("does NOT double when the target is a Flying-type on the zone (double gate)", () => {
    // pidgey is Normal/Flying → escapes the ground gate, so being on the zone gives no ×2.
    const flyingOnZone = damageFrom("pidgey", true);
    const flyingOff = damageFrom("pidgey", false);
    expect(flyingOnZone).toBe(flyingOff);
  });
});
