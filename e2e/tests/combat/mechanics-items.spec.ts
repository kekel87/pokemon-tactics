import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Cahier §5.17 (lot 95→99) et §5.18 (lot 99→101) — objets tenus pilotés de bout en bout à travers le renderer
// (journal FR). Configurables en sandbox (`heldItem`/`dummyHeldItem`/`dummyMove`) → déterministes,
// sans override Math.random. Les facettes silencieuses (immunité Sol/poudre/météo, immunité aux
// hazards/terrains) n'émettent aucune ligne de journal → couvertes unit/integration core et marquées
// 👁 dans le cahier ; e2e ne pilote que les signaux observables.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// Ballon (air-balloon) : éclate (consommé) au PREMIER coup offensif non-Sol reçu, en émettant
// HeldItemActivated + HeldItemConsumed (hook onAfterDamageReceived). Le joueur Florizarre lance
// Griffe (scratch, contact, 100 % précision, portée 1) sur le dummy porteur (`dummyHeldItem`)
// adjacent → le coup non-Sol fait éclater le Ballon : « Ballon de <X> s'active ! » + « <X> a utilisé
// son Ballon ». L'immunité aux moves Sol (0 dégât) et le traitement « aérien » (hazards/terrains au
// sol) sont silencieux → couverts unit (`battle/items/air-balloon.test.ts` + `effective-flying.test`).
test("§5.17 Ballon : éclate au premier coup offensif reçu puis se consomme (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, dummyHeldItem: "air-balloon" });
  await scene.castFirstMove(2, 2); // Griffe sur le dummy adjacent au nord
  await expect(log(page, /Ballon de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /a utilisé son Ballon/)).toBeAttached();
});

// Lunettes Filtre (safety-goggles) : immunité aux moves Poudre (hook onMoveImmunity) → le coup
// échoue et l'objet s'annonce. Le joueur Florizarre lance Spore (100 % précision, Poudre, hors-pool
// forcé via `moves`) sur le dummy porteur adjacent → « Lunettes Filtre de <X> s'active ! », et aucun
// statut Sommeil n'est appliqué. L'immunité aux dégâts de météo est silencieuse → couverte unit
// (`battle/items/safety-goggles.test.ts`).
test("§5.17 Lunettes Filtre : bloque un move Poudre (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({
    ...DUEL,
    moves: ["spore"],
    dummyHeldItem: "safety-goggles",
  });
  await scene.castFirstMove(2, 2); // Spore sur le dummy porteur adjacent
  await expect(log(page, /Lunettes Filtre de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /s'est endormi/)).not.toBeAttached();
});

// Pare-Effet (protective-pads) : les moves contact du PORTEUR ignorent les réactions de contact de
// la cible. Signal observable = ABSENCE de la réaction de contact. Le joueur tient le Pare-Effet
// (`heldItem`) et lance Griffe (contact, 100 %) sur un dummy portant le Casque Brut (`dummyHeldItem`,
// recoil de contact) → le Casque NE se déclenche PAS (« Casque Brut … » absent). Témoin sans
// Pare-Effet ci-dessous → le Casque Brut s'active. Cross-témoin (avec/sans) → déterministe.
test("§5.17 Pare-Effet : annule la réaction de contact de la cible — Casque Brut muet (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({
    ...DUEL,
    heldItem: "protective-pads",
    dummyHeldItem: "rocky-helmet",
  });
  await scene.castFirstMove(2, 2); // Griffe (contact) sur le dummy au Casque Brut
  await expect(log(page, /Casque Brut de .* s'active/)).not.toBeAttached();
});

test("§5.17 Pare-Effet : témoin sans objet, le Casque Brut s'active sur contact (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, dummyHeldItem: "rocky-helmet" });
  await scene.castFirstMove(2, 2);
  await expect(log(page, /Casque Brut de .* s'active/)).toBeAttached({ timeout: 10_000 });
});

// Talisman Sain (clear-amulet) : bloque toute baisse de stat infligée par l'adversaire (hook
// onStatChangeBlocked) en émettant HeldItemActivated. Piloté par le joueur (déterministe, sans
// dépendre de l'IA) : le joueur lance Groz'Yeux (leer, Déf -1, hors-pool forcé via `moves`) sur le
// dummy porteur du Talisman (`dummyHeldItem`) adjacent → la baisse de Défense est bloquée :
// « Talisman Sain de <X> s'active ! ». Les baisses auto-infligées (Draco-Météore) ne sont PAS
// bloquées → couvert unit (`battle/items/clear-amulet.test.ts`).
test("§5.17 Talisman Sain : bloque une baisse de stat adverse (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["leer"], dummyHeldItem: "clear-amulet" });
  await scene.castFirstMove(2, 2); // Groz'Yeux sur le dummy porteur adjacent
  await expect(log(page, /Talisman Sain de .* s'active/)).toBeAttached({ timeout: 10_000 });
});

// Gant de Boxe (punching-glove) : comme le Pare-Effet, les moves Poing du PORTEUR ignorent les
// réactions de contact de la cible (signal observable = ABSENCE de la réaction). Le joueur tient le
// Gant (`heldItem`) et lance Mach Punch (contact, Poing, 100 %) sur un dummy au Casque Brut
// (`dummyHeldItem`) → le Casque NE se déclenche PAS. Témoin sans Gant ci-dessous → le Casque s'active.
// Le boost de dégâts ×1.1 est silencieux (pas de ligne dédiée) → couvert unit
// (`battle/items/punching-glove.test.ts`).
test("§5.18 Gant de Boxe : annule la réaction de contact d'un move Poing — Casque Brut muet (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({
    ...DUEL,
    heldItem: "punching-glove",
    moves: ["mach-punch"],
    dummyHeldItem: "rocky-helmet",
  });
  await scene.castFirstMove(2, 2); // Mach Punch (Poing, contact) sur le dummy au Casque Brut
  await expect(log(page, /Casque Brut de .* s'active/)).not.toBeAttached();
});

test("§5.18 Gant de Boxe : témoin sans objet, le Casque Brut s'active sur un move Poing (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({
    ...DUEL,
    moves: ["mach-punch"],
    dummyHeldItem: "rocky-helmet",
  });
  await scene.castFirstMove(2, 2);
  await expect(log(page, /Casque Brut de .* s'active/)).toBeAttached({ timeout: 10_000 });
});

// Spray Gorge (throat-spray) : après que le PORTEUR utilise un move Son, +1 AtqSpé puis consommation
// (hook onAfterMoveUse). Le joueur tient le Spray (`heldItem`) et lance Aboiement (snarl, Son) sur le
// dummy → « Spray Gorge de <X> s'active ! ». Déclenché à l'usage du move, indépendamment du toucher,
// donc déterministe. Le boost +1 AtqSpé et la consommation sont couverts unit
// (`battle/items/throat-spray.test.ts`).
test("§5.18 Spray Gorge : s'active après un move Son (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, heldItem: "throat-spray", moves: ["snarl"] });
  await scene.castFirstMove(2, 2); // Aboiement (Son) sur le dummy adjacent
  await expect(log(page, /Spray Gorge de .* s'active/)).toBeAttached({ timeout: 10_000 });
});
