import type { Locator, Page } from "@playwright/test";

/**
 * Page Objects du jeu en ligne (plan 199) : l'écran `lobby` et la salle d'attente.
 *
 * La salle d'attente **est** l'écran de sélection d'équipe (décision #897) : il n'existe pas de
 * second écran de salon. `WaitingRoom` ne décrit donc que ce que le mode réseau y ajoute — le code,
 * l'encart de paramètres, les lignes distantes, « Prêt ».
 */
export class LobbyScreen {
  readonly title: Locator;
  readonly formatSegments: Locator;
  readonly create: Locator;
  readonly join: Locator;
  readonly back: Locator;
  readonly error: Locator;
  /** Les cinq emplacements de la roue de caractères, dans l'ordre du DOM. */
  readonly codeSlots: Locator;
  readonly wheel: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole("heading", { level: 1, name: "Jouer en ligne" });
    this.formatSegments = page.getByTestId("format-segment");
    this.create = page.getByRole("button", { name: "Créer une partie", exact: true });
    this.join = page.getByRole("button", { name: "Rejoindre", exact: true });
    this.back = page.getByRole("button", { name: "Retour", exact: true });
    this.error = page.getByTestId("lobby-error");
    this.wheel = page.getByTestId("code-wheel");
    this.codeSlots = page.getByTestId("code-slot");
  }

  /**
   * Le segment de format d'un nombre de joueurs donné (`2`, `3`, `4`, `6`, `12`).
   *
   * Visé par `data-format-key` — la valeur qu'écrit le code, indépendante de l'i18n et du
   * `text-transform` du libellé — et non par son texte « 4 joueurs ».
   */
  formatSegment(teamCount: number): Locator {
    return this.formatSegments.and(this.page.locator(`[data-format-key="${teamCount}"]`));
  }

  /**
   * Saisit un code **au clavier**, dans la roue — le seul widget de saisie, pour les quatre entrées.
   * Passe par de vraies frappes plutôt que par un `fill()` : il n'y a pas de champ texte à remplir,
   * et c'est précisément le comportement qu'on veut couvrir.
   */
  async typeCode(code: string): Promise<void> {
    await this.codeSlots.first().focus();
    for (const character of code) {
      await this.page.keyboard.press(character);
    }
  }

  /** Le code tel que la roue l'affiche, relu emplacement par emplacement. */
  async readCode(): Promise<string> {
    const values = await this.wheel.getByTestId("code-slot-character").allTextContents();
    return values.join("");
  }
}

export class WaitingRoom {
  readonly panel: Locator;
  readonly code: Locator;
  readonly copy: Locator;
  readonly settings: Locator;
  readonly ready: Locator;
  readonly launch: Locator;
  readonly error: Locator;
  /** Les lignes tenues par un joueur distant — le troisième état de ligne. */
  readonly remoteSeats: Locator;
  readonly readyBadges: Locator;
  /** La rangée de format, ABSENTE en ligne : le format est gravé depuis le `lobby`. */
  readonly formatSegments: Locator;

  constructor(private readonly page: Page) {
    this.panel = page.getByTestId("room-panel");
    this.code = page.getByTestId("room-code");
    this.copy = page.getByTestId("room-code-copy");
    this.settings = page.getByTestId("room-settings");
    this.ready = page.getByTestId("room-ready");
    this.launch = page.getByRole("button", { name: "Lancer ▶", exact: true });
    this.error = page.getByTestId("room-error");
    this.remoteSeats = page.getByTestId("player-remote");
    this.readyBadges = page.getByTestId("player-ready");
    this.formatSegments = page.getByTestId("format-segment");
  }

  /**
   * Le badge d'état d'une ligne (0-indexé) : « ⏳ Place libre », « Prêt » ou « En attente ».
   *
   * `data-state` (`open` / `ready` / `not-ready`) porte le contrat, le texte porte l'i18n. Absent sur
   * sa propre ligne : on est là par définition.
   */
  seatStatus(slotIndex: number): Locator {
    return this.readyBadges.and(this.page.locator(`[data-slot-index="${slotIndex}"]`));
  }
}
