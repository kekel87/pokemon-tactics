import { expect, test } from "../../fixtures";
import { MULTI_HIT } from "../../fixtures/sandbox-configs";

// Cahier §5 (multi-hit) — un move qui frappe plusieurs fois journalise un récapitulatif unique
// « Touché N fois ! ». Balle Graine (bullet-seed) = 100% précision (touche toujours) ; le seed fixe
// rend le nombre de coups déterministe. On assert le SENS (le récap multi-hit), pas le pixel.
test("multi-hit : Balle Graine touche le dummy plusieurs fois et journalise le récap", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(MULTI_HIT);

  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").first().click(); // Balle Graine → select_attack_target
  await scene.clickTile(2, 2); // vise le dummy → confirm_attack
  await scene.clickTile(2, 2); // confirme → résolution multi-hit

  // Récapitulatif multi-hit (1 seule ligne agrégée, ≥ 2 coups).
  await expect(
    page.getByTestId("battle-log-entry").filter({ hasText: /Touché \d+ fois/ }),
  ).toBeAttached({
    timeout: 10_000,
  });
});
