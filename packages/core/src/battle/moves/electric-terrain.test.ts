import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { FieldTerrain } from "../../enums/field-terrain";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { ProtectionReason } from "../../types/battle-event";
import { postFieldTerrain } from "../field-terrain-system";

// Champ Électrifié (electric-terrain) — move integration tests

describe("electric-terrain — sleep blocked for grounded mon on zone", () => {
  it("blocks Sleep (Poudre Dodo) for a grounded mon on the zone and emits StatusBlocked", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    // Caster posts terrain at (2,2); target is at (2,3) — inside r3
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
      moveIds: ["sleep-powder"],
      currentPp: { "sleep-powder": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target, enemy]);
    postFieldTerrain(state, caster, FieldTerrain.Electric);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "sleep-powder",
      targetPosition: { x: 2, y: 3 },
    });

    const blockedEvent = result.events.find(
      (e) =>
        e.type === BattleEventType.StatusBlocked &&
        e.pokemonId === "target" &&
        e.reason === ProtectionReason.ElectricTerrain,
    );
    expect(blockedEvent).toBeDefined();
    const isAsleep = state.pokemon
      .get("target")
      ?.statusEffects.some((s) => s.type === StatusType.Asleep);
    expect(isAsleep).toBe(false);

    vi.restoreAllMocks();
  });

  it("does NOT block confusion (only sleep is blocked by Electric terrain)", () => {
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
    const { engine, state } = buildMoveTestEngine([caster, target, enemy]);
    postFieldTerrain(state, caster, FieldTerrain.Electric);

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "confuse-ray",
      targetPosition: { x: 2, y: 3 },
    });

    const isConfused = state.pokemon
      .get("target")
      ?.volatileStatuses.some((v) => v.type === StatusType.Confused);
    expect(isConfused).toBe(true);

    vi.restoreAllMocks();
  });

  it("does NOT block sleep for a Flying-type mon on the zone (grounded gate)", () => {
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
      moveIds: ["sleep-powder"],
      currentPp: { "sleep-powder": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const { engine, state } = buildMoveTestEngine([caster, flyer, enemy]);
    postFieldTerrain(state, caster, FieldTerrain.Electric);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "sleep-powder",
      targetPosition: { x: 2, y: 3 },
    });

    const blockedEvent = result.events.find(
      (e) => e.type === BattleEventType.StatusBlocked && e.pokemonId === "pidgey-1",
    );
    expect(blockedEvent).toBeUndefined();

    vi.restoreAllMocks();
  });
});

describe("electric-terrain — Electric move ×1.3 boost", () => {
  it("increases Electric-type move damage by ×1.3 when attacker is grounded on zone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    // Baseline: no terrain — Raichu uses thunderbolt
    const baseAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "raichu",
      definitionId: "raichu",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      moveIds: ["thunderbolt"],
      currentPp: { thunderbolt: 15 },
      combatStats: { hp: 110, attack: 90, defense: 55, spAttack: 90, spDefense: 80, speed: 110 },
      derivedStats: { movement: 4, jump: 1, initiative: 110 },
    });
    const baseTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      definitionId: "squirtle",
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
      pokemonId: "raichu",
      moveId: "thunderbolt",
      targetPosition: { x: 0, y: 0 },
    });
    const baseDamage = 1000 - (baseState.pokemon.get("target")?.currentHp ?? 1000);

    // With Electric terrain — attacker inside zone
    const terrainAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "raichu",
      definitionId: "raichu",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["thunderbolt"],
      currentPp: { thunderbolt: 15 },
      combatStats: { hp: 110, attack: 90, defense: 55, spAttack: 90, spDefense: 80, speed: 110 },
      derivedStats: { movement: 4, jump: 1, initiative: 110 },
    });
    const terrainTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      definitionId: "squirtle",
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
    postFieldTerrain(terrainState, terrainAttacker, FieldTerrain.Electric);

    terrainEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "raichu",
      moveId: "thunderbolt",
      targetPosition: { x: 3, y: 2 },
    });
    const terrainDamage = 1000 - (terrainState.pokemon.get("target")?.currentHp ?? 1000);

    expect(terrainDamage).toBeGreaterThan(baseDamage);
    expect(terrainDamage).toBeGreaterThanOrEqual(Math.floor(baseDamage * 1.25));
    expect(terrainDamage).toBeLessThanOrEqual(Math.ceil(baseDamage * 1.35));

    vi.restoreAllMocks();
  });
});

describe("electric-terrain — move posting", () => {
  it("submitting electric-terrain emits FieldTerrainPosted with kind=electric", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["electric-terrain"],
      currentPp: { "electric-terrain": 10 },
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
      moveId: "electric-terrain",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    const postedEvent = result.events.find((e) => e.type === BattleEventType.FieldTerrainPosted);
    expect(postedEvent).toBeDefined();
    if (postedEvent && postedEvent.type === BattleEventType.FieldTerrainPosted) {
      expect(postedEvent.kind).toBe(FieldTerrain.Electric);
    }
    expect(state.fieldTerrains[0]?.kind).toBe(FieldTerrain.Electric);
  });
});
