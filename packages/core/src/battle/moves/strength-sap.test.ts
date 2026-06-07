import { describe, expect, it } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("strength-sap", () => {
  it("heals caster by target effective Attack stat", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["strength-sap"],
      currentPp: { "strength-sap": 10 },
      currentHp: 10,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      // combatStats.attack = 55 (MockPokemon.base), stages 0 => effective = 55
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "strength-sap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HpRestored);
    // healed = min(200 - 10, 55) = 55
    expect(state.pokemon.get(caster.id)?.currentHp).toBe(65);
  });

  it("lowers target Attack by 1 stage", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["strength-sap"],
      currentPp: { "strength-sap": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "strength-sap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.statStages[StatName.Attack]).toBe(-1);
  });

  it("heals using stat stages of target (boosted Attack gives more heal)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["strength-sap"],
      currentPp: { "strength-sap": 10 },
      currentHp: 10,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const boostedTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "boosted",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      statStages: {
        ...MockPokemon.base.statStages,
        [StatName.Attack]: 2,
      },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, boostedTarget]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "strength-sap",
      targetPosition: { x: 1, y: 0 },
    });

    // Attack +2: floor(55 * (2+2)/2) = floor(55 * 2) = 110; healed = min(190, 110) = 110
    expect(state.pokemon.get(caster.id)?.currentHp).toBe(120);
  });

  it("applies heal even when target Attack is already at -6 (no heal skip)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["strength-sap"],
      currentPp: { "strength-sap": 10 },
      currentHp: 10,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const minAttackTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "min-atk",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      statStages: {
        ...MockPokemon.base.statStages,
        [StatName.Attack]: -6,
      },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, minAttackTarget]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "strength-sap",
      targetPosition: { x: 1, y: 0 },
    });

    // Attack -6: floor(55 * 2/(2+6)) = floor(55 * 0.25) = 13; healed = min(190, 13) = 13
    expect(state.pokemon.get(caster.id)?.currentHp).toBeGreaterThan(10);
  });

  it("cannot reach a target beyond range 3", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["strength-sap"],
      currentPp: { "strength-sap": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const farTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "far",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([caster, farTarget]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "strength-sap",
      targetPosition: { x: 4, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });
});
