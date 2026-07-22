import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  SELF_KO_DESTINY_BOND,
  SELF_KO_EXPLOSION,
  SELF_KO_FINAL_GAMBIT,
  SELF_KO_GRUDGE,
  SELF_KO_MEMENTO,
  SELF_KO_SELF_DESTRUCT,
} from "../../fixtures/sandbox-configs";

// Cahier §5.44 — Famille Sacrifice / Self-KO (plan 147). Le lanceur meurt en échange d'un effet. En
// 1v1 le lanceur est l'unique mon du joueur → son self-K.O. clôt le combat (modale), mais les lignes
// de journal de la résolution sont émises AVANT et persistent → assertables. Les unit/integration core
// couvrent les valeurs (dégâts, baisses de stats) et les déclenchements différés (Lien du Destin /
// Rancune) ; ici on prouve que chaque move résout via l'orchestrateur ET émet ses lignes de journal
// FR. On assert le SENS (les lignes de journal), jamais le pixel. Le lanceur agit au TOUR 1 (aucune
// fin de tour préalable). Portée fixe → déterministe. Vœu Soin est déjà couvert §5.38 (non dupliqué).
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.44 Destruction : Zone r2 Self, dégâts AoE + auto-K.O. du lanceur.
test("§5.44 Destruction : blesse la cible et met le lanceur K.O. (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SELF_KO_SELF_DESTRUCT);
  await scene.castFirstMove(2, 4); // Zone Self → propre case ; la cible adjacente est dans le rayon
  await expect(log(page, /Ronflex perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Florizarre est K\.O\./)).toBeAttached();
});

// §5.44 Explosion : variante ×forte de Destruction (même modèle self-K.O. AoE).
test("§5.44 Explosion : blesse la cible et met le lanceur K.O. (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SELF_KO_EXPLOSION);
  await scene.castFirstMove(2, 4);
  await expect(log(page, /Ronflex perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Florizarre est K\.O\./)).toBeAttached();
});

// §5.44 Souvenir : auto-K.O. + baisse Atq/Atq. Spé. de la cible de 2.
test("§5.44 Souvenir : baisse l'Attaque de la cible et met le lanceur K.O. (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SELF_KO_MEMENTO);
  await scene.castFirstMove(3, 4); // Single r3 → la cible adjacente
  await expect(log(page, /Attaque de Ronflex baisse/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Florizarre est K\.O\./)).toBeAttached();
});

// §5.44 Tout ou Rien : dégâts fixes = PV du lanceur (typés Combat) + auto-K.O. sur touche.
test("§5.44 Tout ou Rien : joue le tout pour le tout et blesse la cible (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SELF_KO_FINAL_GAMBIT);
  await scene.castFirstMove(3, 4); // Single r1 → la cible adjacente
  await expect(log(page, /Florizarre joue le tout pour le tout/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Ronflex perd \d+ PV/)).toBeAttached();
});

// §5.44 Lien du Destin : pose le volatile (le déclenchement « tueur entraîné » reste 👁).
test("§5.44 Lien du Destin : le lanceur tisse un lien du destin (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SELF_KO_DESTINY_BOND);
  await scene.castFirstMove(2, 4); // Self → propre case
  await expect(log(page, /Florizarre tisse un lien du destin/)).toBeAttached({ timeout: 10_000 });
});

// §5.44 Rancune : pose le volatile (le déclenchement « move scellé » reste 👁).
test("§5.44 Rancune : le lanceur nourrit une rancune (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(SELF_KO_GRUDGE);
  await scene.castFirstMove(2, 4); // Self → propre case
  await expect(log(page, /Florizarre nourrit une rancune/)).toBeAttached({ timeout: 10_000 });
});
