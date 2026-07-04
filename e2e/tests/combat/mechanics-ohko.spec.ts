import { expect, test } from "../../fixtures";
import { OHKO_GUILLOTINE, OHKO_STURDY } from "../../fixtures/sandbox-configs";

// Cahier §5.30 — Famille K.O. en un coup (OHKO, plan 148). 4 moves (Abîme / Guillotine / Empal'Korne /
// Glaciation) : sur touche, dégâts = PV max → K.O. instantané. Précision 30 % plate → `seed: 0` fait
// toucher (déterministe, cf .claude/rules/e2e.md — JAMAIS d'override `Math.random`). On pilote un move
// de bout en bout et on assert la ligne de journal FR (le SENS lisible), pas le pixel : le flottant
// « K.O.! » (couleur), le tag tooltip ☠ et les autres immunités (type/Baie) restent unit/👁.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// KO direct : Guillotine touche le dummy adjacent (1 seul adversaire) → OneHitKo puis fin de combat.
test("§5.30 OHKO : Guillotine met la cible K.O. en un coup (journal + victoire)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(OHKO_GUILLOTINE);

  await scene.castFirstMove(2, 2);

  // Journal FR : OneHitKo « C'est un K.O. direct ! ».
  await expect(log(page, /un K\.O\. direct/)).toBeAttached({ timeout: 10_000 });

  // La cible est bien mise K.O. → seul adversaire → modale de victoire.
  await expect(page.getByRole("dialog").filter({ hasText: /gagne/ })).toBeVisible({
    timeout: 10_000,
  });
});

// Immunité Fermeté : le même coup seedé à toucher laisse le porteur de Fermeté à 1 PV — pas de KO.
test("§5.30 OHKO : Fermeté annule le K.O. en un coup (journal, pas de KO)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(OHKO_STURDY);

  await scene.castFirstMove(2, 2);

  // Journal FR : AbilityActivated « Fermeté de <dummy> s'active ! ».
  await expect(log(page, /Fermeté/)).toBeAttached({ timeout: 10_000 });

  // Aucun K.O. direct et le combat reste ouvert (pas de modale de victoire).
  await expect(log(page, /K\.O\. direct/)).toHaveCount(0);
  await expect(page.getByRole("dialog").filter({ hasText: /gagne/ })).toHaveCount(0);
});
