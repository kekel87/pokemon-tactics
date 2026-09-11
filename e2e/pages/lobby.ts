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
  readonly create: Locator;
  readonly join: Locator;
  readonly paste: Locator;
  readonly back: Locator;
  readonly error: Locator;
  /** Les cinq emplacements de la roue de caractères, dans l'ordre du DOM. */
  readonly codeSlots: Locator;
  readonly wheel: Locator;
  /**
   * La modale de refus (plan 207) : le refus de rejoindre se prononce ICI, par-dessus le lobby, et
   * plus en pied de page de la salle d'attente une fois le joueur déjà parti.
   */
  readonly refusal: Locator;
  readonly refusalTitle: Locator;
  readonly refusalMessage: Locator;
  readonly refusalDismiss: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole("heading", { level: 1, name: "Jouer en ligne" });
    this.create = page.getByRole("button", { name: "Créer une partie", exact: true });
    this.join = page.getByTestId("lobby-join");
    this.paste = page.getByTestId("lobby-paste");
    // Par testid : cet écran est passé au patron « écran plein » au plan 207, donc son retour est
    // celui de l'en-tête PARTAGÉ (« ◀ Retour », en haut) et non plus le dernier bouton d'une pile
    // de menu. Le viser par son nom accessible le couplerait au glyphe du libellé.
    this.back = page.getByTestId("screen-back");
    this.error = page.getByTestId("lobby-error");
    this.wheel = page.getByTestId("code-wheel");
    this.codeSlots = page.getByTestId("code-slot");
    this.refusal = page.getByTestId("join-refusal");
    this.refusalTitle = page.getByRole("heading", { name: "Impossible de rejoindre" });
    this.refusalMessage = page.getByTestId("join-refusal-message");
    this.refusalDismiss = page.getByTestId("join-refusal-dismiss");
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

  /**
   * Le cadre d'un emplacement, en pixels CSS — de quoi viser un TIERS du bouton (les trois zones de
   * tape) ou lui faire parcourir une distance connue (le glissement du plan 207, étape 4).
   *
   * Lève plutôt que de rendre `null` : un emplacement sans cadre est un emplacement non affiché, et
   * le test qui l'interroge n'a rien à mesurer — autant le dire ici qu'au déréférencement.
   */
  async slotBox(index: number): Promise<{ x: number; y: number; width: number; height: number }> {
    const box = await this.codeSlots.nth(index).boundingBox();
    if (box === null) {
      throw new Error(`l'emplacement ${index} de la roue n'est pas affiché`);
    }
    return box;
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
  /**
   * La ligne qui ANNONCE le format. Sortie de la liste de paramètres au plan 207 : depuis que
   * l'écran « Jouer en ligne » ne l'annonce plus, c'est le seul endroit où le joueur l'apprend avant
   * de composer son équipe.
   */
  readonly format: Locator;
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
    this.format = page.getByTestId("room-format");
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
