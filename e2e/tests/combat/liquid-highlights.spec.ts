import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Plan 219 — portées visibles sur les liquides. La nappe d'un liquide translucide (marais, eau,
// magma) est dessinée dans le groupe sprite (2), APRÈS le groupe terrain (0) : une surbrillance
// restée en groupe 0 sous la nappe était délavée (marais opaque à 0.9 → invisible). Les quads posés
// sur une case liquide passent donc en groupe 2 ; sur terre, ils restent en groupe 0.
// On assert le SENS (groupe de rendu via le hook scène), pas le pixel. L'ordre dans le groupe
// (`alphaIndex` 2 > nappe 1, aperçu 3) n'est pas exposé par `meshInfo` → couvert à l'œil (👁).
//
// Tourbière (`swamp.tmj`) : Florizarre en (6,4) sur le marais ; (5,4) marais, (6,2) terre ferme.
const SWAMP_DUEL = {
  ...DUEL,
  dummyPosition: { x: 3, y: 7 },
  mapUrl: "assets/maps/swamp.tmj",
};

test("plan 219 : la portée de déplacement sur le marais passe au-dessus de la nappe", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...SWAMP_DUEL, playerPosition: { x: 6, y: 4 } });
  await page.getByRole("button", { name: "Déplacement", exact: true }).click();
  await expect
    .poll(async () => (await scene.meshNames()).includes("highlight_move_5_4"))
    .toBe(true);

  const onSwamp = await scene.meshInfo("highlight_move_5_4");
  expect(onSwamp?.renderingGroupId).toBe(2);

  const onLand = await scene.meshInfo("highlight_move_6_2");
  expect(onLand, "highlight_move_6_2 should exist (terre ferme à portée)").not.toBeNull();
  expect(onLand?.renderingGroupId).toBe(0);
});

// Le contour de portée est UN seul mesh (`highlight_outline`) : dès qu'il touche une case liquide il
// suit les remplissages en groupe 2 ; entièrement sur la terre ferme, il reste en groupe 0.
// Griffe (portée 1) : en (6,4) les 4 voisines sont du marais ; en (6,1) elles sont toutes terre.
test("plan 219 : le contour de portée suit le marais en groupe sprite, reste en 0 sur terre", async ({
  page,
  bootSandbox,
}) => {
  const outlineGroupFrom = async (x: number, y: number): Promise<number | undefined> => {
    const scene = await bootSandbox({ ...SWAMP_DUEL, playerPosition: { x, y } });
    await page.getByRole("button", { name: "Attaque", exact: true }).click();
    await page.getByTestId("move-item").first().click();
    await expect.poll(() => scene.countByName("highlight_outline")).toBe(1);
    return (await scene.meshInfo("highlight_outline"))?.renderingGroupId;
  };

  expect(await outlineGroupFrom(6, 4)).toBe(2);
  expect(await outlineGroupFrom(6, 1)).toBe(0);
});
