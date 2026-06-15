import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Cahier §5.18 / §5.19 — chute mortelle par repoussé + immunité Volant, pilotées sur les maps de
// chute dédiées (`sandbox-fall-*`) et la flat (terrains). Interactions à travers le renderer.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.18 — chute mortelle : sur `sandbox-fall-4` (moitié gauche hauteur 5, droite hauteur 1), un
// repoussé pousse la cible par-dessus la falaise (descente 4 niveaux → 100% PV → K.O.). Ronflex
// (gros PV) survit au coup de Draco-Queue (~32) → c'est bien la CHUTE qui le met K.O.
test("§5.18 chute mortelle : repoussé par-dessus une falaise de 4 niveaux → K.O.", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({
    ...DUEL,
    seed: 7, // graine où Draco-Queue (90% préc.) touche → le repoussé a lieu
    moves: ["dragon-tail"],
    playerPosition: { x: 1, y: 2 },
    playerDirection: "east",
    dummyPosition: { x: 2, y: 2 }, // au bord du plateau, poussé vers (3,2) en contrebas
    dummyPokemon: "snorlax",
    mapUrl: "assets/maps/dev/sandbox-fall-4.tmj",
  });
  await scene.castFirstMove(2, 2);
  await expect(log(page, /est repoussé/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /est K\.O\./)).toBeAttached();
});

// §5.19 — traversée Spectre : sur `sandbox-ghost-pocket` (poche normale (4,2) scellée par un mur
// d'obstacle), un Spectre (Ectoplasma) traverse le mur et peut atteindre la poche ; un Pokémon au
// sol (Florizarre) ne le peut pas. On compare les tuiles de déplacement surlignées
// (`highlight_move_4_2`). Prouve `canTraverse(isGhost && toTerrain===Obstacle)`.
test("§5.19 Spectre : traverse un mur d'obstacle pour atteindre une poche fermée", async ({
  page,
  bootSandbox,
}) => {
  const pocketReachable = async (pokemon: string): Promise<boolean> => {
    const scene = await bootSandbox({
      ...DUEL,
      pokemon,
      playerPosition: { x: 2, y: 2 },
      dummyPosition: { x: 4, y: 4 },
      dummyPokemon: "snorlax",
      mapUrl: "assets/maps/dev/sandbox-ghost-pocket.tmj",
    });
    await page.getByRole("button", { name: "Deplacement", exact: true }).click();
    await expect
      .poll(async () => (await scene.meshNames()).some((n) => n.startsWith("highlight_move_")))
      .toBe(true);
    return (await scene.meshNames()).includes("highlight_move_4_2");
  };

  // Spectre → poche atteignable (traverse le mur) ; Pokémon au sol → non.
  expect(await pocketReachable("gengar")).toBe(true);
  expect(await pocketReachable("venusaur")).toBe(false);
});

// §5.19 — immunité Volant : Dracaufeu (Feu/Vol) posé sur le marais ne subit PAS le poison de fin de
// tour (immunité terrain). On assert l'ABSENCE de la ligne « marécage » après un tour.
test("§5.19 Volant : immunisé au poison du marais (aucun effet de terrain)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({
    ...DUEL,
    pokemon: "charizard",
    playerPosition: { x: 2, y: 2 }, // tuile marais sur sandbox-flat
    dummyPosition: { x: 0, y: 1 }, // dummy sur terrain normal (hors hasard)
  });
  await scene.endTurn();
  // Le tour est passé (le dummy a joué) mais aucun empoisonnement de marais sur le Volant.
  await expect(log(page, /Tour de/).first()).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /marécage/)).toHaveCount(0);
});
