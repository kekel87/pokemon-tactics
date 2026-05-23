import { describe, expect, it } from "vitest";
import { PlayerId } from "../enums/player-id";
import { ScreenKind } from "../enums/screen-kind";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import type { ScreenAura } from "../types/screen-aura";

describe("BattleState.screens — initial state", () => {
  it("starts as an empty array", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const { state } = buildMoveTestEngine([caster]);

    expect(Array.isArray(state.screens)).toBe(true);
    expect(state.screens.length).toBe(0);
  });
});

describe("BattleState.screens — append entries", () => {
  it("stores aura entries with casterPokemonId and kind", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const { state } = buildMoveTestEngine([caster]);

    const aura: ScreenAura = {
      kind: ScreenKind.Reflect,
      casterPokemonId: caster.id,
      remainingRounds: 5,
      postedRound: state.roundNumber,
    };
    state.screens.push(aura);

    expect(state.screens.length).toBe(1);
    expect(state.screens[0]).toEqual(aura);
  });
});

describe("BattleState.screens — same caster can carry both Reflect and Light Screen", () => {
  it("appends a second aura for the same caster when kind differs", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const { state } = buildMoveTestEngine([caster]);

    state.screens.push({
      kind: ScreenKind.Reflect,
      casterPokemonId: caster.id,
      remainingRounds: 5,
      postedRound: 1,
    });
    state.screens.push({
      kind: ScreenKind.LightScreen,
      casterPokemonId: caster.id,
      remainingRounds: 5,
      postedRound: 3,
    });

    expect(state.screens.length).toBe(2);
    expect(state.screens.filter((aura) => aura.casterPokemonId === caster.id)).toHaveLength(2);
  });
});

describe("BattleState.screens — decrement remainingRounds", () => {
  it("decrements remainingRounds in place", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const { state } = buildMoveTestEngine([caster]);

    state.screens.push({
      kind: ScreenKind.Reflect,
      casterPokemonId: caster.id,
      remainingRounds: 5,
      postedRound: 1,
    });
    const aura = state.screens[0];
    if (aura) {
      aura.remainingRounds -= 1;
    }

    expect(state.screens[0]?.remainingRounds).toBe(4);
  });
});

describe("BattleState.screens — removal at zero", () => {
  it("supports removing an entry when remainingRounds reaches 0", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const { state } = buildMoveTestEngine([caster]);

    state.screens.push({
      kind: ScreenKind.Reflect,
      casterPokemonId: caster.id,
      remainingRounds: 1,
      postedRound: 1,
    });
    const aura = state.screens[0];
    if (aura) {
      aura.remainingRounds -= 1;
      if (aura.remainingRounds <= 0) {
        state.screens.splice(0, 1);
      }
    }

    expect(state.screens.length).toBe(0);
  });
});

describe("BattleState.screens — removal on caster KO", () => {
  it("supports filtering out all auras of a given caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const { state } = buildMoveTestEngine([caster]);

    state.screens.push({
      kind: ScreenKind.LightScreen,
      casterPokemonId: caster.id,
      remainingRounds: 5,
      postedRound: 1,
    });
    state.screens.push({
      kind: ScreenKind.Reflect,
      casterPokemonId: caster.id,
      remainingRounds: 5,
      postedRound: 2,
    });

    const remaining = state.screens.filter((aura) => aura.casterPokemonId !== caster.id);
    state.screens.length = 0;
    state.screens.push(...remaining);

    expect(state.screens.length).toBe(0);
  });
});

describe("BattleState.screens — multi-caster", () => {
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

    state.screens.push({
      kind: ScreenKind.Reflect,
      casterPokemonId: casterA.id,
      remainingRounds: 5,
      postedRound: 1,
    });
    state.screens.push({
      kind: ScreenKind.LightScreen,
      casterPokemonId: casterB.id,
      remainingRounds: 5,
      postedRound: 1,
    });

    expect(state.screens.length).toBe(2);
    expect(
      state.screens.find(
        (aura) => aura.casterPokemonId === casterA.id && aura.kind === ScreenKind.Reflect,
      ),
    ).toBeDefined();
    expect(
      state.screens.find(
        (aura) => aura.casterPokemonId === casterB.id && aura.kind === ScreenKind.LightScreen,
      ),
    ).toBeDefined();
  });
});
