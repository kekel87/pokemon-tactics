import type {
  HeldItemId,
  MapDefinition,
  PlacementEntry,
  PlacementTeam,
} from "@pokemon-tactic/core";
import {
  createPrng,
  Direction,
  PlayerController,
  PlayerId,
  type StatName,
  StatusType,
  setWeather,
  Weather,
} from "@pokemon-tactic/core";
import { sandboxArena } from "@pokemon-tactic/data";
import {
  type BattleSetupConfig,
  type BattleSetupResult,
  createBattleFromPlacements,
} from "./BattleSetup.js";
import type { Position2D, SandboxConfig, SandboxMemberConfig } from "./sandbox-config.js";

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

  if (hp <= 0) {
    instance.currentHp = 0;
  } else if (hp < 100) {
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

const DEFAULT_DIRECTIONS: [Direction, Direction] = [Direction.North, Direction.South];

/** Instance id for a team member: `p{team}-m{member}-{pokemon}` (unique even with duplicate species). */
export function sandboxInstanceId(teamIndex: number, memberIndex: number, pokemon: string): string {
  return `p${teamIndex + 1}-m${memberIndex}-${pokemon}`;
}

function positionKey(position: Position2D): string {
  return `${position.x},${position.y}`;
}

/**
 * Resolve spawn tiles for a team's members. Explicit `member.position` wins; otherwise
 * the format's spawn-zone positions are consumed in order; when a team has more members
 * than zone positions, the remaining ones cascade to the nearest free in-bounds tiles
 * (Manhattan distance from the zone anchor). Shared `occupied` set prevents overlaps
 * across both teams.
 */
function resolveTeamSpawns(
  members: SandboxMemberConfig[],
  zonePositions: readonly Position2D[],
  map: MapDefinition,
  occupied: Set<string>,
): Position2D[] {
  const anchor = zonePositions[0];
  if (!anchor) {
    throw new Error(`Map "${map.name}": no spawn zone for a sandbox team`);
  }
  const resolved: Position2D[] = [];
  let zoneCursor = 0;
  for (const member of members) {
    if (member.position) {
      resolved.push(member.position);
      occupied.add(positionKey(member.position));
      continue;
    }
    let picked: Position2D | undefined;
    while (zoneCursor < zonePositions.length) {
      const candidate = zonePositions[zoneCursor++];
      if (candidate && !occupied.has(positionKey(candidate))) {
        picked = candidate;
        break;
      }
    }
    picked ??= findNearestFreeTile(anchor, map, occupied);
    resolved.push(picked);
    occupied.add(positionKey(picked));
  }
  return resolved;
}

/** Breadth-by-distance scan for the closest in-bounds, unoccupied tile around an anchor. */
function findNearestFreeTile(
  anchor: Position2D,
  map: MapDefinition,
  occupied: Set<string>,
): Position2D {
  for (let radius = 1; radius < map.width + map.height; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) !== radius) {
          continue;
        }
        const x = anchor.x + dx;
        const y = anchor.y + dy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
          continue;
        }
        const candidate = { x, y };
        if (!occupied.has(positionKey(candidate)) && map.tiles[y]?.[x]?.occupantId == null) {
          return candidate;
        }
      }
    }
  }
  throw new Error(`Map "${map.name}": no free tile for a cascaded sandbox spawn`);
}

export function createSandboxBattle(
  config: SandboxConfig,
  map: MapDefinition = sandboxArena,
): BattleSetupResult {
  const format = map.formats[0];
  if (!format) {
    throw new Error(`Map "${map.name}" has no formats defined`);
  }

  const placementTeams: PlacementTeam[] = [];
  const placements: PlacementEntry[] = [];
  const heldItemOverrides: Record<string, HeldItemId> = {};
  const abilityOverrides: Record<string, string> = {};
  const moveOverrides: Record<string, readonly string[]> = {};
  const occupied = new Set<string>();

  // Applied after creation so HP%/status/stages layer onto the built instance.
  const postApply: { id: string; member: SandboxMemberConfig }[] = [];

  config.teams.forEach((team, teamIndex) => {
    const playerId = teamIndex === 0 ? PlayerId.Player1 : PlayerId.Player2;
    const controller = team.control === "player" ? PlayerController.Human : PlayerController.Ai;
    const ids = team.members.map((member, memberIndex) =>
      sandboxInstanceId(teamIndex, memberIndex, member.pokemon),
    );
    placementTeams.push({ playerId, availablePokemonIds: ids, controller });

    const zonePositions = format.spawnZones[teamIndex]?.positions ?? [];
    const spawns = resolveTeamSpawns(team.members, zonePositions, map, occupied);

    team.members.forEach((member, memberIndex) => {
      const id = ids[memberIndex] as string;
      placements.push({
        pokemonId: id,
        position: spawns[memberIndex] as Position2D,
        direction: member.direction ?? DEFAULT_DIRECTIONS[teamIndex] ?? Direction.North,
      });
      if (member.heldItem) {
        heldItemOverrides[id] = member.heldItem;
      }
      if (member.ability) {
        abilityOverrides[id] = member.ability;
      }
      if (member.moves && member.moves.length > 0) {
        moveOverrides[id] = [...member.moves];
      }
      postApply.push({ id, member });
    });
  });

  const battleConfig: BattleSetupConfig = {
    map,
    teams: placementTeams,
    placements,
    heldItemOverrides,
    abilityOverrides,
    moveOverrides,
    seed: config.seed,
    // Seed instance creation too (nature/gender), so a fixed seed reproduces the same stat spread
    // and damage — not just combat RNG. Makes "same seed → same damage" assertable in e2e. (A member
    // spawned Confused still rolls its confusion duration off Math.random — an isolated exception.)
    creationRng: createPrng(config.seed ?? 0),
  };
  const result = createBattleFromPlacements(battleConfig);

  for (const { id, member } of postApply) {
    applyConfigToInstance(
      result,
      id,
      member.hp ?? 100,
      member.status ?? null,
      member.volatileStatus ?? null,
      member.statStages ?? {},
    );
  }

  if (config.weather && config.weather !== Weather.None) {
    const weatherEvents = setWeather(result.state, config.weather, config.weatherTurns ?? 5);
    result.engine.addStartupEvents(weatherEvents);
  }

  result.engine.rerunBattleStartChecks();

  return result;
}
