import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { DAMP_FIZZLES_SELF_DESTRUCT, GLUTTONY_PINCH_BERRY } from "../../fixtures/sandbox-configs";

// Cahier §5.24 — talents soutien & couplage objet (plan 141) pilotés de bout en bout via le journal
// FR. Tous déterministes (aucun override Math.random) : Moiteur fait échouer un move d'explosion 100 %
// piloté par le joueur (pas de jet), Gloutonnerie déclenche une baie de pincement en fin de tour (hook
// inconditionnel). Seed fixe (DUEL) suffit. On assert le SENS (la ligne de journal FR), jamais le pixel.
// Cœur Soin et Garde-Ami exigent un allié : la sandbox est un 1v1 strict (joueur + dummy, pas d'équipe)
// → non pilotables ici, documentés 👁 dans le cahier (sens couvert par talents-soutien.integration.test).
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// Moiteur (damp) : tant qu'un Pokémon vivant porteur est sur le terrain, les moves d'explosion échouent.
// Le joueur Électrode force Destruction (self-destruct, isExplosion) sur le Psykokwak (slot Moiteur)
// adjacent → le move est bloqué AVANT les dégâts et avant l'auto-K.O. : « Moiteur de <X> s'active ! »
// apparaît, « Mais cela échoue (Électrode) ! » apparaît, et le Psykokwak ne perd JAMAIS de PV.
test("§5.24 talent : Moiteur fait échouer Destruction (journal, aucun dégât)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DAMP_FIZZLES_SELF_DESTRUCT);
  await scene.castFirstMove(2, 2); // le Psykokwak adjacent au nord
  await expect(log(page, /Moiteur de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Mais cela échoue/)).toBeAttached();
  // La cible (Psykokwak) ne subit aucun dégât : le move fizzle avant tout calcul (la perte de PV de
  // l'Électrode plus tard dans le tour vient du tour adverse, pas de Destruction — hors du sens testé).
  await expect(log(page, /Psykokwak perd \d+ PV/)).not.toBeAttached();
});

// Gloutonnerie (gluttony) : la baie de pincement se mange à 50 % PV au lieu de 25 %. Le Ronflex porteur,
// à 40 % PV avec une Baie Lichii, n'a aucune cible à frapper : « Attendre » résout la fin de tour, le hook
// baie voit le porteur en pincement (40 % ≤ 50 %) → « Baie Lichii de <X> s'active ! » + « Attaque de <X>
// augmente ! ». Sans le talent, 40 % > 25 % → rien ne se passerait (cf. integration core, témoin négatif).
test("§5.24 talent : Gloutonnerie déclenche la baie de pincement à 50 % PV (journal, Attaque +1)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(GLUTTONY_PINCH_BERRY);
  await scene.endTurn();
  await expect(log(page, /Baie Lichii de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Attaque de .* augmente/)).toBeAttached();
});
