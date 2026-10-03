import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import type { CombatScene } from "../../pages/CombatScene";
import { TileInfoPanel } from "../../pages/combatHud";

// Plan 220 — le malus de déplacement devient un FACTEUR sur le budget du trajet : eau/sable/neige ×¾,
// marais ×½, arrondi en dessous, au moins 1 case, payé une fois par trajet (pire facteur). On assert
// le SENS par les surbrillances de portée (`highlight_move_x_y`, hook scène), jamais le pixel ; les
// tables complètes (mvt 2..7 × facteur, contournement, doublons BFS) restent couvertes en unitaire
// côté core (`terrain-effects.test.ts`, `BattleEngine.terrain-movement.test.ts`).
//
// Tourbière (`swamp.tmj`, 14×14) : terre ferme y=0..2 et 11..13 ; colonne x=4 = marais en y=3..10.
// Arène navale (`naval-arena.tmj`) : sable y=0..2, eau y=3 (x=0,1,4..9), terre ferme en colonnes
// x=2,3 et lignes y=6,7 ; (3,2) est un obstacle.
//
// Mouvements dérivés de la Vitesse de base : Ronflex 30 → 3, Arbok 80 → 4, Alakazam 120 → 5.

const SWAMP_MAP = "assets/maps/swamp.tmj";
const NAVAL_MAP = "assets/maps/naval-arena.tmj";

const sandboxOn = (mapUrl: string, pokemon: string, move: string, x: number, y: number) => ({
  seed: 12345,
  pokemon,
  moves: [move],
  playerPosition: { x, y },
  playerDirection: "south",
  dummyPosition: { x: 13, y: 13 }, // coin opposé, hors de toute portée testée
  mapUrl,
});

/** Ouvre la phase « Déplacement » et rend l'ensemble des cases surlignées, une fois la portée posée. */
async function reachableTiles(page: Page, scene: CombatScene): Promise<Set<string>> {
  await page.getByRole("button", { name: "Déplacement", exact: true }).click();
  await expect
    .poll(async () => (await scene.meshNamesStartingWith("highlight_move_")).length)
    .toBeGreaterThan(0);
  const names = await scene.meshNamesStartingWith("highlight_move_");
  return new Set(names.map((name) => name.replace("highlight_move_", "")));
}

test("plan 220 Tourbière : Alakazam (mvt 5) — marais ×½ → 2 cases dedans, 5 sur la terre ferme", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(sandboxOn(SWAMP_MAP, "alakazam", "confusion", 4, 2));
  const reachable = await reachableTiles(page, scene);

  // Marais : budget floor(5 × ½) = 2 → 2 cases de profondeur, pas 3.
  expect(reachable.has("4_3")).toBe(true);
  expect(reachable.has("4_4")).toBe(true);
  expect(reachable.has("4_5")).toBe(false);
  // Le malus ne touche que le trajet qui entre dans le marais : la terre ferme reste à portée pleine.
  expect(reachable.has("9_2")).toBe(true);
});

test("plan 220 Tourbière : Ronflex (mvt 3) — marais ×½ → plancher 1 case, jamais bloqué", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(sandboxOn(SWAMP_MAP, "snorlax", "tackle", 4, 2));
  const reachable = await reachableTiles(page, scene);

  // floor(3 × ½) = 1 → une case de marais, pas deux.
  expect(reachable.has("4_3")).toBe(true);
  expect(reachable.has("4_4")).toBe(false);
  // Terre ferme : portée pleine (3).
  expect(reachable.has("7_2")).toBe(true);
});

test("plan 220 Tourbière : Arbok (Poison, mvt 4) — immunisé au marais, portée pleine", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(sandboxOn(SWAMP_MAP, "arbok", "poison-sting", 4, 2));
  const reachable = await reachableTiles(page, scene);

  // Immunité Poison : 4 cases de marais en ligne droite (un non-immunisé s'arrêterait à 2).
  expect(reachable.has("4_5")).toBe(true);
  expect(reachable.has("4_6")).toBe(true);
  expect(reachable.has("4_7")).toBe(false);
});

test("plan 220 Arène navale : Alakazam (mvt 5) ne pose pas le pied sur le sable à 4 cases", async ({
  page,
  bootSandbox,
}) => {
  // Depuis (2,6) : le sable (2,2) est à 4 cases. Sable ×¾ → budget floor(5 × ¾) = 3 sur tout le
  // trajet (malus rétroactif) → hors de portée. L'ancien malus additif (+1) l'aurait rendu atteignable.
  const scene = await bootSandbox(sandboxOn(NAVAL_MAP, "alakazam", "confusion", 2, 6));
  const reachable = await reachableTiles(page, scene);

  expect(reachable.has("2_2")).toBe(false);
  // L'eau voisine de la colonne de terre (1,3), à 4 cases aussi, reste hors de portée.
  expect(reachable.has("1_3")).toBe(false);
  // Terre ferme : portée pleine — (2,3) à 3 cases, (7,6) à 5 cases.
  expect(reachable.has("2_3")).toBe(true);
  expect(reachable.has("7_6")).toBe(true);
});

test("plan 220 §4.13 tile-info : une case de marais affiche la pastille de déplacement ×½", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(sandboxOn(SWAMP_MAP, "snorlax", "tackle", 4, 2));
  const tile = new TileInfoPanel(page);

  // Survol continu dans le jeu réel → on re-survole à chaque poll (anti-course avec un re-render).
  await expect
    .poll(
      async () => {
        await scene.hoverTile(4, 4);
        return tile.terrain.textContent();
      },
      { timeout: 10_000 },
    )
    .toBe("Marécage");

  // La puce porte le texte « ×½ » et l'étiquette accessible localisée (plus de « −2 »).
  await expect(tile.panel.getByText("×½", { exact: true })).toBeVisible();
  await expect(tile.panel.getByLabel("Déplacement ×½ si on y entre")).toBeVisible();
  await expect(tile.panel.getByText("−2", { exact: true })).toHaveCount(0);
});
