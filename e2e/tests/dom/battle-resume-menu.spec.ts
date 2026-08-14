import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { AppShell } from "../../pages/app-shell";
import { BattleResumeStore } from "../../pages/battle-resume";
import { MainMenu } from "../../pages/MainMenu";

// Cahier §6.11 — entrée « Reprendre le combat » du menu principal (plan 181).
//
// Ce fichier verrouille les cas où l'entrée ne doit PAS apparaître : rien en réserve, et une
// sauvegarde qu'on ne saurait pas rejouer. La reprise effective (combat remonté depuis le journal
// d'actions) est dans `combat/battle-resume.spec.ts` : elle a besoin d'un vrai combat pour fabriquer
// une sauvegarde, ce que ce projet DOM ne monte pas.

/**
 * Écrit une sauvegarde puis recharge, et vérifie que le menu l'ignore : aucune entrée de reprise, et
 * aucune exception non attrapée au boot — le mode d'échec qui casserait le menu en silence (l'écran
 * se monte quand même).
 *
 * La charge utile est construite par rappel plutôt que passée telle quelle : un des cas doit être
 * estampillé du build RÉELLEMENT servi, lu là où l'app l'affiche (rejeter une sauvegarde d'un autre
 * build est justement le comportement testé, donc on ne peut pas coder ce numéro en dur).
 *
 * Un cas par test, et non trois rechargements dans un seul : chaque rechargement re-traverse le splash
 * (téléchargement du bundle de sprites), et trois d'affilée mettaient ce test à 27 s sous charge — le
 * plus lent du projet `dom`, à deux doigts de son budget de 30 s.
 */
async function expectSaveIgnored(
  page: Page,
  buildEntry: (runningBuild: string) => string,
): Promise<void> {
  const menu = new MainMenu(page);
  const shell = new AppShell(page);
  const store = new BattleResumeStore(page);
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(error.message));

  await menu.goto();
  const runningBuild = (await menu.version.textContent()) ?? "";
  expect(runningBuild).not.toBe("");
  await store.write(buildEntry(runningBuild));

  await shell.reload();

  await expect(menu.title).toBeVisible();
  await expect(menu.resume).toHaveCount(0);
  await expect(menu.combat).toBeVisible();
  expect(crashes).toEqual([]);
}

test("§6.11 aucune sauvegarde : le menu principal n'offre pas de reprise", async ({ page }) => {
  const menu = new MainMenu(page);
  const store = new BattleResumeStore(page);
  await menu.goto();

  // Contexte de navigateur neuf → stockage vide (cf. note §6.10 du cahier).
  expect(await store.read()).toBeNull();
  await expect(menu.resume).toHaveCount(0);
  // Et le menu est inchangé : la reprise s'AJOUTE en tête, elle ne remplace aucune entrée.
  await expect(menu.entries).toHaveCount(5);
  await expect(menu.entries.first()).toHaveText("Aventure");
  await expect(menu.combat).toBeVisible();
});

// Build étranger, forme par ailleurs complète : une mise à jour du jeu peut changer une formule, donc
// un journal enregistré avant ne se rejoue plus à l'identique. On préfère perdre la reprise.
test("§6.11 sauvegarde d'un autre build : ignorée, sans entrée de reprise ni erreur", async ({
  page,
}) => {
  await expectSaveIgnored(page, () => JSON.stringify(BattleResumeStore.wellFormedSave));
});

// Schéma inconnu, estampillé du BON build : prouve que le rejet vient bien du numéro de version, et
// pas d'un contrôle de build qui masquerait tout.
test("§6.11 schéma de sauvegarde inconnu : ignoré, sans entrée de reprise ni erreur", async ({
  page,
}) => {
  await expectSaveIgnored(page, (runningBuild) =>
    JSON.stringify({
      ...BattleResumeStore.wellFormedSave,
      version: 999,
      buildVersion: runningBuild,
    }),
  );
});

// Entrée corrompue (quota atteint en pleine écriture, bricolage manuel) : le `JSON.parse` lève et doit
// être avalé comme « pas de sauvegarde ».
test("§6.11 sauvegarde corrompue : ignorée, sans entrée de reprise ni erreur", async ({ page }) => {
  await expectSaveIgnored(page, () => '{"version":1,"actions":[');
});
