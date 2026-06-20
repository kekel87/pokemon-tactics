import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";
import { InfoPanel } from "../../pages/combatHud";

// Cahier §3.6 / §7 — rendu issu du bundle de sprites (plan 135). Les sprites + portraits ne
// shippent plus en 4 fichiers par Pokemon mais en un bundle unique (`sprites.bin` + manifeste +
// `portraits.png`) téléchargé au boot derrière le splash, puis slicé au runtime. On vérifie que ce
// chemin de slicing produit bien le rendu attendu — billboard en scène + portrait croppé en DOM —
// sans tester le pixel (couleur/anim = 👁).

test("bundle : le combat sandbox monte les billboards Pokemon slicés depuis le bundle", async ({
  bootSandbox,
}) => {
  // `bootSandbox` franchit déjà le splash (bundle chargé) puis `waitReady()` (scène prête). Si le
  // bundle n'était pas en mémoire, le rendu du sprite échouerait → la scène ne deviendrait jamais
  // prête. Atteindre `waitReady` PUIS compter 2 billboards prouve que le slicing a alimenté la scène.
  const scene = await bootSandbox(DUEL);
  expect(await scene.isReady()).toBe(true);
  await expect.poll(() => scene.countByName("pokemon_plane")).toBe(2);
});

test("bundle : le portrait de l'InfoPanel est croppé depuis la feuille (`portraits.png`)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);
  const info = new InfoPanel(page);

  // Le portrait est rendu par un `<img>` dont le `src` est un data-URL croppé de la feuille décodée
  // au boot (`preparePortraitSheet`). Un data-URL PNG non vide = la cellule a bien été extraite du
  // bundle (et non un fichier par-Pokemon ou le pixel transparent de repli).
  await expect(info.portrait).toBeVisible();
  await expect(info.portrait).toHaveJSProperty("complete", true);
  const src = await info.portrait.getAttribute("src");
  expect(src).toMatch(/^data:image\/png;base64,/);
  // Le pixel transparent 1x1 de repli est une constante connue : on s'assure que le portrait n'est
  // PAS ce fallback (donc la feuille était prête et la cellule a été croppée).
  expect(src).not.toContain("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwC");
});

// Pré-évo nouvellement jouable (roster Gen 1 complété) : Pikachu (un pré-évo de Raichu) est
// sélectionnable en sandbox et rend son billboard comme n'importe quel Pokemon — le slicing du
// bundle couvre tout le roster, pas seulement les évolutions finales.
test("bundle : un pré-évo (Pikachu) rend son sprite en combat", async ({ bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, pokemon: "pikachu", dummyPokemon: "pikachu" });
  expect(await scene.isReady()).toBe(true);
  await expect.poll(() => scene.countByName("pokemon_plane")).toBe(2);
});
