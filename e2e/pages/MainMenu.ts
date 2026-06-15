import type { Locator, Page } from "@playwright/test";

/** Page Object for the main menu (FR labels, accessible-name selectors — no fragile CSS). */
export class MainMenu {
  readonly title: Locator;
  readonly adventure: Locator;
  readonly combat: Locator;
  readonly teamBuilder: Locator;
  readonly settings: Locator;
  readonly credits: Locator;
  readonly version: Locator;
  /** Bottom-right language toggle (shows the CURRENT language code "FR"/"EN"). */
  readonly languageToggle: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole("heading", { level: 1, name: "POKEMON TACTICS" });
    this.adventure = page.getByRole("button", { name: "Aventure", exact: true });
    this.combat = page.getByRole("button", { name: "Combat", exact: true });
    this.teamBuilder = page.getByRole("button", { name: "Constructeur d'équipe" });
    this.settings = page.getByRole("button", { name: "Paramètres" });
    this.credits = page.getByRole("button", { name: "Crédits" });
    this.version = page.getByTestId("app-version");
    this.languageToggle = page.getByTestId("language-toggle");
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
  }
}
