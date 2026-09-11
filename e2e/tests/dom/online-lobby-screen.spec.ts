import type { Page } from "@playwright/test";
import { expect, localSignalling, test } from "../../fixtures";
import {
  connectPad,
  focusedTestId,
  PadButton,
  tapPadButton,
  withFakeGamepad,
} from "../../pages/gamepad";
import { LobbyScreen } from "../../pages/lobby";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen } from "../../pages/screens";

/*
 * Cahier §6.8 — l'écran « Jouer en ligne » lui-même (plan 207), par opposition au salon.
 *
 * `online-lobby.spec.ts` garde le contrat du SALON, et paie pour cela deux contextes de navigateur
 * et une négociation WebRTC. Ici rien de tel : ces cinq scénarios se jouent sur **un seul écran**,
 * celui que le joueur a sous les yeux avant de partir composer son équipe.
 *
 * Le préfixe `online-` n'est pas décoratif : c'est lui qui range ce fichier dans la famille `online`
 * de `scripts/e2e-affected.ts`, donc qui le fait rejouer par le gate quand `packages/network/` ou
 * `packages/app/src/network/` bougent. Le refus ci-dessous traverse `Room.join` — sans ce préfixe,
 * un changement de la traduction des causes de refus ne rejouerait aucun test qui la lit.
 *
 * 🔴 Ce que le plan 207 a déplacé, et que ce fichier garde : le refus de rejoindre se prononce
 * **dans le lobby**, avant toute navigation. Avant, un code mal recopié envoyait le joueur sur un
 * écran complet de construction d'équipe, pour une partie qui n'existe pas, avec une ligne rouge en
 * bas du pied de page. C'est **où** le refus arrivait qui était le défaut principal — donc
 * « on est toujours sur l'écran lobby » est l'assertion qui compte le plus de tout le fichier.
 */

/**
 * Un code de la bonne FORME — cinq caractères de l'alphabet des codes — que personne n'héberge.
 *
 * C'est tout l'intérêt : un code incomplet est refusé sans réseau (« Ce code est incomplet »), et ce
 * chemin-là ne passe jamais par la modale. Pour atteindre `CodeIntrouvable` il faut un code que
 * l'annuaire accepte de chercher et ne trouve pas.
 */
const ORPHAN_CODE = "QQQQQ";

/**
 * Combien de pixels de glissement valent une lettre (`DRAG_STEP_PX`, plan 207 étape 4), et en
 * dessous de combien un appui reste une tape (`DRAG_THRESHOLD_PX`).
 *
 * Recopiés ici parce que l'e2e n'importe rien des paquets : ce sont les deux nombres que le plan a
 * arrêtés, et les asserter, c'est asserter le geste tel qu'il a été calé.
 */
const DRAG_STEP_PX = 30;
const DRAG_THRESHOLD_PX = 8;

/** Mène jusqu'à l'écran `lobby`, annuaire local branché, depuis un chargement de page neuf. */
async function gotoLobby(page: Page): Promise<LobbyScreen> {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const lobby = new LobbyScreen(page);

  await menu.goto(localSignalling);
  await menu.combat.click();
  await mode.online.click();
  await expect(lobby.title).toBeVisible();
  return lobby;
}

test("§6.8 un code introuvable est refusé DANS le lobby, en modale, sans navigation", async ({
  page,
}) => {
  /*
   * Seul test du fichier à parler à l'annuaire, et il le fait DEUX fois (un refus par acte).
   * Mesuré ~6 s par refus sur cette machine, à vide : l'annuaire doit d'abord attribuer une adresse
   * au pair local, puis constater que personne ne tient celle du code. Le budget de 60 s du projet
   * `dom` y passerait sous la file d'attente d'une suite complète.
   */
  test.slow();

  // La manette est posée avant le chargement (`addInitScript`) mais n'est CONNECTÉE qu'à l'acte 2 :
  // jusque-là l'écran se pilote à la souris, comme n'importe quel joueur qui tape son code.
  await withFakeGamepad(page);
  const lobby = await gotoLobby(page);

  await lobby.typeCode(ORPHAN_CODE);
  expect(await lobby.readCode()).toBe(ORPHAN_CODE);
  await lobby.join.click();

  /*
   * L'attente est DITE. Ce n'est pas de la décoration : joindre un pair passe par un annuaire, donc
   * ça prend un temps visible — ici ~6 s. Sans ce retour, « Rejoindre » avait l'air de ne rien faire
   * et le joueur rappuyait. Les deux boutons du panneau sont inertes le temps de la tentative.
   */
  await expect(lobby.join).toHaveText("Connexion…");
  await expect(lobby.join).toBeDisabled();
  await expect(lobby.paste).toBeDisabled();

  // — Acte 1 : la modale, et le bouton « Réessayer » ————————————————————————————————————————————
  await expect(lobby.refusal).toBeVisible({ timeout: 30_000 });
  await expect(lobby.refusalTitle).toBeVisible();
  await expect(lobby.refusalMessage).toHaveText("Ce code ne correspond à aucune partie.");
  // La sortie DÉPEND de la cause : `CodeIntrouvable` se corrige sur place, donc « Réessayer ».
  await expect(lobby.refusalDismiss).toHaveText("Réessayer");

  // 🔴 L'assertion du plan : on n'a PAS quitté le lobby. Le titre de l'écran est toujours là, et la
  // ligne d'erreur du pied de panneau est restée vide — le refus est dit par la modale, pas par
  // elle, et surtout pas par le pied de page d'un autre écran.
  await expect(lobby.title).toBeVisible();
  await expect(lobby.error).toBeEmpty();

  await lobby.refusalDismiss.click();
  await expect(lobby.refusal).toHaveCount(0);
  // Le code est CONSERVÉ, et le focus revient sur la roue : le joueur corrige le caractère qu'il a
  // mal entendu, il ne resaisit pas les cinq.
  expect(await lobby.readCode()).toBe(ORPHAN_CODE);
  await expect(lobby.codeSlots.first()).toBeFocused();
  // Et « Rejoindre » a repris son libellé : pendant la tentative il disait « Connexion… ».
  await expect(lobby.join).toHaveText("Rejoindre");
  await expect(lobby.join).toBeEnabled();

  // — Acte 2 : B referme la modale au lieu de quitter l'écran ————————————————————————————————————
  /*
   * 🔴 Le trou que l'étape 6 du plan a bouché. Cet écran annulait INCONDITIONNELLEMENT : à la
   * manette, B partait vers « Mode de combat » **par-dessous** une modale ouverte, laissant le
   * joueur devant un écran qu'il n'avait pas demandé avec un dialogue qui n'existait plus.
   */
  await lobby.join.click();
  await expect(lobby.refusal).toBeVisible({ timeout: 30_000 });
  await connectPad(page);
  await tapPadButton(page, PadButton.B);

  await expect(lobby.refusal).toHaveCount(0);
  await expect(lobby.title).toBeVisible();
  // Même sortie qu'au bouton : la fermeture native vaut « réessayer », donc la roue reprend le
  // focus. Refermer sans rien rendre laisserait le joueur devant un écran qui n'a pas réagi.
  await expect.poll(() => focusedTestId(page)).toBe("code-slot");
});

test("§6.8 « Coller » s'atteint aux flèches, par la gauche de la roue", async ({ page }) => {
  /*
   * Le bouton a **déménagé** pendant la recette du plan 207 : il était sous la roue, entre elle et
   * « Rejoindre » ; il siège désormais à côté de « Tu as reçu un code ? ». Un contrôle qui bouge doit
   * être re-prouvé joignable aux flèches (`.claude/rules/multi-input.md`), et son voisinage a changé
   * de côté par la même occasion — il précède maintenant la roue dans l'ordre du document, donc il se
   * rejoint par la GAUCHE là où « Rejoindre » se rejoint par la droite (§6.10 au pad).
   *
   * On part de « Créer une partie » et on presse de VRAIES touches : jamais `.focus()` sur la cible,
   * qui court-circuiterait précisément le chemin qu'on veut prouver.
   */
  const lobby = await gotoLobby(page);
  await lobby.create.focus();

  // Par le BAS : les deux cartes sont empilées, « Créer » est au-dessus de la roue. (C'était
  // `ArrowRight` le temps d'un aller-retour où les cartes étaient côte à côte — disposition que
  // l'humain a ensuite refusée, l'écran suivant désormais le patron « écran plein ».)
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => focusedTestId(page)).toBe("code-slot");

  /*
   * La roue prend l'axe horizontal en ENTIER : au bord, elle sort d'elle-même vers le contrôle qui
   * la précède dans l'ordre du document, sans rien demander à la navigation spatiale (la roue est
   * centrée, la géométrie n'a pas de bonne réponse à donner de ce côté-là).
   *
   * On pousse jusqu'à ce que le focus la quitte, comme §6.10 le fait pour la sortie droite : ce
   * qu'on affirme est l'EXISTENCE de l'issue, pas un nombre d'appuis — l'emplacement d'entrée
   * dépend de la géométrie, donc du viewport.
   */
  for (let step = 0; step < 8 && (await focusedTestId(page)) === "code-slot"; step += 1) {
    await page.keyboard.press("ArrowLeft");
  }
  expect(await focusedTestId(page)).toBe("lobby-paste");
});

test.describe("le presse-papier", () => {
  // Le seul endroit du harnais qui a besoin de lire le presse-papier : accordé ici, pas au projet.
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("§6.8 « Coller » remplit la roue depuis le presse-papier", async ({ page }) => {
    const lobby = await gotoLobby(page);

    // Un code tel qu'il arrive par messagerie : entouré de bruit, en minuscules, avec le préfixe
    // d'espace de noms si la personne a copié une adresse plutôt qu'un code.
    await page.evaluate(() => navigator.clipboard.writeText("  pkmntac-xkq4m  "));
    await lobby.paste.click();

    await expect.poll(() => lobby.readCode()).toBe("XKQ4M");
    await expect(lobby.error).toBeEmpty();
    // Le focus retombe dans la roue : le geste suivant est « corriger » ou « Rejoindre », pas
    // « retrouver où j'en étais ».
    await expect(lobby.codeSlots.first()).toBeFocused();
  });

  test("§6.8 un presse-papier sans code le dit, et ne touche pas à la roue", async ({ page }) => {
    const lobby = await gotoLobby(page);

    // `0` et `1` sont les deux chiffres ABSENTS de l'alphabet des codes (ils se confondent avec O et
    // I à l'oral comme à l'œil) : après nettoyage il ne reste donc rien du tout.
    await page.evaluate(() => navigator.clipboard.writeText("0101"));
    await lobby.paste.click();

    await expect(lobby.error).toHaveText("Le presse-papier ne contient pas de code.");
    expect(await lobby.readCode()).toBe("AAAAA");
  });
});

test("§6.8 la roue se fait glisser, et le relâchement ne vole pas de lettre", async ({ page }) => {
  const lobby = await gotoLobby(page);

  /*
   * Le geste est mesuré contre des RÉFÉRENCES prises au clavier, et non contre l'alphabet des codes
   * recopié dans le test : `↓` et `↑` défilent d'un cran, par définition. On note donc ce que valent
   * un cran et deux crans depuis « A » sur l'emplacement VOISIN, et le glissement est ensuite
   * comparé à ces lettres — l'assertion survit à un changement d'alphabet, qui n'est pas l'objet.
   */
  await lobby.codeSlots.nth(1).click();
  await page.keyboard.press("ArrowDown");
  const oneStep = (await lobby.readCode())[1];
  await page.keyboard.press("ArrowDown");
  const twoSteps = (await lobby.readCode())[1];
  expect(oneStep).not.toBe(twoSteps);

  const box = await lobby.slotBox(0);
  const centerX = box.x + box.width / 2;
  // Le tiers HAUT et le tiers BAS du bouton : les deux zones de tape qui font défiler d'un cran, et
  // donc les deux endroits où un `click` parasite se verrait.
  const topZoneY = box.y + 4;
  const bottomZoneY = box.y + box.height - 4;

  // — (a) Le seuil, puis un cran par 30 px ————————————————————————————————————————————————————————
  await page.mouse.move(centerX, bottomZoneY);
  await page.mouse.down();

  // Sous le seuil, rien ne défile : un doigt qui tape tremble de quelques pixels, et ce tremblement
  // ne doit pas coûter une lettre.
  await page.mouse.move(centerX, bottomZoneY - (DRAG_THRESHOLD_PX - 4));
  expect((await lobby.readCode())[0]).toBe("A");

  // Au-delà, l'alphabet suit le pointeur — un cran par 30 px, vers le haut comme une molette.
  await page.mouse.move(centerX, bottomZoneY - DRAG_STEP_PX, { steps: 4 });
  await expect.poll(async () => (await lobby.readCode())[0]).toBe(oneStep);
  await page.mouse.move(centerX, bottomZoneY - 2 * DRAG_STEP_PX, { steps: 4 });
  await expect.poll(async () => (await lobby.readCode())[0]).toBe(twoSteps);
  await page.mouse.up();
  expect((await lobby.readCode())[0]).toBe(twoSteps);

  /*
   * — (b) 🔴 Le relâchement n'ajoute RIEN ————————————————————————————————————————————————————————
   *
   * Le navigateur émet un `click` à la fin d'un glissement. Sans le drapeau qui l'avale, il serait
   * pris pour une tape et volerait la lettre du tiers où le pointeur s'est arrêté.
   *
   * Le geste est calibré pour que ce soit VÉRIFIABLE, et ça n'allait pas de soi : un glissement de
   * deux crans depuis un bord se relâche au MILIEU du bouton, tiers neutre où une tape ne fait rien
   * — l'assertion y passait au vert avec le drapeau retiré. Donc on part du tiers HAUT et on glisse
   * de 12 px : c'est au-delà du seuil (le glissement est établi, le drapeau est armé) mais en dessous
   * d'un demi-cran (aucune lettre ne doit bouger), et le relâchement tombe **dans une zone de tape**.
   * Le code doit être exactement celui d'avant le geste.
   */
  const beforeIdleDrag = await lobby.readCode();
  await page.mouse.move(centerX, topZoneY);
  await page.mouse.down();
  await page.mouse.move(centerX, topZoneY + DRAG_THRESHOLD_PX + 4);
  await page.mouse.up();
  expect(await lobby.readCode()).toBe(beforeIdleDrag);

  // — (c) Les trois zones de tape ont survécu au glissement ————————————————————————————————————————
  // Taper le tiers HAUT recule d'un cran, donc on retombe sur la référence à un cran. Ça prouve du
  // même coup que le drapeau ne traîne pas d'un geste sur l'autre — sinon cette tape-ci, qui suit un
  // glissement, serait avalée à son tour.
  await lobby.codeSlots.first().click({ position: { x: box.width / 2, y: 4 } });
  expect((await lobby.readCode())[0]).toBe(oneStep);
});
