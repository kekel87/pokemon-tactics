import type { BaseStats, PlacementEntry, PlacementTeam } from "@pokemon-tactic/core";
import {
  computeCombatStats,
  Direction,
  PlayerController,
  PlayerId,
  type StatName,
  StatusType,
} from "@pokemon-tactic/core";
import { sandboxArena } from "@pokemon-tactic/data";
import type { SandboxConfig } from "../types/SandboxConfig";
import {
  type BattleSetupConfig,
  type BattleSetupResult,
  createBattleFromPlacements,
} from "./BattleSetup";

function applyConfigToInstance(
  result: BattleSetupResult,
  pokemonId: string,
  hp: number,
  status: StatusType | null,
  volatileStatus: StatusType | null,
  statStages: Partial<Record<StatName, number>>,
): void {
  const instance = result.state.pokemon.get(pokemonId);
  if (!instance) {
    return;
  }

  if (hp < 100) {
    instance.currentHp = Math.max(1, Math.floor(instance.maxHp * (hp / 100)));
  }

  if (status) {
    instance.statusEffects = [
      {
        type: status,
        remainingTurns: status === StatusType.Asleep ? 3 : null,
      },
    ];
  }

  if (volatileStatus) {
    const remainingTurns =
      volatileStatus === StatusType.Confused ? Math.floor(Math.random() * 4) + 2 : 3;
    instance.volatileStatuses = [{ type: volatileStatus, remainingTurns }];
  }

  for (const [stat, stages] of Object.entries(statStages)) {
    if (stages !== undefined) {
      instance.statStages[stat as StatName] = stages;
    }
  }
}

function applyDummyStats(
  result: BattleSetupResult,
  dummyPokemonId: string,
  level: number,
  baseStats: BaseStats | null,
): void {
  const instance = result.state.pokemon.get(dummyPokemonId);
  if (!instance) {
    return;
  }

  if (baseStats) {
    instance.baseStats = { ...baseStats };
    const combat = computeCombatStats(baseStats, level);
    instance.combatStats = combat;
    instance.level = level;
    instance.maxHp = combat.hp;
    instance.currentHp = combat.hp;
    instance.derivedStats = {
      movement: 3,
      jump: 1,
      initiative: combat.speed,
    };
  } else if (level !== 50) {
    const combat = computeCombatStats(instance.baseStats, level);
    instance.combatStats = combat;
    instance.level = level;
    instance.maxHp = combat.hp;
    instance.currentHp = combat.hp;
    instance.derivedStats = {
      movement: 3,
      jump: 1,
      initiative: combat.speed,
    };
  }
}

export function createSandboxBattle(config: SandboxConfig): BattleSetupResult {
  const map = sandboxArena;
  const format = map.formats[0];
  if (!format) {
    throw new Error("Sandbox arena has no formats defined");
  }

  const playerPokemonId = `p1-${config.pokemon}`;
  const dummyPokemonId = `p2-${config.dummyPokemon}`;

  const teams: PlacementTeam[] = [
    {
      playerId: PlayerId.Player1,
      pokemonIds: [playerPokemonId],
      controller: PlayerController.Human,
    },
    {
      playerId: PlayerId.Player2,
      pokemonIds: [dummyPokemonId],
      controller: PlayerController.Ai,
    },
  ];

  const playerSpawn = format.spawnZones[0]?.positions[0];
  const dummySpawn = format.spawnZones[1]?.positions[0];
  if (!playerSpawn || !dummySpawn) {
    throw new Error("Sandbox arena: spawn zones missing");
  }

  const placements: PlacementEntry[] = [
    {
      pokemonId: playerPokemonId,
      position: playerSpawn,
      direction: Direction.North,
    },
    {
      pokemonId: dummyPokemonId,
      position: dummySpawn,
      direction: config.dummyDirection,
    },
  ];

  const battleConfig: BattleSetupConfig = { map, teams, placements };
  const result = createBattleFromPlacements(battleConfig);

  applyDummyStats(result, dummyPokemonId, config.dummyLevel, config.dummyBaseStats);

  const playerInstance = result.state.pokemon.get(playerPokemonId);
  if (playerInstance && config.moves.length > 0) {
    playerInstance.moveIds = [...config.moves];
    const newPp: Record<string, number> = {};
    for (const moveId of config.moves) {
      const move = result.moveDefinitions.get(moveId);
      newPp[moveId] = move?.pp ?? 0;
    }
    playerInstance.currentPp = newPp;
  }

  applyConfigToInstance(
    result,
    playerPokemonId,
    config.hp,
    config.status,
    config.volatileStatus,
    config.statStages,
  );
  applyConfigToInstance(
    result,
    dummyPokemonId,
    config.dummyHp,
    config.dummyStatus,
    config.dummyVolatileStatus,
    config.dummyStatStages,
  );

  return result;
}
