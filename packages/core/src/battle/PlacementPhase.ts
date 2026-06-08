import type { Direction } from "../enums/direction";
import type { PlacementMode } from "../enums/placement-mode";
import type { PlayerId } from "../enums/player-id";
import type { MapDefinition } from "../types/map-definition";
import type { MapFormat } from "../types/map-format";
import type { PlacementEntry } from "../types/placement-entry";
import type { PlacementTeam } from "../types/placement-team";
import type { Position } from "../types/position";
import { directionFromTo } from "../utils/direction";
import { createPrng } from "../utils/prng";

export const PlacementError = {
  PositionOutOfZone: "position_out_of_zone",
  PositionOccupied: "position_occupied",
  PokemonAlreadyPlaced: "pokemon_already_placed",
  PokemonNotPlaced: "pokemon_not_placed",
  WrongPlayer: "wrong_player",
  PlacementComplete: "placement_complete",
  PlayerAlreadyDone: "player_already_done",
  PlayerCannotFinishYet: "player_cannot_finish_yet",
} as const;

export type PlacementError = (typeof PlacementError)[keyof typeof PlacementError];

export interface PlacementResult {
  success: boolean;
  error?: PlacementError;
}

export class PlacementPhase {
  private readonly placements: PlacementEntry[] = [];
  private readonly placedPokemonIds = new Set<string>();
  private readonly occupiedPositionKeys = new Set<string>();
  private readonly turnQueue: PlayerId[];
  private readonly availableByPlayer: Map<string, readonly string[]>;
  private readonly placedByPlayer: Map<string, string[]>;
  private readonly zonesByPlayer: Map<string, Set<string>>;
  private readonly ownerByPokemonId: Map<string, PlayerId>;
  private readonly donePlayers = new Set<PlayerId>();
  private readonly random: () => number;

  constructor(
    _mapDefinition: MapDefinition,
    private readonly teams: PlacementTeam[],
    private readonly format: MapFormat,
    _mode: PlacementMode,
    randomSeed?: number,
  ) {
    this.random = randomSeed == null ? Math.random : createPrng(randomSeed);
    this.turnQueue = this.buildTurnQueue();
    this.zonesByPlayer = this.buildZonesByPlayer();
    this.availableByPlayer = new Map(
      teams.map((team) => [team.playerId, [...team.availablePokemonIds]]),
    );
    this.placedByPlayer = new Map(teams.map((team) => [team.playerId, []]));
    this.ownerByPokemonId = new Map();
    for (const team of teams) {
      for (const pokemonId of team.availablePokemonIds) {
        this.ownerByPokemonId.set(pokemonId, team.playerId);
      }
    }
  }

  private buildTurnQueue(): PlayerId[] {
    const maxPerTeam = this.format.maxPokemonPerTeam;
    const queue: PlayerId[] = [];

    for (let round = 0; round < maxPerTeam; round++) {
      const teamsInOrder = round % 2 === 0 ? this.teams : [...this.teams].reverse();

      for (const team of teamsInOrder) {
        if (team.availablePokemonIds.length > 0) {
          queue.push(team.playerId);
        }
      }
    }

    return queue;
  }

  private buildZonesByPlayer(): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (let teamIndex = 0; teamIndex < this.teams.length; teamIndex++) {
      const team = this.teams[teamIndex];
      const zone = this.format.spawnZones[teamIndex];
      if (!team || !zone) {
        continue;
      }

      const positionKeys = new Set<string>();
      for (const position of zone.positions) {
        positionKeys.add(`${position.x},${position.y}`);
      }
      map.set(team.playerId, positionKeys);
    }
    return map;
  }

  private computeTurnIndex(): number {
    const consumed = new Map<PlayerId, number>();
    let i = 0;
    while (i < this.turnQueue.length) {
      const playerId = this.turnQueue[i];
      if (!playerId) {
        i++;
        continue;
      }
      if (this.donePlayers.has(playerId)) {
        i++;
        continue;
      }
      const placed = this.placedByPlayer.get(playerId)?.length ?? 0;
      const used = consumed.get(playerId) ?? 0;
      if (used < placed) {
        consumed.set(playerId, used + 1);
        i++;
        continue;
      }
      break;
    }
    return i;
  }

  getNextToPlace(): { playerId: PlayerId } | null {
    const index = this.computeTurnIndex();
    if (index >= this.turnQueue.length) {
      return null;
    }
    const playerId = this.turnQueue[index];
    if (!playerId) {
      return null;
    }
    return { playerId };
  }

  getUnplacedPokemonIds(playerId: PlayerId): string[] {
    const allIds = this.availableByPlayer.get(playerId) ?? [];
    return allIds.filter((id) => !this.placedPokemonIds.has(id));
  }

  getPlacedPokemonIds(playerId: PlayerId): readonly string[] {
    return this.placedByPlayer.get(playerId) ?? [];
  }

  isPlayerDone(playerId: PlayerId): boolean {
    if (this.donePlayers.has(playerId)) {
      return true;
    }
    const placed = this.placedByPlayer.get(playerId) ?? [];
    return placed.length >= this.format.maxPokemonPerTeam;
  }

  canFinishPlayer(playerId: PlayerId): boolean {
    if (this.donePlayers.has(playerId)) {
      return false;
    }
    const placed = this.placedByPlayer.get(playerId) ?? [];
    return placed.length >= 1;
  }

  finishPlayer(playerId: PlayerId): PlacementResult {
    if (this.donePlayers.has(playerId)) {
      return { success: false, error: PlacementError.PlayerAlreadyDone };
    }
    if (!this.canFinishPlayer(playerId)) {
      return { success: false, error: PlacementError.PlayerCannotFinishYet };
    }
    this.donePlayers.add(playerId);
    return { success: true };
  }

  isComplete(): boolean {
    for (const team of this.teams) {
      const placed = this.placedByPlayer.get(team.playerId) ?? [];
      const atCap = placed.length >= this.format.maxPokemonPerTeam;
      const done = this.donePlayers.has(team.playerId);
      if (!atCap && !done) {
        return false;
      }
      if (placed.length === 0) {
        return false;
      }
    }
    return true;
  }

  getPlacements(): PlacementEntry[] {
    return [...this.placements];
  }

  getPlacedPositions(): Position[] {
    return this.placements.map((entry) => entry.position);
  }

  submitPlacement(pokemonId: string, position: Position, direction: Direction): PlacementResult {
    const next = this.getNextToPlace();
    if (!next) {
      return { success: false, error: PlacementError.PlacementComplete };
    }

    const playerPokemon = this.availableByPlayer.get(next.playerId) ?? [];
    if (!playerPokemon.includes(pokemonId)) {
      return { success: false, error: PlacementError.WrongPlayer };
    }

    if (this.placedPokemonIds.has(pokemonId)) {
      return { success: false, error: PlacementError.PokemonAlreadyPlaced };
    }

    const placedForPlayer = this.placedByPlayer.get(next.playerId) ?? [];

    const positionKey = `${position.x},${position.y}`;
    const playerZone = this.zonesByPlayer.get(next.playerId);
    if (!playerZone?.has(positionKey)) {
      return { success: false, error: PlacementError.PositionOutOfZone };
    }

    if (this.occupiedPositionKeys.has(positionKey)) {
      return { success: false, error: PlacementError.PositionOccupied };
    }

    this.placements.push({ pokemonId, position, direction });
    this.placedPokemonIds.add(pokemonId);
    this.occupiedPositionKeys.add(positionKey);
    placedForPlayer.push(pokemonId);

    return { success: true };
  }

  removePlacement(pokemonId: string): PlacementResult {
    if (!this.placedPokemonIds.has(pokemonId)) {
      return { success: false, error: PlacementError.PokemonNotPlaced };
    }
    const index = this.placements.findIndex((entry) => entry.pokemonId === pokemonId);
    if (index < 0) {
      return { success: false, error: PlacementError.PokemonNotPlaced };
    }
    const entry = this.placements[index];
    if (!entry) {
      return { success: false, error: PlacementError.PokemonNotPlaced };
    }
    this.placements.splice(index, 1);
    this.placedPokemonIds.delete(pokemonId);
    this.occupiedPositionKeys.delete(`${entry.position.x},${entry.position.y}`);
    const ownerId = this.ownerByPokemonId.get(pokemonId);
    if (ownerId) {
      const list = this.placedByPlayer.get(ownerId);
      if (list) {
        const inListIdx = list.indexOf(pokemonId);
        if (inListIdx >= 0) {
          list.splice(inListIdx, 1);
        }
      }
      this.donePlayers.delete(ownerId);
    }
    return { success: true };
  }

  undoLastPlacement(): boolean {
    if (this.placements.length === 0) {
      return false;
    }

    const last = this.placements.pop();
    if (!last) {
      return false;
    }

    this.placedPokemonIds.delete(last.pokemonId);
    this.occupiedPositionKeys.delete(`${last.position.x},${last.position.y}`);
    const ownerId = this.ownerByPokemonId.get(last.pokemonId);
    if (ownerId) {
      const list = this.placedByPlayer.get(ownerId);
      if (list) {
        const inListIdx = list.indexOf(last.pokemonId);
        if (inListIdx >= 0) {
          list.splice(inListIdx, 1);
        }
      }
      this.donePlayers.delete(ownerId);
    }

    return true;
  }

  /**
   * Whether the current player may undo their last placement. Allowed only when
   * the most recent placement is theirs — i.e. no opponent has placed since. Once
   * an opponent has responded, undoing would let the player react to information
   * they shouldn't have, so it is forbidden.
   */
  canUndo(): boolean {
    const next = this.getNextToPlace();
    if (!next) {
      return false;
    }
    const last = this.placements.at(-1);
    if (!last) {
      return false;
    }
    return this.ownerByPokemonId.get(last.pokemonId) === next.playerId;
  }

  autoPlaceAll(gridCenter: Position): PlacementEntry[] {
    while (!this.isComplete()) {
      const next = this.getNextToPlace();
      if (!next) {
        break;
      }
      const unplaced = this.getUnplacedPokemonIds(next.playerId);
      const firstUnplaced = unplaced[0];
      if (!firstUnplaced) {
        if (this.canFinishPlayer(next.playerId)) {
          this.finishPlayer(next.playerId);
          continue;
        }
        break;
      }
      const entry = this.autoPlaceOne(next.playerId, firstUnplaced, gridCenter);
      if (!entry) {
        if (this.canFinishPlayer(next.playerId)) {
          this.finishPlayer(next.playerId);
          continue;
        }
        break;
      }
    }
    return this.getPlacements();
  }

  autoPlaceForPlayer(playerId: PlayerId, gridCenter: Position): PlacementEntry[] {
    const placed: PlacementEntry[] = [];
    while (!this.isPlayerDone(playerId)) {
      const next = this.getNextToPlace();
      if (!next || next.playerId !== playerId) {
        break;
      }
      const unplaced = this.getUnplacedPokemonIds(playerId);
      const firstUnplaced = unplaced[0];
      if (!firstUnplaced) {
        break;
      }
      const entry = this.autoPlaceOne(playerId, firstUnplaced, gridCenter);
      if (entry) {
        placed.push(entry);
      } else {
        break;
      }
    }
    return placed;
  }

  private autoPlaceOne(
    playerId: PlayerId,
    pokemonId: string,
    gridCenter: Position,
  ): PlacementEntry | null {
    const playerZone = this.zonesByPlayer.get(playerId);
    if (!playerZone) {
      return null;
    }

    const available: Position[] = [];
    for (const key of playerZone) {
      if (!this.occupiedPositionKeys.has(key)) {
        const [xStr, yStr] = key.split(",");
        available.push({ x: Number(xStr), y: Number(yStr) });
      }
    }

    if (available.length === 0) {
      return null;
    }

    const index = Math.floor(this.random() * available.length);
    const position = available[index];
    if (!position) {
      return null;
    }
    const direction = directionFromTo(position, gridCenter);

    const result = this.submitPlacement(pokemonId, position, direction);
    if (!result.success) {
      return null;
    }

    return { pokemonId, position, direction };
  }
}
