import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";
import { ControlsScreen, SettingsScreen } from "../../pages/screens";

// Cahier §6.12 — la manette dans les écrans de menu (plan 186, retour humain 2026-08-25).
//
// Playwright ne pilote pas de vraie manette, mais `navigator.getGamepads()` est une simple fonction :
// on la remplace par une manette synthétique dont le test pousse les boutons. Ça ne teste pas le
// matériel — ça teste toute la chaîne qui vient après lui (poller → routeur → focus DOM), c'est-à-dire
// exactement ce qui était cassé.

/** Installe une manette synthétique, contrôlable depuis la page via `__pad__`. */
async function withFakeGamepad(page: Page, mapping: string): Promise<void> {
  await page.addInitScript((padMapping: string) => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    const fake = {
      index: 0,
      // Identifiant NEUTRE : un `057e` (Nintendo) déclencherait l'échange bas↔droite et un appui sur
      // l'index 2 s'enregistrerait en index logique 3. Cet échange a ses propres tests unitaires.
      id: "Xbox Wireless Controller (Vendor: 045e)",
      mapping: padMapping,
      buttons,
      axes: [0, 0, 0, 0],
      connected: true,
    };
    (globalThis as unknown as { __pad__: typeof fake }).__pad__ = fake;
    navigator.getGamepads = () => [fake] as unknown as ReturnType<Navigator["getGamepads"]>;
    globalThis.addEventListener("load", () =>
      globalThis.dispatchEvent(new Event("gamepadconnected")),
    );
  }, mapping);
}

async function pressPadButton(page: Page, index: number): Promise<void> {
  await page.evaluate((button: number) => {
    const pad = (globalThis as unknown as { __pad__: { buttons: { pressed: boolean }[] } }).__pad__;
    const target = pad.buttons[button];
    if (target) {
      target.pressed = true;
    }
  }, index);
}

const DPAD_DOWN = 13;

/**
 * `mapping: ""` est la réponse de **Firefox** pour une manette absente de sa table interne — Switch
 * Pro comprise (Bugzilla #952773). Le plan 184 refusait alors de router le pad, qui restait donc
 * totalement muet : aucun focus, jamais. Les deux valeurs doivent se comporter pareil.
 */
for (const mapping of ["standard", ""]) {
  test(`§6.12 la manette prend le focus dans les menus (mapping="${mapping}")`, async ({
    page,
  }) => {
    await withFakeGamepad(page, mapping);
    const menu = new MainMenu(page);
    const settings = new SettingsScreen(page);

    // Arrivée à la SOURIS : aucun focus au montage, c'est le cas qui échouait.
    await menu.goto();
    await menu.settings.click();
    await expect(settings.title).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.tagName ?? null)).toBe("BODY");

    await pressPadButton(page, DPAD_DOWN);

    await expect
      .poll(() =>
        page.evaluate(
          () => (document.activeElement as HTMLElement | null)?.dataset?.testid ?? null,
        ),
      )
      .not.toBeNull();
    expect(
      await page.evaluate(() => document.getElementById("game-root")?.dataset.inputSource),
    ).toBe("gamepad");

    // Le focus doit être VU, pas seulement posé. ⚠️ On vise NOTRE règle, pas `getComputedStyle` :
    // Chromium dessine déjà l'anneau pour un focus programmatique, donc mesurer l'outline passerait
    // même sans le correctif. C'est Firefox qui ne le dessine pas (sa modalité reste « pointeur »
    // après un clic), et là-bas seule cette règle sauve l'affichage — d'où l'assertion sur le
    // sélecteur lui-même, qui, elle, est déterministe partout.
    const ringApplies = await page.evaluate(() =>
      document.activeElement?.matches('[data-input-source="gamepad"] :focus'),
    );
    expect(ringApplies).toBe(true);
  });
}

/**
 * Échange de BOUTON, le seul chemin que la manette synthétique rend testable — et celui où le message
 * partait vide (le nom du bouton n'était pas résolu, revue 2026-08-25 : « X a quitté … » s'affichait
 * «  a quitté … »).
 */
test("§6.12 un échange à la manette nomme le bouton et l'action délogée", async ({ page }) => {
  await withFakeGamepad(page, "standard");
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  const controls = new ControlsScreen(page);
  await menu.goto();
  await menu.settings.click();
  await settings.controls.click();
  await expect(controls.title).toBeVisible();

  // X (index 2) sert « Cible suivante » par défaut : le poser sur Zoom avant doit le lui retirer.
  await controls.cell("zoom-in", "pad").click();
  await pressPadButton(page, 2);

  await expect(controls.cell("zoom-in", "pad")).toHaveText("X");
  await expect(controls.cell("cycle-target-next", "pad")).toHaveAttribute(
    "data-state",
    "displaced",
  );
  await expect(controls.message).toHaveText(/^X a quitté « Cible suivante »$/);
});
