import { type Action, PlayerController } from "@pokemon-tactic/core";
import { Listeners } from "./listeners.js";
import {
  type ActionMessage,
  type ChecksumMessage,
  type ForfeitMessage,
  isCompatibleVersion,
  NETWORK_VERSION,
  NetworkErrorCode,
  type NetworkForfeitReason,
  type NetworkMessage,
  type NetworkRoomOptions,
  NetworkSeatOccupancy,
  type NetworkSeatState,
  type NetworkSeeds,
  type NetworkTeamSelection,
  type ResyncMessage,
  type ResyncRequestMessage,
  type StartMessage,
  type StartSeat,
} from "./protocol.js";
import {
  generateRoomCode,
  HOST_SEAT,
  hostPeerId,
  peerIdForSeat,
  seatFromPeerId,
} from "./room-code.js";
import {
  BATTLE_GRACE_SHORT_MS,
  graceDelayFor,
  HANDSHAKE_TIMEOUT_MS,
  HOST_REDIAL_INTERVAL_MS,
  LAUNCH_ACK_TIMEOUT_MS,
} from "./room-config.js";
import { type RoomDeps, RoomRole, type RoomTimers, type RoomView } from "./room-types.js";
import {
  type ChannelHealth,
  claimOwnIdentity,
  type NetworkChannel,
  NetworkTransportError,
  REJOIN_RETRY_DELAYS_MS,
} from "./transport.js";

/**
 * Le salon en ligne (plan 199, étape 3), des deux côtés : l'hôte, qui fait autorité sur l'état, et
 * l'invité, qui l'applique.
 *
 * **Le modèle mental, qui explique tout le reste : un départ n'est pas un changement d'état, c'est un
 * silence** (décision #905). Rien ne disparaît quand quelqu'un se tait — sa place est là, son équipe
 * est là. Seules ses décisions s'arrêtent. Ce qu'on choisit, c'est quoi faire du silence, et la
 * réponse est **jamais de destruction immédiate** : sur téléphone, « partir » est un accident
 * permanent (écran verrouillé, appel entrant), et l'hôte va **forcément** mettre son onglet en
 * arrière-plan pour aller coller son code dans une messagerie — c'est dans le flux, pas un cas
 * limite. Un onglet en arrière-plan voit ses minuteurs fortement ralentis ; le chien de garde se
 * fonde donc sur les **messages reçus**, jamais sur une horloge locale fine.
 *
 * Quoi faire du silence est arrêté dans `room-config.ts` — les délais et `graceDelayFor`, la table
 * de réglages qu'une recette rouvre. Le vocabulaire du salon est dans `room-types.ts`.
 */

/** Les minuteurs du navigateur, quand personne n'en injecte d'autres. */
const defaultTimers: RoomTimers = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const defaultSleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

export class Room {
  private readonly seats = new Map<number, NetworkSeatState>();
  private readonly channels = new Map<number, NetworkChannel>();
  private readonly selections = new Map<number, NetworkTeamSelection>();
  private readonly graceTimers = new Map<number, { handle: unknown; cleanClose: boolean }>();
  private readonly announcedBye = new Set<number>();
  private readonly startAcks = new Set<number>();

  private readonly changeListeners = new Listeners<[view: RoomView]>();
  private readonly errorListeners = new Listeners<[code: NetworkErrorCode]>();
  private readonly startListeners = new Listeners<[start: StartMessage]>();
  private readonly launchCancelledListeners = new Listeners();
  private readonly actionListeners = new Listeners<[action: ActionMessage]>();
  /**
   * Actions reçues avant que quiconque n'écoute, gardées pour le premier abonné (plan 201).
   *
   * 🔴 **Sans ce tampon, elles étaient jetées sans trace, et c'est l'honnête qui payait.** Les deux
   * pairs n'entrent pas en combat au même instant — l'écran charge sa carte et ses atlas, plusieurs
   * secondes d'écart entre un cache chaud et un cache froid — alors que le salon, lui, est déjà là et
   * reçoit. Le pair rapide jouait, le lent n'avait pas encore branché son écouteur, l'action
   * disparaissait ; puis son index restait en retard d'un cran à chaque action suivante, donc trois
   * refus `desynced_index` et il **éliminait un joueur qui n'avait rien fait**.
   *
   * Même famille que le tampon jeté du Lot B1 (voir l'en-tête de `app/network/online-room.ts`) :
   * ce qui a été envoyé avant qu'on soit prêt doit arriver quand on l'est.
   */
  private readonly bufferedActions: ActionMessage[] = [];
  private readonly forfeitListeners = new Listeners<[forfeit: ForfeitMessage]>();
  /**
   * Places dont le silence est devenu un fait, **une fois la partie lancée** (plan 202, Lot B3).
   *
   * 🔴 Le salon SIGNALE, il ne décide pas (décision #951) : il ne connaît ni les joueurs ni le
   * moteur, donc il ne peut pas prononcer un forfait. C'est `online-battle.ts`, qui tient à la fois
   * le salon et l'orchestrateur, qui traduit la place en joueur et applique.
   */
  private readonly peerAbsentListeners = new Listeners<[seat: number]>();
  /**
   * Santé du chemin ICE de chaque pair (plan 202, décision #956). Purement informatif : aucun
   * forfait n'en découle, il ne sert qu'à dire au joueur ce qui se passe cinq secondes après une
   * coupure au lieu de soixante-quinze.
   */
  private readonly peerHealthListeners = new Listeners<[seat: number, health: ChannelHealth]>();
  /**
   * On commence à attendre le retour d'une place, partie lancée (plan 202). Porte le **budget
   * exact** que le salon vient de choisir — court après un `bye`, long après un silence, raccourci à
   * la deuxième chute — pour que l'interface puisse afficher un décompte qui ne mente pas.
   */
  private readonly peerAwaitedListeners = new Listeners<[seat: number, graceMs: number]>();
  /** Une place attendue vient de se rebrancher avant l'échéance (plan 202). */
  private readonly peerReturnedListeners = new Listeners<[seat: number]>();
  private readonly resyncRequestListeners = new Listeners<[message: ResyncRequestMessage]>();
  private readonly resyncListeners = new Listeners<[message: ResyncMessage]>();
  private readonly checksumListeners = new Listeners<[message: ChecksumMessage]>();
  /**
   * Les rattrapages arrivés avant que le combat n'écoute, comme `bufferedActions` (plan 202).
   *
   * Même piège, même parade : le revenant demande la suite depuis `attach`, mais la réponse peut
   * revenir pendant que son écran de combat finit de se monter. Sans ce tampon, la queue du journal
   * serait perdue et il resterait bloqué un tour derrière pour toujours.
   */
  private readonly bufferedResyncs: ResyncMessage[] = [];
  /**
   * Places dont la connexion est déjà tombée une fois pendant cette partie. Leur deuxième chute ne
   * vaut plus le délai long (décision #950) : on ne redonne pas le bénéfice du doute à qui l'a déjà
   * consommé. Marqué à la fermeture du canal, pas à l'expiration du délai — sinon, en 1v1, le
   * premier déclenchement prononçant déjà le forfait, il n'y aurait jamais de « fois suivante ».
   */
  private readonly seatsAbsentOnce = new Set<number>();

  private roomOptions: NetworkRoomOptions;
  private locked = false;
  private left = false;
  /** Un `room_state` a-t-il déjà été appliqué ? Lu par la poignée de main de l'invité. */
  private hasRoomState = false;
  private launchAckTimer: unknown;
  private pendingLaunch:
    | {
        /**
         * Les places dont on attend l'accusé. Retenues et non recalculées : c'est la liste qui a
         * reçu le `start`, et c'est elle qui dit si une fermeture survenue depuis rend le lancement
         * caduc.
         */
        readonly awaitedSeats: readonly number[];
        isComplete: () => boolean;
        settle: (acked: boolean) => void;
      }
    | undefined;

  /** Le rappel de l'hôte en cours, s'il y en a un. Voir `scheduleHostRedial`. */
  private hostRedialTimer: unknown;

  private readonly timers: RoomTimers;
  private readonly sleep: (delayMs: number) => Promise<void>;

  private constructor(
    private readonly deps: RoomDeps,
    readonly code: string,
    readonly role: RoomRole,
    readonly seat: number,
    options: NetworkRoomOptions,
  ) {
    this.roomOptions = options;
    this.timers = deps.timers ?? defaultTimers;
    this.sleep = deps.sleep ?? defaultSleep;
  }

  /**
   * L'hôte crée le salon. Le format est déjà gravé (décision #896) : il vient de l'écran `lobby`,
   * avant la naissance du code, ce qui supprime toute éjection de joueur.
   *
   * La prise de la place 1 passe par les réessais : c'est notre propre identité, et le seul
   * « occupé » plausible est un fantôme de nous-même laissé par une partie précédente.
   */
  static async create(deps: RoomDeps, options: NetworkRoomOptions): Promise<Room> {
    const code = (deps.generateCode ?? generateRoomCode)();
    await claimOwnIdentity(deps.transport, hostPeerId(code), deps.sleep ?? defaultSleep);

    const room = new Room(deps, code, RoomRole.Host, HOST_SEAT, options);
    room.initializeHostSeats();
    room.listenIncoming();
    return room;
  }

  /**
   * Un invité rejoint. Il balaie les places à partir de la seconde et prend la première libre : le
   * **refus de l'annuaire est le mécanisme d'allocation** (décision #898), personne ne coordonne, et
   * deux arrivants simultanés ne peuvent pas obtenir la même place.
   *
   * Il balaie jusqu'à `maxSeats` et non jusqu'au nombre de places du format, qu'il ne connaît pas
   * encore — le format vit dans l'état du salon, et il n'y a pas encore de canal pour le lire. Une
   * place au-delà du format est refusée par l'hôte à la poignée de main, ce qui est le bon endroit :
   * lui seul sait combien de places sa partie compte.
   *
   * Aucun réessai pendant le balayage : ici « occupée » est la réponse **normale**, pas un fantôme.
   */
  static async join(deps: RoomDeps, code: string): Promise<Room> {
    const claimedSeat = await claimFirstFreeSeat(deps, code);
    const room = new Room(deps, code, RoomRole.Guest, claimedSeat, placeholderOptions());
    room.listenIncoming();

    try {
      await room.handshakeWithHost();
    } catch (error) {
      room.leave();
      throw error;
    }
    return room;
  }

  /**
   * Un pair revient à la place qu'il occupait, en pleine partie (plan 202, étape 5).
   *
   * 🔴 **Ni `create` ni `join`, et les trois diffèrent vraiment.** `join` *balaie* les places libres
   * et prendrait donc une autre place que la sienne, ce qui rendrait le journal sauvegardé
   * inapplicable — il décrit la partie vue depuis un camp précis. Ici la place est **connue**, elle
   * vient de la sauvegarde, et on la réclame nommément par les réessais de `claimOwnIdentity` :
   * l'annuaire retient l'ancienne adresse quelques secondes après une coupure, donc revenir trop
   * vite se verrait refuser sa propre place sans eux.
   *
   * L'hôte revient par ce même chemin : le code **est** son adresse (#904), donc il reprend la
   * place 1 et redevient joignable. La seule différence est qu'il n'a personne à qui se présenter —
   * ce sont les autres qui se rebrancheront sur lui.
   *
   * Le `welcome` obtenu prouve seulement que l'hôte est là et compatible ; ce qui ramène la partie
   * est le rattrapage, que l'appelant demande ensuite (`sendResyncRequest`).
   */
  static async rejoin(
    deps: RoomDeps,
    code: string,
    seat: number,
    /**
     * Les places qui ont le droit de nous rappeler — celles que la partie comptait, sauf la nôtre et
     * sauf les places tenues par l'IA, qui ne se connectent jamais.
     *
     * 🔴 **Sans elles, un hôte qui revient refuse son propre invité** (recette 2026-09-09) : son
     * salon est NEUF, donc sans aucun délai de grâce en cours, alors qu'`attachIncoming` n'admet sur
     * un salon verrouillé que les places dont une grâce court. Il refermait le canal à chaque
     * tentative de rappel, l'invité rappelait en boucle, et la partie mourait au bout du délai. Un
     * salon revenu n'a aucune mémoire : c'est l'appelant qui la lui rend, depuis la sauvegarde.
     */
    awaitedSeats: readonly number[] = [],
  ): Promise<Room> {
    await claimOwnIdentity(
      deps.transport,
      peerIdForSeat(code, seat),
      deps.sleep ?? defaultSleep,
      // Bien plus patient qu'à la création : sur une reconnexion, « occupé » ne peut être que notre
      // propre fantôme, et l'annuaire met plusieurs secondes à le constater (voir la constante).
      REJOIN_RETRY_DELAYS_MS,
      // Et on encaisse aussi les hoquets du service, pas seulement le fantôme de notre adresse.
      true,
    );
    const role = seat === HOST_SEAT ? RoomRole.Host : RoomRole.Guest;
    const room = new Room(deps, code, role, seat, placeholderOptions());
    // Verrouillé d'emblée : la partie est en cours, et un salon qui se croirait ouvert accepterait
    // des arrivants et remettrait des places en `Waiting` au milieu d'un combat.
    room.locked = true;

    /*
     * 🔴 **Les places, AVANT d'écouter.** Un salon revenu n'a pas d'état de places : seul `create`
     * appelle `initializeHostSeats`. Or `handleHello` refuse toute place absente de `this.seats` —
     * donc un hôte revenu acceptait le canal de son invité (sa grâce courait) puis le **refermait
     * aussitôt** à la présentation. L'invité se rebranchait, se faisait éjecter, rappelait : le
     * bandeau d'attente clignotait chez lui et la partie mourait au délai (recette 2026-09-09).
     *
     * On ne reconstruit que ce qui compte : notre place, et celles qui ont le droit de nous rappeler.
     * Prêtes d'office — une partie lancée n'attend plus aucune confirmation d'équipe.
     */
    room.seats.set(seat, {
      seat,
      occupancy: NetworkSeatOccupancy.Human,
      ready: true,
    });
    for (const awaited of awaitedSeats) {
      if (awaited !== seat) {
        room.seats.set(awaited, {
          seat: awaited,
          occupancy: NetworkSeatOccupancy.Remote,
          ready: true,
        });
      }
    }

    room.listenIncoming();

    /*
     * La fenêtre d'accueil, et elle est BORNÉE dans le temps comme n'importe quelle grâce : sans
     * échéance, un pair revenu attendrait pour toujours quelqu'un qui a fermé son onglet pour de
     * bon. Passer par `graceTimers` plutôt que par un ensemble à part n'est pas un raccourci — c'est
     * exactement le même état que « cette place peut revenir », donc `attachIncoming` et
     * `resolveDeparture` marchent sans un cas particulier de plus.
     */
    for (const awaited of awaitedSeats) {
      if (awaited !== seat) {
        room.openReconnectWindow(awaited);
      }
    }

    if (role === RoomRole.Host) {
      return room;
    }

    try {
      await room.handshakeWithHost();
    } catch (error) {
      room.leave();
      throw error;
    }
    return room;
  }

  get view(): RoomView {
    return {
      code: this.code,
      role: this.role,
      seat: this.seat,
      options: this.roomOptions,
      seats: [...this.seats.values()].sort((left, right) => left.seat - right.seat),
      locked: this.locked,
      awaited: [...this.graceTimers.entries()].map(([seat, timer]) => ({
        seat,
        cleanClose: timer.cleanClose,
      })),
    };
  }

  onChange(listener: (view: RoomView) => void): () => void {
    return this.changeListeners.subscribe(listener);
  }

  /** Les causes de refus à afficher. Énumération fermée, ce sont aussi les valeurs de télémétrie. */
  onError(listener: (code: NetworkErrorCode) => void): () => void {
    return this.errorListeners.subscribe(listener);
  }

  /** L'entrée en combat. Porte tout ce qu'il faut pour monter le même combat sans un mot de plus. */
  onStart(listener: (start: StartMessage) => void): () => void {
    return this.startListeners.subscribe(listener);
  }

  /**
   * Le lancement a été annulé faute d'accusé. Ramène à la salle d'attente celui qui avait déjà reçu
   * le `start` — voir `launch()` pour pourquoi ce cas existe.
   */
  onLaunchCancelled(listener: () => void): () => void {
    return this.launchCancelledListeners.subscribe(listener);
  }

  /**
   * Une action de combat d'un autre camp (plan 201, Lot B2).
   *
   * Le salon ne la juge pas — il n'a pas de moteur. Il garantit seulement qu'elle vient bien de la
   * place qu'elle annonce (`isSpokenFor`) et qu'elle a la bonne forme (`isNetworkMessage`). Sa
   * **légalité** est l'affaire de l'orchestrateur, seul à tenir un `getLegalActions()`.
   */
  onAction(listener: (action: ActionMessage) => void): () => void {
    const unsubscribe = this.actionListeners.subscribe(listener);
    // Ce qui est arrivé avant qu'on écoute part maintenant, dans l'ordre de réception.
    if (this.bufferedActions.length > 0) {
      const kept = [...this.bufferedActions];
      this.bufferedActions.length = 0;
      this.bufferedResyncs.length = 0;
      for (const message of kept) {
        listener(message);
      }
    }
    return unsubscribe;
  }

  /** Un camp abandonne : barème épuisé (B2), volontaire ou chien de garde (B3). */
  onForfeit(listener: (forfeit: ForfeitMessage) => void): () => void {
    return this.forfeitListeners.subscribe(listener);
  }

  /**
   * Une empreinte d'état est arrivée d'un pair (plan 203, Lot B4).
   *
   * **Pas de tampon**, contrairement aux actions et aux rattrapages : une empreinte périmée n'a
   * aucune valeur — elle porte un ancrage précis, et si le combat n'écoutait pas encore, l'ancrage
   * est déjà passé. La suivante arrive à l'action d'après.
   */
  onChecksum(listener: (message: ChecksumMessage) => void): () => void {
    return this.checksumListeners.subscribe(listener);
  }

  /**
   * Une place s'est tue **et son délai de grâce est écoulé**, partie lancée (plan 202, Lot B3).
   *
   * Ce n'est pas un forfait : c'est le constat qu'il n'y a plus personne à cette place. Qui décide
   * quoi en faire est l'affaire de l'appelant — voir décision #951 et `resolveDeparture`.
   */
  onPeerAbsent(listener: (seat: number) => void): () => void {
    return this.peerAbsentListeners.subscribe(listener);
  }

  /**
   * Le chemin vers un pair s'est dégradé ou rétabli (plan 202, décision #956).
   *
   * 🔴 **Ne prononce aucun forfait** : `disconnected` se rétablit très souvent tout seul. C'est le
   * chien de garde qui tranche ; ceci ne fait qu'alimenter le bandeau.
   */
  onPeerHealth(listener: (seat: number, health: ChannelHealth) => void): () => void {
    return this.peerHealthListeners.subscribe(listener);
  }

  /**
   * Le canal d'une place vient de se refermer **en pleine partie**, et son délai de grâce court
   * (plan 202). `graceMs` est le budget réellement accordé, pas une constante à redeviner.
   */
  onPeerAwaited(listener: (seat: number, graceMs: number) => void): () => void {
    return this.peerAwaitedListeners.subscribe(listener);
  }

  /**
   * Une place qu'on attendait est revenue **avant** son échéance (plan 202).
   *
   * C'est le pendant de `onPeerAwaited`, et il ne va pas de soi : le canal d'un revenant est un
   * canal **neuf**, dont l'état ICE ne change pas en s'ouvrant. Sans ce signal, rien n'annoncerait
   * le retour et le bandeau « en attente » resterait affiché sur une partie qui a repris.
   */
  onPeerReturned(listener: (seat: number) => void): () => void {
    return this.peerReturnedListeners.subscribe(listener);
  }

  /** Un pair revenu réclame les actions jouées pendant son absence (plan 202, décision #955). */
  onResyncRequest(listener: (message: ResyncRequestMessage) => void): () => void {
    return this.resyncRequestListeners.subscribe(listener);
  }

  /** La queue du journal nous parvient. Ce qui est arrivé avant qu'on écoute part maintenant. */
  onResync(listener: (message: ResyncMessage) => void): () => void {
    const unsubscribe = this.resyncListeners.subscribe(listener);
    if (this.bufferedResyncs.length > 0) {
      const kept = [...this.bufferedResyncs];
      this.bufferedResyncs.length = 0;
      for (const message of kept) {
        listener(message);
      }
    }
    return unsubscribe;
  }

  /** « J'en suis là, donne-moi la suite. » */
  sendResyncRequest(actionIndex: number): void {
    this.broadcast({ type: "resync_request", seat: this.seat, actionIndex });
  }

  /** La queue du journal, en réponse. Une liste vide est une réponse valide et fréquente. */
  sendResync(fromIndex: number, actions: readonly Action[]): void {
    this.broadcast({ type: "resync", seat: this.seat, fromIndex, actions });
  }

  /**
   * Diffuse une action que **notre** moteur a déjà acceptée.
   *
   * `actionIndex` est le nombre d'actions enregistrées chez nous avant celle-ci : c'est ce qui
   * permet au destinataire de dire « je ne suis pas au même point » au lieu d'appliquer l'action au
   * mauvais acteur (décision D3).
   *
   * Diffusé au maillage entier, pas au seul adversaire : en 1v1 c'est indiscernable, et à trois
   * camps tout le monde doit voir chaque action pour tenir la même partie.
   */
  sendAction(actionIndex: number, action: Action, timedOut?: true): void {
    this.broadcast({
      type: "action",
      seat: this.seat,
      actionIndex,
      action,
      // Jamais `timedOut: false` : l'absence dit déjà « ce n'était pas un dépassement », et deux
      // façons d'écrire le même message est une façon d'en oublier une (plan 202).
      ...(timedOut === undefined ? {} : { timedOut }),
    });
  }

  /**
   * Notre empreinte d'état au point d'ancrage `actionIndex` (plan 203, Lot B4).
   *
   * Diffusée sans rien attendre en retour : chaque pair compare de son côté, et un pair qui ne
   * répond pas n'est pas le problème de ce mécanisme — c'est celui du chien de garde du Lot B3.
   */
  sendChecksum(actionIndex: number, digest: string): void {
    this.broadcast({ type: "checksum", seat: this.seat, actionIndex, digest });
  }

  /**
   * Annonce qu'un camp est éliminé — le nôtre (abandon volontaire, Lot B3) ou un autre dont les
   * actions ne concordent plus avec notre moteur (Lot B2).
   *
   * Diffusé à tout le maillage, y compris à l'intéressé : les autres joueurs doivent savoir pourquoi
   * un camp disparaît, et l'intéressé doit savoir qu'il est éliminé. Sans ce message, un pair dont
   * les actions sont refusées continuerait de jouer seul dans le vide jusqu'au chien de garde.
   */
  sendForfeit(forfeitedSeat: number, reason: NetworkForfeitReason): void {
    this.broadcast({ type: "forfeit", seat: this.seat, forfeitedSeat, reason });
  }

  /**
   * L'équipe composée pour une place.
   *
   * Chacun ne pose que ce qu'il possède : sa propre place, plus — pour l'hôte — les places tenues
   * par l'IA, dont il compose les équipes. Toute autre place est refusée en silence : un pair qui
   * prétendrait choisir l'équipe d'un autre n'est pas une erreur à afficher, c'est un message à
   * ignorer.
   *
   * Seule sa propre place est **annoncée** aux autres ; les équipes IA de l'hôte n'intéressent
   * personne avant le `start`, qui les porte.
   */
  setSeatSelection(seat: number, selection: NetworkTeamSelection): void {
    if (this.left || !this.ownsSeat(seat)) {
      return;
    }
    this.selections.set(seat, selection);
    if (seat === this.seat) {
      this.broadcast({ type: "team_select", seat, selection });
    }
    this.notifyChange();
  }

  private ownsSeat(seat: number): boolean {
    if (seat === this.seat) {
      return true;
    }
    // L'hôte compose les places que personne ne tient : les IA, et les places libres — dont
    // l'équipe servira, puisqu'une place restée libre part en IA au lancement.
    const occupancy = this.seats.get(seat)?.occupancy;
    return (
      this.role === RoomRole.Host &&
      (occupancy === NetworkSeatOccupancy.Ai || occupancy === NetworkSeatOccupancy.Waiting)
    );
  }

  setReady(ready: boolean): void {
    if (this.left) {
      return;
    }
    const seatState = this.seats.get(this.seat);
    if (seatState !== undefined) {
      this.seats.set(this.seat, { ...seatState, ready });
    }
    if (this.role === RoomRole.Host) {
      this.broadcastRoomState();
    } else {
      this.broadcast({ type: "ready", seat: this.seat, ready });
    }
    this.notifyChange();
  }

  /**
   * L'hôte change un paramètre de partie. Refusé dès que **lui-même** s'est déclaré prêt.
   *
   * C'était « dès que quelqu'un est prêt » (recette 2026-09-04) : un invité qui confirmait retirait
   * à l'hôte le contrôle d'une décision qui n'était pas la sienne, sans lui laisser aucun moyen de la
   * reprendre. Rattaché à sa propre confirmation, le gel reste réversible — « Pas prêt » dégèle — et
   * il garde son sens : on ne change pas la règle après s'être engagé dessus.
   */
  setOptions(options: Partial<Omit<NetworkRoomOptions, "teamCount">>): void {
    this.assertHost();
    if (this.left || this.seats.get(this.seat)?.ready === true) {
      return;
    }
    this.roomOptions = { ...this.roomOptions, ...options };
    this.broadcastRoomState();
    this.notifyChange();
  }

  /**
   * L'hôte bascule une ligne entre **IA** et **place libre**. C'est aussi ce qui lui permet de
   * **forcer** le lancement : repasser en IA les lignes que personne ne tient.
   *
   * 🔴 `Human` est refusé, et ce n'est pas une restriction de confort — c'était une **impasse**
   * (corrigé le 2026-09-05). `Human` sur une place que personne ne tient posait `ready: false` pour
   * une confirmation que personne ne pouvait donner : « Lancer » restait mort, et l'hôte ne pouvait
   * même pas revenir en arrière, `canEditSlot` ne rendant la main que sur `Ai` et `Waiting`. Le
   * salon n'avait plus d'issue que d'être quitté.
   *
   * Rien n'est perdu au passage : `Waiting` **est** l'état « j'attends un joueur », il l'affiche
   * (« Place libre »), il accueille un arrivant, et il part en IA au lancement si personne ne vient.
   * `Human` ne décrit qu'une place tenue par celui qui est devant l'écran, ce que `setSeatOccupancy`
   * ne vise jamais : sa propre place est déjà refusée deux lignes plus haut.
   */
  setSeatOccupancy(seat: number, occupancy: NetworkSeatOccupancy): void {
    this.assertHost();
    const seatState = this.seats.get(seat);
    if (this.left || seatState === undefined || seat === HOST_SEAT) {
      return;
    }
    // Une place tenue par un joueur distant connecté ne se bascule pas sous ses pieds : il faudrait
    // d'abord le déconnecter, ce que le Lot B1 ne propose pas.
    if (seatState.occupancy === NetworkSeatOccupancy.Remote) {
      return;
    }
    if (occupancy === NetworkSeatOccupancy.Human) {
      return;
    }
    // Une place IA **ou libre** est prête d'office : il n'y a personne dont on attendrait la
    // confirmation, et l'exiger bloquerait le lancement pour toujours.
    this.seats.set(seat, { ...seatState, occupancy, ready: true });
    this.broadcastRoomState();
    this.notifyChange();
  }

  /**
   * L'hôte grave la partie et la diffuse (étape 6).
   *
   * 🔴 **Le lancement est accusé** (décision #903). Sans accusé, un pair qui manque le `start` reste
   * sur l'écran d'équipe pendant que les autres jouent, et **aucun moment n'existe** où quelqu'un
   * s'en aperçoit : il attend un tour qui n'arrivera jamais.
   *
   * Ce qui suit du choix du plan de n'avoir que `start` et `start_ack` : l'invité entre en combat
   * **dès le `start`**, sans attendre que les autres aient accusé — il n'a aucun moyen de savoir où
   * en sont les autres. C'est l'hôte qui garde le compte, n'entre en combat qu'une fois tous les
   * accusés reçus, et **rappelle** ceux qui étaient partis en diffusant un état de salon déverrouillé
   * (`onLaunchCancelled`). Un invité peut donc voir l'écran de combat une seconde avant d'être ramené
   * à la salle d'attente ; c'est le prix d'un protocole sans troisième message, et ça n'arrive que
   * quand un pair a réellement disparu au pire moment.
   */
  async launch(seeds: NetworkSeeds): Promise<void> {
    this.assertHost();
    if (this.left || this.locked) {
      return;
    }

    // Verrouillé dès « Lancer » : plus aucune connexion acceptée.
    this.locked = true;
    this.broadcastRoomState();
    this.notifyChange();

    const start: StartMessage = {
      type: "start",
      options: this.roomOptions,
      seeds,
      seats: this.composeStartSeats(),
    };

    const awaitedSeats = [...this.channels.keys()];
    this.startAcks.clear();

    if (awaitedSeats.length === 0) {
      // Personne à attendre : un salon entièrement tenu par des IA. Le maillage ne coûte qu'en
      // humains (décision #901), et un salon « 12 joueurs » à un seul humain n'a aucun canal.
      this.broadcast(start);
      this.emitStart(start);
      return;
    }

    const everyoneAcked = this.waitForStartAcks(awaitedSeats);
    this.broadcast(start);

    const acked = await everyoneAcked;
    // Le salon a pu être quitté pendant l'attente — c'est même ce qui solde la promesse dans ce cas.
    // Ni entrer en combat ni rouvrir un salon qui n'existe plus.
    if (this.left) {
      return;
    }
    if (acked) {
      this.emitStart(start);
      return;
    }
    this.cancelLaunch();
  }

  /** Départ volontaire. Le `bye` part **avant** la fermeture : c'est lui qui vaut le délai court. */
  leave(): void {
    if (this.left) {
      return;
    }
    this.left = true;
    this.broadcast({ type: "bye", seat: this.seat });
    this.bufferedActions.length = 0;
    this.bufferedResyncs.length = 0;
    this.timers.clearTimeout(this.hostRedialTimer);
    this.hostRedialTimer = undefined;
    for (const timer of this.graceTimers.values()) {
      this.timers.clearTimeout(timer.handle);
    }
    this.graceTimers.clear();
    // Solder le lancement en cours, sinon la promesse de `waitForStartAcks` ne se règle **jamais** :
    // son seul autre dénouement était son minuteur d'accusé. `launch()` s'arrête alors sur
    // `this.left` plutôt que d'annuler un lancement dans un salon qui n'existe plus.
    //
    // Ça coupe aussi le minuteur — `settle` le fait — donc pas de `clearTimeout` ici : les deux sont
    // posés d'un seul geste par `waitForStartAcks` et n'ont aucun moyen d'être désynchronisés.
    this.pendingLaunch?.settle(false);
    this.deps.transport.destroy();
    this.channels.clear();
    this.changeListeners.clear();
    this.errorListeners.clear();
    this.startListeners.clear();
    this.launchCancelledListeners.clear();
  }

  // — Mise en place —————————————————————————————————————————————————————————————

  private initializeHostSeats(): void {
    for (let seat = HOST_SEAT; seat < HOST_SEAT + this.roomOptions.teamCount; seat += 1) {
      this.seats.set(seat, {
        seat,
        /*
         * Toute place autre que l'hôte démarre **libre**, et non en IA (retour de recette
         * 2026-09-04) : un salon en ligne était indistinguable d'une partie solo au premier regard.
         * Elle ne bloque pas le lancement pour autant — personne n'y est, donc il n'y a aucune
         * confirmation à attendre — et elle part en IA à la composition du setup.
         */
        occupancy: seat === HOST_SEAT ? NetworkSeatOccupancy.Human : NetworkSeatOccupancy.Waiting,
        ready: seat !== HOST_SEAT,
      });
    }
  }

  private listenIncoming(): void {
    this.deps.transport.onIncoming((channel) => this.attachIncoming(channel));
  }

  private attachIncoming(channel: NetworkChannel): void {
    const remoteSeat = seatFromPeerId(channel.remotePeerId, this.code);
    // Un pair qui se présente avec une adresse illisible n'est pas une erreur à remonter au joueur :
    // c'est une autre application qui a pris une adresse voisine dans l'espace de noms mondial.
    if (remoteSeat === undefined) {
      channel.close();
      return;
    }
    /*
     * 🔴 Un salon verrouillé admet UN revenant, et lui seul (plan 202, décision #954).
     *
     * Avant le Lot B3 cette branche refermait **tout** canal entrant, donc un pair déconnecté
     * tombait exactement sur `partie_commencee` : le message qui lui dit de ne pas revenir. Ce n'est
     * pas une réouverture du salon — seule une place dont le délai de grâce court passe, et sa
     * place vient de l'**adresse d'annuaire** (`seatFromPeerId` ci-dessus), jamais d'un message.
     */
    if (this.locked && !this.graceTimers.has(remoteSeat)) {
      channel.close();
      return;
    }
    this.attachChannel(remoteSeat, channel);
  }

  private attachChannel(remoteSeat: number, channel: NetworkChannel): void {
    this.channels.set(remoteSeat, channel);
    this.announcedBye.delete(remoteSeat);
    const wasAwaited = this.clearGrace(remoteSeat);
    if (wasAwaited && this.locked) {
      this.peerReturnedListeners.emit(remoteSeat);
    }

    channel.onMessage((message) => this.handleMessage(remoteSeat, message));
    channel.onClose(() => this.handleChannelClosed(remoteSeat));
    channel.onHealthChange((health) => {
      this.peerHealthListeners.emit(remoteSeat, health);
    });
  }

  /**
   * L'invité se présente à l'hôte. C'est ici que se joue le refus de version : symétrique, avec un
   * message qui n'accuse personne (décision #900).
   */
  private async handshakeWithHost(): Promise<void> {
    const channel = await this.deps.transport.connect(hostPeerId(this.code));
    this.attachChannel(HOST_SEAT, channel);

    const welcome = await this.waitForWelcome(channel);
    if (!isCompatibleVersion(welcome.networkVersion)) {
      throw new NetworkTransportError(NetworkErrorCode.VersionIncompatible);
    }

    /*
     * 🔴 On attend le PREMIER état de salon avant de se dire entré.
     *
     * Le `welcome` ne porte que la version et les places occupées : ni la carte, ni le format, ni
     * les options. Rendre la main ici laissait l'appelant lire une configuration encore vide — il
     * cherchait la carte d'identifiant `""`, ne la trouvait pas, et affichait « versions
     * incompatibles » alors que tout allait bien. Un invité n'est pas dans le salon tant qu'il n'en
     * connaît pas la configuration.
     */
    await this.waitForFirstRoomState(channel);

    // Le maillage : on joint toutes les autres places occupées. En 1v1 c'est indiscernable d'une
    // étoile, mais c'est ce qui fait qu'un hôte qui part **n'emporte pas** les connexions des autres
    // entre eux (décision #899).
    await this.connectToMesh(welcome.occupiedSeats);
  }

  /**
   * Attend le premier `room_state`.
   *
   * 🔴 **Rend la main tout de suite s'il est déjà arrivé**, et ce n'est pas une optimisation : l'hôte
   * envoie `welcome` puis `room_state` d'affilée, donc les deux sont livrés en micro-tâches
   * consécutives — alors que l'attente ci-dessous ne peut s'armer qu'à la reprise de
   * `await waitForWelcome`, c'est-à-dire **après** que le `room_state` soit passé. Sans ce
   * raccourci, l'invité attendait un second `room_state` qui ne venait jamais.
   *
   * Une fermeture de canal y met fin sur `salon_plein` : après une présentation dont la version est
   * bonne, la seule raison qu'a l'hôte de refermer est une place qu'il n'a pas — l'arrivant ayant
   * balayé jusqu'à `maxSeats` sans connaître le format de la partie.
   */
  private waitForFirstRoomState(channel: NetworkChannel): Promise<void> {
    if (this.hasRoomState) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (action: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        this.timers.clearTimeout(timer);
        unsubscribeMessage();
        unsubscribeClose();
        action();
      };

      const timer = this.timers.setTimeout(() => {
        finish(() => reject(new NetworkTransportError(NetworkErrorCode.DelaiDepasse)));
      }, HANDSHAKE_TIMEOUT_MS);

      const unsubscribeMessage = channel.onMessage((message) => {
        if (message.type !== "room_state") {
          return;
        }
        finish(resolve);
      });

      const unsubscribeClose = channel.onClose(() => {
        finish(() => reject(new NetworkTransportError(NetworkErrorCode.SalonPlein)));
      });
    });
  }

  /**
   * Attend le `welcome` de l'hôte, en réponse à notre présentation.
   *
   * 🔴 **Une fermeture y met fin sur « partie déjà commencée »**, et c'est le chemin le plus banal du
   * jeu, pas un cas limite : un salon verrouillé referme le canal **avant tout `welcome`**
   * (`attachIncoming`). Sans cet écouteur, l'arrivant attendait le délai de garde en entier — dix
   * secondes d'écran muet — pour finir sur « plus de réponse », qui ne dit pas ce qui s'est passé.
   * C'est aussi ce qui donne enfin un producteur à `NetworkErrorCode.PartieCommencee`, dont le
   * message était déjà écrit en français et en anglais sans que personne puisse le voir.
   */
  private waitForWelcome(
    channel: NetworkChannel,
  ): Promise<{ networkVersion: number; occupiedSeats: readonly number[] }> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (action: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        this.timers.clearTimeout(timer);
        unsubscribeMessage();
        unsubscribeClose();
        action();
      };

      const timer = this.timers.setTimeout(() => {
        finish(() => reject(new NetworkTransportError(NetworkErrorCode.DelaiDepasse)));
      }, HANDSHAKE_TIMEOUT_MS);

      const unsubscribeMessage = channel.onMessage((message) => {
        if (message.type !== "welcome") {
          return;
        }
        finish(() => resolve(message));
      });

      const unsubscribeClose = channel.onClose(() => {
        finish(() => reject(new NetworkTransportError(NetworkErrorCode.PartieCommencee)));
      });

      channel.send({ type: "hello", networkVersion: NETWORK_VERSION, seat: this.seat });
    });
  }

  private async connectToMesh(occupiedSeats: readonly number[]): Promise<void> {
    for (const remoteSeat of occupiedSeats) {
      if (remoteSeat === this.seat || remoteSeat === HOST_SEAT) {
        continue;
      }
      try {
        const channel = await this.deps.transport.connect(peerIdForSeat(this.code, remoteSeat));
        this.attachChannel(remoteSeat, channel);
      } catch {
        // Un pair du maillage injoignable n'empêche pas d'entrer : l'hôte, lui, est joint. La place
        // manquante sera traitée comme un silence, ce qui est exactement ce qu'elle est.
      }
    }
  }

  // — Réception ——————————————————————————————————————————————————————————————————

  /**
   * 🔴 **Un pair ne parle que pour lui-même, et seul l'hôte parle pour le salon.**
   *
   * `remoteSeat` vient de l'adresse d'annuaire du canal (`seatFromPeerId`), donc il est **fiable** :
   * la prise d'identifiant est exclusive, personne ne peut se présenter à la place d'un autre. Ce
   * que le message *annonce*, en revanche, ne vaut rien — c'est le pair qui l'écrit.
   *
   * Sans cette confrontation, l'attaque la plus simple était silencieuse et marchait en 1v1 nu : un
   * invité envoyait `{ type: "team_select", seat: 1, selection: … }`, et l'hôte entrait en combat
   * avec une équipe qu'il n'avait jamais choisie — son écran ayant affiché la vraie jusqu'au bout,
   * puisque l'interface lit `slots` et que le `start` lit `selections`. Dans la même famille : un
   * `start_ack` au nom d'autrui faisait lancer l'hôte alors qu'un pair n'avait rien reçu, ce qui est
   * précisément la panne que l'accusé existe pour empêcher.
   *
   * Un message qui échoue ici est **ignoré en silence**, jamais remonté à l'interface : ce n'est pas
   * au joueur d'entendre parler d'un pair mal élevé.
   */
  private isSpokenFor(remoteSeat: number, message: NetworkMessage): boolean {
    switch (message.type) {
      // Ces messages parlent d'une place : ce doit être celle de leur expéditeur.
      //
      // 🔴 `action` est ici pour la même raison que `team_select`, et l'enjeu est plus gros : sans
      // cette ligne, un pair jouerait le tour d'un autre camp.
      //
      // Pour `forfeit`, ce contrôle n'établit que **qui parle**, pas de qui il parle : la place
      // éliminée (`forfeitedSeat`) reste inauthentifiable, et c'est assumé (voir `ForfeitMessage`).
      case "team_select":
      case "ready":
      case "start_ack":
      case "bye":
      case "action":
      case "forfeit":
      // Le rattrapage aussi : un pair ne demande la suite QUE pour lui-même, et ne répond QUE pour
      // lui-même (plan 202).
      case "resync_request":
      case "resync":
      // Une empreinte ne parle que de l'état de son émetteur (plan 203).
      case "checksum":
        return message.seat === remoteSeat;
      // Ceux-là font autorité sur le salon entier : l'hôte seul les émet.
      case "room_state":
      case "start":
        return remoteSeat === HOST_SEAT;
      // `hello` porte la place réclamée, que `handleHello` confronte lui-même ; `welcome` est traité
      // par la poignée de main.
      case "hello":
      case "welcome":
        return true;
    }
  }

  private handleMessage(remoteSeat: number, message: NetworkMessage): void {
    if (!this.isSpokenFor(remoteSeat, message)) {
      return;
    }
    switch (message.type) {
      case "hello":
        this.handleHello(remoteSeat, message.networkVersion, message.seat);
        return;
      case "room_state":
        this.applyRoomState(message.options, message.seats, message.locked);
        return;
      case "team_select":
        this.selections.set(message.seat, message.selection);
        this.notifyChange();
        return;
      case "ready":
        this.handleReady(message.seat, message.ready);
        return;
      case "start":
        this.handleStart(message);
        return;
      case "start_ack":
        this.handleStartAck(message.seat);
        return;
      case "bye":
        // Noté, pas agi : la fermeture du canal suit, et c'est elle qui déclenche le délai. Un `bye`
        // sans fermeture est un pair qui s'annonce partant puis change d'avis.
        this.announcedBye.add(message.seat);
        return;
      case "resync_request":
        this.resyncRequestListeners.emit(message);
        return;
      case "resync":
        // Gardé si le combat n'écoute pas encore, exactement comme une action : c'est le cas NORMAL
        // du revenant, qui demande la suite pendant que son écran se monte.
        if (this.resyncListeners.size === 0) {
          this.bufferedResyncs.push(message);
          return;
        }
        this.resyncListeners.emit(message);
        return;
      case "action":
        // Rien à noter côté salon : le combat vit dans l'orchestrateur, pas ici. Mais s'il n'est pas
        // encore branché, on GARDE — voir `bufferedActions`.
        if (this.actionListeners.size === 0) {
          this.bufferedActions.push(message);
          return;
        }
        this.actionListeners.emit(message);
        return;
      case "forfeit":
        this.forfeitListeners.emit(message);
        return;
      case "checksum":
        this.checksumListeners.emit(message);
        return;
      case "welcome":
        // Traité par `waitForWelcome`, qui est le seul moment où il a un sens.
        return;
    }
  }

  private handleHello(remoteSeat: number, remoteVersion: number, claimedSeat: number): void {
    if (this.role !== RoomRole.Host) {
      return;
    }
    const channel = this.channels.get(remoteSeat);
    if (channel === undefined) {
      return;
    }

    // Le `welcome` part **même quand on refuse** : c'est lui qui porte la version, donc le seul moyen
    // pour l'arrivant de savoir que c'est la version qui cloche et non le réseau.
    channel.send({
      type: "welcome",
      networkVersion: NETWORK_VERSION,
      occupiedSeats: this.occupiedSeats(),
    });

    if (!isCompatibleVersion(remoteVersion)) {
      channel.close();
      return;
    }
    // Une place au-delà du format : l'arrivant a balayé jusqu'à `maxSeats` sans connaître notre
    // nombre de places. C'est ici, et nulle part ailleurs, que « salon plein » se décide.
    if (claimedSeat !== remoteSeat || !this.seats.has(claimedSeat)) {
      channel.close();
      return;
    }

    /*
     * Un revenant en pleine partie (plan 202, décision #954) : il a déjà sa place et son équipe, et
     * il n'a rien à re-confirmer. Repasser par le chemin ci-dessous le remettrait `ready: false`,
     * donc **pas prêt dans une partie déjà lancée** — un état qui ne veut rien dire —, et
     * rediffuserait un état de salon que personne n'attend plus. Le `welcome` est déjà parti : c'est
     * tout ce dont il a besoin pour enchaîner sur son rattrapage.
     */
    if (this.locked) {
      /*
       * 🔴 L'état du salon lui part quand même, mais à LUI SEUL et sans passer par
       * `broadcastRoomState` : `handshakeWithHost` attend un premier `room_state` avant de se dire
       * entré (sinon l'arrivant lit une configuration vide et croit à une incompatibilité de
       * version), donc sans cet envoi un revenant attendrait le délai de garde en entier pour
       * finir sur « plus de réponse ». Diffuser à tout le maillage serait pire qu'inutile : ça
       * annoncerait un changement de salon là où rien n'a changé.
       */
      this.channels.get(claimedSeat)?.send({
        type: "room_state",
        options: this.roomOptions,
        seats: this.view.seats,
        locked: true,
      });
      this.notifyChange();
      return;
    }

    const seatState = this.seats.get(claimedSeat);
    if (seatState === undefined) {
      return;
    }
    this.seats.set(claimedSeat, {
      ...seatState,
      occupancy: NetworkSeatOccupancy.Remote,
      ready: false,
    });
    this.broadcastRoomState();
    this.notifyChange();
  }

  private handleReady(seat: number, ready: boolean): void {
    const seatState = this.seats.get(seat);
    if (seatState !== undefined) {
      this.seats.set(seat, { ...seatState, ready });
    }
    // L'hôte fait autorité : il rediffuse l'état, ce qui aligne tout le monde sans que chaque pair
    // ait à propager le « prêt » de chaque autre.
    if (this.role === RoomRole.Host) {
      this.broadcastRoomState();
    }
    this.notifyChange();
  }

  private applyRoomState(
    options: NetworkRoomOptions,
    seats: readonly NetworkSeatState[],
    locked: boolean,
  ): void {
    if (this.role === RoomRole.Host) {
      return;
    }
    const wasLocked = this.locked;
    this.hasRoomState = true;
    this.roomOptions = options;
    this.seats.clear();
    for (const seatState of seats) {
      this.seats.set(seatState.seat, seatState);
    }
    this.locked = locked;

    // Un salon qui se déverrouille après avoir été verrouillé **est** le message d'annulation du
    // lancement : il n'y en a pas d'autre dans le protocole, et il ramène à la salle d'attente.
    if (wasLocked && !locked) {
      this.launchCancelledListeners.emit();
    }
    this.notifyChange();
  }

  private handleStart(start: StartMessage): void {
    if (this.role === RoomRole.Host) {
      return;
    }
    this.locked = true;
    // À l'hôte seul : lui seul tient le compte des accusés. L'envoyer au maillage entier ferait du
    // bruit que personne ne lit.
    this.channels.get(HOST_SEAT)?.send({ type: "start_ack", seat: this.seat });
    this.emitStart(start);
  }

  private handleStartAck(seat: number): void {
    if (this.role !== RoomRole.Host) {
      return;
    }
    this.startAcks.add(seat);
    if (this.pendingLaunch?.isComplete() === true) {
      this.pendingLaunch.settle(true);
    }
  }

  // — Départs ————————————————————————————————————————————————————————————————————

  /**
   * Un canal se referme. **Rien n'est décidé tout de suite** : on ouvre un délai de grâce, court si
   * un `bye` a précédé, long sinon — un silence de quelques secondes est le comportement **normal**
   * d'un téléphone, pas un départ.
   */
  private handleChannelClosed(remoteSeat: number): void {
    if (this.left) {
      return;
    }
    this.channels.delete(remoteSeat);
    this.abandonLaunchIfAwaiting(remoteSeat);

    const cleanClose = this.announcedBye.has(remoteSeat);
    const delayMs = graceDelayFor({
      locked: this.locked,
      cleanClose,
      absentOnce: this.seatsAbsentOnce.has(remoteSeat),
    });
    /*
     * L'absence est établie **maintenant**, à la fermeture — pas à l'expiration du délai (plan 202,
     * décision #950).
     *
     * Le marquer à l'expiration le rendait inatteignable : en 1v1 le premier déclenchement prononce
     * déjà le forfait, donc il n'y a jamais de « fois suivante ». Ici, un pair qui tombe, revient,
     * puis retombe voit son second délai raccourci — ce qui est exactement le sens de « une fois
     * l'absence établie ».
     */
    if (this.locked) {
      this.seatsAbsentOnce.add(remoteSeat);
    }
    this.clearGrace(remoteSeat);
    this.graceTimers.set(remoteSeat, {
      cleanClose,
      handle: this.timers.setTimeout(() => this.resolveDeparture(remoteSeat), delayMs),
    });
    if (this.locked) {
      this.peerAwaitedListeners.emit(remoteSeat, delayMs);
      this.scheduleHostRedial(remoteSeat);
    }
    this.notifyChange();
  }

  /** Le délai est écoulé sans retour. C'est seulement ici qu'un départ devient un fait. */
  private resolveDeparture(remoteSeat: number): void {
    this.graceTimers.delete(remoteSeat);
    this.announcedBye.delete(remoteSeat);

    /*
     * 🔴 Partie LANCÉE : un départ n'est plus une affaire de salon (plan 202, décision #951).
     *
     * Ce qui suit rendait la place `Waiting` et continuait la préparation — ce qui n'a aucun sens en
     * combat : la place n'est pas « libre pour quelqu'un d'autre », son camp est en train de perdre
     * ses tours. Et le cas de l'hôte renvoyait l'invité à l'écran `lobby`, donc un hôte qui recharge
     * sa page pour revenir trouvait un invité déjà sorti de la partie (décision #954).
     *
     * On ne touche pas non plus à `selections` : c'est la composition d'équipe de la partie en
     * cours, dont le rattrapage du revenant a besoin.
     */
    if (this.locked) {
      this.peerAbsentListeners.emit(remoteSeat);
      this.notifyChange();
      return;
    }

    this.selections.delete(remoteSeat);

    // L'hôte parti, il n'y a plus de salon : le code **est** son adresse, donc un nouvel hôte
    // voudrait un nouveau code que personne n'a (décision #904). Retour à l'écran `lobby`.
    if (remoteSeat === HOST_SEAT) {
      this.emitError(NetworkErrorCode.CodeIntrouvable);
      this.notifyChange();
      return;
    }

    // Un invité parti : sa place redevient **libre**, et la préparation continue. Libre plutôt
    // qu'IA pour que l'hôte voie qu'elle peut réaccueillir quelqu'un ; elle part en IA au lancement
    // si personne ne revient. Prête d'office, sinon son absence bloquerait le lancement pour toujours.
    const seatState = this.seats.get(remoteSeat);
    if (seatState !== undefined) {
      this.seats.set(remoteSeat, {
        ...seatState,
        occupancy: NetworkSeatOccupancy.Waiting,
        ready: true,
      });
    }
    if (this.role === RoomRole.Host) {
      this.broadcastRoomState();
    }
    this.notifyChange();
  }

  /**
   * Rappelle l'hôte tant que son délai de grâce court (plan 202, étape 5).
   *
   * Réservé à **l'invité rappelant l'hôte**, et rien d'autre : c'est la seule direction que le
   * maillage compose (`handshakeWithHost` puis `connectToMesh`), et le réseau est restreint au 1v1
   * (décision #944). Un hôte n'a personne à rappeler — ce sont ses invités qui reviennent vers lui.
   *
   * Le minuteur meurt avec la grâce : `clearGrace` le coupe, donc un retour réussi comme une
   * échéance atteinte l'arrêtent sans qu'il ait à le savoir.
   */
  private scheduleHostRedial(remoteSeat: number): void {
    if (this.role !== RoomRole.Guest || remoteSeat !== HOST_SEAT) {
      return;
    }
    const attempt = (): void => {
      // Plus de grâce en cours : le retour a eu lieu, ou l'échéance est tombée. Dans les deux cas,
      // il n'y a plus rien à rappeler.
      if (this.left || !this.graceTimers.has(HOST_SEAT)) {
        return;
      }
      void this.deps.transport
        .connect(hostPeerId(this.code))
        .then((channel) => {
          // La grâce a pu se résoudre pendant l'aller-retour : un canal de trop laisserait deux
          // connexions vivantes vers le même pair.
          if (this.left || !this.graceTimers.has(HOST_SEAT)) {
            channel.close();
            return;
          }
          this.attachChannel(HOST_SEAT, channel);
          // On se présente : c'est ce qui fait répondre l'hôte, verrou compris (décision #954).
          channel.send({ type: "hello", networkVersion: NETWORK_VERSION, seat: this.seat });
        })
        .catch(() => {
          // L'hôte n'est pas encore revenu, ou l'annuaire retient encore son ancienne adresse. On
          // réessaie : c'est exactement ce que cette boucle existe pour absorber.
          this.hostRedialTimer = this.timers.setTimeout(attempt, HOST_REDIAL_INTERVAL_MS);
        });
    };
    this.timers.clearTimeout(this.hostRedialTimer);
    this.hostRedialTimer = this.timers.setTimeout(attempt, HOST_REDIAL_INTERVAL_MS);
  }

  /**
   * Ouvre une fenêtre de retour pour une place, sur un salon qu'on vient de reprendre (plan 202).
   *
   * Le pendant de `handleChannelClosed` pour un salon **neuf** : il n'y a pas eu de canal à fermer,
   * donc rien ne l'aurait armée. Le délai court suffit — le pair d'en face rappelle toutes les 2 s
   * s'il est encore là (`scheduleHostRedial`).
   */
  private openReconnectWindow(remoteSeat: number): void {
    this.clearGrace(remoteSeat);
    this.graceTimers.set(remoteSeat, {
      cleanClose: true,
      handle: this.timers.setTimeout(
        () => this.resolveDeparture(remoteSeat),
        BATTLE_GRACE_SHORT_MS,
      ),
    });
    this.peerAwaitedListeners.emit(remoteSeat, BATTLE_GRACE_SHORT_MS);
  }

  /** @returns vrai si un délai courait vraiment — donc si cette place était attendue. */
  private clearGrace(remoteSeat: number): boolean {
    const existing = this.graceTimers.get(remoteSeat);
    if (existing === undefined) {
      return false;
    }
    this.timers.clearTimeout(existing.handle);
    this.graceTimers.delete(remoteSeat);
    if (remoteSeat === HOST_SEAT) {
      this.timers.clearTimeout(this.hostRedialTimer);
      this.hostRedialTimer = undefined;
    }
    return true;
  }

  // — Lancement ——————————————————————————————————————————————————————————————————

  private composeStartSeats(): readonly StartSeat[] {
    return [...this.seats.values()]
      .sort((left, right) => left.seat - right.seat)
      .map((seatState) => ({
        seat: seatState.seat,
        // `remote` est un état de **salon** : le moteur ne connaît que « humain » ou « IA », et un
        // joueur distant est un humain — simplement pas celui qui est devant cet écran. Une place
        // **libre** part en IA : c'est ce qui garde le salon jouable si personne n'est venu.
        controller:
          seatState.occupancy === NetworkSeatOccupancy.Ai ||
          seatState.occupancy === NetworkSeatOccupancy.Waiting
            ? PlayerController.Ai
            : PlayerController.Human,
        selection: this.selections.get(seatState.seat) ?? { pokemonDefinitionIds: [] },
      }));
  }

  /**
   * Attend les accusés. Résolue **par l'arrivée des accusés**, pas par un sondage : un seul minuteur
   * existe, celui de l'abandon. Rien ne lit d'horloge locale — c'est la règle du chien de garde
   * (décision #905), et c'est aussi ce qui rend le cas testable sans laisser tourner 15 secondes.
   */
  private waitForStartAcks(awaitedSeats: readonly number[]): Promise<boolean> {
    return new Promise((resolve) => {
      const settle = (everyoneAcked: boolean) => {
        this.timers.clearTimeout(this.launchAckTimer);
        this.pendingLaunch = undefined;
        resolve(everyoneAcked);
      };

      this.pendingLaunch = {
        awaitedSeats,
        isComplete: () => awaitedSeats.every((seat) => this.startAcks.has(seat)),
        settle,
      };
      this.launchAckTimer = this.timers.setTimeout(() => settle(false), LAUNCH_ACK_TIMEOUT_MS);
    });
  }

  /**
   * Une place se referme pendant qu'on attend son accusé : le lancement est **déjà** perdu, donc on
   * l'abandonne tout de suite au lieu de laisser courir les 15 secondes du minuteur.
   *
   * Ce n'est pas une entorse à la règle « un départ est un silence, pas un événement » : le délai de
   * grâce s'ouvre quand même juste après, et la place peut revenir. Ce qu'on refuse ici, c'est de
   * faire attendre l'hôte devant un écran figé pour un accusé dont on sait qu'il n'arrivera pas —
   * il retrouve son salon, et relance quand il veut.
   *
   * Une place qui a **déjà** accusé ne compte pas : elle a reçu le `start`, son départ relève du
   * délai de grâce ordinaire.
   */
  private abandonLaunchIfAwaiting(remoteSeat: number): void {
    const launch = this.pendingLaunch;
    if (launch === undefined) {
      return;
    }
    if (!launch.awaitedSeats.includes(remoteSeat) || this.startAcks.has(remoteSeat)) {
      return;
    }
    launch.settle(false);
  }

  private cancelLaunch(): void {
    this.locked = false;
    this.startAcks.clear();
    this.broadcastRoomState();
    this.notifyChange();
    this.emitError(NetworkErrorCode.DelaiDepasse);
  }

  // — Émission ———————————————————————————————————————————————————————————————————

  private broadcast(message: NetworkMessage): void {
    for (const channel of this.channels.values()) {
      channel.send(message);
    }
  }

  private broadcastRoomState(): void {
    if (this.role !== RoomRole.Host) {
      return;
    }
    this.broadcast({
      type: "room_state",
      options: this.roomOptions,
      seats: this.view.seats,
      locked: this.locked,
    });
  }

  private emitStart(start: StartMessage): void {
    this.startListeners.emit(start);
  }

  private emitError(code: NetworkErrorCode): void {
    this.errorListeners.emit(code);
  }

  private notifyChange(): void {
    const view = this.view;
    this.changeListeners.emit(view);
  }

  // — Garde-fous —————————————————————————————————————————————————————————————————

  private occupiedSeats(): readonly number[] {
    return [...this.seats.values()]
      .filter(
        (seatState) =>
          seatState.occupancy === NetworkSeatOccupancy.Human ||
          seatState.occupancy === NetworkSeatOccupancy.Remote,
      )
      .map((seatState) => seatState.seat)
      .sort((left, right) => left - right);
  }

  private assertHost(): void {
    if (this.role !== RoomRole.Host) {
      throw new Error("réservé à l'hôte");
    }
  }
}

/**
 * Balaie les places à partir de la seconde et prend la première libre.
 *
 * @throws NetworkTransportError `salon_plein` si aucune place n'est libre jusqu'à `maxSeats`.
 */
async function claimFirstFreeSeat(deps: RoomDeps, code: string): Promise<number> {
  for (let seat = HOST_SEAT + 1; seat <= deps.maxSeats; seat += 1) {
    try {
      await deps.transport.claim(peerIdForSeat(code, seat));
      return seat;
    } catch (error) {
      if (error instanceof NetworkTransportError && error.code === NetworkErrorCode.SalonPlein) {
        continue;
      }
      throw error;
    }
  }
  throw new NetworkTransportError(NetworkErrorCode.SalonPlein);
}

/**
 * L'état qu'un invité porte entre sa prise de place et le premier `room_state`. Jamais affiché : la
 * salle d'attente ne se monte qu'une fois la poignée de main faite, donc après le premier état reçu.
 */
function placeholderOptions(): NetworkRoomOptions {
  return { mapId: "", teamCount: 0, autoPlacement: true, damagePreview: false };
}
