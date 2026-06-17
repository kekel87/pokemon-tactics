import { expect, test } from "../../fixtures";

// One boot, all the invariant facts of a freshly-loaded scene — sprites, hover cursor, terrain,
// and the loading overlay's teardown. Folding these into a single sandbox boot (instead of one
// per assertion) is deliberate: they share the same expensive load and never interfere.
test("sandbox boote : sprites occultables, curseur en overlay, terrain, overlay retiré", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox();

  // Player + dummy → 2 billboards, en groupe 2 = occultable par les Pokemon en avant (test-plan §2).
  // Les billboards sont montés au 1er rendu d'état après le signal de scène prête → on poll (sous
  // forte charge parallèle, le montage peut suivre `waitReady` d'un tick).
  await expect.poll(() => scene.countByName("pokemon_plane")).toBe(2);
  const sprite = await scene.meshInfo("pokemon_plane");
  expect(sprite?.renderingGroupId).toBe(2);

  // Curseur de survol : UN seul modèle voxel (`cursor.glb`), pas de variantes cyclables — le
  // compte exact garde contre toute régression réintroduisant plusieurs curseurs. Groupe overlay
  // 3 = jamais occulté. (Aspect voxel opaque + bob = 👁, non exposé par le hook scène.)
  expect(await scene.countByName("hover_cursor")).toBe(1);
  const cursor = await scene.meshInfo("hover_cursor");
  expect(cursor?.renderingGroupId).toBe(3);

  // Terrain : tiles extrudées présentes.
  const tileCount = (await scene.meshNames()).filter((name) => name.startsWith("tile_")).length;
  expect(tileCount).toBeGreaterThan(0);

  // Pas de FOUC : l'overlay de chargement a fini son fade-out et quitté le DOM.
  await expect(page.getByTestId("loading-overlay")).toHaveCount(0);
});

// Le HUD-monde ancré et les couches d'occlusion par Pokemon (test-plan §2, §3.4, §3.6). Mêmes
// invariants, même boot — on assert les COMPTES (2 Pokemon → 2 de chaque) car `meshInfo` ne rend
// que la 1re instance d'un nom partagé (visibilité par-frame non fiable sur un nom dupliqué).
test("sandbox boote : barres PV, ombres, silhouettes (groupes d'occlusion)", async ({
  bootSandbox,
}) => {
  const scene = await bootSandbox();

  // Une barre PV ancrée par Pokemon (§3.4) + une ombre au sol (§3.6) + une silhouette X-ray.
  // Le HUD-monde (barres PV) est monté par le 1er rendu d'état APRÈS le signal de scène prête
  // (comme l'icône de statut) → on poll sa convergence plutôt que d'asserter dans la foulée.
  await expect.poll(() => scene.countByName("hud_hp_bar_plane")).toBe(2);
  expect(await scene.countByName("pokemon_shadow")).toBe(2);
  expect(await scene.countByName("pokemon_silhouette")).toBe(2);

  // Silhouette = groupe 1 (visible à travers la roche, sous les sprites) ; ombre = groupe 0
  // (terrain). Ces noms sont propres au 1er rendu mais le groupe est identique sur les 2 instances.
  expect((await scene.meshInfo("pokemon_silhouette"))?.renderingGroupId).toBe(1);
  expect((await scene.meshInfo("pokemon_shadow"))?.renderingGroupId).toBe(0);
});

// Les tiles sont nommées par coordonnée (`tile_x_y`) et vivent en groupe 0 (terrain, sous tout le
// reste) — c'est ce nommage qui rend le pilotage par tuile (clickTile) et ces asserts possibles.
test("sandbox boote : tiles nommées par coordonnée en groupe terrain + décorations", async ({
  bootSandbox,
}) => {
  const scene = await bootSandbox();

  // La tile occupée par le dummy (2,2) existe et est en groupe terrain (0).
  const tile = await scene.meshInfo("tile_2_2");
  expect(tile).not.toBeNull();
  expect(tile?.renderingGroupId).toBe(0);

  // Décor « herbe haute » : présent et en groupe 2 (sprite, occultable — test-plan §2), pas en
  // groupe terrain. On vérifie qu'au moins une tuile d'herbe est montée par la map sandbox.
  const decorations = (await scene.meshNames()).filter((name) =>
    name.startsWith("decoration_plane_tall_grass"),
  );
  expect(decorations.length).toBeGreaterThan(0);
  expect((await scene.meshInfo(decorations[0]))?.renderingGroupId).toBe(2);
});
