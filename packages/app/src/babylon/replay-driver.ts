/*
 * Le pilote de lecture d'un replay (plan 242).
 *
 * Un replay se joue par le MÊME chemin qu'un tour distant en ligne : l'orchestrateur se verrouille
 * sur « j'attends une action » (`onTurnReady` rend `"pending"`) et on lui injecte l'action suivante du
 * journal par `submitRemoteAction`. Les animations, le journal de combat, la caméra, la victoire :
 * tout est le chemin d'un combat réel, rien n'est réécrit — et un replay ne peut donc pas dériver
 * de ce que montre une vraie partie.
 *
 * Ce module ne connaît ni le moteur ni le rendu : il décide QUAND donner l'action suivante (lecture,
 * pause, pas) et laisse l'écran de combat la livrer. Séparé pour rester lisible seul.
 */

import type { Action } from "@pokemon-tactic/core";
import type { RemoteActionEnvelope, RemoteActionOutcome } from "@pokemon-tactic/render-ports";

export interface ReplayDriverOptions {
  actions: readonly Action[];
  /** Combien d'actions le moteur a déjà appliquées — la position de lecture, par construction. */
  appliedCount: () => number;
  /** Livre une action à l'orchestrateur. `"rejected"` = le journal ne se rejoue plus. */
  deliver: (envelope: RemoteActionEnvelope) => RemoteActionOutcome;
  /** L'état de lecture a changé : la barre doit se redessiner. */
  onChange: () => void;
  startPlaying: boolean;
}

export interface ReplayDriver {
  isPlaying(): boolean;
  /** À brancher sur `BattleOrchestrator.onTurnReady`, avec le joueur dont c'est le tour. */
  onTurnReady(playerId: string): "pending";
  togglePlay(): void;
  /** Joue exactement une action, puis reste en pause. */
  stepForward(): void;
  /** Arrête la lecture sans rien livrer (avant de reconstruire le combat, par exemple). */
  pause(): void;
  /** Arrête la lecture ET le dit à la barre : action différée refusée, ou dernière action appliquée. */
  stop(): void;
}

export function createReplayDriver(options: ReplayDriverOptions): ReplayDriver {
  let playing = options.startPlaying;
  /** L'orchestrateur attend une action : on peut en livrer une tout de suite. */
  let waiting = false;
  /** Un pas demandé pendant une animation : livré dès que l'orchestrateur reprend la main. */
  let stepRequested = false;
  /** Le joueur dont c'est le tour, appris à chaque `onTurnReady`. */
  let activePlayerId: string | undefined;

  const deliverNext = (): void => {
    const actionIndex = options.appliedCount();
    const action = options.actions[actionIndex];
    const playerId = activePlayerId;
    waiting = false;
    if (action === undefined || playerId === undefined) {
      playing = false;
      options.onChange();
      return;
    }
    const outcome = options.deliver({ seat: 0, playerId, actionIndex, action });
    // Le moteur refuse une action de son propre journal : on s'arrête plutôt que de boucler. La fin
    // normale, elle, se voit côté écran (`stop()`) : l'action n'est appliquée qu'après ce retour.
    if (outcome === "rejected") {
      playing = false;
      options.onChange();
    }
  };

  return {
    isPlaying: () => playing,
    stop() {
      playing = false;
      stepRequested = false;
      options.onChange();
    },
    onTurnReady(playerId) {
      activePlayerId = playerId;
      waiting = true;
      if (playing || stepRequested) {
        stepRequested = false;
        deliverNext();
      }
      return "pending";
    },
    togglePlay() {
      playing = !playing;
      options.onChange();
      if (playing && waiting) {
        deliverNext();
      }
    },
    stepForward() {
      playing = false;
      options.onChange();
      if (waiting) {
        deliverNext();
      } else {
        stepRequested = true;
      }
    },
    pause() {
      playing = false;
      stepRequested = false;
    },
  };
}
