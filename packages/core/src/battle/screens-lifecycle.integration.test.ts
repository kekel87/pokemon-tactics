import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
import { ScreenKind } from "../enums/screen-kind";
import { buildItemTestEngine, buildMoveTestEngine, MockPokemon } from "../testing";

// Scenario coverage for plan 095 step 4 — decrement + caster KO + Light Clay duration.

describe("screens lifecycle — Reflect decrement", () => {
  it("Given a caster posts Reflect, When 5 rounds elapse, Then aura dissipates and emits ScreenDissipated(expired)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["reflect"],
      currentPp: { reflect: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);

    // When : caster posts Reflect at round 1
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "reflect",
      targetPosition: { x: 0, y: 0 },
    });
    expect(state.screens[0]?.kind).toBe(ScreenKind.Reflect);
    expect(state.screens[0]?.remainingRounds).toBe(5);

    const dissipatedEvents: unknown[] = [];
    engine.on(BattleEventType.ScreenDissipated, (e) => dissipatedEvents.push(e));

    // Then : after 5 rounds of end-turns from both Pokemon, aura disappears
    for (let round = 0; round < 5; round++) {
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "caster",
        direction: Direction.South,
      });
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "foe",
        direction: Direction.South,
      });
    }

    expect(state.screens.length).toBe(0);
    expect(dissipatedEvents.length).toBeGreaterThanOrEqual(1);
    expect(dissipatedEvents[0]).toMatchObject({
      type: BattleEventType.ScreenDissipated,
      casterId: "caster",
      kind: ScreenKind.Reflect,
      reason: "expired",
    });
  });
});

describe("screens lifecycle — caster KO dissipates aura", () => {
  it("Given caster has active Light Screen, When caster is KO'd, Then aura is removed and ScreenDissipated(casterKo) emits", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["light-screen"],
      currentPp: { "light-screen": 5 },
      currentHp: 1,
      maxHp: 1,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      definitionId: "machop",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      combatStats: {
        hp: 100,
        attack: 200,
        defense: 50,
        spAttack: 50,
        spDefense: 50,
        speed: 50,
      },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, enemy]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "light-screen",
      targetPosition: { x: 0, y: 0 },
    });
    expect(state.screens.some((aura) => aura.casterPokemonId === "caster")).toBe(true);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "caster",
      direction: Direction.South,
    });

    const dissipatedEvents: unknown[] = [];
    engine.on(BattleEventType.ScreenDissipated, (e) => dissipatedEvents.push(e));

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "tackle",
      targetPosition: { x: 0, y: 0 },
    });

    expect(state.pokemon.get("caster")?.currentHp).toBe(0);
    expect(state.screens.some((aura) => aura.casterPokemonId === "caster")).toBe(false);
    expect(dissipatedEvents).toHaveLength(1);
    expect(dissipatedEvents[0]).toMatchObject({
      casterId: "caster",
      kind: ScreenKind.LightScreen,
      reason: "casterKo",
    });
  });
});

describe("screens lifecycle — Light Clay extends duration", () => {
  it("Given caster holds Light Clay, When they post Reflect, Then aura lasts 8 rounds (not 5)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["reflect"],
      currentPp: { reflect: 5 },
      heldItemId: HeldItemId.LightClay,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildItemTestEngine([caster, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "reflect",
      targetPosition: { x: 0, y: 0 },
    });

    expect(state.screens[0]?.remainingRounds).toBe(8);

    // 5 rounds elapse — aura still active (would have expired without Light Clay)
    for (let round = 0; round < 5; round++) {
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "caster",
        direction: Direction.South,
      });
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "foe",
        direction: Direction.South,
      });
    }

    expect(state.screens[0]?.remainingRounds).toBe(3);

    // 3 more rounds → expiration
    for (let round = 0; round < 3; round++) {
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "caster",
        direction: Direction.South,
      });
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "foe",
        direction: Direction.South,
      });
    }

    expect(state.screens.length).toBe(0);
  });
});
