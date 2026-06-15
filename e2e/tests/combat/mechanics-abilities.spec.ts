import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Cahier §5.14 — talents & objets déclenchés à travers le renderer (journal FR). Configurables en
// sandbox (`playerAbility`/`dummyAbility`/`heldItem`) → déterministe, sans archéologie de map.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

test("§5.14 talent : Intimidation s'active à l'entrée et baisse l'Attaque adverse", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox({ ...DUEL, dummyAbility: "intimidate", dummyPokemon: "charizard" });
  await expect(log(page, /Intimidation de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Attaque de .* baisse/)).toBeAttached();
});

test("§5.14 objet tenu : Restes soigne en fin de tour (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, heldItem: "leftovers", hp: 50 });
  await scene.endTurn();
  await expect(log(page, /Restes de .* s'active/)).toBeAttached({ timeout: 10_000 });
});
