import { expect, test } from "../../fixtures";
import {
  PRIORITY_BEAK_BURN,
  PRIORITY_FAKE_OUT,
  PRIORITY_FIRST_IMPRESSION,
  PRIORITY_FOCUS_CHARGE,
  PRIORITY_FOCUS_INTERRUPT,
  PRIORITY_SHELL_ARMED,
  PRIORITY_SUCKER_FIZZLE,
  PRIORITY_SUCKER_HIT,
} from "../../fixtures/sandbox-configs";

// Cahier §5.31 — Famille Priorité / timing conditionnel (plan 150). Six moves dont l'identité repose
// sur le TIMING (1ʳᵉ action du combat, fraîcheur de la dernière action de la cible, charge
// interruptible), pas sur une priorité canon (inexistante ici — le CT ordonne). On pilote chaque move
// de bout en bout et on assert la ligne de journal FR (le SENS lisible), pas le pixel : l'indicateur
// ⚡ de charge et le flottant de statut restent 👁 (couverts §5.11 / unit).
//
// Deux réalités du moteur imposent le pilotage :
//  1. Spawns par défaut à 3 cases (joueur (2,4) / dummy (2,1)) → chaque scénario approche d'abord le
//     joueur en (1,1), adjacent au dummy (la case (2,2) devant le dummy est bloquée par la zone de
//     contrôle, mais (1,1) est franchissable ; les attaques Single 1-1 sont omnidirectionnelles).
//  2. Une action (attaque OU charge) NE termine PAS le tour : le mon reste actif (attaque-puis-
//     déplacement possible). Il faut donc `endTurn()` explicitement pour passer au tour suivant. Les
//     moves de charge lourds (Mitra-Poing/Bec-Canon/Carapiège, BP 120-150) rejouent TARD (coût CT
//     élevé) → le dummy agit forcément DANS la fenêtre de charge. Déterministe (moves 100 % précision,
//     aucun override `Math.random`).
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// Déplace le joueur de son spawn (2,4) vers (1,1), adjacent au dummy (2,1). Le pas n'ouvre PAS
// l'horloge d'action (lastActedAtAction n'est stampé qu'à la FIN du tour), donc un move firstActionOnly
// lancé juste après reste bien « 1ʳᵉ action ». Attend le bouton d'annulation qui confirme le
// déplacement (un clic manqué casserait le cast/tour suivant).
async function approachDummy(
  scene: import("../../pages/CombatScene").CombatScene,
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.getByRole("button", { name: "Deplacement", exact: true }).click();
  await scene.clickTile(1, 1);
  await expect(page.getByRole("button", { name: "Annuler deplacement", exact: true })).toBeVisible({
    timeout: 10_000,
  });
}

// §5.31 Bluff — 1ʳᵉ action du combat : dégâts + apeurement 100 %. Le joueur rejoue vite (tempo léger),
// donc il faut lui faire terminer son tour (endTurn) pour que le dummy apeuré prenne SON tour → le
// moteur émet alors Flinched (« … est apeuré et ne peut pas agir ! »).
test("§5.31 Bluff : frappe et apeure la cible à la 1re action (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(PRIORITY_FAKE_OUT);

  await approachDummy(scene, page);
  await scene.castFirstMove(2, 1);
  await expect(log(page, /perd \d+ PV/)).toBeAttached({ timeout: 10_000 });

  await scene.endTurn();
  await expect(log(page, /est apeuré et ne peut pas agir/)).toBeAttached({ timeout: 10_000 });
});

// §5.31 Bluff — firstActionOnly : une fois le tour 1 terminé, Bluff n'est plus jouable. Au tour 2 il
// reste AFFICHÉ au menu d'attaque mais désactivé (`data-enabled="false"`, comme un move sans cible
// légale), tandis que Griffe reste sélectionnable (`data-enabled="true"`). Convention §5.16 / §5.29.
test("§5.31 Bluff : désactivé au menu d'attaque au 2e tour (firstActionOnly)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(PRIORITY_FAKE_OUT);

  await approachDummy(scene, page);
  await scene.castFirstMove(2, 1);
  await scene.endTurn(); // fin du tour 1 → le dummy joue → retour au joueur (tour 2)

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  const moveItems = page.getByTestId("move-item");
  await expect(moveItems.filter({ hasText: "Griffe" })).toHaveAttribute("data-enabled", "true");
  await expect(moveItems.filter({ hasText: "Bluff" })).toHaveAttribute("data-enabled", "false");
});

// §5.31 Escarmouche — variante flinchless du verrou « 1ʳᵉ action » : ouverture puissante (dégâts, pas
// d'apeurement) puis filtrée du menu au tour 2 (comme Bluff), Griffe restant jouable.
test("§5.31 Escarmouche : ouverture puissante puis désactivée au 2e tour", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(PRIORITY_FIRST_IMPRESSION);

  await approachDummy(scene, page);
  await scene.castFirstMove(2, 1);
  await expect(log(page, /perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await scene.endTurn(); // fin du tour 1 → le dummy joue → retour au joueur (tour 2)

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  const moveItems = page.getByTestId("move-item");
  await expect(moveItems.filter({ hasText: "Griffe" })).toHaveAttribute("data-enabled", "true");
  await expect(moveItems.filter({ hasText: "Escarmouche" })).toHaveAttribute(
    "data-enabled",
    "false",
  );
});

// §5.31 Coup Bas — RÉUSSITE : la dernière action de la cible était offensive. Persian temporise, le
// dummy (hot-seat) attaque avec Charge (offensive), puis Coup Bas touche (fraîcheur satisfaite).
test("§5.31 Coup Bas : touche si la dernière action de la cible était offensive", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(PRIORITY_SUCKER_HIT);

  // Tour 1 (Persian, rapide) : s'approche puis TEMPORISE pour laisser le dummy agir.
  await approachDummy(scene, page);
  await scene.endTurn();

  // Tour du dummy (hot-seat) : il attaque le joueur avec Charge → sa dernière action est offensive.
  await scene.castFirstMove(1, 1);
  await expect(log(page, /Persian perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await scene.endTurn(); // fin du tour du dummy → retour à Persian (tour 2)

  // Tour 2 (Persian) : Coup Bas → la cible est agressive → le coup TOUCHE (Ronflex perd des PV).
  await scene.castFirstMove(2, 1);
  await expect(log(page, /Ronflex perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Mais cela échoue/)).toHaveCount(0);
});

// §5.31 Coup Bas — ÉCHEC : la cible n'a pas (encore) attaqué → Coup Bas fizzle (« Mais cela échoue »,
// 0 dégât). Persian agit en 1er et lance Coup Bas avant que le dummy inerte ait agi. L'anti-collant
// « a attaqué PUIS temporisé » (fraîcheur fine) est couvert unit/integration core, non dupliqué ici.
test("§5.31 Coup Bas : échoue si la cible n'a pas attaqué (Mais cela échoue)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(PRIORITY_SUCKER_FIZZLE);

  await approachDummy(scene, page);
  await scene.castFirstMove(2, 1);

  await expect(log(page, /Mais cela échoue/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Ronflex perd \d+ PV/)).toHaveCount(0);
});

// §5.31 Mitra-Poing — CHARGE : le tour 1 concentre l'énergie (journal MoveCharging). L'indicateur ⚡
// reste 👁 (couvert §5.11).
test("§5.31 Mitra-Poing : charge au tour 1 (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(PRIORITY_FOCUS_CHARGE);

  await approachDummy(scene, page);
  await scene.castFirstMove(2, 1);

  await expect(log(page, /concentre son énergie pour Mitra-Poing/)).toBeAttached({
    timeout: 10_000,
  });
});

// §5.31 Mitra-Poing — INTERRUPTION : frappé pendant la charge, la concentration se brise (tour de
// charge de la victime → FocusInterrupted) et la frappe échoue au tour 2 (MoveFailed reason focus).
// Le tempo lourd de Mitra-Poing fait rejouer le lanceur tard : on avance les tours du dummy (qui
// temporise) jusqu'à ce que le lanceur reprenne la main pour sa frappe T2.
test("§5.31 Mitra-Poing : interrompu si frappé pendant la charge → échec au tour 2", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(PRIORITY_FOCUS_INTERRUPT);

  // Tour 1 (Alakazam) : s'approche puis charge Mitra-Poing, puis termine son tour de charge.
  await approachDummy(scene, page);
  await scene.castFirstMove(2, 1);
  await expect(log(page, /concentre son énergie pour Mitra-Poing/)).toBeAttached({
    timeout: 10_000,
  });
  await scene.endTurn();

  // Tour du dummy (hot-seat) : il frappe le chargeur avec Charge → concentration brisée.
  await scene.castFirstMove(1, 1);
  await expect(log(page, /est frappé pendant sa concentration/)).toBeAttached({ timeout: 10_000 });
  await scene.endTurn();

  // Le dummy peut temporiser un tour de plus avant qu'Alakazam ne reprenne la main : on avance
  // jusqu'à son tour (borné pour ne jamais boucler).
  for (let attempt = 0; attempt < 8; attempt++) {
    const active =
      (await page
        .getByTestId("info-panel-name")
        .textContent()
        .catch(() => "")) ?? "";
    if (active.includes("Alakazam")) {
      break;
    }
    await scene.endTurn();
  }

  // Tour 2 (Alakazam) : la frappe chargée échoue.
  await scene.castFirstMove(2, 1);
  await expect(log(page, /perd sa concentration/)).toBeAttached({ timeout: 10_000 });
});

// §5.31 Bec-Canon — brûle l'attaquant au contact pendant la charge (BeakBlastBurn). La charge n'est
// PAS interrompue (Bec-Canon frappe quand même au tour 2, non asserté ici). Bec-Canon a 0 learner
// Gen 1 → injouable en team builder ; on le pilote via le mode sandbox (moves arbitraires).
test("§5.31 Bec-Canon : brûle l'attaquant au contact pendant la charge", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(PRIORITY_BEAK_BURN);

  await approachDummy(scene, page);
  await scene.castFirstMove(2, 1); // charge Bec-Canon
  await expect(log(page, /concentre son énergie pour Bec-Canon/)).toBeAttached({ timeout: 10_000 });
  await scene.endTurn();

  await scene.castFirstMove(1, 1); // dummy Charge (contact) → se brûle sur le bec
  await expect(log(page, /Ronflex se brûle sur le bec brûlant/)).toBeAttached({ timeout: 10_000 });
});

// §5.31 Carapiège — s'arme seulement si frappé par un move PHYSIQUE pendant la charge (ShellTrapArmed).
// Carapiège a 0 learner Gen 1 → injouable en team builder ; piloté via le mode sandbox. La frappe T2
// armée + l'échec « piège non déclenché » (frappé spécialement / pas frappé) sont couverts unit core.
test("§5.31 Carapiège : s'arme si frappé par un move physique pendant la charge", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(PRIORITY_SHELL_ARMED);

  await approachDummy(scene, page);
  await scene.castFirstMove(1, 1); // Zone r1 centrée lanceur → charge (confirme sur sa propre case)
  await expect(log(page, /concentre son énergie pour Carapiège/)).toBeAttached({ timeout: 10_000 });
  await scene.endTurn();

  await scene.castFirstMove(1, 1); // dummy Charge (physique) → arme le piège
  await expect(log(page, /piège de Dracaufeu s'arme/)).toBeAttached({ timeout: 10_000 });
});
