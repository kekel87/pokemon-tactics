import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { Splash } from "../../pages/Splash";

// Cahier §6.0 — splash de boot (plan 135). Au démarrage, un overlay plein écran télécharge le
// bundle de sprites (`sprites.bin` + manifeste + `portraits.png`) AVANT que le moindre écran ne
// rende un Pokemon, puis se retire. Toute voie de boot (menu/combat/preview/sandbox) passe ce gate
// une fois. On vérifie le SENS DOM (présence → retrait + écran monté), pas le fade pixel (👁).

test("splash de boot : présent au démarrage, retiré une fois le bundle chargé, puis le menu monte", async ({
  page,
}) => {
  // Ralentir UNIQUEMENT le téléchargement du bundle (`sprites.bin`) pour observer le splash de
  // façon déterministe : sans ce délai le bundle (mis en cache par le navigateur) peut se charger
  // assez vite pour que l'overlay disparaisse avant la première assertion. On relâche la requête
  // après ~600 ms — le splash s'efface alors normalement. Ce n'est pas un override de hasard, juste
  // une latence réseau simulée (chemin de fetch réel inchangé).
  let releaseBundle!: () => void;
  const bundleHeld = new Promise<void>((resolve) => {
    releaseBundle = resolve;
  });
  await page.route("**/sprites.bin", async (route) => {
    await bundleHeld;
    await route.continue();
  });

  const splash = new Splash(page);
  const menu = new MainMenu(page);

  // Navigate raw (not `menu.goto()`): this is the one test that observes the splash WHILE the
  // bundle is held, so it must not wait for the splash to dismiss before asserting on it.
  await page.goto("/");

  // Pendant le téléchargement : l'overlay est présent avec son titre + sa barre de progression.
  await expect(splash.overlay).toBeVisible();
  await expect(splash.title).toHaveText("Pokémon Tactics");
  await expect(splash.progressBar).toBeVisible();
  // Le menu N'EST PAS encore monté tant que le gate n'est pas franchi.
  await expect(menu.combat).toHaveCount(0);

  // Relâcher le bundle → le splash finit son chargement, se retire du DOM, puis le menu apparaît.
  releaseBundle();
  await expect(splash.overlay).toHaveCount(0);
  await expect(menu.combat).toBeVisible();
});
