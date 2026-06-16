import { Modal } from "@pokemon-tactic/ui-dom";
import { t } from "../../i18n";

export interface ClearTeamConfirmModalOptions {
  onConfirm: () => void;
  onCancel?: () => void;
}

export function openClearTeamConfirmModal(options: ClearTeamConfirmModalOptions): void {
  const modal = new Modal({
    title: t("teamBuilder.clearAllConfirmTitle"),
    closeAriaLabel: t("teamBuilder.aria.close"),
    onClose: options.onCancel,
  });

  const body = modal.getBody();
  const message = document.createElement("div");
  message.style.marginBottom = "12px";
  message.textContent = t("teamBuilder.clearAllConfirmBody");
  body.appendChild(message);

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.justifyContent = "flex-end";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "tb-btn";
  cancelBtn.dataset.variant = "ghost";
  cancelBtn.type = "button";
  cancelBtn.textContent = t("teamBuilder.clearAllConfirmNo");
  cancelBtn.addEventListener("click", () => modal.close());
  actions.appendChild(cancelBtn);

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "tb-btn";
  confirmBtn.dataset.variant = "danger";
  confirmBtn.type = "button";
  confirmBtn.textContent = t("teamBuilder.clearAllConfirmYes");
  confirmBtn.addEventListener("click", () => {
    modal.close();
    options.onConfirm();
  });
  actions.appendChild(confirmBtn);

  body.appendChild(actions);
}
