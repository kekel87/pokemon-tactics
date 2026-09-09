import { expect, test } from "../../fixtures";
import {
  DUEL,
  TOOLTIP_DRAIN_MEGA_DRAIN,
  TOOLTIP_FREEZE_DRY_TYPE_OVERRIDE,
  TOOLTIP_RECOIL_MAX_HP,
  TOOLTIP_RECOIL_TAKE_DOWN,
  TOOLTIP_SELF_KO_EXPLOSION,
} from "../../fixtures/sandbox-configs";

// Cahier §4 — HUD DOM de combat.

test("HUD : sous-menu d'attaque — type + nom + PP/puissance par move", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();

  const firstMove = page.getByTestId("move-item").first();
  await expect(firstMove).toBeVisible();
  await expect(firstMove.getByTestId("move-name")).toBeVisible(); // nom FR
  await expect(firstMove.getByTestId("move-type-icon")).toBeVisible(); // icône de type
});

test("HUD : tooltip de move au survol + grille de pattern", async ({ page, bootSandbox }) => {
  await bootSandbox(DUEL);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();

  await page.getByTestId("move-item").first().hover();

  await expect(page.getByTestId("move-tooltip")).toBeVisible();
  await expect(page.getByTestId("move-tooltip-stats")).toBeVisible(); // ligne stats (Puis/Préc)
  await expect(page.getByTestId("move-tooltip-cell").first()).toBeVisible(); // preview pattern
});

// §4.12 — le tag `typeEffectivenessOverride` du tooltip est DÉRIVÉ dynamiquement (i18n + nom de type),
// plus un libellé figé. Lyophilisation (freeze-dry, ×2 vs Eau) doit lire « ×2 sur les types Eau » (FR).
test("HUD : tooltip — tag d'efficacité de type dérivé (Lyophilisation ×2 Eau)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(TOOLTIP_FREEZE_DRY_TYPE_OVERRIDE);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();

  await page.getByTestId("move-item").first().hover();

  const tooltip = page.getByTestId("move-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip.getByText("×2 sur les types Eau", { exact: true })).toBeVisible();
});

// §4.15 (plan 178) — le tooltip nomme désormais le type, chiffre le coût CT et annonce les traits
// mécaniques qui n'apparaissaient nulle part : contrecoup, drain, auto-K.O.

test("HUD : tooltip — type nommé + coût CT chiffré", async ({ page, bootSandbox }) => {
  await bootSandbox(DUEL);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();

  await page.getByTestId("move-item").first().hover();

  const tooltip = page.getByTestId("move-tooltip");
  await expect(tooltip).toBeVisible();
  // Le chip de type est celui de l'InfoPanel (`.type-chip`), coloré par `data-type`.
  await expect(tooltip.locator(".type-chip")).toBeVisible();
  await expect(tooltip.locator(".type-chip")).not.toBeEmpty();
  // Cellule CT = label + chiffre + pastilles de tempo : deux moves à tempo égal restent comparables.
  const ct = tooltip.getByTestId("move-tooltip-ct");
  await expect(ct).toContainText(/CT\s*\d+/);
  await expect(ct.locator(".mt-ct-tempo")).toHaveAttribute("data-tempo", /[1-5]/);
});

test("HUD : tooltip — contrecoup en part des dégâts (Bélier)", async ({ page, bootSandbox }) => {
  await bootSandbox(TOOLTIP_RECOIL_TAKE_DOWN);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();

  await page.getByTestId("move-item").first().hover();

  await expect(page.getByTestId("move-tooltip")).toContainText("Contrecoup : 25 % des dégâts");
});

test("HUD : tooltip — contrecoup en part des PV max (Métalaser)", async ({ page, bootSandbox }) => {
  await bootSandbox(TOOLTIP_RECOIL_MAX_HP);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();

  await page.getByTestId("move-item").first().hover();

  await expect(page.getByTestId("move-tooltip")).toContainText("Contrecoup : 50 % des PV max");
});

test("HUD : tooltip — drain (Méga-Sangsue)", async ({ page, bootSandbox }) => {
  await bootSandbox(TOOLTIP_DRAIN_MEGA_DRAIN);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();

  await page.getByTestId("move-item").first().hover();

  await expect(page.getByTestId("move-tooltip")).toContainText("Soigne 50 % des dégâts");
});

// Remplace une branche morte : le tag d'auto-K.O. était conditionné à un contrecoup `fraction >= 999`
// qu'aucun move ne porte, donc Destruction n'annonçait rien. Il est désormais lu sur `isExplosion`.
test("HUD : tooltip — auto-K.O. annulable par Moiteur (Destruction)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(TOOLTIP_SELF_KO_EXPLOSION);
  await page.getByRole("button", { name: "Attaque", exact: true }).click();

  await page.getByTestId("move-item").first().hover();

  await expect(page.getByTestId("move-tooltip")).toContainText("Le lanceur tombe K.O.");
  await expect(page.getByTestId("move-tooltip")).toContainText("Moiteur");
});

test("HUD : timeline présente avec des entrées", async ({ page, bootSandbox }) => {
  await bootSandbox(DUEL);
  await expect(page.getByTestId("timeline")).toBeVisible();
  await expect(page.getByTestId("timeline-entry").first()).toBeVisible();
});

// §4.11 — le HUD de combat suit `pt-lang` sur le boot direct sandbox (corrigé : `initLanguage()`
// est appelé au boot, plus seulement via le menu). On pré-positionne `pt-lang=en` AVANT la
// navigation (`addInitScript`) → le menu d'action s'affiche en anglais.
test("HUD : combat en anglais quand pt-lang=en (boot sandbox)", async ({ page, bootSandbox }) => {
  await page.addInitScript(() => localStorage.setItem("pt-lang", "en"));
  await bootSandbox(DUEL);

  const menu = page.getByTestId("action-menu");
  for (const label of ["Move", "Attack", "Item", "Wait", "Status"]) {
    await expect(menu.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
});

/*
 * §4.21 (plan 202, Lot B3) — le chronomètre de tour n'existe **qu'en ligne** (décision #946).
 *
 * Son absence en solo n'est pas un bug, c'est le mécanisme : `turnClock` absent de la configuration
 * de l'orchestrateur ⇒ aucun minuteur ne s'arme, et le solo n'a rien à désactiver. La décision #819
 * (« un seul comportement, dès le solo ») porte sur le MENU de combat, qui ne suspend rien même en
 * solo — pas sur un compte à rebours, dont la seule raison d'être est de ne pas faire attendre un
 * pair distant. Le compteur en ligne est couvert par `dom/online-resilience.spec`.
 */
test("HUD : aucun compteur de chrono sur une partie locale", async ({
  page,
  bootSandbox,
  combatMenu,
}) => {
  await bootSandbox(DUEL);

  // Monté mais éteint : c'est la distinction qui compte, `toBeHidden()` seul passerait aussi sur un
  // HUD qui aurait oublié de construire le compteur.
  await expect(page.getByTestId("turn-clock")).toHaveCount(1);
  await expect(page.getByTestId("turn-clock")).toBeHidden();

  // Et le menu ne prévient de rien : aucun temps ne court, donc la pastille serait un mensonge.
  await combatMenu.openByButton();
  await expect(combatMenu.dialog).toBeVisible();
  await expect(combatMenu.clockWarning).toHaveCount(0);
});
