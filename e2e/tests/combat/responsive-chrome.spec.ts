import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";
import { CombatScene } from "../../pages/CombatScene";
import { MainMenu } from "../../pages/MainMenu";
import { COMBAT_CHROME_ROOT, COMBAT_CHROME_SCROLLERS, Responsive } from "../../pages/responsive";
import { BattleModeScreen, MapSelectScreen, TeamSelectScreen } from "../../pages/screens";

// Cahier §4.16 — référentiel de design mobile, cibles tactiles, journal élargi et non-débordement du
// chrome de combat (plan 179). Le chrome entier se dimensionne depuis `--ui-scale` (taille du stage ÷
// référentiel de design), donc CE nombre est le signal : il dit quel référentiel a gagné. Le rendu
// (lisibilité ressentie, esthétique du menu) reste 👁.
//
// Les tailles d'écran sont balayées par `setViewportSize` DANS un test plutôt que par un
// `test.use({ viewport })` par cas : tout est piloté par media queries et par le `ResizeObserver` du
// stage, donc un seul boot de scène suffit — et un boot de sandbox en moins est du temps rendu au
// reste du projet `combat`, qui tourne en parallèle.

/** Téléphone en paysage (orientation forcée du jeu) : la taille de référence du plan. */
const PHONE_LANDSCAPE = { width: 851, height: 393 };
/** Fenêtre de bureau au-dessus des deux bornes du seuil mobile (hauteur ≥ 500, largeur ≥ 900). */
const DESKTOP_WINDOW = { width: 1400, height: 900 };

/**
 * ⚠️ Aucune échelle attendue ne se déduit du **viewport** : ces tests bootent le studio sandbox, qui
 * insère la scène entre son en-tête et ses colonnes d'édition — le stage y est bien plus court que
 * la fenêtre. L'attendu se calcule donc depuis la boîte du stage, exactement comme `applyScale`
 * (`packages/ui-dom/src/game-stage.ts`).
 */
const MOBILE_REFERENCE = { width: 1280, height: 720 };
const DESKTOP_REFERENCE = { width: 1920, height: 1080 };

interface Box {
  readonly width: number;
  readonly height: number;
}

const scaleAgainst = (stage: Box, reference: Box): number =>
  Math.min(stage.width / reference.width, stage.height / reference.height);

/** Le référentiel mobile gagne dès que le STAGE est court **ou** étroit. */
const usesMobileReference = (stage: Box): boolean => stage.height < 500 || stage.width < 900;

const expectedScale = (stage: Box): number =>
  scaleAgainst(stage, usesMobileReference(stage) ? MOBILE_REFERENCE : DESKTOP_REFERENCE);
/** Bordure 1px de chaque côté du journal : son `inline-size` est un content-box, la boîte mesurée non. */
const LOG_PANEL_BORDER = 2;

test.describe("§4.16 référentiel de design du chrome", () => {
  test.use({ viewport: PHONE_LANDSCAPE });

  // `--ui-scale = min(largeur / réfLargeur, hauteur / réfHauteur)`, avec le référentiel **mobile**
  // 1280×720 dès que `hauteur < 500` OU `largeur < 900`, sinon le référentiel desktop 1920×1080.
  // Chaque cas dit quel référentiel DOIT gagner ; l'échelle attendue se calcule depuis le stage
  // mesuré. Les viewports sont choisis pour que le STAGE (pas la fenêtre) tombe de part et d'autre
  // des deux bornes, y compris le cas de garde desktop — le studio mangeant de la hauteur, il faut
  // une grande fenêtre pour que le stage dépasse 500px.
  const SCALE_CASES = [
    { label: "téléphone paysage → stage court → référentiel mobile", viewport: PHONE_LANDSCAPE },
    {
      label: "tablette portrait → stage étroit → référentiel mobile",
      viewport: { width: 820, height: 1180 },
    },
    {
      label: "grande fenêtre → stage haut et large → référentiel desktop",
      viewport: { width: 1600, height: 1200 },
    },
  ];

  test("§4.16 --ui-scale bascule de référentiel selon la taille du stage", async ({
    bootSandbox,
    page,
  }) => {
    await bootSandbox(DUEL);
    const responsive = new Responsive(page);

    // Le menu d'action et la bannière de tour étaient les seuls éléments du chrome sur des tokens
    // fixes (22px sur un téléphone comme sur un 4K). Ils suivent maintenant `--ui-scale` depuis une
    // maquette de 28px : c'est le rapport font-size / --ui-scale qui le prouve.
    const stage = await responsive.stageBox();
    expect(stage, "le stage doit être posé avant toute mesure d'échelle").not.toBeNull();
    const scale = await responsive.uiScale();
    expect(scale).toBeCloseTo(expectedScale(stage as Box), 4);

    const attack = page.getByRole("button", { name: "Attaque", exact: true });
    expect(await responsive.fontSizePx(attack)).toBeCloseTo(28 * scale, 1);
    expect(await responsive.fontSizePx(page.getByTestId("combat-turn"))).toBeCloseTo(28 * scale, 1);

    for (const scaleCase of SCALE_CASES) {
      await page.setViewportSize(scaleCase.viewport);
      // `--ui-scale` est republié par le `ResizeObserver` du stage → convergence, pas lecture sèche.
      // L'assertion a du mordant : on vérifie AUSSI que le référentiel perdant donnerait une autre
      // valeur, sinon un cas où les deux coïncident passerait sans rien prouver.
      await expect
        .poll(
          async () => {
            const box = await responsive.stageBox();
            if (box === null) {
              return null;
            }
            const winner = usesMobileReference(box) ? MOBILE_REFERENCE : DESKTOP_REFERENCE;
            const loser = winner === MOBILE_REFERENCE ? DESKTOP_REFERENCE : MOBILE_REFERENCE;
            const actual = await responsive.uiScale();
            return {
              matchesWinner: Math.abs(actual - scaleAgainst(box, winner)) < 0.0005,
              differsFromLoser: Math.abs(actual - scaleAgainst(box, loser)) > 0.0005,
            };
          },
          { message: scaleCase.label },
        )
        .toEqual({ matchesWinner: true, differsFromLoser: true });
    }
  });
});

test.describe("§4.16 journal de combat", () => {
  test.use({ viewport: PHONE_LANDSCAPE });

  // Sur téléphone le journal était trop étroit ET trop petit à lire : c'est le seul panneau dont le
  // contenu EST la raison d'être, donc il quitte la maquette 288/18,4px pour 400/26px sous le seuil
  // mobile. Vérifié sur les valeurs rendues (largeur du panneau, corps de la liste), pas sur les
  // tokens : c'est ce que l'œil voit. Le retour à 1920 est la contre-épreuve — sans elle, « plus
  // large sur mobile » pourrait n'être que « plus large partout ».
  test("§4.16 le journal s'élargit et grossit sous le seuil mobile, pas au-delà", async ({
    bootSandbox,
    page,
  }) => {
    await bootSandbox(DUEL);
    const responsive = new Responsive(page);
    // Échelle LUE, pas déduite du viewport : le studio comprime le stage (voir la note en tête).
    const scale = await responsive.uiScale();

    // Contre-épreuve du plancher tactile : à la souris le bouton replié garde sa taille
    // homothétique (35,2px × --ui-scale), le plancher ne portant que sur la hit-area.
    const toggle = page.getByTestId("battle-log-toggle");
    expect((await toggle.boundingBox())?.height).toBeCloseTo(35.2 * scale, 0);

    // Replié le panneau se réduit à son carré (`inline-size: auto`) → on l'ouvre pour le mesurer.
    await toggle.click();
    await expect
      .poll(() => responsive.metrics(".bl-panel"))
      .toMatchObject({ width: expect.closeTo(400 * scale + LOG_PANEL_BORDER, 0) });
    await expect
      .poll(() => responsive.metrics(".bl-list"))
      .toMatchObject({ fontSize: expect.closeTo(26 * scale, 0) });

    // Contre-épreuve : au-dessus du seuil la maquette revient à 288/18,4px. Sans elle, « plus large
    // sur mobile » pourrait n'être que « plus large partout ». Fenêtre assez grande pour que le
    // STAGE dépasse les deux bornes malgré le chrome du studio, et échelle relue après le resize.
    await page.setViewportSize({ width: 1600, height: 1200 });
    await expect
      .poll(async () => {
        const box = await responsive.stageBox();
        return box === null ? null : usesMobileReference(box);
      })
      .toBe(false);
    const desktopScale = await responsive.uiScale();
    await expect
      .poll(() => responsive.metrics(".bl-panel"))
      .toMatchObject({ width: expect.closeTo(288 * desktopScale + LOG_PANEL_BORDER, 0) });
    await expect
      .poll(() => responsive.metrics(".bl-list"))
      .toMatchObject({ fontSize: expect.closeTo(18.4 * desktopScale, 0) });
  });
});

test.describe("§4.16 chrome au doigt (pointeur grossier)", () => {
  test.use({ viewport: PHONE_LANDSCAPE, hasTouch: true });

  /** Plancher de hit-area du chrome de combat sous `pointer: coarse` (`--target-min`). */
  const TARGET_MIN = 30;

  test("§4.16 planchers tactiles ≥ 30px et aucun panneau hors viewport", async ({
    bootSandbox,
    page,
  }) => {
    await bootSandbox(DUEL);
    const responsive = new Responsive(page);

    const attack = page.getByRole("button", { name: "Attaque", exact: true });
    expect((await attack.boundingBox())?.height).toBeGreaterThanOrEqual(TARGET_MIN);

    // Journal replié : le panneau EST son bouton, donc le carré replié est la cible.
    const toggle = await page.getByTestId("battle-log-toggle").boundingBox();
    expect(toggle?.width).toBeGreaterThanOrEqual(TARGET_MIN);
    expect(toggle?.height).toBeGreaterThanOrEqual(TARGET_MIN);

    // Les lignes de la liste d'attaques étaient nettement plus courtes que le menu qu'elles
    // remplacent, alors qu'une ligne de move se tape tout autant.
    await attack.click();
    const moveRow = await page.getByTestId("move-item").first().boundingBox();
    expect(moveRow?.height).toBeGreaterThanOrEqual(TARGET_MIN);

    // Non-débordement dans le cas le plus dur : pointeur grossier (les planchers agrandissent les
    // cibles), à la taille de référence puis à la plus petite cible du plan (360px de large).
    for (const viewport of [PHONE_LANDSCAPE, { width: 640, height: 360 }]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(
          () => responsive.elementsOutsideViewport(COMBAT_CHROME_ROOT, COMBAT_CHROME_SCROLLERS),
          {
            message: `${viewport.width}×${viewport.height}`,
          },
        )
        .toEqual([]);
    }
  });
});

test.describe("§8.5 barre de placement sur téléphone paysage", () => {
  test.use({ viewport: PHONE_LANDSCAPE });

  // Passe par le VRAI parcours : la phase de placement interactive n'existe pas en sandbox (le
  // harness auto-place). Cette barre est ancrée au bord bas — là où tombent la barre de gestes et
  // l'encoche en paysage — et vivait sur les tokens `:root` fixes : elle réclamait 99px sur un
  // écran de 393, et l'humain ne l'avait jamais vue à l'écran. Comparaison directe par
  // redimensionnement plutôt que valeurs absolues (bordure incluse dans la boîte mesurée).
  test("§8.5 la barre de placement s'affiche et se compacte sous le seuil mobile", async ({
    page,
  }) => {
    const menu = new MainMenu(page);
    const battleMode = new BattleModeScreen(page);
    const maps = new MapSelectScreen(page);
    const teamSelect = new TeamSelectScreen(page);
    const scene = new CombatScene(page);
    const responsive = new Responsive(page);

    await menu.goto();
    await menu.combat.click();
    await battleMode.local.click();
    await maps.confirm.click();
    await expect(teamSelect.title).toBeVisible();
    // Joueur 1 reste HUMAIN (« 🎲 Aléatoire » lui donne une équipe sans le passer en IA) : c'est la
    // seule façon d'obtenir la phase de placement interactive — un joueur IA auto-place. Passe par
    // le POM depuis le plan 188 : la liste d'équipes est dans une modale qu'il faut ouvrir (#832).
    await teamSelect.pickRandomTeam(0);
    // Par le POM : le pied d'écran porte DEUX cases depuis le plan 198 (« Placement auto » et
    // « Prévisualisation dégâts »), donc `getByRole("checkbox")` seul y est ambigu.
    await teamSelect.autoPlacement.uncheck();
    await expect(teamSelect.launch).toBeEnabled();
    await teamSelect.launch.click();
    await scene.waitReady();

    // La barre est bien montée et lisible (le bug observé était un `.pl-roster` à 0×0).
    //
    // Budget élargi : `waitReady()` gate la SCÈNE, alors que la barre n'est montée qu'après le
    // préchargement des atlas de toute l'équipe tirée au sort — une étape asynchrone distincte, sans
    // signal propre. Les 5 s par défaut suffisent au spec isolé mais pas sous charge parallèle
    // (observé sur un run de 15 fichiers, 3 workers sous plafond CPU).
    const roster = page.getByRole("heading", { name: /Joueur 1/ });
    await expect(roster).toBeVisible({ timeout: 15_000 });
    await expect(roster).toBeInViewport({ ratio: 1 });
    const phonePortrait = await responsive.metrics(".pl-roster-portrait");

    await page.setViewportSize(DESKTOP_WINDOW);
    const desktopPortrait = await responsive.metrics(".pl-roster-portrait");
    expect(phonePortrait?.height).toBeLessThan(desktopPortrait?.height ?? 0);
  });
});
