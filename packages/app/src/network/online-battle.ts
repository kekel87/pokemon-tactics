import type { Action } from "@pokemon-tactic/core";
import { NetworkForfeitReason, type Room } from "@pokemon-tactic/network";
import type { BattleOrchestrator, RemoteActionRejection } from "@pokemon-tactic/view-core";
import { getOnlineRoom } from "./online-room";

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

/** Ce que l'écran de combat branche quand la partie est en ligne. `null` en local. */
export interface OnlineBattleWiring {
  /** Vrai pour un joueur humain tenu par un pair distant — celui dont il faut attendre le message. */
  isRemotePlayer(playerId: string): boolean;
  /** Diffuse une action que notre moteur vient d'accepter. */
  sendAction(actionIndex: number, action: Action): void;
  /**
   * Branche la réception. Séparé de la construction : l'orchestrateur n'existe pas encore avant.
   *
   * `signal` défait les abonnements à la sortie du combat. Sans lui, le salon leur survivant, un
   * message reçu après démontage muterait un combat qui n'existe plus — l'erreur que le `unmount` de
   * l'écran de sélection d'équipe documente déjà pour ses propres écouteurs.
   */
  attach(orchestrator: BattleOrchestrator, signal: AbortSignal): void;
  /** Applique le barème (décision D1) : au troisième refus, la place est éliminée. */
  onRejection(rejection: RemoteActionRejection): void;
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
export function wireOnlineBattle(input: {
  localSeat: number | undefined;
  allPlayerIds: readonly string[];
  humanPlayerIds: readonly string[];
}): OnlineBattleWiring | null {
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
  return createWiring(room, localPlayerId, allPlayerIds, humanPlayerIds);
}

type RoomSurface = Pick<Room, "sendAction" | "sendForfeit" | "onAction" | "onForfeit">;

/** @internal Exposé pour les tests : le même câblage, sans passer par le salon de la session. */
export function createWiring(
  room: RoomSurface,
  localPlayerId: string,
  allPlayerIds: readonly string[],
  humanPlayerIds: readonly string[],
): OnlineBattleWiring {
  /*
   * Un joueur distant est un HUMAIN qui n'est pas nous. Les places tenues par l'IA sont exclues à
   * dessein : l'IA est déterministe et tourne des deux côtés (décision #901), donc son tour se joue
   * localement — l'attendre par le réseau bloquerait la partie pour toujours.
   */
  const remotePlayerIds = new Set(humanPlayerIds.filter((playerId) => playerId !== localPlayerId));
  let attached: BattleOrchestrator | null = null;

  return {
    isRemotePlayer: (playerId) => remotePlayerIds.has(playerId),
    sendAction: (actionIndex, action) => room.sendAction(actionIndex, action),

    attach: (orchestrator, signal) => {
      attached = orchestrator;
      const unsubscribeAction = room.onAction((message) => {
        const playerId = playerIdForSeat(allPlayerIds, message.seat);
        if (playerId === undefined) {
          // Une place hors du format de cette partie : rien à quoi l'appliquer.
          return;
        }
        orchestrator.submitRemoteAction({
          seat: message.seat,
          playerId,
          actionIndex: message.actionIndex,
          action: message.action,
        });
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
        orchestrator.applyForfeit(playerId);
      });
      signal.addEventListener(
        "abort",
        () => {
          unsubscribeAction();
          unsubscribeForfeit();
          attached = null;
        },
        { once: true },
      );
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
      room.sendForfeit(rejection.seat, NetworkForfeitReason.EtatDivergent);
      attached.applyForfeit(playerId);
    },
  };
}
