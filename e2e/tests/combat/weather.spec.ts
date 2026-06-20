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

// §5.14 — roche de durée météo : le poseur tenant la roche correspondante prolonge la météo de 5 à
// 8 tours (miroir de la Roche Chaude/Soleil déjà couverte unit core). Damp-rock + Danse Pluie →
// Pluie 8 tours, lisible au compteur du HUD (`weather-turns`). Déterministe : les setters météo
// n'ont aucun jet de précision, et le timer ne décrémente qu'au tick de fin de tour (pas après le
// cast) → le HUD affiche 8 tours dès la résolution du move.
test("§5.14 roche météo : Roche Humide prolonge la Pluie à 8 tours (HUD)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["rain-dance"], heldItem: "damp-rock" });
  const weather = new WeatherHud(page);

  await scene.castFirstMove(2, 3); // self/field

  await expect(weather.label).toHaveText("Pluie", { timeout: 10_000 });
  await expect(weather.turns).toHaveText(/8\s*tour/);
});
