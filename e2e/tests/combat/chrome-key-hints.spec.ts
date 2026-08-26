import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Cahier §4.18 / §4.19 — un capuchon de touche sous chaque contrôle du chrome (plan 189, volet C).
//
// La règle, et pas trois cas particuliers (décision 10) : **un bouton du chrome porte le glyphe de sa
// touche sous lui**, et chaque liste qui défile annonce ses touches de défilement. Avant, la seule
// façon d'apprendre que `J` ouvre le journal était d'aller lire l'écran de contrôles — que rien
// n'invite à ouvrir.
//
// Asymétrie VOULUE entre les deux listes (décision 7 vs 8) : l'ordre de jeu déborde toujours, 4K
// comprise, donc ses capuchons sont permanents ; le journal naît **vide** et annoncerait un contrôle
// sans effet, donc les siens n'apparaissent qu'au débordement.
//
// Le DESSIN des tuiles reste 👁 (pixel pur, masque CSS) : ici on ne juge que la présence, la place et
// l'appareil auquel le capuchon s'adresse.

/**
 * Plafond de fins de tour jouées pour faire déborder le journal — on s'arrête dès qu'il déborde.
 *
 * Deux bornes se referment l'une sur l'autre, d'où la boucle qui sort tôt plutôt qu'un compte fixe :
 * - **en dessous**, à la fenêtre du projet (1280 × 720, épinglée par `playwright.config.ts`),
 *   `.bl-list` plafonne à 30 vh et chaque tour écrit 3 lignes — 15 tiennent encore, 18 débordent ;
 * - **au-dessus**, `DUEL` pose les deux combattants sur la colonne `x = 2` de `sandbox-flat`, dont
 *   les rangs 2 et 3 sont du **marécage** : chaque tour coûte des PV aux deux (c'est d'ailleurs ce
 *   qui remplit le journal si vite), et un tour de trop finit par mettre quelqu'un K.O. — le menu
 *   d'actions disparaît alors et la boucle attendrait un bouton qui ne reviendra jamais.
 */
const MAX_TURNS_TO_OVERFLOW_LOG = 6;

/** « Menu de combat » posé sur `M` : le seul moyen de prouver que le capuchon lit le binding de
 *  `OpenCombatMenu` avant de retomber sur celui d'*Annuler*. */
const OPEN_MENU_ON_KEY_M = JSON.stringify({
  version: 1,
  keyboard: { "open-combat-menu": [{ code: "KeyM", shift: false }, null] },
  gamepad: {},
});

/** Tuile dessinée par un capuchon, publiée en propriétés CSS calculées — le seul signal de « quelle
 *  touche est annoncée », le glyphe étant un masque sur une feuille de tuiles. */
function capTile(page: Page, testId: string): Promise<string> {
  return page.evaluate((id) => {
    const cap = document.querySelector(`[data-testid="${id}"]`);
    if (!cap) {
      return "";
    }
    const style = getComputedStyle(cap);
    return `${style.getPropertyValue("--cl-cap-col").trim()}/${style
      .getPropertyValue("--cl-cap-row")
      .trim()}`;
  }, testId);
}

/** Boîte d'un locator, ou l'échec explicite — un `null` silencieux ferait passer une comparaison
 *  de position pour une bonne raison. */
async function boxOf(locator: Locator): Promise<{ top: number; bottom: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error("élément sans boîte : il n'est pas rendu");
  }
  return { top: box.y, bottom: box.y + box.height };
}

test("§4.19 chaque bouton de la rangée porte le capuchon de sa touche SOUS lui", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox(DUEL);
  await expect(combatMenu.openButton).toBeVisible({ timeout: 30_000 });

  const menuHint = page.getByTestId("combat-menu-key-hint");
  const logHint = page.getByTestId("log-open-key-hint");
  await expect(menuHint).toBeVisible();
  await expect(logHint).toBeVisible();

  // « Sous lui » est le contenu de la décision 10, pas un détail de mise en page : un joueur qui
  // découvre un bouton doit découvrir son raccourci au même endroit, du même coup d'œil.
  expect((await boxOf(menuHint)).top).toBeGreaterThanOrEqual(
    (await boxOf(combatMenu.openButton)).bottom - 1,
  );
  expect((await boxOf(logHint)).top).toBeGreaterThanOrEqual(
    (await boxOf(page.getByTestId("battle-log"))).bottom - 1,
  );
});

test("§4.19 le capuchon du menu suit « Menu de combat » quand une touche lui est assignée, sinon « Annuler »", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);
  // `OpenCombatMenu` n'a AUCUN défaut clavier : c'est `Échap` — le binding d'*Annuler* — qui l'ouvre
  // quand il n'a rien à annuler. Le capuchon montre donc celui-là par repli.
  await expect.poll(() => capTile(page, "combat-menu-key-hint-cap")).not.toBe("");
  const fallbackTile = await capTile(page, "combat-menu-key-hint-cap");

  await page.addInitScript((stored: string) => {
    localStorage.setItem("pt-bindings", stored);
  }, OPEN_MENU_ON_KEY_M);
  await bootSandbox(DUEL);

  // Écrire `Escape` en dur ferait mentir le chrome dès le premier remappage, dans les deux sens :
  // celui qui assigne une touche au menu verrait encore `Échap`, celui qui déplace *Annuler* verrait
  // un `Échap` qui n'ouvre plus rien.
  await expect.poll(() => capTile(page, "combat-menu-key-hint-cap")).not.toBe(fallbackTile);
});

test("§4.2 les capuchons de défilement de l'ordre de jeu encadrent la liste, en permanence", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);

  const up = page.getByTestId("timeline-scroll-up-key-hint");
  const down = page.getByTestId("timeline-scroll-down-key-hint");
  // Aucune condition à calculer (décision 7) : la liste d'ordre de jeu déborde toujours, y compris
  // en 4K — plus de trente vignettes coupées net en bas de l'écran.
  await expect(up).toBeVisible();
  await expect(down).toBeVisible();

  // Un à chaque extrémité verticale : c'est ce qui donne un sens à la direction du capuchon (il
  // désigne le bord vers lequel il emmène). Groupés, ils disaient quelle touche presser sans dire de
  // quoi ils parlaient.
  expect((await boxOf(up)).bottom).toBeLessThan((await boxOf(down)).top);
});

test("§4.9 les capuchons de défilement du journal n'apparaissent QU'UNE FOIS la liste débordée", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  /*
   * Budget explicite plutôt que `test.slow()` (× 3 = 180 s), qui s'est révélé trop court sous la
   * charge de la suite : c'est le seul test du plan à JOUER des tours, et un tour qui coûte ~1,5 s en
   * isolation monte à ~25 s quand trois navigateurs WebGL se partagent le plafond CPU. Le nominal
   * reste d'une quinzaine de secondes ; ce chiffre-là n'est qu'un filet.
   */
  test.setTimeout(240_000);
  const scene = await bootSandbox(DUEL);
  // Hors verrou d'animation : une frappe envoyée en contexte `locked` est ignorée à raison.
  await expect(combatMenu.openButton).toBeEnabled({ timeout: 30_000 });

  const scrollUp = page.getByTestId("log-scroll-up-key-hint");
  const scrollDown = page.getByTestId("log-scroll-down-key-hint");
  // Journal replié et vide : annoncer un défilement ici promettrait un contrôle qui ne fait rien.
  await expect(scrollUp).toBeHidden();
  await expect(scrollDown).toBeHidden();

  await page.keyboard.press("KeyJ");
  await expect(page.getByTestId("battle-log-entry")).toHaveCount(0);
  // Déplié mais toujours vide : c'est le CONTENU qui décide, pas l'ouverture du panneau.
  await expect(scrollUp).toBeHidden();

  for (let turn = 0; turn < MAX_TURNS_TO_OVERFLOW_LOG; turn += 1) {
    if (await scrollUp.isVisible()) {
      break;
    }
    await scene.endTurn();
    await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeVisible({
      timeout: 30_000,
    });
  }

  await expect(scrollUp).toBeVisible();
  await expect(scrollDown).toBeVisible();
});

test("§4.19 manette en main, le capuchon de touche cède la place au bouton et au geste", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);
  // Déclarer la source clavier comme le ferait un joueur : une frappe suffit, le suivi d'appareil
  // publie `data-input-source` sur `<html>`.
  await page.keyboard.press("KeyE");

  const keyCap = page.getByTestId("combat-menu-key-hint-cap");
  const padCap = page.getByTestId("combat-menu-key-hint-pad");
  const timelineKeyCap = page.getByTestId("timeline-scroll-up-key-hint-cap");
  const timelineGesture = page.getByTestId("timeline-scroll-up-key-hint-gesture");
  await expect(keyCap).toBeVisible();
  await expect(padCap).toBeHidden();
  await expect(timelineKeyCap).toBeVisible();
  await expect(timelineGesture).toBeHidden();

  // La bascule est en CSS pur (`data-input-source`) : les deux appareils sont TOUJOURS dessinés, la
  // feuille de style choisit. Playwright ne pilote pas `navigator.getGamepads()`, donc on pose
  // l'attribut que le suivi d'appareil publierait — c'est lui, et lui seul, que le CSS lit.
  await page.evaluate(() => {
    document.documentElement.dataset.inputSource = "gamepad";
  });

  await expect(keyCap).toBeHidden();
  await expect(padCap).toBeVisible();
  // Le défilement n'est pas un bouton à la manette mais un GESTE (`R3` maintenu + direction) : sans
  // cette branche l'indice disparaissait pad en main, ce qui se lisait comme « pas de raccourci ».
  await expect(timelineKeyCap).toBeHidden();
  await expect(timelineGesture).toBeVisible();
});
