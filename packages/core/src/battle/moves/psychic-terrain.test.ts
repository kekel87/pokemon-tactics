import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { FieldTerrain } from "../../enums/field-terrain";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { postFieldTerrain } from "../field-terrain-system";

// Champ Psychique (psychic-terrain) — move integration tests

describe("psychic-terrain — anti-dash barrier", () => {
  it("stops an enemy dasher entering the zone from outside — stops before zone boundary", () => {
    // Use a bigger grid so we can place the caster center and attacker far outside
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    // Dasher at (1,5): manhattan(1,5, 5,5) = 4 > 3 → outside zone
    // extreme-speed has maxDistance=2 so it can't reach the zone from (1,5) to (5,5).
    // Use a closer position: dasher at (2,5), zone starts at (5-3)=2 → tile (2,5) has manhattan=3 ≤ 3 → INSIDE zone.
    // Dasher at (0,5): manhattan=5 → outside. Dash with maxDistance 2 → can reach (2,5) which enters zone.
    // Actually extreme-speed maxDistance=2: from (0,5) can reach at most (2,5).
    // (2,5) is inside zone (manhattan=3). Path: (0,5)→(1,5)→(2,5). First tile inside zone = (2,5).
    // Dasher should stop at (1,5).
    const dasher = MockPokemon.fresh(MockPokemon.base, {
      id: "dasher",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 5 },
      moveIds: ["extreme-speed"],
      currentPp: { "extreme-speed": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const { engine, state } = buildMoveTestEngine([caster, dasher], { gridSize: 9 });
    postFieldTerrain(state, caster, FieldTerrain.Psychic);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "dasher",
      moveId: "extreme-speed",
      targetPosition: { x: 2, y: 5 },
    });

    const blocked = result.events.find(
      (e) => e.type === BattleEventType.DashBlockedByPsychicTerrain,
    );
    expect(blocked).toBeDefined();
    // No attack damage dealt to a target
    expect(result.events.find((e) => e.type === BattleEventType.DamageDealt)).toBeUndefined();
    // Dasher stopped at x=1 (last tile before zone boundary at x=2)
    expect(state.pokemon.get("dasher")?.position).toEqual({ x: 1, y: 5 });
    // Repelled into the psychic wall → wall-impact damage (same resolver as a height wall)
    const impact = result.events.find((e) => e.type === BattleEventType.WallImpactDealt);
    expect(impact).toBeDefined();
    expect(state.pokemon.get("dasher")?.currentHp).toBeLessThan(
      state.pokemon.get("dasher")?.maxHp ?? 0,
    );
  });

  it("allows an ALLY of the caster to dash through the zone", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 5 },
      moveIds: ["extreme-speed"],
      currentPp: { "extreme-speed": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 8, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally, foe], { gridSize: 9 });
    postFieldTerrain(state, caster, FieldTerrain.Psychic);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "ally",
      moveId: "extreme-speed",
      targetPosition: { x: 2, y: 5 },
    });

    expect(result.success).toBe(true);
    const blocked = result.events.find(
      (e) => e.type === BattleEventType.DashBlockedByPsychicTerrain,
    );
    expect(blocked).toBeUndefined();
    // Ally moved (not blocked at pre-zone tile)
    expect(state.pokemon.get("ally")?.position).toEqual({ x: 2, y: 5 });
  });

  it("allows a Flying-type (grounded gate) enemy to dash through the zone", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    // Pidgey is Normal/Flying — not grounded → immune to barrier
    const flyer = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player2,
      position: { x: 0, y: 5 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 30 },
      derivedStats: { movement: 4, jump: 2, initiative: 100 },
    });
    const { engine, state } = buildMoveTestEngine([caster, flyer], { gridSize: 9 });
    postFieldTerrain(state, caster, FieldTerrain.Psychic);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "pidgey-1",
      moveId: "quick-attack",
      targetPosition: { x: 2, y: 5 },
    });

    expect(result.success).toBe(true);
    const blocked = result.events.find(
      (e) => e.type === BattleEventType.DashBlockedByPsychicTerrain,
    );
    expect(blocked).toBeUndefined();

    vi.restoreAllMocks();
  });

  it("does not block a dasher departing from inside the zone", () => {
    // Dasher is at (4,4) — zone anchor at (4,4). Path (4,4)→(4,3)→(4,2) stays inside the zone
    // (all tiles within manhattan ≤ 3 of anchor). The barrier only triggers when entering from outside.
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const dasher = MockPokemon.fresh(MockPokemon.base, {
      id: "dasher",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      moveIds: ["extreme-speed"],
      currentPp: { "extreme-speed": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const { engine, state } = buildMoveTestEngine([caster, dasher], { gridSize: 9 });
    postFieldTerrain(state, caster, FieldTerrain.Psychic);

    // Dasher at (4,4) moves to (4,2) — both tiles are inside the r3 zone centered at (4,4)
    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "dasher",
      moveId: "extreme-speed",
      targetPosition: { x: 4, y: 2 },
    });

    const blocked = result.events.find(
      (e) => e.type === BattleEventType.DashBlockedByPsychicTerrain,
    );
    expect(blocked).toBeUndefined();
  });
});

describe("psychic-terrain — Psychic move ×1.3 boost", () => {
  it("increases Psychic-type move damage by ×1.3 when attacker is grounded on zone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    // Baseline: no terrain
    const baseAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      definitionId: "alakazam",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      moveIds: ["psychic"],
      currentPp: { psychic: 10 },
      combatStats: { hp: 55, attack: 50, defense: 45, spAttack: 200, spDefense: 95, speed: 120 },
      derivedStats: { movement: 4, jump: 1, initiative: 120 },
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
      moveId: "psychic",
      targetPosition: { x: 0, y: 0 },
    });
    const baseDamage = 1000 - (baseState.pokemon.get("target")?.currentHp ?? 1000);

    // With Psychic terrain
    const terrainAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      definitionId: "alakazam",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["psychic"],
      currentPp: { psychic: 10 },
      combatStats: { hp: 55, attack: 50, defense: 45, spAttack: 200, spDefense: 95, speed: 120 },
      derivedStats: { movement: 4, jump: 1, initiative: 120 },
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
    postFieldTerrain(terrainState, terrainAttacker, FieldTerrain.Psychic);

    terrainEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "psychic",
      targetPosition: { x: 3, y: 2 },
    });
    const terrainDamage = 1000 - (terrainState.pokemon.get("target")?.currentHp ?? 1000);

    expect(terrainDamage).toBeGreaterThan(baseDamage);
    expect(terrainDamage).toBeGreaterThanOrEqual(Math.floor(baseDamage * 1.25));
    expect(terrainDamage).toBeLessThanOrEqual(Math.ceil(baseDamage * 1.35));

    vi.restoreAllMocks();
  });
});

describe("psychic-terrain — move posting", () => {
  it("submitting psychic-terrain emits FieldTerrainPosted with kind=psychic", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["psychic-terrain"],
      currentPp: { "psychic-terrain": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "psychic-terrain",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    const postedEvent = result.events.find((e) => e.type === BattleEventType.FieldTerrainPosted);
    expect(postedEvent).toBeDefined();
    if (postedEvent && postedEvent.type === BattleEventType.FieldTerrainPosted) {
      expect(postedEvent.kind).toBe(FieldTerrain.Psychic);
    }
    expect(state.fieldTerrains[0]?.kind).toBe(FieldTerrain.Psychic);
  });
});
