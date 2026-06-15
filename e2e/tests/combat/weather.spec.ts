import { expect, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";
import { WeatherHud } from "../../pages/combatHud";

// Cahier §5 (météo) — le HUD météo apparaît quand le combat a une météo active et affiche son nom
// FR + les tours restants. Booté par config sandbox seedée (météo posée d'emblée).
test("météo : le HUD affiche « Plein soleil » et les tours restants", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox({ ...DUEL, weather: "sun", weatherTurns: 5 });
  const weather = new WeatherHud(page);

  await expect(weather.hud).toBeVisible();
  await expect(weather.label).toHaveText("Plein soleil");
  await expect(weather.turns).toHaveText(/5\s*tour/);
});

// §5.12 — poser une météo via cast (interaction renderer). Les setters météo n'ont pas de jet de
// précision → déterministe. L'annonce flottante + l'icône exacte restent 👁 ; ici on prouve que le
// move se résout à travers l'orchestrateur.
const WEATHER_MOVES: [string, string][] = [
  ["rain-dance", "Danse Pluie"],
  ["sunny-day", "Zénith"],
  ["sandstorm", "Tempête de Sable"],
];
for (const [move, fr] of WEATHER_MOVES) {
  test(`§5.12 météo : ${fr} se pose (journal)`, async ({ page, bootSandbox }) => {
    const scene = await bootSandbox({ ...DUEL, moves: [move] });
    await scene.castFirstMove(2, 3); // self/field
    await expect(
      page.getByTestId("battle-log-entry").filter({ hasText: new RegExp(`utilise ${fr}`) }),
    ).toBeAttached({ timeout: 10_000 });
  });
}
