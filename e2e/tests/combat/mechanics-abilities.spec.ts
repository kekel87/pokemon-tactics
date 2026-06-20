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

// §5.14 objets tenus simples à event observable — un par mécanique (soin post-coup / auto-statut de
// fin de tour). Bandeau Muscle / Lunettes Sages (×1.1 dégâts, sans event) restent couverts unit.

// Grelot Coque (shell-bell) : soigne 1/8 des dégâts infligés après une attaque, non consommé. Le
// porteur Florizarre démarre blessé (hp 50, sous son max) et lance Griffe (portée 1) sur le dummy
// adjacent (100% précision → cast déterministe). Le coup inflige des dégâts → l'objet rend des PV et
// journalise « Grelot Coque de <X> s'active » + « <X> récupère N PV » (HpRestored).
test("§5.14 objet tenu : Grelot Coque soigne après une attaque (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, heldItem: "shell-bell", hp: 50 });
  await scene.castFirstMove(2, 2); // le dummy adjacent au nord
  await expect(log(page, /Grelot Coque de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /récupère \d+ PV/)).toBeAttached();
});

// Bulbe (absorb-bulb) : objet « réaction au coup reçu » — touché par un coup Eau, monte d'un cran
// l'Atq. Spé. du porteur puis se consomme (hook onAfterDamageReceived). Le dummy Ronflex (Normal,
// neutre à l'Eau et très endurant) porte le Bulbe (dummyHeldItem) et SURVIT au coup — indispensable,
// car le hook ne se déclenche que si la cible est encore en vie (`target.currentHp > 0`) ; un porteur
// faible/résistant K.O. (ex. Onix Roche/Sol ×4) court-circuiterait la réaction. Le joueur Tortank
// lance Pistolet à O (Eau, 100 % précision, portée 1-3, hors-pool forcé via `moves`) sur le Ronflex
// adjacent → le coup Eau déclenche la réaction : « Bulbe de <X> s'active ! » + « Atq. Spé. de <X>
// augmente ! » (StatChanged) + « <X> a utilisé son Bulbe » (consommation). Cast déterministe
// (précision 100 %, cible adjacente → aucun jet de portée). Pile / Boule de Neige / Lichen Lumineux
// partagent la même factory (autre type → autre stat) → couverts unit
// (`battle/items/type-reaction-items.test.ts`), non dupliqués e2e.
test("§5.14 objet de réaction : Bulbe monte l'Atq. Spé. quand touché par un coup Eau (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({
    ...DUEL,
    pokemon: "blastoise",
    moves: ["water-gun"],
    dummyPokemon: "snorlax",
    dummyHeldItem: "absorb-bulb",
  });
  await scene.castFirstMove(2, 2); // le Ronflex adjacent au nord
  await expect(log(page, /Bulbe de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Atq\. Spé\. de .* augmente/)).toBeAttached();
  await expect(log(page, /a utilisé son Bulbe/)).toBeAttached();
});

// Orbe Toxique (toxic-orb) : empoisonne gravement le porteur en fin de tour s'il n'a aucun statut
// majeur. Le porteur Florizarre démarre sans statut → la fin de tour applique le Poison Grave et
// journalise « Orbe Toxique de <X> s'active » + « <X> est gravement empoisonné ! » (aucun jet).
test("§5.14 objet tenu : Orbe Toxique empoisonne gravement en fin de tour (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, heldItem: "toxic-orb" });
  await scene.endTurn();
  await expect(log(page, /Orbe Toxique de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /est gravement empoisonné/)).toBeAttached();
});

// Granule de terrain (terrain-seed) : Graine Électrik (electric-seed) — quand le porteur est sur le
// Champ Électrifié, en fin de tour il gagne +1 Défense puis la graine est consommée (hook onEndTurn
// + getFieldTerrainAt). La sandbox ne pré-pose AUCUN champ → le porteur doit le poser lui-même :
// Florizarre tient la Graine Électrik (`heldItem`) et lance Champ Électrifié (`electric-terrain`,
// Self, status sans jet → forcé hors-pool via `moves`), qui déploie la zone (rayon 3) centrée sous
// lui → sa propre tuile est sur le champ. Le cast ne déclenche pas encore la fin de tour (cf.
// weather.spec : le tick de fin de tour est distinct du cast) → l'`endTurn()` qui suit fait jouer le
// hook : « Graine Électrik de <X> s'active ! » + « Défense de <X> augmente ! » (StatChanged) + « <X> a
// utilisé son Graine Électrik » (HeldItemConsumed). Cast déterministe (Self, aucun jet). *Graine
// Herbe / Graine Psychique / Graine Brume partagent la même factory (autre champ/stat, même hook) →
// couvertes unit (`battle/items/terrain-seed-items.test.ts`), non dupliquées e2e → 👁.*
test("§5.14 granule de terrain : Graine Électrik monte la Défense sur le Champ Électrifié (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({
    ...DUEL,
    moves: ["electric-terrain"],
    heldItem: "electric-seed",
  });
  await scene.castFirstMove(2, 3); // Self/champ — posé sous le porteur (rayon 3)
  await scene.endTurn();
  await expect(log(page, /Graine Électrik de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Défense de .* augmente/)).toBeAttached();
  await expect(log(page, /a utilisé son Graine Électrik/)).toBeAttached();
});
