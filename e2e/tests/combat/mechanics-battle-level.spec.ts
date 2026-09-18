import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  BATTLE_LEVEL_FIFTY,
  BATTLE_LEVEL_MIXED,
  BATTLE_LEVEL_TEN,
} from "../../fixtures/sandbox-configs";
import type { CombatScene } from "../../pages/CombatScene";
import { hoverCard } from "../../pages/combat-queries";

/*
 * Cahier §5.47 — **le niveau de combat frappe pour de vrai** (2026-09-18).
 *
 * Ce que ce fichier garde, et pourquoi il naît maintenant : la formule de dégâts lisait une constante
 * `BATTLE_LEVEL = 50` recopiée dans sept fichiers, pendant que `computeCombatStats` était, lui,
 * correctement paramétré par le niveau. Un Pokemon de niveau 30 voyait donc ses statistiques
 * descendre et ses dégâts rester calculés à 50 — EN SILENCE, sans erreur ni test rouge, les quatre
 * copies étant d'accord entre elles. Le sens à automatiser est celui d'un JOUEUR : à graine fixe,
 * taper au niveau 10 doit retirer visiblement moins de PV que taper au niveau 50.
 *
 * Ce que l'e2e ajoute aux unitaires de `damage-calculator` : le réglage traverse la chaîne ENTIÈRE
 * (JSON du studio → `normalizeSandboxConfig` → `createSandboxBattle` → `BattleSetup` → moteur → HUD).
 * Chaque maillon a son propre passe-plat à oublier — le normaliseur recopie champ par champ, donc un
 * `level` non relayé est jeté sans un mot et le combat reste au niveau 50 en paraissant obéir.
 *
 * La VALEUR exacte des dégâts reste unitaire (formule, bande de jet 85-100 %, crans, natures).
 */

const DAMAGE_LINE = /perd (\d+) PV/;

/** Joue la Griffe du Florizarre sur le Dummy adjacent et rend les PV retirés, lus sur la ligne de
 *  journal FR. Le Dummy est inerte (équipe passive sans move), donc cette ligne est la SEULE source
 *  de dégâts du combat : aucune ambiguïté sur ce qu'on mesure. */
async function scratchDamage(page: Page, scene: CombatScene): Promise<number> {
  await scene.castFirstMove(2, 2);
  const line = page.getByTestId("battle-log-entry").filter({ hasText: DAMAGE_LINE }).first();
  await expect(line).toBeAttached({ timeout: 10_000 });
  const text = (await line.textContent()) ?? "";
  const match = DAMAGE_LINE.exec(text);
  if (!match?.[1]) {
    throw new Error(`Ligne de dégâts illisible : « ${text} »`);
  }
  return Number(match[1]);
}

// §5.47 Le niveau demandé dans la config atteint le HUD. La moins chère des deux assertions, et
// celle qui distingue « le réglage n'a pas été relayé » de « le réglage est relayé mais n'agit pas
// sur les dégâts » : sans elle, un échec du scénario suivant laisserait le doute entier.
test("§5.47 le niveau demandé dans la config s'affiche sur la carte d'info", async ({
  page,
  bootSandbox,
}) => {
  const low = await bootSandbox(BATTLE_LEVEL_TEN);
  await expect((await hoverCard(low, page, 2, 3, "Florizarre")).level).toHaveText("Lv.10");

  const full = await bootSandbox(BATTLE_LEVEL_FIFTY);
  await expect((await hoverCard(full, page, 2, 3, "Florizarre")).level).toHaveText("Lv.50");
});

// §5.47 LE scénario du lot : même graine, même attaquant, même move, même cible — seul le niveau
// de l'ATTAQUANT change, et les PV retirés s'effondrent. Le seuil est à moitié : il laisse toute la
// place à la variance de jet et au rééquilibrage, tout en restant hors d'atteinte d'un niveau ignoré.
//
// 🔴 La cible reste au niveau 50, et c'est délibéré. La première version baissait le combat ENTIER,
// donc la cible aussi : elle défendait moins bien, ce qui poussait les dégâts vers le HAUT et
// brouillait la mesure (l'écart se creusait malgré ce contre-effet, l'assertion était seulement
// conservatrice). Le niveau appartenant au Pokemon depuis le plan 215, on isole l'attaquant.
//
// 🔴 Rouge-vert VÉRIFIÉ le 2026-09-18 : en replaçant la constante fautive (`2 * 50` au lieu de
// `2 * attacker.level`) dans `damage-calculator.ts`, le niveau 10 remonte à 19 PV — les deux coups
// se confondent et ce test tombe, pendant que celui d'au-dessus reste vert. C'est exactement la
// forme du défaut : le niveau s'affiche, les statistiques baissent, les dégâts non.
test("§5.47 à graine fixe, le niveau 10 retire bien moins de PV que le niveau 50", async ({
  page,
  bootSandbox,
}) => {
  const atFifty = await scratchDamage(page, await bootSandbox(BATTLE_LEVEL_FIFTY));
  const atTen = await scratchDamage(page, await bootSandbox(BATTLE_LEVEL_TEN));

  // Deux coups qui portent : une comparaison entre deux zéros passerait sans rien prouver.
  expect(atFifty).toBeGreaterThan(0);
  expect(atTen).toBeGreaterThan(0);
  expect(atTen).toBeLessThan(atFifty / 2);
});

// §5.47 Le cas que le niveau par Pokemon débloque et qu'aucun réglage global ne pouvait exprimer :
// deux membres du MÊME camp à des niveaux différents. C'est la forme d'une équipe d'Aventure.
test("§5.47 deux Pokemon du même camp gardent chacun son niveau", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(BATTLE_LEVEL_MIXED);

  await expect((await hoverCard(scene, page, 2, 3, "Florizarre")).level).toHaveText("Lv.10");
  await expect((await hoverCard(scene, page, 3, 3, "Dracaufeu")).level).toHaveText("Lv.80");
});

// §5.47 Le garde-fou du REMONTAGE, et c'est le plus sournois des trois. `SandboxPanel.readConfig()`
// reconstruit la configuration ENTIÈRE à chaque changement, et le combat est remonté dessus : un
// champ que l'état du panneau ne porte pas est perdu au premier réglage touché, en silence. Le
// défaut a déjà été commis une fois sur `level` (revue du 2026-09-18) et `debugTiles` l'a encore.
//
// Écrit en e2e et non en unitaire à dessein : `SandboxPanel` exige `getSandboxStudioDom()` et le
// projet n'a aucun environnement DOM en vitest — en ajouter un serait une dépendance de plus.
// Ici on pilote le VRAI panneau, ce qui prouve davantage.
test("§5.47 changer un réglage du studio ne perd pas le niveau du Pokemon", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(BATTLE_LEVEL_TEN);
  await expect((await hoverCard(scene, page, 2, 3, "Florizarre")).level).toHaveText("Lv.10");

  // La MÉTÉO, et pas « le premier select venu » : le premier est celui de la carte, et en changer
  // rejoue un autre combat où le Florizarre n'est plus sur la même case — le test échouait alors
  // pour une raison sans rapport avec ce qu'il prétend prouver.
  //
  // Pas de `waitReady()` non plus : le signal de scène prête n'est PAS réarmé par un remontage du
  // studio (mesuré — il expire à 20 s). `hoverCard` sonde déjà jusqu'à ce que la carte réponde,
  // donc il encaisse la reconstruction sans qu'on ait à inventer un signal.
  await page
    .locator("select")
    .filter({ has: page.locator('option[value="rain"]') })
    .selectOption("rain");

  await expect((await hoverCard(scene, page, 2, 3, "Florizarre")).level).toHaveText("Lv.10");
});
