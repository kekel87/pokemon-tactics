import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function stages(overrides: Partial<Record<StatName, number>>): Record<StatName, number> {
  return { ...MockPokemon.base.statStages, ...overrides };
}

describe("guard-swap (Permugarde)", () => {
  it("swaps only the Defense and Sp. Def stages, leaving Attack and Speed untouched", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["guard-swap"],
      statStages: stages({ [StatName.Defense]: 1, [StatName.Attack]: 2 }),
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      statStages: stages({ [StatName.Defense]: 3, [StatName.SpDefense]: -2, [StatName.Speed]: 1 }),
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "guard-swap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.StatStagesSwapped)).toBe(true);
    const casterAfter = state.pokemon.get("caster");
    const targetAfter = state.pokemon.get("target");
    expect(casterAfter?.statStages[StatName.Defense]).toBe(3);
    expect(casterAfter?.statStages[StatName.SpDefense]).toBe(-2);
    expect(casterAfter?.statStages[StatName.Attack]).toBe(2);
    expect(targetAfter?.statStages[StatName.Defense]).toBe(1);
    expect(targetAfter?.statStages[StatName.SpDefense]).toBe(0);
    expect(targetAfter?.statStages[StatName.Speed]).toBe(1);
  });

  it("is blocked by the target's Substitute", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["guard-swap"],
      statStages: stages({ [StatName.Defense]: 1 }),
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      substituteHp: 25,
      statStages: stages({ [StatName.Defense]: 3 }),
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "guard-swap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get("caster")?.statStages[StatName.Defense]).toBe(1);
    expect(state.pokemon.get("target")?.statStages[StatName.Defense]).toBe(3);
  });
});
