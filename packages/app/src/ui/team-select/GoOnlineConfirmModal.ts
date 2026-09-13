import { Modal } from "@pokemon-tactic/ui-dom";
import { t } from "../../i18n";

/**
 * La confirmation de la bascule solo → partie en ligne (plan 208, étape 5).
 *
 * 🔴 Elle ne s'ouvre QUE quand la bascule détruit quelque chose : un format à plus de deux camps
 * (le réseau n'en accepte pas d'autre), ou un second camp composé à la main qui va être libéré. En
 * 1v1 contre l'IA elle ne s'ouvre pas — ça ne coûterait que l'équipe de l'IA, et demander pour rien
 * apprend au joueur à cliquer sans lire. Arbitré ainsi avec l'humain au cadrage.
 *
 * Une vraie modale et pas `window.confirm` : la boîte native est injoignable à la manette, ce que la
 * recette multi-entrée du projet interdit (`.claude/rules/multi-input.md`).
 */
export interface GoOnlineConfirmOptions {
  /** Ce que la bascule va coûter, déjà rédigé par l'appelant qui seul sait ce qu'il détruit. */
  message: string;
  onConfirm: () => void;
}

export function openGoOnlineConfirmModal(options: GoOnlineConfirmOptions): void {
  const modal = new Modal({
    title: t("teamSelect.online.switchTitle"),
    closeAriaLabel: t("teamBuilder.aria.close"),
  });

  const body = modal.getBody();
  body.dataset.testid = "go-online-confirm";

  const message = document.createElement("p");
  message.className = "ts-confirm-message";
  message.textContent = options.message;
  body.append(message);

  const actions = document.createElement("div");
  actions.className = "ts-confirm-actions";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "tb-btn";
  cancel.dataset.variant = "ghost";
  cancel.dataset.testid = "go-online-cancel";
  cancel.textContent = t("teamSelect.online.switchCancel");
  cancel.addEventListener("click", () => modal.close());

  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "tb-btn";
  confirm.dataset.variant = "primary";
  confirm.dataset.testid = "go-online-confirm-button";
  confirm.textContent = t("teamSelect.online.switchConfirm");
  confirm.addEventListener("click", () => {
    modal.close();
    options.onConfirm();
  });

  actions.append(cancel, confirm);
  body.append(actions);
  // Le geste par défaut est ANNULER : la bascule détruit quelque chose, donc l'anneau se pose sur la
  // sortie qui ne coûte rien.
  cancel.focus();
}
