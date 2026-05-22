import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { TerrainType } from "../../enums/terrain-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { createPrng } from "../../utils/prng";

function paintTile(
  state: ReturnType<typeof buildMoveTestEngine>["state"],
  pos: { x: number; y: number },
  terrain: TerrainType,
): void {
  const row = state.grid[pos.y];
  if (row) {
    const tile = row[pos.x];
    if (tile) {
      tile.terrain = terrain;
    }
  }
}

describe("HitAndRun engine integration — u-turn", () => {
  it("Given hit succeeds and retreat valid, Then caster moves and HitAndRunRetreat emitted", () => {
    const caster = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["u-turn"],
      currentPp: { "u-turn": 20 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
    });
    const { engine } = buildMoveTestEngine([caster, enemy], {
      gridSize: 8,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "u-turn",
      targetPosition: { x: 3, y: 2 },
      retreatPosition: { x: 0, y: 2 },
    });

    expect(result.success).toBe(true);
    const retreat = result.events.find((e) => e.type === BattleEventType.HitAndRunRetreat);
    expect(retreat).toBeDefined();
    if (retreat && retreat.type === BattleEventType.HitAndRunRetreat) {
      expect(retreat.toPosition).toEqual({ x: 0, y: 2 });
      expect(retreat.fromPosition).toEqual({ x: 2, y: 2 });
    }
    expect(caster.position).toEqual({ x: 0, y: 2 });
    expect(enemy.currentHp).toBeLessThan(enemy.maxHp);
  });

  it("Given retreat position missing, Then caster stays and Fallback(missing) emitted", () => {
    const caster = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["u-turn"],
      currentPp: { "u-turn": 20 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
    });
    const { engine } = buildMoveTestEngine([caster, enemy], {
      gridSize: 8,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "u-turn",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    const fallback = result.events.find((e) => e.type === BattleEventType.HitAndRunRetreatFallback);
    expect(fallback).toBeDefined();
    if (fallback && fallback.type === BattleEventType.HitAndRunRetreatFallback) {
      expect(fallback.reason).toBe("missing");
    }
    expect(caster.position).toEqual({ x: 2, y: 2 });
  });

  it("Given retreat position occupied, Then Fallback(invalid) and caster stays", () => {
    const caster = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["u-turn"],
      currentPp: { "u-turn": 20 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
    });
    const blocker = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "blocker",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 2 },
    });
    const { engine } = buildMoveTestEngine([caster, enemy, blocker], {
      gridSize: 8,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "u-turn",
      targetPosition: { x: 3, y: 2 },
      retreatPosition: { x: 0, y: 2 },
    });

    expect(result.success).toBe(true);
    const fallback = result.events.find((e) => e.type === BattleEventType.HitAndRunRetreatFallback);
    expect(fallback).toBeDefined();
    if (fallback && fallback.type === BattleEventType.HitAndRunRetreatFallback) {
      expect(fallback.reason).toBe("invalid");
    }
    expect(caster.position).toEqual({ x: 2, y: 2 });
  });

  it("Given retreat position out of retreatRange, Then Fallback(invalid)", () => {
    const caster = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["u-turn"],
      currentPp: { "u-turn": 20 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
    });
    const { engine } = buildMoveTestEngine([caster, enemy], {
      gridSize: 10,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "u-turn",
      targetPosition: { x: 3, y: 2 },
      retreatPosition: { x: 9, y: 9 },
    });

    expect(result.success).toBe(true);
    const fallback = result.events.find((e) => e.type === BattleEventType.HitAndRunRetreatFallback);
    expect(fallback).toBeDefined();
    if (fallback && fallback.type === BattleEventType.HitAndRunRetreatFallback) {
      expect(fallback.reason).toBe("invalid");
    }
  });

  it("Given retreat lands on lava and caster not immune, Then LethalTerrainKo emitted", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["u-turn"],
      currentPp: { "u-turn": 20 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
    });
    const { engine, state } = buildMoveTestEngine([caster, enemy], {
      gridSize: 8,
      random: createPrng(0),
    });

    paintTile(state, { x: 0, y: 2 }, TerrainType.Lava);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "u-turn",
      targetPosition: { x: 3, y: 2 },
      retreatPosition: { x: 0, y: 2 },
    });

    expect(result.success).toBe(true);
    const lethal = result.events.find((e) => e.type === BattleEventType.LethalTerrainKo);
    expect(lethal).toBeDefined();
    const ko = result.events.find((e) => e.type === BattleEventType.PokemonKo);
    expect(ko).toBeDefined();
  });
});

describe("HitAndRun engine integration — volt-switch", () => {
  it("Given hitRange 1-2, Then can hit target at distance 2", () => {
    const caster = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["volt-switch"],
      currentPp: { "volt-switch": 20 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 2 },
    });
    const { engine } = buildMoveTestEngine([caster, enemy], {
      gridSize: 8,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "volt-switch",
      targetPosition: { x: 4, y: 2 },
      retreatPosition: { x: 0, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(enemy.currentHp).toBeLessThan(enemy.maxHp);
    expect(caster.position).toEqual({ x: 0, y: 2 });
  });
});

describe("HitAndRun engine integration — flip-turn", () => {
  it("Given hit and retreat, Then caster moves", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["flip-turn"],
      currentPp: { "flip-turn": 20 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
    });
    const { engine } = buildMoveTestEngine([caster, enemy], {
      gridSize: 8,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "flip-turn",
      targetPosition: { x: 3, y: 2 },
      retreatPosition: { x: 0, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(caster.position).toEqual({ x: 0, y: 2 });
    expect(enemy.currentHp).toBeLessThan(enemy.maxHp);
  });
});
