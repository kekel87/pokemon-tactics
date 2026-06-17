import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { FieldTerrain } from "../../enums/field-terrain";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { ProtectionReason } from "../../types/battle-event";
import { postFieldTerrain } from "../field-terrain-system";

// Champ Brumeux (misty-terrain) — move integration tests

describe("misty-terrain — major status blocked for grounded mon on zone", () => {
  it("blocks Paralysis (Cage-Éclair) for a grounded mon on the zone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 4 },
      moveIds: ["thunder-wave"],
      currentPp: { "thunder-wave": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target, enemy], {
      activePokemonId: "enemy",
    });
    postFieldTerrain(state, caster, FieldTerrain.Misty);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "thunder-wave",
      targetPosition: { x: 2, y: 3 },
    });

    const blockedEvent = result.events.find(
      (e) =>
        e.type === BattleEventType.StatusBlocked &&
        e.pokemonId === "target" &&
        e.reason === ProtectionReason.MistyTerrain,
    );
    expect(blockedEvent).toBeDefined();
    const isParalyzed = state.pokemon
      .get("target")
      ?.statusEffects.some((s) => s.type === StatusType.Paralyzed);
    expect(isParalyzed).toBe(false);

    vi.restoreAllMocks();
  });

  it("blocks confusion (Bullenboule / confuse-ray) for a grounded mon on the zone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 4 },
      moveIds: ["confuse-ray"],
      currentPp: { "confuse-ray": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target, enemy], {
      activePokemonId: "enemy",
    });
    postFieldTerrain(state, caster, FieldTerrain.Misty);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "confuse-ray",
      targetPosition: { x: 2, y: 3 },
    });

    const blockedEvent = result.events.find(
      (e) =>
        e.type === BattleEventType.StatusBlocked &&
        e.pokemonId === "target" &&
        e.reason === ProtectionReason.MistyTerrain,
    );
    expect(blockedEvent).toBeDefined();
    const isConfused = state.pokemon
      .get("target")
      ?.volatileStatuses.some((v) => v.type === StatusType.Confused);
    expect(isConfused).toBe(false);

    vi.restoreAllMocks();
  });

  it("does NOT protect a Flying-type mon on the zone (grounded gate)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    // Pidgey is Normal/Flying — not grounded
    const flyer = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 4 },
      moveIds: ["thunder-wave"],
      currentPp: { "thunder-wave": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const { engine, state } = buildMoveTestEngine([caster, flyer, enemy], {
      activePokemonId: "enemy",
    });
    postFieldTerrain(state, caster, FieldTerrain.Misty);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "thunder-wave",
      targetPosition: { x: 2, y: 3 },
    });

    const blockedByMisty = result.events.find(
      (e) => e.type === BattleEventType.StatusBlocked && e.reason === ProtectionReason.MistyTerrain,
    );
    expect(blockedByMisty).toBeUndefined();

    vi.restoreAllMocks();
  });
});

describe("misty-terrain — Dragon move ×0.5 vs grounded target on zone", () => {
  it("halves Dragon-type move damage against a grounded target on a Misty zone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    // Baseline: dragon rage without terrain
    const baseAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      definitionId: "dragonite",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      moveIds: ["dragon-breath"],
      currentPp: { "dragon-breath": 20 },
      combatStats: { hp: 100, attack: 50, defense: 50, spAttack: 200, spDefense: 50, speed: 80 },
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
      moveId: "dragon-breath",
      targetPosition: { x: 0, y: 0 },
    });
    const baseDamage = 1000 - (baseState.pokemon.get("target")?.currentHp ?? 1000);

    // With Misty terrain on target's tile
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const terrainAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      definitionId: "dragonite",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      moveIds: ["dragon-breath"],
      currentPp: { "dragon-breath": 20 },
      combatStats: { hp: 100, attack: 50, defense: 50, spAttack: 200, spDefense: 50, speed: 80 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const terrainTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const { engine: terrainEngine, state: terrainState } = buildMoveTestEngine([
      terrainAttacker,
      caster,
      terrainTarget,
    ]);
    // Post Misty zone centered on target
    postFieldTerrain(terrainState, caster, FieldTerrain.Misty);

    terrainEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "dragon-breath",
      targetPosition: { x: 3, y: 0 },
    });
    const terrainDamage = 1000 - (terrainState.pokemon.get("target")?.currentHp ?? 1000);

    expect(terrainDamage).toBeLessThan(baseDamage);
    expect(terrainDamage).toBeGreaterThanOrEqual(Math.floor(baseDamage * 0.45));
    expect(terrainDamage).toBeLessThanOrEqual(Math.ceil(baseDamage * 0.55));

    vi.restoreAllMocks();
  });
});

describe("misty-terrain — move posting", () => {
  it("submitting misty-terrain emits FieldTerrainPosted with kind=misty", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["misty-terrain"],
      currentPp: { "misty-terrain": 10 },
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
      moveId: "misty-terrain",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    const postedEvent = result.events.find((e) => e.type === BattleEventType.FieldTerrainPosted);
    expect(postedEvent).toBeDefined();
    if (postedEvent && postedEvent.type === BattleEventType.FieldTerrainPosted) {
      expect(postedEvent.kind).toBe(FieldTerrain.Misty);
    }
    expect(state.fieldTerrains[0]?.kind).toBe(FieldTerrain.Misty);
  });
});
