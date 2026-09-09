import { ConnectionNoticeKind, type ConnectionNoticeView } from "@pokemon-tactic/view-core";
import type { UiDomConfig } from "./config.js";
import { el } from "./dom-helpers.js";

/**
 * ConnectionNotice — le bandeau d'état du réseau, sous le compteur de tour (plan 202, Lot B3).
 *
 * Il remplace le silence de la phase `waiting_remote`, qui ne disait rien de ce qui se passe : un
 * joueur dont l'adversaire vient de perdre sa connexion attendait un tour sans fin, sans savoir s'il
 * devait patienter ou fermer l'onglet.
 *
 * 🔴 **Le décompte tourne ici, et nulle part ailleurs.** Le module réseau donne un budget
 * (`graceMs`) ; le transformer en secondes qui défilent demande un battement, et le seul endroit du
 * projet où un battement d'une seconde est banal est le DOM. Ça garde `packages/network` sans
 * horloge — c'est la même raison qui met le chronomètre de tour dans l'orchestrateur et pas dans le
 * moteur.
 */

const NOTICE_LABEL_KEY: Record<ConnectionNoticeKind, string> = {
  [ConnectionNoticeKind.MissedTurns]: "battle.network.missedTurns",
  [ConnectionNoticeKind.ConnectionUncertain]: "battle.network.uncertain",
  [ConnectionNoticeKind.AwaitingReconnect]: "battle.network.awaitingReconnect",
};

/** Cadence du décompte. Une seconde : c'est la granularité qu'il affiche. */
const COUNTDOWN_TICK_MS = 1_000;

export interface ConnectionNotice {
  readonly element: HTMLElement;
  update(view: ConnectionNoticeView | null): void;
  destroy(): void;
}

export function createConnectionNotice(config: UiDomConfig): ConnectionNotice {
  const root = el("div", "cn-notice", "connection-notice");
  root.hidden = true;
  // Le bandeau apparaît sans que le joueur ait rien fait, et il porte une information dont dépend sa
  // partie : il doit être annoncé. `polite` et non `assertive` — ça n'interrompt pas une lecture en
  // cours, et le décompte lui-même est hors de la région annoncée (voir `countdown` plus bas).
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");

  const label = el("span", "cn-label", "connection-notice-label");
  const countdown = el("span", "cn-countdown", "connection-notice-countdown");
  // Hors de l'annonce : un décompte à la seconde relu à voix haute couvrirait tout le reste.
  countdown.setAttribute("aria-hidden", "true");
  root.append(label, countdown);

  let tickHandle: ReturnType<typeof setInterval> | null = null;
  let deadlineAt: number | null = null;

  const stopCountdown = (): void => {
    if (tickHandle !== null) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
    deadlineAt = null;
    countdown.textContent = "";
    countdown.hidden = true;
  };

  const paintCountdown = (): void => {
    if (deadlineAt === null) {
      return;
    }
    // Arrondi au plafond, comme le compteur de tour : afficher « 0 » pendant presque une seconde
    // alors que le pair peut encore revenir ferait mentir le bandeau au pire moment.
    const remainingSeconds = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1_000));
    countdown.textContent = config.translate("battle.network.countdown", {
      seconds: remainingSeconds,
    });
    if (remainingSeconds === 0) {
      // Plus rien à décompter. On garde le bandeau — c'est le module réseau qui décide de la suite,
      // pas l'affichage — mais on arrête de battre pour rien.
      stopCountdown();
      countdown.textContent = config.translate("battle.network.countdown", { seconds: 0 });
      countdown.hidden = false;
    }
  };

  return {
    element: root,
    update: (view: ConnectionNoticeView | null) => {
      stopCountdown();
      if (!view) {
        root.hidden = true;
        return;
      }
      label.textContent = config.translate(NOTICE_LABEL_KEY[view.kind], {
        player: view.playerNumber,
        missed: view.missedTurns ?? 0,
        limit: view.limit ?? 0,
      });
      root.classList.toggle("cn-severe", view.kind === ConnectionNoticeKind.AwaitingReconnect);
      if (view.graceMs !== undefined && view.graceMs > 0) {
        deadlineAt = Date.now() + view.graceMs;
        countdown.hidden = false;
        paintCountdown();
        tickHandle = setInterval(paintCountdown, COUNTDOWN_TICK_MS);
      }
      root.hidden = false;
    },
    destroy: () => {
      stopCountdown();
      root.remove();
    },
  };
}
