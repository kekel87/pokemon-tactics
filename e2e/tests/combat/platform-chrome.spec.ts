import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";
import { AppShell } from "../../pages/app-shell";
import { CombatScene } from "../../pages/CombatScene";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MapSelectScreen, TeamSelectScreen } from "../../pages/screens";

// Cahier §4.17 / §6.10 — comportement plateforme côté combat (plan 180) : le bouton plein écran du
// chrome, et le garde-fou « un combat perdu ne se restaure pas ».
//
// Ce que ces tests NE prouvent PAS, et qui reste 👁 (téléphone réel) : la barre d'URL réellement
// masquée, et le verrouillage paysage — `screen.orientation.lock()` est refusé en Chromium de bureau
// et avalé par le `try/catch` best-effort de `platform/fullscreen.ts`. Ici on ne verrouille que
// l'état `document.fullscreenElement` et la réaction du chrome.

test("§4.17 chrome de combat : bouton plein écran visible hors plein écran", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);

  const fullscreenButton = page.getByTestId("fullscreen-button");
  // Visible parce que l'API existe (Chromium) ET qu'on n'est pas en plein écran — les deux
  // conditions du `hidden` du composant.
  await expect(fullscreenButton).toBeVisible();
  // Contrôle icône seule : son nom accessible vient de l'`aria-label`, pas du glyphe.
  await expect(fullscreenButton).toHaveAccessibleName("Plein écran");
  await expect(fullscreenButton).toBeInViewport({ ratio: 1 });
});

test("§4.17 chrome de combat : le bouton disparaît en plein écran et revient à la sortie", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);
  const shell = new AppShell(page);
  const fullscreenButton = page.getByTestId("fullscreen-button");
  await expect(fullscreenButton).toBeVisible();

  await fullscreenButton.click();

  await expect.poll(() => shell.isFullscreen()).toBe(true);
  // Le contrat demandé : une fois la barre d'URL partie, le bouton n'a plus rien à offrir — il
  // s'efface au lieu de rester là (`hidden`, et non pas juste transparent : le CSS neutralise
  // explicitement le `display: flex` qui battrait le `display: none` du navigateur).
  await expect(fullscreenButton).toBeHidden();

  // Sortie que le bouton n'a PAS déclenchée (Échap, geste système) : il doit revenir malgré tout,
  // ce qui n'est vrai que grâce à l'abonnement `fullscreenchange`. Sert aussi de nettoyage.
  await shell.exitFullscreen();

  await expect.poll(() => shell.isFullscreen()).toBe(false);
  await expect(fullscreenButton).toBeVisible();
});

test("§6.10 reprise d'écran : un combat perdu revient au menu principal", async ({ page }) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  const teams = new TeamSelectScreen(page);
  const scene = new CombatScene(page);
  const shell = new AppShell(page);

  // Parcours réel (pas la route sandbox) : c'est le boot de l'app qu'on verrouille ici.
  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await expect(maps.title).toBeVisible();
  await maps.confirm.click();
  await expect(teams.title).toBeVisible();
  await teams.humanToggle.click();
  await teams.launch.click();
  await scene.waitReady();

  // Restaurer un combat exigerait de sérialiser l'état du moteur (lot 180-c) : le point de reprise
  // est effacé plutôt que laissé sur un écran de menu périmé.
  expect(await shell.persistedScreenId()).toBeNull();

  await shell.reload();

  await expect(menu.title).toBeVisible();
  await expect(menu.combat).toBeVisible();
  // Et pas un demi-combat remonté sans son état.
  await expect(page.getByTestId("action-menu")).toHaveCount(0);
});
