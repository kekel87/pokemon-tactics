import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function stages(overrides: Partial<Record<StatName, number>>): Record<StatName, number> {
  return { ...MockPokemon.base.statStages, ...overrides };
}

describe("psych-up (Boost)", () => {
  it("copies the target's stat stages onto the caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["psych-up"],
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
      moveId: "psych-up",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.StatStagesCopied)).toBe(true);
    const casterAfter = state.pokemon.get("caster");
    expect(casterAfter?.statStages[StatName.Attack]).toBe(2);
    expect(casterAfter?.statStages[StatName.Defense]).toBe(-1);
    expect(state.pokemon.get("target")?.statStages[StatName.Attack]).toBe(2);
  });

  it("recomputes the caster's movement when a Speed stage is copied", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["psych-up"],
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      statStages: stages({ [StatName.Speed]: 4 }),
    });
    const movementBefore = caster.derivedStats.movement;
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "psych-up",
      targetPosition: { x: 1, y: 0 },
    });

    const casterAfter = state.pokemon.get("caster");
    expect(casterAfter?.statStages[StatName.Speed]).toBe(4);
    expect(casterAfter?.derivedStats.movement).toBeGreaterThan(movementBefore);
  });

  it("is blocked by the target's Substitute", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["psych-up"],
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
      moveId: "psych-up",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get("caster")?.statStages[StatName.Attack]).toBe(0);
  });
});
