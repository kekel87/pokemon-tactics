import { expect, test } from "../../fixtures";

// Cahier §5.20 — effets de terrain de fin de tour, pilotés sur la map `sandbox-flat` (tous les
// terrains présents). On place le joueur sur la tuile du terrain voulu, on passe le tour
// (« Attendre » → confirme la direction) et on assert la ligne de journal FR. Le terrain de
// `sandbox-flat` : swamp (2,2)/(2,3), magma (5,2)/(5,3), lava (0,5), eau profonde (5,5).
//
// IMPORTANT : l'immunité de type compte (logique core) — Florizarre (Plante/Poison) est immunisé
// au poison du marécage → on prend un Pokémon au sol non-Poison (Ronflex) pour le marécage.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
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
