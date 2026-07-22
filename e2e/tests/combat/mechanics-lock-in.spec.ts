import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  LOCK_IN_OUTRAGE,
  LOCK_IN_PETAL_DANCE,
  LOCK_IN_THRASH,
  LOCK_IN_UPROAR,
} from "../../fixtures/sandbox-configs";

// Cahier §5.40 — Famille Lock-in multi-tours (plan 149). Un move qui VERROUILLE son lanceur plusieurs
// tours (Mania/Danse Fleurs/Colère 2-3 tours + Confusion finale ; Brouhaha 3 tours sans confusion).
// Les unit/integration core couvrent le décompte exact, la confusion finale et l'immunité Terrain
// Brumeux ; ici on prouve deux observables pilotés via le renderer : (1) la ligne de journal FR de
// départ « <X> se déchaîne avec <move> ! » (LockInStarted) ; (2) le VERROUILLAGE — au tour suivant le
// menu d'attaque ne liste plus que le move verrouillé (getLegalActions filtre les autres). On assert
// le SENS (journal + menu), jamais le pixel. Ball'Glace (RolloutStreak, pas un lock-in) et Frénésie
// (`rage`, non implémenté) restent 👁.
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.40 Colère : le lanceur se déchaîne dès le 1ᵉ cast (LockInStarted).
test("§5.40 Colère : le lanceur se déchaîne (journal de départ)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(LOCK_IN_OUTRAGE);
  await scene.castFirstMove(3, 4); // Colère est le 1ᵉ move → sélectionné par castFirstMove
  await expect(log(page, /Florizarre se déchaîne avec Colère/)).toBeAttached({ timeout: 10_000 });
});

// §5.40 Colère : le VERROUILLAGE — après un cast, le mon ne peut plus jouer que Colère. Au tour
// suivant le menu d'attaque ne liste plus qu'UN move (Griffe est filtrée par getLegalActions). Le
// décompte tiré (2 ou 3) laisse toujours ≥1 tour restant après le 1ᵉ cast → verrou robuste au seed.
test("§5.40 Colère : le mon est verrouillé sur ce move au tour suivant", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(LOCK_IN_OUTRAGE);
  await scene.castFirstMove(3, 4); // tour 1 : verrouille
  await scene.endTurn(); // le dummy passif attend → retour au joueur (tour 2)

  // Convention §5.16/§5.31 : un move filtré par getLegalActions reste AFFICHÉ mais désactivé
  // (data-enabled="false"). Le verrou ne laisse que Colère jouable ; Griffe est désactivée.
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  const moveItems = page.getByTestId("move-item");
  await expect(moveItems.filter({ hasText: "Colère" })).toHaveAttribute("data-enabled", "true");
  await expect(moveItems.filter({ hasText: "Griffe" })).toHaveAttribute("data-enabled", "false");
});

// §5.40 Mania : variante 2-3 tours confusion — journal de départ.
test("§5.40 Mania : le lanceur se déchaîne (journal de départ)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(LOCK_IN_THRASH);
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Florizarre se déchaîne avec Mania/)).toBeAttached({ timeout: 10_000 });
});

// §5.40 Danse Fleurs : variante 2-3 tours confusion (portée 1-2) — journal de départ.
test("§5.40 Danse Fleurs : le lanceur se déchaîne (journal de départ)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(LOCK_IN_PETAL_DANCE);
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Florizarre se déchaîne avec Danse Fleurs/)).toBeAttached({
    timeout: 10_000,
  });
});

// §5.40 Brouhaha : verrou 3 tours SANS confusion (cône) — journal de départ.
test("§5.40 Brouhaha : le lanceur se déchaîne (journal de départ)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(LOCK_IN_UPROAR);
  await scene.castFirstMove(3, 4); // cône vers l'est → touche la cible en (3,4)
  await expect(log(page, /Florizarre se déchaîne avec Brouhaha/)).toBeAttached({ timeout: 10_000 });
});
