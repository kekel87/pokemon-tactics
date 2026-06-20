import { expect, test } from "../../fixtures";
import { DISTORTION_INVERSION } from "../../fixtures/sandbox-configs";

// Cahier §5.21 — Distorsion (trick-room) : zone statique diamant r3 (comme les Champs) qui inverse
// l'ordre du Charge Time des Pokemon situés DANS la zone. On automatise le SENS (zone posée + ordre
// inversé), jamais le pixel : la couleur indigo / la pastille compteur / la preview restent 👁.

const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// Les quads de zone réutilisent le rendu des Champs : `field_terrain_<color>_<x>_<y>`. La couleur
// Distorsion (DISTORTION_ZONE_COLOR = 0x7a5cff = 8019199) est unique → ce préfixe ne capture QUE la
// zone Distorsion, jamais un Champ de terrain (couleurs distinctes).
const DISTORTION_MESH_PREFIX = "field_terrain_8019199_";

test("§5.21 Distorsion : zone posée (journal + scène)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(DISTORTION_INVERSION);

  // Move Self → on cible la tuile du lanceur (2,3), comme les Champs/auras.
  await scene.castFirstMove(2, 3);

  // Journal FR : ligne DistortionPosted « … — Distorsion ! (5 tours) ».
  await expect(log(page, /Distorsion !/)).toBeAttached({ timeout: 10_000 });

  // Scène : la zone indigo peint au moins l'épicentre (et un voisinage). On asserte le SENS (zone
  // présente, ancrée sur le lanceur), pas le décompte exact (le diamant r3 est clippé au bord 6×6).
  await expect
    .poll(
      () =>
        scene
          .meshNames()
          .then((names) => names.filter((n) => n.startsWith(DISTORTION_MESH_PREFIX)).length),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(0);
  expect(await scene.countByName(`${DISTORTION_MESH_PREFIX}2_3`)).toBe(1);
});

test("§5.21 Distorsion : ordre CT inversé dans la timeline (lent avant rapide)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DISTORTION_INVERSION);
  await scene.castFirstMove(2, 3);
  await expect(log(page, /Distorsion !/)).toBeAttached({ timeout: 10_000 });

  // La timeline DOM reflète l'ordre CT prédit (`predictCtTimeline`). Chaque entrée porte un portrait
  // identifié par `data-pokemon-id` (l'espèce ; l'URL est désormais une data URL croppée du sheet,
  // plan 135). Sous Distorsion, le lanceur LENT (Flagadoss, Vit 30 → effective 130) joue AVANT le
  // foe RAPIDE (Électrode, Vit 150 → effective 10) : l'inversion de la vitesse en entrée fait passer
  // le lent devant. Hors zone l'ordre serait l'inverse → l'assertion casse si l'inversion CT régresse.
  const orderOf = (species: string) =>
    page
      .getByTestId("timeline-portrait")
      .evaluateAll(
        (imgs, target) =>
          (imgs as HTMLImageElement[]).findIndex((img) => img.dataset.pokemonId === target),
        species,
      );

  // La timeline se rafraîchit après le cast → on converge vers un état où les deux portraits sont
  // montés ET ordonnés lent-avant-rapide.
  await expect
    .poll(
      async () => {
        const slow = await orderOf("slowbro");
        const fast = await orderOf("electrode");
        return slow >= 0 && fast >= 0 && slow < fast;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
});
