import { expect, test } from "../../fixtures";
import {
  REGENERATOR_HEAL,
  SCRAPPY_HITS_GHOST,
  SKILL_LINK_MAX_HITS,
} from "../../fixtures/sandbox-configs";

// Cahier §5.14 — talents Tier A (plan 136) pilotés de bout en bout via le journal FR. Tous
// déterministes (aucun override Math.random) : Régé-Force/Multi-Coups se résolvent sans jet et
// Griffe/Balle Graine ont 100 % de précision → seed fixe (DUEL) suffit. On assert le SENS (la ligne
// de journal), jamais le pixel.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// Régé-Force (regenerator) : soin passif de fin de tour. Le porteur blessé (hp 50) déclenche le hook
// `onEndTurn` dès la fin de tour → « Régé-Force de <X> s'active ! » + « <X> récupère N PV ».
test("§5.14 talent : Régé-Force soigne en fin de tour (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(REGENERATOR_HEAL);
  await scene.endTurn();
  await expect(log(page, /Régé-Force de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /récupère \d+ PV/)).toBeAttached();
});

// Multi-Coups (skill-link) : un move à frappes variables (Balle Graine, 2-5) touche TOUJOURS le max.
// Le récap journal lit « Touché 5 fois ! » indépendamment du seed (le talent court-circuite le tirage).
test("§5.14 talent : Multi-Coups fait toujours toucher le max de coups (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SKILL_LINK_MAX_HITS);
  await scene.castFirstMove(2, 2); // le dummy adjacent au nord
  await expect(log(page, /Touché 5 fois/)).toBeAttached({ timeout: 10_000 });
});

// Querelleur (scrappy) : un coup Normal touche un Spectre normalement immunisé. Le journal affiche
// les dégâts (« <X> perd N PV ») au lieu du blocage « Ça n'affecte pas… ». Garde la régression du fix
// handle-damage (l'efficacité émise passe de 0 à neutre 1, sinon la ligne de dégâts disparaît).
test("§5.14 talent : Querelleur fait toucher un Spectre par un coup Normal (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SCRAPPY_HITS_GHOST);
  await scene.castFirstMove(2, 2); // l'Ectoplasma (Spectre/Poison) adjacent au nord
  await expect(log(page, /perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /n'affecte pas/)).not.toBeAttached();
});
