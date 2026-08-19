import { expect, test } from "../../fixtures";
import {
  AURA_RING_PERISH,
  AURA_RING_REFLECT,
  AURA_RING_STACK,
  LOCK_IN_UPROAR,
} from "../../fixtures/sandbox-configs";

// Cahier §3.5 / §5.9 — anneaux d'aura au sol (plan 182). Les auras se lisaient par des émoji flottés
// sur chaque tuile du rayon, construits AU SURVOL du lanceur ; ce sont désormais des anneaux
// permanents dessinant le contour de la zone. Un anneau = un mesh GreasedLine nommé
// `aura_ring_<kind>:<idLanceur>` → le hook de scène rend automatisables la présence sans survol,
// l'empilement, le suivi du lanceur et la disparition. Ce que le harnais ne juge PAS et qui reste
// 👁 : épaisseur (1 voxel), teinte par aura, jonctions aux coins de l'escalier, lisibilité de la
// pile à l'œil — et la pastille 🔊 de Brouhaha, rendue par un `hud_text_plane` générique dont le
// hook n'expose pas le glyphe.

// Id d'instance sandbox : `p{équipe}-m{membre}-{espèce}` (SandboxSetup) → le Florizarre joueur de
// tous les duels de ce fichier. C'est la clé qui suffixe le nom de mesh de chaque anneau.
const CASTER = "p1-m0-venusaur";
const ring = (kind: string): string => `aura_ring_${kind}:${CASTER}`;

// Pas d'empilement vertical : `AURA_RING_STACK_PITCH` = 2 voxels (1 de trait + 1 de vide), 1 voxel
// valant 1/24 d'unité monde. Dupliqué ici à dessein : c'est le contrat que le test verrouille.
const STACK_PITCH = 2 / 24;

const POLL = { timeout: 15_000, intervals: [200, 300, 500] };

// §3.5 — l'invariant central du plan : l'anneau est là SANS le moindre survol. Aucun `hoverTile`
// n'est appelé de tout le test, et le groupe de rendu 0 dit qu'un sprite posé dessus l'occulte.
test("§3.5 anneau d'aura : posé au sol dès la pose, sans aucun survol", async ({ bootSandbox }) => {
  const scene = await bootSandbox(AURA_RING_REFLECT);
  // Témoin : aucun anneau avant la pose (le nom porte l'id du lanceur → recherche par préfixe).
  expect(await scene.meshNamesStartingWith("aura_ring_")).toHaveLength(0);

  await scene.castFirstMove(2, 4); // Protection sur sa propre case (aura d'équipe)

  await expect.poll(() => scene.countByName(ring("reflect")), POLL).toBe(1);
  const info = await scene.meshInfo(ring("reflect"));
  expect(info?.isVisible).toBe(true);
  expect(info?.renderingGroupId).toBe(0); // au sol → occultable par les sprites (groupe 2)
});

// §3.5 — empilement : deux auras du même lanceur ont le MÊME centre et le MÊME rayon, donc le même
// contour ; seule la hauteur les distingue. Un mesh par aura (aucune dédup), sur deux plans Y
// séparés d'exactement un pas d'empilement.
test("§3.5 anneau d'aura : deux auras du même lanceur s'empilent sur deux plans Y distincts", async ({
  bootSandbox,
}) => {
  const scene = await bootSandbox(AURA_RING_STACK);

  await scene.castFirstMove(2, 4); // Protection
  await expect.poll(() => scene.countByName(ring("reflect")), POLL).toBe(1);
  await scene.endTurn(); // le dummy passif attend → retour au joueur
  await scene.castMoveNamed("Mur Lumière", 2, 4);
  await expect.poll(() => scene.countByName(ring("light-screen")), POLL).toBe(1);

  // Les deux anneaux coexistent (2 meshes, pas un trait fusionné).
  expect(await scene.countByName(ring("reflect"))).toBe(1);

  // La hauteur est cuite dans les points de la GreasedLine (sa `position` reste à l'origine) → on la
  // lit sur la boîte englobante monde. Même jeu de tuiles pour les deux, donc l'écart de plan Y EST
  // le pas d'empilement.
  const first = await scene.meshBounds(ring("reflect"));
  const second = await scene.meshBounds(ring("light-screen"));
  if (!first || !second) {
    throw new Error("Les deux anneaux devraient être en scène");
  }
  expect(second.min.y - first.min.y).toBeCloseTo(STACK_PITCH, 4);
  // Empilement vertical PUR : le contour ne bouge pas dans le plan du sol.
  expect(second.min.x).toBeCloseTo(first.min.x, 4);
  expect(second.max.z).toBeCloseTo(first.max.z, 4);
});

// §3.5 — l'anneau suit son lanceur : la zone est recalculée depuis sa position VIVANTE. Requiem
// (r2) est la seule aura assez petite pour que son contour ne touche pas les bords d'une carte 6×6 :
// avec r3 la boîte englobante couvre toute la carte et un déplacement d'une case ne changerait rien.
test("§3.5 anneau d'aura : le contour suit le lanceur qui se déplace", async ({ bootSandbox }) => {
  const scene = await bootSandbox(AURA_RING_PERISH);

  await scene.castFirstMove(2, 4); // Requiem (Self) → aura de mort r2 sur le lanceur
  await expect.poll(() => scene.countByName(ring("perish-aura")), POLL).toBe(1);
  const before = await scene.meshBounds(ring("perish-aura"));
  if (!before) {
    throw new Error("L'anneau de Requiem devrait être en scène");
  }

  await scene.endTurn();
  await scene.moveTo(2, 4, 1, 4); // une colonne de moins (rang y=4 : terrain normal, cible en (3,4))

  // Le repère Babylon TRANSPOSE la grille (colonne → world Z, rang → world X) : un déplacement de
  // colonne se lit donc sur Z. Le bord de zone recule d'une tuile pleine, et le rang n'ayant pas
  // changé, l'étendue en X est intacte → le contour a suivi le lanceur, il ne s'est pas redessiné
  // n'importe où.
  await expect
    .poll(async () => (await scene.meshBounds(ring("perish-aura")))?.max.z ?? Number.NaN, POLL)
    .toBeLessThan(before.max.z - 0.5);
  const after = await scene.meshBounds(ring("perish-aura"));
  expect(after?.max.x).toBeCloseTo(before.max.x, 4);
  expect(await scene.countByName(ring("perish-aura"))).toBe(1); // toujours un seul anneau
});

// §3.5 — Requiem ne court-circuite plus le chemin au sol : avant le plan 182 un lanceur Requiem +
// aura d'équipe n'affichait que Requiem au sol. Les deux anneaux coexistent, et ils empilent (les
// auras d'équipe passent devant Requiem, qui n'a pas d'ordre de pose).
test("§3.5 anneau d'aura : Requiem et une aura d'équipe du même lanceur coexistent", async ({
  bootSandbox,
}) => {
  const scene = await bootSandbox(AURA_RING_PERISH);

  await scene.castFirstMove(2, 4); // Requiem
  await expect.poll(() => scene.countByName(ring("perish-aura")), POLL).toBe(1);
  await scene.endTurn();
  await scene.castMoveNamed("Protection", 2, 4);

  await expect.poll(() => scene.countByName(ring("reflect")), POLL).toBe(1);
  expect(await scene.countByName(ring("perish-aura"))).toBe(1);
  const team = await scene.meshBounds(ring("reflect"));
  const perish = await scene.meshBounds(ring("perish-aura"));
  if (!team || !perish) {
    throw new Error("Les deux anneaux devraient être en scène");
  }
  expect(team.min.y).not.toBeCloseTo(perish.min.y, 4); // deux plans Y ≠ → pile lisible
});

// §3.5 / §5.40 — Brouhaha projette une aura anti-sommeil r3 pendant son verrou, qui n'avait AUCUN
// rendu avant le plan 182. La pastille 🔊 de la barre de vie n'est pas asservissable (mesh
// `hud_text_plane` générique) → seul l'anneau est asserté ici, la pastille reste 👁.
test("§3.5 anneau d'aura : Brouhaha dessine son anneau pendant le verrou", async ({
  bootSandbox,
}) => {
  const scene = await bootSandbox(LOCK_IN_UPROAR);

  await scene.castFirstMove(3, 4); // cône vers l'est → verrouille le lanceur sur Brouhaha

  await expect.poll(() => scene.countByName(ring("uproar")), POLL).toBe(1);
});

// §3.5 / §5.9 — disparition à l'expiration : l'aura dure 5 tours de son lanceur, l'anneau ne lui
// survit pas. On enchaîne des tours d'attente (le dummy est passif) jusqu'à la dissipation ; les
// rangs y=4 sont en terrain normal, donc aucun DoT ne peut tuer le lanceur en route (une aura meurt
// avec son lanceur — l'anneau disparaîtrait alors pour la mauvaise raison).
test("§3.5 anneau d'aura : l'anneau disparaît quand l'aura expire", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(AURA_RING_REFLECT);
  await scene.castFirstMove(2, 4);
  await expect.poll(() => scene.countByName(ring("reflect")), POLL).toBe(1);

  for (let round = 0; round < 8; round++) {
    if ((await scene.countByName(ring("reflect"))) === 0) {
      break;
    }
    await scene.endTurn();
  }

  expect(await scene.countByName(ring("reflect"))).toBe(0);
  await expect(
    page
      .getByTestId("battle-log-entry")
      .filter({ hasText: /aura Protection de Florizarre se dissipe/ }),
  ).toBeAttached({ timeout: 10_000 });
});
