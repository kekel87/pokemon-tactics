import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { FieldTerrain } from "../../enums/field-terrain";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, buildMoveTestEngine, MockPokemon } from "../../testing";
import { postFieldTerrain } from "../field-terrain-system";

// Champ Herbu (grassy-terrain) — move integration tests

describe("grassy-terrain — zone posting", () => {
  it("posts a FieldTerrainPosted event with kind=grassy and 25-tile diamond on a 10x10 grid", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
      moveIds: ["grassy-terrain"],
      currentPp: { "grassy-terrain": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 9, y: 9 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe], { gridSize: 10 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "grassy-terrain",
      targetPosition: { x: 5, y: 5 },
    });

    expect(result.success).toBe(true);
    const postedEvent = result.events.find((e) => e.type === BattleEventType.FieldTerrainPosted);
    expect(postedEvent).toBeDefined();
    if (postedEvent && postedEvent.type === BattleEventType.FieldTerrainPosted) {
      expect(postedEvent.kind).toBe(FieldTerrain.Grassy);
      expect(postedEvent.casterId).toBe("caster");
      // Center (5,5) on a 10x10 grid — full r3 diamond = 25 tiles, all in-bounds
      expect(postedEvent.tiles.length).toBe(25);
      expect(postedEvent.durationTurns).toBe(5);
    }
    expect(state.fieldTerrains).toHaveLength(1);
    expect(state.fieldTerrains[0]?.kind).toBe(FieldTerrain.Grassy);
  });

  it("tiles are truncated at grid edges (corner caster gets fewer than 25)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["grassy-terrain"],
      currentPp: { "grassy-terrain": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "grassy-terrain",
      targetPosition: { x: 0, y: 0 },
    });

    expect(state.fieldTerrains[0]?.tiles.length).toBeLessThan(25);
  });
});

describe("grassy-terrain — end-of-turn heal", () => {
  it("heals a grounded mon on the zone for 1/16 max HP after a round ends", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["grassy-terrain"],
      currentPp: { "grassy-terrain": 10 },
      currentHp: 80,
      maxHp: 160,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);

    // Post Champ Herbu
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "grassy-terrain",
      targetPosition: { x: 2, y: 2 },
    });

    // End round — heal should fire
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

    const expectedHeal = Math.max(1, Math.floor(160 / 16)); // = 10
    expect(state.pokemon.get("caster")?.currentHp).toBe(80 + expectedHeal);
  });

  it("does not overheal beyond maxHp", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["grassy-terrain"],
      currentPp: { "grassy-terrain": 10 },
      currentHp: 159,
      maxHp: 160,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "grassy-terrain",
      targetPosition: { x: 2, y: 2 },
    });
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

    expect(state.pokemon.get("caster")?.currentHp).toBe(160);
  });

  it("does not heal a Flying-type mon on the zone (grounded gate)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["grassy-terrain"],
      currentPp: { "grassy-terrain": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    // Pidgey is Normal/Flying — not grounded
    const flyer = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 3 },
      currentHp: 80,
      maxHp: 100,
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, flyer, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "grassy-terrain",
      targetPosition: { x: 2, y: 2 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "caster",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "pidgey-1",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "foe",
      direction: Direction.South,
    });

    expect(state.pokemon.get("pidgey-1")?.currentHp).toBe(80);
  });

  it("does not heal a grounded mon outside the zone", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["grassy-terrain"],
      currentPp: { "grassy-terrain": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    // Placed at (5,5) — outside r3 from (0,0): manhattan(5,5,0,0) = 10 > 3
    const offZone = MockPokemon.fresh(MockPokemon.base, {
      id: "off-zone",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
      currentHp: 50,
      maxHp: 100,
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, offZone, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "grassy-terrain",
      targetPosition: { x: 0, y: 0 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "caster",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "off-zone",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "foe",
      direction: Direction.South,
    });

    expect(state.pokemon.get("off-zone")?.currentHp).toBe(50);
  });
});

describe("grassy-terrain — Grass move ×1.3 boost", () => {
  it("increases Grass-type move damage by ×1.3 when attacker is grounded on zone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    // Baseline: no terrain — Bulbizarre uses Tranche-Feuille (razor-leaf)
    const baseAttacker = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const baseTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: baseEngine, state: baseState } = buildMoveTestEngine([
      baseAttacker,
      baseTarget,
    ]);
    baseEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "bulbasaur-1",
      moveId: "razor-leaf",
      targetPosition: { x: 0, y: 0 },
    });
    const baseDamage = 1000 - (baseState.pokemon.get("target")?.currentHp ?? 1000);

    // With Grassy terrain (posted directly via system function)
    const terrainAttacker = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const terrainTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: terrainEngine, state: terrainState } = buildMoveTestEngine([
      terrainAttacker,
      terrainTarget,
    ]);
    // Post Champ Herbu centred on attacker — attacker is inside its own zone
    postFieldTerrain(terrainState, terrainAttacker, FieldTerrain.Grassy);

    terrainEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "bulbasaur-1",
      moveId: "razor-leaf",
      targetPosition: { x: 3, y: 2 },
    });
    const terrainDamage = 1000 - (terrainState.pokemon.get("target")?.currentHp ?? 1000);

    // ×1.3 boost — should deal more damage
    expect(terrainDamage).toBeGreaterThan(baseDamage);
    // Within ×1.3 ± small rounding tolerance
    expect(terrainDamage).toBeGreaterThanOrEqual(Math.floor(baseDamage * 1.25));
    expect(terrainDamage).toBeLessThanOrEqual(Math.ceil(baseDamage * 1.35));

    vi.restoreAllMocks();
  });
});

describe("grassy-terrain — Earthquake ×0.5 vs grounded target on zone", () => {
  it("halves Earthquake damage against a grounded target standing on a Grassy zone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    // Baseline: earthquake without terrain
    const baseAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      moveIds: ["earthquake"],
      currentPp: { earthquake: 10 },
      combatStats: { hp: 100, attack: 200, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const baseTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: baseEngine, state: baseState } = buildMoveTestEngine([
      baseAttacker,
      baseTarget,
    ]);
    baseEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "earthquake",
      targetPosition: { x: 0, y: 0 },
    });
    const baseDamage = 1000 - (baseState.pokemon.get("target")?.currentHp ?? 1000);

    // With Grassy terrain on target's tile (posted directly)
    const terrainAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      moveIds: ["earthquake"],
      currentPp: { earthquake: 10 },
      combatStats: { hp: 100, attack: 200, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const terrainTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: terrainEngine, state: terrainState } = buildMoveTestEngine([
      terrainAttacker,
      terrainTarget,
    ]);
    // Post Grassy zone centred on target — target is at (0,0), anchor (0,0)
    postFieldTerrain(terrainState, terrainTarget, FieldTerrain.Grassy);

    terrainEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "earthquake",
      targetPosition: { x: 0, y: 0 },
    });
    const terrainDamage = 1000 - (terrainState.pokemon.get("target")?.currentHp ?? 1000);

    // ×0.5 — should deal roughly half damage
    expect(terrainDamage).toBeLessThan(baseDamage);
    expect(terrainDamage).toBeGreaterThanOrEqual(Math.floor(baseDamage * 0.45));
    expect(terrainDamage).toBeLessThanOrEqual(Math.ceil(baseDamage * 0.55));

    vi.restoreAllMocks();
  });
});

describe("grassy-terrain — zone expiration", () => {
  it("zone expires after 5 rounds and emits FieldTerrainExpired", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["grassy-terrain"],
      currentPp: { "grassy-terrain": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "grassy-terrain",
      targetPosition: { x: 2, y: 2 },
    });
    expect(state.fieldTerrains[0]?.remainingTurns).toBe(5);

    const expiredEvents: unknown[] = [];
    engine.on(BattleEventType.FieldTerrainExpired, (e) => expiredEvents.push(e));

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

    expect(state.fieldTerrains).toHaveLength(0);
    expect(expiredEvents.length).toBeGreaterThanOrEqual(1);
    expect(expiredEvents[0]).toMatchObject({
      type: BattleEventType.FieldTerrainExpired,
      kind: FieldTerrain.Grassy,
      casterId: "caster",
    });
  });

  it("zone lasts 8 rounds when caster holds Terrain Extender (Étend-Terre)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["grassy-terrain"],
      currentPp: { "grassy-terrain": 10 },
      heldItemId: HeldItemId.TerrainExtender,
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
      moveId: "grassy-terrain",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.fieldTerrains[0]?.remainingTurns).toBe(8);

    // After 5 rounds zone must still be alive
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
    expect(state.fieldTerrains).toHaveLength(1);
    expect(state.fieldTerrains[0]?.remainingTurns).toBe(3);

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
    expect(state.fieldTerrains).toHaveLength(0);
  });
});
