/**
 * Sandbox trainers (plan 252): a SpriteKiln trainer standing behind its team, as scenery only. The
 * engine never sees it, so it blocks no tile; it reacts to the battle events the screen already
 * reports. Visual proof ahead of the Aventure trainer unit (`decision-1214`, `decision-1215`).
 */

import {
  type BattleEvent,
  BattleEventType,
  type BattleState,
  directionFromTo,
  type MapDefinition,
  manhattanDistance,
  type Position,
  TerrainType,
} from "@pokemon-tactic/core";
import type { CombatPokemonHandle, CombatScene } from "@pokemon-tactic/render-ports";
import {
  type SandboxTeamConfig,
  type TrainerAnimation,
  trainerSpriteId,
} from "../types/SandboxConfig";

/** Rest on the idle pose between two victory celebrations (human's call, plan 252 recette). */
const CELEBRATION_PAUSE_MS = 1500;

export interface SandboxTrainers {
  /** Feed every reported battle event; trainers react to their own team's. */
  observe(event: BattleEvent): void;
  /** Studio debug list: play one animation once on a team's trainer. */
  play(teamIndex: number, animation: TrainerAnimation): void;
  /** Stop the victory loop: the scene is going away. */
  dispose(): void;
}

/** Ground a trainer may stand on: no liquid, nothing that hurts or slides. */
const TRAINER_STANDING_TERRAINS: ReadonlySet<TerrainType> = new Set([
  TerrainType.Normal,
  TerrainType.TallGrass,
  TerrainType.Sand,
  TerrainType.Snow,
]);

/**
 * The free, dry tile closest to the team that is not on the map-centre side of it: behind the team,
 * out of the lanes it advances through. Null for an empty team or a map with no such tile.
 */
export function pickTrainerTile(
  map: MapDefinition,
  team: readonly Position[],
  taken: ReadonlySet<string>,
): Position | null {
  if (team.length === 0) {
    return null;
  }
  const centroidX = team.reduce((sum, position) => sum + position.x, 0) / team.length;
  const centroidY = team.reduce((sum, position) => sum + position.y, 0) / team.length;
  const awayX = centroidX - (map.width - 1) / 2;
  const awayY = centroidY - (map.height - 1) / 2;
  let best: { position: Position; score: number } | null = null;
  for (const row of map.tiles) {
    for (const tile of row) {
      const { x, y } = tile.position;
      if (!TRAINER_STANDING_TERRAINS.has(tile.terrain) || taken.has(`${x},${y}`)) {
        continue;
      }
      const distance = manhattanDistance({ x, y }, { x: centroidX, y: centroidY });
      const behind = (x - centroidX) * awayX + (y - centroidY) * awayY >= 0;
      const score = distance + (behind ? 0 : map.width + map.height);
      if (!best || score < best.score) {
        best = { position: { x, y }, score };
      }
    }
  }
  return best?.position ?? null;
}

export function spawnSandboxTrainers(
  combat: CombatScene,
  state: BattleState,
  map: MapDefinition,
  teams: readonly SandboxTeamConfig[],
  teamPlayerId: (teamIndex: number) => string,
): SandboxTrainers {
  const trainerByPlayer = new Map<string, CombatPokemonHandle>();
  // The map definition carries no occupants: the Pokémon tiles come from the engine state.
  const taken = new Set(
    [...state.pokemon.values()].map((pokemon) => `${pokemon.position.x},${pokemon.position.y}`),
  );
  const center = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  teams.forEach((team, teamIndex) => {
    if (!team.trainer) {
      return;
    }
    const playerId = teamPlayerId(teamIndex);
    const positions = [...state.pokemon.values()]
      .filter((pokemon) => pokemon.playerId === playerId)
      .map((pokemon) => pokemon.position);
    const tile = pickTrainerTile(map, positions, taken);
    if (!tile) {
      return;
    }
    taken.add(`${tile.x},${tile.y}`);
    const handle = combat.addPokemon({
      pokemonId: trainerSpriteId(team.trainer),
      spawn: tile,
      team: teamIndex + 1,
    });
    handle.setHudVisible(false);
    handle.setFacing(directionFromTo(tile, center));
    trainerByPlayer.set(playerId, handle);
  });

  const trainerOf = (pokemonId: string): CombatPokemonHandle | undefined => {
    const playerId = state.pokemon.get(pokemonId)?.playerId;
    return playerId === undefined ? undefined : trainerByPlayer.get(playerId);
  };

  let celebrationTimer: ReturnType<typeof setTimeout> | undefined;
  const celebrate = (handle: CombatPokemonHandle): void => {
    handle.playOnce("Celebrate");
    celebrationTimer = setTimeout(
      () => celebrate(handle),
      handle.animationDurationMs("Celebrate") + CELEBRATION_PAUSE_MS,
    );
  };

  return {
    observe(event) {
      if (event.type === BattleEventType.MoveStarted) {
        trainerOf(event.attackerId)?.playOnce("Command");
      } else if (event.type === BattleEventType.PokemonKo) {
        trainerOf(event.pokemonId)?.playOnce("Hurt");
      } else if (event.type === BattleEventType.BattleEnded && event.winnerId !== null) {
        for (const [playerId, handle] of trainerByPlayer) {
          if (playerId === event.winnerId) {
            celebrate(handle);
          } else {
            handle.setKnockedOut(true);
          }
        }
      }
    },
    play(teamIndex, animation) {
      trainerByPlayer.get(teamPlayerId(teamIndex))?.playOnce(animation);
    },
    dispose() {
      clearTimeout(celebrationTimer);
    },
  };
}
