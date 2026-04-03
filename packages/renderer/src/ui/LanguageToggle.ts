import { getLanguage, Language, onLanguageChange, setLanguage } from "../i18n";

export class LanguageToggle {
  private readonly button: HTMLButtonElement;
  private readonly unsubscribe: () => void;

  constructor(private readonly onToggle?: () => void) {
    this.button = document.createElement("button");
    this.button.style.cssText = `
      position: fixed; top: 10px; left: 10px;
      padding: 4px 10px; font-size: 12px; font-family: monospace; font-weight: bold;
      background: rgba(10, 10, 30, 0.85); color: #ddd;
      border: 1px solid #557; border-radius: 4px;
      cursor: pointer; z-index: 1001; user-select: none;
    `;
    this.button.addEventListener("click", () => this.toggle());
    this.updateLabel();
    this.unsubscribe = onLanguageChange(() => this.updateLabel());
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
