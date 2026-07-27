import { expect, test } from "../../fixtures";
import { TYPE_MANIP_SOAK } from "../../fixtures/sandbox-configs";
import { badgeCountOnHover } from "../../pages/combat-queries";

// Cahier §5.27 — famille Type manip (réécriture du type d'un Pokemon), pilotée à travers le renderer.
// Les unit/integration core couvrent la résolution pure (efficacité/STAB recalculés, fail wholesale,
// historique de move) ; ici on prouve que Détrempage résout via l'orchestrateur ET que les DEUX
// feedbacks observables montent : la ligne de journal FR (`BattleLogFormatter`, event TypeChanged) et
// le badge volatile « Type Eau » de l'InfoPanel (typeOverride → `battle-views`). On assert le SENS
// (ligne de journal / texte du badge), jamais le pixel.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.27 Détrempage : la cible ennemie (Ronflex, Normal) devient Eau pur → ligne de journal FR.
test("§5.27 Détrempage : la cible devient de type Eau (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(TYPE_MANIP_SOAK);
  await scene.castFirstMove(2, 2); // le Ronflex adjacent au nord
  await expect(log(page, /Ronflex devient de type Eau/)).toBeAttached({ timeout: 10_000 });
});

// §5.27 Détrempage : le typeOverride remonte dans l'InfoPanel sous forme de badge volatile « Type Eau »
// (au survol de la case de la cible). Le badge n'a pas de testid propre : il porte un texte
// user-facing (« Type Eau ») → on le localise par texte, scopé à la carte (résilient, role-agnostic).
test("§5.27 Détrempage : l'InfoPanel de la cible affiche le badge « Type Eau »", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(TYPE_MANIP_SOAK);

  await scene.castFirstMove(2, 2);
  await expect(log(page, /Ronflex devient de type Eau/)).toBeAttached({ timeout: 10_000 });

  // Le survol est CONTINU dans le jeu réel (pointermove répété) ; un seul hoverTile peut être écrasé
  // par un re-render du HUD → `badgeCountOnHover` RE-survole à chaque itération du poll, et lit la
  // carte qui montre bien la cible (carte curseur ici — le panneau gauche reste sur l'actif).
  await expect
    .poll(() => badgeCountOnHover(scene, page, { x: 2, y: 2 }, "Ronflex", "Type Eau"), {
      timeout: 10_000,
    })
    .toBe(1);
});
