import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function stages(overrides: Partial<Record<StatName, number>>): Record<StatName, number> {
  return { ...MockPokemon.base.statStages, ...overrides };
}

describe("haze (Buée Noire)", () => {
  it("resets the stages of every living mon inside the r3 diamond, caster included", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["haze"],
      statStages: stages({ [StatName.Attack]: 2 }),
    });
    const inZoneEnemy = MockPokemon.fresh(MockPokemon.charmander, {
      id: "in-zone",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      statStages: stages({ [StatName.Attack]: 3, [StatName.Speed]: 2 }),
      derivedStats: { movement: 5, jump: 1, initiative: 70 },
    });
    const outZoneEnemy = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "out-zone",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      statStages: stages({ [StatName.Attack]: 2 }),
    });
    const { engine, state } = buildMoveTestEngine([caster, inZoneEnemy, outZoneEnemy], {
      gridSize: 6,
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "haze",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.StatStagesReset)).toBe(true);
    expect(state.pokemon.get("caster")?.statStages[StatName.Attack]).toBe(0);
    expect(state.pokemon.get("in-zone")?.statStages[StatName.Attack]).toBe(0);
    expect(state.pokemon.get("in-zone")?.statStages[StatName.Speed]).toBe(0);
    expect(state.pokemon.get("out-zone")?.statStages[StatName.Attack]).toBe(2);
  });

  it("recomputes movement when it erases a Speed stage", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["haze"],
    });
    const boosted = MockPokemon.fresh(MockPokemon.charmander, {
      id: "boosted",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      statStages: stages({ [StatName.Speed]: 2 }),
      derivedStats: { movement: 5, jump: 1, initiative: 70 },
    });
    const { engine, state } = buildMoveTestEngine([caster, boosted], { gridSize: 6 });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "haze",
      targetPosition: { x: 0, y: 0 },
    });

    const after = state.pokemon.get("boosted");
    expect(after?.statStages[StatName.Speed]).toBe(0);
    expect(after?.derivedStats.movement).toBe(4);
  });

  it("ignores the target's Substitute (Clone) — a terrain reset", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["haze"],
    });
    const cloned = MockPokemon.fresh(MockPokemon.charmander, {
      id: "cloned",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      substituteHp: 25,
      statStages: stages({ [StatName.Attack]: 3 }),
    });
    const { engine, state } = buildMoveTestEngine([caster, cloned], { gridSize: 6 });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "haze",
      targetPosition: { x: 0, y: 0 },
    });

    expect(state.pokemon.get("cloned")?.statStages[StatName.Attack]).toBe(0);
  });
});
