import { expect, test } from "../../fixtures";
import { DUEL, HELD_ITEM_ICONS, INFO_PANEL_ALLY_STATS } from "../../fixtures/sandbox-configs";
import { InfoPanel } from "../../pages/combatHud";

// Cahier §4 (panneau d'info) — le HUD chrome reflète l'identité + les PV du Pokemon actif.
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

// §4.7 — le survol d'une tile met à jour le panneau vers le Pokemon survolé (piloté par le hook
// hoverTile, qui rejoue le chemin pointer-move → orchestrateur). Survol d'une tile vide → repli sur
// le Pokemon actif.
test("§4.7 info panel : survoler l'adversaire affiche ses infos, tile vide → repli sur l'actif", async ({
  page,
  bootSandbox,
}) => {
  // Dummy = un vrai Pokemon adverse (Dracaufeu) pour vérifier le nom FR au survol.
  const scene = await bootSandbox({ ...DUEL, dummyPokemon: "charizard" });
  const info = new InfoPanel(page);

  // Le survol est CONTINU dans le jeu réel (pointermove répété). Un seul `hoverTile` peut être
  // écrasé par un re-render du HUD sous charge → on RE-survole à chaque itération du poll jusqu'à
  // ce que le panneau reflète la cible (robuste, pas de course).
  const hoverName = async (x: number, y: number): Promise<string | null> => {
    await scene.hoverTile(x, y);
    return info.name.textContent();
  };

  // Survol de l'adversaire (2,2) → panneau Dracaufeu.
  await expect.poll(() => hoverName(2, 2), { timeout: 10_000 }).toBe("Dracaufeu");
  await expect(info.panel).toHaveAttribute("data-team", "2");

  // Survol d'une tile vide → repli sur le Pokemon actif (Florizarre).
  await expect.poll(() => hoverName(5, 5), { timeout: 10_000 }).toBe("Florizarre");
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

// §4.7 — l'objet tenu suit le Pokemon SURVOLÉ : survoler le dummy Dracaufeu (porteur de l'Orbe Vie)
// affiche son objet dans le panneau (nom FR + icône), sur l'équipe 2. Re-survol par poll (hover continu,
// anti-course HUD), cf. le test de survol ci-dessus.
test("§4.7 info panel : survol du porteur → son objet tenu (Orbe Vie + icône, team 2)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(HELD_ITEM_ICONS);
  const info = new InfoPanel(page);

  const hoverItem = async (x: number, y: number): Promise<string | null> => {
    await scene.hoverTile(x, y);
    return info.item.textContent();
  };

  await expect.poll(() => hoverItem(2, 2), { timeout: 10_000 }).toBe("Orbe Vie");
  await expect(info.panel).toHaveAttribute("data-team", "2");
  await expect(info.itemIcon).toBeVisible();
  await expect(info.itemIcon).toHaveAttribute("src", /^data:image\//);
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

// §4.7 — un ENNEMI reste minimal (plan 174) : types publics affichés, mais PAS de bloc stats ni de
// talent. On survole le dummy Dracaufeu (team 2) puis on vérifie l'omission côté panneau.
test("§4.7 info panel : ennemi minimal (types visibles, stats + talent masqués)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(INFO_PANEL_ALLY_STATS);
  const info = new InfoPanel(page);

  await expect
    .poll(
      async () => {
        await scene.hoverTile(2, 2);
        return info.name.textContent();
      },
      { timeout: 10_000 },
    )
    .toBe("Dracaufeu");
  await expect(info.panel).toHaveAttribute("data-team", "2");

  // Types publics → toujours affichés (Dracaufeu = Feu/Vol).
  await expect(info.typeChips).toHaveCount(2);
  // Lecture privée réservée à l'allié : pas de bloc stats ni de talent pour un ennemi.
  await expect(info.stats).toBeHidden();
  await expect(info.talent).toBeHidden();
});
