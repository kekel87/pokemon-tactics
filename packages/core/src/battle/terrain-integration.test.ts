import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Category } from "../enums/category";
import { Direction } from "../enums/direction";
import { EffectKind } from "../enums/effect-kind";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import { TargetingKind } from "../enums/targeting-kind";
import { TerrainType } from "../enums/terrain-type";
import { MockBattle, MockPokemon } from "../testing";
import type { MoveDefinition } from "../types/move-definition";
import { BattleEngine } from "./BattleEngine";

function buildEndTurnEngine(terrain: TerrainType, actorTypes: PokemonType[], hp = 160) {
  const actor = MockPokemon.fresh(MockPokemon.base, {
    id: "actor",
    definitionId: "test-actor",
    position: { x: 0, y: 0 },
    currentHp: hp,
    maxHp: hp,
    statusEffects: [],
    volatileStatuses: [],
    statStages: { ...MockBattle.zeroStatStages },
    playerId: PlayerId.Player1,
  });
  const dummy = MockPokemon.fresh(MockPokemon.base, {
    id: "dummy",
    definitionId: "test",
    position: { x: 4, y: 4 },
    playerId: PlayerId.Player2,
  });
  const state = MockBattle.stateFrom([actor, dummy], 5, 5);
  MockBattle.setTile(state, 0, 0, { terrain });
  state.turnOrder = ["actor", "dummy"];
  state.currentTurnIndex = 0;
  const pokemonTypesMap = new Map<string, PokemonType[]>([
    ["test-actor", actorTypes],
    ["test", [PokemonType.Normal]],
  ]);
  return {
    engine: new BattleEngine(state, new Map(), {}, pokemonTypesMap),
    state,
    actor,
  };
}

const testFireMove: MoveDefinition = {
  id: "test-fire",
  name: "Test Fire",
  type: PokemonType.Fire,
  category: Category.Special,
  power: 50,
  accuracy: 100,
  pp: 10,
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
  effects: [{ kind: EffectKind.Damage }],
};

function buildAttackEngine(attackerTerrain: TerrainType) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    definitionId: "test-attacker",
    position: { x: 0, y: 0 },
    moveIds: ["test-fire"],
    currentPp: { "test-fire": 10 },
    playerId: PlayerId.Player1,
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    definitionId: "test",
    position: { x: 2, y: 0 },
    currentHp: 200,
    maxHp: 200,
    playerId: PlayerId.Player2,
  });
  const state = MockBattle.stateFrom([attacker, defender], 5, 5);
  MockBattle.setTile(state, 0, 0, { terrain: attackerTerrain });
  state.turnOrder = ["attacker", "defender"];
  state.currentTurnIndex = 0;
  const pokemonTypesMap = new Map<string, PokemonType[]>([
    ["test-attacker", [PokemonType.Normal]],
    ["test", [PokemonType.Normal]],
  ]);
  const moveRegistry = new Map<string, MoveDefinition>([["test-fire", testFireMove]]);
  return {
    engine: new BattleEngine(state, moveRegistry, {}, pokemonTypesMap),
    state,
    defender,
  };
}

describe("terrain integration — EndTurn effects", () => {
  it("Given Normal Pokemon on swamp, When EndTurn, Then Poisoned", () => {
    const { engine, actor } = buildEndTurnEngine(TerrainType.Swamp, [PokemonType.Normal]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "actor",
      direction: Direction.South,
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.TerrainStatusApplied)).toBe(true);
    expect(actor.statusEffects.some((s) => s.type === StatusType.Poisoned)).toBe(true);
  });

  it("Given Normal Pokemon on magma, When EndTurn, Then TerrainDamageDealt (1/16 HP)", () => {
    const { engine, actor } = buildEndTurnEngine(TerrainType.Magma, [PokemonType.Normal], 160);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "actor",
      direction: Direction.South,
    });

    expect(result.success).toBe(true);
    const dmgEvent = result.events.find((e) => e.type === BattleEventType.TerrainDamageDealt);
    expect(dmgEvent).toBeDefined();
    if (dmgEvent?.type === BattleEventType.TerrainDamageDealt) {
      expect(dmgEvent.amount).toBe(10);
    }
    expect(actor.currentHp).toBe(150);
  });

  it("Given Fire-type Pokemon on magma, When EndTurn, Then no TerrainDamageDealt", () => {
    const { engine } = buildEndTurnEngine(TerrainType.Magma, [PokemonType.Fire]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "actor",
      direction: Direction.South,
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.TerrainDamageDealt)).toBe(false);
  });

  it("Given Flying-type Pokemon on swamp, When EndTurn, Then no terrain effects", () => {
    const { engine, actor } = buildEndTurnEngine(TerrainType.Swamp, [
      PokemonType.Normal,
      PokemonType.Flying,
    ]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "actor",
      direction: Direction.South,
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.TerrainStatusApplied)).toBe(false);
    expect(actor.statusEffects).toHaveLength(0);
  });
});

describe("terrain integration — type bonus on attack", () => {
  it("Given Normal Pokemon on magma uses Fire move, When UseMove, Then damage higher than on normal tile", () => {
    const { engine: engineMagma, defender: defenderMagma } = buildAttackEngine(TerrainType.Magma);
    const { engine: engineNormal, defender: defenderNormal } = buildAttackEngine(
      TerrainType.Normal,
    );

    engineMagma.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "test-fire",
      targetPosition: { x: 2, y: 0 },
    });

    engineNormal.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "test-fire",
      targetPosition: { x: 2, y: 0 },
    });

    const damageMagma = 200 - defenderMagma.currentHp;
    const damageNormal = 200 - defenderNormal.currentHp;
    expect(damageMagma).toBeGreaterThan(damageNormal);
  });
});

describe("terrain integration — ice slide after knockback", () => {
  it("Given Pokemon knockbacked onto ice, When UseMove knockback, Then IceSlideApplied", () => {
    const knockbackMove: MoveDefinition = {
      id: "test-knockback",
      name: "Test Knockback",
      type: PokemonType.Normal,
      category: Category.Physical,
      power: 10,
      accuracy: 100,
      pp: 10,
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
      effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Knockback, distance: 1 }],
    };

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      definitionId: "test-attacker",
      position: { x: 0, y: 0 },
      moveIds: ["test-knockback"],
      currentPp: { "test-knockback": 10 },
      playerId: PlayerId.Player1,
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      definitionId: "test",
      position: { x: 1, y: 0 },
      currentHp: 100,
      maxHp: 100,
      playerId: PlayerId.Player2,
    });

    const state = MockBattle.stateFrom([attacker, target], 8, 3);
    MockBattle.setTile(state, 2, 0, { terrain: TerrainType.Ice });
    MockBattle.setTile(state, 3, 0, { terrain: TerrainType.Ice });
    MockBattle.setTile(state, 4, 0, { terrain: TerrainType.Ice });

    state.turnOrder = ["attacker", "target"];
    state.currentTurnIndex = 0;

    const moveRegistry = new Map<string, MoveDefinition>([["test-knockback", knockbackMove]]);
    const pokemonTypesMap = new Map<string, PokemonType[]>([
      ["test-attacker", [PokemonType.Normal]],
      ["test", [PokemonType.Normal]],
    ]);
    const engine = new BattleEngine(state, moveRegistry, {}, pokemonTypesMap);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "test-knockback",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.IceSlideApplied)).toBe(true);
    expect(target.position.x).toBeGreaterThan(2);
  });
});
