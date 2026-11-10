import { expect, type Locator, type Page } from "@playwright/test";
import { BattleModeScreen } from "./screens";

/** Page Object for the main menu (FR labels, accessible-name selectors — no fragile CSS). */
export class MainMenu {
  readonly title: Locator;
  /**
   * « Aventure » : désactivée sans `?aventure=1`, et son nom accessible porte alors « Bientôt »
   * (« Aventure Bientôt ») ; actif avec, le nom est « Aventure » seul (plan 251).
   */
  readonly adventure: Locator;
  /** « Stade de Combat » (ex « Combat », plan 251) : ouvre l'écran qui regroupe les modes de jeu. */
  readonly combat: Locator;
  /**
   * « Reprendre le combat — <carte> » (plan 181) — present ONLY when a resumable battle is stored, so
   * `toHaveCount(0)` is the assertion for "nothing to resume". Matched on the label's PREFIX: the map
   * name is appended to it and belongs to the assertion, not to the locator.
   */
  readonly resume: Locator;
  /** The menu entries in DOM order — the resume entry must come FIRST when it exists. */
  readonly entries: Locator;
  readonly settings: Locator;
  readonly credits: Locator;
  readonly version: Locator;
  /** Bottom-right language toggle (shows the CURRENT language code "FR"/"EN"/"ES", cycles in that order). */
  readonly languageToggle: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole("heading", { level: 1, name: "POKEMON TACTICS" });
    this.adventure = page.getByRole("button", { name: /^Aventure( Bientôt)?$/ });
    this.combat = page.getByRole("button", { name: "Stade de Combat", exact: true });
    this.resume = page.getByRole("button", { name: /^Reprendre le combat/ });
    this.entries = page.getByRole("navigation").getByRole("button");
    this.settings = page.getByRole("button", { name: "Paramètres" });
    this.credits = page.getByRole("button", { name: "Crédits" });
    this.version = page.getByTestId("app-version");
    this.languageToggle = page.getByTestId("language-toggle");
  }

  /** Menu principal → Stade de Combat → « Constructeur d'équipe » (Mes équipes). */
  async openTeamBuilder(): Promise<void> {
    await this.combat.click();
    await new BattleModeScreen(this.page).teamBuilder.click();
  }

  /** Menu principal → Stade de Combat → « Revoir un combat » (la fenêtre du code de replay). */
  async openReviewBattle(): Promise<void> {
    await this.combat.click();
    await new BattleModeScreen(this.page).reviewBattle.click();
  }

  /** Clicks the language toggle until it shows `code` ("FR" / "EN" / "ES") — the toggle cycles. */
  async selectLanguage(code: string): Promise<void> {
    for (let click = 0; click < 3 && (await this.languageToggle.textContent()) !== code; click++) {
      await this.languageToggle.click();
    }
    await expect(this.languageToggle).toHaveText(code);
  }

  /**
   * @param search chaîne de requête optionnelle (`?peerPort=…`), pour les specs qui doivent
   * paramétrer le boot — la mise en relation locale du jeu en ligne (plan 199).
   */
  async goto(search = ""): Promise<void> {
    await this.page.goto(`/${search}`);
    // Boot now shows a splash that downloads the sprite bundle before the menu mounts
    // (plan 135). Wait for it to dismiss so menu locators resolve instead of racing the
    // download. Resolves immediately when the splash is already gone.
    await this.page.getByTestId("splash").waitFor({ state: "detached" });
  }
}
