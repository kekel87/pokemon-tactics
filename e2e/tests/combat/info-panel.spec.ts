import { expect, test } from "../../fixtures";
import { DUEL, HELD_ITEM_ICONS, INFO_PANEL_ALLY_STATS } from "../../fixtures/sandbox-configs";
import { CursorPanel, InfoPanel } from "../../pages/combatHud";

// Cahier §4 (panneau d'info) — le HUD chrome porte DEUX cartes bâties sur le même composant
// (plan 175) : le panneau gauche reflète l'identité + les PV du Pokemon ACTIF (et lui seul), la carte
// curseur reflète le Pokemon sous le curseur (masquée sur une case vide ou sur l'actif lui-même).
// DOM uniquement (view-model découplé du core), donc robuste sans toucher à la scène 3D.

test("info panel : identité du Pokemon actif (Florizarre, Niv. 50, PV pleins)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);
  const info = new InfoPanel(page);

  await expect(info.panel).toBeVisible();
  // Nom FR officiel (jamais l'ID anglais) — le joueur incarne Florizarre dans ce duel.
  await expect(info.name).toHaveText("Florizarre");
  await expect(info.level).toHaveText("Lv.50");
  // PV pleins au boot : "155 / 155" (les deux nombres égaux ; le % vit dans un span frère, cf. plan 174).
  await expect(info.hpNumbers).toHaveText(/^(\d+) \/ \1$/);
  await expect(info.portrait).toBeVisible();
});

// §4.7 — le survol d'une tile remplit la CARTE CURSEUR (piloté par le hook hoverTile, qui rejoue le
// chemin pointer-move → orchestrateur), sans jamais déplacer le panneau gauche : celui-ci reste sur
// l'actif (plan 175 — le joueur ne perd plus l'état de son propre Pokemon en promenant la souris).
// Survol d'une tile vide → la carte curseur se masque.
test("§4.7 info panel : survoler l'adversaire remplit la carte curseur, le panneau gauche reste sur l'actif", async ({
  page,
  bootSandbox,
}) => {
  // Dummy = un vrai Pokemon adverse (Dracaufeu) pour vérifier le nom FR au survol.
  const scene = await bootSandbox({ ...DUEL, dummyPokemon: "charizard" });
  const info = new InfoPanel(page);
  const cursor = new CursorPanel(page);

  // Le survol est CONTINU dans le jeu réel (pointermove répété). Un seul `hoverTile` peut être
  // écrasé par un re-render du HUD sous charge → on RE-survole à chaque itération du poll jusqu'à
  // ce que la carte reflète la cible (robuste, pas de course).
  const hoverCursorName = async (x: number, y: number): Promise<string | null> => {
    await scene.hoverTile(x, y);
    return cursor.name.textContent();
  };

  // Survol de l'adversaire (2,2) → carte curseur Dracaufeu, aux couleurs de l'équipe 2.
  await expect.poll(() => hoverCursorName(2, 2), { timeout: 10_000 }).toBe("Dracaufeu");
  await expect(cursor.panel).toHaveAttribute("data-team", "2");
  // Le panneau gauche n'a pas bougé : il montre toujours le Pokemon actif.
  await expect(info.name).toHaveText("Florizarre");

  // Survol d'une tile vide → la carte curseur se masque, le panneau gauche reste.
  await expect
    .poll(
      async () => {
        await scene.hoverTile(5, 5);
        return cursor.panel.isVisible();
      },
      { timeout: 10_000 },
    )
    .toBe(false);
  await expect(info.name).toHaveText("Florizarre");
});

// §4.7 — objet tenu (plan 168) : la ligne objet montre l'icône OFFICIELLE croppée de la feuille
// `item-icons.png` À CÔTÉ du nom FR (fini l'ancien texte « 🎒 {nom} »). L'icône porte toujours un `src`
// data-URL (crop réel ou pixel transparent de repli si la feuille n'est pas décodée) → on assert le SENS
// (icône présente + nom FR), pas le pixel. Le Pokemon actif au boot est le joueur Florizarre.
test("§4.7 info panel : objet tenu → icône officielle + nom FR (Restes)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(HELD_ITEM_ICONS);
  const info = new InfoPanel(page);

  await expect(info.item).toBeVisible();
  // Le texte de la ligne = le seul nom FR de l'objet (l'icône <img> est décorative, alt="").
  await expect(info.item).toHaveText("Restes");
  await expect(info.itemIcon).toBeVisible();
  await expect(info.itemIcon).toHaveAttribute("src", /^data:image\//);
});

// §4.7 — l'objet tenu suit le Pokemon SURVOLÉ, sur la carte curseur : survoler le dummy Dracaufeu
// (porteur de l'Orbe Vie) y affiche son objet (nom FR + icône), sur l'équipe 2. Re-survol par poll
// (hover continu, anti-course HUD), cf. le test de survol ci-dessus.
test("§4.7 info panel : survol du porteur → son objet tenu sur la carte curseur (Orbe Vie, team 2)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(HELD_ITEM_ICONS);
  const cursor = new CursorPanel(page);

  const hoverItem = async (x: number, y: number): Promise<string | null> => {
    await scene.hoverTile(x, y);
    return cursor.item.textContent();
  };

  await expect.poll(() => hoverItem(2, 2), { timeout: 10_000 }).toBe("Orbe Vie");
  await expect(cursor.panel).toHaveAttribute("data-team", "2");
  await expect(cursor.itemIcon).toBeVisible();
  await expect(cursor.itemIcon).toHaveAttribute("src", /^data:image\//);
});

// §4.7 — sans objet tenu, la ligne objet est MASQUÉE (DUEL : le joueur Florizarre ne tient rien).
test("§4.7 info panel : sans objet tenu → ligne objet masquée", async ({ page, bootSandbox }) => {
  await bootSandbox(DUEL);
  const info = new InfoPanel(page);

  await expect(info.panel).toBeVisible();
  await expect(info.item).toBeHidden();
});

// §4.7 — panneau enrichi d'un ALLIÉ (plan 174) : l'actif au boot est le joueur Florizarre (team 1),
// donc le panneau affiche chips de types, ligne PV avec pourcentage, talent et bloc des 5 stats. Avec
// `statStages.attack: +2`, la ligne Attaque (1ʳᵉ du bloc) montre le cran « 2↑ », la flèche « → » et la
// valeur effective modifiée (base ×2). DOM pur (view-model découplé du core), déterministe (seed DUEL).
test("§4.7 info panel : allié enrichi (types + PV% + talent + stats, cran → valeur modifiée)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(INFO_PANEL_ALLY_STATS);
  const info = new InfoPanel(page);

  await expect(info.panel).toBeVisible();
  await expect(info.panel).toHaveAttribute("data-team", "1");

  // Chips de types (Florizarre = Plante/Poison) — le libellé est CSS-uppercased, on asserte l'id.
  await expect(info.typeChips).toHaveCount(2);
  await expect(info.types.locator("li[data-type='grass']")).toBeVisible();
  await expect(info.types.locator("li[data-type='poison']")).toBeVisible();

  // Ligne PV : pourcentage secondaire (PV pleins au boot → « (100%) »).
  await expect(info.hpPct).toHaveText(/\(\d+%\)/);

  // Talent (ally-only) visible et non vide.
  await expect(info.talent).toBeVisible();
  await expect(info.talent).not.toBeEmpty();

  // Bloc des 5 stats (Atq/Déf/Atk Spé/Déf Spé/Vit).
  await expect(info.stats).toBeVisible();
  await expect(info.statRows).toHaveCount(5);

  // 1ʳᵉ ligne = Attaque, boostée +2 → crans « 2↑ », flèche « → », valeur effective ≠ base.
  const attackCells = info.statRows.first().locator("span");
  const baseValue = await attackCells.nth(1).textContent();
  await expect(attackCells.nth(2)).toHaveText("2↑"); // .ip-stat-crans
  await expect(attackCells.nth(3)).toHaveText("→"); // .ip-stat-arrow
  const modified = attackCells.nth(4); // .ip-stat-modified
  await expect(modified).toHaveText(/^\d+$/);
  await expect(modified).not.toHaveText(baseValue ?? "");
});

// §4.7 — un ENNEMI se lit EN ENTIER quand le fog est coupé (plan 176, décision humaine 2026-08-05) :
// le sandbox a le fog OFF par défaut, et couper le fog sert précisément à tout inspecter → la carte
// d'un adversaire montre alors les mêmes blocs qu'un allié (types, stats, talent). La règle « ennemi
// minimal » du plan 174 ne vaut plus que SOUS fog — donc toujours, en partie réelle : ce cas-là est
// testé avec `fogOfWar: true` dans `combat-fog.spec` (§4.15).
test("§4.7 info panel : ennemi sans fog → lecture complète (types + stats + talent)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(INFO_PANEL_ALLY_STATS);
  const cursor = new CursorPanel(page);

  await expect
    .poll(
      async () => {
        await scene.hoverTile(2, 2);
        return cursor.name.textContent();
      },
      { timeout: 10_000 },
    )
    .toBe("Dracaufeu");
  await expect(cursor.panel).toHaveAttribute("data-team", "2");

  // Types publics → toujours affichés (Dracaufeu = Feu/Vol).
  await expect(cursor.typeChips).toHaveCount(2);
  // Fog coupé → même lecture qu'un allié : bloc des 5 stats et talent en clair (pas de `???`).
  await expect(cursor.stats).toBeVisible();
  await expect(cursor.statRows).toHaveCount(5);
  await expect(cursor.talent).toBeVisible();
  await expect(cursor.talent).not.toBeEmpty();
  await expect(cursor.talent).toHaveAttribute("data-unknown", "");
});
