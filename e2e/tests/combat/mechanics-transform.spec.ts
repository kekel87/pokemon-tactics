import { expect, test } from "../../fixtures";
import {
  IMPOSTER_DITTO,
  MORPH_MEW,
  MORPH_TERRAIN,
  MORPH_TERRAIN_CONTROL,
} from "../../fixtures/sandbox-configs";
import { InfoPanel } from "../../pages/combatHud";

// Cahier §5.34 — famille Transform (plan 157) : Morphing (move), Imposteur (talent), Métamorph (Ditto),
// pilotée à travers le renderer. Les unit/integration core couvrent la copie pure (stats, crans,
// types, base-speed → tempo, gates d'échec, cleanup KO). Ici on prouve les observables PILOTABLES et
// déterministes : la ligne de journal FR « … se transforme ! » (event Transformed), le menu d'attaque
// qui liste les moves COPIÉS de la cible, l'identité de l'InfoPanel qui reste celle du lanceur (barre
// de PV inchangée), et l'héritage terrain du type copié (#659). Le SWAP D'ATLAS (sprite qui devient
// celui de la cible) est un fait de TEXTURE que le hook scène n'expose pas → 👁 au cahier.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.34 Morphing : Mew lance Morphing sur le Léviator adjacent → journal « Mew se transforme ! ».
test("§5.34 Morphing : Mew se transforme en la cible (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(MORPH_MEW);
  await scene.castFirstMove(3, 2); // le Léviator adjacent au nord
  await expect(log(page, /Mew se transforme/)).toBeAttached({ timeout: 10_000 });
});

// §5.34 Morphing : après le morph, le menu d'attaque liste les moves de Léviator (« Cascade ») et
// plus « Morphing » — tout le moveset a été remplacé par celui de la cible (`effectiveMoveIds`).
test("§5.34 Morphing : le menu d'attaque montre les moves copiés de la cible", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(MORPH_MEW);

  await scene.castFirstMove(3, 2);
  await expect(log(page, /Mew se transforme/)).toBeAttached({ timeout: 10_000 });

  // Le tour du joueur s'achève sur le cast ; on attend (fin de tour → le dummy inerte rejoue) pour
  // revenir sur Mew avec un menu d'action FRAIS, puis on ouvre le sous-menu Attaque.
  await scene.endTurn();
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  const moveName = page.getByTestId("move-name");
  await expect(moveName.filter({ hasText: "Cascade" })).toBeAttached({ timeout: 10_000 });
  await expect(moveName.filter({ hasText: "Morphing" })).toHaveCount(0);
});

// §5.34 Morphing : l'identité de l'InfoPanel reste celle du lanceur — le nom demeure « Mew » et la
// barre de PV ne saute pas à celle de Léviator (le morph copie les stats de combat mais PAS les PV,
// #649 ; le nom + le portrait dérivent du `definitionId` de base, pas de `transformState`). Le swap
// visible n'est QUE celui du sprite (atlas), non observable par le hook scène → 👁.
test("§5.34 Morphing : l'InfoPanel garde l'identité et les PV du lanceur (Mew)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(MORPH_MEW);
  const info = new InfoPanel(page);

  await scene.hoverTile(3, 3);
  await expect(info.name).toHaveText("Mew", { timeout: 10_000 });
  const hpBefore = await info.hpText.textContent();

  await scene.castFirstMove(3, 2);
  await expect(log(page, /Mew se transforme/)).toBeAttached({ timeout: 10_000 });

  // Le survol est CONTINU dans le jeu réel ; un seul hoverTile peut être écrasé par un re-render du
  // HUD → on RE-survole à chaque itération du poll jusqu'à ce que le panneau reflète Mew, puis on
  // vérifie que le nom ET la barre de PV n'ont pas changé (identité du lanceur préservée).
  await expect
    .poll(
      async () => {
        await scene.hoverTile(3, 3);
        return info.name.textContent();
      },
      { timeout: 10_000 },
    )
    .toBe("Mew");
  await expect(info.hpText).toHaveText(hpBefore ?? "");
});

// §5.34 Héritage terrain (#659) : un Mew (Psychic, au sol) morphé en Léviator (Eau/Vol) LÉVITE sur le
// marais → aucun poison de terrain en fin de tour. On assert l'ABSENCE de la ligne « marécage ».
test("§5.34 Morphing : le type Vol copié fait léviter le morphé sur le marais (aucun poison)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(MORPH_TERRAIN);

  await scene.castFirstMove(3, 2); // morph en Léviator (Eau/Vol) → lévitation
  await expect(log(page, /Mew se transforme/)).toBeAttached({ timeout: 10_000 });

  // On passe un tour complet pour déclencher l'effet de terrain de fin de tour : le morphé qui lévite
  // n'est PAS empoisonné par le marais sous lui.
  await scene.endTurn();
  await expect(log(page, /Tour de/).first()).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /marécage/)).toHaveCount(0);
});

// §5.34 Témoin : un Mew NON transformé sur le marais EST empoisonné en fin de tour → prouve que
// l'immunité du cas précédent vient bien du type Vol copié, et non de la case.
test("§5.34 témoin terrain : un Mew au sol non transformé est empoisonné par le marais", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(MORPH_TERRAIN_CONTROL);
  await scene.endTurn(); // Mew attend sur le marais, sans morpher
  await expect(log(page, /marécage/)).toBeAttached({ timeout: 10_000 });
});

// §5.34 Imposteur : Métamorph (ditto, talent `imposter`) se transforme AUTOMATIQUEMENT à l'entrée en
// combat sur l'ennemi le plus proche (Léviator) → la ligne « se transforme ! » monte DÈS le boot,
// sans aucune action. Le nom affiché de ditto n'est pas garanti par l'i18n → assertion name-agnostic.
test("§5.34 Imposteur : Métamorph se transforme à l'entrée en combat (journal)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(IMPOSTER_DITTO);
  await expect(log(page, /se transforme/)).toBeAttached({ timeout: 10_000 });
});

// §5.34 Imposteur : la transformation à l'entrée remplace le moveset → dès le tour 1, le menu d'attaque
// de Métamorph liste les moves de Léviator (« Cascade ») et plus « Morphing » (son unique move natif).
test("§5.34 Imposteur : le menu du tour 1 montre déjà les moves copiés de la cible", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(IMPOSTER_DITTO);
  await expect(log(page, /se transforme/)).toBeAttached({ timeout: 10_000 });

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  const moveName = page.getByTestId("move-name");
  await expect(moveName.filter({ hasText: "Cascade" })).toBeAttached({ timeout: 10_000 });
  await expect(moveName.filter({ hasText: "Morphing" })).toHaveCount(0);
});
