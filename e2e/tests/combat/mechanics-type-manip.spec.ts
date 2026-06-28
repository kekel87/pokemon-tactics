import { expect, test } from "../../fixtures";
import { TYPE_MANIP_SOAK } from "../../fixtures/sandbox-configs";
import { InfoPanel } from "../../pages/combatHud";

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
// user-facing (« Type Eau ») → on le localise par texte, scopé à l'InfoPanel (résilient, role-agnostic).
test("§5.27 Détrempage : l'InfoPanel de la cible affiche le badge « Type Eau »", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(TYPE_MANIP_SOAK);
  const info = new InfoPanel(page);

  await scene.castFirstMove(2, 2);
  await expect(log(page, /Ronflex devient de type Eau/)).toBeAttached({ timeout: 10_000 });

  // Le survol est CONTINU dans le jeu réel (pointermove répété) ; un seul hoverTile peut être écrasé
  // par un re-render du HUD → on RE-survole à chaque itération du poll jusqu'à ce que le panneau
  // reflète la cible piégée + son badge de type (robuste, pas de course).
  const badge = info.panel.getByText("Type Eau", { exact: true });
  await expect
    .poll(
      async () => {
        await scene.hoverTile(2, 2);
        if ((await info.name.textContent()) !== "Ronflex") {
          return 0;
        }
        return badge.count();
      },
      { timeout: 10_000 },
    )
    .toBe(1);
});
