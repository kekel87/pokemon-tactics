import { type MapFormat, PlayerController, type TeamSelection } from "@pokemon-tactic/core";
import { REQUIRED_TEAM_COUNTS } from "@pokemon-tactic/data";
import {
  HOST_SEAT,
  NetworkErrorCode,
  NetworkSeatOccupancy,
  type NetworkSeatState,
  PeerJsTransport,
  Room,
  RoomRole,
  type RoomView,
  type StartMessage,
} from "@pokemon-tactic/network";
import { buildTelemetryTeams } from "../../../analytics/team-telemetry";
import {
  countAction,
  countScreen,
  ROOM_FAILURE_ACTIONS,
  TelemetryAction,
  TelemetryScreen,
} from "../../../analytics/telemetry";
import type { Navigate, Screen } from "../../../app/screen-manager";
import type { NetworkIntent } from "../../../app/screens";
import { t } from "../../../i18n";
import type { TranslationKey } from "../../../i18n/types";
import { loadTiledMap } from "../../../maps/load-tiled-map";
import { mapIdFromUrl, mapUrlFromId } from "../../../maps/map-identity";
import { holdOnlineRoom, releaseOnlineRoom } from "../../../network/online-room";
import { signallingOverride } from "../../../network/signalling-override";
import { getSettings, updateSettings } from "../../../settings";
import {
  buildFormatKey,
  createFormatPickerElement,
  type FormatOption,
  formatLabel,
} from "../../team-select/FormatPicker";
import {
  createPlayersColumnElement,
  type PlayerColumnEntry,
} from "../../team-select/PlayersColumn";
import { createRoomPanelElement } from "../../team-select/RoomPanel";
import {
  assignTeamToSlot,
  buildInitialSlots,
  buildTeamSelections,
  PLAYER_IDS,
  playerLabel,
  playerShortLabel,
  type SlotState,
  setSlotController,
  teamColorToHex,
} from "../../team-select/slot-state";
import { openTeamPickerModal } from "../../team-select/TeamPickerModal";
import { renderPreservingFocus } from "../preserve-focus";
import { bindScreenInput, el } from "./elements";

/**
 * DOM port of TeamSelectScene (plan 120 step 4), refondu au plan 188.
 *
 * Un camp par carte, en une seule colonne : le format est une rangée de segments toujours lue
 * (décision #830), le contrôle un segment à deux états visibles (#831), et l'équipe se choisit dans
 * une modale ouverte par la carte (#832) — ce qui supprime la notion de « camp actif », un second
 * curseur qui pouvait contredire le focus à l'écran.
 *
 * Lancer confie tout le `CombatSetup` à l'écran de combat, qui déroule la phase de placement.
 */
export function createTeamSelectScreen(navigate: Navigate): Screen<"team-select"> {
  let root: HTMLElement | null = null;
  let unbindScreenInput: (() => void) | null = null;
  let mapUrl = "";
  let mapName = "";
  /**
   * Formats de la carte, SANS leur libellé : celui-ci dépend de la langue et se relit au rendu
   * (`buildHeader`). Le stocker le figerait dans la locale d'entrée d'écran — c'est précisément le
   * bug corrigé côté `formatLabel`, et le champ n'aurait aucun lecteur.
   */
  let formatOptions: Omit<FormatOption, "label">[] = [];
  let formatKey = "";
  let slots: SlotState[] = [];
  /*
   * Les deux paramètres de partie (plan 198). Initialisés depuis les préférences persistées et
   * réécrits à chaque bascule : c'est ce qui corrige l'oubli de « Placement auto », jusqu'ici une
   * simple variable locale qui repartait au défaut à chaque entrée d'écran.
   */
  let autoPlacement = getSettings().autoPlacement;
  let damagePreview = getSettings().damagePreview;

  /*
   * Mode réseau (plan 199, étape 5). L'écran devient la **salle d'attente** : il n'y a pas de second
   * écran de salon (décision #897), celui-ci portant déjà les lignes par camp.
   *
   * `room` absent = partie locale, et tout ce qui suit reste inerte — c'est ce qui garde le chemin
   * local exactement tel qu'il était.
   */
  let networkIntent: NetworkIntent | undefined;
  let room: Room | null = null;
  let roomView: RoomView | null = null;
  let networkError: NetworkErrorCode | null = null;
  /** Les désabonnements du salon, soldés au démontage — le salon, lui, survit à cet écran. */
  const roomListeners: (() => void)[] = [];

  const isHost = (): boolean => networkIntent?.role === RoomRole.Host;
  const isOnline = (): boolean => networkIntent !== undefined;

  /**
   * La ligne du joueur assis devant cet écran. Zéro en local, la place du salon en ligne — c'est elle
   * qui dit quelle ligne restaure et enregistre « ma dernière équipe ».
   */
  const humanIndex = (): number => (room === null ? 0 : room.seat - 1);

  const goBack = (): void => {
    if (room !== null) {
      // Compté seulement si la partie n'est pas lancée : « Retour » n'est plus le chemin de l'entrée
      // en combat, mais le rester explicite protège du jour où il le redeviendrait.
      if (!room.view.locked) {
        countAction(TelemetryAction.RoomAbandoned);
      }
      /*
       * Quitter la salle d'attente met fin à la session en ligne — c'est un départ **propre**, donc
       * le `bye` part et vaut aux autres le délai court plutôt que les 45 s du silence.
       *
       * `releaseOnlineRoom` et non `room.leave()` : le salon appartient désormais à la session, et
       * le laisser derrière ferait tenir un pair que plus personne ne lit.
       */
      releaseOnlineRoom();
      room = null;
    }
    if (isOnline()) {
      navigate("lobby", undefined);
      return;
    }
    navigate("map-select", undefined);
  };

  const currentFormat = (): MapFormat => {
    const option = formatOptions.find((candidate) => candidate.key === formatKey);
    if (!option) {
      throw new Error(`Unknown format key: ${formatKey}`);
    }
    return option.format;
  };

  const isLaunchable = (): boolean => slots.every((slot) => slot.assignedTeam !== null);

  const onLaunch = (): void => {
    if (!isLaunchable()) {
      return;
    }
    const teams = buildTeamSelections(slots);
    if (teams === null) {
      return;
    }
    navigate("combat", {
      mapUrl,
      setup: {
        teams,
        formatKey,
        autoPlacement,
        damagePreview,
        telemetryTeams: buildTelemetryTeams(slots),
      },
    });
  };

  /**
   * L'hôte grave la partie et la diffuse (plan 199, étape 6). Les trois graines sont tirées **ici**,
   * une fois, et voyagent dans le `start` : c'est ce qui fait que les deux pairs montent le même
   * combat sans échanger un mot de plus.
   */
  const onNetworkLaunch = (): void => {
    if (room === null || !isHost() || !isEveryoneReady()) {
      return;
    }
    void room.launch({
      battle: freshSeed(),
      placement: freshSeed(),
      ai: freshSeed(),
    });
  };

  /** Chacun confirme sa propre sélection, l'hôte compris. Une place IA est prête d'office. */
  const onToggleReady = (): void => {
    room?.setReady(!isSelfReady());
  };

  /**
   * Quelles lignes ce joueur compose : la sienne, plus celles que personne ne tient s'il est
   * l'hôte — les IA **et les places libres**, dont l'équipe servira si personne ne vient. Une place
   * distante n'appartient à personne d'autre que celui qui est derrière.
   */
  const canEditSlot = (slotIndex: number): boolean => {
    if (room === null) {
      return true;
    }
    const seat = slotIndex + 1;
    if (seat === room.seat) {
      return true;
    }
    const occupancy = roomView?.seats.find((candidate) => candidate.seat === seat)?.occupancy;
    return (
      isHost() &&
      (occupancy === NetworkSeatOccupancy.Ai || occupancy === NetworkSeatOccupancy.Waiting)
    );
  };

  /**
   * Plus aucune exemption : l'hôte a désormais son propre « Prêt », donc sa confirmation compte comme
   * celle des autres. Les places IA et libres sont prêtes d'office — il n'y a personne dont on
   * attendrait quoi que ce soit.
   */
  const isEveryoneReady = (): boolean => roomView?.seats.every((seat) => seat.ready) === true;

  /**
   * L'entrée en combat, des deux côtés.
   *
   * 🔴 La composition vient **entièrement du `start`**, jamais de l'état local : un invité ne connaît
   * pas l'équipe de l'hôte, et l'hôte ne connaît celles des autres que par ce qu'ils ont annoncé.
   * Reconstruire depuis `slots` donnerait à chaque pair un plateau différent — exactement ce que ce
   * lot existe pour empêcher.
   */
  const enterNetworkBattle = (start: StartMessage): void => {
    const url = mapUrlFromId(start.options.mapId);
    if (url === undefined) {
      // Un pair qui connaît une carte que nous n'avons pas. `NETWORK_VERSION` est là pour l'éviter ;
      // le jour où on oubliera de l'incrémenter, un refus lisible vaut mieux qu'un chargement d'une
      // URL construite au hasard.
      showNetworkError(NetworkErrorCode.VersionIncompatible);
      return;
    }

    const teams: TeamSelection[] = [];
    for (const [index, seat] of start.seats.entries()) {
      const playerId = PLAYER_IDS[index];
      if (playerId === undefined) {
        return;
      }
      teams.push({
        playerId,
        pokemonDefinitionIds: [...seat.selection.pokemonDefinitionIds],
        controller: seat.controller,
        ...(seat.selection.slots === undefined ? {} : { slots: [...seat.selection.slots] }),
      });
    }

    navigate("combat", {
      mapUrl: url,
      setup: {
        teams,
        formatKey,
        autoPlacement: start.options.autoPlacement,
        damagePreview: start.options.damagePreview,
        seeds: start.seeds,
        // Pas de `telemetryTeams` : la composition des autres camps n'est pas de l'information
        // locale, et `battle_started` n'a pas encore de mode `online`. Les compteurs du jeu en ligne
        // sont l'étape 7 de ce plan.
      },
    });
  };

  /**
   * Fait suivre au salon les deux paramètres de partie que l'hôte vient de changer.
   *
   * 🔴 Il manquait, et le trou était visible : les bascules du pied écrivaient la préférence
   * persistée et la variable locale, mais **rien ne partait au salon** — l'encart de paramètres en
   * haut de l'écran continuait d'afficher l'ancienne valeur, et les autres joueurs ne l'apprenaient
   * jamais. Or c'est celle du salon qui est diffusée au lancement : on aurait joué sous une règle que
   * l'hôte croyait avoir changée. Relevé à la recette du 2026-09-04.
   *
   * Sans effet hors du rôle d'hôte : `setOptions` est réservé à l'hôte, et le pied n'est de toute
   * façon éditable que par lui.
   */
  const publishRoomOptions = (): void => {
    if (room === null || !isHost()) {
      return;
    }
    room.setOptions({ autoPlacement, damagePreview });
    render();
  };

  const showNetworkError = (code: NetworkErrorCode): void => {
    networkError = code;
    // Une cause par compteur (plan 199, étape 7) : c'est ce qui dira si le pair-à-pair sans relais
    // est tenable, la traversée de pare-feu étant assumée faillible en V1.
    countAction(ROOM_FAILURE_ACTIONS[code]);
    render();
  };

  function freshSeed(): number {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  }

  const setController = (slotIndex: number, controller: PlayerController): void => {
    const slot = slots[slotIndex];
    if (!slot || !setSlotController(slot, controller)) {
      return;
    }
    /*
     * En ligne, la bascule est aussi un fait de salon : elle doit parvenir aux autres, sinon eux
     * continueraient d'attendre le « Prêt » d'une ligne que l'hôte vient de donner à l'IA.
     *
     * « Humain » y vaut **place libre**, pas `Human` : sur une ligne que personne ne tient, `Human`
     * réclamait une confirmation qui ne pouvait jamais venir et bloquait « Lancer » sans retour
     * possible. `Waiting` dit ce que l'hôte veut réellement dire — « je rouvre cette place à un
     * joueur » — et reste jouable si personne ne vient.
     */
    room?.setSeatOccupancy(
      slotIndex + 1,
      controller === PlayerController.Ai ? NetworkSeatOccupancy.Ai : NetworkSeatOccupancy.Waiting,
    );
    /*
     * 🔴 En ligne, une place libre **garde une équipe**. C'est déjà ce que le reste de l'écran
     * suppose — `canEditSlot` la rend composable « dont l'équipe servira si personne ne vient », et
     * `composeStartSeats` la rend en IA au lancement.
     *
     * `setSlotController(…, Human)` vient de la vider, ce qui est juste en local (un humain va
     * composer la sienne) et faux ici : la ligne se retrouvait sur trois états contradictoires —
     * segment « Humain », carte vide, badge « Place libre » — et « Lancer » s'éteignait sur
     * `isLaunchable()` pour une place que le salon déclare pourtant prête. Pire, `announceSelection`
     * sortant sur une équipe nulle, le salon **conservait l'ancienne sélection** : la place partait
     * en combat avec l'équipe que l'écran venait de montrer comme retirée.
     */
    if (isOnline() && controller !== PlayerController.Ai && slot.assignedTeam === null) {
      assignTeamToSlot(slot, slotIndex, null, humanIndex());
    }
    // Une ligne passée en IA reçoit une équipe aléatoire séance tenante : il faut la poser au salon,
    // sinon la place partirait vide dans le `start`.
    announceSelection(slotIndex, slot);
    render();
  };

  const chooseTeam = (slotIndex: number): void => {
    // On ne choisit pas l'équipe de quelqu'un d'autre : en ligne, chaque joueur ne compose que la
    // sienne, et l'hôte celles des lignes IA.
    if (isOnline() && !canEditSlot(slotIndex)) {
      return;
    }
    openTeamPickerModal({
      slotIndex,
      playerLabel: playerLabel(slotIndex),
      assignedTeamIdsBySlot: slots.map((slot) => slot.assignedTeamId),
      onPick: (teamId) => assignTeam(slotIndex, teamId),
    });
  };

  const assignTeam = (slotIndex: number, teamId: string | null): void => {
    const slot = slots[slotIndex];
    if (!slot || !assignTeamToSlot(slot, slotIndex, teamId, humanIndex())) {
      return;
    }
    announceSelection(slotIndex, slot);
    render();
    focusNextUnassigned(slotIndex);
  };

  /**
   * Pose au salon l'équipe d'une place qu'on possède (plan 199, étape 6).
   *
   * 🔴 Sans cet appel, le `start` de l'hôte partirait avec des équipes **vides** : le salon ne
   * devine pas ce que l'écran a composé, et c'est le `start` qui porte la composition de chaque
   * place jusqu'aux autres pairs.
   */
  const announceSelection = (slotIndex: number, slot: SlotState): void => {
    if (room === null || slot.assignedTeam === null) {
      return;
    }
    room.setSeatSelection(slotIndex + 1, {
      pokemonDefinitionIds: slot.assignedTeam.slots.map((entry) => entry.pokemonId),
      slots: [...slot.assignedTeam.slots],
    });
  };

  /** Toutes les places qu'on possède, posées d'un coup — à l'ouverture du salon et à chaque bascule. */
  const announceOwnedSelections = (): void => {
    for (const [index, slot] of slots.entries()) {
      announceSelection(index, slot);
    }
  };

  /**
   * Après une assignation RÉUSSIE, le focus va au premier camp encore vide (décision #834).
   *
   * Écart assumé à la convention `<dialog>` (« le focus revient au déclencheur ») : #832 a supprimé
   * l'avance automatique de camp que faisait l'ancienne liste centrale, et sans compensation
   * configurer 12 camps à la main doublerait le nombre de gestes. La convention vise la modale
   * refermée sans rien faire — ici l'action a abouti et a déplacé le travail d'un cran. Une sortie
   * par `Échap`, par B ou par la croix ne passe pas ici, donc rend bien le focus au déclencheur.
   */
  const focusNextUnassigned = (fromSlotIndex: number): void => {
    const nextIndex = slots.findIndex(
      (slot, index) => index > fromSlotIndex && slot.assignedTeam === null,
    );
    const targetIndex = nextIndex === -1 ? fromSlotIndex : nextIndex;
    root
      ?.querySelector<HTMLElement>(
        `[data-testid="player-team-button"][data-slot-index="${targetIndex}"]`,
      )
      ?.focus();
  };

  const onFormatChange = (key: string): void => {
    if (key !== formatKey) {
      formatKey = key;
      slots = buildInitialSlots(currentFormat());
      render();
    }
  };

  const buildHeader = (): HTMLElement => {
    const header = el("header", "ts-header");

    const back = el("button", "tb-btn");
    back.type = "button";
    back.dataset.variant = "ghost";
    back.textContent = t("teamSelect.actions.back");
    back.addEventListener("click", goBack);

    const title = el("h2", "ts-header-title");
    title.textContent = `${t("teamSelect.title")} — ${mapName}`;

    // En ligne, le format est **gravé depuis le `lobby`** : le sélecteur disparaît plutôt que de
    // s'afficher désactivé, parce qu'il n'y a pas de choix en attente — la décision est déjà prise,
    // et l'encart de salon la rappelle (décision #896).
    if (isOnline()) {
      header.append(back, title);
      return header;
    }

    const picker = createFormatPickerElement(
      // Le libellé est assemblé ici, jamais stocké : il dépend de la langue courante. Garde de
      // code, pas un cas de recette — aucun écran de préparation ne porte de bascule de langue
      // aujourd'hui (elle vit au menu principal, dans les Réglages et dans le menu de combat).
      formatOptions.map((option) => ({ ...option, label: formatLabel(option.format) })),
      formatKey,
      t("teamSelect.format.label"),
      { onChange: onFormatChange },
    );

    header.append(back, title, picker);
    return header;
  };

  /** L'encart de salon : le code et les paramètres. N'existe qu'en ligne. */
  const buildRoomPanel = (): HTMLElement | null => {
    if (room === null || roomView === null) {
      return null;
    }
    return createRoomPanelElement(
      {
        code: room.code,
        mapName,
        teamCount: roomView.options.teamCount,
        autoPlacement: roomView.options.autoPlacement,
        damagePreview: roomView.options.damagePreview,
        isHost: isHost(),
      },
      { onCopyCode: (code) => void navigator.clipboard?.writeText(code) },
    );
  };

  /**
   * L'état d'une ligne **tel qu'on l'affiche**, distinct de la préparation que le salon calcule pour
   * verrouiller le lancement : une place libre y est « prête » (personne dont on attende la
   * confirmation) alors qu'à l'écran elle doit dire qu'elle attend un joueur.
   */
  const seatStatusOf = (
    seatState: NetworkSeatState | undefined,
  ): "open" | "ready" | "not-ready" | undefined => {
    if (seatState === undefined) {
      return undefined;
    }
    if (seatState.occupancy === NetworkSeatOccupancy.Waiting) {
      return "open";
    }
    return seatState.ready ? "ready" : "not-ready";
  };

  /** Le rôle qui remplace le segment Humain / IA, quand il n'y a rien à choisir sur cette ligne. */
  const lockedRoleOf = (
    seatState: NetworkSeatState | undefined,
  ): "remote" | "host" | "self" | undefined => {
    if (seatState === undefined) {
      return undefined;
    }
    if (seatState.seat === HOST_SEAT) {
      return "host";
    }
    if (seatState.occupancy !== NetworkSeatOccupancy.Remote) {
      return undefined;
    }
    // Ma place est « moi », pas « un joueur distant » : vue de mon écran, c'est moi qui y suis.
    return seatState.seat === room?.seat ? "self" : "remote";
  };

  /** Une place tenue par un humain — l'hôte ou un joueur distant. Son équipe ne se montre pas. */
  const isHeldByHuman = (seatState: NetworkSeatState | undefined): boolean =>
    seatState !== undefined &&
    (seatState.seat === HOST_SEAT || seatState.occupancy === NetworkSeatOccupancy.Remote);

  const buildPlayerEntry = (slotIndex: number, slot: SlotState): PlayerColumnEntry => {
    // La place du salon correspondant à ce camp : la place 1 est l'hôte, donc l'index + 1.
    const seatState = roomView?.seats.find((seat) => seat.seat === slotIndex + 1);
    const isMine = room !== null && seatState?.seat === room.seat;

    return {
      props: {
        slotIndex,
        playerLabel: playerLabel(slotIndex),
        shortLabel: playerShortLabel(slotIndex),
        colorHex: teamColorToHex(slotIndex),
        controller: slot.controller,
        assignedTeam: slot.assignedTeam,
        ephemeral: slot.ephemeral,
        labels: {
          controllerHuman: t("teamSelect.controller.human"),
          controllerAi: t("teamSelect.controller.ai"),
          chooseTeam: t("teamSelect.players.choose"),
          controllerRemote: t("room.remotePlayer"),
          controllerHost: t("room.hostPlayer"),
          controllerSelf: t("room.selfPlayer"),
          ready: t("room.ready"),
          waiting: t("room.waiting"),
          seatOpen: t("room.seatOpen"),
        },
        /*
         * Les deux rôles qui remplacent le segment Humain / IA par un état unique : la place de
         * l'hôte, et celle d'un joueur distant. Rien à y choisir, donc rien à griser.
         *
         * La ligne de l'HÔTE porte son rôle **y compris vu de lui-même** (recette 2026-09-04) : il
         * voyait deux boutons grisés sans savoir pourquoi, alors que ce qu'il faut dire est
         * simplement « c'est toi qui tiens la partie ».
         */
        lockedRole: lockedRoleOf(seatState),
        /*
         * Pas de badge sur MA propre ligne : je suis là, par définition, et « En attente » à côté de
         * son propre nom est un contresens — relevé à la recette du 2026-09-04. Le badge dit où en
         * sont **les autres**, ce qui est la seule chose qu'on ne peut pas voir soi-même.
         *
         * Ma confirmation existe, mais c'est le bouton de décision qui la porte : « Lancer » pour
         * l'hôte, « Prêt / Pas prêt » pour un invité.
         *
         * « Place libre » se distingue de « En attente » : la première n'attend personne en
         * particulier, la seconde attend la confirmation de quelqu'un qui est déjà là.
         */
        seatStatus: isMine ? undefined : seatStatusOf(seatState),
        /*
         * Seul l'hôte bascule une ligne, et seulement une ligne **IA**.
         *
         * Sa propre ligne ne se bascule pas en V1 : `Room.setSeatOccupancy` refuse la place de
         * l'hôte, donc l'autoriser ici afficherait un bouton qui ne changerait rien chez les autres.
         * Une place distante ne se bascule pas non plus — elle n'affiche d'ailleurs pas le segment,
         * mais un état unique et non interactif.
         */
        controllerEditable: !isOnline() || (isHost() && canEditSlot(slotIndex) && !isMine),
        // Chacun ne compose que ce qu'il possède : sa ligne, plus les lignes IA pour l'hôte.
        teamEditable: canEditSlot(slotIndex),
        /*
         * On voit sa propre équipe, et celles que **personne ne tient** (IA, place libre) — pas
         * celle d'un autre humain.
         *
         * Distinct de `teamEditable` : un invité **voit** les équipes IA sans pouvoir les composer,
         * c'est l'hôte qui les choisit. Ce qui se masque, c'est l'équipe d'un adversaire humain, dont
         * la montrer avant le combat serait une fuite d'information — le jeu masque déjà son objet
         * tenu et son talent (#729). En local tout est visible : c'est un hot-seat, les joueurs sont
         * côte à côte.
         */
        teamVisible: !isOnline() || isMine || !isHeldByHuman(seatState),
      },
      callbacks: {
        onChooseTeam: () => chooseTeam(slotIndex),
        onSetController: (controller) => setController(slotIndex, controller),
      },
    };
  };

  /** Les cartes de camp — `PlayersColumn` décide seul d'une ou deux colonnes selon leur nombre. */
  const buildMain = (): HTMLElement => {
    const main = el("main", "ts-main");
    const entries = slots.map((slot, index) => buildPlayerEntry(index, slot));
    main.append(createPlayersColumnElement(entries));
    return main;
  };

  const buildFooter = (): HTMLElement => {
    const footer = el("footer", "ts-footer");

    /*
     * Les deux paramètres de partie (plan 198). Chaque bascule persiste immédiatement : le magasin
     * ne sert qu'à re-proposer le dernier choix, la valeur qui compte pour la partie est celle gelée
     * dans le `CombatSetup` au lancement.
     */
    const toggle = (
      testId: string,
      label: string,
      checked: boolean,
      onChange: (value: boolean) => void,
    ): HTMLElement => {
      const wrapper = el("label", "ts-footer-toggle");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = checked;
      input.dataset.testid = testId;
      input.addEventListener("change", () => onChange(input.checked));
      const text = document.createElement("span");
      text.textContent = label;
      wrapper.append(input, text);
      return wrapper;
    };

    const autoPlacementToggle = toggle(
      "team-select-auto-placement",
      t("teamSelect.autoPlacement.label"),
      autoPlacement,
      (value) => {
        autoPlacement = value;
        updateSettings({ autoPlacement: value });
        publishRoomOptions();
      },
    );

    const damagePreviewToggle = toggle(
      "team-select-damage-preview",
      t("teamSelect.damagePreview.label"),
      damagePreview,
      (value) => {
        damagePreview = value;
        updateSettings({ damagePreview: value });
        publishRoomOptions();
      },
    );

    const spacer = el("div", "ts-footer-spacer");

    /*
     * En ligne, les deux paramètres appartiennent à l'HÔTE, et se gèlent quand **lui** se déclare
     * prêt (recette 2026-09-04).
     *
     * Ils se gelaient auparavant dès qu'un INVITÉ était prêt, ce qui retirait le contrôle à l'hôte
     * sur une décision qui n'était pas la sienne — et le laissait sans aucun moyen de le reprendre.
     * Le rattacher à sa propre confirmation lui rend la main : « Pas prêt » dégèle.
     */
    if (isOnline() && (!isHost() || isSelfReady())) {
      for (const input of [autoPlacementToggle, damagePreviewToggle]) {
        for (const checkbox of input.querySelectorAll("input")) {
          checkbox.disabled = true;
        }
      }
    }

    footer.append(autoPlacementToggle, damagePreviewToggle, spacer, ...buildActions());
    if (networkError !== null) {
      const error = el("p", "ts-footer-error", "room-error");
      error.role = "alert";
      error.textContent = t(`room.error.${networkError}` as TranslationKey);
      footer.append(error);
    }
    return footer;
  };

  /**
   * Les boutons de décision.
   *
   * **Tout le monde a « Prêt / Pas prêt »**, l'hôte compris (recette 2026-09-04) : il n'en avait pas,
   * et sa préparation se devinait de son équipe composée — ce qui marchait, mais ne lui laissait
   * aucun moyen de dire « attendez » ni de dégeler ses options. Lui seul garde « Lancer » en plus.
   */
  const buildActions = (): readonly HTMLButtonElement[] => {
    if (!isOnline()) {
      return [buildLaunchButton()];
    }
    return isHost() ? [buildReadyButton(), buildLaunchButton()] : [buildReadyButton()];
  };

  const buildReadyButton = (): HTMLButtonElement => {
    const button = el("button", "tb-btn");
    button.type = "button";
    button.dataset.variant = "ghost";
    button.dataset.testid = "room-ready";
    button.textContent = isSelfReady() ? t("room.notReady") : t("room.ready");
    button.disabled = !isLaunchable();
    button.addEventListener("click", onToggleReady);
    return button;
  };

  const buildLaunchButton = (): HTMLButtonElement => {
    const button = el("button", "tb-btn");
    button.type = "button";
    button.dataset.variant = "primary";

    /*
     * 🔴 `data-testid` OBLIGATOIRE, et pas seulement pour les tests : `renderPreservingFocus` ne
     * restaure le focus que **par famille de `data-testid`** et sort sans repli quand il n'y en a
     * pas. En local c'était bénin — seul un clic du joueur déclenchait un re-rendu. En réseau, le
     * re-rendu part de **chaque** message distant : sans ce testid, l'hôte au clavier ou à la manette
     * perdait le liseré vers `<body>` à l'instant où l'invité pressait « Prêt », c'est-à-dire
     * précisément quand le bouton devenait actionnable. C'est la régression du plan 194 (#835),
     * reproduite sur le contrôle le plus important de l'écran.
     */
    button.dataset.testid = "team-select-launch";
    button.textContent = t("teamSelect.actions.launch");
    // En ligne, l'hôte attend en plus que tout le monde soit prêt. Il peut toujours **forcer** en
    // repassant en IA les lignes qui traînent, ce qui les rend prêtes d'office.
    button.disabled = !isLaunchable() || (isOnline() && !isEveryoneReady());
    button.addEventListener("click", isOnline() ? onNetworkLaunch : onLaunch);
    return button;
  };

  /** Ma propre place est-elle confirmée ? C'est elle qui gèle mes options, et rien d'autre. */
  const isSelfReady = (): boolean =>
    roomView?.seats.find((seat) => seat.seat === room?.seat)?.ready === true;

  const render = (): void => {
    if (!root) {
      return;
    }
    // Le re-rendu reconstruit tout le sous-arbre, ce qui éjecterait le focus vers `<body>` à chaque
    // appui sur un segment (`.claude/rules/html.md`). Le helper partagé retrouve le contrôle par son
    // adresse logique — il a d'abord été écrit ici, puis extrait quand le retour humain a montré que
    // le problème était général au Team Builder.
    const host = root;
    renderPreservingFocus(host, () => {
      const panel = buildRoomPanel();
      host.replaceChildren(
        buildHeader(),
        ...(panel === null ? [] : [panel]),
        buildMain(),
        buildFooter(),
      );
    });
  };

  return {
    async mount(host, params) {
      countScreen(TelemetryScreen.TeamSelect);
      networkIntent = params.network;

      /*
       * L'invité n'a pas choisi de carte : elle lui arrive de l'hôte, et il faut donc ouvrir le
       * salon AVANT de savoir quoi charger. L'écarter ici suffit au compilateur pour donner la carte
       * à coup sûr en dessous.
       *
       * L'absence de carte est un discriminant **sain** depuis que le membre invité déclare
       * `mapUrl?: undefined` : « une carte avec une intention d'invité » ne se représente plus, donc
       * ce test et « le rôle est invité » disent désormais exactement la même chose. Avant, le
       * contrôle de propriétés en excès laissait compiler `{ mapUrl, network: <invité> }`, et un tel
       * paramètre prenait cette branche-ci par la négative — mode réseau actif, aucun salon.
       */
      if (params.mapUrl === undefined) {
        root = el("div", "ts-root");
        host.append(root);
        await joinAsGuest(params.network.code);
        unbindScreenInput = bindScreenInput(goBack);
        return;
      }

      mapUrl = params.mapUrl;
      const loaded = await loadTiledMap(mapUrl);
      mapName = loaded.map.name;
      formatOptions = loaded.map.formats.map((format) => ({
        key: buildFormatKey(format),
        format,
      }));
      const chosen = pickFormatOption(
        networkIntent?.role === RoomRole.Host ? networkIntent.teamCount : undefined,
      );
      if (!chosen) {
        throw new Error(`Map "${mapUrl}" has no formats`);
      }
      formatKey = chosen.key;
      slots = buildInitialSlots(chosen.format);
      root = el("div", "ts-root");
      host.append(root);

      if (networkIntent?.role === RoomRole.Host) {
        await createAsHost(networkIntent.teamCount);
      }
      render();
      unbindScreenInput = bindScreenInput(goBack);
    },
    dispose() {
      unbindScreenInput?.();
      unbindScreenInput = null;
      /*
       * 🔴 **Le salon N'EST PAS fermé ici** : il appartient à la session (`online-room.ts`), pas à
       * cet écran, et il doit survivre à l'entrée en combat pour que l'accusé de lancement ait le
       * temps de partir. Il se ferme sur les deux vrais chemins de sortie — « Retour » (`goBack`) et
       * le retour au menu principal.
       *
       * Ce qu'on solde en revanche, et qui est vital : les **écouteurs** de cet écran. Le salon leur
       * survivant, les oublier ferait rendre un écran détruit à chaque message reçu en combat.
       */
      for (const unsubscribe of roomListeners) {
        unsubscribe();
      }
      roomListeners.length = 0;
      room = null;
      roomView = null;
      networkError = null;
      root?.remove();
      root = null;
    },
  };

  /**
   * Le format de la carte qui porte le nombre de joueurs demandé. En local, le premier — comme
   * avant. Le couple carte/format est **revalidé ici** avant que l'hôte ne diffuse quoi que ce soit.
   */
  function pickFormatOption(
    teamCount: number | undefined,
  ): Omit<FormatOption, "label"> | undefined {
    if (teamCount === undefined) {
      return formatOptions[0];
    }
    return formatOptions.find((option) => option.format.teamCount === teamCount);
  }

  /** L'hôte ouvre le salon. Le code naît ICI, à l'entrée sur cet écran, jamais avant. */
  async function createAsHost(teamCount: number): Promise<void> {
    /*
     * 🔴 Pas de salon sur une carte qu'on ne sait pas nommer. L'identifiant est le contrat entre les
     * deux pairs : ouvrir malgré tout envoyait « unknown » à l'invité, qui ne trouvait aucune carte
     * de ce nom et affichait « versions incompatibles » — un diagnostic faux, prononcé par le mauvais
     * camp, pour un salon qui n'aurait de toute façon jamais pu se jouer.
     *
     * Le refus est prononcé ici, avec le **même** code que le chemin symétrique de
     * `enterNetworkBattle` : là-bas c'est un pair qui nomme une carte que nous n'avons pas, ici c'est
     * notre propre registre qui ne nomme pas une carte que nous chargeons. Les deux disent la même
     * chose au joueur — « vos versions diffèrent, rechargez » — et c'est ce qu'une page en cache
     * ancien produit réellement.
     */
    const mapId = mapIdFromUrl(mapUrl);
    if (mapId === undefined) {
      showNetworkError(NetworkErrorCode.VersionIncompatible);
      return;
    }
    try {
      room = await Room.create(
        { transport: new PeerJsTransport(signallingOverride()), maxSeats: maxSeats() },
        {
          mapId,
          teamCount,
          autoPlacement,
          damagePreview,
        },
      );
    } catch (error) {
      showNetworkError(codeOfError(error));
      return;
    }
    countAction(TelemetryAction.RoomCreated);
    wireRoom(room);
    // L'hôte arrive ici avec ses lignes déjà composées (`buildInitialSlots` a tiré une équipe pour
    // chaque IA) : il les pose au salon d'emblée, faute de quoi elles partiraient vides au `start`.
    announceOwnedSelections();
  }

  /** L'invité rejoint, puis découvre la carte et le format dans le premier état de salon reçu. */
  async function joinAsGuest(code: string): Promise<void> {
    try {
      room = await Room.join(
        { transport: new PeerJsTransport(signallingOverride()), maxSeats: maxSeats() },
        code,
      );
    } catch (error) {
      showNetworkError(codeOfError(error));
      return;
    }
    countAction(TelemetryAction.RoomJoined);
    wireRoom(room);

    const url = mapUrlFromId(room.view.options.mapId);
    if (url === undefined) {
      showNetworkError(NetworkErrorCode.VersionIncompatible);
      return;
    }
    mapUrl = url;
    const loaded = await loadTiledMap(mapUrl);
    mapName = loaded.map.name;
    formatOptions = loaded.map.formats.map((format) => ({
      key: buildFormatKey(format),
      format,
    }));
    const chosen = pickFormatOption(room.view.options.teamCount);
    if (!chosen) {
      showNetworkError(NetworkErrorCode.VersionIncompatible);
      return;
    }
    formatKey = chosen.key;
    // La ligne humaine est **celle de l'invité**, pas la première : assis à la place 3, il doit voir
    // sa propre ligne porter sa dernière équipe, la première étant celle de l'hôte.
    slots = buildInitialSlots(chosen.format, humanIndex());
    // L'invité ne tient qu'une ligne : les autres ne sont pas des IA locales à composer, ce sont
    // les places des autres joueurs, dont l'état vient du salon. `setSeatSelection` refuse d'ailleurs
    // toute place qu'il ne possède pas, donc seule la sienne part.
    announceOwnedSelections();
    render();
  }

  /**
   * Branche l'écran sur le salon, et **confie celui-ci à la session** (`holdOnlineRoom`).
   *
   * 🔴 Les désabonnements sont gardés et rejoués au démontage. Ce n'était pas nécessaire quand le
   * salon mourait avec l'écran ; depuis qu'il lui **survit** — pour que l'accusé de lancement ait le
   * temps de partir — des écouteurs oubliés ici feraient rendre un écran détruit à chaque message
   * distant reçu pendant le combat.
   */
  function wireRoom(joined: Room): void {
    holdOnlineRoom(joined);
    roomView = joined.view;
    roomListeners.push(
      joined.onChange((view) => {
        roomView = view;
        render();
      }),
      joined.onError((code) => showNetworkError(code)),
      joined.onStart((start) => enterNetworkBattle(start)),
      joined.onLaunchCancelled(() => showNetworkError(NetworkErrorCode.DelaiDepasse)),
    );
  }

  /**
   * Le plus grand format existant. Fourni au salon parce que le paquet réseau ne dépend pas de
   * `@pokemon-tactic/data` : c'est jusque-là qu'un arrivant balaie les places, ne connaissant pas
   * encore le format de la partie qu'il rejoint.
   */
  function maxSeats(): number {
    return Math.max(...REQUIRED_TEAM_COUNTS);
  }

  function codeOfError(error: unknown): NetworkErrorCode {
    if (typeof error === "object" && error !== null && "code" in error) {
      return (error as { code: NetworkErrorCode }).code;
    }
    return NetworkErrorCode.ConnexionImpossible;
  }
}
