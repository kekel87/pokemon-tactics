import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Cahier §5.16 — un cas par pattern de ciblage. On pilote le move via le renderer (sélection →
// ciblage → confirmation → résolution) et on assert la ligne « utilise <Move> » du journal : preuve
// que le pattern se résout de bout en bout à travers l'orchestrateur (la grille/highlights = §3.7).
// Cible : tuile du dummy pour offensif, tuile propre pour self, tuile éloignée pour Téléport/Blast.
const PATTERNS: { move: string; fr: string; x: number; y: number }[] = [
  { move: "tackle", fr: "Charge", x: 2, y: 2 }, // Single
  { move: "recover", fr: "Soin", x: 2, y: 3 }, // Self
  { move: "hydro-pump", fr: "Hydrocanon", x: 2, y: 2 }, // Line
  { move: "water-spout", fr: "Giclédo", x: 2, y: 2 }, // Cone
  { move: "sleep-powder", fr: "Poudre Dodo", x: 2, y: 2 }, // Zone
  { move: "sludge-bomb", fr: "Bombe Beurk", x: 2, y: 1 }, // Blast (portée min 2)
  { move: "take-down", fr: "Bélier", x: 2, y: 2 }, // Dash
  { move: "rock-smash", fr: "Éclate-Roc", x: 2, y: 2 }, // Cross
  { move: "slash", fr: "Tranche", x: 2, y: 2 }, // Slash
  { move: "teleport", fr: "Téléport", x: 4, y: 4 }, // Teleport (tuile libre)
];

for (const { move, fr, x, y } of PATTERNS) {
  test(`§5.16 pattern : ${fr} (${move}) se résout`, async ({ page, bootSandbox }) => {
    const scene = await bootSandbox({ ...DUEL, moves: [move] });
    await scene.castFirstMove(x, y);
    await expect(
      page.getByTestId("battle-log-entry").filter({ hasText: new RegExp(`utilise ${fr}`) }),
    ).toBeAttached({ timeout: 10_000 });
  });
}
// HitAndRun (Demi-Tour) → couvert par mechanics-movement.spec (frappe puis repli).
