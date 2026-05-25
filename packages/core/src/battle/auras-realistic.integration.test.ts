import { loadAllPokemonTypes, loadData, typeChart } from "@pokemon-tactic/data";
import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { AuraKind } from "../enums/aura-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Nature } from "../enums/nature";
import { PlayerId } from "../enums/player-id";
import { PokemonGender } from "../enums/pokemon-gender";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { Weather } from "../enums/weather";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { TileState } from "../types/tile-state";
import { postAura } from "./aura-system";
import { BattleEngine } from "./BattleEngine";
import { computeCombatStats } from "./stat-calculator";
import { computeMovement } from "./stat-modifier";

const ZERO_STAGES = {
  [StatName.Hp]: 0,
  [StatName.Attack]: 0,
  [StatName.Defense]: 0,
  [StatName.SpAttack]: 0,
  [StatName.SpDefense]: 0,
  [StatName.Speed]: 0,
  [StatName.Accuracy]: 0,
  [StatName.Evasion]: 0,
};

function buildFullEngine(
  pokemonInstances: PokemonInstance[],
  gridSize = 12,
): { engine: BattleEngine; state: BattleState } {
  const data = loadData();
  const moveRegistry = new Map<string, MoveDefinition>();
  for (const move of data.moves) {
    moveRegistry.set(move.id, move);
  }
  const pokemonTypesMap = loadAllPokemonTypes();

  const grid: TileState[][] = [];
  for (let y = 0; y < gridSize; y++) {
    const row: TileState[] = [];
    for (let x = 0; x < gridSize; x++) {
      row.push({
        position: { x, y },
        terrain: "normal",
        height: 0,
        slope: null,
        decoration: null,
        occupantId: null,
      });
    }
    grid.push(row);
  }

  const pokemonMap = new Map<string, PokemonInstance>();
  for (const pkmn of pokemonInstances) {
    pokemonMap.set(pkmn.id, pkmn);
    const row = grid[pkmn.position.y];
    if (row) {
      const tile = row[pkmn.position.x];
      if (tile) {
        tile.occupantId = pkmn.id;
      }
    }
  }

  const state: BattleState = {
    grid,
    pokemon: pokemonMap,
    turnOrder: [],
    currentTurnIndex: 0,
    roundNumber: 1,
    predictedNextRoundOrder: [],
    weather: Weather.None,
    weatherTurnsRemaining: 0,
    auras: [],
  };

  const engine = new BattleEngine(
    state,
    moveRegistry,
    typeChart,
    pokemonTypesMap,
    undefined,
    undefined,
    0,
    undefined,
    undefined,
    data.abilityRegistry,
    data.itemRegistry,
  );

  return { engine, state };
}

function makePokemon(opts: {
  id: string;
  definitionId: string;
  playerId: string;
  position: { x: number; y: number };
  moveIds: string[];
  initiative?: number;
}): PokemonInstance {
  const data = loadData();
  const def = data.pokemon.find((p) => p.id === opts.definitionId);
  if (!def) {
    throw new Error(`Unknown pokemon: ${opts.definitionId}`);
  }
  const combat = computeCombatStats(def.baseStats, 50);
  const currentPp: Record<string, number> = {};
  for (const m of opts.moveIds) {
    const move = data.moves.find((mv) => mv.id === m);
    currentPp[m] = move?.pp ?? 30;
  }
  return {
    id: opts.id,
    definitionId: opts.definitionId,
    playerId: opts.playerId,
    level: 50,
    currentHp: combat.hp,
    maxHp: combat.hp,
    baseStats: { ...def.baseStats },
    combatStats: combat,
    derivedStats: {
      movement: computeMovement(def.baseStats.speed, 0),
      jump: 1,
      initiative: opts.initiative ?? combat.speed,
    },
    statStages: { ...ZERO_STAGES },
    statusEffects: [],
    position: opts.position,
    orientation: 0,
    moveIds: opts.moveIds,
    currentPp,
    activeDefense: null,
    lastEndureRound: null,
    toxicCounter: 0,
    volatileStatuses: [],
    recharging: false,
    gender: PokemonGender.Genderless,
    nature: Nature.Hardy,
  };
}

describe("Realistic 2v2 aura protection (full BattleEngine + registries)", () => {
  it("Mist blocks Growl on ally adjacent to caster", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const articuno = makePokemon({
      id: "p1-articuno",
      definitionId: "articuno",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      moveIds: ["mist"],
      initiative: 10,
    });
    const lapras = makePokemon({
      id: "p1-lapras",
      definitionId: "lapras",
      playerId: PlayerId.Player1,
      position: { x: 4, y: 3 },
      moveIds: ["surf"],
      initiative: 10,
    });
    const charizard = makePokemon({
      id: "p2-charizard",
      definitionId: "charizard",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 3 },
      moveIds: ["growl"],
      initiative: 100,
    });

    const { engine, state } = buildFullEngine([articuno, lapras, charizard]);

    postAura(state, articuno, AuraKind.Mist);

    // First action: Charizard (highest initiative)
    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "p2-charizard",
      moveId: "growl",
      targetPosition: { x: 4, y: 3 },
    });

    expect(result.success).toBe(true);

    const blockedOnLapras = result.events.some(
      (e) => e.type === BattleEventType.StatChangeBlocked && e.pokemonId === "p1-lapras",
    );

    expect(state.pokemon.get("p1-lapras")?.statStages[StatName.Attack]).toBe(0);
    expect(state.pokemon.get("p1-articuno")?.statStages[StatName.Attack]).toBe(0);
    expect(blockedOnLapras).toBe(true);

    vi.restoreAllMocks();
  });

  it("Safeguard blocks Thunder-Wave on ally adjacent to caster", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const alakazam = makePokemon({
      id: "p1-alakazam",
      definitionId: "alakazam",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      moveIds: ["safeguard"],
      initiative: 10,
    });
    const venusaur = makePokemon({
      id: "p1-venusaur",
      definitionId: "venusaur",
      playerId: PlayerId.Player1,
      position: { x: 4, y: 3 },
      moveIds: ["tackle"],
      initiative: 10,
    });
    const raichu = makePokemon({
      id: "p2-raichu",
      definitionId: "raichu",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 3 },
      moveIds: ["thunder-wave"],
      initiative: 100,
    });

    const { engine, state } = buildFullEngine([alakazam, venusaur, raichu]);

    postAura(state, alakazam, AuraKind.Safeguard);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "p2-raichu",
      moveId: "thunder-wave",
      targetPosition: { x: 4, y: 3 },
    });

    expect(result.success).toBe(true);

    const blocked = result.events.some(
      (e) =>
        e.type === BattleEventType.StatusBlocked &&
        e.pokemonId === "p1-venusaur" &&
        e.status === StatusType.Paralyzed,
    );
    expect(state.pokemon.get("p1-venusaur")?.statusEffects.length).toBe(0);
    expect(blocked).toBe(true);

    vi.restoreAllMocks();
  });
});
