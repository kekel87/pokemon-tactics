import { expect, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";

// Cahier §6.1.
test("menu principal : titre, 4 entrées FR, Aventure désactivée « Bientôt », version", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  await menu.goto();

  await expect(menu.title).toBeVisible();
  await expect(menu.adventure).toBeVisible();
  await expect(menu.combat).toBeVisible();
  await expect(menu.settings).toBeVisible();
  await expect(menu.credits).toBeVisible();

  await expect(menu.adventure).toBeDisabled();
  await expect(menu.adventure).toHaveAccessibleName("Aventure Bientôt");
  // « Revoir un combat » et « Constructeur d'équipe » ont déménagé au Stade de Combat (plan 251).
  await expect(page.getByRole("button", { name: "Revoir un combat" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Constructeur d'équipe" })).toHaveCount(0);
  await expect(menu.version).toBeVisible();
});

test("menu principal : bascule FR → EN (libellés + localStorage pt-lang)", async ({ page }) => {
  const menu = new MainMenu(page);
  await menu.goto();

  await expect(menu.languageToggle).toHaveText("FR");
  await menu.languageToggle.click();

  await expect(menu.languageToggle).toHaveText("EN");
  await expect(
    page.getByRole("button", { name: "Adventure Coming soon", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Battle Stadium", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("pt-lang"))).toBe("en");
});
