import { t } from "../../i18n";

export interface ModalOptions {
  title: string;
  size?: "default" | "picker";
  onClose?: () => void;
  closeOnBackdrop?: boolean;
}

export class Modal {
  private readonly dialog: HTMLDialogElement;
  private readonly body: HTMLDivElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly previousFocus: HTMLElement | null;

  constructor(options: ModalOptions) {
    this.previousFocus = document.activeElement as HTMLElement | null;

    this.dialog = document.createElement("dialog");
    this.dialog.className = "tb-dialog";
    if (options.size !== undefined && options.size !== "default") {
      this.dialog.dataset.size = options.size;
    }

    const header = document.createElement("div");
    header.className = "tb-modal-header";
    this.titleEl = document.createElement("h2");
    this.titleEl.className = "tb-modal-title";
    this.titleEl.textContent = options.title;
    header.appendChild(this.titleEl);
    const closeBtn = document.createElement("button");
    closeBtn.className = "tb-modal-close";
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", t("teamBuilder.aria.close"));
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);
    this.dialog.appendChild(header);

    this.body = document.createElement("div");
    this.body.className = "tb-modal-body";
    this.dialog.appendChild(this.body);

    if (options.closeOnBackdrop !== false) {
      this.dialog.addEventListener("click", (event) => {
        if (event.target === this.dialog) {
          this.close();
        }
      });
    }

    this.dialog.addEventListener(
      "close",
      () => {
        this.dialog.remove();
        this.previousFocus?.focus();
        options.onClose?.();
      },
      { once: true },
    );

    document.body.appendChild(this.dialog);
    this.dialog.showModal();
  }

  setTitle(title: string): void {
    this.titleEl.textContent = title;
  }

  getBody(): HTMLDivElement {
    return this.body;
  }

  close(): void {
    if (this.dialog.open) {
      this.dialog.close();
    }
  }
}
