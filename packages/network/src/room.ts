import {
  type Action,
  type AiDifficulty,
  PlayerController,
  resolveAiDifficulty,
} from "@pokemon-tactic/core";
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
  type NetworkPlacement,
  type NetworkRoomOptions,
  NetworkSeatOccupancy,
  type NetworkSeatState,
  type NetworkSeeds,
  type NetworkTeamSelection,
  type PlacementMessage,
  RANDOM_MAP_ID,
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
  UNKNOWN_CODE_CONNECT_TIMEOUT_MS,
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
/**
 * Combien de fois un survivant NON élu relit le registre avant de renoncer (plan 209, Lot C5).
 *
 * Le registre sérialise les écritures, mais rien n'ordonne la lecture de l'un par rapport à la
 * reprise de l'autre : il faut donc pouvoir relire. Trois tentatives espacées d'un battement
 * couvrent largement un aller-retour, sans faire attendre une partie déjà perdue quand personne ne
 * reprend réellement la main.
 */
const HOST_LOOKUP_ATTEMPTS = 3;
const HOST_LOOKUP_RETRY_MS = 400;

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
  private readonly placementListeners = new Listeners<[message: PlacementMessage]>();
  /**
   * Les placements arrivés avant que l'écran de placement n'écoute (plan 211).
   *
   * Même piège que `bufferedActions`, et il est ici PLUS probable, pas moins : les écrans ne se
   * montent pas au même instant — carte et atlas à charger, cache froid contre cache chaud — et le
   * placement est justement le moment où un pair rapide peut avoir fini avant que le lent n'ait
   * affiché sa grille. Sans tampon, son placement serait perdu et le lent attendrait pour toujours
   * un camp qui a déjà posé.
   */
  private readonly bufferedPlacements: PlacementMessage[] = [];
  /**
   * Places dont le placement est déjà enregistré (plan 211).
   *
   * 🔴 **Une place ne pose qu'une fois.** Un deuxième message pour la même place arrive après une
   * reconnexion — le revenant rediffuse ce qu'il avait envoyé — et le rejouer DOUBLERAIT ses Pokemon
   * chez les autres. Le premier reçu fait foi.
   */
  private readonly placedSeats = new Set<number>();
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

  /**
   * La place qui HÉBERGE, en ce moment (plan 209, Lot C5).
   *
   * 🔴 **À ne pas confondre avec `HOST_SEAT`**, qui reste la constante « place n° 1 ». Les deux ont
   * longtemps été le même nombre, et le code les écrivait indifféremment — c'est précisément ce qui
   * rendait la migration d'hôte impossible. `HOST_SEAT` numérote ; `hostSeat` désigne un rôle, et
   * un rôle se transmet.
   */
  private hostSeat = HOST_SEAT;

  /** L'époque du registre pour ce salon, quand il y en a un. Voir `RoomRendezvousClient`. */
  private hostEpoch = 0;

  /** Une élection est-elle déjà en vol ? Deux reprises concurrentes s'annuleraient l'une l'autre. */
  private electing = false;

  private constructor(
    private readonly deps: RoomDeps,
    readonly code: string,
    private currentRole: RoomRole,
    readonly seat: number,
    options: NetworkRoomOptions,
  ) {
    this.roomOptions = options;
    this.timers = deps.timers ?? defaultTimers;
    this.sleep = deps.sleep ?? defaultSleep;
  }

  /** Le rôle courant. Il CHANGE à la migration d'hôte (Lot C5) : un invité peut devenir hôte. */
  get role(): RoomRole {
    return this.currentRole;
  }

  /** La place qui héberge en ce moment — la 1 tant que personne n'a repris la main. */
  get hostingSeat(): number {
    return this.hostSeat;
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
    /*
     * On publie la place qui héberge (plan 209, Lot C4). Sans registre, rien ne change : l'hôte est
     * la place 1 parce que c'est l'avoir prise qui fait l'hôte (#904). Avec lui, cette place devient
     * une valeur qu'un successeur pourra remplacer.
     *
     * 🔴 Un registre injoignable **ne doit pas empêcher de jouer** : on garde le salon et le
     * comportement d'avant, sans migration possible. C'est une capacité en moins, pas une panne.
     */
    if (deps.rendezvous !== undefined) {
      try {
        const claimed = await deps.rendezvous.claim(code, HOST_SEAT);
        /*
         * 🔴 On lit le `ok`. Un enregistrement rémanent (le registre garde un code 6 h) rendait
         * l'époque **d'autrui**, que ce salon neuf adoptait — et les invités suivaient alors le
         * `seat` d'un autre salon. Un code déjà pris n'est pas notre code : on repart sans registre
         * plutôt qu'avec une identité empruntée.
         */
        room.hostEpoch = claimed.ok ? claimed.epoch : 0;
      } catch {
        room.hostEpoch = 0;
      }
    }
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
    /*
     * Qui héberge ? La question ne se posait pas tant que le code était l'adresse de l'hôte : c'était
     * forcément la place 1. Après une migration, ce n'est plus vrai — et l'arrivant est justement
     * celui qui ne peut pas le deviner, puisqu'il n'était pas là.
     *
     * 🔴 **AVANT le balayage, et l'ordre est tout** : il faut savoir quelle place NE PAS prendre. Un
     * arrivant qui s'assoit sur la place de l'hôte se connecterait ensuite à lui-même et attendrait
     * une poignée de main qui ne vient jamais — cinq secondes pour rien, puis un faux « code
     * introuvable ». Le registre muet ou injoignable renvoie au comportement d'origine, la place 1.
     */
    let hostingSeat = HOST_SEAT;
    let hostingEpoch = 0;
    /*
     * 🔴 Le registre a-t-il RÉPONDU que ce code est inconnu ? Trois issues, et il faut les trois —
     * les confondre est ce qui faisait mentir l'écran de refus (2026-09-15).
     *
     * - il répond et nomme une place  → on la suit ;
     * - il répond « personne »        → `registryReportedUnknown`, voir plus bas ;
     * - il est INJOIGNABLE (il jette) → on ne sait rien, comportement d'avant le plan 209.
     *
     * ⚠️ LA TROISIÈME AIDE LE MODE DÉGRADÉ, ELLE NE LE GARANTIT PAS — formulation corrigée en revue
     * de code, la première affirmait une sûreté qu'elle n'a pas. Elle couvre le cas où la panne dure
     * autant que la partie : l'invité tombe alors sur la même panne que l'hôte, donc dans cette
     * branche-ci. Elle ne couvre PAS une panne qui se TERMINE entre les deux — `Room.create` avale
     * l'échec d'inscription et garde le salon, donc la partie survit à la panne quand l'inscription,
     * elle, n'a jamais eu lieu. Le registre répond alors « personne » sur un salon bien vivant.
     *
     * Ce qui rend le risque acceptable n'est donc pas cette branche, c'est le garde plus bas : on ne
     * réécrit la cause que si AUCUN canal ne s'est ouvert. Un hôte joignable reste joignable ; au
     * pire on lui accorde `UNKNOWN_CODE_CONNECT_TIMEOUT_MS` au lieu du budget plein, ce que ses 8 s
     * couvrent largement. Risque résiduel assumé, arbitré par l'humain le 2026-09-15.
     */
    let registryReportedUnknown = false;
    if (deps.rendezvous !== undefined) {
      try {
        const known = await deps.rendezvous.lookup(code);
        if (known === null) {
          registryReportedUnknown = true;
        } else {
          hostingSeat = known.seat;
          hostingEpoch = known.epoch;
        }
      } catch {
        // Repli silencieux : la place 1, comme avant le plan 209.
      }
    }
    const claimedSeat = await claimFirstFreeSeat(deps, code, hostingSeat);
    const room = new Room(deps, code, RoomRole.Guest, claimedSeat, placeholderOptions());
    room.hostSeat = hostingSeat;
    room.hostEpoch = hostingEpoch;
    room.listenIncoming();

    try {
      await room.handshakeWithHost(
        registryReportedUnknown ? UNKNOWN_CODE_CONNECT_TIMEOUT_MS : undefined,
      );
    } catch (error) {
      room.leave({ abandon: true });
      /*
       * 🔴 ON NE RÉPÈTE PAS « PLUS DE RÉPONSE » QUAND ON SAIT MIEUX.
       *
       * L'annuaire public de PeerJS ne refuse proprement qu'une fois sur deux (voir
       * `UNKNOWN_CODE_CONNECT_TIMEOUT_MS`) : l'autre fois il se tait, le minuteur tranche, et
       * `delai_depasse` remonte — soit « Plus de réponse. Réessayez. » à l'écran. C'est FAUX, et
       * c'est la pire des formulations : elle envoie le joueur réessayer un code qui n'existe pas,
       * et elle fait passer un code mal recopié pour une panne de réseau.
       *
       * Le registre, lui, a répondu, et il a dit que personne ne tient ce code. On le croit. Les
       * autres causes passent telles quelles : une version incompatible ou un salon plein sont des
       * réponses du VRAI hôte, elles ne se réécrivent pas.
       */
      if (
        registryReportedUnknown &&
        // 🔴 SEULEMENT si aucun canal ne s'est jamais ouvert. Relevé en revue de code : le `try`
        // couvre TOUT `handshakeWithHost`, or `waitForWelcome` et `waitForFirstRoomState` rejettent
        // eux aussi `delai_depasse`. Un canal ouvert PROUVE que quelqu'un tient l'adresse ; annoncer
        // « ce code n'existe pas » parce que sa présentation traîne serait le mensonge symétrique de
        // celui qu'on répare, et cette fois sur un salon qui existe vraiment.
        !room.hostChannelOpened &&
        error instanceof NetworkTransportError
      ) {
        if (
          error.code === NetworkErrorCode.DelaiDepasse ||
          error.code === NetworkErrorCode.ConnexionImpossible
        ) {
          throw new NetworkTransportError(NetworkErrorCode.CodeIntrouvable, error.message);
        }
      }
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
    /*
     * 🔴 Qui héberge ? Surtout pas « la place 1 » (plan 209, Lot C5). Après une migration, l'ancienne
     * place 1 qui revient se serait déclarée hôte alors qu'un autre l'est — deux hôtes — et un invité
     * qui revient aurait REJETÉ les `room_state` du vrai hôte, qu'`isSpokenFor` juge sur `hostSeat`.
     * C'est l'exemple même de la confusion que `hostSeat` existe pour lever.
     */
    let hostingSeat = HOST_SEAT;
    let hostingEpoch = 0;
    if (deps.rendezvous !== undefined) {
      try {
        const known = await deps.rendezvous.lookup(code);
        if (known !== null) {
          hostingSeat = known.seat;
          hostingEpoch = known.epoch;
        }
      } catch {
        // Repli : la place 1, comme avant le plan 209.
      }
    }
    const role = seat === hostingSeat ? RoomRole.Host : RoomRole.Guest;
    const room = new Room(deps, code, role, seat, placeholderOptions());
    room.hostSeat = hostingSeat;
    room.hostEpoch = hostingEpoch;
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
      // Même raison qu'à `join` : une reprise qui n'aboutit pas doit rendre sa place TOUT DE SUITE,
      // sinon c'est elle que la tentative suivante trouvera occupée.
      room.leave({ abandon: true });
      throw error;
    }
    return room;
  }

  get view(): RoomView {
    return {
      code: this.code,
      role: this.role,
      seat: this.seat,
      hostSeat: this.hostSeat,
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
   * Un camp a fini de poser ses Pokemon (plan 211).
   *
   * **Avec tampon**, contrairement aux empreintes : un placement n'est jamais périmé. Il vaut jusqu'au
   * lancement du combat, et l'écran qui s'abonne tard doit le recevoir — c'est même le cas courant.
   */
  onPlacement(listener: (message: PlacementMessage) => void): () => void {
    const unsubscribe = this.placementListeners.subscribe(listener);
    if (this.bufferedPlacements.length > 0) {
      const kept = [...this.bufferedPlacements];
      this.bufferedPlacements.length = 0;
      for (const message of kept) {
        listener(message);
      }
    }
    return unsubscribe;
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
   * Notre placement terminé, en un envoi (plan 211).
   *
   * Émis quand ce joueur a fini — à la main, ou parce que son chrono a expiré et que son client a
   * posé le reste. Une seule fois par partie : `placedSeats` ignore un doublon à la réception, et
   * l'appelant n'a donc pas à se garder lui-même contre une rediffusion après reconnexion.
   */
  sendPlacement(placements: readonly NetworkPlacement[]): void {
    this.broadcast({ type: "placement", seat: this.seat, placements });
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
   * L'hôte change le NOMBRE DE CAMPS, depuis la salle d'attente (plan 209, Lot C3).
   *
   * 🔴 **Le code de salon ne change pas.** C'était l'objection qui avait fait poser ce choix au
   * `lobby` : « un salon ne change pas de format en cours de route ». Elle ne tient pas — ce qui ne
   * doit pas changer, c'est l'ADRESSE, et elle ne dépend pas du format. On ajoute ou retire des
   * places, on rediffuse, et le code que l'hôte a peut-être déjà dicté reste valable.
   *
   * Deux refus seulement :
   * - partie lancée — il n'y a plus de salon à recomposer ;
   * - hôte déjà prêt — même règle que `setOptions`, on ne change pas la règle après s'y être engagé.
   *
   * 🔴 **Un invité assis sur une place qui disparaît est ÉJECTÉ, et on lui dit pourquoi.** C'est la
   * partie de l'hôte, il décide de son format (arbitrage humain, 2026-09-14) ; ce qui se négocie
   * n'est pas son droit d'éjecter mais le fait de l'expliquer — d'où `FormatReduit`, envoyé **avant**
   * de refermer le canal, parce qu'après il n'y a plus rien pour le porter.
   *
   * 🔴 **On éjecte PAR LE HAUT, donc les derniers arrivés.** Ce n'est pas un détail d'ordre : un
   * arrivant prend la première place libre en balayant vers le haut (`claimFirstFreeSeat`), donc le
   * numéro de place **est** l'ordre d'arrivée. Retirer les places hautes fait sortir ceux qui
   * viennent d'entrer, jamais celui qui attendait depuis le début.
   *
   * ⚠️ La première rédaction refusait le rétrécissement « pour ne pas punir l'invité arrivé tôt ».
   * L'argument était faux **dans les deux sens** : il prenait l'ordre des places à l'envers, et un
   * refus n'aurait rien protégé — il aurait seulement empêché l'hôte de composer sa partie. Relevé
   * par l'humain, 2026-09-14.
   *
   * @returns vrai si le format a changé.
   */
  setTeamCount(teamCount: number): boolean {
    this.assertHost();
    if (this.left || this.locked || this.seats.get(this.seat)?.ready === true) {
      return false;
    }
    if (teamCount === this.roomOptions.teamCount) {
      return false;
    }
    this.roomOptions = { ...this.roomOptions, teamCount };
    for (const seat of [...this.seats.keys()]) {
      if (seat >= HOST_SEAT + teamCount) {
        const channel = this.channels.get(seat);
        if (channel !== undefined) {
          // Dire, PUIS fermer. L'ordre est tout : l'inverse laisse l'éjecté devant un canal mort
          // sans explication, donc devant un « partie introuvable » qui serait faux.
          channel.send({ type: "kick", seat, reason: NetworkErrorCode.FormatReduit });
          channel.close();
          this.channels.delete(seat);
        }
        this.clearGrace(seat);
        this.seats.delete(seat);
      }
    }
    for (let seat = HOST_SEAT; seat < HOST_SEAT + teamCount; seat += 1) {
      if (!this.seats.has(seat)) {
        // Mêmes valeurs qu'à l'ouverture : libre et prête d'office, sinon une place que personne ne
        // tient bloquerait « Lancer » pour toujours.
        this.seats.set(seat, {
          seat,
          occupancy: NetworkSeatOccupancy.Waiting,
          ready: true,
        });
      }
    }
    this.broadcastRoomState();
    this.notifyChange();
    return true;
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
  setSeatOccupancy(
    seat: number,
    occupancy: NetworkSeatOccupancy,
    aiDifficulty?: AiDifficulty,
  ): void {
    this.assertHost();
    const seatState = this.seats.get(seat);
    if (this.left || seatState === undefined || seat === this.hostSeat) {
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
    //
    // Le niveau ne survit PAS à un retour en « place libre » : la garder marquée « Difficile » alors
    // qu'elle attend un humain afficherait un réglage que personne n'a demandé, et qui reparaîtrait
    // au lancement si personne ne vient. Une place qu'on rouvre repart du défaut, comme une neuve.
    /*
     * 🔴 On RETIRE la clé, on ne l'écrit JAMAIS à `undefined` — et ce n'est pas du style.
     *
     * Le transport de PeerJS sérialise en **BinaryPack, pas en JSON** : `pack({a: 1, b: undefined})`
     * revient en `{a: 1, b: null}`. Or `isSeatState` refuse `null` sur ce champ, donc le `room_state`
     * ENTIER échouait à la validation et le pair distant le jetait **en silence**. Symptôme observé
     * (e2e §11.24) : l'hôte rouvre une place IA à un joueur, sa ligne redevient « Place libre » chez
     * lui, et reste « Prêt · 🤖 Difficile » chez l'invité pour toujours. Les messages suivants
     * passent, donc rien n'a l'air cassé — c'est ce qui rend le défaut illisible.
     *
     * Règle générale du fichier : un champ facultatif d'un message se compose par
     * `...(condition ? { champ } : {})`. Tous les autres constructeurs le font déjà,
     * `composeStartSeats` compris.
     */
    const { aiDifficulty: _efface, ...reste } = seatState;
    this.seats.set(seat, {
      ...reste,
      occupancy,
      ...(occupancy === NetworkSeatOccupancy.Ai && aiDifficulty !== undefined
        ? { aiDifficulty }
        : {}),
      ready: true,
    });
    this.broadcastRoomState();
    this.notifyChange();
  }

  /**
   * L'hôte grave la partie et la diffuse (étape 6).
   *
   * `battleId` est un identifiant **opaque** que l'appelant tire et que le `start` transporte pour
   * que les deux pairs désignent la même partie (plan 204). Ce paquet ne le lit jamais.
   *
   * `formatKey` l'est tout autant (plan 211) : le salon ne sait pas ce qu'est un format, il publie ce
   * que l'hôte lui donne. Il est là pour que les pairs ne le **redevinent** pas chacun de leur côté —
   * ils le reconstituaient à partir du nombre de camps et de la carte de LEUR salon, et repliaient en
   * silence sur le premier format quand ils ne le retrouvaient pas.
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
  async launch(
    seeds: NetworkSeeds,
    battleId: string,
    formatKey: string,
    resolvedMapId?: string,
  ): Promise<void> {
    this.assertHost();
    if (this.left || this.locked) {
      return;
    }

    /*
     * Fail-fast : le `start` doit porter une carte CONCRÈTE. Publier la sentinelle enverrait l'invité
     * chercher une carte nommée `random`, qu'il ne trouverait pas — et il afficherait « versions
     * incompatibles », un diagnostic faux prononcé par le mauvais camp. Le refus appartient ici, où
     * l'erreur d'appelant se voit, pas à la réception où elle se déguise.
     */
    if (resolvedMapId === RANDOM_MAP_ID) {
      throw new Error("launch() a reçu la sentinelle de tirage : la carte doit être résolue avant");
    }
    /*
     * Même fail-fast pour le format (plan 211, revue de code) : un format vide ferait retomber chaque
     * pair sur le premier format de la carte, en silence — précisément le repli que publier ce champ
     * vient fermer. Le refus appartient ici, où l'erreur d'appelant se voit.
     */
    if (formatKey.length === 0) {
      throw new Error("launch() a reçu un format vide : le format doit être résolu avant");
    }

    // Verrouillé dès « Lancer » : plus aucune connexion acceptée.
    this.locked = true;
    this.broadcastRoomState();
    this.notifyChange();

    /*
     * 🔴 `resolvedOptions` existe pour une seule chose : l'entrée « Aléatoire » du choix de carte
     * (plan 208). Jusqu'au lancement, `roomOptions.mapId` vaut littéralement `random` — c'est ce qui
     * permet à l'invité d'afficher « Aléatoire » sans apprendre le terrain. Le `start`, lui, doit
     * porter un identifiant CONCRET, sans quoi chaque pair tirerait le sien et ils joueraient sur
     * deux cartes.
     *
     * Le salon n'arbitre rien : il ne sait pas ce qu'est un tirage, il transporte ce que l'hôte lui
     * donne. C'est pour cette même raison que ça ne passe pas par `setOptions`, qui est refusé dès
     * que l'hôte s'est déclaré prêt — or il l'est forcément quand il lance.
     */
    const start: StartMessage = {
      type: "start",
      options:
        resolvedMapId === undefined
          ? this.roomOptions
          : { ...this.roomOptions, mapId: resolvedMapId },
      seeds,
      seats: this.composeStartSeats(),
      battleId,
      formatKey,
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
  leave(options?: { abandon?: boolean }): void {
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
    /*
     * `abandon` remonte jusqu'au transport, qui rend alors son adresse SANS temporisation de vidange
     * (2026-09-15). Le `bye` diffusé juste au-dessus n'a donc plus le temps de sortir. En échange,
     * l'adresse est libre tout de suite pour le « Réessayer » qui suit — sans quoi le joueur entre en
     * collision avec sa propre tentative précédente (decision-1064).
     *
     * Les deux appelants le demandent pour des raisons DIFFÉRENTES, et l'arbitrage n'est pas le même :
     *
     * - `join` : l'écrasante majorité des échecs est un `connect` qui n'aboutit jamais, donc aucun
     *   `bye` n'avait de destinataire. ⚠️ Nuance relevée en revue de code : un échec TARDIF (le
     *   premier `room_state` qui expire après une présentation acceptée) laisse en revanche l'hôte
     *   avec une place fantôme, qu'il ne rendra qu'au bout de `GRACE_AFTER_SILENCE_MS` (45 s) au lieu
     *   de `GRACE_AFTER_CLEAN_CLOSE_MS` (10 s). Chemin étroit, coût borné, assumé.
     * - `rejoin` : perdre le `bye` est ici un MIEUX, pas une concession. On ne veut surtout pas
     *   annoncer un départ alors qu'on est en train de réessayer de revenir.
     */
    this.deps.transport.destroy(options);
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
  /**
   * Un canal vers l'hôte s'est-il ouvert au moins une fois ? Preuve que l'adresse est TENUE, et donc
   * que le salon existe — indépendamment de ce qui échoue après (présentation, premier état).
   */
  private hostChannelOpened = false;

  private async handshakeWithHost(connectTimeoutMs?: number): Promise<void> {
    /*
     * 🔴 `relay: false` QUAND le registre a dit « personne » — c'est le même signal que le budget
     * raccourci (plan 216). Un Durable Object de relais existe pour n'importe quel code valide, donc
     * il accepterait la connexion et le silence durerait 10 s de plus. Une faute de frappe doit
     * coûter les 8 s arbitrées le 2026-09-15, pas 18.
     */
    const channel = await this.deps.transport.connect(
      peerIdForSeat(this.code, this.hostSeat),
      connectTimeoutMs === undefined ? undefined : { timeoutMs: connectTimeoutMs, relay: false },
    );
    /*
     * 🔴 Le canal s'est OUVERT : quelqu'un est bel et bien à cette adresse, quoi qu'il arrive ensuite.
     * `Room.join` s'en sert pour ne PAS réécrire la cause d'un échec tardif — voir là-bas.
     */
    this.hostChannelOpened = true;
    this.attachChannel(this.hostSeat, channel);

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

  /**
   * Compose le maillage avec les places déjà assises, une fois l'hôte joint.
   *
   * **En parallèle**, et ça n'a été possible qu'après avoir rendu l'échec attribuable à sa
   * connexion — voir `peerErrorConcerns` dans `peer-connection.ts`. L'ordre des deux comptait :
   * paralléliser d'abord, comme tenté le 2026-09-14, échangeait un défaut de lenteur contre un
   * défaut de rupture, puisqu'un seul pair absent rejetait alors TOUTES les négociations en vol.
   *
   * Ce que le séquentiel coûtait, et que la mesure a montré (`e2e/tests/bench/mesh-scaling.spec.ts`) :
   * à douze camps, les onze négociations du dernier arrivé s'enchaînaient sans le moindre
   * chevauchement. Invisible sur la boucle locale (~3,5 ms la négociation), mais
   * `CONNECT_TIMEOUT_MS` vaut **15 s** — une place injoignable épuisait donc son délai **avant que
   * la suivante ne soit tentée**, et une seule place morte retardait les dix autres, l'une après
   * l'autre. Le contraire exact de ce que promet le `catch` ci-dessous.
   *
   * `Promise.all` sur des tâches qui avalent leur échec ne rejette jamais : la sémantique d'origine
   * — un pair manquant n'empêche personne d'entrer — est conservée telle quelle.
   */
  private async connectToMesh(occupiedSeats: readonly number[]): Promise<void> {
    await Promise.all(
      occupiedSeats
        .filter((remoteSeat) => remoteSeat !== this.seat && remoteSeat !== this.hostSeat)
        .map(async (remoteSeat) => {
          try {
            const channel = await this.deps.transport.connect(peerIdForSeat(this.code, remoteSeat));
            this.attachChannel(remoteSeat, channel);
          } catch {
            // Un pair du maillage injoignable n'empêche pas d'entrer : l'hôte, lui, est joint. La
            // place manquante sera traitée comme un silence, ce qui est exactement ce qu'elle est.
          }
        }),
    );
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
      /*
       * Un placement s'annonce pour sa propre place (plan 211).
       *
       * ⚠️ Ce contrôle établit QUI PARLE, pas de quels Pokemon il parle : le salon ne connaît ni les
       * équipes ni les camps, donc rien ici n'empêche un message honnêtement signé de contenir les
       * Pokemon d'un autre camp. C'est l'application qui le vérifie, à la pose
       * (`applyRemotePlacement`) — même partage que pour `forfeit` et sa place éliminée.
       */
      case "placement":
        return message.seat === remoteSeat;
      // Ceux-là font autorité sur le salon entier : l'hôte seul les émet. `kick` y est parce qu'il
      // sort quelqu'un du salon — un invité qui pourrait l'émettre éjecterait les autres.
      case "room_state":
      case "start":
      case "kick":
        return remoteSeat === this.hostSeat;
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
      case "kick":
        /*
         * L'hôte nous sort du salon. On prononce la cause AVANT de partir : c'est tout l'intérêt du
         * message — sans lui, le joueur verrait son canal se fermer et lirait « partie introuvable »,
         * un diagnostic faux pour un salon qui existe toujours.
         */
        if (message.seat === this.seat) {
          this.emitError(message.reason);
          this.leave();
        }
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
      case "placement":
        // Le premier message d'une place fait foi : voir `placedSeats`.
        if (this.placedSeats.has(message.seat)) {
          return;
        }
        this.placedSeats.add(message.seat);
        if (this.placementListeners.size === 0) {
          this.bufferedPlacements.push(message);
          return;
        }
        this.placementListeners.emit(message);
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
    this.channels.get(this.hostSeat)?.send({ type: "start_ack", seat: this.seat });
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
      /*
       * 🔴 Partie LANCÉE et c'est l'hôte qui ne revient pas : le rôle migre, la partie continue
       * (plan 209, Lot C5). C'est le cas qui compte le plus — en préparation, personne n'a encore
       * rien investi ; ici les survivants sont au milieu d'un combat.
       *
       * Le forfait du partant, lui, ne se décide pas ici : il appartient à la couche au-dessus, qui
       * tient le moteur. Ce salon ne fait que désigner qui prend la main.
       */
      if (remoteSeat === this.hostSeat) {
        void this.electNewHost();
      }
      this.peerAbsentListeners.emit(remoteSeat);
      this.notifyChange();
      return;
    }

    this.selections.delete(remoteSeat);

    /*
     * L'hôte est parti. Jusqu'au plan 209 c'était la fin : le code **était** son adresse, donc un
     * nouvel hôte aurait voulu un nouveau code que personne n'a (décision #904). Avec un registre,
     * le code n'est plus qu'une clé — la place qui héberge est une valeur publiée, donc remplaçable.
     */
    if (remoteSeat === this.hostSeat) {
      void this.electNewHost();
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
   * Élit le successeur de l'hôte parti (plan 209, Lot C5).
   *
   * 🔴 **L'élection elle-même est triviale, et c'est voulu.** Les places sont numérotées, donc
   * totalement ordonnées, et le maillage complet fait que chacun voit déjà qui est connecté : « la
   * plus petite place encore là » se calcule sans échanger un seul message. Ni algorithme du tyran
   * (O(n²) messages) ni anneau — ils résolvent un accord que notre ordre total rend déjà acquis.
   *
   * 🔴 **Ce qui n'est PAS trivial, c'est le rendez-vous.** Deux pairs qui voient la même déconnexion
   * calculent le même successeur, puis écrivent chacun de leur côté : l'ordre des places ne ferme
   * pas cette course, parce que lire puis écrire n'est pas atomique. C'est le compare-and-swap sur
   * `epoch` qui la ferme — un seul `takeOver` aboutit, et **le perdant l'apprend** au lieu de le
   * supposer.
   *
   * Sans registre, rien de tout cela n'est possible : le code reste l'adresse de l'ancien hôte, donc
   * la partie meurt comme avant. Le repli est le comportement d'origine, pas une panne.
   */
  private async electNewHost(): Promise<void> {
    // Voir la boucle de relecture ci-dessous : le registre peut n'avoir pas encore enregistré la
    // reprise quand le non-élu l'interroge.

    const rendezvous = this.deps.rendezvous;
    /*
     * 🔴 Le repli AVANT tout le reste, et l'ordre compte. Sans registre, la place qui héberge reste
     * dérivée du code (#904) : il n'y a pas de successeur possible, et **tout le monde** doit rentrer
     * au menu — pas seulement celui qui se serait cru élu. Tester plus bas laissait les autres pairs
     * sur un salon sans hôte, muets, alors qu'avant le plan 209 ils recevaient tous l'erreur.
     */
    if (rendezvous === undefined) {
      this.emitError(NetworkErrorCode.CodeIntrouvable);
      return;
    }
    if (this.electing) {
      // Deux départs traités coup sur coup ne doivent pas lancer deux reprises concurrentes : la
      // seconde partirait avec une époque déjà périmée par la première.
      return;
    }
    const departed = this.hostSeat;
    const candidates = [this.seat, ...this.channels.keys()]
      .filter((seat) => seat !== departed)
      .sort((left, right) => left - right);
    const successor = candidates[0];
    if (successor === undefined) {
      // Plus personne : il n'y a pas de partie à sauver.
      this.emitError(NetworkErrorCode.CodeIntrouvable);
      return;
    }

    this.electing = true;
    try {
      /*
       * 🔴 **Tout le monde interroge le registre, même celui qui n'est pas élu.** Se contenter
       * d'adopter le successeur calculé localement laissait les non-élus avec une époque PÉRIMÉE —
       * et la migration suivante était alors impossible pour eux : leur `takeOver` partait avec un
       * vieux compteur, se faisait refuser, et la partie restait sans hôte pour de bon.
       */
      if (successor !== this.seat) {
        /*
         * 🔴 **On attend que le registre ait CHANGÉ, au lieu de lire une fois.** Les survivants
         * arment leur grâce au même instant : le `lookup` du non-élu part en même temps que le
         * `takeOver` de l'élu, et le Durable Object les sérialise dans leur ordre d'arrivée — pile
         * ou face. Une lecture unique rendait donc, une fois sur trois, la place du PARTANT ; le
         * non-élu l'adoptait comme hôte et rejetait ensuite tous les `room_state` du vrai hôte, que
         * `isSpokenFor` juge précisément sur `hostSeat`. Rien ne l'en sortait.
         *
         * Mesuré par `test-writer` sur 8 exécutions, invisible à la recette manuelle — c'est une
         * course, elle ne se montre pas à tous les coups.
         */
        let known: { seat: number; epoch: number } | null = null;
        for (let attempt = 0; attempt < HOST_LOOKUP_ATTEMPTS; attempt += 1) {
          known = await rendezvous.lookup(this.code).catch(() => null);
          if (this.left) {
            return;
          }
          if (known !== null && known.seat !== departed) {
            break;
          }
          // La reprise de l'élu n'est pas encore enregistrée : on laisse passer un battement.
          await this.sleep(HOST_LOOKUP_RETRY_MS);
          if (this.left) {
            return;
          }
        }
        if (known === null || known.seat === departed) {
          // Personne n'a repris la main : il n'y a pas de partie à sauver.
          this.emitError(NetworkErrorCode.CodeIntrouvable);
          return;
        }
        this.hostSeat = known.seat;
        this.hostEpoch = known.epoch;
        this.notifyChange();
        return;
      }

      let taken: { ok: boolean; seat: number; epoch: number };
      try {
        taken = await rendezvous.takeOver(this.code, this.seat, this.hostEpoch);
      } catch {
        // Le registre est injoignable : on ne se déclare surtout pas hôte sur une supposition.
        this.emitError(NetworkErrorCode.CodeIntrouvable);
        return;
      }
      /*
       * 🔴 `left` testé APRÈS le compare-and-swap, donc la reprise a pu réussir côté registre alors
       * qu'on s'en va. On la rend au lieu de laisser le registre pointer un partant : sans ça, le
       * prochain élu hériterait d'un hôte fantôme.
       */
      if (this.left) {
        if (taken.ok) {
          void rendezvous.takeOver(this.code, departed, taken.epoch).catch(() => undefined);
        }
        return;
      }
      this.hostSeat = taken.seat;
      this.hostEpoch = taken.epoch;
      if (!taken.ok) {
        // Course perdue : `taken.seat` est le vrai hôte, et le savoir est exactement ce qui nous
        // empêche d'en devenir un second.
        this.notifyChange();
        return;
      }
      this.currentRole = RoomRole.Host;
      /*
       * 🔴 La carte des places est reprise AVANT d'être rediffusée. Celle qu'un invité détient décrit
       * le salon **vu de sa place** : la sienne y est `Human`, celle de l'ancien hôte y figure encore
       * occupée. La diffuser telle quelle figeait la place du partant comme prise chez tout le monde.
       */
      const departedState = this.seats.get(departed);
      if (departedState !== undefined) {
        this.seats.set(departed, {
          ...departedState,
          occupancy: NetworkSeatOccupancy.Waiting,
          ready: true,
        });
      }
      this.broadcastRoomState();
      this.notifyChange();
    } finally {
      this.electing = false;
    }
  }

  /**
   * Rappelle l'hôte tant que son délai de grâce court (plan 202, étape 5).
   *
   * Réservé à **l'invité rappelant l'hôte**, et rien d'autre : c'est la seule direction que le
   * maillage compose (`handshakeWithHost` puis `connectToMesh`). Un hôte n'a personne à rappeler —
   * ce sont ses invités qui reviennent vers lui.
   *
   * Le minuteur meurt avec la grâce : `clearGrace` le coupe, donc un retour réussi comme une
   * échéance atteinte l'arrêtent sans qu'il ait à le savoir.
   */
  private scheduleHostRedial(remoteSeat: number): void {
    const hostSeat = this.hostSeat;
    if (this.role !== RoomRole.Guest || remoteSeat !== hostSeat) {
      return;
    }
    const attempt = (): void => {
      // Plus de grâce en cours : le retour a eu lieu, ou l'échéance est tombée. Dans les deux cas,
      // il n'y a plus rien à rappeler.
      if (this.left || !this.graceTimers.has(hostSeat)) {
        return;
      }
      void this.deps.transport
        .connect(peerIdForSeat(this.code, hostSeat))
        .then((channel) => {
          // La grâce a pu se résoudre pendant l'aller-retour : un canal de trop laisserait deux
          // connexions vivantes vers le même pair.
          if (this.left || !this.graceTimers.has(hostSeat)) {
            channel.close();
            return;
          }
          this.attachChannel(hostSeat, channel);
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
    // Le rappel suit le RÔLE d'hôte, pas la place n° 1 : après une migration, c'est `hostSeat` qui
    // dit qui on rappelait — `scheduleHostRedial` l'a toujours lu ainsi.
    if (remoteSeat === this.hostSeat) {
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
        /*
         * 🔴 Le défaut est appliqué ICI, chez l'hôte, et le résultat est GRAVÉ dans le `start`.
         *
         * Les pairs reçoivent donc une valeur explicite et n'appliquent jamais de repli eux-mêmes —
         * c'est ce qui rend la divergence impossible plutôt que simplement improbable. Une place
         * « libre » que personne n'a réglée passe en IA au lancement : elle prend le défaut, comme
         * une place IA dont l'hôte n'aurait pas touché le niveau.
         */
        ...(seatState.occupancy === NetworkSeatOccupancy.Ai ||
        seatState.occupancy === NetworkSeatOccupancy.Waiting
          ? { aiDifficulty: resolveAiDifficulty(seatState.aiDifficulty) }
          : {}),
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
async function claimFirstFreeSeat(
  deps: RoomDeps,
  code: string,
  hostingSeat: number,
): Promise<number> {
  /*
   * 🔴 Le balayage part de la place 1, et non de la 2 (plan 209, Lot C5).
   *
   * Il commençait à la seconde parce que la première était FORCÉMENT celle de l'hôte — c'était vrai
   * tant que le code était son adresse (#904). Depuis que le rôle migre, l'hôte d'origine peut être
   * parti et sa place rendue libre : l'ignorer faisait répondre « cette partie est complète » à un
   * arrivant devant un salon qui avait une place vide. Constaté en recette le 2026-09-14.
   *
   * Aucun risque de voler la place de l'hôte en activité : la prise d'identifiant chez l'annuaire est
   * exclusive, donc une place tenue est refusée — le refus EST le mécanisme d'allocation (#898).
   */
  for (let seat = HOST_SEAT; seat <= deps.maxSeats; seat += 1) {
    if (seat === hostingSeat) {
      // Jamais la place de l'hôte : s'y asseoir reviendrait à se présenter à soi-même.
      continue;
    }
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
