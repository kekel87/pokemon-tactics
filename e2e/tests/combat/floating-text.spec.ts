import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";

// Cahier §5.2 (texte flottant) — quand un coup résout, un libellé de dégâts (`hud_text_plane`,
// billboard face caméra) monte au-dessus de la cible puis disparaît (~1 s). On assert sa PRÉSENCE
// par comptage de mesh (le SENS : un nombre flotte), pas le pixel ni la couleur.
//
// NOTE : l'ESTIMATION de dégâts pré-confirmation (§3.4) n'est PAS un mesh — elle est peinte dans
// la texture de la barre PV (bande + nombre). Elle reste donc 👁 (non observable au scene-graph).
test("texte flottant : un libellé de dégâts apparaît quand Griffe résout", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);

  // Au repos, aucun libellé flottant.
  expect(await scene.countByName("hud_text_plane")).toBe(0);

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click(); // Griffe → select_attack_target
  await scene.clickTile(2, 2); // vise → confirm_attack
  await scene.clickTile(2, 2); // confirme → résolution → le texte flottant monte

  // Le libellé vit ~1 s : on poll à intervalle court (< sa durée de vie) pour fiabilité.
  await expect
    .poll(() => scene.countByName("hud_text_plane"), {
      timeout: 10_000,
      intervals: [80, 80, 80, 80, 80],
    })
    .toBeGreaterThan(0);
});
