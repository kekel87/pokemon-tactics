import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Cahier §5.9 / §5.10 — auras (Reflet/Mur Lumière/Brume/Rune Protect) et champs de terrain
// (Herbu/Électrifié/Brumeux/Psychique) posés via cast → ligne de journal (interaction renderer).
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.9 — auras (moves de statut sans jet de précision → déterministes).
const AURAS: [string, RegExp][] = [
  ["reflect", /pose .* \(\d+ tours\)/],
  ["light-screen", /pose .* \(\d+ tours\)/],
  ["mist", /pose .* \(\d+ tours\)/],
  ["safeguard", /pose .* \(\d+ tours\)/],
];
for (const [move, re] of AURAS) {
  test(`§5.9 aura : ${move} posée (journal)`, async ({ page, bootSandbox }) => {
    const scene = await bootSandbox({ ...DUEL, moves: [move] });
    await scene.castFirstMove(2, 3); // self/team
    await expect(log(page, re)).toBeAttached({ timeout: 10_000 });
  });
}

// §5.10 — champs de terrain.
const FIELDS = ["grassy-terrain", "electric-terrain", "misty-terrain", "psychic-terrain"];
for (const move of FIELDS) {
  test(`§5.10 champ : ${move} déployé (journal)`, async ({ page, bootSandbox }) => {
    const scene = await bootSandbox({ ...DUEL, moves: [move] });
    await scene.castFirstMove(2, 3);
    await expect(log(page, /déploie le .* \(\d+ tours\)/)).toBeAttached({ timeout: 10_000 });
  });
}
