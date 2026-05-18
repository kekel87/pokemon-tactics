import { t } from "../../i18n";
import { Modal } from "../dom/Modal";

export interface DeleteConfirmModalOptions {
  teamName: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function openDeleteConfirmModal(options: DeleteConfirmModalOptions): void {
  const modal = new Modal({
    title: t("teamBuilder.deleteConfirmTitle"),
    onClose: options.onCancel,
  });

  const body = modal.getBody();
  const message = document.createElement("div");
  message.style.marginBottom = "12px";
  message.textContent = t("teamBuilder.deleteConfirmBody").replace("{name}", options.teamName);
  body.appendChild(message);

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.justifyContent = "flex-end";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "tb-btn";
  cancelBtn.dataset.variant = "ghost";
  cancelBtn.type = "button";
  cancelBtn.textContent = t("teamBuilder.deleteConfirmNo");
  cancelBtn.addEventListener("click", () => modal.close());
  actions.appendChild(cancelBtn);

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "tb-btn";
  confirmBtn.dataset.variant = "danger";
  confirmBtn.type = "button";
  confirmBtn.textContent = t("teamBuilder.deleteConfirmYes");
  confirmBtn.addEventListener("click", () => {
    modal.close();
    options.onConfirm();
  });
  actions.appendChild(confirmBtn);

  body.appendChild(actions);
}
