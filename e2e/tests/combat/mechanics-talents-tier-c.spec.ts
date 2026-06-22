import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  AFTERMATH_CONTACT_RECOIL,
  SOLAR_POWER_SUN_BURN,
  SOUNDPROOF_BLOCKS_SOUND,
  WEAK_ARMOR_PHYSICAL_HIT,
} from "../../fixtures/sandbox-configs";

// Cahier §5.16 — talents Tier C (plan 138) pilotés de bout en bout via le journal FR. Tous
// déterministes (aucun override Math.random) : Force Soleil se résout sans jet en fin de tour sous
// Soleil, Anti-Bruit / Boom Final / Armurouillée passent par des moves 100 % précision pilotés par le
// joueur → seed fixe (DUEL) suffit. On assert le SENS (la ligne de journal FR), jamais le pixel.
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// Force Soleil (solar-power) : sous Soleil le porteur perd 1/8 de ses PV max en fin de tour. Le
// Dracaufeu démarre blessé (hp 50) sous Soleil → « Attendre » déclenche la fin de tour qui journalise
// « Force Soleil de <X> s'active ! » + « <X> perd N PV ! ». Pas de cible, pas de jet → déterministe.
test("§5.16 talent : Force Soleil brûle le porteur en fin de tour sous Soleil (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SOLAR_POWER_SUN_BURN);
  await scene.endTurn();
  await expect(log(page, /Force Soleil de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /perd \d+ PV/)).toBeAttached();
});

// Anti-Bruit (soundproof) : immunité aux moves sonores. Le joueur lance Mégaphone (sonore, 100 %) sur
// l'Électrode porteur d'Anti-Bruit → le move est bloqué avant les dégâts : « Anti-Bruit de <X>
// s'active ! » apparaît et l'Électrode ne perd JAMAIS de PV (immunité totale).
test("§5.16 talent : Anti-Bruit bloque un move sonore (journal, aucun dégât)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SOUNDPROOF_BLOCKS_SOUND);
  await scene.castFirstMove(2, 2); // l'Électrode adjacent au nord
  await expect(log(page, /Anti-Bruit de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /perd \d+ PV/)).not.toBeAttached();
});

// Boom Final (aftermath) : K.O. par un move de contact → l'attaquant perd 1/4 de ses PV max. Le joueur
// met K.O. le Smogogo (1 PV) avec Griffe (contact) → le recul touche l'attaquant : « Boom Final de <X>
// s'active ! » + « <le Dracaufeu> perd N PV ! ».
test("§5.16 talent : Boom Final renvoie un recul à l'attaquant après un K.O. au contact (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(AFTERMATH_CONTACT_RECOIL);
  await scene.castFirstMove(2, 2); // le Smogogo adjacent au nord, à 1 PV
  await expect(log(page, /Boom Final de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /^Dracaufeu perd \d+ PV/)).toBeAttached(); // le recul touche l'attaquant
});

// Armurouillée (weak-armor) : touché par un move physique → Défense -1, Vitesse +2. Le joueur frappe
// l'Onix endurant (hp 999, survit) avec Griffe (physique) → le journal lit « Défense de <X> baisse ! »
// ET « Vitesse de <X> augmente ! », en plus de « Armurouillée de <X> s'active ! ».
test("§5.16 talent : Armurouillée baisse la Défense et augmente la Vitesse au contact physique (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(WEAK_ARMOR_PHYSICAL_HIT);
  await scene.castFirstMove(2, 2); // l'Onix adjacent au nord
  await expect(log(page, /Armurouillée de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Défense de .* baisse/)).toBeAttached();
  await expect(log(page, /Vitesse de .* augmente/)).toBeAttached();
});
