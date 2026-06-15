import { expect, test } from "../../fixtures";

// Cahier §8.1 / §8.3 / §8.6 — chaque carte du jeu monte sa scène Babylon sans crash (régression de
// chargement = risque #1 de la migration), avec des tuiles de terrain. Le RENDU exact (couleurs de
// terrain, tileset sans tuile rose, occlusion) reste 👁. On boote chaque carte par config sandbox.
const MAPS = [
  "simple-arena",
  "forest",
  "cramped-cave",
  "desert",
  "swamp",
  "naval-arena",
  "toundra",
  "le-mur",
];

for (const map of MAPS) {
  test(`§8.1 carte « ${map} » monte sa scène avec des tuiles`, async ({ bootSandbox }) => {
    const scene = await bootSandbox({
      pokemon: "venusaur",
      moves: ["tackle"],
      mapUrl: `assets/maps/${map}.tmj`,
    });
    const tiles = (await scene.meshNames()).filter((n) => n.startsWith("tile_")).length;
    expect(tiles).toBeGreaterThan(0);
  });
}

// §8.3 — « Le Mur » est multi-niveaux : plusieurs élévations de tuiles distinctes (falaises/plateaux).
test("§8.3 hauteur : « Le Mur » a des tuiles à plusieurs élévations", async ({ bootSandbox }) => {
  const scene = await bootSandbox({
    pokemon: "venusaur",
    moves: ["tackle"],
    mapUrl: "assets/maps/le-mur.tmj",
  });
  const elevations = await scene.tileElevations();
  expect(elevations.length).toBeGreaterThan(1);
});
