import {
  type Direction,
  directionFromTo,
  type MapDefinition,
  type MapFormat,
  type PlacementEntry,
  PlacementMode,
  PlacementPhase,
  type PlacementTeam,
  PlayerController,
  type PlayerId,
  type Position,
  type TeamSelection,
} from "@pokemon-tactic/core";
import {
  TEAM_COLORS,
  TILE_SPAWN_ZONE_ALPHA,
  TILE_SPAWN_ZONE_INACTIVE_ALPHA,
  TILE_SPAWN_ZONE_INACTIVE_COLOR,
  TILE_SPAWN_ZONE_OCCUPIED_ALPHA,
} from "../constants.js";
import { PlacementRoster, type PlacementRosterEntry } from "../ui/dom/combat/placement-roster.js";
import type { SpawnZoneHighlight } from "./babylon-tile-highlights.js";
import type { CombatPokemonHandle, CombatScene, DirectionPickerHandle } from "./combat-scene.js";

/** Everything the battle loop needs to build its engine from the finished placement. */
export interface PlacementResult {
  placements: PlacementEntry[];
  /** Resolved teams (playerId + `p{n}-…` ids + controller) for `createBattleFromPlacements`. */
  placementTeams: PlacementTeam[];
  /** Live billboards keyed by core instance id ("p1-pikachu") — handed to the BoardView. */
  handles: Map<string, CombatPokemonHandle>;
}

export interface PlacementFlowOptions {
  combat: CombatScene;
  map: MapDefinition;
  format: MapFormat;
  teams: TeamSelection[];
  /** Team-select option: place every Pokemon at random and skip the interactive phase. */
  autoPlacement: boolean;
  /** DOM layer over the canvas (game-stage screenLayer) hosting roster + picker. */
  host: HTMLElement;
  onComplete: (result: PlacementResult) => void;
}

export interface PlacementFlow {
  dispose(): void;
}

/** Battle instance id ("p1-pikachu") → sprite definition id ("pikachu"). */
function definitionIdOf(pokemonId: string): string {
  return pokemonId.replace(/^p\d+-/, "");
}

/**
 * Interactive placement phase on the Babylon combat scene (plan 120 step 6) —
 * DOM/Babylon port of the GameController `placement`/`placement_direction`
 * states. Drives the core `PlacementPhase` (alternating turns): humans pick a
 * roster Pokemon, click a spawn tile, choose a facing; AI players auto-place.
 * Escape undoes the last placement. Billboards stay on the field after
 * completion — the battle loop takes over at step 7.
 */
export function startPlacementFlow(options: PlacementFlowOptions): PlacementFlow {
  const { combat, map, format, teams, host, onComplete } = options;

  const placementTeams: PlacementTeam[] = teams.map((selection, index) => ({
    playerId: selection.playerId,
    availablePokemonIds: selection.pokemonDefinitionIds.map(
      (definitionId) => `p${index + 1}-${definitionId}`,
    ),
    controller: selection.controller,
  }));
  const phase = new PlacementPhase(map, placementTeams, format, PlacementMode.Alternating);
  const gridCenter: Position = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };

  const roster = new PlacementRoster();
  host.appendChild(roster.element);

  const handleByPokemonId = new Map<string, CombatPokemonHandle>();
  let picker: DirectionPickerHandle | null = null;
  let selectedPokemonId: string | null = null;
  let placing = true;

  function ownerTeamNumberOf(pokemonId: string): number {
    const match = pokemonId.match(/^p(\d+)-/);
    return match?.[1] ? Number(match[1]) : 1;
  }

  function addBillboard(entry: PlacementEntry): void {
    const handle = combat.addPokemon({
      pokemonId: definitionIdOf(entry.pokemonId),
      spawn: entry.position,
      team: ownerTeamNumberOf(entry.pokemonId),
    });
    handle.setFacing(entry.direction);
    handleByPokemonId.set(entry.pokemonId, handle);
  }

  function refreshSpawnZones(activeTeamIndex: number): void {
    const occupiedKeys = new Set(phase.getPlacedPositions().map((p) => `${p.x},${p.y}`));
    const zones: SpawnZoneHighlight[] = [];
    for (let i = 0; i < format.spawnZones.length; i++) {
      const zone = format.spawnZones[i];
      if (!zone) {
        continue;
      }
      const color = TEAM_COLORS[i] ?? TILE_SPAWN_ZONE_INACTIVE_COLOR;
      const free = zone.positions.filter((p) => !occupiedKeys.has(`${p.x},${p.y}`));
      const occupied = zone.positions.filter((p) => occupiedKeys.has(`${p.x},${p.y}`));
      zones.push({
        positions: free,
        color,
        alpha: i === activeTeamIndex ? TILE_SPAWN_ZONE_ALPHA : TILE_SPAWN_ZONE_INACTIVE_ALPHA,
      });
      if (occupied.length > 0) {
        zones.push({ positions: occupied, color, alpha: TILE_SPAWN_ZONE_OCCUPIED_ALPHA });
      }
    }
    combat.setSpawnZoneHighlights(zones);
  }

  function enterPlacement(): void {
    if (!placing) {
      return;
    }
    const next = phase.getNextToPlace();
    if (!next) {
      finish();
      return;
    }

    const team = placementTeams.find((candidate) => candidate.playerId === next.playerId);
    if (team?.controller === PlayerController.Ai) {
      const placed = phase.autoPlaceForPlayer(next.playerId, gridCenter);
      for (const entry of placed) {
        addBillboard(entry);
      }
      if (placed.length === 0) {
        // AI ran out of free tiles in its zone — finish it instead of looping.
        if (!phase.canFinishPlayer(next.playerId)) {
          finish();
          return;
        }
        phase.finishPlayer(next.playerId);
      }
      enterPlacement();
      return;
    }

    const teamIndex = placementTeams.findIndex((candidate) => candidate.playerId === next.playerId);
    refreshSpawnZones(teamIndex);

    const unplaced = phase.getUnplacedPokemonIds(next.playerId);
    selectedPokemonId = unplaced[0] ?? null;
    showRoster(next.playerId, teamIndex, team);
  }

  function showRoster(
    playerId: PlayerId,
    teamIndex: number,
    team: PlacementTeam | undefined,
  ): void {
    const rosterEntries: PlacementRosterEntry[] = (team?.availablePokemonIds ?? []).map(
      (pokemonId) => ({
        pokemonId,
        definitionId: definitionIdOf(pokemonId),
        placed: phase.getPlacements().some((entry) => entry.pokemonId === pokemonId),
      }),
    );
    const canFinish = phase.canFinishPlayer(playerId);
    roster.show(
      {
        playerId,
        teamIndex,
        roster: rosterEntries,
        selectedPokemonId,
        maxPokemon: format.maxPokemonPerTeam,
      },
      {
        onSelect: (pokemonId) => {
          selectedPokemonId = pokemonId;
          showRoster(playerId, teamIndex, team);
        },
        ...(canFinish ? { onFinish: () => finishCurrentPlayer() } : {}),
      },
    );
  }

  function finishCurrentPlayer(): void {
    const next = phase.getNextToPlace();
    if (!next) {
      return;
    }
    const result = phase.finishPlayer(next.playerId);
    if (!result.success) {
      return;
    }
    if (phase.isComplete()) {
      finish();
      return;
    }
    enterPlacement();
  }

  function handleTileClick(x: number, y: number): void {
    if (!placing || picker !== null || selectedPokemonId === null) {
      return;
    }
    const next = phase.getNextToPlace();
    if (!next) {
      return;
    }
    const teamIndex = placementTeams.findIndex((candidate) => candidate.playerId === next.playerId);
    const zone = format.spawnZones[teamIndex];
    if (!zone?.positions.some((p) => p.x === x && p.y === y)) {
      return;
    }
    if (phase.getPlacedPositions().some((p) => p.x === x && p.y === y)) {
      return;
    }
    enterDirection(selectedPokemonId, { x, y });
  }

  function enterDirection(pokemonId: string, position: Position): void {
    const initialDirection = directionFromTo(position, gridCenter);
    const tempHandle = combat.addPokemon({
      pokemonId: definitionIdOf(pokemonId),
      spawn: position,
      team: ownerTeamNumberOf(pokemonId),
    });
    tempHandle.setFacing(initialDirection);

    // In-scene picker (décision #487): four arrows laid flat on the neighbour
    // tiles. Being real meshes they follow the camera rotation/zoom/resize — the
    // DOM overlay it replaces projected once and drifted.
    picker = combat.showDirectionPicker(position, initialDirection, {
      onPreview: (direction) => tempHandle.setFacing(direction),
      onConfirm: (direction) => confirmPlacement(pokemonId, position, direction, tempHandle),
      onCancel: () => {
        picker = null;
        combat.removePokemon(tempHandle);
        enterPlacement();
      },
    });
  }

  function confirmPlacement(
    pokemonId: string,
    position: Position,
    direction: Direction,
    tempHandle: CombatPokemonHandle,
  ): void {
    picker = null;
    const result = phase.submitPlacement(pokemonId, position, direction);
    if (!result.success) {
      combat.removePokemon(tempHandle);
      enterPlacement();
      return;
    }
    tempHandle.setFacing(direction);
    handleByPokemonId.set(pokemonId, tempHandle);
    enterPlacement();
  }

  function undoLastPlacement(): void {
    // Anti-cheat (core `canUndo`): only undo while the opponent hasn't placed
    // since — i.e. the current player's placement is still the most recent one.
    if (!phase.canUndo()) {
      return;
    }
    const last = phase.getPlacements().at(-1);
    if (!last || !phase.removePlacement(last.pokemonId).success) {
      return;
    }
    const handle = handleByPokemonId.get(last.pokemonId);
    if (handle) {
      combat.removePokemon(handle);
      handleByPokemonId.delete(last.pokemonId);
    }
    enterPlacement();
  }

  function finish(): void {
    placing = false;
    roster.hide();
    combat.setSpawnZoneHighlights([]);
    window.removeEventListener("keydown", onKeyDown);
    onComplete({ placements: phase.getPlacements(), placementTeams, handles: handleByPokemonId });
  }

  // Escape = undo (placement only — an open direction picker swallows it first).
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && placing && picker === null) {
      undoLastPlacement();
    }
  };
  window.addEventListener("keydown", onKeyDown);
  combat.onTileClick((pick) => handleTileClick(pick.x, pick.y));

  if (options.autoPlacement) {
    const placements = phase.autoPlaceAll(gridCenter);
    for (const entry of placements) {
      addBillboard(entry);
    }
    finish();
  } else {
    enterPlacement();
  }

  return {
    dispose: () => {
      placing = false;
      window.removeEventListener("keydown", onKeyDown);
      picker?.dispose();
      picker = null;
      roster.destroy();
    },
  };
}
