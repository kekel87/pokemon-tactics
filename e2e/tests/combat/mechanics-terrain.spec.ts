import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  MAGMA_DOT,
  TERRAIN_POWER_BONUS_BASELINE,
  TERRAIN_POWER_BONUS_MAGMA,
} from "../../fixtures/sandbox-configs";
import { readHp } from "../../pages/combat-queries";

// Cahier §5.20 — effets de terrain de fin de tour, pilotés sur la map `sandbox-flat` (tous les
// terrains présents). On place le joueur sur la tuile du terrain voulu, on passe le tour
// (« Attendre » → confirme la direction) et on assert la ligne de journal FR. Le terrain de
// `sandbox-flat` : swamp (2,2)/(2,3), magma (5,2)/(5,3), lava (0,5), eau profonde (5,5).
//
// IMPORTANT : l'immunité de type compte (logique core) — Florizarre (Plante/Poison) est immunisé
// au poison du marécage → on prend un Pokémon au sol non-Poison (Ronflex) pour le marécage.
//
// Les dégâts de terrain (DoT, bonus de puissance) ne sont PAS journalisés → on les lit par les PV
// (barre de vie InfoPanel `role="progressbar"` → `aria-valuenow`).

const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

const baseAt = (pokemon: string, x: number, y: number) => ({
  seed: 7,
  pokemon,
  moves: ["tackle"],
  playerPosition: { x, y },
  playerDirection: "north",
  dummyPosition: { x: 0, y: 1 }, // terrain normal, hors hasard
  dummyPokemon: "charizard",
});

test("§5.20 Magma : brûle le Pokémon au sol en fin de tour", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(baseAt("venusaur", 5, 2));
  await scene.endTurn();
  await expect(log(page, /brûlé par le magma/)).toBeAttached({ timeout: 10_000 });
});

test("§5.20 Marais : empoisonne le Pokémon au sol (non-Poison) en fin de tour", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(baseAt("snorlax", 2, 2));
  await scene.endTurn();
  await expect(log(page, /marécage/)).toBeAttached({ timeout: 10_000 });
});

test("§5.20 terrain létal : la lave met K.O. le Pokémon au sol", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(baseAt("venusaur", 0, 5)); // lave (0,5)
  await scene.endTurn();
  await expect(log(page, /K\.O\./)).toBeAttached({ timeout: 10_000 });
});

// §5.20 DoT Magma 1/16 en fin de tour. Le sujet (Ronflex) est sur le magma, en hot-seat, pour n'isoler
// qu'UN tick : on passe le tour du joueur puis celui du dummy (qui applique le DoT), et on relit ses PV
// AVANT que sa brûlure fraîchement posée ne tique → perte = floor(maxHp/16).
test("§5.20 Magma : retire 1/16 des PV max en fin de tour (DoT)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(MAGMA_DOT);
  const before = await readHp(scene, page, 5, 2, "Ronflex");
  await scene.endTurn(); // tour du joueur (hors terrain)
  await scene.endTurn(); // tour du dummy sur magma → applique le tick de terrain
  const after = await readHp(scene, page, 5, 2, "Ronflex");
  expect(after.now).toBe(before.now - Math.floor(before.max / 16));
});

// §5.20 bonus de puissance ×1.15 : un move du type du terrain sous le lanceur retire plus de PV. Même
// Poing Feu/seed/cible, seul le terrain du lanceur change (magma vs normal).
test("§5.20 bonus de terrain : un move Feu depuis le magma retire plus de PV (×1.15)", async ({
  page,
  bootSandbox,
}) => {
  const onMagma = await bootSandbox(TERRAIN_POWER_BONUS_MAGMA);
  await onMagma.castFirstMove(5, 3);
  const boosted = await readHp(onMagma, page, 5, 3, "Ronflex");

  const onNormal = await bootSandbox(TERRAIN_POWER_BONUS_BASELINE);
  await onNormal.castFirstMove(0, 1);
  const baseline = await readHp(onNormal, page, 0, 1, "Ronflex");

  expect(boosted.max - boosted.now).toBeGreaterThan(baseline.max - baseline.now);
});
