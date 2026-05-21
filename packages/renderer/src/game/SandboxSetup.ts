import type {
  HeldItemId,
  MapDefinition,
  PlacementEntry,
  PlacementTeam,
} from "@pokemon-tactic/core";
import {
  Direction,
  PlayerController,
  PlayerId,
  type StatName,
  StatusType,
  setWeather,
  Weather,
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
    const baseDuration: number | null = status === StatusType.Asleep ? 3 : null;
    let remainingTurns: number | null = baseDuration;
    let shortenedByAbilityId: string | undefined;
    const ability = result.abilityRegistry.getForPokemon(instance);
    if (baseDuration !== null && ability?.onStatusDurationModify) {
      const modified = ability.onStatusDurationModify({
        self: instance,
        status,
        duration: baseDuration,
      });
      if (modified.duration < baseDuration) {
        shortenedByAbilityId = ability.id;
      }
      remainingTurns = modified.duration;
    }
    instance.statusEffects = [
      {
        type: status,
        remainingTurns,
        ...(shortenedByAbilityId ? { shortenedByAbilityId } : {}),
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

export function createSandboxBattle(
  config: SandboxConfig,
  map: MapDefinition = sandboxArena,
): BattleSetupResult {
  const format = map.formats[0];
  if (!format) {
    throw new Error(`Map "${map.name}" has no formats defined`);
  }

  const playerPokemonId = `p1-${config.pokemon}`;
  const dummyPokemonId = `p2-${config.dummyPokemon}`;

  const dummyController =
    config.dummyControl === "player" ? PlayerController.Human : PlayerController.Ai;

  const teams: PlacementTeam[] = [
    {
      playerId: PlayerId.Player1,
      availablePokemonIds: [playerPokemonId],
      controller: PlayerController.Human,
    },
    {
      playerId: PlayerId.Player2,
      availablePokemonIds: [dummyPokemonId],
      controller: dummyController,
    },
  ];

  const playerSpawn = config.playerPosition ?? format.spawnZones[0]?.positions[0];
  const dummySpawn = config.dummyPosition ?? format.spawnZones[1]?.positions[0];
  if (!playerSpawn || !dummySpawn) {
    throw new Error(`Map "${map.name}": spawn zones missing and no override provided`);
  }

  const placements: PlacementEntry[] = [
    {
      pokemonId: playerPokemonId,
      position: playerSpawn,
      direction: config.playerDirection ?? Direction.North,
    },
    {
      pokemonId: dummyPokemonId,
      position: dummySpawn,
      direction: config.dummyDirection,
    },
  ];

  const heldItemOverrides: Record<string, HeldItemId> = {};
  if (config.heldItem) {
    heldItemOverrides[playerPokemonId] = config.heldItem;
  }
  if (config.dummyHeldItem) {
    heldItemOverrides[dummyPokemonId] = config.dummyHeldItem;
  }

  const abilityOverrides: Record<string, string> = {};
  if (config.playerAbility) {
    abilityOverrides[playerPokemonId] = config.playerAbility;
  }
  if (config.dummyAbility) {
    abilityOverrides[dummyPokemonId] = config.dummyAbility;
  }

  const battleConfig: BattleSetupConfig = {
    map,
    teams,
    placements,
    heldItemOverrides,
    abilityOverrides,
  };
  const result = createBattleFromPlacements(battleConfig);

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

  if (config.dummyControl === "player") {
    const dummyInstance = result.state.pokemon.get(dummyPokemonId);
    if (dummyInstance) {
      const requestedMoves = config.dummyMoves.filter((id) => result.moveDefinitions.has(id));
      const fallbackMoves =
        requestedMoves.length > 0 ? requestedMoves.slice(0, 4) : dummyInstance.moveIds.slice(0, 4);
      dummyInstance.moveIds = [...fallbackMoves];
      const newPp: Record<string, number> = {};
      for (const moveId of fallbackMoves) {
        const move = result.moveDefinitions.get(moveId);
        newPp[moveId] = move?.pp ?? 0;
      }
      dummyInstance.currentPp = newPp;
    }
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

  if (config.weather && config.weather !== Weather.None) {
    const weatherEvents = setWeather(result.state, config.weather, config.weatherTurns ?? 5);
    result.engine.addStartupEvents(weatherEvents);
  }

  result.engine.rerunBattleStartChecks();

  return result;
}
