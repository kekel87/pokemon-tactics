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
import type {
  CombatPokemonHandle,
  CombatScene,
  DirectionPickerHandle,
  SpawnZoneHighlight,
} from "@pokemon-tactic/render-ports";
import {
  PlacementRoster,
  type PlacementRosterEntry,
  type UiDomConfig,
} from "@pokemon-tactic/ui-dom";
import {
  TEAM_COLORS,
  TILE_SPAWN_ZONE_ALPHA,
  TILE_SPAWN_ZONE_INACTIVE_ALPHA,
  TILE_SPAWN_ZONE_INACTIVE_COLOR,
  TILE_SPAWN_ZONE_OCCUPIED_ALPHA,
} from "../constants.js";
import { getLanguage, t } from "../i18n/index.js";
import type { TranslationKey } from "../i18n/types.js";
import { InputSource } from "../input/input-source.js";
import { getInputSystem } from "../input/input-system.js";
import { cameraKeyLabels } from "../input/key-legend.js";
import {
  getCategoryIconUrl,
  getCursorSheetUrl,
  getInputPromptSheetUrl,
  getTypeIconUrl,
  getWeatherIconUrl,
} from "../team/asset-paths.js";
import { getItemIconUrl, getPortraitUrl } from "../team/team-builder-data.js";

const PLACEMENT_UI_CONFIG: UiDomConfig = {
  translate: (key, params) => t(key as TranslationKey, params),
  getLanguage,
  getTypeIconUrl,
  getCategoryIconUrl,
  getWeatherIconUrl,
  getInputPromptSheetUrl,
  getCursorSheetUrl,
  getCameraKeyLabels: cameraKeyLabels,
  getPortraitUrl,
  getItemIconUrl,
};

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
  /**
   * Ouvrir le menu de combat de la phase de placement (plan 189). Fourni par `createCombatScreen`,
   * qui possède le `screenLayer` et les sorties — le flux, lui, ne fait que router l'entrée vers lui.
   * Absent au studio sandbox, qui n'a pas de phase de placement.
   */
  openCombatMenu?: () => boolean;
  onComplete: (result: PlacementResult) => void;
}

export interface PlacementFlow {
  dispose(): void;
}

/** Battle instance id ("p1-pikachu" or "p1-m0-pikachu") → sprite definition id ("pikachu"). */
function definitionIdOf(pokemonId: string): string {
  return pokemonId.replace(/^p\d+-(?:m\d+-)?/, "");
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
  const openCombatMenu = options.openCombatMenu;

  const placementTeams: PlacementTeam[] = teams.map((selection, index) => ({
    playerId: selection.playerId,
    availablePokemonIds: selection.pokemonDefinitionIds.map(
      (definitionId) => `p${index + 1}-${definitionId}`,
    ),
    controller: selection.controller,
  }));
  const phase = new PlacementPhase(map, placementTeams, format, PlacementMode.Alternating);
  const gridCenter: Position = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };

  const roster = new PlacementRoster(PLACEMENT_UI_CONFIG);
  host.appendChild(roster.element);

  const handleByPokemonId = new Map<string, CombatPokemonHandle>();
  let picker: DirectionPickerHandle | null = null;
  let selectedPokemonId: string | null = null;
  let placing = true;
  /**
   * Étape courante du placement au clavier / à la manette (plan 184, retour humain 2026-08-21) :
   * on CHOISIT un Pokemon, puis on le PLACE, puis on l'oriente. Les mêmes flèches servent les deux
   * premières étapes selon l'étape en cours, plutôt que d'ajouter une touche pour parcourir le
   * roster — et Annuler remonte d'un cran au lieu de défaire tout de suite.
   *
   * Sans objet au pointeur : la souris désigne directement l'entrée du roster ou la case.
   */
  let keyboardStep: "roster" | "board" = "roster";

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

  /**
   * Pose le curseur sur une case libre de la zone de spawn quand le joueur navigue au clavier ou à la
   * manette (plan 184, retour humain 2026-08-21).
   *
   * Sans ça le placement était injouable sans souris : le curseur clavier part de « la case que la
   * caméra a centrée », or ce recentrage est fait par l'orchestrateur de combat — qui n'existe pas
   * encore pendant le placement. Il n'y avait donc aucune origine, et les flèches ne faisaient rien.
   * Au pointeur, on ne touche à rien : le curseur suit la souris dès le premier mouvement.
   */
  function seedCursorInSpawnZone(activeTeamIndex: number): void {
    if (getInputSystem()?.tracker.isFocusDriven() !== true || combat.cursorTile() !== null) {
      return;
    }
    const occupied = new Set(phase.getPlacedPositions().map((p) => `${p.x},${p.y}`));
    const free = format.spawnZones[activeTeamIndex]?.positions.find(
      (position) => !occupied.has(`${position.x},${position.y}`),
    );
    if (free) {
      combat.setCursor({ x: free.x, y: free.y });
    }
  }

  /**
   * Passe au Pokemon suivant / précédent à placer (plan 184, retour humain 2026-08-21).
   *
   * Appelé par les flèches pendant l'étape « choix du Pokemon » (voir `keyboardStep`) : pas de touche
   * dédiée à ajouter, c'est l'étape qui décide de ce que la flèche parcourt.
   */
  function cycleRosterSelection(delta: 1 | -1): void {
    const next = phase.getNextToPlace();
    if (!placing || !next) {
      return;
    }
    const unplaced = phase.getUnplacedPokemonIds(next.playerId);
    if (unplaced.length === 0) {
      return;
    }
    const index = selectedPokemonId === null ? -1 : unplaced.indexOf(selectedPokemonId);
    selectedPokemonId =
      unplaced[(index + delta + unplaced.length) % unplaced.length] ?? unplaced[0] ?? null;
    const teamIndex = placementTeams.findIndex((candidate) => candidate.playerId === next.playerId);
    showRoster(
      next.playerId,
      teamIndex,
      placementTeams.find((candidate) => candidate.playerId === next.playerId),
    );
  }

  /**
   * Repasse à l'étape « choix du Pokemon » et MASQUE le curseur de case : rien n'est piloté sur le
   * plateau à ce moment-là, et le laisser affiché laissait croire le contraire (humain 2026-08-21).
   * Le curseur sera reposé sur une case libre de la zone au passage à l'étape suivante.
   */
  function enterRosterStep(): void {
    keyboardStep = "roster";
    combat.pinCursor(null);
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
    enterRosterStep();
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

  /**
   * Renvoie ce qu'il a réellement défait (plan 189) : sans cette réponse, *Annuler* était avalé même
   * quand il n'y avait rien à annuler, et le menu de combat — qui s'ouvre sur un `Échap` sans emploi,
   * comme en combat — ne pouvait jamais s'atteindre au clavier pendant cette phase.
   */
  function undoLastPlacement(): boolean {
    // Anti-cheat (core `canUndo`): only undo while the opponent hasn't placed
    // since — i.e. the current player's placement is still the most recent one.
    if (!phase.canUndo()) {
      return false;
    }
    const last = phase.getPlacements().at(-1);
    if (!last || !phase.removePlacement(last.pokemonId).success) {
      return false;
    }
    const handle = handleByPokemonId.get(last.pokemonId);
    if (handle) {
      combat.removePokemon(handle);
      handleByPokemonId.delete(last.pokemonId);
    }
    enterPlacement();
    return true;
  }

  function finish(): void {
    placing = false;
    roster.hide();
    combat.setSpawnZoneHighlights([]);
    unregisterInput?.();
    onComplete({ placements: phase.getPlacements(), placementTeams, handles: handleByPokemonId });
  }

  /**
   * Placement is a board context of its own (plan 184): the arrows drive the same tile cursor as in
   * battle, Confirm places, Cancel undoes. It never coexists with the battle orchestrator — `finish()`
   * unregisters before the battle starts — which is what keeps "one consumer per action" true without
   * any priority to arbitrate.
   */
  const unregisterInput = getInputSystem()?.register({
    // L'étape « choix du Pokemon » EST une étape de menu : les flèches y parcourent une liste et
    // doivent pouvoir atteindre « Terminer » (retour humain 2026-08-21). L'étape « placement », elle,
    // pilote le plateau. Le contexte suit donc l'étape.
    context: () => (keyboardStep === "roster" ? "menu" : "board"),
    menu: {
      // Roster horizontal : ← → parcourent les Pokemon (les flèches suivent ce qu'on voit).
      // ↓ descend sur « Terminer » quand il est proposé, ↑ le quitte.
      focusMove: (direction) => {
        if (direction === "left") {
          cycleRosterSelection(-1);
        } else if (direction === "right") {
          cycleRosterSelection(1);
        } else if (direction === "down") {
          roster.focusFinish();
        } else {
          roster.blurFinish();
        }
      },
      confirm: () => {
        // « Terminer » focalisé : au clavier le navigateur l'active lui-même, à la manette il faut
        // le cliquer nous-mêmes (un appui de pad n'est pas un événement clavier).
        if (roster.isFinishFocused()) {
          if (getInputSystem()?.tracker.current() === InputSource.Gamepad) {
            roster.activateFinish();
            return true;
          }
          return false;
        }
        const next = phase.getNextToPlace();
        if (!placing || !next || selectedPokemonId === null) {
          return false;
        }
        // Pokemon choisi → on passe au plateau, curseur posé sur une case libre de la zone.
        keyboardStep = "board";
        seedCursorInSpawnZone(
          placementTeams.findIndex((candidate) => candidate.playerId === next.playerId),
        );
        return true;
      },
      cancel: () => {
        if (!placing) {
          return false;
        }
        // `Échap` défait d'abord ; quand il n'a rien à défaire il ouvre le menu (plan 189), exactement
        // comme `orchestrator.onEscape() || combatMenu.open()` en combat. Le chaînage est ICI et pas
        // dans le routeur : c'est le consommateur qui sait ce qu'il avait à annuler.
        return undoLastPlacement() || (openCombatMenu?.() ?? false);
      },
    },
    board: {
      moveCursor: (direction) => {
        // Le sélecteur d'orientation ouvert prend la flèche en premier : on y choisit une direction.
        if (!combat.aimDirectionPicker(direction)) {
          combat.moveCursor(direction);
        }
      },
      confirmCursorTile: () => {
        // Placement answers the facing picker the same way a battle turn does — and it is the ONLY
        // way to finish a placement, so without it no Pokémon could be placed by keyboard at all.
        if (combat.confirmDirectionPicker()) {
          return true;
        }
        if (!placing) {
          return false;
        }
        const tile = combat.cursorTile();
        if (!tile) {
          return false;
        }
        handleTileClick(tile.x, tile.y);
        return true;
      },
      cancel: () => {
        // An open facing picker gets first refusal: cancelling the facing must not also undo the
        // placement underneath it (what the old `picker === null` guard did, in reverse).
        if (combat.cancelDirectionPicker()) {
          return true;
        }
        if (!placing) {
          return false;
        }
        // Sur le plateau, Annuler remonte au choix du Pokemon — il ne défait pas un placement qu'on
        // n'a pas encore fait (retour humain 2026-08-21). Défaire, c'est Annuler à l'étape d'avant.
        //
        // Pas de repli vers le menu de combat ICI : le contexte vaut `board` exactement quand
        // `keyboardStep === "board"`, donc ce consommateur a toujours quelque chose à remonter. Le
        // menu s'ouvre depuis l'étape du roster, où `Échap` peut réellement n'avoir rien à défaire.
        enterRosterStep();
        return true;
      },
      cycleTarget: () => false,
      rotateCamera: (step) => combat.rotateCamera(step),
      panCamera: (deltaX, deltaY) => combat.panCameraByPixels(deltaX, deltaY),
      zoomCamera: (step) => combat.zoomCamera(step),
      setZoomLevel: (index) => combat.setZoomLevel(index),
      scrollLog: () => undefined,
      toggleLog: () => undefined,
      scrollTimeline: () => undefined,
      // Le menu de combat existe désormais pendant le placement (plan 189) : `createCombatScreen`
      // monte sa propre instance — variante `placement`, sans « Abandonner » faute de sauvegarde à
      // purger — et nous passe son ouverture. Le trou signalé par le plan 187 est refermé.
      openCombatMenu: () => openCombatMenu?.() ?? false,
    },
  });
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
      unregisterInput?.();
      picker?.dispose();
      picker = null;
      roster.destroy();
    },
  };
}
