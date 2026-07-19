import { expect, test } from "../../fixtures";
import {
  DUEL,
  LIFE_ORB_MULTI_HIT_RECOIL,
  METRONOME_BASELINE_NO_ITEM,
  METRONOME_BOOST,
  PHANTOM_HIT_ROCKY_HELMET,
  RED_CARD_EJECTS_ATTACKER,
} from "../../fixtures/sandbox-configs";

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

// Métronome (objet) : +10 % de dégâts par usage CONSÉCUTIF du MÊME move (succès au tour précédent),
// cumulatif, cap +100 %. La montée des dégâts est SILENCIEUSE (aucune ligne « Métronome … s'active »),
// donc on la prouve par les valeurs chiffrées des lignes « perd N PV » sur plusieurs Griffe d'affilée :
// la série monte AVEC l'objet, reste plate SANS.

// Dégâts de chaque coup de Griffe sur le dummy, dans l'ordre du journal. Le journal contient aussi
// des « Ronflex perd N PV » d'origine NON-attaque (poison de terrain en fin de tour) au libellé
// identique → on ne peut pas filtrer par le seul texte « perd ». On lit donc le journal ORDONNÉ et
// on ne retient, pour chaque « Florizarre utilise Griffe ! », que la perte de PV qui le suit
// immédiatement (le dégât du move) — les ticks de poison intercalés sont ignorés.
const griffeDamageAmounts = (page: import("@playwright/test").Page): Promise<number[]> =>
  page
    .getByTestId("battle-log-entry")
    .allTextContents()
    .then((lines) => {
      const amounts: number[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (!/Florizarre utilise Griffe/.test(lines[i] ?? "")) {
          continue;
        }
        const next = lines[i + 1] ?? "";
        const hit = next.match(/Ronflex perd (\d+) PV/);
        if (hit) {
          amounts.push(Number(hit[1]));
        }
      }
      return amounts;
    });

// Modèle FFTA : agir ne clôt pas le tour (on peut aussi se déplacer), donc après une attaque le
// bouton « Attaque » est désactivé (`canAct` consommé) jusqu'à ce qu'on close le tour via « Attendre »
// + confirmation de direction. Cela enchaîne sur le tour du dummy (IA inerte) puis rend la main au
// joueur → « Attaque » se réactive. On attend cette réactivation (sans `waitForTimeout`, banni).
const advanceToNextPlayerTurn = async (
  page: import("@playwright/test").Page,
  scene: { endTurn(): Promise<void> },
): Promise<void> => {
  await scene.endTurn(); // « Attendre » → confirme direction → fin du tour joueur
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeEnabled({
    timeout: 15_000,
  });
};

// Lance Griffe `count` fois d'affilée sur le dummy endurant (hp 999, survit) et renvoie les dégâts de
// chaque coup, dans l'ordre. Griffe est à 100 % (touche sous tout seed → aucun raté qui
// réinitialiserait la série). Entre deux coups on clôt le tour (le dummy joue Groz'Yeux, inerte) pour
// rendre la main au joueur. Le seed est fixe → run reproductible (0 retry).
const drivenGriffeHits = async (
  page: import("@playwright/test").Page,
  bootSandbox: (config?: Record<string, unknown>) => Promise<{
    castFirstMove(x: number, y: number): Promise<void>;
    endTurn(): Promise<void>;
  }>,
  config: Record<string, unknown>,
  count: number,
): Promise<number[]> => {
  const scene = await bootSandbox(config);
  for (let i = 0; i < count; i++) {
    await scene.castFirstMove(2, 2);
    await expect.poll(() => griffeDamageAmounts(page)).toHaveLength(i + 1);
    if (i < count - 1) {
      await advanceToNextPlayerTurn(page, scene);
    }
  }
  return griffeDamageAmounts(page);
};

// MÊME enchaînement (4 Griffe consécutives sur le dummy), AVEC vs SANS le Métronome. Avec l'objet,
// chaque usage consécutif réussi du MÊME move ajoute +10 % de dégâts (série 0→3 sur 4 coups, donc
// ×1.0 → ×1.3) → la série CROÎT. Sans l'objet, les dégâts restent PLATS (seule la variance de jet
// ±15 % joue, sans tendance). On asserte uniquement des signaux INTRA-run (robustes : la présence de
// l'objet décale l'état du PRNG, donc une égalité chiffrée inter-run serait fragile) :
//   - AVEC objet, le 4e coup (×1.3) dépasse strictement le 1er (×1.0) → l'objet fait monter les dégâts ;
//   - SANS objet, l'amplitude max−min reste dans la bande de variance (≈ ±15 % + arrondi) → aucune
//     montée : c'est bien l'objet, et non un effet de tour, qui crée la croissance.
// Le compteur 0..10, le cap +100 % et la remise à zéro (move différent / usage raté) sont couverts
// unit (`battle/metronome-streak.test.ts`).
test("§5.19 Métronome : usages consécutifs du même move montent les dégâts (journal)", async ({
  page,
  bootSandbox,
}) => {
  // Deux boots seedés + 8 tours pilotés : le test le plus long de la suite, au bord des 30 s sous
  // charge parallèle (8 workers). On triple le budget plutôt que de réduire la couverture.
  test.slow();
  const boosted = await drivenGriffeHits(page, bootSandbox, METRONOME_BOOST, 4);
  const baseline = await drivenGriffeHits(page, bootSandbox, METRONOME_BASELINE_NO_ITEM, 4);

  expect(boosted).toHaveLength(4);
  expect(baseline).toHaveLength(4);
  // AVEC objet : la série monte → le dernier coup (série 3, ×1.3) dépasse strictement le 1er (×1.0).
  expect(boosted[3]).toBeGreaterThan(boosted[0]);
  // SANS objet : pas de montée → l'amplitude reste dans la bande de variance de jet (≈ ±15 % + arrondi).
  const baselineSpread = Math.max(...baseline) - Math.min(...baseline);
  expect(baselineSpread).toBeLessThanOrEqual(Math.ceil(Math.min(...baseline) * 0.18));
});

// Carton Rouge (red-card) : quand le PORTEUR encaisse un coup de dégâts, c'est l'ATTAQUANT qui est
// renvoyé sur sa propre zone de spawn, puis l'objet du porteur est consommé (hook eject, câblé dans
// handle-damage → `ejectToSpawn`). Le joueur Florizarre démarre sur sa case de spawn (2,4), face nord,
// et dashe en Vive-Attaque (Dash 2, 100 % précision) sur le dummy Ronflex porteur du Carton Rouge en
// (2,2) : le dash l'éloigne de son spawn (atterrissage en (2,3)) puis le coup déclenche le Carton
// Rouge, qui téléporte l'ATTAQUANT sur sa case de spawn libérée (2,4). On confirme le dash par la
// DIRECTION (axe nord, cf §5.13) puis on lit la séquence dans le journal : « Carton Rouge … s'active »,
// « … se téléporte ! » (l'attaquant renvoyé), « … a utilisé son Carton Rouge » (consommation).
// Bouton Fuite (eject-button) renvoie le PORTEUR chez lui : non pilotable côté joueur (le porteur, le
// dummy, ne peut être frappé que sur sa case de spawn → eject no-op) → couvert unit/integration core
// (`forced-teleport.test.ts`, `items/eject-items.test.ts`), marqué 👁 au cahier §5.20.
test("§5.20 Carton Rouge : renvoie l'attaquant sur sa zone de spawn puis se consomme (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(RED_CARD_EJECTS_ATTACKER);
  // Sélectionner Vive-Attaque (Attaque → 1er move) puis piloter le Dash par la DIRECTION nord :
  // survoler une tuile de l'axe nord fixe la direction, deux clics sur l'axe (≠ atterrissage) valident.
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click();
  await scene.hoverTile(2, 0);
  await scene.clickTile(2, 1);
  await scene.clickTile(2, 1);
  await expect(log(page, /Carton Rouge de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /se téléporte/)).toBeAttached();
  await expect(log(page, /a utilisé son Carton Rouge/)).toBeAttached();
});

// Orbe Vie (life-orb) — recul 1/10 PV max au PORTEUR, UNE SEULE fois par attaque, même sur un move
// multi-coups (régression : avant le fix, le recul frappait PAR coup → l'Orbe s'annonçait 2 à 5 fois
// sur Balle Graine). Le hook attaquant `onAfterMoveDamageDealt` (émetteur du HeldItemActivated) est
// désormais appelé une seule fois en fin de `handleDamage` sur le total des dégâts. Signal observable
// net : le NOMBRE de lignes « Orbe Vie de <X> s'active ! » dans le journal. Le joueur Florizarre tient
// l'Orbe (`heldItem`) et lance Balle Graine (2-5 coups, 100 % précision) sur le dummy endurant
// (`dummyHp: 999`, survit à la volée) → l'Orbe s'annonce EXACTEMENT une fois, quel que soit le nombre
// de coups tiré par le seed. `toHaveCount(1)` distingue le fix (1) de la régression (≥ 2). Le montant
// chiffré du recul (HP) et le fire-once sur move mono-coup sont couverts integration core
// (`held-items.integration.test.ts` : « recoil UNE seule fois »). À distinguer du Casque Brut, canon
// recoil PAR coup — cf témoins Pare-Effet/Gant de Boxe ci-dessus.
test("§5.20 Orbe Vie : recul journalisé UNE seule fois sur un move multi-coups (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(LIFE_ORB_MULTI_HIT_RECOIL);
  await scene.castFirstMove(2, 2); // Balle Graine (multi-coups) sur le dummy adjacent endurant
  await expect(log(page, /Orbe Vie de .* s'active/)).toHaveCount(1, { timeout: 10_000 });
});

// Coup fantôme / Casque Brut (rocky-helmet) — RÉGRESSION du recul de contact PAR coup sur un move
// multi-coups (à distinguer de l'Orbe Vie ci-dessus, recul UNE fois pour tout le move). Un attaquant à
// très bas PV lance Double Pied (2 coups FIXES, contact, 100 %) sur un porteur de Casque Brut : le
// recul du Casque (1/6 PV max) le met K.O. dès le coup 1. Avant le fix, la boucle multi-coups
// continuait au coup 2 (un mort frappait encore → 2 coups sur la cible) ; après (`if
// attacker.currentHp <= 0 break` en tête de boucle, handle-damage), elle s'arrête au 1er coup. Signal
// observable net et contamination-proof (immunisé des ticks de terrain de fin de tour, contrairement
// au comptage de « perd N PV ») : le récap multi-coups « Touché N fois ! » encode EXACTEMENT le nombre
// de coups → « Touché 1 fois ! » (le fix) et JAMAIS « Touché 2 fois ! » (la régression). On confirme
// aussi la précondition du bug par « Florizarre est K.O. ! » (le recul du Casque a bien tué l'attaquant
// dès le 1er coup). Le montant chiffré et le fire-once sont couverts integration core
// (held-items.integration.test.ts : « pas de coup fantôme »).
test("§5.20 Casque Brut : pas de coup fantôme, la volée multi-coups s'arrête au K.O. de l'attaquant (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(PHANTOM_HIT_ROCKY_HELMET);
  await scene.castFirstMove(2, 2); // Double Pied (contact ×2) sur le dummy au Casque Brut
  await expect(log(page, /Florizarre est K\.O\./)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Touché 1 fois/)).toBeAttached();
  await expect(log(page, /Touché 2 fois/)).not.toBeAttached();
});
