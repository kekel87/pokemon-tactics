import type { Locator, Page } from "@playwright/test";

// Lightweight Page Objects for the DOM screens. One screen is mounted at a time
// (ScreenManager dispose-then-mount), so labels like "Retour" are unambiguous.

export class BattleModeScreen {
  readonly title: Locator;
  readonly local: Locator;
  /** Ouvre l'écran `lobby` depuis le plan 199. */
  readonly online: Locator;
  /** Le seul mode encore à faire — toujours désactivé. */
  readonly tutorial: Locator;
  readonly back: Locator;
  constructor(page: Page) {
    this.title = page.getByText("Mode de combat", { exact: true });
    this.local = page.getByRole("button", { name: "Local", exact: true });
    this.online = page.getByRole("button", { name: "En ligne", exact: true });
    this.tutorial = page.getByRole("button", { name: "Tutoriel", exact: true });
    this.back = page.getByRole("button", { name: "Retour" });
  }
}

/**
 * Le choix du terrain — une MODALE depuis le plan 208, plus un écran.
 *
 * 🔴 Elle ne s'ouvre plus sur le chemin d'une partie : « Jeu en solo » entre droit dans la sélection
 * d'équipe avec la carte retenue d'office. Il faut donc l'ouvrir soi-même, par {@link open}, depuis
 * le bandeau de partie. Un test qui aurait gardé l'ancien enchaînement se serait arrêté sur un écran
 * qui n'existe plus.
 */
export class MapSelectScreen {
  readonly title: Locator;
  readonly confirm: Locator;
  /** Le bouton du bandeau de partie qui OUVRE la modale. */
  readonly changeButton: Locator;
  readonly closeButton: Locator;
  /** Les 10 lignes sélectionnables : les 9 cartes, plus « Aléatoire ». */
  readonly listItems: Locator;
  /** Panneau de détail de la carte survolée, à droite. */
  readonly detailName: Locator;
  readonly detailMeta: Locator;
  readonly detailDescription: Locator;
  /** Le panneau du tirage, affiché à la place de l'aperçu Babylon sur « Aléatoire ». */
  readonly randomPanel: Locator;
  constructor(private readonly page: Page) {
    this.title = page.getByText("Choix de la carte");
    this.confirm = page.getByTestId("map-confirm");
    this.changeButton = page.getByTestId("room-change-map");
    this.closeButton = page.getByRole("button", { name: "Fermer" });
    this.listItems = page.getByTestId("map-list-item");
    this.detailName = page.getByTestId("map-detail-name");
    this.detailMeta = page.getByTestId("map-detail-meta");
    this.detailDescription = page.getByTestId("map-detail-description");
    this.randomPanel = page.getByTestId("map-random-panel");
  }

  /** Ouvre la modale depuis le bandeau de partie, et attend qu'elle soit là. */
  async open(): Promise<void> {
    await this.changeButton.click();
    await this.title.waitFor();
  }

  /** Retient une carte par son identifiant de registre (`volcano`), ou `random`. */
  async choose(mapId: string): Promise<void> {
    await this.item(mapId).click();
    await this.confirm.click();
  }

  /** La ligne d'une carte, visée par son identifiant plutôt que par son nom traduit. */
  item(mapId: string): Locator {
    return this.page.locator(`[data-testid="map-list-item"][data-map-id="${mapId}"]`);
  }
}

/**
 * Écran de sélection d'équipe, refondu au plan 188 : un camp par carte en une colonne, le format en
 * rangée de segments (#830), Humain / IA en segment à deux états (#831), et l'équipe choisie dans une
 * modale ouverte par la carte (#832).
 *
 * ⚠️ Le segment a changé la SÉMANTIQUE du geste, pas seulement le DOM. Avant, un bouton unique
 * basculait : cliquer « Humain » **donnait le camp à l'IA**. Maintenant chaque bouton désigne un
 * état, donc « Humain » sur un camp déjà humain ne fait rien — d'où {@link giveSlotToAi}, qui vise
 * « IA ». Un test qui aurait gardé l'ancien clic serait passé au vert en ne testant plus rien.
 */
export class TeamSelectScreen {
  readonly title: Locator;
  /** Rangée de segments de format (« 2J × 6 », « 3J × 4 »…). */
  readonly formatSegments: Locator;
  /**
   * Les segments un par un, dans l'ordre du DOM. Visés par leur RÔLE dans la rangée, et non par
   * `data-testid="format-segment"` : ce testid est justement ce que le correctif ajoute (il est la
   * clé de restauration du focus), donc s'en servir ici rendrait aveugle le test qui le vérifie.
   */
  readonly formatSegmentButtons: Locator;
  /**
   * Le segment du format RETENU — `data-state="active"` n'est posé que sur lui. C'est la lecture du
   * format courant qui ne dépend ni de l'i18n ni du `text-transform` du libellé.
   */
  readonly activeFormatSegment: Locator;
  /**
   * Le nom de la carte, lu dans le bandeau de partie (plan 208) — « Aléatoire » quand le tirage
   * n'est pas encore joué. Le titre de l'écran ne le porte plus : il le redoublait, et sur un
   * tirage il aurait éventé la carte.
   */
  readonly mapName: Locator;
  /**
   * « ← Retour » de l'en-tête — le patron « écran plein » partagé (plan 207), visé par son testid et
   * non par son libellé : le glyphe a changé une fois déjà.
   */
  readonly back: Locator;
  /**
   * Case « Placement auto », **cochée par défaut**. La décocher est le seul moyen d'atteindre la
   * phase de placement interactive : cochée, tout est posé d'un coup avant que la phase ne s'affiche
   * (`placement-flow.ts`), donc rien de ce qui vit pendant le placement — son menu de combat compris
   * (plan 189) — n'est atteignable.
   */
  readonly autoPlacement: Locator;
  /**
   * Case « Prévisualisation dégâts », **cochée par défaut** (plan 198). Elle vivait à l'écran des
   * réglages ; c'est désormais un paramètre de partie, gelé dans le `CombatSetup` au lancement.
   */
  readonly damagePreview: Locator;
  readonly launch: Locator;
  /**
   * « Passer en partie en ligne » — l'issue vers le jeu en ligne posée à la place du code, en solo
   * (plan 208). Absente en ligne : le bandeau y porte le code.
   */
  readonly goOnline: Locator;
  /**
   * La confirmation de cette bascule, et **elle ne s'ouvre que quand la bascule détruit quelque
   * chose** : un format à plus de deux camps, ou un second camp composé à la main. En 1v1 contre
   * l'IA elle n'apparaît pas — un test qui l'attendrait là attendrait pour rien.
   */
  readonly goOnlineConfirm: Locator;
  readonly goOnlineConfirmButton: Locator;
  /** « Rester en solo » — le geste par défaut, celui qui ne coûte rien. */
  readonly goOnlineCancel: Locator;
  constructor(private readonly page: Page) {
    this.title = page.getByText("Sélection d'équipe", { exact: false });
    this.formatSegments = page.getByTestId("format-segments");
    this.formatSegmentButtons = this.formatSegments.getByRole("button");
    this.activeFormatSegment = this.formatSegmentButtons.and(page.locator('[data-state="active"]'));
    // Par `data-testid` depuis le plan 198 : le pied d'écran porte DEUX cases, donc
    // `getByRole("checkbox")` seul y est devenu ambigu.
    this.mapName = page.getByTestId("room-map-name");
    this.back = page.getByTestId("screen-back");
    this.autoPlacement = page.getByTestId("team-select-auto-placement");
    this.damagePreview = page.getByTestId("team-select-damage-preview");
    this.launch = page.getByRole("button", { name: "Lancer ▶", exact: true });
    this.goOnline = page.getByTestId("game-go-online");
    this.goOnlineConfirm = page.getByTestId("go-online-confirm");
    this.goOnlineConfirmButton = page.getByTestId("go-online-confirm-button");
    this.goOnlineCancel = page.getByTestId("go-online-cancel");
  }

  /**
   * Le segment du premier format qui compte `teamCount` camps — visé par sa CLÉ (`3v4`), dont seule
   * la première moitié est connue d'avance : le nombre de Pokemon par équipe dépend de la carte.
   * Le libellé, lui, se traduit et passe par un `text-transform`.
   */
  formatSegmentForTeamCount(teamCount: number): Locator {
    return this.page
      .locator(`[data-testid="format-segment"][data-format-key^="${teamCount}v"]`)
      .first();
  }

  /** Bouton d'équipe d'un camp (0-indexé) — l'ouvre sur son sélecteur. */
  teamButton(slotIndex = 0): Locator {
    return this.page
      .getByTestId("player-team-button")
      .and(this.page.locator(`[data-slot-index="${slotIndex}"]`));
  }

  /**
   * Donne un camp à l'IA, ce qui lui assigne une équipe aléatoire — donc rend le combat lançable
   * sans passer par le sélecteur. Le chemin le plus court vers un combat, mais il ne laisse aucun
   * tour humain à jouer : pour un combat que le test PILOTE, voir {@link pickRandomTeam}.
   */
  async giveSlotToAi(slotIndex = 0): Promise<void> {
    await this.controllerButton(slotIndex, "ai").click();
  }

  /**
   * Un bouton du segment Humain / IA d'un camp (0-indexé).
   *
   * Visé par `data-controller`, qui porte la valeur de `PlayerController` (« human » / « ai ») : le
   * libellé, lui, commence par un glyphe et se traduit. En ligne, ce segment n'existe que chez l'hôte,
   * et seulement sur les lignes que personne ne tient.
   */
  controllerButton(slotIndex: number, controller: "human" | "ai"): Locator {
    return this.page
      .getByTestId("player-controller")
      .and(this.page.locator(`[data-slot-index="${slotIndex}"][data-controller="${controller}"]`));
  }

  /**
   * Assigne une équipe aléatoire à un camp **en gardant son contrôleur** : ouvre le sélecteur du
   * camp, prend « 🎲 Aléatoire », la modale se referme. C'est la façon de lancer un combat que le
   * test peut jouer, le camp 1 restant humain.
   */
  async pickRandomTeam(slotIndex = 0): Promise<void> {
    await this.teamButton(slotIndex).click();
    // Scopé au `<dialog>`, sans quoi le locator est ambigu : les camps IA portent « 🎲 Aléatoire »
    // comme NOM D'ÉQUIPE sur leur propre bouton, donc le même libellé existe des deux côtés.
    await this.page
      .getByRole("dialog")
      .getByRole("button", { name: "🎲 Aléatoire", exact: true })
      .click();
  }

  /**
   * Assigne une équipe SAUVEGARDÉE à un camp, par son identifiant — la ligne du sélecteur porte
   * `data-team-id`, qui est l'identifiant et non le nom affiché (contrat de test de `TeamListItem`).
   *
   * Le pendant de {@link pickRandomTeam} pour un test qui a besoin de savoir CE QUI se bat : une
   * équipe tirée au hasard donne six Pokemon inconnus, donc des attaques, des portées et des points
   * de vie inconnus. Un scénario qui pilote un combat jusqu'à son terme a besoin de l'inverse.
   * L'équipe est posée dans `localStorage` avant le boot (voir `OnlineSessionOptions.savedTeams`).
   */
  async pickSavedTeam(slotIndex: number, teamId: string): Promise<void> {
    await this.teamButton(slotIndex).click();
    await this.page
      .getByRole("dialog")
      .getByTestId("team-row")
      .and(this.page.locator(`[data-team-id="${teamId}"]`))
      .click();
  }
}

export class SettingsScreen {
  readonly title: Locator;
  readonly back: Locator;
  /** Each setting's control carries a dedicated `data-testid` (resilient to label/i18n changes). */
  readonly languageToggle: Locator;
  /** Fullscreen row (plan 180-a) — the row is ABSENT (not disabled) where the API is missing. */
  readonly fullscreenToggle: Locator;
  /** iOS-only « add to home screen » instruction (plan 180-a) — absent everywhere else. */
  readonly installHint: Locator;
  /** Ligne « Contrôles » → écran de remapping (plan 186). */
  readonly controls: Locator;
  constructor(page: Page) {
    this.title = page.getByRole("heading", { name: "Paramètres" });
    this.back = page.getByRole("button", { name: "Retour" });
    this.languageToggle = page.getByTestId("setting-language");
    this.fullscreenToggle = page.getByTestId("setting-fullscreen");
    this.installHint = page.getByTestId("setting-install-hint");
    this.controls = page.getByTestId("setting-controls");
  }
}

export class ControlsScreen {
  readonly title: Locator;
  /** Bandeau de capture — masqué tant qu'aucune case n'attend une touche. */
  readonly captureCancel: Locator;
  /** Message d'échange (« X a quitté « Action » »), vide au repos. */
  readonly message: Locator;
  readonly resetAll: Locator;
  constructor(private readonly page: Page) {
    this.title = page.getByRole("heading", { name: "Contrôles" });
    this.captureCancel = page.getByTestId("controls-capture-cancel");
    this.message = page.getByTestId("controls-message");
    this.resetAll = page.getByTestId("controls-reset-all");
  }

  /**
   * Case de la table : `action` est la valeur de `LogicalAction`, `cell` vaut 0 (principal),
   * 1 (secondaire) ou `"pad"` (colonne manette).
   */
  cell(action: string, cell: 0 | 1 | "pad"): Locator {
    return this.page.getByTestId(`control-${action}-${cell}`);
  }

  storedBindings(): Promise<string | null> {
    return this.page.evaluate(() => localStorage.getItem("pt-bindings"));
  }
}

export class CreditsScreen {
  readonly title: Locator;
  /** A line of the fan-project disclaimer (proves content rendered, not just the title). */
  readonly disclaimer: Locator;
  readonly back: Locator;
  constructor(page: Page) {
    this.title = page.getByRole("heading", { name: "Crédits" });
    this.disclaimer = page.getByText(/projet de fan/i);
    this.back = page.getByRole("button", { name: "Retour" });
  }
}
