import { PlayerController } from "@pokemon-tactic/core";
import {
  isCompatibleVersion,
  NETWORK_VERSION,
  NetworkErrorCode,
  type NetworkMessage,
  type NetworkRoomOptions,
  NetworkSeatOccupancy,
  type NetworkSeatState,
  type NetworkSeeds,
  type NetworkTeamSelection,
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
  claimOwnIdentity,
  type NetworkChannel,
  type NetworkTransport,
  NetworkTransportError,
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
 */

/** Après une fermeture propre — un `bye` est arrivé. Court : l'intention est connue, mais un rechargement de page passe par là. */
export const GRACE_AFTER_CLEAN_CLOSE_MS = 10_000;

/** Après un silence. Long : c'est le téléphone en arrière-plan, et il revient. */
export const GRACE_AFTER_SILENCE_MS = 45_000;

/** Au-delà, un accusé de lancement manquant fait annuler le lancement. */
export const LAUNCH_ACK_TIMEOUT_MS = 15_000;

/** Au-delà, l'hôte n'a pas répondu à la présentation d'un arrivant. */
export const HANDSHAKE_TIMEOUT_MS = 10_000;

export const RoomRole = {
  Host: "host",
  Guest: "guest",
} as const;

export type RoomRole = (typeof RoomRole)[keyof typeof RoomRole];

/** Ce que l'interface affiche. Un instantané, jamais une référence sur l'état interne. */
export interface RoomView {
  code: string;
  role: RoomRole;
  /** La place de ce joueur. 1 = l'hôte. */
  seat: number;
  options: NetworkRoomOptions;
  seats: readonly NetworkSeatState[];
  /** Vrai dès « Lancer » : plus aucune connexion acceptée. */
  locked: boolean;
  /** Les places dont on attend le retour, avec ce qu'il reste de leur délai de grâce. */
  awaited: readonly AwaitedSeat[];
}

export interface AwaitedSeat {
  seat: number;
  /** Vrai si un `bye` a précédé la fermeture — le délai court s'applique alors. */
  cleanClose: boolean;
}

export interface RoomTimers {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface RoomDeps {
  transport: NetworkTransport;
  /**
   * Nombre maximal de places qu'un arrivant balaie. L'appelant le fournit
   * (`Math.max(...REQUIRED_TEAM_COUNTS)`) : ce paquet ne dépend pas de `@pokemon-tactic/data`.
   */
  maxSeats: number;
  timers?: RoomTimers;
  sleep?: (delayMs: number) => Promise<void>;
  /** Injecté par les tests pour affirmer un code exact. */
  generateCode?: () => string;
}

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

  private readonly changeListeners = new Set<(view: RoomView) => void>();
  private readonly errorListeners = new Set<(code: NetworkErrorCode) => void>();
  private readonly startListeners = new Set<(start: StartMessage) => void>();
  private readonly launchCancelledListeners = new Set<() => void>();

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
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /** Les causes de refus à afficher. Énumération fermée, ce sont aussi les valeurs de télémétrie. */
  onError(listener: (code: NetworkErrorCode) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /** L'entrée en combat. Porte tout ce qu'il faut pour monter le même combat sans un mot de plus. */
  onStart(listener: (start: StartMessage) => void): () => void {
    this.startListeners.add(listener);
    return () => this.startListeners.delete(listener);
  }

  /**
   * Le lancement a été annulé faute d'accusé. Ramène à la salle d'attente celui qui avait déjà reçu
   * le `start` — voir `launch()` pour pourquoi ce cas existe.
   */
  onLaunchCancelled(listener: () => void): () => void {
    this.launchCancelledListeners.add(listener);
    return () => this.launchCancelledListeners.delete(listener);
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
    if (this.locked) {
      channel.close();
      return;
    }
    this.attachChannel(remoteSeat, channel);
  }

  private attachChannel(remoteSeat: number, channel: NetworkChannel): void {
    this.channels.set(remoteSeat, channel);
    this.announcedBye.delete(remoteSeat);
    this.clearGrace(remoteSeat);

    channel.onMessage((message) => this.handleMessage(remoteSeat, message));
    channel.onClose(() => this.handleChannelClosed(remoteSeat));
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
      case "team_select":
      case "ready":
      case "start_ack":
      case "bye":
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
      for (const listener of [...this.launchCancelledListeners]) {
        listener();
      }
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
    const delayMs = cleanClose ? GRACE_AFTER_CLEAN_CLOSE_MS : GRACE_AFTER_SILENCE_MS;
    this.clearGrace(remoteSeat);
    this.graceTimers.set(remoteSeat, {
      cleanClose,
      handle: this.timers.setTimeout(() => this.resolveDeparture(remoteSeat), delayMs),
    });
    this.notifyChange();
  }

  /** Le délai est écoulé sans retour. C'est seulement ici qu'un départ devient un fait. */
  private resolveDeparture(remoteSeat: number): void {
    this.graceTimers.delete(remoteSeat);
    this.announcedBye.delete(remoteSeat);
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

  private clearGrace(remoteSeat: number): void {
    const existing = this.graceTimers.get(remoteSeat);
    if (existing !== undefined) {
      this.timers.clearTimeout(existing.handle);
      this.graceTimers.delete(remoteSeat);
    }
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
    for (const listener of [...this.startListeners]) {
      listener(start);
    }
  }

  private emitError(code: NetworkErrorCode): void {
    for (const listener of [...this.errorListeners]) {
      listener(code);
    }
  }

  private notifyChange(): void {
    const view = this.view;
    for (const listener of [...this.changeListeners]) {
      listener(view);
    }
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
