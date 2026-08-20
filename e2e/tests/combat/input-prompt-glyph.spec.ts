import type { Locator } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { DUEL, DUEL_DIRECTIONAL } from "../../fixtures/sandbox-configs";

// Cahier §4.8 — glyphe du geste attendu dans la ligne d'instruction (chantier « aide visuelle des
// gestes attendus », suite du Lot 1 du plan-cadre 173).
//
// La ligne d'instruction dit QUOI faire (« Choisis la direction ») mais jamais COMMENT : rien
// n'annonçait qu'une direction doit être retapée pour partir. Le glyphe porte donc le geste attendu
// dans `data-glyph` : `act` (un tap/clic agit) ou `act-twice` (les deux phases directionnelles).
//
// Ce qui est automatisable ici : le geste annoncé par phase, le suffixe « ×2 » réservé au pointeur
// grossier, et la NON-RÉGRESSION du texte de la pastille — celle-ci est passée d'un simple nœud de
// texte à une rangée (glyphe + texte), et une douzaine de specs assertent le `textContent` exact de
// `combat-instruction`. Le DESSIN (souris en pointeur fin, main en pointeur grossier, masque CSS sur
// la tuile Kenney) reste 👁 : c'est du pixel, et le choix est fait en CSS pur.

const GLYPH = "combat-input-glyph";
const INSTRUCTION = "combat-instruction";

/** Contenu du `::after` de la pastille — `"×2"` quand le suffixe est là, `none` sinon. Le suffixe
 *  est un pseudo-élément (pas un nœud), donc invisible à `toHaveText`. */
const suffix = (glyph: Locator): Promise<string> =>
  glyph.evaluate((node) => getComputedStyle(node, "::after").content);

test("§4.8 sélection de cible : un geste simple, et le texte de la pastille est intact", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click(); // Griffe → phase de ciblage

  // Le texte reste seul dans `combat-instruction` : le glyphe est un frère, pas un enfant.
  await expect(page.getByTestId(INSTRUCTION)).toHaveText("Sélectionne la cible");
  const glyph = page.getByTestId(GLYPH);
  await expect(glyph).toBeVisible();
  await expect(glyph).toHaveAttribute("data-glyph", "act");
});

test("§4.8 confirmation : un geste simple", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(DUEL);

  await scene.aimFirstMove(2, 2); // s'arrête sur l'étape de confirmation

  await expect(page.getByTestId(INSTRUCTION)).toHaveText("Confirmer ?");
  await expect(page.getByTestId(GLYPH)).toHaveAttribute("data-glyph", "act");
});

test("§4.8 destination de déplacement : un geste simple", async ({ page, bootSandbox }) => {
  await bootSandbox(DUEL);

  await page.getByRole("button", { name: "Deplacement", exact: true }).click();

  await expect(page.getByTestId(INSTRUCTION)).toHaveText("Où se déplacer ?");
  await expect(page.getByTestId(GLYPH)).toHaveAttribute("data-glyph", "act");
});

test("§4.8 case de repli (hit-and-run) : un geste simple", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["u-turn"] });

  // Demi-Tour frappe puis demande où se replier : la seule phase `selectRetreat` pilotable.
  await scene.castFirstMove(2, 2);

  await expect(page.getByTestId(INSTRUCTION)).toHaveText("Choisis la case de repli");
  await expect(page.getByTestId(GLYPH)).toHaveAttribute("data-glyph", "act");
});

test("§4.8 visée directionnelle : un second geste est annoncé", async ({ page, bootSandbox }) => {
  await bootSandbox(DUEL_DIRECTIONAL);

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click(); // Tranch'Herbe → visée par direction

  await expect(page.getByTestId(INSTRUCTION)).toHaveText("Choisis la direction");
  await expect(page.getByTestId(GLYPH)).toHaveAttribute("data-glyph", "act-twice");
});

test("§4.8 orientation de fin de tour : un second geste est annoncé", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);

  await page.getByRole("button", { name: "Attendre", exact: true }).click();

  await expect(page.getByTestId(INSTRUCTION)).toHaveText("Choisis l'orientation");
  await expect(page.getByTestId(GLYPH)).toHaveAttribute("data-glyph", "act-twice");
});

test("§4.8 hors phase d'input, la pastille entière disparaît (glyphe compris)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL);

  // Au menu racine puis dans le sous-menu d'attaque, aucune consigne : c'est la RANGÉE qui porte
  // l'attribut `hidden`, donc le glyphe ne doit pas survivre seul au masquage du texte.
  await expect(page.getByTestId(GLYPH)).toBeHidden();
  await expect(page.getByTestId(INSTRUCTION)).toBeHidden();

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await expect(page.getByTestId("move-item").first()).toBeVisible();
  await expect(page.getByTestId(GLYPH)).toBeHidden();
});

test("§4.8 à la souris, aucun suffixe « ×2 » même sur une phase directionnelle", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(DUEL_DIRECTIONAL);

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click();

  // Le second geste n'existe qu'au doigt : une souris valide une direction du premier clic. Le
  // geste attendu est bien `act-twice`, mais le suffixe reste muet en pointeur fin.
  await expect(page.getByTestId(GLYPH)).toHaveAttribute("data-glyph", "act-twice");
  expect(await suffix(page.getByTestId(GLYPH))).toBe("none");
});

test.describe("§4.8 pointeur grossier (au doigt)", () => {
  // `hasTouch` fait matcher `@media (pointer: coarse)`, la seule condition du suffixe et du dessin
  // de main. Téléphone paysage, la taille de référence du chrome mobile (§4.16).
  test.use({ hasTouch: true, viewport: { width: 851, height: 393 } });

  test("§4.8 la visée directionnelle affiche le suffixe « ×2 »", async ({ page, bootSandbox }) => {
    await bootSandbox(DUEL_DIRECTIONAL);

    await page.getByRole("button", { name: "Attaque", exact: true }).click();
    await page.getByTestId("move-item").first().click();

    await expect(page.getByTestId(GLYPH)).toHaveAttribute("data-glyph", "act-twice");
    expect(await suffix(page.getByTestId(GLYPH))).toBe('"×2"');
  });

  test("§4.8 une phase à geste simple n'affiche pas de suffixe", async ({ page, bootSandbox }) => {
    await bootSandbox(DUEL);

    await page.getByRole("button", { name: "Attaque", exact: true }).click();
    await page.getByTestId("move-item").first().click(); // Griffe → ciblage, un seul tap

    await expect(page.getByTestId(GLYPH)).toHaveAttribute("data-glyph", "act");
    expect(await suffix(page.getByTestId(GLYPH))).toBe("none");
  });
});
