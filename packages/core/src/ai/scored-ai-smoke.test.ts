import { loadData, pocArena, typeChart } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { BattleEngine } from "../battle/BattleEngine";
import { PlacementPhase } from "../battle/PlacementPhase";
import { computeCombatStats } from "../battle/stat-calculator";
import { computeMovement } from "../battle/stat-modifier";
import { TurnPipeline } from "../battle/turn-pipeline";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import { PlacementMode } from "../enums/placement-mode";
import { PlayerId } from "../enums/player-id";
import type { PokemonType } from "../enums/pokemon-type";
import { StatName } from "../enums/stat-name";
import type { Action } from "../types/action";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PlacementTeam } from "../types/placement-team";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { TileState } from "../types/tile-state";
import { createPrng } from "../utils/prng";
import { pickAggressiveAction } from "./aggressive-ai";
import { EASY_PROFILE } from "./ai-profiles";
import { pickScoredAction } from "./scored-ai";

const BATTLE_LEVEL = 50;
const ZERO_STAT_STAGES = {
  [StatName.Hp]: 0,
  [StatName.Attack]: 0,
  [StatName.Defense]: 0,
  [StatName.SpAttack]: 0,
  [StatName.SpDefense]: 0,
  [StatName.Speed]: 0,
  [StatName.Accuracy]: 0,
  [StatName.Evasion]: 0,
};

describe("Smoke test: Aggressive AI vs Easy AI (6v6)", () => {
  it("completes a full battle without infinite loop", () => {
    const data = loadData();
    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }
    const pokemonTypesMap = new Map<string, PokemonType[]>(
      data.pokemon.map((p) => [p.id, p.types]),
    );
    const pokemonDefs = new Map(data.pokemon.map((p) => [p.id, p]));

    const teams: PlacementTeam[] = [
      {
        playerId: PlayerId.Player1,
        pokemonIds: [
          "p1-bulbasaur",
          "p1-squirtle",
          "p1-pikachu",
          "p1-machop",
          "p1-abra",
          "p1-geodude",
        ],
        controller: "human" as const,
      },
      {
        playerId: PlayerId.Player2,
        pokemonIds: [
          "p2-charmander",
          "p2-pidgey",
          "p2-gastly",
          "p2-growlithe",
          "p2-jigglypuff",
          "p2-seel",
        ],
        controller: "ai" as const,
      },
    ];

    const map = pocArena;
    const format = map.formats[0];
    if (!format) {
      throw new Error("No format defined");
    }
    const gridCenter = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
    const placementPhase = new PlacementPhase(map, teams, format, PlacementMode.Random, 42);
    const placements = placementPhase.autoPlaceAll(gridCenter);

    const grid: TileState[][] = map.tiles.map((row) =>
      row.map((tile) => ({ ...tile, occupantId: null })),
    );

    const pokemonMap = new Map<string, PokemonInstance>();
    for (const placement of placements) {
      const definitionId = placement.pokemonId.replace(/^p\d+-/, "");
      const definition = pokemonDefs.get(definitionId);
      if (!definition) {
        throw new Error(`Unknown pokemon: ${definitionId}`);
      }
      const team = teams.find((t) => t.pokemonIds.includes(placement.pokemonId));
      if (!team) {
        throw new Error(`No team for: ${placement.pokemonId}`);
      }
      const combatStats = computeCombatStats(definition.baseStats, BATTLE_LEVEL);
      const currentPp: Record<string, number> = {};
      for (const moveId of definition.movepool) {
        const move = moveRegistry.get(moveId);
        currentPp[moveId] = move?.pp ?? 0;
      }
      const instance: PokemonInstance = {
        id: placement.pokemonId,
        definitionId: definition.id,
        playerId: team.playerId,
        level: BATTLE_LEVEL,
        currentHp: combatStats.hp,
        maxHp: combatStats.hp,
        baseStats: { ...definition.baseStats },
        combatStats,
        derivedStats: {
          movement: computeMovement(definition.baseStats.speed, 0),
          jump: 1,
          initiative: combatStats.speed,
        },
        statStages: { ...ZERO_STAT_STAGES },
        statusEffects: [],
        position: placement.position,
        orientation: Direction.South,
        moveIds: [...definition.movepool],
        currentPp,
        activeDefense: null,
        lastEndureRound: null,
        toxicCounter: 0,
        volatileStatuses: [],
        recharging: false,
      };
      pokemonMap.set(instance.id, instance);
      const row = grid[placement.position.y];
      if (row) {
        const tile = row[placement.position.x];
        if (tile) {
          tile.occupantId = instance.id;
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
    };

    const seed = 42;
    const random = createPrng(seed);
    const engine = new BattleEngine(
      state,
      moveRegistry,
      typeChart,
      pokemonTypesMap,
      new TurnPipeline(),
      random,
      seed,
    );

    const easyRandom = createPrng(99);
    const aggressiveRandom = createPrng(77);

    let totalActions = 0;
    const maxActions = 5000;
    let winner: string | null = null;

    while (totalActions < maxActions) {
      const gameState = engine.getGameState(PlayerId.Player1);
      const activePokemonId = gameState.turnOrder[gameState.currentTurnIndex];
      if (!activePokemonId) {
        break;
      }

      const activePokemon = gameState.pokemon.get(activePokemonId);
      if (!activePokemon) {
        break;
      }

      const playerId = activePokemon.playerId;
      const legalActions = engine.getLegalActions(playerId);
      if (legalActions.length === 0) {
        break;
      }

      let action: Action;
      if (playerId === PlayerId.Player1) {
        action = pickAggressiveAction(legalActions, gameState, moveRegistry, aggressiveRandom);
      } else {
        action = pickScoredAction(
          legalActions,
          gameState,
          moveRegistry,
          engine,
          EASY_PROFILE,
          easyRandom,
        );
      }

      const result = engine.submitAction(playerId, action);
      totalActions++;

      const battleEndEvent = result.events.find((e) => e.type === BattleEventType.BattleEnded);
      if (battleEndEvent && battleEndEvent.type === BattleEventType.BattleEnded) {
        winner = battleEndEvent.winnerId;
        break;
      }
    }

    expect(winner).not.toBeNull();
    expect(totalActions).toBeLessThan(maxActions);
    expect(totalActions).toBeGreaterThan(0);
  }, 30_000);
});
