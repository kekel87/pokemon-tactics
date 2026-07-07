import { expect, test } from "../../fixtures";
import {
  CRIT_FOCUS_ENERGY,
  CRIT_LASER_FOCUS,
  CRIT_STORM_THROW,
} from "../../fixtures/sandbox-configs";
import { InfoPanel } from "../../pages/combatHud";

// Cahier §5.32 — Misc Batch A : manipulation de coups critiques (plan 151). Cinq moves dont l'identité
// repose sur les CRITIQUES (booster le taux, garantir un crit, ignorer les défenses). On pilote de bout
// en bout et on assert le SENS lisible : la ligne de journal FR (`BattleLogFormatter`) + le badge
// volatile de l'InfoPanel (`battle-views`), jamais le pixel. Déterministe (seed moteur, moves 100 %
// précision, jamais d'override `Math.random`). Deux moves restent hors périmètre e2e (voir bas de
// fichier) : Cri Draconique (`dragon-cheer`) exige un allié JOUEUR — non supporté par le harness
// sandbox (joueur + dummy uniquement) → 👁 ; Dark Lariat (`darkest-lariat`, ignore les crans défensifs)
// n'a pas de feedback observable propre → 👁, couvert unit/integration core.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.32 Puissance (`focus-energy`, Self) : sur sa propre case → journal CritStageRaised.
test("§5.32 Puissance : le lanceur devient plus enclin aux critiques (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(CRIT_FOCUS_ENERGY);
  await scene.castFirstMove(2, 3); // self
  await expect(log(page, /plus enclin aux coups critiques/)).toBeAttached({ timeout: 10_000 });
});

// §5.32 Puissance : le boost persistant remonte dans l'InfoPanel sous forme de badge « Puissance +2 »
// (au survol de la case du lanceur). Le survol est CONTINU dans le jeu réel → on RE-survole à chaque
// itération du poll jusqu'à ce que le panneau reflète Florizarre + son badge (robuste, pas de course).
test("§5.32 Puissance : l'InfoPanel du lanceur affiche le badge « Puissance +2 »", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(CRIT_FOCUS_ENERGY);
  const info = new InfoPanel(page);

  await scene.castFirstMove(2, 3);
  await expect(log(page, /plus enclin aux coups critiques/)).toBeAttached({ timeout: 10_000 });

  const badge = info.panel.getByText("Puissance +2", { exact: true });
  await expect
    .poll(
      async () => {
        await scene.hoverTile(2, 3);
        if ((await info.name.textContent()) !== "Florizarre") {
          return 0;
        }
        return badge.count();
      },
      { timeout: 10_000 },
    )
    .toBe(1);
});

// §5.32 Affilage (`laser-focus`, Self, hors-pool Gen 1) : arme le prochain crit → journal
// GuaranteedCritArmed.
test("§5.32 Affilage : le lanceur se concentre pour un critique garanti (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(CRIT_LASER_FOCUS);
  await scene.castFirstMove(2, 3); // self (Affilage = 1er move)
  await expect(log(page, /son prochain coup sera critique/)).toBeAttached({ timeout: 10_000 });
});

// §5.32 Affilage : le volatile one-shot remonte dans l'InfoPanel sous forme de badge « Affilage ».
test("§5.32 Affilage : l'InfoPanel du lanceur affiche le badge « Affilage »", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(CRIT_LASER_FOCUS);
  const info = new InfoPanel(page);

  await scene.castFirstMove(2, 3);
  await expect(log(page, /son prochain coup sera critique/)).toBeAttached({ timeout: 10_000 });

  const badge = info.panel.getByText("Affilage", { exact: true });
  await expect
    .poll(
      async () => {
        await scene.hoverTile(2, 3);
        if ((await info.name.textContent()) !== "Florizarre") {
          return 0;
        }
        return badge.count();
      },
      { timeout: 10_000 },
    )
    .toBe(1);
});

// §5.32 Affilage : le coup SUIVANT est forcé critique. Une action ne se cumule pas dans un tour → on
// arme au tour 1 (Affilage), on termine le tour (le dummy Normal inerte temporise), puis on lance
// Griffe (2e move, 100 %) au tour 2 sur le dummy adjacent → « Coup critique sur … ! ». Le crit est
// forcé quel que soit le seed (pas de jet à choisir).
test("§5.32 Affilage : le coup suivant est un critique garanti (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(CRIT_LASER_FOCUS);

  await scene.castFirstMove(2, 3); // tour 1 : arme Affilage (self)
  await expect(log(page, /son prochain coup sera critique/)).toBeAttached({ timeout: 10_000 });

  await scene.endTurn(); // fin du tour 1 → le dummy inerte temporise → retour au joueur (tour 2)
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeVisible({
    timeout: 10_000,
  });

  // Tour 2 : Griffe (2e move) sur le dummy adjacent → le crit armé se déclenche.
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").filter({ hasText: "Griffe" }).click();
  await scene.clickTile(2, 2);
  await scene.clickTile(2, 2);
  await expect(log(page, /Coup critique sur/)).toBeAttached({ timeout: 10_000 });
});

// §5.32 Yama Arashi (`storm-throw`, Combat Phys contact, `alwaysCrit`, hors-pool Gen 1) : chaque coup
// est un critique garanti, indépendamment du seed → journal CriticalHit.
test("§5.32 Yama Arashi : crit garanti à chaque coup (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(CRIT_STORM_THROW);
  await scene.castFirstMove(2, 2); // le dummy Normal adjacent
  await expect(log(page, /Coup critique sur/)).toBeAttached({ timeout: 10_000 });
});
