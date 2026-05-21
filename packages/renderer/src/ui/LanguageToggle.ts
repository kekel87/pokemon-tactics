import { getLanguage, Language, onLanguageChange, setLanguage } from "../i18n";

export class LanguageToggle {
  private readonly button: HTMLButtonElement;
  private readonly unsubscribe: () => void;

  constructor(private readonly onToggle?: () => void) {
    const sandbox = document.body.dataset.sandbox === "true";
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = sandbox
      ? "sb-language-toggle"
      : "sb-language-toggle lang-toggle-floating";
    this.button.addEventListener("click", () => this.toggle());
    this.updateLabel();
    this.unsubscribe = onLanguageChange(() => this.updateLabel());

    if (sandbox) {
      const headerActions = document.querySelector(".sb-header-actions");
      if (headerActions !== null) {
        headerActions.appendChild(this.button);
        return;
      }
    }
    document.body.appendChild(this.button);
  }

  destroy(): void {
    this.unsubscribe();
    this.button.remove();
  }

  private toggle(): void {
    const next = getLanguage() === Language.French ? Language.English : Language.French;
    setLanguage(next);
    this.onToggle?.();
  }

  private updateLabel(): void {
    this.button.textContent = getLanguage().toUpperCase();
  }
}
