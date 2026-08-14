import { expect, test } from "../../fixtures";
import { AppShell } from "../../pages/app-shell";
import { MainMenu } from "../../pages/MainMenu";
import {
  BattleModeScreen,
  CreditsScreen,
  MapSelectScreen,
  SettingsScreen,
  TeamSelectScreen,
} from "../../pages/screens";

// Cahier §6.10 — comportement plateforme (plan 180-a/180-b) : manifeste PWA, reprise de l'écran
// courant au rechargement, ligne « Plein écran » des réglages.
//
// Ce qui reste 👁 par nature : entrer RÉELLEMENT en plein écran (Playwright ne donne pas de plein
// écran fiable et `requestFullscreen()` exige une activation utilisateur que le contexte de test
// rend instable), le verrouillage d'orientation, le Wake Lock, l'installation PWA et le
// comportement iOS. Ici on verrouille ce qui est *servi* et ce qui *survit à un rechargement*.

interface Manifest {
  name?: string;
  display?: string;
  icons?: { src?: string }[];
}

test("§6.10 manifeste PWA : servi, JSON valide, icônes réellement présentes", async ({
  request,
}) => {
  const response = await request.get("/manifest.json");
  expect(response.ok()).toBe(true);

  const manifest = (await response.json()) as Manifest;
  expect(manifest.name).toBe("Pokemon Tactics");
  // `standalone` est ce qui fait ouvrir l'app sans chrome navigateur une fois installée (Android).
  expect(manifest.display).toBe("standalone");

  const iconSources = (manifest.icons ?? []).map((icon) => icon.src);
  expect(iconSources.length).toBeGreaterThan(0);
  // Un manifeste dont les icônes 404 est refusé à l'installation (Android exige une icône ≥192px
  // atteignable) : on suit chaque `src`. Résolu contre l'URL DU MANIFESTE, comme le fait le
  // navigateur — les `src` sont relatifs à dessein, le jeu étant servi sous trois bases
  // différentes (`/`, `/pokemon-tactics/`, `./`).
  for (const source of iconSources) {
    const iconUrl = new URL(source ?? "", response.url()).toString();
    const icon = await request.get(iconUrl);
    expect(icon.ok(), `icône ${iconUrl} injoignable`).toBe(true);
    expect(icon.headers()["content-type"]).toContain("image/png");
  }
});

test("§6.10 le document déclare le manifeste, l'icône Apple et theme-color", async ({
  page,
  request,
}) => {
  const shell = new AppShell(page);
  // Métadonnées statiques du `<head>` : inutile d'attendre le splash, elles sont là au 1er paint.
  await page.goto("/");

  await expect(shell.themeColor).toHaveAttribute("content", "#1a1a2e");

  // Les deux `href` sont réécrits par Vite selon la base de déploiement → on ne fige pas la chaîne,
  // on vérifie qu'ils POINTENT sur un fichier servi (résolution contre l'URL du document).
  const manifestHref = await shell.manifestLink.getAttribute("href");
  const manifest = await request.get(new URL(manifestHref ?? "", page.url()).toString());
  expect(manifest.ok()).toBe(true);

  // iOS ignore les icônes du manifeste pour l'écran d'accueil → icône dédiée, qui doit exister.
  const appleTouchIconHref = await shell.appleTouchIcon.getAttribute("href");
  const appleTouchIcon = await request.get(
    new URL(appleTouchIconHref ?? "", page.url()).toString(),
  );
  expect(appleTouchIcon.ok()).toBe(true);
  expect(appleTouchIcon.headers()["content-type"]).toContain("image/png");
});

test("§6.10 reprise d'écran : l'écran de menu quitté est retrouvé au rechargement", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const credits = new CreditsScreen(page);
  const shell = new AppShell(page);
  await menu.goto();
  await menu.credits.click();
  await expect(credits.title).toBeVisible();

  // Enregistré au point unique du ScreenManager, après un montage réussi.
  expect(await shell.persistedScreenId()).toBe("credits");

  await shell.reload();

  // Le comportement visé : un onglet déchargé pendant la veille revient là où le joueur en était.
  await expect(credits.title).toBeVisible();
  await expect(credits.disclaimer).toBeVisible();
});

test("§6.10 reprise d'écran : un écran à paramètres n'est pas restauré (retour au menu)", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const maps = new MapSelectScreen(page);
  const teams = new TeamSelectScreen(page);
  const shell = new AppShell(page);

  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await expect(maps.title).toBeVisible();
  // « Choix de la carte » est sans paramètre → restaurable, donc enregistré.
  expect(await shell.persistedScreenId()).toBe("map-select");

  await maps.confirm.click();
  await expect(teams.title).toBeVisible();
  // « Sélection d'équipe » exige un `mapUrl` : le point de reprise est EFFACÉ, pas laissé sur le
  // menu précédent — sinon un rechargement ferait réapparaître un écran qu'on avait quitté.
  expect(await shell.persistedScreenId()).toBeNull();

  await shell.reload();
  await expect(menu.title).toBeVisible();
  await expect(menu.combat).toBeVisible();
});

test("§6.10 réglages : ligne « Plein écran » présente, consigne d'installation iOS absente", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  await menu.goto();
  await menu.settings.click();
  await expect(settings.title).toBeVisible();

  await expect(page.getByText("Plein écran", { exact: true })).toBeVisible();
  await expect(settings.fullscreenToggle).toBeVisible();
  // L'état est lu du document, pas d'une préférence persistée : hors plein écran → « NON ».
  await expect(settings.fullscreenToggle).toHaveText("NON");

  // La ligne d'installation est réservée à un iPhone non installé : ailleurs elle ne doit pas
  // exister du tout (et non pas s'afficher inerte).
  await expect(settings.installHint).toHaveCount(0);
});

test("§6.10 réglages : la bascule entre en plein écran puis en ressort (aller-retour)", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const settings = new SettingsScreen(page);
  const shell = new AppShell(page);
  await menu.goto();
  await menu.settings.click();

  // Le clic Playwright porte l'activation utilisateur : `requestFullscreen()`, appelé
  // SYNCHRONIQUEMENT dans le handler, est donc accordé (c'est la règle de séquencement n°1 de
  // `platform/fullscreen.ts`, celle qu'un `await` mal placé casserait en silence).
  await settings.fullscreenToggle.click();

  await expect.poll(() => shell.isFullscreen()).toBe(true);
  // Le libellé se relit depuis le document via `fullscreenchange`, pas depuis un état local.
  await expect(settings.fullscreenToggle).toHaveText("OUI");

  // Second clic = chemin de sortie réel, et remise à l'état neutre par la même occasion.
  await settings.fullscreenToggle.click();

  await expect.poll(() => shell.isFullscreen()).toBe(false);
  await expect(settings.fullscreenToggle).toHaveText("NON");
});
