import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { SLEEP_POWDER_GRASS_IMMUNE, SLEEP_POWDER_HITS } from "../../fixtures/sandbox-configs";

// Cahier §5.3 / §5.5 — immunité poudre du type Plante (canon Gen 6+), pilotée de bout en bout à
// travers le renderer + journal FR. Le SENS numérique (blocage statut ET stat, event StatusImmune)
// est couvert unit core (`battle/moves/sleep-powder.test.ts`, `effect-processor`) ; ici on prouve que
// l'orchestrateur bloque bien un move Poudre (Poudre Dodo) sur une cible Plante, avec le contraste
// d'une cible non-Plante endormie. Statut sans jet côté immunité → déterministe quel que soit le seed.
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.3 — IMMUNITÉ : Florizarre (Plante/Poison) touché par Poudre Dodo n'est PAS endormi. Le move
// s'annonce, l'immunité de type émet « Ça n'affecte pas Florizarre… » et AUCUN « s'est endormi ».
test("§5.3 immunité poudre : un Florizarre (Plante) ignore Poudre Dodo (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SLEEP_POWDER_GRASS_IMMUNE);
  await scene.castFirstMove(2, 4); // Zone r1 auto-centrée sur le lanceur, cible Plante adjacente
  await expect(log(page, /Ça n'affecte pas Florizarre/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /s'est endormi/)).toHaveCount(0);
});

// §5.3 — CONTRÔLE : Salamèche (Feu, non-Plante) DANS la même zone est bien endormi → prouve que c'est
// le type Plante qui bloque, pas la portée. AUCUNE ligne d'immunité ne doit apparaître.
test("§5.3 immunité poudre : une cible Salamèche (non-Plante) est endormie par Poudre Dodo (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SLEEP_POWDER_HITS);
  await scene.castFirstMove(2, 4);
  await expect(log(page, /s'est endormi/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Ça n'affecte pas/)).toHaveCount(0);
});
