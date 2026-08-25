import type { Locator, Page } from "@playwright/test";

/**
 * Page Object de la modale du menu de combat (plan 187) et de son bouton tactile `☰`.
 *
 * Ce n'est **pas** une pause : le combat continue de tourner derrière la surcouche. Rien n'est donc à
 * « reprendre » côté moteur, et le seul état qu'un test peut juger est celui du DOM — d'où un POM
 * réduit à ses locators et à ses deux façons d'ouvrir.
 *
 * `dialog` est ciblé par `data-testid` parce que la modale n'a pas de rôle accessible propre : c'est
 * un `<dialog>` sans `aria-label`, dont le seul texte est celui de son niveau courant. Les entrées,
 * elles, sont des `<button>` — mais visées par testid plutôt que par leur libellé FR, pour que le
 * contrat de test survive à une reformulation i18n (« Abandonner » a déjà changé de sens en cours de
 * plan).
 */
export class CombatMenuOverlay {
  /** La modale elle-même. Détachée à la fermeture → `toHaveCount(0)` est l'assertion « fermé ». */
  readonly dialog: Locator;
  /** Entrée tactile de la rangée haut-droite, entre le plein écran et le journal. */
  readonly openButton: Locator;
  /** Titre du niveau racine (`combatMenu.title`). Absent des niveaux Paramètres / Contrôles, qui
   *  portent déjà le leur. */
  readonly title: Locator;
  readonly resume: Locator;
  readonly settings: Locator;
  readonly restart: Locator;
  readonly abandon: Locator;
  /**
   * « Quitter » — présent **seulement là où une sauvegarde de reprise existe**, donc jamais dans le
   * studio sandbox. `toHaveCount(0)` y est une assertion, pas un raté.
   */
  readonly quit: Locator;
  readonly confirm: Locator;
  readonly confirmCancel: Locator;
  /** Titre du panneau des Paramètres, monté tel quel dans la modale (extraction du plan 187). */
  readonly settingsTitle: Locator;
  /** Titre du panneau des Contrôles, un niveau plus profond. */
  readonly controlsTitle: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByTestId("combat-menu");
    this.openButton = page.getByTestId("combat-menu-button");
    this.title = page.getByRole("heading", { name: "Menu de combat" });
    this.resume = page.getByTestId("combat-menu-resume");
    this.settings = page.getByTestId("combat-menu-settings");
    this.restart = page.getByTestId("combat-menu-restart");
    this.abandon = page.getByTestId("combat-menu-abandon");
    this.quit = page.getByTestId("combat-menu-quit");
    this.confirm = page.getByTestId("combat-menu-confirm");
    this.confirmCancel = page.getByTestId("combat-menu-confirm-cancel");
    this.settingsTitle = page.getByRole("heading", { name: "Paramètres" });
    this.controlsTitle = page.getByRole("heading", { name: "Contrôles" });
  }

  /** Ouvrir au doigt / à la souris. La seule entrée qui n'annule jamais rien du tour en cours. */
  async openByButton(): Promise<void> {
    await this.openButton.click();
  }

  /**
   * Ouvrir par `Échap`. Ne marche **qu'au menu d'actions racine** (ou plateau au repos) : ailleurs la
   * touche remonte d'un cran dans le flux du tour, et c'est exactement ce que les tests de
   * non-régression vérifient.
   */
  async openByEscape(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }
}
