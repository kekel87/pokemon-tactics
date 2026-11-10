import { expect, test } from "../../fixtures";
import { OnlineSession } from "../../pages/online-session";

/*
 * Cahier — le replay d'une partie EN LIGNE finie par un abandon (plan 243).
 *
 * Avant ce plan, le partage était réservé aux parties hors ligne : un abandon ne laissait aucune trace
 * dans les données rejouées, donc le replay s'arrêtait sans vainqueur. Ce scénario garde le contrat
 * inverse : le gagnant d'un duel en ligne gagné par abandon peut copier le code, et le replay montre
 * l'abandon au même moment, puis la victoire.
 *
 * Le préfixe `online-` range le spec dans la famille `online` de `scripts/e2e-affected.ts`.
 */
test.setTimeout(300_000);

test("replay en ligne : un duel gagné par abandon se copie et se rejoue jusqu'à la victoire", async ({
  browser,
}) => {
  const session = await OnlineSession.open(browser);
  const { host, guest } = session;

  try {
    await host.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await session.startBattle();
    await session.playOneTurn();
    await expect.poll(() => host.save.actionCount(), { timeout: 20_000 }).toBeGreaterThan(0);

    await guest.combatMenu.openByButton();
    await guest.combatMenu.abandon.click();
    await guest.combatMenu.confirm.click();

    // Chez le gagnant : la section Replay existe en ligne.
    await expect(host.victory).toBeVisible({ timeout: 30_000 });
    const share = host.page.getByTestId("replay-share");
    await expect(share).toBeVisible();
    await share.getByTestId("copy-replay").click();
    await expect(share.getByTestId("copy-replay")).toHaveText("Code copié !");
    const code = await host.page.evaluate(() => navigator.clipboard.readText());
    expect(code.startsWith("PTR2.")).toBe(true);

    // Le recoller au menu et le rejouer jusqu'au bout.
    await host.menu.goto();
    await host.menu.openReviewBattle();
    await host.page.getByTestId("replay-code-input").fill(code);
    await host.page.getByTestId("replay-start").click();
    await host.scene.waitReady();
    await expect(host.page.getByTestId("replay-bar")).toBeVisible({ timeout: 15_000 });

    const resigned = host.logEntries.filter({ hasText: "abandonne la partie" });
    await expect(resigned).toHaveCount(1, { timeout: 120_000 });
    await expect(host.battleOver).toBeVisible({ timeout: 30_000 });
    await expect(host.victoryHeading).toHaveText("Joueur 1 gagne !");
    await expect(host.page.getByTestId("replay-toggle")).toHaveAttribute("data-state", "paused");
  } finally {
    await session.close();
  }
});
