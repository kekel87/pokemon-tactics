import { expect, test } from "../../fixtures";
import {
  DUEL,
  TILE_INFO_MAGMA,
  TILE_INFO_NEUTRAL,
  TILE_INFO_POPULATED,
} from "../../fixtures/sandbox-configs";
import { TileInfoPanel } from "../../pages/combatHud";

// Cahier §4.13 (panneau d'info de case, plan 177) — le second panneau chrome, à droite de l'InfoPanel
// Pokemon, décrit le terrain + les modificateurs de la case sous le curseur (défaut = case du Pokemon
// actif). DOM pur (view-model découplé du core) + hook `hoverTile` pour le survol : on assert le SENS
// (nom FR du terrain, sprites d'effet, textes des puces), jamais le pixel. Déterministe (aucun jet, la
// lecture de terrain n'en tire aucun).

test("§4.13 tile-info : terrain Neutre (défaut = case du Pokemon actif) + altitude", async ({
  page,
  bootSandbox,
}) => {
  // Le joueur Florizarre est posé sur une tuile normale (0,0) → au boot le panneau (défaut = case de
  // l'actif) montre le terrain neutre, sans aucune puce d'effet.
  await bootSandbox(TILE_INFO_NEUTRAL);
  const tile = new TileInfoPanel(page);

  await expect(tile.panel).toBeVisible();
  // Terrain « normal » → libellé FR officiel « Neutre » (jamais l'ID anglais).
  await expect(tile.terrain).toHaveText("Neutre");
  // Altitude : un nombre, rendu à côté du glyphe placeholder ⛰ ; sur une case neutre (aucune puce) la
  // seule zone purement numérique du panneau est ce compteur de hauteur.
  await expect(tile.panel.getByText(/^\d+$/)).toBeVisible();
  // Terrain neutre → aucune puce d'effet.
  await expect(tile.lines).toHaveCount(0);
});

test("§4.13 tile-info : Magma — statut Brûlé + bonus Feu ×1.15 + immunité (Feu/Vol)", async ({
  page,
  bootSandbox,
}) => {
  // Joueur posé sur le magma (5,2) → panneau par défaut = cette case.
  await bootSandbox(TILE_INFO_MAGMA);
  const tile = new TileInfoPanel(page);

  await expect(tile.terrain).toHaveText("Magma");
  // Statut à l'arrêt : le vrai sprite « Brûlé » (assets/ui/statuses/icon-burned.png).
  await expect(tile.icon("statuses/icon-burned")).toBeVisible();
  // Bonus de type : le sprite Feu (assets/ui/types/fire.png) + le multiplicateur ×1.15. Le sprite Feu
  // apparaît aussi dans la ligne d'immunité → on cible la 1ʳᵉ occurrence.
  await expect(tile.icon("types/fire").first()).toBeVisible();
  await expect(tile.panel.getByText("×1.15")).toBeVisible();
  // Immunité : les types épargnés (Feu + Vol) ; le sprite Vol (types/flying.png) n'existe QUE là.
  await expect(tile.icon("types/flying")).toBeVisible();
});

test("§4.13 tile-info : case peuplée — hazards (Picots ×3 / Piège de Roc) + champ + zones à durée", async ({
  page,
  bootSandbox,
}) => {
  // Seed test-only `debugTiles` (schéma v2 `teams`) : hazards + champ + zones empilés sur (5,2) où le
  // joueur est posé → le panneau par défaut affiche toutes les puces stackées.
  await bootSandbox(TILE_INFO_POPULATED);
  const tile = new TileInfoPanel(page);

  await expect(tile.terrain).toHaveText("Magma");
  // Hazards : Picots empilables → « Picots ×3 » ; Piège de Roc mono-couche → nom seul (sans ×N).
  await expect(tile.panel.getByText("Picots ×3")).toBeVisible();
  await expect(tile.panel.getByText("Piège de Roc")).toBeVisible();
  // Champ + zones globales : chacun sur sa ligne, précédé d'un badge de durée [5] (remainingTurns).
  await expect(tile.line("Champ Herbu")).toContainText("5");
  await expect(tile.line("Gravité")).toContainText("5");
  await expect(tile.line("Distorsion")).toContainText("5");
});

test("§4.13 tile-info : Lave (survol) — ligne traversal fusionnée (infranchissable + chute fatale)", async ({
  page,
  bootSandbox,
}) => {
  // La lave (0,5) est infranchissable → pas de Pokemon dessus : on la SURVOLE via `hoverTile`. Le survol
  // est continu dans le jeu réel (pointermove répété) → on re-survole à chaque poll jusqu'à ce que le
  // panneau reflète la lave (anti-course avec un re-render du HUD).
  const scene = await bootSandbox(DUEL);
  const tile = new TileInfoPanel(page);

  await expect
    .poll(
      async () => {
        await scene.hoverTile(0, 5);
        return tile.terrain.textContent();
      },
      { timeout: 10_000 },
    )
    .toBe("Lave");

  // Lave = infranchissable ET chute fatale → une SEULE puce fusionnée (le cas fatal absorbe
  // l'infranchissabilité), d'étiquette accessible « Chute fatale » (la puce n'a qu'un glyphe emoji).
  await expect(tile.panel.getByLabel("Chute fatale")).toBeVisible();
});
