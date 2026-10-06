import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { INSPECT_INFO, TILE_INFO_POPULATED } from "../../fixtures/sandbox-configs";
import { InfoPanel, InfoTooltip, TileInfoPanel, WeatherHud } from "../../pages/combatHud";
import { connectPad, PadButton, tapPadButton, withFakeGamepad } from "../../pages/gamepad";

// Cahier §4.23 — infobulles des talents, objets, effets, météo et zones de case, et le mode
// Inspecter qui les lit au clavier et à la manette (plan 225, retour de Frank 2026-09-30).
//
// On juge le SENS : quelle étape la bulle explique (son titre = le libellé de l'élément visé) et
// qu'elle porte un vrai texte français — jamais la clé i18n brute, que la concaténation non typée
// `describe.` + libellé laisserait passer. Le placement de la bulle au bord de l'écran reste 👁.

/** Ordre du parcours sur `INSPECT_INFO` : talent → objet → pastille → (case sans zone) → météo. */
const RESTES = "Restes";
const POISON = "Poison";
const PLEIN_SOLEIL = "Plein soleil";

/**
 * Centre de `target`, pour y poser la VRAIE souris ou le doigt. Pas `locator.hover()` / `tap()` : le
 * panneau reconstruit ses pastilles à chaque mise à jour, et le contrôle d'actionnabilité de
 * Playwright, qui revérifie l'élément sous le pointeur après le geste, retombe sur un nœud remplacé
 * et réessaie sans fin.
 */
async function centreOf(target: Locator): Promise<{ x: number; y: number }> {
  const box = await target.boundingBox();
  if (box === null) {
    throw new Error("cible sans boîte : elle n'est pas rendue");
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function pointAt(page: Page, target: Locator): Promise<void> {
  const { x, y } = await centreOf(target);
  await page.mouse.move(x, y);
}

/** Le voile de chargement intercepte la souris pendant son fondu : un survol avant sa sortie du DOM
 *  tombe sur lui, pas sur le panneau. */
async function waitLoadingOverlayGone(page: Page): Promise<void> {
  await expect(page.getByTestId("loading-overlay")).toHaveCount(0);
}

test("§4.23 Inspecter au clavier : I entre, les flèches parcourent en boucle, Échap sort", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox(INSPECT_INFO);
  const panel = new InfoPanel(page);
  const tooltip = new InfoTooltip(page);
  await expect(panel.talent).toBeVisible();
  const talent = ((await panel.talent.textContent()) ?? "").trim();
  await expect(tooltip.bubble).toBeHidden();

  await page.keyboard.press("KeyI");
  await expect(tooltip.bubble).toBeVisible();
  await expect(tooltip.title).toHaveText(talent);
  await expect(tooltip.text).not.toBeEmpty();
  await expect(tooltip.text).not.toContainText("describe.");

  await page.keyboard.press("ArrowDown");
  await expect(tooltip.title).toHaveText(RESTES);
  await expect(tooltip.text).toContainText("restaurer graduellement les PV");

  await page.keyboard.press("ArrowRight");
  await expect(tooltip.title).toHaveText(POISON);
  await expect(tooltip.text).toContainText("1/8 de ses PV max");

  // ↑ / ← reculent, et le premier arrêt reboucle sur le dernier : la météo du HUD.
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowLeft");
  await expect(tooltip.title).toHaveText(talent);
  await page.keyboard.press("ArrowUp");
  await expect(tooltip.title).toHaveText(PLEIN_SOLEIL);
  await expect(tooltip.text).toContainText("Attaques Feu +50 %");

  // Échap sort du mode — et ne va PAS ouvrir le menu de combat, qu'il ouvre d'ordinaire.
  await page.keyboard.press("Escape");
  await expect(tooltip.bubble).toBeHidden();
  await expect(combatMenu.dialog).toBeHidden();

  // I bascule : une seconde pression ressort aussi.
  await page.keyboard.press("KeyI");
  await expect(tooltip.title).toHaveText(talent);
  await page.keyboard.press("KeyI");
  await expect(tooltip.bubble).toBeHidden();
});

test("§4.23 Inspecter à la manette : L3 entre, la croix avance, B sort", async ({
  page,
  bootSandbox,
}) => {
  await withFakeGamepad(page);
  await bootSandbox(INSPECT_INFO);
  await connectPad(page);
  const panel = new InfoPanel(page);
  const tooltip = new InfoTooltip(page);
  await expect(panel.talent).toBeVisible();
  const talent = ((await panel.talent.textContent()) ?? "").trim();

  await tapPadButton(page, PadButton.LeftStick);
  await expect(tooltip.title).toHaveText(talent);

  await tapPadButton(page, PadButton.DpadDown);
  await expect(tooltip.title).toHaveText(RESTES);
  await tapPadButton(page, PadButton.DpadDown);
  await expect(tooltip.title).toHaveText(POISON);

  await tapPadButton(page, PadButton.B);
  await expect(tooltip.bubble).toBeHidden();
});

test("§4.23 survol souris : une pastille, puis la météo, ouvrent leur bulle ; sortir la ferme", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(INSPECT_INFO);
  const panel = new InfoPanel(page);
  const weather = new WeatherHud(page);
  const tooltip = new InfoTooltip(page);
  await waitLoadingOverlayGone(page);

  await pointAt(page, panel.badges.filter({ hasText: POISON }));
  await expect(tooltip.title).toHaveText(POISON);
  await expect(tooltip.text).toContainText("1/8 de ses PV max");

  await pointAt(page, weather.hud);
  await expect(tooltip.title).toHaveText(PLEIN_SOLEIL);

  await page.mouse.move(640, 360);
  await expect(tooltip.bubble).toBeHidden();
});

test("§4.23 zones de case : survoler une ligne de zone l'explique, Inspecter y passe aussi", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(TILE_INFO_POPULATED);
  const tile = new TileInfoPanel(page);
  const tooltip = new InfoTooltip(page);
  await waitLoadingOverlayGone(page);

  await pointAt(page, tile.line("Gravité").getByText("Gravité"));
  await expect(tooltip.title).toHaveText("Gravité");
  await expect(tooltip.text).toContainText("cloués au sol");

  // Sans météo, la dernière étape du parcours est la dernière ligne de zone de la case.
  await page.mouse.move(640, 360);
  await expect(tooltip.bubble).toBeHidden();
  await page.keyboard.press("KeyI");
  await expect(tooltip.bubble).toBeVisible();
  await page.keyboard.press("ArrowUp");
  await expect(tooltip.title).toHaveText("Distorsion");
});

test.describe("au doigt", () => {
  test.use({ hasTouch: true });

  test("§4.23 un appui ouvre la bulle, un appui ailleurs la referme", async ({
    page,
    bootSandbox,
  }) => {
    await bootSandbox(INSPECT_INFO);
    const panel = new InfoPanel(page);
    const tooltip = new InfoTooltip(page);
    await waitLoadingOverlayGone(page);

    const badge = await centreOf(panel.badges.filter({ hasText: POISON }));
    await page.touchscreen.tap(badge.x, badge.y);
    await expect(tooltip.title).toHaveText(POISON);

    await page.touchscreen.tap(640, 360);
    await expect(tooltip.bubble).toBeHidden();
  });
});

test.describe("au doigt, téléphone paysage", () => {
  // Pointeur grossier : la boîte du talent est agrandie jusqu'au plancher de cible tactile
  // (`--it-overhang`, plan 225). L'anneau d'Inspecter entourait cette boîte agrandie et débordait sur
  // la barre de PV (retour humain 2026-10-06) ; il est désormais dessiné par un `::before` qui épouse
  // le texte (plan 230). On le MESURE : le pseudo-élément n'est pas un nœud, donc pas de locator.
  test.use({ hasTouch: true, viewport: { width: 851, height: 393 } });

  /** Écart toléré entre l'anneau et le texte : 2 px de trait + 1 px de décalage, plus l'écart entre
   *  la hauteur de ligne (que l'anneau suit) et la boîte des glyphes (que la Range mesure). */
  const RING_SLACK_PX = 6;

  test("§4.23 l'anneau d'Inspecter sur le talent encadre le texte, pas la barre de PV", async ({
    page,
    bootSandbox,
  }) => {
    await bootSandbox(INSPECT_INFO);
    const panel = new InfoPanel(page);
    const tooltip = new InfoTooltip(page);
    await expect(panel.talent).toBeVisible();
    const talent = ((await panel.talent.textContent()) ?? "").trim();

    await page.keyboard.press("KeyI");
    await expect(tooltip.title).toHaveText(talent);

    const hpBar = await panel.hpBar.boundingBox();
    if (hpBar === null) {
      throw new Error("barre de PV sans boîte");
    }
    const { ring, text } = await panel.talent.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const ringStyle = getComputedStyle(element, "::before");
      const px = (value: string): number => Number.parseFloat(value) || 0;
      // Le `::before` est en absolu dans la boîte de REMPLISSAGE du talent (qui est `relative`) ;
      // ses `inset` se lisent résolus en px. Le trait est un `outline`, donc HORS de sa boîte.
      const paddingLeft = box.left + element.clientLeft;
      const paddingTop = box.top + element.clientTop;
      const outset = px(ringStyle.outlineWidth) + px(ringStyle.outlineOffset);
      const range = document.createRange();
      range.selectNodeContents(element);
      const glyphs = range.getBoundingClientRect();
      return {
        ring: {
          content: ringStyle.content,
          left: paddingLeft + px(ringStyle.left) - outset,
          top: paddingTop + px(ringStyle.top) - outset,
          right: paddingLeft + element.clientWidth - px(ringStyle.right) + outset,
          bottom: paddingTop + element.clientHeight - px(ringStyle.bottom) + outset,
        },
        text: { left: glyphs.left, top: glyphs.top, right: glyphs.right, bottom: glyphs.bottom },
      };
    });

    // L'anneau existe bien sur le pseudo-élément (sinon les mesures ne disent rien).
    expect(ring.content).not.toBe("none");

    // Il encadre le texte, à quelques px près de chaque côté — ni tassé dessus, ni gonflé jusqu'à la
    // cible tactile.
    for (const [outer, inner] of [
      [text.left, ring.left],
      [ring.right, text.right],
      [text.top, ring.top],
      [ring.bottom, text.bottom],
    ] as const) {
      expect(outer - inner).toBeGreaterThanOrEqual(-1);
      expect(outer - inner).toBeLessThanOrEqual(RING_SLACK_PX);
    }

    // Et il ne mord pas sur la barre de PV, juste au-dessus de la ligne du talent.
    const overlapsHpBar =
      ring.left < hpBar.x + hpBar.width &&
      ring.right > hpBar.x &&
      ring.top < hpBar.y + hpBar.height &&
      ring.bottom > hpBar.y;
    expect(overlapsHpBar).toBe(false);
  });
});
