import { expect, isMusicFile, test } from "../../fixtures";
import { MainMenu } from "../../pages/MainMenu";

// Le contrat du blocage des musiques (`fixtures/music-block.ts`) : il est VIVANT — le thème des
// menus est bien demandé derrière la barre de démarrage, volumes aux défauts du produit, et sa
// requête est avortée — et il ne bloque que la musique.
test("musique bloquée : le thème des menus est demandé puis avorté, les sons d'interface se chargent", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const abortedMusic: string[] = [];
  const loadedMusic: string[] = [];
  const loadedInterfaceSounds: string[] = [];
  const pageErrors: string[] = [];
  const fileOf = (url: string): string => url.slice(url.lastIndexOf("/") + 1);
  page.on("requestfailed", (request) => {
    if (isMusicFile(request.url())) {
      abortedMusic.push(fileOf(request.url()));
    }
  });
  page.on("requestfinished", (request) => {
    if (isMusicFile(request.url())) {
      loadedMusic.push(fileOf(request.url()));
    } else if (new URL(request.url()).pathname.includes("/assets/audio/ui/")) {
      loadedInterfaceSounds.push(fileOf(request.url()));
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await menu.goto();
  await expect(menu.combat).toBeVisible();

  // Le thème par défaut, demandé AVANT tout geste : c'est la barre de démarrage qui le précharge.
  await expect.poll(() => abortedMusic).toEqual(["frlg-title.mp3"]);
  await expect
    .poll(() => [...loadedInterfaceSounds].sort())
    .toEqual(["error.mp3", "move.mp3", "open.mp3"]);
  expect(loadedMusic).toEqual([]);
  expect(pageErrors).toEqual([]);
});
