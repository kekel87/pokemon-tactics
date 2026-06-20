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

// §5.14 baies — une par famille de mécanique (anti-type / pincement stat / soin statut). Toutes
// déterministes : le pincement et le soin se déclenchent en fin de tour (aucun jet), l'anti-type
// par un Pistolet à O (100% précision) → seed fixe suffisant, sans override Math.random.

// Famille 1 — anti-type : Baie Pocpoc (passho-berry) ÷2 un coup Eau super-efficace puis se consomme.
// Le dummy Onix (Roche/Sol) porte la baie ; le joueur Tortank lance Pistolet à O (Eau, 100%, portée
// 1-3, hors-pool forcé via `moves`) sur l'Onix adjacent → super-efficace (×4) → la baie se déclenche.
// Cast déterministe (précision 100%), aucun jet de portée (cible adjacente).
test("§5.14 baie anti-type : Baie Pocpoc résiste au coup Eau super-efficace (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({
    ...DUEL,
    pokemon: "blastoise",
    moves: ["water-gun"],
    dummyPokemon: "onix",
    dummyHeldItem: "passho-berry",
  });
  await scene.castFirstMove(2, 2); // l'Onix adjacent au nord
  await expect(log(page, /Baie Pocpoc de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /a utilisé son Baie Pocpoc/)).toBeAttached();
});

// Famille 2 — pincement stat : Baie Lichii (liechi-berry) +1 Attaque à ≤25% PV en fin de tour.
// Dracaufeu démarre à 20 PV (sous le seuil) → la baie se déclenche dès la fin de tour.
test("§5.14 baie de pincement : Baie Lichii augmente l'Attaque à bas PV (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({
    ...DUEL,
    pokemon: "charizard",
    hp: 20,
    heldItem: "liechi-berry",
  });
  await scene.endTurn();
  await expect(log(page, /Baie Lichii de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Attaque de .* augmente/)).toBeAttached();
});

// Famille 3 — soin de statut : Baie Fraive (rawst-berry) guérit la brûlure en fin de tour.
// Dracaufeu démarre brûlé → la baie le soigne dès la fin de tour puis est consommée.
test("§5.14 baie de soin : Baie Fraive guérit la brûlure (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({
    ...DUEL,
    pokemon: "charizard",
    status: "burned",
    heldItem: "rawst-berry",
  });
  await scene.endTurn();
  await expect(log(page, /Baie Fraive de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /a utilisé son Baie Fraive/)).toBeAttached();
});
