import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { AuraKind } from "../enums/aura-kind";
import { Direction } from "../enums/direction";
import { FieldTerrain } from "../enums/field-terrain";
import { PlayerId } from "../enums/player-id";
import { Weather } from "../enums/weather";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { postAura, removeAurasOfCaster } from "./aura-system";
import { postFieldTerrain } from "./field-terrain-system";
import { setWeather } from "./weather-system";

/**
 * Lot B — horloge fantôme (ghost clock). When the setter of an ENVIRONMENTAL effect (weather /
 * field zone) faints, it stays in the Charge Time scheduler as a ghost: it never acts, but its
 * would-be turns keep counting that effect down until it expires. Team barriers (auras) are NOT
 * ghosted — they die with their caster.
 */
describe("CT ghost clock — environmental effects outlive their KO'd setter", () => {
  function setup() {
    const setter = MockPokemon.fresh(MockPokemon.base, {
      id: "setter",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 1,
      maxHp: 100,
      baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 30 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 4 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      baseStats: { hp: 100, attack: 120, defense: 50, spAttack: 50, spDefense: 50, speed: 80 },
    });
    return buildMoveTestEngine([setter, ally, foe], { gridSize: 6, activePokemonId: "foe" });
  }

  function koSetterWithFoe(engine: ReturnType<typeof setup>["engine"]): void {
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "foe",
      moveId: "tackle",
      targetPosition: { x: 0, y: 0 },
    });
  }

  it("keeps a KO'd setter's field zone, then expires it on the ghost's would-be turns", () => {
    const { engine, state } = setup();
    const setter = state.pokemon.get("setter");
    if (!setter) {
      throw new Error("missing setter");
    }
    postFieldTerrain(state, setter, FieldTerrain.Grassy);
    expect(state.fieldTerrains).toHaveLength(1);

    koSetterWithFoe(engine);
    expect(state.pokemon.get("setter")?.currentHp).toBe(0);
    // Zone survives the caster KO, and the ghost is still tracked by the scheduler.
    expect(state.fieldTerrains).toHaveLength(1);
    expect(state.ctSnapshot?.setter).toBeDefined();

    // Drive the live mons; the ghost interleaves and counts its zone down until it expires.
    for (let i = 0; i < 80 && state.fieldTerrains.length > 0; i++) {
      const current = state.pokemon.get(state.activePokemonId);
      // The ghost must never become the controllable actor.
      expect(state.pokemon.get(state.activePokemonId)?.currentHp ?? 0).toBeGreaterThan(0);
      if (!current) {
        break;
      }
      engine.submitAction(current.playerId, {
        kind: ActionKind.EndTurn,
        pokemonId: current.id,
        direction: Direction.South,
      });
    }

    expect(state.fieldTerrains).toHaveLength(0);
    // Once its last environmental effect is gone the ghost leaves the scheduler.
    expect(state.ctSnapshot?.setter).toBeUndefined();
  });

  it("keeps weather alive after the setter faints (ghost continues the countdown)", () => {
    const { engine, state } = setup();
    setWeather(state, Weather.Sandstorm, 5, "setter");
    expect(state.weather).toBe(Weather.Sandstorm);

    koSetterWithFoe(engine);
    expect(state.pokemon.get("setter")?.currentHp).toBe(0);
    // Weather persists immediately after the setter KO (ghost owns the countdown).
    expect(state.weather).toBe(Weather.Sandstorm);
    expect(state.ctSnapshot?.setter).toBeDefined();

    for (let i = 0; i < 80 && state.weather !== Weather.None; i++) {
      const current = state.pokemon.get(state.activePokemonId);
      if (!current) {
        break;
      }
      engine.submitAction(current.playerId, {
        kind: ActionKind.EndTurn,
        pokemonId: current.id,
        direction: Direction.South,
      });
    }

    expect(state.weather).toBe(Weather.None);
  });
});

describe("CT ghost clock — team barriers die with their caster (no ghost)", () => {
  it("removes a caster's aura on KO instead of ghosting it", () => {
    const { state } = (() => {
      const caster = MockPokemon.fresh(MockPokemon.base, {
        id: "caster",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 3, y: 0 },
      });
      return buildMoveTestEngine([caster, foe], { gridSize: 6 });
    })();

    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    postAura(state, caster, AuraKind.Reflect);
    expect(state.auras).toHaveLength(1);

    // The same cleanup handleKo runs on a real faint: a barrier is bound to its caster's presence.
    const removed = removeAurasOfCaster(state, "caster");
    expect(removed).toHaveLength(1);
    expect(state.auras).toHaveLength(0);
  });
});
