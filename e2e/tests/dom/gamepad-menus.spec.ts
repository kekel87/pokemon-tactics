import { expect, test } from "../../fixtures";
import {
  connectPad,
  focusedDataValue,
  focusedTestId,
  holdPadUntil,
  PadButton,
  pressPadButton,
  tapPadButton,
  withFakeGamepad,
} from "../../pages/gamepad";
import { MainMenu } from "../../pages/MainMenu";
import {
  BattleModeScreen,
  ControlsScreen,
  MapSelectScreen,
  SettingsScreen,
  TeamSelectScreen,
} from "../../pages/screens";

// Cahier §6.12 — la manette dans les écrans de menu (plan 186, retour humain 2026-08-25).
//
// La manette synthétique vit dans `pages/gamepad.ts` depuis le plan 188 (un second fichier en a eu
// besoin) : `navigator.getGamepads()` est une simple fonction, on la remplace. Ça ne teste pas le
// matériel — ça teste toute la chaîne qui vient après lui (poller → routeur → focus DOM), c'est-à-dire
// exactement ce qui était cassé.

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
    // Publié sur `<html>` depuis le plan 188 : la règle d'anneau doit aussi atteindre les `<dialog>`,
    // qui vivent sur `<body>` et non dans `#game-root`.
    expect(await page.evaluate(() => document.documentElement.dataset.inputSource)).toBe("gamepad");

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

/**
 * §6.4 — le liseré doit RESTER dans la rangée de formats quand on change de format.
 *
 * Ce n'est pas un test d'attribut de test : l'écran se reconstruit entièrement à chaque changement
 * (`replaceChildren`), et `renderPreservingFocus` ne sait retrouver le contrôle focalisé que par
 * **famille de `data-testid`** (le repli par rang global a été retiré exprès — il posait le focus sur
 * un bouton « Supprimer »). Le sélecteur de format n'en portait pas : le focus repartait donc au
 * `<body>`, puis `focusInDirection` réentrait sur `controls[0]` = « ◀ Retour », à l'autre bout de
 * l'écran. Essayer les formats à la manette faisait perdre sa place à chaque appui — signalé comme
 * bug visuel le 2026-08-28 en filmant la séquence d'intro (plan 194).
 */
test("§6.4 à la manette, changer de format garde le focus dans la rangée de formats", async ({
  page,
}) => {
  await withFakeGamepad(page);
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  const teams = new TeamSelectScreen(page);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await maps.confirm.click();
  await expect(teams.title).toBeVisible();
  // Le poller démarre ici, une fois l'`InputSystem` en place — pas sur `load`, qui est une course.
  await connectPad(page);

  /*
   * Sans focus, une direction entre par `controls[0]` = « ◀ Retour » ; la rangée de formats est le
   * reste du bandeau, donc on l'atteint vers la droite. Maintenu et non tapé : le nombre de crans
   * dépend de la mise en page, et la navigation est spatiale — on attend l'ARRIVÉE, pas N appuis.
   *
   * On reconnaît un segment à son `data-format-key`, PAS à son `data-testid` : le testid est
   * exactement ce que le correctif ajoute, donc s'en servir pour naviguer ferait échouer le test
   * avant l'assertion qui compte, et pour la mauvaise raison (locator absent au lieu de focus perdu).
   */
  await holdPadUntil(
    page,
    PadButton.DpadRight,
    async () => (await focusedDataValue(page, "formatKey")) !== null,
  );

  // Un cran de plus, parce qu'on entre sur le segment ACTIF : presser le format déjà retenu ne
  // déclenche aucun re-rendu (`onFormatChange` compare les clés), et le test passerait au vert sans
  // avoir exercé la restauration de focus.
  await tapPadButton(page, PadButton.DpadRight);
  const targetKey = await focusedDataValue(page, "formatKey");
  expect(targetKey).not.toBeNull();
  await expect(teams.activeFormatSegment).not.toHaveAttribute("data-format-key", String(targetKey));

  // A active le contrôle focalisé (`activateFocusedControl` clique) → changement de format → l'écran
  // est reconstruit. Maintenu : un appui bref peut tomber entre deux lectures du poller sur un écran
  // sans boucle de rendu Babylon, où le navigateur ralentit fortement les frames.
  await holdPadUntil(
    page,
    PadButton.A,
    async () => (await teams.activeFormatSegment.getAttribute("data-format-key")) === targetKey,
  );

  // Le liseré est resté sur le segment pressé : c'est l'assertion de la régression. Sans le
  // correctif, le focus est sur « ◀ Retour » — qui n'a ni `data-format-key` ni `data-testid`, donc
  // les deux lectures ci-dessous s'y liraient `null`.
  await expect.poll(() => focusedDataValue(page, "formatKey")).toBe(targetKey);
  expect(await focusedTestId(page)).toBe("format-segment");

  // Et le contrôle refocalisé appartient bien au NOUVEAU rendu, pas à un nœud détaché : la
  // navigation continue dans la rangée. Vers la gauche, qui existe toujours — on a avancé d'un cran.
  await tapPadButton(page, PadButton.DpadLeft);
  await expect.poll(() => focusedDataValue(page, "formatKey")).not.toBe(targetKey);
  expect(await focusedTestId(page)).toBe("format-segment");
});
