import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function stages(overrides: Partial<Record<StatName, number>>): Record<StatName, number> {
  return { ...MockPokemon.base.statStages, ...overrides };
}

describe("topsy-turvy (Renversement)", () => {
  it("inverts the sign of every stat stage of the target", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["topsy-turvy"],
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      statStages: stages({ [StatName.Attack]: 2, [StatName.Defense]: -1 }),
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "topsy-turvy",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.StatStagesInverted)).toBe(true);
    const targetAfter = state.pokemon.get("target");
    expect(targetAfter?.statStages[StatName.Attack]).toBe(-2);
    expect(targetAfter?.statStages[StatName.Defense]).toBe(1);
    expect(targetAfter?.statStages[StatName.SpAttack]).toBe(0);
  });

  it("is blocked by the target's Substitute", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["topsy-turvy"],
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      substituteHp: 25,
      statStages: stages({ [StatName.Attack]: 2 }),
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "topsy-turvy",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get("target")?.statStages[StatName.Attack]).toBe(2);
  });
});
