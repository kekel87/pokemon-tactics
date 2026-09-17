import {
  type AiDifficulty,
  type MapFormat,
  PlayerController,
  type TeamSelection,
} from "@pokemon-tactic/core";
import {
  HOST_SEAT,
  NetworkErrorCode,
  NetworkSeatOccupancy,
  type NetworkSeatState,
  Room,
  RoomRole,
  type RoomView,
  type StartMessage,
} from "@pokemon-tactic/network";
import { buildOnlineTelemetryTeams, buildTelemetryTeams } from "../../../analytics/team-telemetry";
import {
  countAction,
  countScreen,
  createBattleId,
  ROOM_FAILURE_ACTIONS,
  TelemetryAction,
  TelemetryScreen,
} from "../../../analytics/telemetry";
import type { Navigate, Screen } from "../../../app/screen-manager";
import type { NetworkIntent } from "../../../app/screens";
import { getLanguage, t } from "../../../i18n";
import type { TranslationKey } from "../../../i18n/types";
import { loadTiledMap } from "../../../maps/load-tiled-map";
import { isRandomMapId, RANDOM_MAP_ID, resolveMapId } from "../../../maps/map-choice";
import { mapIdFromUrl, mapUrlFromId } from "../../../maps/map-identity";
import { MAPS_REGISTRY } from "../../../maps/maps-registry";
import { networkErrorCodeOf } from "../../../network/network-error";
import {
  getOnlineRoom,
  holdOnlineRoom,
  onlineRoomDeps,
  releaseOnlineRoom,
} from "../../../network/online-room";
import { getSettings, updateSettings } from "../../../settings";
import { openMapPickerModal } from "../../map-select/MapPickerModal";
import {
  buildFormatKey,
  createFormatPickerElement,
  type FormatOption,
  formatLabel,
} from "../../team-select/FormatPicker";
import { createGamePanelElement } from "../../team-select/GamePanel";
import { openGoOnlineConfirmModal } from "../../team-select/GoOnlineConfirmModal";
import {
  createPlayersColumnElement,
  type PlayerColumnEntry,
} from "../../team-select/PlayersColumn";
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
import {
  bindScreenInput,
  el,
  screenHeader,
  screenHeaderSpacer,
  screenHeaderTitle,
} from "./elements";

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
  /**
   * Ce que le JOUEUR a choisi — un identifiant de carte, ou `RANDOM_MAP_ID` (plan 208).
   *
   * 🔴 Distinct de `mapUrl`, qui porte la carte réellement chargée. Sur « Aléatoire » les deux
   * divergent volontairement : le tirage est fait **une fois**, tôt, et gardé secret — le bandeau
   * affiche « Aléatoire », le titre ne nomme plus la carte, et personne, hôte compris, ne sait sur
   * quoi il va tomber pendant qu'il compose son équipe. C'est tout l'intérêt de l'entrée.
   */
  let mapChoiceId = RANDOM_MAP_ID;
  let mapUrl = "";
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
  /**
   * De quoi refermer la modale de carte au démontage de l'écran (revue de code du 2026-09-13).
   *
   * 🔴 Elle vit sur `document.body`, HORS de l'arbre de cet écran : `root.remove()` ne l'emporte pas.
   * L'écran qu'elle remplace, lui, libérait son aperçu Babylon dans son `dispose()`, garanti par le
   * `ScreenManager` à chaque navigation. Aucun geste local ne démonte l'écran modale ouverte — le
   * `<dialog>` bloque les clics — mais `enterNetworkBattle` est une navigation pilotée par un MESSAGE
   * DISTANT : un `start`, ou une reprise du Lot B3, arrivant pendant que la modale est ouverte
   * fuirait un moteur Babylon ET laisserait un dialogue par-dessus la scène de combat. Pire, l'aperçu
   * fuité répondrait `isReady() === true` au hook e2e — le bug même que `e2e-debug-hook.ts` documente.
   */
  let closeMapPicker: (() => void) | null = null;
  /** Le jeton anti-course des chargements de carte — voir `loadMapChoice`. */
  let mapLoadToken = 0;
  /** Les désabonnements du salon, soldés au démontage — le salon, lui, survit à cet écran. */
  const roomListeners: (() => void)[] = [];

  /**
   * Suis-je l'hôte ? **Le salon fait foi, pas l'intention de navigation** (plan 209, Lot C5).
   *
   * 🔴 L'intention est figée à l'entrée sur l'écran : elle dit comment on est arrivé, pas où on en
   * est. Depuis que le rôle d'hôte se transmet, un invité peut le devenir en cours de route — et
   * s'en tenir à l'intention le laissait affiché comme invité, sans couronne ni bouton « Lancer »,
   * alors que le salon l'avait élu. L'intention reste le repli tant qu'aucun salon n'existe (le
   * temps de la création).
   */
  const isHost = (): boolean =>
    room === null ? networkIntent?.role === RoomRole.Host : room.role === RoomRole.Host;
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
    // L'écran de choix du terrain n'existe plus (plan 208) : « Retour » rend au choix du mode de
    // combat, d'où l'on vient désormais en une seule transition.
    navigate("battle-mode", undefined);
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
    // La carte retenue devient le défaut de la prochaine partie (plan 208). On enregistre le CHOIX
    // et non la carte tirée : un joueur qui a demandé « Aléatoire » veut « Aléatoire » la fois
    // d'après, pas le terrain que le sort lui a donné une fois.
    updateSettings({ lastMapId: mapChoiceId });
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
   *
   * L'identifiant de partie de la télémétrie est tiré au même endroit, et pour la même raison
   * (plan 204) : les deux pairs émettent chacun leurs événements, et sans identifiant commun une
   * partie en ligne comptait pour deux dans tous les agrégats par partie. C'est l'hôte qui le tire,
   * faute de serveur pour le faire.
   */
  const onNetworkLaunch = (): void => {
    if (room === null || !isHost() || !isEveryoneReady()) {
      return;
    }
    updateSettings({ lastMapId: mapChoiceId });
    /*
     * 🔴 Le tirage est RÉSOLU ICI, au lancement, et c'est le seul endroit (plan 208, étape 6).
     *
     * Jusque-là le salon porte `mapId: "random"`, donc l'invité lit « Aléatoire » sans apprendre le
     * terrain — s'il portait déjà l'identifiant tiré, un invité curieux le lirait dans l'état du
     * salon et l'entrée perdrait tout son sens. L'hôte, lui, a tiré sa carte à l'entrée d'écran et
     * la garde dans `mapUrl` : c'est CE tirage-là qu'on publie, jamais un second. « Le tirage doit
     * venir de l'hôte avec le reste du setup, jamais tiré deux fois » — contrainte écrite au backlog
     * dès le 2026-09-03, et la même conclusion que le cadrage a retrouvée par le code.
     *
     * Le `start` porte donc un identifiant CONCRET dans tous les cas : `enterNetworkBattle` n'a rien
     * appris de nouveau, et le message de lancement n'a pas changé de forme.
     */
    const resolvedMapId = mapIdFromUrl(mapUrl);
    if (resolvedMapId === undefined) {
      showNetworkError(NetworkErrorCode.VersionIncompatible);
      return;
    }
    void room.launch(
      {
        battle: freshSeed(),
        placement: freshSeed(),
        ai: freshSeed(),
      },
      createBattleId(),
      // Le format que l'HÔTE joue, publié plutôt que redeviné par chacun (plan 211, revue de code).
      formatKey,
      resolvedMapId,
    );
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
    /*
     * Fail-fast, comme les cinq autres fonctions de ce fichier. `room` est non nul quand cet
     * écouteur tourne (il est désabonné avant `room = null`), mais l'optionnel transformait cette
     * impossibilité en panne muette : sans notre place, l'écran de combat rendait la main sur les
     * deux camps, et `?? 1` aurait déclaré l'équipe d'un autre camp en télémétrie. Relevé en revue.
     */
    if (room === null) {
      return;
    }
    const localSeat = room.seat;
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
        /*
         * Le niveau d'IA vient du MESSAGE, jamais d'un repli local (plan 214) : l'hôte l'a résolu
         * dans `composeStartSeats` et gravé dans le `start`. Répliquer un défaut ici ferait monter
         * deux IA différentes aux deux pairs, sans erreur et sans trace.
         */
        ...(seat.aiDifficulty === undefined ? {} : { aiDifficulty: seat.aiDifficulty }),
        ...(seat.selection.slots === undefined ? {} : { slots: [...seat.selection.slots] }),
      });
    }

    navigate("combat", {
      mapUrl: url,
      setup: {
        teams,
        /*
         * 🔴 Le format du MESSAGE, jamais celui que cet écran a dérivé (plan 211, revue de code).
         *
         * Chacun le reconstituait depuis le nombre de camps et la carte de SON salon — et en mode
         * « Aléatoire » l'invité dérive depuis une carte qui n'est pas celle qui sera jouée. L'écran
         * de combat repliait ensuite en silence sur le premier format de la carte : d'autres zones de
         * départ et une autre taille d'équipe, sans un mot. Même partage que la carte résolue du plan
         * 208 : ce que les pairs doivent partager se publie, il ne se devine pas.
         */
        formatKey: start.formatKey,
        autoPlacement: start.options.autoPlacement,
        damagePreview: start.options.damagePreview,
        seeds: start.seeds,
        // La place que NOUS tenons (plan 201) : rien d'autre dans le setup ne dit qui est « moi »,
        // les places distantes étant rabattues sur `human`. Sans elle, l'écran de combat rendrait la
        // main au joueur local au tour de son adversaire.
        localSeat,
        // Le code du salon (plan 202) : c'est l'adresse à rappeler pour se reconnecter, et la
        // sauvegarde de reprise n'a rien d'autre pour retrouver la partie.
        roomCode: room.code,
        // 🔴 `telemetryTeams` ne porte que NOTRE camp (plan 201, étape 7), et le motif n'est pas
        // « la composition des autres n'est pas locale » — le `start` la porte pourtant. C'est le
        // DOUBLE COMPTAGE : deux pairs qui déclarent la même partie compteraient chaque équipe deux
        // fois, et les statistiques d'usage à la Showdown sont précisément ce que le Lot A produit.
        // Chacun déclare son camp, chaque équipe compte une fois, le total est juste.
        telemetryTeams: buildOnlineTelemetryTeams(
          localSeat,
          start.seats.find((seat) => seat.seat === localSeat)?.selection.slots,
        ),
        // 🔴 Le pendant du commentaire ci-dessus (plan 204). Chacun déclare son camp, mais les deux
        // déclarent la MÊME partie : sans identifiant commun, elle comptait pour deux dans tous les
        // agrégats par partie. Il vient de l'hôte, par le `start` — l'hôte passe ici aussi, son
        // propre `start` lui étant réémis, donc c'est l'unique point de pose pour les deux camps.
        battleId: start.battleId,
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

  /**
   * Charge la carte d'un CHOIX, en résolvant le tirage s'il y en a un (plan 208).
   *
   * Rend `false` quand le choix ne désigne aucune carte connue — un registre désynchronisé, ou un
   * pair d'une autre version. L'appelant décide alors quoi en dire.
   */
  const loadMapChoice = async (choiceId: string): Promise<boolean> => {
    const url = mapUrlFromId(resolveMapId(choiceId));
    if (url === undefined) {
      return false;
    }
    /*
     * 🔴 Jeton anti-course (revue de code du 2026-09-13). `mapChoiceId` et `mapUrl` se posent avant
     * l'attente, `formatOptions` après : deux chargements concurrents — un hôte qui enchaîne les
     * cartes, un invité sur réseau lent que `syncGuestMap` réveille — laissaient le plus LENT écrire
     * les formats d'une carte qui n'est plus la bonne. Conséquence silencieuse, et le genre de
     * défaut qu'on ne retrouve jamais après coup.
     *
     * Même patron que le voile de `map-preview-stage.ts` : seul le dernier demandé a le droit
     * d'écrire.
     */
    const token = ++mapLoadToken;
    mapChoiceId = choiceId;
    mapUrl = url;
    const loaded = await loadTiledMap(url);
    if (token !== mapLoadToken) {
      return false;
    }
    formatOptions = loaded.map.formats.map((format) => ({
      key: buildFormatKey(format),
      format,
    }));
    return true;
  };

  /**
   * Le nom à afficher : « Aléatoire » tant que le tirage n'est pas joué, sinon celui du REGISTRE.
   *
   * 🔴 Du registre, et surtout pas le `name` de la carte Tiled, qui était affiché ici jusqu'au plan
   * 208 : les deux diffèrent (Tiled dit « Caldeira » là où le jeu dit « Volcan Actif ») et le nom
   * Tiled n'est pas traduit. Tant que ça vivait dans un titre d'écran, l'écart passait inaperçu ;
   * maintenant que le bandeau est le SEUL endroit où le joueur lit sa carte, il lui répondrait un
   * autre nom que celui de la liste où il vient de la choisir. Le menu de reprise lit déjà le
   * registre (`main-menu-screen.ts`) : c'est la convention, et le nom Tiled était l'exception.
   */
  const mapDisplayName = (): string => {
    const mapId = effectiveMapId();
    if (isRandomMapId(mapId)) {
      return t("mapSelect.random");
    }
    return MAPS_REGISTRY.find((entry) => entry.id === mapId)?.displayName[getLanguage()] ?? "";
  };

  /**
   * L'identifiant de carte qui FAIT FOI : celui du salon en ligne, le choix local en solo.
   *
   * 🔴 Le salon d'abord, et c'est le correctif d'un bug de recette (2026-09-13) : l'affichage lisait
   * `mapChoiceId`, une variable LOCALE que seul l'hôte met à jour. Un invité voyait donc la carte de
   * son arrivée, figée — « le choix n'est pas reflété en live comme Placement auto et
   * Prévisualisation dégâts ». Ces deux-là marchaient précisément parce qu'ils lisent
   * `roomView.options` ; la carte était la seule à ne pas le faire.
   *
   * En ligne, c'est le salon qui fait foi pour tout le monde — un pair n'a aucun état local à
   * opposer à ce que l'hôte a gravé.
   */
  const effectiveMapId = (): string => roomView?.options.mapId ?? mapChoiceId;

  /**
   * L'invité recharge sa carte quand l'hôte en change.
   *
   * L'AFFICHAGE est déjà juste sans ça — `effectiveMapId` lit le salon — mais `mapUrl` et
   * `formatOptions` resteraient sur la carte d'arrivée. Ça ne casse rien aujourd'hui, le `start` de
   * l'hôte portant la carte finale, et c'est exactement le genre d'incohérence silencieuse qui
   * mordra le jour où l'écran lira sa carte locale pour autre chose.
   *
   * Garde contre la boucle : on ne recharge que sur un identifiant RÉELLEMENT différent, et le
   * rechargement ne repasse jamais par le salon.
   */
  const syncGuestMap = (view: RoomView): void => {
    if (isHost() || view.options.mapId === mapChoiceId) {
      return;
    }
    void loadMapChoice(view.options.mapId).then(() => render());
  };

  /**
   * Changer de carte SANS quitter l'écran (plan 208) — le vrai motif du plan, au-delà du confort.
   *
   * 🔴 Avant, « Retour » ramenait à l'écran de choix du terrain, ce qui **démontait** celui-ci et
   * jetait la composition en cours. Ici l'écran reste monté sous la modale : les équipes déjà
   * choisies sont intactes au retour.
   *
   * Le format aussi est préservé, et ce n'est pas un pari : les neuf cartes de production déclarent
   * toutes les mêmes formats — `validateTiledMap` refuse au chargement une carte qui en manque un —
   * et la capacité par camp y est uniforme (mesuré au vrai parseur le 2026-09-11). Une carte ne peut
   * donc pas accepter moins de Pokemon que l'équipe déjà composée. Le repli reste écrit pour le jour
   * où une carte sortirait de ce moule : on retombe sur le premier format, ce qui reconstruit les
   * lignes plutôt que de tronquer une équipe en silence.
   */
  const changeMap = (): void => {
    // Ceinture et bretelles : le bandeau masque déjà le bouton dans ce cas, mais un changement que
    // le salon refuserait laisserait l'écran et le salon sur deux cartes différentes.
    if (isOnline() && (!isHost() || isSelfReady())) {
      return;
    }
    closeMapPicker = openMapPickerModal({
      currentMapId: effectiveMapId(),
      onPick: (mapId) => void applyMapChange(mapId),
    });
  };

  const applyMapChange = async (mapId: string): Promise<void> => {
    const previousFormatKey = formatKey;
    if (!(await loadMapChoice(mapId))) {
      showNetworkError(NetworkErrorCode.VersionIncompatible);
      return;
    }
    const kept = formatOptions.find((option) => option.key === previousFormatKey);
    if (kept === undefined) {
      const fallback = formatOptions[0];
      if (fallback === undefined) {
        throw new Error(`Map "${mapUrl}" has no formats`);
      }
      formatKey = fallback.key;
      slots = buildInitialSlots(fallback.format, humanIndex());
      announceOwnedSelections();
    }
    // L'hôte fait suivre au salon : l'invité doit voir la carte changer sous ses yeux, sinon il
    // compose pour un terrain qui n'est plus celui de la partie. Sur « Aléatoire », c'est bien
    // `random` qui part — la carte tirée reste secrète jusqu'au lancement.
    room?.setOptions({ mapId: mapChoiceId });
    render();
  };

  /**
   * Le solo bascule en partie en ligne, sur place (plan 208, étape 5).
   *
   * 🔴 Il n'y a **aucune navigation**, donc rien à faire traverser : la salle d'attente EST cet
   * écran (décision #897), et la composition est déjà dans `slots`. Le cadrage avait d'abord annoncé
   * l'inverse — « la composition doit traverser la création du salon » — et l'humain avait raison de
   * ne pas comprendre la difficulté : elle n'existait pas.
   *
   * Deux gestes seulement : garder mon camp en libérant les autres, puis ouvrir le salon.
   *
   * 🔴 **Le format ne change plus** (plan 209, Lot C3). Il était forcé à deux camps tant que le
   * réseau n'en acceptait pas d'autre ; ce n'est plus le cas, donc un joueur qui bascule en 4v4v4
   * garde son 4v4v4 — et ses trois autres camps deviennent des places à pourvoir au lieu d'être
   * rabattues sur un duel qu'il n'a pas demandé.
   */
  const switchToOnline = (): void => {
    if (isOnline()) {
      return;
    }
    const current = formatOptions.find((option) => option.key === formatKey);
    if (current === undefined) {
      return;
    }
    /*
     * Confirmation demandée SEULEMENT quand la bascule détruit quelque chose : un camp autre que le
     * mien composé à la main, qui va être libéré pour un joueur distant. Contre l'IA ça ne coûte que
     * l'équipe de l'IA — on bascule sans rien demander, parce que demander pour rien apprend au
     * joueur à cliquer sans lire. Arbitré ainsi avec l'humain.
     */
    const losesTeam = slots.some(
      (slot, index) => index > 0 && slot.assignedTeam != null && !slot.ephemeral,
    );
    if (losesTeam) {
      openGoOnlineConfirmModal({
        message: t("teamSelect.online.switchLosesTeam"),
        onConfirm: () => goOnline(current),
      });
      return;
    }
    goOnline(current);
  };

  /** La bascule elle-même, une fois le coût accepté (ou nul). */
  const goOnline = (chosen: Omit<FormatOption, "label">): void => {
    const { teamCount } = chosen.format;
    const kept = slots[0];
    slots = buildInitialSlots(chosen.format);
    // Mon camp survit à la bascule : c'est celui que je viens de composer, et le perdre serait
    // précisément ce qu'un joueur « qui s'est trompé de mode » ne pardonnerait pas. Les autres sont
    // libérés — en ligne, ce sont des places qui attendent quelqu'un.
    if (kept !== undefined) {
      slots[0] = kept;
    }
    networkIntent = { role: RoomRole.Host, teamCount };
    void createAsHost(teamCount).then(() => render());
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

  /** L'occupation que le SALON déclare pour ce camp, ou `undefined` hors ligne. */
  const seatOccupancyFor = (slotIndex: number): NetworkSeatOccupancy | undefined =>
    roomView?.seats.find((candidate) => candidate.seat === slotIndex + 1)?.occupancy;

  const setController = (
    slotIndex: number,
    controller: PlayerController,
    aiDifficulty?: AiDifficulty,
  ): void => {
    const slot = slots[slotIndex];
    if (!slot) {
      return;
    }
    /*
     * 🔴 L'état LOCAL peut déjà être à sa cible sans que la place du SALON le soit.
     *
     * Cas réel, trouvé en recette e2e : sur une place **libre** en ligne, presser « Moyenne » ne
     * faisait rien. `buildInitialSlots` pose déjà `Ai` + `DEFAULT_AI_DIFFICULTY` en repli local, donc
     * `setSlotController` répond « rien n'a changé » et on sortait ici — alors que le salon, lui, dit
     * `waiting`. Facile et Difficile marchaient, le DÉFAUT seul était muet, ce qui est le pire des
     * symptômes : deux boutons sur trois répondent.
     *
     * L'angle mort est plus ancien que le plan 214 — le bouton unique « IA » l'avait déjà, et c'est
     * pourquoi l'e2e §11.2 presse « Humain » d'abord. Il était simplement invisible tant que personne
     * ne désignait un niveau précis.
     */
    const localAChange = setSlotController(slot, controller, aiDifficulty);
    const salonDoitSuivre =
      room !== null &&
      seatOccupancyFor(slotIndex) !==
        (controller === PlayerController.Ai
          ? NetworkSeatOccupancy.Ai
          : NetworkSeatOccupancy.Waiting);
    if (!localAChange && !salonDoitSuivre) {
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
      // Le niveau part avec la bascule (plan 214) : sinon les autres pairs verraient « IA » sans
      // savoir laquelle, et ne le découvriraient qu'en entrant en combat.
      controller === PlayerController.Ai ? slot.aiDifficulty : undefined,
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
    if (key === formatKey) {
      return;
    }
    const chosen = formatOptions.find((option) => option.key === key);
    if (chosen === undefined) {
      return;
    }
    /*
     * En ligne, le format est un fait de SALON avant d'être un fait d'écran (plan 209, Lot C3) : le
     * salon recompose ses places et l'annonce aux autres. S'il refuse — partie lancée, hôte déjà
     * prêt, ou un invité qui sortirait du format — on ne touche à rien ici non plus, sinon l'écran
     * afficherait un format que personne d'autre ne voit.
     */
    if (isOnline() && room !== null && !room.setTeamCount(chosen.format.teamCount)) {
      return;
    }
    formatKey = key;
    slots = buildInitialSlots(currentFormat());
    render();
  };

  const buildHeader = (): HTMLElement => {
    // En-tête PARTAGÉ avec l'écran « Jouer en ligne » depuis le plan 207 : les règles `ts-header`
    // ne décrivaient pas cet écran-ci en particulier, elles décrivaient LE patron « écran plein »
    // du projet. Restées ici, le lobby aurait dû les recopier — deux jumeaux libres de diverger.
    const header = screenHeader(goBack);
    /*
     * 🔴 Le titre ne nomme PLUS la carte (plan 208). Deux raisons, et la seconde est structurelle :
     * le bandeau de partie la porte désormais dans les deux modes, donc le titre la redoublait ; et
     * sur « Aléatoire » il aurait affiché le nom de la carte TIRÉE, ce qui éventait le tirage avant
     * même que le joueur ait composé son équipe.
     */
    header.append(screenHeaderTitle(t("teamSelect.title")));

    /*
     * 🔴 Le sélecteur EST dans la salle d'attente, et pas au lobby (arbitrage humain du 2026-09-14).
     * Le plan 209 le disait ; l'implémentation l'avait déplacé au lobby pour graver le format avant
     * la naissance du code, ce qui n'était pas nécessaire : `Room.setTeamCount` recompose les places
     * sans toucher à l'adresse du salon.
     *
     * Un invité, lui, n'a rien à choisir : c'est l'hôte qui tient le format, et la rangée disparaît
     * plutôt que de s'afficher inerte — il n'y a pas de décision en attente de son côté.
     */
    if (isOnline() && (!isHost() || isSelfReady())) {
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

    header.append(screenHeaderSpacer(), picker);
    return header;
  };

  /**
   * Le bandeau de partie. Il n'existait qu'en ligne ; le plan 208 l'étend au SOLO, où il porte la
   * carte et le bouton qui la change — sans lui, plus rien à l'écran ne dirait sur quel terrain on
   * s'apprête à jouer, l'écran de choix ayant disparu.
   *
   * En ligne, les valeurs viennent du SALON et non de l'état local : c'est le salon qui fait foi
   * pour tout le monde, et un invité n'a aucun état local à afficher.
   */
  const buildGamePanel = (): HTMLElement => {
    // Les deux ensemble ou aucun : `roomView` est posé par `wireRoom` en même temps que `room`, et
    // les lire séparément laisserait le compilateur croire à un état mixte qui n'existe pas.
    const joined = room !== null && roomView !== null ? { room, view: roomView } : null;
    return createGamePanelElement(
      {
        code: joined?.room.code ?? null,
        mapName: mapDisplayName(),
        teamCount: joined?.view.options.teamCount ?? currentFormat().teamCount,
        autoPlacement: joined?.view.options.autoPlacement ?? autoPlacement,
        damagePreview: joined?.view.options.damagePreview ?? damagePreview,
        isHost: isHost(),
        /*
         * Un invité ne choisit pas de carte : elle lui arrive de l'hôte (plan 199).
         *
         * 🔴 Et l'hôte ne la change plus une fois PRÊT — même gel que les deux options du pied, et
         * pour une raison plus dure que la symétrie : `Room.setOptions` REFUSE dès que l'hôte s'est
         * déclaré prêt. Laisser la modale ouverte aurait changé sa carte locale sans que le salon
         * suive, et au lancement il aurait publié un terrain que personne n'avait vu. « Pas prêt »
         * dégèle, comme pour le reste.
         */
        canChangeMap: joined === null || (isHost() && !isSelfReady()),
      },
      {
        onCopyCode: (code) => void navigator.clipboard?.writeText(code),
        onChangeMap: changeMap,
        onGoOnline: switchToOnline,
      },
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
    // La place qui héberge MAINTENANT, jamais la constante : le rôle se transmet (plan 209, Lot C5).
    if (seatState.seat === (roomView?.hostSeat ?? HOST_SEAT)) {
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
    (seatState.seat === (roomView?.hostSeat ?? HOST_SEAT) ||
      seatState.occupancy === NetworkSeatOccupancy.Remote);

  const buildPlayerEntry = (slotIndex: number, slot: SlotState): PlayerColumnEntry => {
    // La place du salon correspondant à ce camp : les places sont numérotées à partir de 1.
    const seatState = roomView?.seats.find((seat) => seat.seat === slotIndex + 1);
    const isMine = room !== null && seatState?.seat === room.seat;

    return {
      props: {
        slotIndex,
        playerLabel: playerLabel(slotIndex),
        shortLabel: playerShortLabel(slotIndex),
        colorHex: teamColorToHex(slotIndex),
        controller: slot.controller,
        /*
         * 🔴 Le SALON fait foi quand il en dit quelque chose (plan 214).
         *
         * L'état local d'un invité n'a jamais reçu le choix de l'hôte : il afficherait son propre
         * défaut, donc « Moyenne » face à une place que l'hôte a mise en « Difficile » — un écran qui
         * ment sans erreur, et qu'on ne démentirait qu'en entrant en combat. Hors ligne, `seatState`
         * est absent et c'est l'état local qui décide, comme avant.
         */
        aiDifficulty: seatState?.aiDifficulty ?? slot.aiDifficulty,
        assignedTeam: slot.assignedTeam,
        ephemeral: slot.ephemeral,
        labels: {
          controllerHuman: t("teamSelect.controller.human"),
          controllerAiEasy: t("teamSelect.controller.aiEasy"),
          controllerAiMedium: t("teamSelect.controller.aiMedium"),
          controllerAiHard: t("teamSelect.controller.aiHard"),
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
        onSetController: (controller, aiDifficulty) =>
          setController(slotIndex, controller, aiDifficulty),
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

    /*
     * 🔴 Les cases lisent le SALON en ligne, comme le bandeau juste au-dessus (revue de code du
     * 2026-09-13).
     *
     * Elles lisaient les variables LOCALES, initialisées des préférences de CETTE machine : chez un
     * invité dont les réglages diffèrent de ceux de l'hôte, le même écran affichait deux réponses
     * contradictoires — la case cochée et grisée, sous un bandeau annonçant « NON ». C'est la même
     * famille que le bug de recette sur le nom de la carte, et le dernier de son espèce : en ligne,
     * c'est le salon qui fait foi, jamais un état local.
     *
     * Le défaut préexiste au plan 208 (l'encart lisait déjà le salon), il se solde ici.
     */
    const autoPlacementToggle = toggle(
      "team-select-auto-placement",
      t("teamSelect.autoPlacement.label"),
      roomView?.options.autoPlacement ?? autoPlacement,
      (value) => {
        autoPlacement = value;
        updateSettings({ autoPlacement: value });
        publishRoomOptions();
      },
    );

    const damagePreviewToggle = toggle(
      "team-select-damage-preview",
      t("teamSelect.damagePreview.label"),
      roomView?.options.damagePreview ?? damagePreview,
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
      host.replaceChildren(buildHeader(), buildGamePanel(), buildMain(), buildFooter());
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
      if (params.mapId === undefined) {
        root = el("div", "scr-root ts-root");
        host.append(root);
        await joinAsGuest();
        unbindScreenInput = bindScreenInput(goBack);
        return;
      }

      /*
       * 🔴 Le tirage d'« Aléatoire » a lieu ICI, une seule fois, et reste SECRET jusqu'au lancement
       * (plan 208, étape 6). `mapChoiceId` garde le choix du joueur, `mapUrl` la carte réellement
       * chargée : c'est cet écart qui permet au bandeau d'afficher « Aléatoire » pendant que la
       * scène de combat, elle, aura un vrai terrain à monter.
       *
       * Tirer ici plutôt qu'au « Lancer » n'est pas un raccourci : il faut une carte concrète pour
       * lire ses formats et bâtir les lignes. Et un seul tirage est la contrainte écrite au backlog
       * dès le 2026-09-03 — deux tirages, ce sont deux pairs sur deux terrains.
       */
      if (!(await loadMapChoice(params.mapId))) {
        throw new Error(`Unknown map id "${params.mapId}"`);
      }
      const chosen = pickFormatOption(
        networkIntent?.role === RoomRole.Host ? networkIntent.teamCount : undefined,
      );
      if (!chosen) {
        throw new Error(`Map "${mapUrl}" has no formats`);
      }
      formatKey = chosen.key;
      slots = buildInitialSlots(chosen.format);
      root = el("div", "scr-root ts-root");
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
      // La modale de carte ne vit pas dans l'arbre de cet écran : `root.remove()` ne la ferme pas.
      closeMapPicker?.();
      closeMapPicker = null;
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
    /*
     * 🔴 C'est le CHOIX qui part au salon, `random` compris — pas la carte tirée. Sans quoi un
     * invité curieux lirait le terrain dans l'état du salon et l'entrée « Aléatoire » ne servirait
     * plus à rien. L'identifiant résolu n'est publié qu'au `launch` (voir `onNetworkLaunch`).
     *
     * La garde reste, sur la carte effectivement chargée : pas de salon sur une carte qu'on ne sait
     * pas nommer. L'identifiant est le contrat entre les deux pairs — ouvrir malgré tout enverrait
     * « unknown » à l'invité, qui afficherait « versions incompatibles », un diagnostic faux prononcé
     * par le mauvais camp pour un salon qui n'aurait de toute façon jamais pu se jouer.
     */
    if (mapIdFromUrl(mapUrl) === undefined) {
      showNetworkError(NetworkErrorCode.VersionIncompatible);
      return;
    }
    try {
      room = await Room.create(onlineRoomDeps(), {
        mapId: mapChoiceId,
        teamCount,
        autoPlacement,
        damagePreview,
      });
    } catch (error) {
      showNetworkError(networkErrorCodeOf(error));
      return;
    }
    countAction(TelemetryAction.RoomCreated);
    wireRoom(room);
    // L'hôte arrive ici avec ses lignes déjà composées (`buildInitialSlots` a tiré une équipe pour
    // chaque IA) : il les pose au salon d'emblée, faute de quoi elles partiraient vides au `start`.
    announceOwnedSelections();
  }

  /**
   * L'invité adopte le salon déjà joint, puis découvre la carte et le format dans son état.
   *
   * 🔴 **La connexion ne se fait plus ici** (plan 207, étape 5) : c'est l'écran `lobby` qui joint,
   * AVANT de naviguer, pour que le refus se prononce là où le joueur a encore sa roue sous les yeux.
   * Un code mal recopié le posait sinon devant cet écran-ci — une composition d'équipe complète pour
   * une partie qui n'existe pas — le refus réduit à une ligne rouge en bas du pied de page.
   *
   * Rien à passer en paramètre de navigation pour autant : le salon appartient à la SESSION depuis
   * le plan 199 (`online-room.ts`), précisément pour survivre aux transitions d'écran. On le lit.
   *
   * Fail-fast si la session n'en tient aucun : c'est un défaut de câblage, pas un refus réseau, et
   * un « versions incompatibles » de consolation mentirait sur la cause.
   */
  async function joinAsGuest(): Promise<void> {
    const joined = getOnlineRoom();
    if (joined === null) {
      throw new Error("Guest reached team-select with no room held by the session");
    }
    room = joined;
    wireRoom(joined);

    /*
     * 🔴 L'invité charge lui aussi une carte même quand l'hôte a choisi « Aléatoire » : il lui en
     * faut une pour lire les formats et bâtir ses lignes. Son tirage local n'est JAMAIS celui qui
     * sera joué — le `start` de l'hôte porte l'identifiant résolu, et `enterNetworkBattle` recharge
     * à partir de lui. Ce que l'invité voit d'ici là, c'est « Aléatoire », comme l'hôte.
     */
    if (!(await loadMapChoice(joined.view.options.mapId))) {
      showNetworkError(NetworkErrorCode.VersionIncompatible);
      return;
    }
    /*
     * L'invité dérive un format pour BÂTIR SON ÉCRAN — il lui faut des lignes à afficher. Ce n'est
     * pas celui qui sera joué : depuis le plan 211, le `start` de l'hôte porte le format résolu, et
     * `enterNetworkBattle` prend celui-là. Même partage que la carte depuis le plan 208 — ce qu'on
     * voit avant le lancement est local, ce qu'on joue vient du message.
     */
    const chosen = pickFormatOption(joined.view.options.teamCount);
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
  /**
   * L'invité SUIT le format que l'hôte change (plan 209, Lot C3, retour de recette 2026-09-14).
   *
   * 🔴 Sans ça, il gardait les lignes bâties à son arrivée : l'hôte repassait de quatre camps à
   * deux, et l'invité continuait d'afficher un troisième joueur — avec l'équipe aléatoire qu'on lui
   * avait tirée. Deux pairs ne voyaient plus la même partie, ce qui est exactement ce que l'état de
   * salon existe pour empêcher.
   */
  function syncFormat(view: RoomView): void {
    const chosen = pickFormatOption(view.options.teamCount);
    if (chosen === undefined || chosen.key === formatKey) {
      return;
    }
    const kept = slots[0];
    formatKey = chosen.key;
    slots = buildInitialSlots(chosen.format);
    // Ma propre ligne survit : le format a changé, pas mon équipe.
    if (kept !== undefined) {
      slots[0] = kept;
    }
  }

  function wireRoom(joined: Room): void {
    holdOnlineRoom(joined);
    roomView = joined.view;
    roomListeners.push(
      joined.onChange((view) => {
        roomView = view;
        syncGuestMap(view);
        syncFormat(view);
        render();
      }),
      joined.onError((code) => {
        /*
         * 🔴 Éjecté : on ne RESTE pas sur la salle d'attente d'un salon qui ne nous attend plus
         * (retour de recette, 2026-09-14). Le joueur y voyait une ligne rouge en pied de page devant
         * un écran de composition encore complet — il ne comprenait pas qu'il était sorti. On le
         * ramène au lobby, qui prononce la cause en modale, comme les refus d'entrée du plan 207.
         */
        if (code === NetworkErrorCode.FormatReduit) {
          releaseOnlineRoom();
          navigate("lobby", { refusal: code });
          return;
        }
        showNetworkError(code);
      }),
      joined.onStart((start) => enterNetworkBattle(start)),
      joined.onLaunchCancelled(() => showNetworkError(NetworkErrorCode.DelaiDepasse)),
    );
  }
}
