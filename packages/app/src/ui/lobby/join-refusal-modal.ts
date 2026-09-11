import type { NetworkErrorCode } from "@pokemon-tactic/network";
import { Modal } from "@pokemon-tactic/ui-dom";
import { t } from "../../i18n";
import type { TranslationKey } from "../../i18n/types";
import { isRetryableRefusal } from "../../network/network-error";

/**
 * Le refus de rejoindre une partie, en modale (plan 207, étape 5).
 *
 * 🔴 Le défaut qu'elle corrige n'était pas d'abord esthétique, c'était **où** le refus arrivait.
 * L'écran `lobby` ne savait prononcer qu'un seul refus — la forme du code — et les six causes
 * réelles s'affichaient en pied de page de l'écran de SÉLECTION D'ÉQUIPE, donc après avoir quitté le
 * lobby. Un code mal recopié envoyait le joueur composer une équipe pour une partie qui n'existe
 * pas, avec une ligne rouge en bas de page. L'entrée de backlog décrivait, elle, un `<p>` du lobby :
 * elle se trompait.
 *
 * La connexion est donc tentée **avant** de naviguer (voir `lobby-screen.ts`), et son refus se
 * prononce ici, par-dessus la roue que le joueur a encore sous les yeux.
 */

export interface JoinRefusalCallbacks {
  /** Rendre la main au lobby : le focus retourne sur la roue, le joueur corrige. */
  onRetry: () => void;
  /** Quitter le jeu en ligne — la cause n'est pas corrigeable d'ici. */
  onBackToMenu: () => void;
}

/**
 * Ouvre la modale de refus. Elle se referme d'elle-même sur l'un ou l'autre bouton, et la fermeture
 * native du `<dialog>` (`Échap`, B à la manette via `cancelToModalOrBack`) vaut « réessayer » :
 * refermer sans rien dire laisserait le joueur devant un lobby qui n'a pas réagi à son geste.
 */
export function openJoinRefusalModal(
  code: NetworkErrorCode,
  callbacks: JoinRefusalCallbacks,
): void {
  const retryable = isRetryableRefusal(code);
  // Une seule sortie par cause, donc un seul récepteur : la fermeture native tombe sur celui qui
  // convient, sans que le bouton ait à mémoriser lequel a été pressé.
  const dismiss = retryable ? callbacks.onRetry : callbacks.onBackToMenu;

  const modal = new Modal({
    title: t("lobby.refusedTitle"),
    closeAriaLabel: t("lobby.back"),
    onClose: () => dismiss(),
  });

  const body = modal.getBody();
  body.dataset.testid = "join-refusal";

  const message = document.createElement("p");
  message.className = "lb-refusal-message";
  message.dataset.testid = "join-refusal-message";
  // Les six libellés existaient déjà pour le pied de page de la salle d'attente : on les déplace,
  // on n'en rédige aucun.
  message.textContent = t(`room.error.${code}` as TranslationKey);
  body.append(message);

  const actions = document.createElement("div");
  actions.className = "lb-refusal-actions";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "tb-btn";
  button.dataset.variant = "primary";
  button.dataset.testid = "join-refusal-dismiss";
  button.textContent = retryable ? t("lobby.retry") : t("lobby.backToMenu");
  // `modal.close()` seul : la fermeture déclenche `onClose`, donc appeler `dismiss` ici aussi le
  // jouerait deux fois — et « Retour au menu » naviguerait par-dessus sa propre navigation.
  button.addEventListener("click", () => modal.close());
  actions.append(button);
  body.append(actions);

  button.focus();
}
