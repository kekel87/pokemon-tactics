import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function stages(overrides: Partial<Record<StatName, number>>): Record<StatName, number> {
  return { ...MockPokemon.base.statStages, ...overrides };
}

describe("heart-swap (Permucœur)", () => {
  it("swaps all seven stat stages between caster and target and recomputes both movements", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["heart-swap"],
      statStages: stages({ [StatName.Attack]: 1, [StatName.Speed]: 4 }),
      derivedStats: { movement: 5, jump: 1, initiative: 55 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      statStages: stages({ [StatName.Attack]: -2, [StatName.Defense]: 3 }),
    });
    const casterMovementBefore = caster.derivedStats.movement;
    const targetMovementBefore = target.derivedStats.movement;
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "heart-swap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.StatStagesSwapped)).toBe(true);
    const casterAfter = state.pokemon.get("caster");
    const targetAfter = state.pokemon.get("target");
    expect(casterAfter?.statStages[StatName.Attack]).toBe(-2);
    expect(casterAfter?.statStages[StatName.Defense]).toBe(3);
    expect(casterAfter?.statStages[StatName.Speed]).toBe(0);
    expect(targetAfter?.statStages[StatName.Attack]).toBe(1);
    expect(targetAfter?.statStages[StatName.Speed]).toBe(4);
    expect(casterAfter?.derivedStats.movement).toBeLessThan(casterMovementBefore);
    expect(targetAfter?.derivedStats.movement).toBeGreaterThan(targetMovementBefore);
  });
});
