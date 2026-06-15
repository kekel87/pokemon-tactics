import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, CreditsScreen, SettingsScreen } from "../../pages/screens";

// Golden layer (test-plan §1) — the white-box backstop to the scene-graph asserts. Reserved for
// what the scene-graph can't judge: CSS layout, colours, overall composition. The DOM screens are
// fully deterministic (no canvas) → tight default tolerance. The combat shot includes the WebGL
// canvas whose sprites cycle an idle animation, so it gets a looser ratio: it guards against gross
// regressions (black scene, missing terrain, broken HUD layout), not pixel-exact sprite frames.

test("golden : menu principal", async ({ page }) => {
  const menu = new MainMenu(page);
  await menu.goto();
  await expect(menu.combat).toBeVisible();
  await expect(page).toHaveScreenshot("main-menu.png");
});

test("golden : écran mode de combat", async ({ page }) => {
  const menu = new MainMenu(page);
  const battleMode = new BattleModeScreen(page);
  await menu.goto();
  await menu.combat.click();
  await expect(battleMode.local).toBeVisible();
  await expect(page).toHaveScreenshot("battle-mode.png");
});

test("golden : écran paramètres", async ({ page }) => {
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  await menu.goto();
  await menu.settings.click();
  await expect(settings.title).toBeVisible();
  await expect(page).toHaveScreenshot("settings.png");
});

test("golden : écran crédits", async ({ page }) => {
  const menu = new MainMenu(page);
  const credits = new CreditsScreen(page);
  await menu.goto();
  await page.getByRole("button", { name: "Crédits" }).click();
  await expect(credits.title).toBeVisible();
  await expect(page).toHaveScreenshot("credits.png");
});

test("golden : scène de combat (rendu global, sprites tolérés)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(DUEL);
  // Attendre le tour du joueur → HUD dans un état connu (menu d'action affiché).
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeVisible();
  // ANTI-FLAKE : sous forte charge parallèle, les 2 sprites peuvent ne pas être encore montés au
  // moment du shot (atlas en cours de chargement → gros diff). On attend leur présence d'abord ;
  // ne reste alors que la variance de frame idle (sprites minuscules), absorbée par la tolérance.
  await expect.poll(() => scene.countByName("pokemon_plane")).toBe(2);
  // Tolérance large : les sprites jouent une animation idle (frames cyclées, WebGL non figeable) →
  // sous charge la frame capturée varie. C'est un garde-fou GROSSIER (scène noire, terrain/HUD
  // manquant) — la structure fine est couverte par le scene-graph. On ne fige donc pas le pixel.
  await expect(page).toHaveScreenshot("combat-scene.png", { maxDiffPixelRatio: 0.15 });
});
