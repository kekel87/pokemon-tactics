import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import {
  MAP_SELECT_ROOT,
  MAP_SELECT_SCROLLERS,
  Responsive,
  TEAM_SELECT_ROOT,
  TEAM_SELECT_SCROLLERS,
} from "../../pages/responsive";
import { BattleModeScreen, MapSelectScreen, TeamSelectScreen } from "../../pages/screens";

// Cahier §6.9 — écrans DOM sur petit écran (plan 179) : invite d'orientation, choix de la carte,
// sélection d'équipe. Le rendu (densité, esthétique) reste 👁 ; ici on teste ce qui est
// *atteignable* : un bouton hors écran ou un écran resté à sa taille de bureau sont mesurables.

/** Téléphone en paysage (l'orientation que le jeu impose). */
const PHONE_LANDSCAPE = { width: 851, height: 393 };
/** Fenêtre de bureau au-dessus des deux bornes du seuil mobile (hauteur ≥ 500, largeur ≥ 900). */
const DESKTOP_WINDOW = { width: 1400, height: 900 };

// L'invite « tourne ton écran » n'obstrue que ce qui est réellement injouable : portrait **et**
// pointeur grossier **et** largeur < 600px. Chaque autre combinaison doit laisser jouer.
const ORIENTATION_CASES = [
  {
    label: "téléphone portrait → invite affichée",
    viewport: { width: 393, height: 851 },
    hasTouch: true,
    visible: true,
  },
  {
    label: "téléphone paysage → invite masquée",
    viewport: PHONE_LANDSCAPE,
    hasTouch: true,
    visible: false,
  },
  {
    // Une tablette debout a la place de jouer (--ui-scale ≈ 0,64) : pas d'obstruction.
    label: "tablette portrait → invite masquée",
    viewport: { width: 820, height: 1180 },
    hasTouch: true,
    visible: false,
  },
  {
    // Fenêtre desktop étroite et haute : portrait et < 600px, mais pointeur fin → pas une main.
    label: "fenêtre desktop étroite (souris) → invite masquée",
    viewport: { width: 500, height: 900 },
    hasTouch: false,
    visible: false,
  },
];

for (const orientationCase of ORIENTATION_CASES) {
  test.describe(`§6.9 ${orientationCase.label}`, () => {
    test.use({ viewport: orientationCase.viewport, hasTouch: orientationCase.hasTouch });

    test("§6.9 invite d'orientation", async ({ page }) => {
      const menu = new MainMenu(page);
      const responsive = new Responsive(page);
      await menu.goto();

      if (orientationCase.visible) {
        await expect(responsive.orientationPrompt).toBeVisible();
        await expect(responsive.orientationPrompt).toContainText("Tourne ton écran");
        await expect(responsive.orientationPrompt).toContainText(
          "Pokemon Tactics se joue en paysage.",
        );
      } else {
        await expect(responsive.orientationPrompt).toBeHidden();
      }
    });
  });
}

test.describe("§6.9 fondations viewport", () => {
  test.use({ viewport: PHONE_LANDSCAPE });

  // Garde-fou de configuration, assumé comme tel : ces deux drapeaux n'ont AUCUN effet observable
  // dans le harness (Chromium de bureau n'a ni encoche ni clavier virtuel), or ils sont le
  // prérequis strict de tout le reste — sans `viewport-fit=cover` chaque `env(safe-area-inset-*)`
  // résout à 0px, et sans `interactive-widget=resizes-content` une modale en `dvh` garde sa
  // hauteur pleine quand le clavier s'ouvre et emporte son bouton de fermeture hors écran. Leur
  // *effet* reste 👁 (téléphone réel) ; leur présence, elle, se régresse en silence.
  test("§6.9 le meta viewport porte viewport-fit=cover et interactive-widget=resizes-content", async ({
    page,
  }) => {
    const menu = new MainMenu(page);
    await menu.goto();

    const content = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content", { timeout: 5_000 });
    expect(content).toContain("viewport-fit=cover");
    expect(content).toContain("interactive-widget=resizes-content");
  });
});

/** menu → mode de combat → choix de la carte. */
const openMapSelect = async (page: Page): Promise<MapSelectScreen> => {
  const menu = new MainMenu(page);
  const battleMode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  await menu.goto();
  await menu.combat.click();
  await battleMode.local.click();
  await expect(maps.title).toBeVisible();
  return maps;
};

test.describe("§6.9 choix de la carte sur téléphone paysage", () => {
  test.use({ viewport: PHONE_LANDSCAPE });

  // Le bug du plan : les deux boutons (« Retour » à gauche, « Choisir cette carte » à droite)
  // tombaient sous le bord bas de l'écran — l'écran devenait un cul-de-sac.
  test("§6.9 les 9 cartes, les deux boutons et le reste de l'écran tiennent dedans", async ({
    page,
  }) => {
    const maps = await openMapSelect(page);
    const responsive = new Responsive(page);

    await expect(maps.listItems).toHaveCount(9);
    await expect(maps.back).toBeInViewport({ ratio: 1 });
    await expect(maps.confirm).toBeInViewport({ ratio: 1 });

    await expect
      .poll(() => responsive.elementsOutsideViewport(MAP_SELECT_ROOT, MAP_SELECT_SCROLLERS))
      .toEqual([]);
  });
});

test.describe("§6.3 voile de chargement de l'aperçu de carte", () => {
  test.use({ viewport: DESKTOP_WINDOW });

  // Construire la scène d'aperçu prend assez de temps pour que le cadre reste vide, ce qui « donne
  // l'impression que c'est cassé ». L'état est enregistré par MutationObserver AVANT le clic : la
  // phase `loading` est courte, l'échantillonner après coup serait un tirage au sort.
  test("§6.3 changer de carte repasse par « loading » puis retombe sur « idle »", async ({
    page,
  }) => {
    const maps = await openMapSelect(page);
    const responsive = new Responsive(page);
    // L'aperçu de la carte 0 se construit au montage → on attend qu'il soit retombé au repos avant
    // de mesurer le suivant, sinon on enregistre la fin du premier chargement.
    await expect.poll(() => responsive.metrics(".ms-preview-loading")).not.toBeNull();
    await expect
      .poll(() => page.locator(".ms-preview-loading").getAttribute("data-state"))
      .toBe("idle");

    await responsive.watchDataState(".ms-preview-loading");
    await maps.listItems.nth(1).click();

    await expect.poll(() => responsive.recordedDataStates()).toEqual(["idle", "loading", "idle"]);
  });
});

/**
 * Ouvre le sélecteur d'équipe du camp 1, mesure un portrait, le referme.
 *
 * Les portraits ont quitté l'écran pour la modale au plan 188 (#832) ; on ouvre et referme à chaque
 * viewport plutôt que de laisser la modale ouverte pendant le redimensionnement, pour mesurer un
 * `<dialog>` déjà stabilisé à la nouvelle taille.
 */
const measurePickerPortrait = async (
  page: Page,
  responsive: Responsive,
  teamSelect: TeamSelectScreen,
): Promise<{ height: number } | null> => {
  await teamSelect.teamButton(0).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Scopé au `<dialog>` : la carte de camp derrière porte AUSSI des portraits (plus petits, et
  // de taille fixe), donc un sélecteur global mesurerait la mauvaise vignette.
  const metrics = await responsive.metrics("dialog[open] .ts-portrait");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  return metrics;
};

test.describe("§6.9 sélection d'équipe sur téléphone paysage", () => {
  test.use({ viewport: PHONE_LANDSCAPE });

  // Cet écran vivait entièrement sur les tokens `:root` fixes — « on dirait qu'il ne scale pas comme
  // le reste ». Le seuil mobile lui rebase ses tokens : titre 28 → 18px, portraits rétrécis. Mesuré
  // dans un seul test par redimensionnement, donc en comparaison directe plutôt qu'en valeurs
  // absolues pour les portraits (bordure incluse dans la boîte mesurée).
  test("§6.9 les tokens de l'écran suivent le seuil mobile, rien ne sort du viewport", async ({
    page,
  }) => {
    const maps = await openMapSelect(page);
    const teamSelect = new TeamSelectScreen(page);
    const responsive = new Responsive(page);
    await maps.confirm.click();
    await expect(teamSelect.title).toBeVisible();

    await expect
      .poll(() => responsive.elementsOutsideViewport(TEAM_SELECT_ROOT, TEAM_SELECT_SCROLLERS))
      .toEqual([]);

    expect(await responsive.fontSizePx(teamSelect.title)).toBe(18);

    // Les portraits vivent dans le sélecteur d'équipe depuis le plan 188 (#832) — il faut l'ouvrir
    // pour les mesurer. Ils sont portés par la ligne « 🎲 Aléatoire », donc présents même sans
    // équipe sauvegardée. Le token `--ts-portrait-size` est déclaré sur `.ts-portraits` (le conteneur)
    // et non sur un écran : les portraits vivent dans DEUX arbres depuis le plan 188 — la carte de
    // camp, et la liste du sélecteur, qui est un `<dialog>` monté sur `<body>`.
    const phonePortrait = await measurePickerPortrait(page, responsive, teamSelect);

    await page.setViewportSize(DESKTOP_WINDOW);
    await expect.poll(() => responsive.fontSizePx(teamSelect.title)).toBe(28);
    const desktopPortrait = await measurePickerPortrait(page, responsive, teamSelect);
    expect(phonePortrait?.height).toBeLessThan(desktopPortrait?.height ?? 0);
  });
});
