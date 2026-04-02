import type { Direction } from "../enums/direction";
import type { PlacementMode } from "../enums/placement-mode";
import { PlayerController } from "../enums/player-controller";
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
  WrongPlayer: "wrong_player",
  PlacementComplete: "placement_complete",
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
  private readonly pokemonByPlayer: Map<string, string[]>;
  private readonly zonesByPlayer: Map<string, Set<string>>;
  private readonly random: () => number;
  private turnIndex = 0;

  constructor(
    private readonly mapDefinition: MapDefinition,
    private readonly teams: PlacementTeam[],
    private readonly format: MapFormat,
    private readonly mode: PlacementMode,
    randomSeed?: number,
  ) {
    this.random = randomSeed == null ? Math.random : createPrng(randomSeed);
    this.turnQueue = this.buildTurnQueue();
    this.zonesByPlayer = this.buildZonesByPlayer();
    this.pokemonByPlayer = new Map(teams.map((team) => [team.playerId, [...team.pokemonIds]]));
  }

  private buildTurnQueue(): PlayerId[] {
    const maxTeamSize = Math.max(...this.teams.map((team) => team.pokemonIds.length));
    const queue: PlayerId[] = [];

    for (let round = 0; round < maxTeamSize; round++) {
      const teamsInOrder = round % 2 === 0 ? this.teams : [...this.teams].reverse();

      for (const team of teamsInOrder) {
        if (round < team.pokemonIds.length) {
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
      if (!team || !zone) continue;

      const positionKeys = new Set<string>();
      for (const position of zone.positions) {
        positionKeys.add(`${position.x},${position.y}`);
      }
      map.set(team.playerId, positionKeys);
    }
    return map;
  }

  getNextToPlace(): { playerId: PlayerId } | null {
    if (this.turnIndex >= this.turnQueue.length) return null;
    const playerId = this.turnQueue[this.turnIndex];
    if (!playerId) return null;
    return { playerId };
  }

  getUnplacedPokemonIds(playerId: PlayerId): string[] {
    const allIds = this.pokemonByPlayer.get(playerId) ?? [];
    return allIds.filter((id) => !this.placedPokemonIds.has(id));
  }

  isComplete(): boolean {
    return this.turnIndex >= this.turnQueue.length;
  }

  getPlacements(): PlacementEntry[] {
    return [...this.placements];
  }

  getPlacedPositions(): Position[] {
    return this.placements.map((entry) => entry.position);
  }

  submitPlacement(pokemonId: string, position: Position, direction: Direction): PlacementResult {
    if (this.isComplete()) {
      return { success: false, error: PlacementError.PlacementComplete };
    }

    const next = this.getNextToPlace();
    if (!next) {
      return { success: false, error: PlacementError.PlacementComplete };
    }

    const playerPokemon = this.pokemonByPlayer.get(next.playerId) ?? [];
    if (!playerPokemon.includes(pokemonId)) {
      return { success: false, error: PlacementError.WrongPlayer };
    }

    if (this.placedPokemonIds.has(pokemonId)) {
      return { success: false, error: PlacementError.PokemonAlreadyPlaced };
    }

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
    this.turnIndex++;

    return { success: true };
  }

  undoLastPlacement(): boolean {
    if (this.placements.length === 0 || this.turnIndex === 0) return false;

    const last = this.placements.pop();
    if (!last) return false;

    this.placedPokemonIds.delete(last.pokemonId);
    this.occupiedPositionKeys.delete(`${last.position.x},${last.position.y}`);
    this.turnIndex--;

    return true;
  }

  autoPlaceAll(gridCenter: Position): PlacementEntry[] {
    while (!this.isComplete()) {
      const next = this.getNextToPlace();
      if (!next) break;
      const unplaced = this.getUnplacedPokemonIds(next.playerId);
      const firstUnplaced = unplaced[0];
      if (!firstUnplaced) break;
      this.autoPlaceOne(next.playerId, firstUnplaced, gridCenter);
    }
    return this.getPlacements();
  }

  autoPlaceForPlayer(playerId: PlayerId, gridCenter: Position): PlacementEntry[] {
    const placed: PlacementEntry[] = [];
    while (!this.isComplete()) {
      const next = this.getNextToPlace();
      if (!next || next.playerId !== playerId) break;
      const unplaced = this.getUnplacedPokemonIds(playerId);
      const firstUnplaced = unplaced[0];
      if (!firstUnplaced) break;
      const entry = this.autoPlaceOne(playerId, firstUnplaced, gridCenter);
      if (entry) placed.push(entry);
    }
    return placed;
  }

  private autoPlaceOne(
    playerId: PlayerId,
    pokemonId: string,
    gridCenter: Position,
  ): PlacementEntry | null {
    const playerZone = this.zonesByPlayer.get(playerId);
    if (!playerZone) return null;

    const available: Position[] = [];
    for (const key of playerZone) {
      if (!this.occupiedPositionKeys.has(key)) {
        const [xStr, yStr] = key.split(",");
        available.push({ x: Number(xStr), y: Number(yStr) });
      }
    }

    if (available.length === 0) return null;

    const index = Math.floor(this.random() * available.length);
    const position = available[index]!;
    const direction = directionFromTo(position, gridCenter);

    const result = this.submitPlacement(pokemonId, position, direction);
    if (!result.success) return null;

    return { pokemonId, position, direction };
  }
}
