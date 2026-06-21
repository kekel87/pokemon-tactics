import { expect, test } from "../../fixtures";
import {
  DROUGHT_SETS_SUN,
  IMMUNITY_BLOCKS_POISON,
  RAIN_DISH_HEAL,
} from "../../fixtures/sandbox-configs";
import { WeatherHud } from "../../pages/combatHud";

// Cahier §5.15 — talents Tier B (plan 137) pilotés de bout en bout via le journal/HUD FR. Tous
// déterministes (aucun override Math.random) : Sécheresse pose la météo à l'entrée, Cuvette se
// résout sans jet en fin de tour, Vaccin bloque un move statut 100 % piloté par le joueur → seed fixe
// (DUEL) suffit. On assert le SENS (la ligne de journal / le HUD météo), jamais le pixel.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// Sécheresse (drought) : invoque le Soleil 5 tours à l'entrée. Le porteur (Goupix) déclenche le hook
// `weatherAutoSetter` à la création du combat → le HUD météo affiche « Plein soleil » dès le boot,
// sans aucune action. La config part sans météo explicite, donc le Soleil ne peut venir que du talent.
test("§5.15 talent : Sécheresse invoque le Soleil à l'entrée (HUD météo)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DROUGHT_SETS_SUN);
  const weather = new WeatherHud(page);

  await expect(weather.hud).toBeVisible({ timeout: 10_000 });
  await expect(weather.label).toHaveText("Plein soleil");
});

// Cuvette (rain-dish) : soin passif de fin de tour sous Pluie. Le porteur Carapuce démarre blessé
// (hp 50) sous Pluie → la fin de tour journalise « Cuvette de <X> s'active ! » + « <X> récupère N PV ».
test("§5.15 talent : Cuvette soigne en fin de tour sous Pluie (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(RAIN_DISH_HEAL);
  await scene.endTurn();
  await expect(log(page, /Cuvette de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /récupère \d+ PV/)).toBeAttached();
});

// Vaccin (immunity) : immunité au Poison. Le joueur lance Poudre Toxik (100 % Poison) sur le Ronflex
// adjacent porteur de Vaccin → le statut est bloqué : « Vaccin de Ronflex s'active ! » apparaît et la
// ligne « est empoisonné » n'est JAMAIS journalisée. Garde la régression du blocage `onStatusBlocked`.
test("§5.15 talent : Vaccin bloque le Poison de Poudre Toxik (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(IMMUNITY_BLOCKS_POISON);
  await scene.castFirstMove(2, 2); // le Ronflex adjacent au nord
  await expect(log(page, /Vaccin de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /est empoisonné/)).not.toBeAttached();
});
