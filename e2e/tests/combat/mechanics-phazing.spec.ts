import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  PHAZE_CIRCLE_THROW,
  PHAZE_ROAR,
  PHAZE_ROAR_EJECTS,
  PHAZE_WHIRLWIND,
} from "../../fixtures/sandbox-configs";

// Cahier §5.43 — Famille Phazing (Cyclone / Hurlement / Projection). Pas de banc dans ce jeu → le
// switch forcé canon est réinterprété en ÉJECTION vers la zone de spawn (EffectKind.PhazeToSpawn →
// ejectToSpawn, comme Bouton Fuite / Carton Rouge). L'ÉJECTION n'agit QUE si la cible n'est pas déjà
// sur son spawn (`forced-teleport`) : en 1v1 statique la cible reste sur son spawn → un no-op non
// journalisé, et la repositionner hors-spawn dans la portée du lanceur n'est pas gréable de façon
// déterministe dans ce harness (déplacement hot-seat non pilotable via le DOM + zone de contrôle
// bloquant l'adjacence). Le SENS de l'éjection reste couvert par les unit core (`handle-phaze` /
// `forced-teleport`) → 👁 au cahier. On pilote ici le volet observable en 1v1 : Projection inflige
// ses dégâts, Cyclone/Hurlement se lancent et résolvent (MoveStarted). Duel normal, aucun jet →
// déterministe.
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.43 Cyclone : le move se lance et résout (MoveStarted). L'éjection au spawn est un no-op (👁).
test("§5.43 Cyclone : le lanceur souffle la zone (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(PHAZE_WHIRLWIND);
  await scene.castFirstMove(2, 4); // Zone r1 Self → propre case
  await expect(log(page, /Florizarre utilise Cyclone/)).toBeAttached({ timeout: 10_000 });
});

// §5.43 Hurlement : le move se lance et résout (MoveStarted). L'éjection au spawn est un no-op (👁).
test("§5.43 Hurlement : le lanceur crie le cône (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(PHAZE_ROAR);
  await scene.castFirstMove(3, 4); // cône vers l'est → la cible en (3,4)
  await expect(log(page, /Florizarre utilise Hurlement/)).toBeAttached({ timeout: 10_000 });
});

// §5.43 Projection : dégâts observables (l'éjection au spawn est un no-op, 👁).
test("§5.43 Projection : inflige des dégâts à la cible (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(PHAZE_CIRCLE_THROW);
  await scene.castFirstMove(3, 4); // Single r1 → la cible adjacente
  await expect(log(page, /Ronflex perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
});

// §5.43 Hurlement — ÉJECTION FORCÉE observable (débloquée par le harness hot-seat, plan 167). Le no-op
// en 1v1 statique venait de la cible restée sur son spawn ; ici l'Électrode ennemi est PILOTÉ hors de
// son spawn (5,4) → (4,4) avant que Florizarre ne crie le cône, si bien que l'éjection le renvoie sur
// (5,4). Le cône r1-3 atteint (4,4) sans coller le lanceur (Cyclone/Projection r1 seraient bloqués par
// la zone de contrôle). Déterministe : Hurlement statut sans jet, seed fixe.
test("§5.43 Hurlement : renvoie un ennemi hors-spawn sur sa zone de spawn (journal + scène)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(PHAZE_ROAR_EJECTS);

  // Tour 1 (Électrode, le plus rapide → actif au boot, hot-seat) : il quitte son spawn (5,4) → (4,4)
  // (distance 2 du lanceur, hors zone de contrôle) puis termine son tour.
  await scene.moveTo(5, 4, 4, 4);
  await scene.endTurn();

  // Tour de Florizarre (2,4) : Hurlement, cône vers l'est → touche l'Électrode hors-spawn en (4,4).
  await scene.castFirstMove(4, 4);
  await expect(log(page, /Électrode se téléporte/)).toBeAttached({ timeout: 10_000 });

  // L'Électrode a retrouvé sa case de spawn (5,4).
  await expect
    .poll(async () => (await scene.spriteStates()).find((s) => s.pokemonId === "electrode")?.tile, {
      timeout: 10_000,
    })
    .toEqual({ x: 5, y: 4 });
});
