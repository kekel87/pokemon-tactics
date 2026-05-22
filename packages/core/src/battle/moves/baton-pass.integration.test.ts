import { describe, expect, it } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { DefensiveKind } from "../../enums/defensive-kind";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

const ATTACK_2_STAGES: typeof MockPokemon.base.statStages = {
  [StatName.Hp]: 0,
  [StatName.Attack]: 2,
  [StatName.Defense]: 0,
  [StatName.SpAttack]: 0,
  [StatName.SpDefense]: 0,
  [StatName.Speed]: 0,
  [StatName.Accuracy]: 0,
  [StatName.Evasion]: 0,
};

describe("baton-pass", () => {
  it("transfers positive stat stages to adjacent ally and resets caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "caster-1",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["baton-pass"],
      currentPp: { "baton-pass": 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      statStages: {
        [StatName.Hp]: 0,
        [StatName.Attack]: 2,
        [StatName.Defense]: 0,
        [StatName.SpAttack]: 0,
        [StatName.SpDefense]: 0,
        [StatName.Speed]: 1,
        [StatName.Accuracy]: 0,
        [StatName.Evasion]: 0,
      },
    });
    const ally = MockPokemon.fresh(MockPokemon.charmander, {
      id: "ally-1",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "baton-pass",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.BatonPassed);

    const casterAfter = state.pokemon.get(caster.id);
    const allyAfter = state.pokemon.get(ally.id);
    expect(casterAfter?.statStages[StatName.Attack]).toBe(0);
    expect(casterAfter?.statStages[StatName.Speed]).toBe(0);
    expect(allyAfter?.statStages[StatName.Attack]).toBe(2);
    expect(allyAfter?.statStages[StatName.Speed]).toBe(1);
  });

  it("emits BatonPassed only when caster has no stages to transfer", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "caster-1",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["baton-pass"],
      currentPp: { "baton-pass": 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.charmander, {
      id: "ally-1",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
    });
    const { engine } = buildMoveTestEngine([caster, ally]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "baton-pass",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const types = result.events.map((e) => e.type);
    expect(types).toContain(BattleEventType.BatonPassed);
    expect(types).not.toContain(BattleEventType.StatChanged);
  });

  it("rejects target out of range", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "caster-1",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["baton-pass"],
      currentPp: { "baton-pass": 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.charmander, {
      id: "ally-1",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 0 },
    });
    const { engine } = buildMoveTestEngine([caster, ally]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "baton-pass",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });

  it("rejects enemy target", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "caster-1",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["baton-pass"],
      currentPp: { "baton-pass": 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      statStages: { ...ATTACK_2_STAGES },
    });
    const enemy = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "enemy-1",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });
    const { engine, state } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "baton-pass",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
    expect(state.pokemon.get(caster.id)?.statStages[StatName.Attack]).toBe(2);
  });

  it("rejects self target", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "caster-1",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["baton-pass"],
      currentPp: { "baton-pass": 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.charmander, {
      id: "ally-1",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
    });
    const { engine } = buildMoveTestEngine([caster, ally]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "baton-pass",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });

  it("transfers negative stages as well", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "caster-1",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["baton-pass"],
      currentPp: { "baton-pass": 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      statStages: {
        [StatName.Hp]: 0,
        [StatName.Attack]: -2,
        [StatName.Defense]: 0,
        [StatName.SpAttack]: 0,
        [StatName.SpDefense]: 0,
        [StatName.Speed]: 0,
        [StatName.Accuracy]: 0,
        [StatName.Evasion]: 0,
      },
    });
    const ally = MockPokemon.fresh(MockPokemon.charmander, {
      id: "ally-1",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "baton-pass",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get(caster.id)?.statStages[StatName.Attack]).toBe(0);
    expect(state.pokemon.get(ally.id)?.statStages[StatName.Attack]).toBe(-2);
  });

  it("overwrites target existing stages (set semantics)", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "caster-1",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["baton-pass"],
      currentPp: { "baton-pass": 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      statStages: {
        [StatName.Hp]: 0,
        [StatName.Attack]: 3,
        [StatName.Defense]: 0,
        [StatName.SpAttack]: 0,
        [StatName.SpDefense]: 0,
        [StatName.Speed]: 0,
        [StatName.Accuracy]: 0,
        [StatName.Evasion]: 0,
      },
    });
    const ally = MockPokemon.fresh(MockPokemon.charmander, {
      id: "ally-1",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      statStages: {
        [StatName.Hp]: 0,
        [StatName.Attack]: 5,
        [StatName.Defense]: 0,
        [StatName.SpAttack]: 0,
        [StatName.SpDefense]: 0,
        [StatName.Speed]: 0,
        [StatName.Accuracy]: 0,
        [StatName.Evasion]: 0,
      },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "baton-pass",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get(ally.id)?.statStages[StatName.Attack]).toBe(3);
    expect(state.pokemon.get(caster.id)?.statStages[StatName.Attack]).toBe(0);
  });

  it("recomputes movement for both pokemon when Speed is transferred", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "caster-1",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["baton-pass"],
      currentPp: { "baton-pass": 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      statStages: {
        [StatName.Hp]: 0,
        [StatName.Attack]: 0,
        [StatName.Defense]: 0,
        [StatName.SpAttack]: 0,
        [StatName.SpDefense]: 0,
        [StatName.Speed]: 4,
        [StatName.Accuracy]: 0,
        [StatName.Evasion]: 0,
      },
    });
    const ally = MockPokemon.fresh(MockPokemon.charmander, {
      id: "ally-1",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally]);

    const allyMovementBefore = ally.derivedStats.movement;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "baton-pass",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const casterAfter = state.pokemon.get(caster.id);
    const allyAfter = state.pokemon.get(ally.id);
    expect(allyAfter?.statStages[StatName.Speed]).toBe(4);
    expect(allyAfter?.derivedStats.movement).toBeGreaterThan(allyMovementBefore);
    expect(casterAfter?.statStages[StatName.Speed]).toBe(0);
  });

  it("bypasses target's Protect", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "caster-1",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["baton-pass"],
      currentPp: { "baton-pass": 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      statStages: { ...ATTACK_2_STAGES },
    });
    const ally = MockPokemon.fresh(MockPokemon.charmander, {
      id: "ally-1",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      activeDefense: { kind: DefensiveKind.Protect, expiresAtRound: 999 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "baton-pass",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get(ally.id)?.statStages[StatName.Attack]).toBe(2);
  });
});
