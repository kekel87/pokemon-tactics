import {
  createPrng,
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
import { countAction, TelemetryAction } from "../analytics/telemetry.js";
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
import { playerLabel } from "../ui/team-select/slot-state.js";

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
  /**
   * Le seed qui a servi au placement, rendu pour que le combat prenne le MÊME.
   *
   * Une seule source d'entropie par partie, placement compris — c'est ce que le commentaire de
   * `startBattleLoop` promettait déjà, alors que le placement tirait en réalité sur `Math.random`.
   */
  seed: number;
}

export interface PlacementFlowOptions {
  combat: CombatScene;
  map: MapDefinition;
  format: MapFormat;
  teams: TeamSelection[];
  /** Team-select option: place every Pokemon at random and skip the interactive phase. */
  autoPlacement: boolean;
  /**
   * Seed du tirage de placement.
   *
   * Sans lui, `PlacementPhase` retombe sur `Math.random` (`randomSeed == null ? Math.random : …`) et
   * les douze Pokemon se posent sur d'autres cases à chaque partie. Invisible en jeu, fatal pour une
   * capture reproductible : les distances changent, donc le tour filmé change, donc tout le combat
   * change — à seed d'URL identique (plan 194, revue de code du 2026-08-28).
   */
  randomSeed: number;
  /** DOM layer over the canvas (game-stage screenLayer) hosting roster + picker. */
  host: HTMLElement;
  /**
   * Ouvrir le menu de combat de la phase de placement (plan 189). Fourni par `createCombatScreen`,
   * qui possède le `screenLayer` et les sorties — le flux, lui, ne fait que router l'entrée vers lui.
   * Absent au studio sandbox, qui n'a pas de phase de placement.
   */
  openCombatMenu?: () => boolean;
  onComplete: (result: PlacementResult) => void;
  /**
   * Le placement EN LIGNE (plan 211). Absent en hot-seat local, qui garde l'alternance en serpentin.
   *
   * Sa présence bascule toute la phase : le flux ne pilote plus que le camp local, ne montre rien des
   * autres, et attend leurs poses par le réseau au lieu de les faire jouer sur cet écran. Le défaut
   * que ce plan répare venait précisément de son absence — la phase ne savait pas qu'une partie
   * pouvait être en ligne, donc elle faisait poser les deux camps sur chaque machine.
   */
  online?: PlacementNetwork;
}

/** Les poses d'un camp, telles qu'elles voyagent (plan 211). */
export interface RemotePlacement {
  seat: number;
  placements: readonly PlacementEntry[];
}

export interface PlacementNetwork {
  /** Notre place, de 1 à N — l'index dans `teams` vaut `localSeat - 1`. */
  localSeat: number;
  /** Diffuse notre placement terminé, en un envoi. */
  publishPlacement: (placements: readonly PlacementEntry[]) => void;
  /** S'abonne aux placements des autres camps. Rend le désabonnement. */
  subscribeToPlacements: (listener: (remote: RemotePlacement) => void) => () => void;
  /**
   * Un camp s'est tu et son délai de grâce est écoulé, pendant le placement (plan 211, Lot E4).
   *
   * 🔴 Le trou trouvé en écrivant ce lot : le chien de garde du salon TOURNE déjà pendant le
   * placement (`locked` est posé dès le lancement, et la migration d'hôte avec), mais personne ne
   * l'écoutait — `wireOnlineBattle` ne se branche qu'une fois le combat monté. Un pair qui partait
   * pendant le placement laissait donc les autres attendre **indéfiniment** un placement qui ne
   * viendrait jamais : le chrono ne pose que ses propres Pokemon, jamais ceux d'un absent.
   */
  subscribeToPeerAbsent: (listener: (seat: number) => void) => () => void;

  /**
   * Durée de la fenêtre de placement, pour tout le monde et pour toute la phase.
   *
   * 🔴 Une valeur PARTAGÉE, au même titre que `NETWORK_VERSION` : un pair qui compterait 60 s là où
   * l'autre en compte 90 verrait le sien expirer sans raison.
   */
  windowMs: number;
  /**
   * Publie le temps restant vers le chrome, qui l'affiche en haut de l'écran (plan 211).
   *
   * 🔴 Le compteur doit être visible **pendant qu'on pose**, pas seulement une fois qu'on a fini —
   * retour humain à la recette du 2026-09-15. Il ne vivait d'abord que dans le récapitulatif
   * d'attente, donc on ne le découvrait qu'au moment où il ne servait plus à rien.
   *
   * `null` le masque, comme en combat.
   */
  publishClock: (view: { remainingMs: number; durationMs: number } | null) => void;
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
  const online = options.online;
  const phase = new PlacementPhase(
    map,
    placementTeams,
    format,
    online === undefined ? PlacementMode.Alternating : PlacementMode.Simultaneous,
    options.randomSeed,
  );
  /**
   * Le camp que CETTE machine pilote — `null` en hot-seat, où l'écran les pilote tous à tour de rôle.
   *
   * C'est la pièce qui manquait à toute la phase : sans elle, « à qui le tour » et « qui suis-je »
   * étaient la même question, et en ligne la réponse était « les deux camps » sur chaque écran.
   */
  const localPlayerId: PlayerId | null = resolveLocalPlayerId();

  /**
   * Le camp local, ou `null` en hot-seat.
   *
   * 🔴 **Jette plutôt que de dégrader** quand la place ne désigne aucun camp : la phase a déjà été
   * construite en `Simultaneous`, donc retomber sur `null` ferait repasser `activePlayer()` par le
   * tour courant et `submitPlacement` accepterait n'importe quel propriétaire — les deux camps
   * posables sur cet écran, c'est-à-dire le bug d'origine à l'identique. Relevé en revue de code :
   * un repli silencieux qui réactive le défaut qu'on répare est pire que l'absence de repli.
   */
  function resolveLocalPlayerId(): PlayerId | null {
    if (online === undefined) {
      return null;
    }
    const playerId = placementTeams[online.localSeat - 1]?.playerId;
    if (playerId === undefined) {
      throw new Error(
        `placement en ligne : la place ${online.localSeat} ne désigne aucun camp parmi ${placementTeams.length}`,
      );
    }
    return playerId;
  }
  /** Places dont le placement est arrivé et déjà appliqué — sert au récapitulatif. */
  const seatsDone = new Set<number>();
  /** Places parties avant d'avoir posé : la partie ne pourra pas commencer (Lot E4). */
  const seatsLost = new Set<number>();
  let waitingPanel: HTMLElement | null = null;
  let windowTimer: ReturnType<typeof setInterval> | null = null;
  let windowDeadlineMs: number | null = null;
  let unsubscribeFromPlacements: (() => void) | null = null;
  let unsubscribeFromPeerAbsent: (() => void) | null = null;
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

  /**
   * Le camp que l'écran doit faire jouer maintenant, ou `null` s'il n'y a plus rien à poser ICI.
   *
   * 🔴 Remplace partout `phase.getNextToPlace()`, et c'est tout le sujet du plan 211. En hot-seat, la
   * réponse est bien « celui dont c'est le tour ». En ligne, c'est **toujours le camp local**, tant
   * qu'il n'a pas fini — les autres jouent sur leur propre écran, et rien ne doit les faire poser
   * ici. Confondre les deux, c'est exactement le défaut qu'on répare.
   */
  function activePlayer(): PlayerId | null {
    if (localPlayerId === null) {
      return phase.getNextToPlace()?.playerId ?? null;
    }
    return phase.isPlayerDone(localPlayerId) ? null : localPlayerId;
  }

  function teamIndexOfPlayer(playerId: PlayerId): number {
    return placementTeams.findIndex((candidate) => candidate.playerId === playerId);
  }

  /**
   * Les Pokemon de ce camp sont-ils visibles sur le plateau ?
   *
   * En ligne, le placement est CACHÉ jusqu'au lancement : on ne montre que son propre camp, et les
   * autres apparaissent d'un coup à la révélation. Sans ça, les poses reçues par le réseau
   * s'afficheraient au fur et à mesure et la promesse « personne ne voit le placement d'en face »
   * serait fausse dès le premier camp qui finit.
   */
  function isVisibleTeam(playerId: PlayerId): boolean {
    return localPlayerId === null || playerId === localPlayerId;
  }

  function ownerPlayerIdOf(pokemonId: string): PlayerId | null {
    const teamNumber = ownerTeamNumberOf(pokemonId);
    return placementTeams[teamNumber - 1]?.playerId ?? null;
  }

  function ownerTeamNumberOf(pokemonId: string): number {
    const match = pokemonId.match(/^p(\d+)-/);
    return match?.[1] ? Number(match[1]) : 1;
  }

  function addBillboard(entry: PlacementEntry): void {
    const owner = ownerPlayerIdOf(entry.pokemonId);
    if (owner !== null && !isVisibleTeam(owner)) {
      // Posé dans le moteur, pas à l'écran : il apparaîtra à la révélation (voir `revealAllTeams`).
      return;
    }
    const handle = combat.addPokemon({
      pokemonId: definitionIdOf(entry.pokemonId),
      spawn: entry.position,
      team: ownerTeamNumberOf(entry.pokemonId),
    });
    handle.setFacing(entry.direction);
    handleByPokemonId.set(entry.pokemonId, handle);
  }

  function refreshSpawnZones(activeTeamIndex: number): void {
    /*
     * 🔴 En ligne, seules MES cases occupées comptent. Mettre en évidence celles des autres dirait
     * exactement ce que le placement caché s'engage à taire : combien l'adversaire a posé, et où.
     * Les zones elles-mêmes restent visibles — c'est de la géographie de carte, connue de tous avant
     * même le lancement.
     */
    const visiblePlacements = phase
      .getPlacements()
      .filter((entry) => {
        const owner = ownerPlayerIdOf(entry.pokemonId);
        return owner === null || isVisibleTeam(owner);
      })
      .map((entry) => entry.position);
    const occupiedKeys = new Set(visiblePlacements.map((p) => `${p.x},${p.y}`));
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
    const activeId = activePlayer();
    if (!placing || activeId === null) {
      return;
    }
    const unplaced = phase.getUnplacedPokemonIds(activeId);
    if (unplaced.length === 0) {
      return;
    }
    const index = selectedPokemonId === null ? -1 : unplaced.indexOf(selectedPokemonId);
    selectedPokemonId =
      unplaced[(index + delta + unplaced.length) % unplaced.length] ?? unplaced[0] ?? null;
    showRoster(
      activeId,
      teamIndexOfPlayer(activeId),
      placementTeams.find((candidate) => candidate.playerId === activeId),
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
    const activeId = activePlayer();
    if (activeId === null) {
      /*
       * Plus rien à poser ICI. En hot-seat, ça veut dire que la phase est finie. En ligne, ça veut
       * dire que MOI j'ai fini — les autres posent encore sur leur écran, et on les attend.
       */
      if (localPlayerId === null) {
        finish();
        return;
      }
      publishLocalPlacement();
      enterWaitingForOthers();
      /*
       * 🔴 Indispensable, et trouvé par l'e2e §11.14 : si je suis le DERNIER à finir, tous les
       * placements distants sont déjà arrivés, donc plus aucun message ne viendra déclencher le
       * départ. Sans cet appel, le joueur le plus lent restait bloqué sur l'écran d'attente pour
       * toujours — et les autres avec lui. Le cas ne se voit pas quand les deux finissent presque
       * ensemble, ce qui est précisément pourquoi il fallait un scénario où l'un finit franchement
       * après l'autre.
       */
      startBattleWhenEveryoneIsDone();
      return;
    }

    const team = placementTeams.find((candidate) => candidate.playerId === activeId);
    if (team?.controller === PlayerController.Ai) {
      const placed = phase.autoPlaceForPlayer(activeId, gridCenter);
      for (const entry of placed) {
        addBillboard(entry);
      }
      if (placed.length === 0) {
        // AI ran out of free tiles in its zone — finish it instead of looping.
        if (!phase.canFinishPlayer(activeId)) {
          finish();
          return;
        }
        phase.finishPlayer(activeId);
      }
      enterPlacement();
      return;
    }

    const teamIndex = teamIndexOfPlayer(activeId);
    refreshSpawnZones(teamIndex);

    const unplaced = phase.getUnplacedPokemonIds(activeId);
    selectedPokemonId = unplaced[0] ?? null;
    enterRosterStep();
    showRoster(activeId, teamIndex, team);
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
    const activeId = activePlayer();
    if (activeId === null) {
      return;
    }
    const result = phase.finishPlayer(activeId);
    if (!result.success) {
      return;
    }
    if (localPlayerId === null && phase.isComplete()) {
      finish();
      return;
    }
    enterPlacement();
  }

  function handleTileClick(x: number, y: number): void {
    if (!placing || picker !== null || selectedPokemonId === null) {
      return;
    }
    const activeId = activePlayer();
    if (activeId === null) {
      return;
    }
    const teamIndex = teamIndexOfPlayer(activeId);
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
    // En ligne la règle tombe d'elle-même : rien n'est visible, donc rien à quoi réagir.
    if (!phase.canUndo(localPlayerId ?? undefined)) {
      return false;
    }
    /*
     * 🔴 `getLastPlacement`, JAMAIS `getPlacements().at(-1)` : la seconde rend l'ordre canonique —
     * groupé par camp — donc son dernier élément appartient toujours au DERNIER camp, pas à celui
     * qui vient de poser. Annuler est une notion chronologique.
     */
    const last = phase.getLastPlacement(localPlayerId ?? undefined);
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

  /**
   * Le récapitulatif des joueurs prêts (plan 211, demandé par l'humain au cadrage).
   *
   * 🔴 Ce n'est pas un ornement : en simultané, **on ne peut pas savoir où en est la phase sans lui**.
   * Un joueur qui a fini de poser n'a plus rien qui bouge à l'écran ; sans ce panneau il ne sait pas
   * s'il attend quelqu'un, combien de monde, ni si le jeu est planté.
   *
   * Il dit l'ÉTAT, jamais le contenu : « place ses Pokemon » ou « Prêt », jamais une position ni un
   * nombre de Pokemon posés. « Il en est à 4 sur 6 » dirait déjà quelque chose du rythme d'en face,
   * et à douze camps ce serait une grille d'information gratuite.
   */
  function refreshWaitingPanel(): void {
    if (waitingPanel === null) {
      return;
    }
    const rows = waitingPanel.querySelector(".pw-seats");
    if (!(rows instanceof HTMLElement)) {
      return;
    }
    const title = waitingPanel.querySelector(".pw-title");
    if (title instanceof HTMLElement) {
      title.textContent =
        seatsLost.size > 0 ? t("placement.waiting.aborted") : t("placement.waiting.title");
      title.dataset.state = seatsLost.size > 0 ? "aborted" : "waiting";
    }
    rows.replaceChildren();
    for (const index of placementTeams.keys()) {
      const seat = index + 1;
      const done = seatsDone.has(seat);
      const lost = seatsLost.has(seat);
      const row = document.createElement("li");
      row.className = "pw-seat";
      row.dataset.state = lost ? "lost" : done ? "ready" : "placing";
      row.dataset.testid = `placement-waiting-seat-${seat}`;

      const dot = document.createElement("span");
      dot.className = "pw-dot";
      // Seule exception au « pas de style inline » : la couleur du camp vient de `TEAM_COLORS`, une
      // valeur par camp jusqu'à douze, que le CSS ne peut pas connaître sans recopier la table.
      dot.style.setProperty("--pw-team-color", teamColorOf(index));

      const name = document.createElement("span");
      name.className = "pw-name";
      const isSelf = online !== undefined && seat === online.localSeat;
      name.textContent = isSelf
        ? `${playerLabelOf(seat)} (${t("placement.waiting.you")})`
        : playerLabelOf(seat);

      const state = document.createElement("span");
      state.className = "pw-state";
      state.textContent = lost
        ? t("placement.waiting.lost")
        : done
          ? t("placement.waiting.ready")
          : t("placement.waiting.placing");

      row.append(dot, name, state);
      rows.append(row);
    }
  }

  /** Le nom du camp, tel que la salle d'attente l'écrit déjà — « Joueur 2 », pas « place 2 ». */
  function playerLabelOf(seat: number): string {
    return playerLabel(seat - 1);
  }

  function teamColorOf(index: number): string {
    const color = TEAM_COLORS[index] ?? TILE_SPAWN_ZONE_INACTIVE_COLOR;
    return `#${color.toString(16).padStart(6, "0")}`;
  }

  /**
   * L'écran d'attente : j'ai fini, les autres non.
   *
   * Le roster disparaît — il n'y a plus rien à poser — mais le menu du placement reste joignable, et
   * « Quitter » avec lui : attendre ne doit pas être une impasse.
   */
  function enterWaitingForOthers(): void {
    roster.hide();
    combat.pinCursor(null);
    combat.setSpawnZoneHighlights([]);
    if (waitingPanel !== null) {
      refreshWaitingPanel();
      return;
    }
    const panel = document.createElement("section");
    panel.className = "placement-waiting";
    panel.dataset.testid = "placement-waiting";

    const title = document.createElement("h2");
    title.className = "pw-title";
    title.textContent = t("placement.waiting.title");

    const seats = document.createElement("ul");
    seats.className = "pw-seats";

    const timer = document.createElement("p");
    timer.className = "pw-timer";
    timer.dataset.testid = "placement-waiting-timer";

    panel.append(title, seats, timer);
    host.appendChild(panel);
    waitingPanel = panel;
    refreshWaitingPanel();
    refreshWindowTimerLabel();
  }

  /**
   * Un battement du compte à rebours : la bannière du haut, et la ligne du récapitulatif s'il existe.
   *
   * Les deux, et pas l'un ou l'autre : la bannière sert **pendant** qu'on pose, le récapitulatif
   * **après**, quand on attend les autres. Ils ne sont jamais utiles au même moment mais ils lisent
   * la même échéance.
   */
  function refreshWindowTimerLabel(): void {
    if (online === undefined || windowDeadlineMs === null) {
      return;
    }
    const remainingMs = Math.max(0, windowDeadlineMs - Date.now());
    online.publishClock({ remainingMs, durationMs: online.windowMs });
    const label = waitingPanel?.querySelector(".pw-timer");
    if (label instanceof HTMLElement) {
      label.textContent = t("placement.window.remaining", {
        seconds: String(Math.ceil(remainingMs / 1000)),
      });
    }
  }

  /**
   * La fenêtre de placement expire (plan 211) : notre propre client pose ce qui reste, au hasard.
   *
   * 🔴 **Local et auto-déclarant**, exactement comme le chrono de combat : personne n'arbitre, chacun
   * constate l'expiration du sien et diffuse le résultat comme un placement ordinaire. Aucun message
   * de dépassement, donc aucune question de « qui fait autorité sur l'horloge ».
   *
   * Personne n'est éjecté : une coupure réseau ne doit pas coûter la partie.
   */
  function onWindowExpired(): void {
    if (!placing || localPlayerId === null) {
      return;
    }
    if (!phase.isPlayerDone(localPlayerId)) {
      /*
       * Le chrono a réellement posé à notre place (plan 212, Lot B). Compté ICI, dans la branche du
       * joueur pas encore prêt : un joueur déjà prêt dont la fenêtre expire n'est pas un dépassement,
       * et le compter le serait rendrait le chiffre ininterprétable — il monterait à chaque partie.
       *
       * Ce que ça répond : **90 s suffisent-ils pour poser son équipe ?** Exactement la question que
       * `turn-timed-out` pose pour les 60 s du tour. À lire rapporté au nombre de parties en ligne.
       */
      countAction(TelemetryAction.PlacementTimedOut);
      for (const entry of phase.autoPlaceForPlayer(localPlayerId, gridCenter)) {
        addBillboard(entry);
      }
      if (!phase.isPlayerDone(localPlayerId) && phase.canFinishPlayer(localPlayerId)) {
        phase.finishPlayer(localPlayerId);
      }
      publishLocalPlacement();
      enterWaitingForOthers();
    }
    startBattleWhenEveryoneIsDone();
  }

  function stopWindowTimer(): void {
    if (windowTimer !== null) {
      clearInterval(windowTimer);
      windowTimer = null;
    }
    /*
     * L'échéance s'efface AUSSI, sans quoi le compteur ressuscitait (revue de code) : à l'expiration,
     * `onWindowExpired` passe par l'écran d'attente, qui rafraîchit le compteur — et celui-ci
     * republiait `0:00`, figé et en alerte rouge, jusqu'au départ du combat. C'est exactement ce que
     * la ligne suivante cherche à empêcher.
     */
    windowDeadlineMs = null;
    // Le compteur disparaît avec la phase : le laisser figé sur son dernier reste ferait croire que
    // le temps court encore pendant le combat, où c'est l'autre chrono qui prend le relais.
    online?.publishClock(null);
  }

  /**
   * Pose les camps tenus par l'IA, en ligne (plan 211) — **avant que quiconque ne place**.
   *
   * 🔴 Sans ça la partie ne démarrait JAMAIS dès qu'une place était en IA : `activePlayer()` ne rend
   * que le camp local, donc la branche IA de `enterPlacement` est inatteignable en ligne ; une IA
   * n'émet aucun message, donc son camp n'était jamais compté fini, et le chrono ne sauve rien
   * puisqu'il ne pose que le camp local. C'est le cas courant « j'ouvre un salon, personne ne vient,
   * je passe la place en IA ». Trouvé en revue de code, invisible pour les tests en place.
   *
   * **Deux conditions rendent la pose identique sur toutes les machines**, et il faut les deux :
   * - un générateur DÉRIVÉ de la place, tiré dans l'ordre des places croissantes — le générateur de
   *   la phase avance à chaque tirage, donc son état dépend de ce que cette machine a déjà tiré ;
   * - une pose faite **au démarrage**, avant la moindre pose humaine, donc à plateau identique
   *   partout. Poser une IA au milieu du placement laisserait les cases libres dépendre de qui a
   *   déjà joué de son côté.
   */
  function placeOnlineAiSeats(): void {
    if (online === undefined) {
      return;
    }
    // Même motif que `deriveAiSeedsBySeat` du réseau : une graine par place, tirées dans l'ordre
    // croissant depuis la graine partagée, donc la même suite chez tout le monde.
    const seedSource = createPrng(options.randomSeed);
    for (const [index, team] of placementTeams.entries()) {
      const seed = seedSource();
      if (team.controller !== PlayerController.Ai) {
        continue;
      }
      for (const entry of phase.autoPlaceForPlayer(
        team.playerId,
        gridCenter,
        createPrng(Math.floor(seed * 2 ** 31)),
      )) {
        addBillboard(entry);
      }
      if (!phase.isPlayerDone(team.playerId) && phase.canFinishPlayer(team.playerId)) {
        phase.finishPlayer(team.playerId);
      }
      seatsDone.add(index + 1);
    }
  }

  /**
   * Notre placement part, en un seul envoi (plan 211).
   *
   * Émis au moment où NOUS avons fini — à la main, ou parce que le chrono a expiré et que le repli a
   * posé le reste. Une seule fois : `seatsDone` garde notre propre place comme celle des autres.
   */
  function publishLocalPlacement(): void {
    if (online === undefined || localPlayerId === null || seatsDone.has(online.localSeat)) {
      return;
    }
    seatsDone.add(online.localSeat);
    const mine = phase
      .getPlacements()
      .filter((entry) => ownerPlayerIdOf(entry.pokemonId) === localPlayerId);
    online.publishPlacement(mine);
  }

  /**
   * Les poses d'un camp distant arrivent (plan 211).
   *
   * Elles entrent dans le moteur sans rien afficher : le placement est caché jusqu'au lancement. Une
   * pose refusée est ignorée en silence — ce n'est pas au joueur d'entendre parler d'un pair mal
   * élevé, et le détecteur d'empreinte du Lot B4 reste le filet en dernier recours.
   */
  function applyRemotePlacement(remote: RemotePlacement): void {
    if (!placing || seatsDone.has(remote.seat)) {
      return;
    }
    // La place est validée AVANT d'être comptée finie : une place inconnue marquée « posée »
    // laisserait le compte atteindre le nombre de camps sans qu'un camp ait posé.
    const remotePlayerId = placementTeams[remote.seat - 1]?.playerId;
    if (remotePlayerId === undefined) {
      return;
    }
    seatsDone.add(remote.seat);
    let applied = 0;
    for (const entry of remote.placements) {
      /*
       * 🔴 Chaque pose doit appartenir à l'ÉMETTEUR, et le salon ne le vérifie pas : il confronte le
       * champ `seat` du message au canal, donc il empêche d'usurper une place — pas d'y glisser les
       * Pokemon d'un autre camp. `submitPlacement` résout le propriétaire depuis le `pokemonId`, si
       * bien qu'un message de la place 2 contenant des « p1-… » poserait le camp de l'hôte sur son
       * propre écran. Relevé en revue de code ; même sous le modèle de confiance assumé (#863), un
       * pair honnête mais bogué corromprait l'état en silence au lieu d'échouer.
       */
      if (ownerPlayerIdOf(entry.pokemonId) !== remotePlayerId) {
        continue;
      }
      if (phase.submitPlacement(entry.pokemonId, entry.position, entry.direction).success) {
        addBillboard(entry);
        applied += 1;
      }
    }
    if (applied === 0) {
      /*
       * Aucune pose n'a survécu : un pair bogué qui n'envoie que des Pokemon d'un autre camp, ou des
       * cases toutes refusées. Le camp compte comme « fini » avec zéro Pokemon posé, donc
       * `phase.isComplete()` restera faux POUR TOUJOURS et le combat ne partirait jamais — un
       * blocage muet là où le filtre voulait un échec franc (revue de code).
       *
       * On le traite comme un camp parti : le récapitulatif l'annonce, et « Quitter » reste la
       * sortie. Mieux vaut un constat lisible qu'une attente sans fin.
       */
      seatsLost.add(remote.seat);
      enterWaitingForOthers();
      return;
    }
    if (!phase.isPlayerDone(remotePlayerId) && phase.canFinishPlayer(remotePlayerId)) {
      // Un camp qui a posé moins que sa taille d'équipe — chrono expiré sur un roster incomplet.
      phase.finishPlayer(remotePlayerId);
    }
    refreshWaitingPanel();
    startBattleWhenEveryoneIsDone();
  }

  function startBattleWhenEveryoneIsDone(): void {
    if (!placing || online === undefined) {
      return;
    }
    if (seatsDone.size < placementTeams.length || !phase.isComplete()) {
      return;
    }
    finish();
  }

  /**
   * La révélation (plan 211) : les camps tenus cachés apparaissent d'un coup, au passage au combat.
   *
   * Appelée par `finish` et par elle seule — c'est le seul instant où le pari se dénoue.
   */
  function revealAllTeams(): void {
    if (localPlayerId === null) {
      return;
    }
    for (const entry of phase.getPlacements()) {
      if (handleByPokemonId.has(entry.pokemonId)) {
        continue;
      }
      const handle = combat.addPokemon({
        pokemonId: definitionIdOf(entry.pokemonId),
        spawn: entry.position,
        team: ownerTeamNumberOf(entry.pokemonId),
      });
      handle.setFacing(entry.direction);
      handleByPokemonId.set(entry.pokemonId, handle);
    }
  }

  function finish(): void {
    placing = false;
    stopWindowTimer();
    // Les écoutes réseau meurent avec la phase : sans ça elles survivaient tout le combat à côté de
    // celles de `wireOnlineBattle`, et gardaient le salon en mode « quelqu'un écoute les placements ».
    unsubscribeFromPlacements?.();
    unsubscribeFromPlacements = null;
    unsubscribeFromPeerAbsent?.();
    unsubscribeFromPeerAbsent = null;
    waitingPanel?.remove();
    waitingPanel = null;
    revealAllTeams();
    roster.hide();
    combat.setSpawnZoneHighlights([]);
    unregisterInput?.();
    onComplete({
      placements: phase.getPlacements(),
      placementTeams,
      handles: handleByPokemonId,
      seed: options.randomSeed,
    });
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
        const activeId = activePlayer();
        if (!placing || activeId === null || selectedPokemonId === null) {
          return false;
        }
        // Pokemon choisi → on passe au plateau, curseur posé sur une case libre de la zone.
        keyboardStep = "board";
        seedCursorInSpawnZone(teamIndexOfPlayer(activeId));
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
    /*
     * Placement automatique : inchangé par le plan 211, en ligne comme en local. Les deux pairs
     * tirent sur la MÊME graine (`seeds.placement` du message de lancement), donc ils posent aux
     * mêmes cases sans échanger un octet — c'est le chemin qui marchait déjà, et le défaut réparé ici
     * ne concernait que l'autre.
     */
    const placements = phase.autoPlaceAll(gridCenter);
    for (const entry of placements) {
      addBillboard(entry);
    }
    finish();
  } else {
    if (online !== undefined) {
      placeOnlineAiSeats();
      unsubscribeFromPlacements = online.subscribeToPlacements(applyRemotePlacement);
      // Un premier battement tout de suite : sans lui la bannière resterait vide une seconde entière,
      // pile au moment où le joueur découvre qu'il est chronométré.
      windowDeadlineMs = Date.now() + online.windowMs;
      refreshWindowTimerLabel();
      unsubscribeFromPeerAbsent = online.subscribeToPeerAbsent((seat) => {
        // Déjà posé : son placement est arrivé avant qu'il ne parte, la partie peut commencer sans
        // lui — c'est le combat, et son chien de garde, qui décideront de son sort.
        if (!placing || seatsDone.has(seat)) {
          return;
        }
        seatsLost.add(seat);
        /*
         * On montre le panneau MÊME si je n'ai pas fini de poser : sans lui, rien à l'écran ne dirait
         * que la partie ne pourra pas commencer, et je continuerais à placer mes Pokemon pour rien.
         * Poser reste possible — le panneau informe, il ne verrouille pas — et « Quitter » du menu de
         * placement reste la sortie, donc attendre n'est jamais une impasse.
         */
        enterWaitingForOthers();
      });
      // Un rafraîchissement par seconde : le compte à rebours n'a pas besoin de plus, et l'échéance
      // est relue à chaque battement plutôt que décomptée — un onglet mis en arrière-plan ralentit
      // les minuteurs, et un chrono qui dérive est un chrono qui ment.
      windowTimer = setInterval(() => {
        refreshWindowTimerLabel();
        if (windowDeadlineMs !== null && Date.now() >= windowDeadlineMs) {
          stopWindowTimer();
          onWindowExpired();
        }
      }, 1000);
    }
    enterPlacement();
  }

  return {
    dispose: () => {
      placing = false;
      stopWindowTimer();
      unsubscribeFromPlacements?.();
      unsubscribeFromPlacements = null;
      unsubscribeFromPeerAbsent?.();
      unsubscribeFromPeerAbsent = null;
      waitingPanel?.remove();
      waitingPanel = null;
      unregisterInput?.();
      picker?.dispose();
      picker = null;
      roster.destroy();
    },
  };
}
