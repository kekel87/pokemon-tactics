import { expect, test } from "../../fixtures";
import { CombatScene } from "../../pages/CombatScene";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MapSelectScreen, TeamSelectScreen } from "../../pages/screens";

// Le vrai parcours joueur (pas la route sandbox ?config) : menu → mode → carte → équipe →
// combat. Prouve que le combat normal monte la MÊME scène Babylon (sprites "pokemon_plane")
// que la sandbox, donc que le hook scene-graph couvre les deux chemins de boot.
test("jeu normal : menu → carte → équipe → la scène de combat monte", async ({ page }) => {
  const menu = new MainMenu(page);
  const battleMode = new BattleModeScreen(page);
  const mapSelect = new MapSelectScreen(page);
  const teamSelect = new TeamSelectScreen(page);
  const scene = new CombatScene(page);

  /*
   * Garde de télémétrie (plan 196) : la suite ne doit émettre AUCUNE requête vers l'endpoint `/e`,
   * sinon les 519 tests pollueraient la base de production. Le garde-fou testé est
   * `platformPrefix()`, qui rend `null` hors des deux hôtes de publication — donc `null` sur
   * `localhost`. Posé sur CE test parce que c'est le seul qui parcourt le vrai chemin joueur, celui
   * où les compteurs d'écran et `battle_started` se déclenchent : ailleurs, l'assertion ne
   * prouverait rien.
   */
  const telemetryRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("workers.dev")) {
      telemetryRequests.push(request.url());
    }
  });

  await menu.goto();
  await menu.combat.click();
  await expect(battleMode.local).toBeVisible();
  await battleMode.local.click();

  // Carte 0 ("Arène Simple") présélectionnée → confirmer directement.
  await expect(mapSelect.title).toBeVisible();
  await mapSelect.confirm.click();

  // Joueur 1 (Humain) → IA lui attribue une équipe aléatoire ; Joueur 2 (IA) en a déjà une.
  await expect(teamSelect.title).toBeVisible();
  await teamSelect.giveSlotToAi();
  await expect(teamSelect.launch).toBeEnabled();
  await teamSelect.launch.click();

  // waitReady gate la NOUVELLE scène (map + atlas chargés, hook installé) — gère la transition
  // menu → combat. Mais en jeu normal les sprites sont ajoutés par la phase de placement auto,
  // APRÈS ce signal (≠ sandbox qui les auto-spawn à la création) → on poll la convergence du
  // placement, ce qui n'est pas un substitut au signal de loader mais l'attente d'une étape
  // asynchrone distincte (sans signal dédié).
  await scene.waitReady();
  await expect
    .poll(() => scene.countByName("pokemon_plane"), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(2);

  expect(telemetryRequests).toEqual([]);
});
