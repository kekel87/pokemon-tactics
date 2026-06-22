import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  SERENE_GRACE_BASELINE_NO_ABILITY,
  SERENE_GRACE_FLIPS_SECONDARY,
  SHEER_FORCE_SUPPRESSES_SECONDARY,
} from "../../fixtures/sandbox-configs";

// Cahier §5.17 — talents attaquant qui manipulent l'effet SECONDAIRE d'un move (plan 139), pilotés de
// bout en bout via le journal FR. Sans Limite est déterministe à tout seed (suppression inconditionnelle) ;
// Sérénité est un modificateur silencieux, donc prouvé par un FLIP au seed fixe 1 (témoin sans talent).
// On assert le SENS (la ligne de journal FR), jamais le pixel.
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// Sans Limite (sheer-force) : un move à effet secondaire perd son secondaire. Le Nidoking lance Bombe
// Beurk (secondaire 30 % poison) sur le dummy → « Sans Limite de <X> s'active ! » et le dummy n'est
// JAMAIS empoisonné (le secondaire est supprimé avant tout tirage). Le ×1.3 puissance reste couvert unit.
test("§5.17 talent : Sans Limite supprime l'effet secondaire et s'annonce (journal, jamais empoisonné)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SHEER_FORCE_SUPPRESSES_SECONDARY);
  await scene.castFirstMove(2, 1); // le dummy à (2,1), dans la portée du Blast
  await expect(log(page, /Sans Limite de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /perd \d+ PV/)).toBeAttached(); // le move inflige bien des dégâts
  await expect(log(page, /est empoisonné/)).not.toBeAttached(); // secondaire supprimé
});

// Sérénité (serene-grace) : double la chance d'un secondaire (30 % poison → 60 %). Au seed 1 le tirage
// échoue à 30 % mais réussit à 60 % → AVEC le talent, le dummy EST empoisonné.
test("§5.17 talent : Sérénité double la chance d'un secondaire (poison posé au seed 1)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SERENE_GRACE_FLIPS_SECONDARY);
  await scene.castFirstMove(2, 1);
  await expect(log(page, /est empoisonné/)).toBeAttached({ timeout: 10_000 });
});

// Témoin du flip : MÊME seed 1, SANS le talent → le secondaire 30 % échoue, le dummy n'est PAS
// empoisonné. Confronté au test ci-dessus, prouve que c'est le DOUBLEMENT (et non le seed) qui pose
// le poison. Le move touche quand même (dégâts) → on vérifie l'absence du seul statut.
test("§5.17 talent : sans Sérénité au même seed, le secondaire 30 % échoue (témoin, pas de poison)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SERENE_GRACE_BASELINE_NO_ABILITY);
  await scene.castFirstMove(2, 1);
  await expect(log(page, /perd \d+ PV/)).toBeAttached({ timeout: 10_000 }); // le move touche bien
  await expect(log(page, /est empoisonné/)).not.toBeAttached(); // mais pas de secondaire
});
