import { expect, test } from "../../fixtures";
import {
  COMBAT_PREVIEW_SURVIVES,
  FOG_ENEMY,
  FOG_ENEMY_NO_ITEM,
  FOG_OFF_ENEMY,
  FOG_PREVIEW,
  FOG_REVEAL_ABILITY_ON_ENTRY,
  FOG_REVEAL_ITEM_ON_USE,
} from "../../fixtures/sandbox-configs";
import { hoverCard } from "../../pages/combat-queries";
import { CursorPanel, InfoPanel } from "../../pages/combatHud";

// Cahier §4.15 (fog ennemi, plan 176) — la carte d'un Pokemon ADVERSE retient ce qu'un adversaire ne
// peut pas connaître : PV exacts, objet tenu, talent, bloc de stats, et les bornes de dégâts de la
// preview. Le fog est appliqué dans les adaptateurs de vue (`buildInfoPanelView` /
// `buildCombatPreviewView`), pas dans le core — donc DOM pur, aucun pixel.
//
// Tout est piloté par le SEUL champ `SandboxConfig.fogOfWar` (absent → OFF, défaut du studio). Chaque
// case foggée a son témoin fog OFF sur la MÊME situation : fog OFF, un ennemi se lit désormais
// exactement comme un allié (décision humaine 2026-08-05), ce qui est aussi ce qui rend les
// assertions du fog discriminantes.
//
// Déterminisme : dummy passif, aucune attaque résolue (sauf la fin de tour qui déclenche les Restes,
// un soin sans jet) → les valeurs affichées ne dépendent d'aucun tirage.

const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

test("§4.15 fog ON : les PV de l'ennemi sont un pourcentage SEUL (aucun « x / y »)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(FOG_ENEMY);
  const card = await hoverCard(scene, page, 2, 2, "Dracaufeu");

  // Le chiffre exact disparaît : plus de « 108 / 155 », et le pourcentage n'est plus un aparté entre
  // parenthèses — il est devenu LE chiffre.
  await expect(card.hpNumbers).toBeEmpty();
  await expect(card.hpPct).toHaveText(/^\d{1,3}%$/);
  await expect(card.hpText).not.toContainText("/");
  // L'ARIA suit ce qui est à l'écran : échelle 0-100, sinon un lecteur d'écran annoncerait les PV
  // qu'on masque. C'est pour ça que le helper `readHp` (qui lit l'ARIA) ne vaut plus sous fog.
  await expect(card.hpBar).toHaveAttribute("aria-valuemax", "100");
  await expect(card.hpBar).toHaveAttribute("aria-valuenow", /^\d{1,3}$/);
});

test("§4.15 fog OFF (défaut) : l'ennemi est lu en entier — PV exacts, stats, talent, objet réel", async ({
  page,
  bootSandbox,
}) => {
  // Même situation, `fogOfWar` absent : le studio sert précisément à tout inspecter.
  const scene = await bootSandbox(FOG_OFF_ENEMY);
  const card = await hoverCard(scene, page, 2, 2, "Dracaufeu");

  await expect(card.panel).toHaveAttribute("data-team", "2");
  // PV chiffrés + pourcentage entre parenthèses, comme sur un allié.
  await expect(card.hpNumbers).toHaveText(/^\d+ \/ \d+$/);
  await expect(card.hpPct).toHaveText(/^ \(\d{1,3}%\)$/);
  // Lecture complète : bloc des 5 stats, talent et objet nommés, aucun placeholder.
  await expect(card.stats).toBeVisible();
  await expect(card.statRows).toHaveCount(5);
  await expect(card.talent).toHaveText("Brasier");
  await expect(card.talent).toHaveAttribute("data-unknown", "");
  await expect(card.itemName).toHaveText("Orbe Vie");
  await expect(card.item).toHaveAttribute("data-unknown", "");
  await expect(card.itemIcon).toBeVisible();
});

test("§4.15 fog ON : objet inconnu → « ??? » + icône générique (l'officielle est absente)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(FOG_ENEMY);
  const card = await hoverCard(scene, page, 2, 2, "Dracaufeu");

  await expect(card.item).toBeVisible();
  await expect(card.itemName).toHaveText("???");
  await expect(card.item).toHaveAttribute("data-unknown", "1");
  // L'icône officielle laisse place au glyphe générique — même encombrement, donc la ligne ne saute
  // pas au moment de la révélation.
  await expect(card.itemGlyph).toBeVisible();
  await expect(card.itemIcon).toBeHidden();
});

test("§4.15 fog ON : un ennemi SANS objet garde le placeholder (« ne tient rien » est une info)", async ({
  page,
  bootSandbox,
}) => {
  // Sans fog, un Pokemon sans objet masque sa ligne (§4.7). Sous fog elle reste, sinon la ligne
  // absente livrerait « ne tient rien » à qui la regarde.
  const scene = await bootSandbox(FOG_ENEMY_NO_ITEM);
  const card = await hoverCard(scene, page, 2, 2, "Dracaufeu");

  await expect(card.item).toBeVisible();
  await expect(card.itemName).toHaveText("???");
  await expect(card.item).toHaveAttribute("data-unknown", "1");
  await expect(card.itemGlyph).toBeVisible();
});

test("§4.15 fog ON : talent inconnu → slot « ??? » (plus de badge de révélation)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(FOG_ENEMY);
  const card = await hoverCard(scene, page, 2, 2, "Dracaufeu");

  // Le talent occupe son slot normal (à droite de la ligne de PV, comme chez un allié), rempli dès
  // qu'il devient connu — le badge « Talent : X » du plan 163 a disparu, il disait la chose deux fois.
  await expect(card.talent).toBeVisible();
  await expect(card.talent).toHaveText("???");
  await expect(card.talent).toHaveAttribute("data-unknown", "1");
});

test("§4.15 fog ON : pas de bloc de stats sur la carte d'un ennemi", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(FOG_ENEMY);
  const card = await hoverCard(scene, page, 2, 2, "Dracaufeu");

  // Les chips de types restent : ils sont publics (plan 174).
  await expect(card.typeChips).toHaveCount(2);
  await expect(card.stats).toBeHidden();
});

test("§4.15 fog ON : révélation à l'usage — les Restes de l'ennemi s'activent, l'objet est nommé", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(FOG_REVEAL_ITEM_ON_USE);
  const before = await hoverCard(scene, page, 2, 2, "Ronflex");
  await expect(before.itemName).toHaveText("???");

  // Le joueur attend → la fin du tour du dummy déclenche ses Restes, nommés au journal.
  await scene.endTurn();
  await expect(log(page, /Restes de Ronflex s'active/)).toBeAttached({ timeout: 10_000 });

  // L'objet a agi sous les yeux du joueur : le garder `???` serait une amnésie imposée, pas un secret.
  const after = await hoverCard(scene, page, 2, 2, "Ronflex");
  await expect(after.itemName).toHaveText("Restes");
  await expect(after.item).toHaveAttribute("data-unknown", "");
  await expect(after.itemIcon).toHaveAttribute("src", /^data:image\//);
  await expect(after.itemGlyph).toBeHidden();
});

test("§4.15 fog ON : révélation à l'entrée — Intimidation s'annonce, le talent est nommé", async ({
  page,
  bootSandbox,
}) => {
  // Intimidation se déclenche à l'entrée en combat (events de démarrage) → le talent est connu avant
  // même le premier tour, sans rien piloter.
  const scene = await bootSandbox(FOG_REVEAL_ABILITY_ON_ENTRY);
  await expect(log(page, /Intimidation de Tauros s'active/)).toBeAttached({ timeout: 10_000 });

  const card = await hoverCard(scene, page, 2, 2, "Tauros");
  await expect(card.talent).toHaveText("Intimidation");
  await expect(card.talent).toHaveAttribute("data-unknown", "");
  // Le fog tient toujours sur le reste : les PV restent un pourcentage seul.
  await expect(card.hpNumbers).toBeEmpty();
});

test("§4.15 fog ON : preview sur une cible ennemie — dégâts en % et non en PV", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(FOG_PREVIEW);
  const attacker = new InfoPanel(page);
  const target = new CursorPanel(page);

  await scene.aimFirstMove(2, 2);

  await expect(attacker.moveName).toHaveText("Griffe");
  // La fourchette garde sa forme « min–max » : c'est l'UNITÉ qui dit qu'on lit une part des PV max.
  // Afficher « 42–50 PV » à côté du « → X–Y % PV » restant rendrait les PV max en une soustraction.
  await expect(attacker.damage).toHaveText(/^\d+–\d+$/);
  await expect(attacker.damageUnit).toHaveText("%");
  await expect(target.remaining).toHaveText(/^→ \d+–\d+ % PV$/);
});

test("§4.15 fog OFF (défaut) : preview sur la même cible — dégâts en PV", async ({
  page,
  bootSandbox,
}) => {
  // Témoin : MÊME duel sans le fog → les bornes sont des PV absolus et l'unité le dit.
  const scene = await bootSandbox(COMBAT_PREVIEW_SURVIVES);
  const attacker = new InfoPanel(page);

  await scene.aimFirstMove(2, 2);

  await expect(attacker.damage).toHaveText(/^\d+–\d+$/);
  await expect(attacker.damageUnit).toHaveText("PV");
});
