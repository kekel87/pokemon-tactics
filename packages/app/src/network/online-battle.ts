import { type Action, ForfeitReason } from "@pokemon-tactic/core";
import type { RoomTimers } from "@pokemon-tactic/network";
import {
  BATTLE_GRACE_AFTER_SILENCE_MS,
  ChannelHealth,
  NetworkForfeitReason,
  type Room,
} from "@pokemon-tactic/network";
import {
  type BattleOrchestrator,
  ConnectionNoticeKind,
  type RemoteActionRejection,
} from "@pokemon-tactic/view-core";
import { countAction, TelemetryAction } from "../analytics/telemetry";
import { getOnlineRoom } from "./online-room";

/**
 * Tours manqués **consécutifs** au bout desquels une place est éliminée (plan 202, décision #952).
 *
 * Trois, comme le barème de divergence du Lot B2, et pour la même raison : un tour manqué est un
 * accident banal (un appel, un écran qui se verrouille), trois d'affilée ne le sont plus. Le
 * deuxième affiche un avertissement, exactement comme le « 2/3 » des refus.
 */
const MISSED_TURN_LIMIT = 3;

/**
 * Cause de protocole → raison de moteur (plan 202, retour de recette 2026-09-09).
 *
 * Deux énumérations fermées et **un seul endroit** qui les traduit. `NetworkForfeitReason` est un
 * vocabulaire de fil (`diverged`, `absent`, `resigned`) et n'a rien à faire dans le moteur ;
 * `ForfeitReason` est ce que le journal de combat sait raconter. Sans cette table, le journal
 * annonçait « les parties ne concordent plus » à un joueur qui venait d'appuyer sur « Abandonner ».
 */
const ENGINE_FORFEIT_REASON: Record<NetworkForfeitReason, ForfeitReason> = {
  [NetworkForfeitReason.EtatDivergent]: ForfeitReason.Desynced,
  [NetworkForfeitReason.Absent]: ForfeitReason.Disconnected,
  [NetworkForfeitReason.Abandon]: ForfeitReason.Resigned,
};

/**
 * Le combat en réseau, vu de l'application (plan 201, Lot B2).
 *
 * Ce module ne connaît ni le rendu ni le moteur de jeu : il **traduit** entre le salon
 * (`packages/network`, qui parle en places) et l'orchestrateur (`packages/view-core`, qui parle en
 * joueurs). C'est ce qui garde l'écran de combat lisible et cette traduction testable seule.
 *
 * 🔴 Il ne touche **jamais** le moteur directement. Une correction de revue : appeler
 * `engine.forfeit()` d'ici rendait ses événements invisibles — rien n'écoute le moteur, tout passe
 * par la file d'animation de l'orchestrateur. Le forfait sort donc par `orchestrator.applyForfeit`.
 *
 * 🔴 **La correspondance place ↔ joueur est un invariant qui court sur trois fichiers** : `room.ts`
 * trie par place croissante → le setup mappe l'index sur `PLAYER_IDS` → le placement préserve
 * l'ordre. Le même invariant que la dérivation des graines d'IA (`wireScoredAi`), et il se lit ici de
 * la même façon : la place *n* est le joueur d'index *n - 1*.
 */

/**
 * La part de l'orchestrateur que ce module emprunte — et rien de plus (correctif de revue).
 *
 * Un `Pick` plutôt que `BattleOrchestrator` entier, pour la même raison que `RoomSurface` ci-dessous
 * existe côté salon : les faux orchestrateurs des tests devaient sinon passer par un
 * `as unknown as BattleOrchestrator`, donc un élargissement futur de cette surface ne ferait plus
 * échouer la compilation — il jetterait au runtime, ou passerait en silence sur un chemin non
 * exercé. Le lot vient justement d'y ajouter trois membres.
 */
export type OnlineBattleOrchestrator = Pick<
  BattleOrchestrator,
  | "submitRemoteAction"
  | "applyForfeit"
  | "isBattleOver"
  | "actionsSince"
  | "currentActorPlayerId"
  | "appliedActionCount"
>;

/** Ce que l'écran de combat branche quand la partie est en ligne. `null` en local. */
export interface OnlineBattleWiring {
  /** Vrai pour un joueur humain tenu par un pair distant — celui dont il faut attendre le message. */
  isRemotePlayer(playerId: string): boolean;
  /**
   * Diffuse une action que notre moteur vient d'accepter. `timedOut` quand elle vient du
   * chronomètre et non d'un choix (plan 202, décision #952).
   */
  sendAction(actionIndex: number, action: Action, timedOut?: true): void;
  /**
   * On entre ou on sort de l'attente d'un tour distant (plan 202). C'est ce qui arme et désarme le
   * chien de garde du **silence** — celui que la fermeture de canal ne signale jamais, parce que
   * l'onglet du pair est gelé et sa connexion techniquement ouverte.
   */
  onWaitingRemote(playerId: string | null): void;
  /**
   * Branche la réception. Séparé de la construction : l'orchestrateur n'existe pas encore avant.
   *
   * `signal` défait les abonnements à la sortie du combat. Sans lui, le salon leur survivant, un
   * message reçu après démontage muterait un combat qui n'existe plus — l'erreur que le `unmount` de
   * l'écran de sélection d'équipe documente déjà pour ses propres écouteurs.
   */
  attach(orchestrator: OnlineBattleOrchestrator, signal: AbortSignal): void;
  /** Applique le barème (décision D1) : au troisième refus, la place est éliminée. */
  onRejection(rejection: RemoteActionRejection): void;
  /**
   * Le joueur abandonne volontairement (plan 202, étape 6).
   *
   * 🔴 **Répare un bug, n'ajoute pas une fonctionnalité.** L'entrée « Abandonner » du menu de combat
   * existe depuis le plan 187 avec sa confirmation ; en ligne elle rendait la main au menu principal
   * **sans prévenir l'adversaire**, qui restait devant un tour qui ne viendrait jamais jusqu'à ce que
   * le chien de garde tombe. À appeler **avant** de libérer le salon : après, il n'y a plus de canal
   * pour le dire.
   */
  resign(): void;
}

/**
 * Ce que l'écran de combat doit AFFICHER de l'état du réseau (plan 202, Lot B3).
 *
 * Trois sources, un seul bandeau : le pair dont on attend le retour, l'avertissement de tours
 * manqués, et — à l'étape 3 du plan — la connexion que WebRTC juge incertaine. Le module réseau ne
 * connaît pas le DOM : il décrit, l'écran rend.
 */
export interface ConnectionNotice {
  /**
   * Par ordre de gravité croissante, qui est **aussi** l'ordre de priorité d'affichage :
   * - `missed-turns` : le pair répond, mais il laisse expirer ses tours ;
   * - `connection-uncertain` : ICE ne reçoit plus de réponse, souvent passager (~5 s) ;
   * - `awaiting-reconnect` : le canal est tombé, le délai de grâce court.
   */
  kind: ConnectionNoticeKind;
  /** La place concernée, pour que le texte puisse dire de qui il parle. */
  seat: number;
  /**
   * Budget de grâce réellement accordé par le salon, en ms — jamais une constante redevinée ici : il
   * vaut 10 s après un départ propre et bien plus après un silence. `awaiting-reconnect` seulement.
   */
  graceMs?: number;
  /** Tours manqués d'affilée, pour le « 2/3 ». `missed-turns` seulement. */
  missedTurns?: number;
  /** Total du barème, pour ne pas coder « 3 » deux fois. */
  limit?: number;
}

function playerIdForSeat(allPlayerIds: readonly string[], seat: number): string | undefined {
  return allPlayerIds[seat - 1];
}

/**
 * Monte l'échange d'actions si la partie est en ligne, et rend `null` sinon — donc l'écran de combat
 * monte les deux sortes de partie avec le même code.
 *
 * `localSeat` absent **ou** salon fermé ⇒ rien à brancher. Le second cas n'est pas théorique : un
 * combat **repris** (plan 181) rejoue un setup en ligne sans salon derrière.
 *
 * ⚠️ Rendre `null` ne dit **pas** « partie locale ». Qui est cette machine se lit dans
 * `setup.localSeat`, indépendamment d'ici — confondre les deux faisait retomber une partie en ligne
 * sans salon en hot-seat sur les deux camps (revue de code).
 */
export function wireOnlineBattle(
  input: {
    localSeat: number | undefined;
    allPlayerIds: readonly string[];
    humanPlayerIds: readonly string[];
    /**
     * Vrai quand ce combat est une **reprise** (plan 202, étape 5) : le câblage réclamera alors les
     * actions jouées pendant l'absence. Faux au démarrage normal, où les deux pairs sont à l'index 0
     * et où une demande de rattrapage ne serait que du bruit.
     */
    resuming?: boolean;
  },
  deps: OnlineBattleDeps = {},
): OnlineBattleWiring | null {
  const { localSeat, allPlayerIds, humanPlayerIds } = input;
  if (localSeat === undefined) {
    return null;
  }
  const room = getOnlineRoom();
  if (room === null) {
    return null;
  }
  const localPlayerId = playerIdForSeat(allPlayerIds, localSeat);
  if (localPlayerId === undefined) {
    return null;
  }
  return createWiring(room, localPlayerId, allPlayerIds, humanPlayerIds, {
    ...deps,
    ...(input.resuming === undefined ? {} : { resuming: input.resuming }),
  });
}

type RoomSurface = Pick<
  Room,
  | "sendAction"
  | "sendForfeit"
  | "onAction"
  | "onForfeit"
  | "onPeerAbsent"
  | "onPeerAwaited"
  | "onPeerReturned"
  | "onPeerHealth"
  | "onResyncRequest"
  | "onResync"
  | "sendResyncRequest"
  | "sendResync"
>;

/** Ce que le câblage a besoin d'emprunter au monde extérieur. Injecté par les tests. */
export interface OnlineBattleDeps {
  timers?: RoomTimers;
  /** Ce qu'il faut afficher de l'état du réseau. `null` efface le bandeau. */
  onNotice?: (notice: ConnectionNotice | null) => void;
  /** Ce combat est une reprise : réclamer les actions manquées au branchement (plan 202). */
  resuming?: boolean;
}

const defaultTimers: RoomTimers = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** @internal Exposé pour les tests : le même câblage, sans passer par le salon de la session. */
export function createWiring(
  room: RoomSurface,
  localPlayerId: string,
  allPlayerIds: readonly string[],
  humanPlayerIds: readonly string[],
  deps: OnlineBattleDeps = {},
): OnlineBattleWiring {
  /*
   * Un joueur distant est un HUMAIN qui n'est pas nous. Les places tenues par l'IA sont exclues à
   * dessein : l'IA est déterministe et tourne des deux côtés (décision #901), donc son tour se joue
   * localement — l'attendre par le réseau bloquerait la partie pour toujours.
   */
  const remotePlayerIds = new Set(humanPlayerIds.filter((playerId) => playerId !== localPlayerId));
  let attached: OnlineBattleOrchestrator | null = null;

  const timers = deps.timers ?? defaultTimers;

  /*
   * Les trois sources du bandeau, tenues à part et recomposées à chaque changement (plan 202).
   *
   * Un seul `notify` impératif par source ne suffisait pas : les états se chevauchent — un pair peut
   * avoir manqué deux tours PUIS perdre sa connexion — et le dernier appelé gagnerait au lieu du plus
   * grave. `refreshNotice` tranche par gravité, une fois, au même endroit.
   */
  let awaitedPeer: { seat: number; graceMs: number } | null = null;
  let uncertainSeat: number | null = null;
  let missedWarning: { seat: number; missedTurns: number } | null = null;
  let lastNoticeKey = "";

  const refreshNotice = (): void => {
    /*
     * 🔴 Rien à dire sur une partie FINIE (retour de recette 2026-09-09).
     *
     * Un abandon fait partir le pair : son canal se referme, donc un délai de grâce s'ouvre chez
     * celui qui reste, donc le bandeau « en attente de reconnexion » s'affichait **par-dessus
     * l'écran de victoire** — à attendre le retour de quelqu'un dont la partie est terminée. Le même
     * chemin vaut pour un forfait de divergence ou d'absence : l'issue est prononcée, l'attente n'a
     * plus d'objet.
     */
    if (attached?.isBattleOver() === true) {
      if (lastNoticeKey !== "") {
        lastNoticeKey = "";
        deps.onNotice?.(null);
      }
      return;
    }
    const notice: ConnectionNotice | null =
      awaitedPeer === null
        ? uncertainSeat === null
          ? missedWarning === null
            ? null
            : {
                kind: ConnectionNoticeKind.MissedTurns,
                seat: missedWarning.seat,
                missedTurns: missedWarning.missedTurns,
                limit: MISSED_TURN_LIMIT,
              }
          : { kind: ConnectionNoticeKind.ConnectionUncertain, seat: uncertainSeat }
        : {
            kind: ConnectionNoticeKind.AwaitingReconnect,
            seat: awaitedPeer.seat,
            graceMs: awaitedPeer.graceMs,
          };
    // Un bandeau identique ne se republie pas : côté DOM il porte un décompte qui repart de son
    // budget à chaque mise à jour, donc le renvoyer inchangé le ferait redémarrer sans raison.
    const key = notice === null ? "" : JSON.stringify(notice);
    if (key === lastNoticeKey) {
      return;
    }
    lastNoticeKey = key;
    deps.onNotice?.(notice);
  };

  const clearAllNotices = (): void => {
    awaitedPeer = null;
    uncertainSeat = null;
    missedWarning = null;
    refreshNotice();
  };
  /** Tours manqués d'affilée, par place. Une action sans `timedOut` remet le compteur à zéro. */
  const missedTurnsBySeat = new Map<number, number>();
  /** Le minuteur du silence, et la place qu'il surveille. Un seul à la fois : le réseau est en 1v1. */
  let silenceTimer: { seat: number; handle: unknown } | null = null;

  const clearSilenceWatchdog = (): void => {
    if (silenceTimer === null) {
      return;
    }
    timers.clearTimeout(silenceTimer.handle);
    silenceTimer = null;
  };

  const seatForPlayer = (playerId: string): number | undefined => {
    const index = allPlayerIds.indexOf(playerId);
    return index === -1 ? undefined : index + 1;
  };

  /**
   * Éliminer une place, par le seul chemin qui existe (plan 201, réutilisé par le Lot B3).
   *
   * 🔴 **On le DIT avant de l'appliquer.** Un pair absent peut revenir, et un pair divergent peut ne
   * pas nous écouter : dans les deux cas, notre propre moteur doit trancher, mais les autres doivent
   * savoir pourquoi un camp disparaît.
   */
  const forfeitSeat = (
    seat: number,
    reason: NetworkForfeitReason,
    /**
     * Le compteur à incrémenter. Séparé de `reason` **exprès** : le chien de garde et les trois
     * tours manqués partagent la cause `absent` — l'un est un joueur parti, l'autre un joueur
     * présent qui ne joue plus — et les confondre en télémétrie masquerait lequel des deux
     * mécanismes tranche vraiment (plan 202).
     */
    counted: TelemetryAction,
  ): void => {
    const playerId = allPlayerIds[seat - 1];
    if (playerId === undefined || attached === null) {
      return;
    }
    clearSilenceWatchdog();
    clearAllNotices();
    countAction(counted);
    room.sendForfeit(seat, reason);
    attached.applyForfeit(playerId, ENGINE_FORFEIT_REASON[reason]);
  };

  return {
    isRemotePlayer: (playerId) => remotePlayerIds.has(playerId),
    sendAction: (actionIndex, action, timedOut) => room.sendAction(actionIndex, action, timedOut),

    /*
     * Arme le chien de garde du SILENCE, celui que la fermeture de canal ne signale jamais : un
     * onglet gelé garde sa connexion techniquement ouverte, donc `handleChannelClosed` ne part pas.
     *
     * 🔴 Mesuré depuis MAINTENANT, c'est-à-dire depuis l'entrée dans l'attente — jamais depuis la
     * date du dernier message reçu (décision #951). Pendant notre propre tour, l'adversaire n'a rien
     * à envoyer : son silence est le comportement normal, et le compter serait éliminer un joueur
     * attentif pendant qu'on réfléchit.
     */
    onWaitingRemote: (playerId) => {
      clearSilenceWatchdog();
      if (playerId === null) {
        return;
      }
      const seat = seatForPlayer(playerId);
      if (seat === undefined) {
        return;
      }
      /*
       * Toujours le délai long, et jamais le palier court de `BATTLE_GRACE_SHORT_MS`.
       *
       * Le palier appartient au chien de garde de **connexion** (`room.ts`), où un pair peut
       * réellement tomber, revenir, puis retomber. Ici il n'y a pas de fois suivante : si ce
       * minuteur tombe, il prononce le forfait et la partie est finie. Un palier y serait du code
       * qu'aucun chemin n'atteint.
       */
      silenceTimer = {
        seat,
        handle: timers.setTimeout(() => {
          silenceTimer = null;
          forfeitSeat(seat, NetworkForfeitReason.Absent, TelemetryAction.ForfeitAbsent);
        }, BATTLE_GRACE_AFTER_SILENCE_MS),
      };
    },

    attach: (orchestrator, signal) => {
      attached = orchestrator;

      /*
       * Réclamer les actions manquées, sur une REPRISE seulement : une partie qui démarre
       * normalement est à l'index 0 des deux côtés, il n'y a rien à rattraper.
       *
       * 🔴 **Réémissible, parce qu'un hôte revenu n'a encore AUCUN canal.**
       *
       * `sendResyncRequest` diffuse sur les canaux ouverts ; un hôte qui revient par `Room.rejoin`
       * n'en a aucun — contrairement à l'invité, il ne compose pas, il attend d'être rappelé (jusqu'à
       * 2 s plus tard, décision #957). Sa demande partait donc dans le vide, silencieusement, et
       * personne ne la réémettait : il restait à un index inférieur, chaque action reçue se faisait
       * refuser sur `desynced_index`, et au troisième refus il **forfaitait un pair innocent**.
       * C'est la quatrième couche du même trou d'asymétrie que #957 et #960 — relevée en revue.
       *
       * Déclaré ici, avant les écouteurs qui l'appellent : les closures ne s'exécutent que plus tard,
       * mais lire une `const` déclarée cent lignes plus bas est un piège gratuit.
       */
      let resyncSettled = false;
      const requestResync = (): void => {
        if (deps.resuming !== true || resyncSettled) {
          return;
        }
        room.sendResyncRequest(orchestrator.appliedActionCount);
      };

      /*
       * Le rattrapage, dans les deux sens (plan 202, étape 5, décision #955).
       *
       * Le pair RESTÉ répond : il rend la queue de son journal à partir de l'index demandé.
       * `actionsSince` est un membre mince de l'orchestrateur — la vue n'expose pas son moteur.
       */
      const unsubscribeResyncRequest = room.onResyncRequest((message) => {
        room.sendResync(message.actionIndex, orchestrator.actionsSince(message.actionIndex));
      });

      /*
       * Le pair REVENU applique. Une par une, dans l'ordre, par `submitRemoteAction` : le même
       * chemin, les mêmes quatre contrôles, le même barème. **Aucun mode « confiance »** — une
       * divergence pendant un rattrapage est justement le moment où on veut la voir.
       *
       * Les actions arrivent NUES, sans place d'auteur : le revenant rejoue un état déterministe,
       * donc son propre moteur sait qui doit agir à chaque index. On lit donc l'acteur courant à
       * chaque tour de boucle — jamais une fois avant, l'acteur changeant à chaque action appliquée.
       */
      const unsubscribeResync = room.onResync((message) => {
        // La réponse est arrivée : plus rien à réclamer, même si un pair se rebranche ensuite.
        resyncSettled = true;
        for (const [offset, action] of message.actions.entries()) {
          const actionIndex = message.fromIndex + offset;
          const playerId = orchestrator.currentActorPlayerId();
          if (playerId === null) {
            // Plus d'acteur : le combat s'est terminé pendant le rattrapage. Rien à appliquer.
            return;
          }
          const actorSeat = seatForPlayer(playerId);
          if (actorSeat === undefined) {
            return;
          }
          const applied = orchestrator.submitRemoteAction({
            seat: actorSeat,
            playerId,
            actionIndex,
            action,
          });
          if (!applied) {
            /*
             * Refusé : nos deux journaux ne racontent pas la même histoire, et insister ferait
             * empiler des refus sur un état déjà faux. Le barème a déjà compté celui-ci, et c'est
             * lui qui conclura — pas cette boucle.
             */
            return;
          }
        }
      });

      const unsubscribeAction = room.onAction((message) => {
        const playerId = playerIdForSeat(allPlayerIds, message.seat);
        if (playerId === undefined) {
          // Une place hors du format de cette partie : rien à quoi l'appliquer.
          return;
        }
        /*
         * Compteur de tours manqués (plan 202, décision #952), AVANT d'appliquer : que l'action soit
         * acceptée ou refusée, elle nous apprend que le pair est vivant et ce qu'il a fait de son
         * tour. Une action sans `timedOut` remet le compteur à zéro — un tour manqué isolé est un
         * accident, trois d'affilée sont une absence.
         */
        if (message.timedOut === true) {
          const missedTurns = (missedTurnsBySeat.get(message.seat) ?? 0) + 1;
          missedTurnsBySeat.set(message.seat, missedTurns);
          if (missedTurns >= MISSED_TURN_LIMIT) {
            forfeitSeat(
              message.seat,
              NetworkForfeitReason.Absent,
              TelemetryAction.ForfeitMissedTurns,
            );
            return;
          }
          if (missedTurns === MISSED_TURN_LIMIT - 1) {
            // Le même avertissement que le « 2/3 » du barème de divergence : personne ne doit être
            // éliminé sans avoir vu venir le dernier coup.
            missedWarning = { seat: message.seat, missedTurns };
            refreshNotice();
          }
        } else {
          missedTurnsBySeat.delete(message.seat);
          if (missedWarning?.seat === message.seat) {
            missedWarning = null;
            refreshNotice();
          }
        }
        orchestrator.submitRemoteAction({
          seat: message.seat,
          playerId,
          actionIndex: message.actionIndex,
          action: message.action,
        });
      });

      /*
       * Le salon a constaté qu'une place s'est tue et que son délai de grâce est écoulé. Il ne
       * décide rien (décision #951) : c'est ici qu'on traduit la place en joueur et qu'on applique.
       */
      const unsubscribeAbsent = room.onPeerAbsent((seat) => {
        forfeitSeat(seat, NetworkForfeitReason.Absent, TelemetryAction.ForfeitAbsent);
      });

      /*
       * Le canal d'une place est tombé et son délai court : c'est l'état le plus grave du bandeau,
       * et le seul qui porte un décompte. Le budget vient du salon — 10 s après un départ propre,
       * bien plus après un silence — plutôt que d'être redeviné ici.
       */
      const unsubscribeAwaited = room.onPeerAwaited((seat, graceMs) => {
        awaitedPeer = { seat, graceMs };
        refreshNotice();
      });

      /*
       * Le revenant est là. Son canal est NEUF, donc son état ICE ne changera pas en s'ouvrant :
       * sans ce signal le bandeau resterait sur une partie qui a repris.
       */
      const unsubscribeReturned = room.onPeerReturned((seat) => {
        if (awaitedPeer?.seat === seat) {
          awaitedPeer = null;
        }
        if (uncertainSeat === seat) {
          uncertainSeat = null;
        }
        refreshNotice();
        /*
         * 🔴 **Le chien de garde du silence RECOMMENCE son attente** (correctif de revue).
         *
         * Il court depuis l'entrée en `waiting_remote` (décision #951) et rien ne le réarmait : un
         * pair qui perdait sa connexion puis revenait à 25 s se faisait éliminer à 75 s, alors que
         * son propre chronomètre — remis à neuf par son écran fraîchement monté — lui annonçait
         * encore 10 s. Les deux camps voyaient deux vérités, et c'est celui qui était resté qui
         * tranchait. Un pair qui revient reprend son tour, donc son délai aussi.
         */
        if (silenceTimer?.seat === seat) {
          clearSilenceWatchdog();
          silenceTimer = {
            seat,
            handle: timers.setTimeout(() => {
              silenceTimer = null;
              forfeitSeat(seat, NetworkForfeitReason.Absent, TelemetryAction.ForfeitAbsent);
            }, BATTLE_GRACE_AFTER_SILENCE_MS),
          };
        }
        // Et il redemande la suite : c'est maintenant qu'il y a un canal pour la porter.
        requestResync();
      });

      /*
       * Le signal précoce (décision #956) : ICE sait en ~5 s ce que le chien de garde ne dira qu'à
       * 75 s. Purement informatif — `Failed` ne prononce rien, c'est `onPeerAwaited` qui prend la
       * suite avec son décompte, et `Uncertain` se rétablit très souvent tout seul.
       */
      const unsubscribeHealth = room.onPeerHealth((seat, health) => {
        if (health === ChannelHealth.Uncertain) {
          // Compté à CHAQUE dégradation, pas une fois par partie : ce qu'on cherche à savoir est si
          // le pair-à-pair sans relais tient, donc c'est la fréquence qui parle.
          countAction(TelemetryAction.ConnectionUncertain);
          uncertainSeat = seat;
        } else if (uncertainSeat === seat) {
          uncertainSeat = null;
        }
        refreshNotice();
      });
      const unsubscribeForfeit = room.onForfeit((message) => {
        const playerId = playerIdForSeat(allPlayerIds, message.forfeitedSeat);
        if (playerId === undefined) {
          return;
        }
        /*
         * On applique, y compris quand c'est NOUS qui sommes désignés : c'est ainsi que l'intéressé
         * apprend qu'il est éliminé au lieu de continuer à jouer seul dans le vide (décision D5).
         * `forfeit` est idempotent, donc un constat qui arrive de deux pairs à la fois ne compte
         * qu'une fois.
         */
        orchestrator.applyForfeit(playerId, ENGINE_FORFEIT_REASON[message.reason]);
      });
      /*
       * La demande part **après** les écouteurs, et c'est l'ordre qui compte : une action jouée par
       * le pair resté peut croiser la demande, et sans l'abonnement déjà en place elle serait perdue.
       */
      requestResync();

      signal.addEventListener(
        "abort",
        () => {
          unsubscribeAction();
          unsubscribeForfeit();
          unsubscribeAbsent();
          unsubscribeAwaited();
          unsubscribeReturned();
          unsubscribeHealth();
          unsubscribeResyncRequest();
          unsubscribeResync();
          // Un minuteur qui survit à l'écran ferait prononcer un forfait dans une partie qui
          // n'existe plus — la même erreur que les écouteurs non défaits.
          clearSilenceWatchdog();
          attached = null;
        },
        { once: true },
      );
    },

    /*
     * On le DIT, et on ne l'applique pas chez nous : le joueur qui abandonne s'en va, son écran de
     * combat est démonté juste après. C'est la différence avec le forfait de divergence, où l'on
     * reste dans la partie et où notre propre moteur doit trancher.
     *
     * `forfeitedSeat` vaut notre place : c'est précisément le cas que ce champ prévoyait.
     */
    resign: () => {
      const seat = seatForPlayer(localPlayerId);
      if (seat === undefined) {
        return;
      }
      clearSilenceWatchdog();
      clearAllNotices();
      countAction(TelemetryAction.ForfeitResigned);
      room.sendForfeit(seat, NetworkForfeitReason.Abandon);
    },

    onRejection: (rejection) => {
      /*
       * La cause précise, à chaque refus, y compris ceux qui ne décident rien.
       *
       * C'est ce que l'étape 5 du plan exigeait, et pour une raison de recette : un bug de
       * déterminisme de notre côté et une vraie divergence chez le pair donnent le même symptôme —
       * des actions refusées. Sans la cause, on ne peut pas les distinguer après coup.
       */
      // biome-ignore lint/suspicious/noConsole: diagnostic uniquement — le joueur voit le barème dans son interface, et c'est la seule trace de la CAUSE d'un refus. Sans elle, un bug de déterminisme de notre côté et une divergence chez le pair sont indiscernables en recette (exigence de l'étape 5 du plan 201).
      console.warn(
        `[réseau] action refusée (place ${rejection.seat}, ${rejection.strike}/${rejection.limit})`,
        rejection.cause,
      );
      if (rejection.strike < rejection.limit) {
        // Premier et deuxième refus : rien n'est décidé. Un hoquet isolé est un bug plausible de
        // notre côté, et éliminer quelqu'un dessus serait pire que le laisser jouer un tour de trop.
        return;
      }
      const playerId = playerIdForSeat(allPlayerIds, rejection.seat);
      if (playerId === undefined || attached === null) {
        return;
      }
      /*
       * Troisième refus : on constate la divergence. On le DIT avant de l'appliquer, pour que
       * l'intéressé et les camps tiers sachent pourquoi un camp disparaît — puis on l'applique chez
       * nous, parce qu'un pair divergent peut très bien ne pas nous écouter.
       */
      countAction(TelemetryAction.ForfeitDiverged);
      room.sendForfeit(rejection.seat, NetworkForfeitReason.EtatDivergent);
      attached.applyForfeit(playerId);
    },
  };
}
