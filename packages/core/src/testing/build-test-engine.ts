import { loadAllPokemonTypes, loadData, pocArena } from "@pokemon-tactic/data";
import { BattleEngine } from "../battle/BattleEngine";
import { computeCombatStats, DEFAULT_BATTLE_LEVEL } from "../battle/stat-calculator";
import { computeMovement } from "../battle/stat-modifier";
import { Nature } from "../enums/nature";
import { PokemonGender } from "../enums/pokemon-gender";
import { StatName } from "../enums/stat-name";
import { Weather } from "../enums/weather";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PlacementEntry } from "../types/placement-entry";
import type { PlacementTeam } from "../types/placement-team";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { TileState } from "../types/tile-state";
import type { RandomFn } from "../utils/prng";

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

/**
 * 🔴 `random` : à FOURNIR dès que le test affirme un résultat dépendant d'un jet.
 *
 * Omis, le moteur retombe sur le vrai `Math.random()` — un seam de test délibéré
 * (`.claude/rules/core.md`), mais qui rend instable tout test qui assère un nombre, un plafond ou
 * une durée de combat. Le cas s'est produit : `scenarios/ct-scoring-anti-drag.scenario.test.ts`
 * échouait environ une fois sur quatre en suite complète, alors que son titre annonçait une graine
 * — laquelle ne couvrait que le placement et les décisions de l'IA, PAS les jets de dégâts.
 *
 * Le paramètre est optionnel pour ne pas décaler les nombres des tests qui ne dépendent d'aucun
 * jet ; ceux-là gardent le comportement d'avant.
 */
export function buildTestEngineFromPlacements(
  placements: PlacementEntry[],
  teams: PlacementTeam[],
  random?: RandomFn,
): { engine: BattleEngine; state: ReturnType<typeof buildState> } {
  const data = loadData();
  const moveRegistry = new Map<string, MoveDefinition>();
  for (const move of data.moves) {
    moveRegistry.set(move.id, move);
  }

  const pokemonDefinitions = new Map(data.pokemon.map((p) => [p.id, p]));
  const pokemonTypesMap = loadAllPokemonTypes();

  const map = pocArena;
  const grid: TileState[][] = map.tiles.map((row) =>
    row.map((tile) => ({ ...tile, occupantId: null as string | null })),
  );

  const pokemonMap = new Map<string, PokemonInstance>();

  for (const placement of placements) {
    const team = teams.find((t) => t.availablePokemonIds.includes(placement.pokemonId));
    if (!team) {
      throw new Error(`No team for ${placement.pokemonId}`);
    }

    const definitionId = placement.pokemonId.replace(/^p\d+-/, "");
    const definition = pokemonDefinitions.get(definitionId);
    if (!definition) {
      throw new Error(`Unknown definition: ${definitionId}`);
    }

    const combatStats = computeCombatStats(definition.baseStats, DEFAULT_BATTLE_LEVEL);

    const instance: PokemonInstance = {
      id: placement.pokemonId,
      definitionId: definition.id,
      playerId: team.playerId,
      level: DEFAULT_BATTLE_LEVEL,
      currentHp: combatStats.hp,
      maxHp: combatStats.hp,
      baseStats: { ...definition.baseStats },
      combatStats,
      weight: definition.weight,
      derivedStats: {
        movement: computeMovement(definition.baseStats.speed, 0),
        jump: 1,
        initiative: combatStats.speed,
      },
      statStages: { ...ZERO_STAT_STAGES },
      statusEffects: [],
      position: placement.position,
      orientation: placement.direction,
      moveIds: [...definition.movepool],
      activeDefense: null,
      lastEndureAtAction: null,
      toxicCounter: 0,
      volatileStatuses: [],
      recharging: false,
      gender: PokemonGender.Genderless,
      nature: Nature.Hardy,
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

  const state = buildState(grid, pokemonMap);
  // `random` est le 6ᵉ paramètre, pas le 3ᵉ (le 3ᵉ est la table des types, laissée vide ici) : les
  // `undefined` intercalés retombent sur les valeurs par défaut du constructeur.
  const engine = new BattleEngine(
    state,
    moveRegistry,
    undefined,
    pokemonTypesMap,
    undefined,
    random,
  );
  return { engine, state };
}

function buildState(grid: TileState[][], pokemonMap: Map<string, PokemonInstance>): BattleState {
  return {
    grid,
    pokemon: pokemonMap,
    activePokemonId: "",
    weather: Weather.None,
    weatherTurnsRemaining: 0,
    auras: [],
    fieldTerrains: [],
    distortionZones: [],
    fieldGlobalZones: [],
    entryHazards: [],
    pendingStrikes: [],
  };
}
