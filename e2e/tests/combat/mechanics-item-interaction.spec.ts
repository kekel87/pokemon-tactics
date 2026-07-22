import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  BELCH_AFTER_BERRY,
  FLING_FLAME_ORB_BURNS,
  KNOCK_OFF_REMOVES_ITEM,
  RECYCLE_RESTORES_BERRY,
  STICKY_HOLD_BLOCKS_REMOVAL,
  THIEF_STEALS_ITEM,
  TRICK_SWAPS_ITEMS,
} from "../../fixtures/sandbox-configs";
import { InfoPanel } from "../../pages/combatHud";

// Cahier §5.25 — Item interaction (plan 142) : manipulation de l'objet tenu pilotée de bout en bout via
// le journal FR (BattleLogFormatter) + la ligne objet de l'InfoPanel (`info-panel-item`, icône officielle
// + nom FR depuis plan 168 : le texte de la ligne = le seul nom, l'icône `<img>` étant décorative).
// Tous déterministes (aucun override Math.random) : moves 100 % précision sur cible adjacente (DUEL) →
// pas de jet, sauf Éructation (90 %) qui s'appuie sur le seed fixe DUEL. On assert le SENS (ligne de
// journal FR / contenu InfoPanel), jamais le pixel. Les facettes silencieuses (×1.5 de Sabotage, garde
// Substitut D5, mémoire consommé-vs-retiré) n'émettent rien d'observable → couvertes unit/integration
// core et marquées 👁 dans le cahier.
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// L'InfoPanel reflète le Pokemon SURVOLÉ (sinon l'actif). Après une action, l'actif peut être le dummy
// le temps de son tour → on survole la case du JOUEUR (2,3) pour cibler son panneau, et on RE-survole à
// chaque poll (le hover est continu dans le jeu réel ; un seul peut être écrasé par un re-render). Cf.
// le pattern de info-panel.spec.ts.
const hoveredItem = async (
  page: Page,
  scene: { hoverTile(x: number, y: number): Promise<void> },
) => {
  await scene.hoverTile(2, 3);
  return page.getByTestId("info-panel-item").textContent();
};

// Sabotage (knock-off) : retire l'objet retirable de la cible. Le joueur lance Sabotage sur le dummy
// porteur des Restes → « <X> perd son Restes ! » + dégâts. Le ×1.5 (si la cible porte un objet) est un
// multiplicateur silencieux → couvert unit ; ici on prouve le RETRAIT (la ligne de journal).
test("§5.25 Sabotage : retire l'objet de la cible (journal « perd son Restes »)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(KNOCK_OFF_REMOVES_ITEM);
  await scene.castFirstMove(2, 2); // le dummy porteur des Restes, adjacent au nord
  await expect(log(page, /perd son Restes/)).toBeAttached({ timeout: 10_000 });
});

// Larcin (thief) : vole l'objet de la cible si le lanceur a les mains vides (D2). Le joueur (sans objet)
// lance Larcin sur le dummy porteur des Restes → « <X> vole le Restes de <Y> ! », puis l'InfoPanel du
// LANCEUR (Pokemon actif après l'action) affiche « Restes » (+ icône) — l'objet volé est désormais tenu.
test("§5.25 Larcin : vole l'objet (journal « vole le … » + InfoPanel du lanceur)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(THIEF_STEALS_ITEM);
  await scene.castFirstMove(2, 2);
  await expect(log(page, /vole le Restes de/)).toBeAttached({ timeout: 10_000 });
  // Survoler la case du LANCEUR (2,3) cible l'InfoPanel sur lui (indépendant du Pokemon actif après
  // l'action) → il porte désormais l'objet volé. Re-survol par poll (anti-course HUD), cf. info-panel.spec.
  const info = new InfoPanel(page);
  await expect.poll(() => hoveredItem(page, scene), { timeout: 10_000 }).toBe("Restes");
  await expect(info.item).toHaveText("Restes");
});

// Tour de Magie (trick) : échange inconditionnel des objets tenus (D3). Le joueur tient le Bandeau Choix,
// le dummy tient les Restes ; l'échange journalise « <X> échange son objet avec <Y> ! » et l'InfoPanel du
// lanceur montre désormais « Restes » (+ icône) (il a récupéré l'objet du dummy).
test("§5.25 Tour de Magie : échange les objets tenus (journal + InfoPanel)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(TRICK_SWAPS_ITEMS);
  await scene.castFirstMove(2, 2);
  await expect(log(page, /échange son objet avec/)).toBeAttached({ timeout: 10_000 });
  const info = new InfoPanel(page);
  // Le lanceur a récupéré l'objet du dummy (les Restes) en échange de son Bandeau Choix.
  await expect.poll(() => hoveredItem(page, scene), { timeout: 10_000 }).toBe("Restes");
  await expect(info.item).toHaveText("Restes");
});

// Dégommage (fling) : lance l'objet tenu ; l'Orbe Flamme inflige la Brûlure à la cible (table
// FLING_EFFECT, D6). Le joueur tient l'Orbe Flamme et lance Dégommage au TOUR 1 (avant toute fin de tour
// → l'Orbe part avant de brûler son propre porteur) sur le dummy endurant (hp 999, survit) → « <X>
// dégomme son Orbe Flamme ! » + « <Y> est brûlé ! ». Injouable sans objet flingable → couvert unit.
test("§5.25 Dégommage : lance l'Orbe Flamme → brûle la cible (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(FLING_FLAME_ORB_BURNS);
  await scene.castFirstMove(2, 2);
  await expect(log(page, /dégomme son Orbe Flamme/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /est brûlé/)).toBeAttached();
});

// Recyclage (recycle) : restaure le dernier objet consommé par son propre effet (D1). Le Ronflex tient
// une Baie Lichii et démarre à 20 % PV : « Attendre » → fin de tour → la baie se mange (pose
// consumedItemId). Au tour suivant, Recyclage (Self) restaure l'objet → « <X> recycle son Baie Lichii ! »
// et l'InfoPanel re-montre « Baie Lichii » (+ icône). Aucun jet (hook baie inconditionnel en pincement).
test("§5.25 Recyclage : restaure la baie consommée (journal + InfoPanel)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(RECYCLE_RESTORES_BERRY);
  // Tour 1 : la fin de tour mange la baie de pincement (≤25 % PV) → consumedItemId posé.
  await scene.endTurn();
  await expect(log(page, /a utilisé son Baie Lichii/)).toBeAttached({ timeout: 10_000 });
  // Tour suivant : Recyclage (Self → cible = sa propre case) restaure l'objet consommé.
  await scene.castFirstMove(2, 3);
  await expect(log(page, /recycle son Baie Lichii/)).toBeAttached({ timeout: 10_000 });
  const info = new InfoPanel(page);
  // L'objet consommé est de retour dans la main du Ronflex.
  await expect.poll(() => hoveredItem(page, scene), { timeout: 10_000 }).toBe("Baie Lichii");
  await expect(info.item).toHaveText("Baie Lichii");
});

// Éructation (belch) : injouable tant qu'aucune baie n'a été mangée (D7). Le Ronflex tient une Baie
// Lichii et démarre à 20 % PV : « Attendre » → fin de tour → la baie se mange (pose ateBerryThisBattle).
// Au tour suivant Éructation devient légale et résout sur le dummy endurant (hp 999, survit) → « <Y>
// perd N PV ». Prouve le gate par baie : c'est l'action de manger qui débloque le move.
test("§5.25 Éructation : devient jouable après une baie mangée puis inflige des dégâts (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(BELCH_AFTER_BERRY);
  // Tour 1 : on ne peut pas encore éructer (aucune baie mangée) → fin de tour pour manger la baie.
  await scene.endTurn();
  await expect(log(page, /a utilisé son Baie Lichii/)).toBeAttached({ timeout: 10_000 });
  // Tour suivant : Éructation est désormais légale → elle résout et inflige des dégâts au dummy
  // (on cible la ligne du Dummy : le Ronflex perd aussi des PV via le tick de fin de tour, hors sens testé).
  await scene.castFirstMove(2, 2);
  await expect(log(page, /Dummy perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
});

// Talent Glu (sticky-hold, D12) : bloque tout retrait/vol/échange d'objet du porteur. Le joueur lance
// Sabotage sur le dummy Grotadmorv (slot Glu) porteur des Restes → le retrait est bloqué : « Glu de <X>
// s'active ! » apparaît et « perd son Restes » N'apparaît PAS (l'objet reste). Les dégâts frappent
// normalement (hors du sens testé ici).
test("§5.25 Glu : bloque le retrait d'objet (journal « Glu … s'active », « perd son Restes » absent)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(STICKY_HOLD_BLOCKS_REMOVAL);
  await scene.castFirstMove(2, 2);
  await expect(log(page, /Glu de .* s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /perd son Restes/)).not.toBeAttached();
});
