import type { Direction } from "../enums/direction";
import { PlacementMode } from "../enums/placement-mode";
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
  /**
   * Vrai en placement SIMULTANÉ (plan 211) : plus de tour de rôle, chaque joueur pose quand il veut.
   *
   * Le paramètre `mode` était reçu et jamais lu depuis l'origine de la classe — l'accroche existait,
   * personne ne s'en était encore servi.
   */
  private readonly simultaneous: boolean;
  /** Index de camp par joueur, dans l'ordre de `teams` — c'est l'ordre canonique des poses. */
  private readonly teamIndexByPlayer: Map<PlayerId, number>;

  constructor(
    _mapDefinition: MapDefinition,
    private readonly teams: PlacementTeam[],
    private readonly format: MapFormat,
    mode: PlacementMode,
    randomSeed?: number,
  ) {
    this.random = randomSeed == null ? Math.random : createPrng(randomSeed);
    this.simultaneous = mode === PlacementMode.Simultaneous;
    this.teamIndexByPlayer = new Map(teams.map((team, index) => [team.playerId, index]));
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

  /**
   * Qui pose ce Pokemon, et a-t-il le droit ?
   *
   * En alternance, c'est le tour qui décide : seul le joueur dont c'est le tour peut poser, et il ne
   * peut poser que les siens. En simultané, c'est le POKEMON qui décide — son propriétaire pose
   * quand il veut, tant qu'il n'a pas fini.
   */
  private resolvePlacingPlayer(
    pokemonId: string,
  ): { playerId: PlayerId } | { error: PlacementError } {
    if (!this.simultaneous) {
      const next = this.getNextToPlace();
      if (!next) {
        return { error: PlacementError.PlacementComplete };
      }
      const playerPokemon = this.availableByPlayer.get(next.playerId) ?? [];
      if (!playerPokemon.includes(pokemonId)) {
        return { error: PlacementError.WrongPlayer };
      }
      return { playerId: next.playerId };
    }

    const owner = this.ownerByPokemonId.get(pokemonId);
    if (owner === undefined) {
      return { error: PlacementError.WrongPlayer };
    }
    // `isPlayerDone` couvre les deux façons d'avoir fini : s'être déclaré prêt, ou avoir atteint la
    // taille d'équipe du format.
    if (this.isPlayerDone(owner)) {
      return { error: PlacementError.PlayerAlreadyDone };
    }
    return { playerId: owner };
  }

  /**
   * Les poses dans leur ORDRE CANONIQUE : par index de camp croissant, puis par ordre de pose à
   * l'intérieur d'un camp.
   *
   * 🔴 Le point le plus important du plan 211. Cette liste fixe l'ordre d'itération de
   * `createBattleFromPlacements`, donc l'ordre de construction des Pokemon dans le moteur, donc
   * l'empreinte d'état comparée entre pairs au lancement. En simultané, les poses ARRIVENT dans un
   * ordre qui dépend du réseau et de la vitesse de chacun : rendre l'ordre d'insertion ferait
   * diverger deux machines qui ont pourtant reçu exactement les mêmes poses.
   *
   * Le tri est stable, donc l'ordre de pose d'un camp est préservé tel quel.
   *
   * 🔴 **Simultané SEULEMENT**, et c'est une correction de revue de code. Trier partout changeait
   * aussi les parties locales : `createBattleFromPlacements` consomme son générateur de création
   * dans l'ordre de cette liste (genre, nature), donc le serpentin (P1,P2,P2,P1) devenu
   * (P1,P1,P2,P2) faisait tirer d'autres genres à graine égale — une capture d'intro censée être
   * reproductible ne l'aurait plus été. Et le tri n'a aucune utilité hors simultané : en hot-seat il
   * n'y a qu'une machine, et en placement automatique les deux pairs tirent sur la même graine, donc
   * leur ordre d'insertion est déjà identique. Seul le simultané reçoit les poses dans un ordre qui
   * dépend du réseau.
   */
  getPlacements(): PlacementEntry[] {
    if (!this.simultaneous) {
      return [...this.placements];
    }
    return [...this.placements].sort(
      (a, b) => this.teamIndexOf(a.pokemonId) - this.teamIndexOf(b.pokemonId),
    );
  }

  /**
   * La dernière pose dans l'ordre CHRONOLOGIQUE — celle du joueur nommé quand on en nomme un.
   *
   * 🔴 À ne pas confondre avec la dernière entrée de `getPlacements()`, qui rend l'ordre canonique
   * (groupé par camp) et dont le dernier élément appartient donc toujours au dernier camp. C'est
   * celle-ci qu'il faut pour annuler : « défaire ce que je viens de faire » est une notion
   * chronologique, pas un rang dans une liste triée.
   */
  getLastPlacement(playerId?: PlayerId): PlacementEntry | null {
    for (let i = this.placements.length - 1; i >= 0; i--) {
      const entry = this.placements[i];
      if (!entry) {
        continue;
      }
      if (playerId === undefined || this.ownerByPokemonId.get(entry.pokemonId) === playerId) {
        return entry;
      }
    }
    return null;
  }

  private teamIndexOf(pokemonId: string): number {
    const owner = this.ownerByPokemonId.get(pokemonId);
    return owner === undefined ? -1 : (this.teamIndexByPlayer.get(owner) ?? -1);
  }

  getPlacedPositions(): Position[] {
    return this.placements.map((entry) => entry.position);
  }

  submitPlacement(pokemonId: string, position: Position, direction: Direction): PlacementResult {
    const owner = this.resolvePlacingPlayer(pokemonId);
    if ("error" in owner) {
      return { success: false, error: owner.error };
    }
    const playerId = owner.playerId;

    if (this.placedPokemonIds.has(pokemonId)) {
      return { success: false, error: PlacementError.PokemonAlreadyPlaced };
    }

    const placedForPlayer = this.placedByPlayer.get(playerId) ?? [];

    const positionKey = `${position.x},${position.y}`;
    const playerZone = this.zonesByPlayer.get(playerId);
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

  /**
   * Annule la dernière pose — celle du joueur nommé quand on en nomme un.
   *
   * `playerId` est indispensable en simultané : la dernière pose tout court peut être celle d'un
   * autre camp, arrivée par le réseau entre deux de mes gestes. Sans lui, annuler défairait la pose
   * de quelqu'un d'autre. Omis, on retombe sur l'ancien comportement — la dernière pose, quelle
   * qu'elle soit — qui reste le bon en hot-seat local.
   */
  undoLastPlacement(playerId?: PlayerId): boolean {
    if (this.placements.length === 0) {
      return false;
    }

    // Boucle à la main plutôt que `findLastIndex` : la cible de compilation du paquet est antérieure
    // à ES2023, et l'ajouter pour une recherche à rebours ne vaut pas le changement.
    let index = -1;
    if (playerId === undefined) {
      index = this.placements.length - 1;
    } else {
      for (let i = this.placements.length - 1; i >= 0; i--) {
        const entry = this.placements[i];
        if (entry && this.ownerByPokemonId.get(entry.pokemonId) === playerId) {
          index = i;
          break;
        }
      }
    }
    if (index < 0) {
      return false;
    }
    const [last] = this.placements.splice(index, 1);
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
  canUndo(playerId?: PlayerId): boolean {
    /*
     * En SIMULTANÉ, la règle anti-réaction ci-dessus n'a plus d'objet : le placement est caché, donc
     * une pose adverse ne m'apprend rien et ne peut pas me faire changer d'avis. Chacun reste maître
     * de ses propres poses tant qu'il n'a pas fini.
     */
    if (this.simultaneous) {
      if (playerId === undefined) {
        return false;
      }
      if (this.isPlayerDone(playerId)) {
        return false;
      }
      return (this.placedByPlayer.get(playerId) ?? []).length > 0;
    }

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

  /**
   * Pose d'office ce qu'il reste à un joueur — l'IA au placement, et le repli du chrono en ligne
   * (plan 211) quand sa fenêtre expire avec des Pokemon non posés.
   *
   * En simultané on ne consulte PAS le tour courant : il n'y en a pas, et un joueur doit pouvoir
   * être servi sans que ce soit « à lui ».
   *
   * 🔴 `random` remplace le générateur de la phase **pour ce seul appel**, et c'est indispensable en
   * ligne : le générateur interne avance à chaque tirage, donc son état dépend de ce que CETTE
   * machine a déjà tiré. Deux pairs qui posent le même camp d'IA à des moments différents de leur
   * propre placement obtiendraient deux dispositions — donc deux états, donc une divergence. Un
   * générateur dérivé de la place, passé ici, rend la pose reproductible partout.
   */
  autoPlaceForPlayer(
    playerId: PlayerId,
    gridCenter: Position,
    random?: () => number,
  ): PlacementEntry[] {
    const placed: PlacementEntry[] = [];
    while (!this.isPlayerDone(playerId)) {
      if (!this.simultaneous) {
        const next = this.getNextToPlace();
        if (!next || next.playerId !== playerId) {
          break;
        }
      }
      const unplaced = this.getUnplacedPokemonIds(playerId);
      const firstUnplaced = unplaced[0];
      if (!firstUnplaced) {
        break;
      }
      const entry = this.autoPlaceOne(playerId, firstUnplaced, gridCenter, random);
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
    random?: () => number,
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

    const index = Math.floor((random ?? this.random)() * available.length);
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
