import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function stages(overrides: Partial<Record<StatName, number>>): Record<StatName, number> {
  return { ...MockPokemon.base.statStages, ...overrides };
}

describe("power-swap (Permuforce)", () => {
  it("swaps only the Attack and Sp. Atk stages, leaving Defense untouched", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["power-swap"],
      statStages: stages({ [StatName.Attack]: 1, [StatName.Defense]: 2 }),
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      statStages: stages({ [StatName.Attack]: 3, [StatName.SpAttack]: -1 }),
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "power-swap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.StatStagesSwapped)).toBe(true);
    const casterAfter = state.pokemon.get("caster");
    const targetAfter = state.pokemon.get("target");
    expect(casterAfter?.statStages[StatName.Attack]).toBe(3);
    expect(casterAfter?.statStages[StatName.SpAttack]).toBe(-1);
    expect(casterAfter?.statStages[StatName.Defense]).toBe(2);
    expect(targetAfter?.statStages[StatName.Attack]).toBe(1);
    expect(targetAfter?.statStages[StatName.SpAttack]).toBe(0);
  });
});
