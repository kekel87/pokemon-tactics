import { describe, expect, it } from "vitest";
import { AuraKind } from "../enums/aura-kind";
import { PlayerId } from "../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import type { TeamAura } from "../types/team-aura";

describe("BattleState.auras — initial state", () => {
  it("starts as an empty array", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const { state } = buildMoveTestEngine([caster]);

    expect(Array.isArray(state.auras)).toBe(true);
    expect(state.auras.length).toBe(0);
  });
});

describe("BattleState.auras — append entries", () => {
  it("stores aura entries with casterPokemonId and kind", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const { state } = buildMoveTestEngine([caster]);

    const aura: TeamAura = {
      kind: AuraKind.Reflect,
      casterPokemonId: caster.id,
      remainingRounds: 5,
      postedRound: state.roundNumber,
    };
    state.auras.push(aura);

    expect(state.auras.length).toBe(1);
    expect(state.auras[0]).toEqual(aura);
  });
});

describe("BattleState.auras — same caster can carry both Reflect and Light Screen", () => {
  it("appends a second aura for the same caster when kind differs", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const { state } = buildMoveTestEngine([caster]);

    state.auras.push({
      kind: AuraKind.Reflect,
      casterPokemonId: caster.id,
      remainingRounds: 5,
      postedRound: 1,
    });
    state.auras.push({
      kind: AuraKind.LightScreen,
      casterPokemonId: caster.id,
      remainingRounds: 5,
      postedRound: 3,
    });

    expect(state.auras.length).toBe(2);
    expect(state.auras.filter((aura) => aura.casterPokemonId === caster.id)).toHaveLength(2);
  });
});

describe("BattleState.auras — decrement remainingRounds", () => {
  it("decrements remainingRounds in place", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const { state } = buildMoveTestEngine([caster]);

    state.auras.push({
      kind: AuraKind.Reflect,
      casterPokemonId: caster.id,
      remainingRounds: 5,
      postedRound: 1,
    });
    const aura = state.auras[0];
    if (aura) {
      aura.remainingRounds -= 1;
    }

    expect(state.auras[0]?.remainingRounds).toBe(4);
  });
});

describe("BattleState.auras — removal at zero", () => {
  it("supports removing an entry when remainingRounds reaches 0", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const { state } = buildMoveTestEngine([caster]);

    state.auras.push({
      kind: AuraKind.Reflect,
      casterPokemonId: caster.id,
      remainingRounds: 1,
      postedRound: 1,
    });
    const aura = state.auras[0];
    if (aura) {
      aura.remainingRounds -= 1;
      if (aura.remainingRounds <= 0) {
        state.auras.splice(0, 1);
      }
    }

    expect(state.auras.length).toBe(0);
  });
});

describe("BattleState.auras — removal on caster KO", () => {
  it("supports filtering out all auras of a given caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const { state } = buildMoveTestEngine([caster]);

    state.auras.push({
      kind: AuraKind.LightScreen,
      casterPokemonId: caster.id,
      remainingRounds: 5,
      postedRound: 1,
    });
    state.auras.push({
      kind: AuraKind.Reflect,
      casterPokemonId: caster.id,
      remainingRounds: 5,
      postedRound: 2,
    });

    const remaining = state.auras.filter((aura) => aura.casterPokemonId !== caster.id);
    state.auras.length = 0;
    state.auras.push(...remaining);

    expect(state.auras.length).toBe(0);
  });
});

describe("BattleState.auras — multi-caster", () => {
  it("supports independent entries for different casters", () => {
    const casterA = MockPokemon.fresh(MockPokemon.base, {
      id: "caster-a",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const casterB = MockPokemon.fresh(MockPokemon.base, {
      id: "caster-b",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 0 },
    });
    const { state } = buildMoveTestEngine([casterA, casterB]);

    state.auras.push({
      kind: AuraKind.Reflect,
      casterPokemonId: casterA.id,
      remainingRounds: 5,
      postedRound: 1,
    });
    state.auras.push({
      kind: AuraKind.LightScreen,
      casterPokemonId: casterB.id,
      remainingRounds: 5,
      postedRound: 1,
    });

    expect(state.auras.length).toBe(2);
    expect(
      state.auras.find(
        (aura) => aura.casterPokemonId === casterA.id && aura.kind === AuraKind.Reflect,
      ),
    ).toBeDefined();
    expect(
      state.auras.find(
        (aura) => aura.casterPokemonId === casterB.id && aura.kind === AuraKind.LightScreen,
      ),
    ).toBeDefined();
  });
});
