import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import { TerrainType } from "../enums/terrain-type";
import { MockBattle } from "../testing/mock-battle";
import { BattleEngine } from "./BattleEngine";

function buildEngine(pokemonTypes: PokemonType[]) {
  const pokemon = {
    ...MockBattle.player1Fast,
    id: "mover",
    definitionId: "test-pokemon",
    position: { x: 0, y: 0 },
    derivedStats: { ...MockBattle.player1Fast.derivedStats, movement: 4 },
    statusEffects: [],
    statStages: { ...MockBattle.zeroStatStages },
    volatileStatuses: [],
  };
  const dummy = {
    ...MockBattle.player2Slow,
    id: "dummy",
    position: { x: 9, y: 9 },
  };
  const state = MockBattle.stateFrom([pokemon, dummy], 10, 10);
  state.turnOrder = ["mover", "dummy"];
  state.currentTurnIndex = 0;
  const pokemonTypesMap = new Map<string, PokemonType[]>([
    ["test-pokemon", pokemonTypes],
    ["test", [PokemonType.Normal]],
  ]);
  return { engine: new BattleEngine(state, new Map(), {}, pokemonTypesMap), state };
}

describe("BattleEngine — magma burn on passage", () => {
  it("Given Normal Pokemon traverses magma, When Move, Then TerrainStatusApplied Burned", () => {
    const { engine, state } = buildEngine([PokemonType.Normal]);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Magma });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    });

    expect(result.success).toBe(true);
    const statusEvent = result.events.find((e) => e.type === BattleEventType.TerrainStatusApplied);
    expect(statusEvent).toBeDefined();
    if (statusEvent?.type === BattleEventType.TerrainStatusApplied) {
      expect(statusEvent.status).toBe(StatusType.Burned);
    }
    const mover = state.pokemon.get("mover");
    expect(mover?.statusEffects.some((s) => s.type === StatusType.Burned)).toBe(true);
  });

  it("Given Fire-type Pokemon traverses magma, When Move, Then no burn", () => {
    const { engine, state } = buildEngine([PokemonType.Fire]);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Magma });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.TerrainStatusApplied)).toBe(false);
  });

  it("Given Flying Pokemon traverses magma, When Move, Then no burn", () => {
    const { engine, state } = buildEngine([PokemonType.Normal, PokemonType.Flying]);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Magma });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.TerrainStatusApplied)).toBe(false);
  });

  it("Given already Burned Pokemon traverses magma, When Move, Then no double-burn", () => {
    const { engine, state } = buildEngine([PokemonType.Normal]);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Magma });
    const mover = state.pokemon.get("mover");
    if (mover) {
      mover.statusEffects.push({ type: StatusType.Burned, remainingTurns: null });
    }

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.TerrainStatusApplied)).toBe(false);
    expect(mover?.statusEffects.filter((s) => s.type === StatusType.Burned)).toHaveLength(1);
  });

  it("Given Normal Pokemon stops on magma (no pass-through), When Move, Then burned at destination", () => {
    const { engine, state } = buildEngine([PokemonType.Normal]);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Magma });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [{ x: 1, y: 0 }],
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.TerrainStatusApplied)).toBe(true);
  });

  it("Given Paralyzed Pokemon traverses magma, When Move, Then no burn (single major status)", () => {
    const { engine, state } = buildEngine([PokemonType.Normal]);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Magma });
    const mover = state.pokemon.get("mover");
    if (mover) {
      mover.statusEffects.push({ type: StatusType.Paralyzed, remainingTurns: null });
    }

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.TerrainStatusApplied)).toBe(false);
    expect(mover?.statusEffects).toHaveLength(1);
    expect(mover?.statusEffects[0]?.type).toBe(StatusType.Paralyzed);
  });
});
