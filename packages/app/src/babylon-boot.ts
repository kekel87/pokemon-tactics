import "./styles/layers.css";
// ui-dom component styles imported individually (not via the package index.css):
// Vite-dev does not resolve nested @imports inside a dependency's CSS, so the
// index.css @import chain silently unloaded every ui-dom style in dev.
import "@pokemon-tactic/ui-dom/styles/modal.css";
import "@pokemon-tactic/ui-dom/styles/type-chip.css";
import "@pokemon-tactic/ui-dom/styles/status-chip.css";
import "@pokemon-tactic/ui-dom/styles/info-panel.css";
import "@pokemon-tactic/ui-dom/styles/tile-info-panel.css";
import "@pokemon-tactic/ui-dom/styles/placement.css";
import "@pokemon-tactic/ui-dom/styles/battle-chrome.css";
import "@pokemon-tactic/ui-dom/styles/battle-log.css";
import "@pokemon-tactic/ui-dom/styles/fullscreen-button.css";
import "@pokemon-tactic/ui-dom/styles/combat-menu-button.css";
import "@pokemon-tactic/ui-dom/styles/move-tooltip.css";
import "@pokemon-tactic/ui-dom/styles/turn-timeline.css";
import "@pokemon-tactic/ui-dom/styles/control-legend.css";
import "@pokemon-tactic/ui-dom/styles/weather-hud.css";
import "./styles/tokens.css";
import "./styles/game-overlay.css";
// Team Builder component styles + the overlay-contract adapter (Jalon 2c).
import "./styles/index.css";
import "./styles/team-builder-overlay.css";
import "./styles/menu-screens.css";
import "./styles/controls-screen.css";
import "./styles/combat-menu.css";
import "./styles/map-select.css";
import { initTelemetry } from "./analytics/telemetry.js";
import { type Navigate, ScreenManager } from "./app/screen-manager.js";
import { loadPersistedScreen } from "./app/screen-persistence.js";
import { createCombatScreen, mountSandboxStudio } from "./babylon/combat-screen.js";
import { initLanguage } from "./i18n/index.js";
import { initBindings } from "./input/bindings-store.js";
import { initInputSystem } from "./input/input-system.js";
import { resolveKeyLabels } from "./input/key-legend.js";
import { startWakeLock } from "./platform/wake-lock.js";
import { getRendererBackend } from "./renderer-backend.js";
import { sandboxBootConfig, teardownSandboxStudioDom } from "./sandbox-boot.js";
import { initSettings } from "./settings/index.js";
import {
  DEFAULT_SANDBOX_CONFIG,
  normalizeSandboxConfig,
  type SandboxConfig,
} from "./types/SandboxConfig.js";
import { createBattleModeScreen } from "./ui/dom/screens/battle-mode-screen.js";
import { createControlsScreen } from "./ui/dom/screens/controls-screen.js";
import { createCreditsScreen } from "./ui/dom/screens/credits-screen.js";
import { createMainMenuScreen } from "./ui/dom/screens/main-menu-screen.js";
import { createMapSelectScreen } from "./ui/dom/screens/map-select-screen.js";
import { createMyTeamsScreen } from "./ui/dom/screens/my-teams-screen.js";
import { createSettingsScreen } from "./ui/dom/screens/settings-screen.js";
import { createTeamEditScreen } from "./ui/dom/screens/team-edit-screen.js";
import { createTeamSelectScreen } from "./ui/dom/screens/team-select-screen.js";
import { mountOrientationPrompt } from "./ui/OrientationPrompt.js";
import { runSplash } from "./ui/SplashScreen.js";

const root = document.getElementById("game-root");
if (!root) {
  throw new Error("Element #game-root not found");
}

// Lire `pt-lang` (localStorage) sur TOUT chemin de boot — y compris l'entrée directe sandbox/combat
// (`?config`/`?combat`) qui ne passe pas par le menu. Sans ça, la langue restait figée au défaut
// (FR) hors navigation menu → HUD de combat en FR même avec `pt-lang=en` (bug backlog).
initLanguage();
// Idem pour les réglages (`pt-settings`) : sans cette lecture au boot, `getSettings()` restait sur
// les défauts en mémoire et un réglage persisté (ex. Prévisualisation dégâts OFF) redevenait ON au
// rechargement — et le gating du panneau de preview (plan 175) ne s'appliquait jamais.
initSettings();
initBindings();
// Télémétrie (plan 196) : n'installe qu'un écouteur `visibilitychange` — les compteurs partent
// groupés au masquage de l'onglet, jamais un envoi par clic. Neutralisée d'office hors des deux
// hôtes de publication, donc muette en développement, dans le bac à sable et sous Playwright.
initTelemetry();
// Couche d'entrée device-agnostique (plan 184) : un seul écouteur clavier pour toute l'app, et le
// suivi de la source active (souris / doigt / clavier / manette). Montée au boot, avant tout écran :
// les écrans et le combat s'y enregistrent à leur montage, y compris les chemins d'entrée directs
// (`?config`/`?combat`) qui ne passent pas par le menu.
initInputSystem();
// Real keyboard layout for the control legend (plan 185), fire-and-forget: the API is Chromium-only
// and the legend falls back to the game's language until (or unless) it answers. Kicked here so the
// answer has landed long before any combat mounts.
void resolveKeyLabels();

// Invite « tourne ton écran » (plan 179) : montée après `initLanguage()` pour que son texte parte
// dans la bonne langue. Sa visibilité est purement CSS (portrait + pointeur grossier), donc elle
// vit hors de la FSM d'écrans et couvre tous les chemins de boot, sandbox et combat direct inclus.
mountOrientationPrompt(document.body);

// Garde l'écran allumé pendant qu'on réfléchit à son tour (plan 180-b). Best-effort : absent de
// certains navigateurs, relâché par le navigateur en arrière-plan (d'où la ré-acquisition interne),
// et impuissant face à un verrouillage manuel ou à une décharge d'onglet sous pression mémoire.
startWakeLock();

const query = new URLSearchParams(window.location.search);
// Routes (plan 120 step 9):
//   default        → FSM boot on the main menu
//   VITE_SANDBOX   → straight into a player-vs-dummy sandbox combat (pnpm dev:sandbox)
//   ?combat=1      → straight to the combat screen (dev shortcut, Jalon 3 demo content)
//   ?map=<name>    → battlefield map (without `.tmj`) used by the combat route
const mapName = query.get("map") ?? "desert";
const mapUrl = `assets/maps/${mapName}.tmj`;
// Plan 125/126: the rendering backend is consumed through a seam so it stays
// swappable. The menus/team UI are engine-agnostic DOM; only the combat screen +
// sandbox studio consume the backend. Babylon is currently the sole engine.
const backend = getRendererBackend();

// E2E / dev: `?sandbox=1[&seed=N]` or `?config=<urlencoded JSON SandboxConfig>` boots a sandbox
// battle straight from the URL, so Playwright can vary the seeded scenario per navigation. Gated
// to dev/test builds (stripped from prod) — never a URL-driven battle injector in the shipped app.
// The env path (`VITE_SANDBOX_CONFIG`) still wins when set.
const urlSandboxAllowed = import.meta.env.DEV || import.meta.env.VITE_E2E === "true";
const sandboxConfigParam = urlSandboxAllowed ? query.get("config") : null;
const hasUrlSeed = query.has("seed");
const sandboxUrlSeed = Number(query.get("seed"));
const sandboxEnabled =
  sandboxBootConfig.enabled ||
  (urlSandboxAllowed && (query.has("sandbox") || sandboxConfigParam !== null));

function resolveSandboxConfig(): SandboxConfig {
  if (sandboxBootConfig.config) {
    return sandboxBootConfig.config;
  }
  if (sandboxConfigParam) {
    return normalizeSandboxConfig(JSON.parse(sandboxConfigParam));
  }
  if (hasUrlSeed && Number.isFinite(sandboxUrlSeed)) {
    return normalizeSandboxConfig({ seed: sandboxUrlSeed });
  }
  return DEFAULT_SANDBOX_CONFIG;
}
const sandboxConfig: SandboxConfig = resolveSandboxConfig();

async function boot(root: HTMLElement): Promise<void> {
  // Splash gate (plan 135): download the sprite bundle + decode the portrait sheet before
  // any screen renders a Pokemon. One gate covers every boot path (menu/combat/sandbox).
  await runSplash(root);

  const reportScreenError = (error: unknown): void => {
    // biome-ignore lint/suspicious/noConsole: surfacing a failed screen transition (otherwise swallowed by the FSM chain)
    console.error(error);
  };
  const navigate: Navigate = (id, params) => {
    manager.navigate(id, params).catch(reportScreenError);
  };
  const manager = new ScreenManager(root, {
    "main-menu": () => createMainMenuScreen(navigate),
    "battle-mode": () => createBattleModeScreen(navigate),
    "map-select": () => createMapSelectScreen(navigate),
    "team-select": () => createTeamSelectScreen(navigate),
    "my-teams": () => createMyTeamsScreen(navigate),
    "team-edit": () => createTeamEditScreen(navigate),
    settings: () => createSettingsScreen(navigate),
    controls: () => createControlsScreen(navigate),
    credits: () => createCreditsScreen(navigate),
    combat: () => createCombatScreen(navigate, backend),
  });
  if (sandboxEnabled) {
    // The sandbox studio is mounted directly (not via the manager), so "Back to
    // menu" is a boot-level entry, not a guarded in-app navigation: tear down the
    // studio chrome + battle, then `start` (unguarded) the main menu.
    const studio = mountSandboxStudio(
      root,
      sandboxConfig,
      (id, params) => {
        studio.dispose();
        teardownSandboxStudioDom();
        manager.start(id, params).catch(reportScreenError);
      },
      backend,
    );
  } else if (query.has("combat")) {
    manager.start("combat", { mapUrl }).catch(reportScreenError);
  } else {
    // Reprise silencieuse de l'écran quitté (plan 180-b) : un onglet déchargé pendant la veille
    // revient là où le joueur en était. Seuls les écrans sans paramètre sont restaurables — un
    // combat perdu retombe donc sur le menu (sa restauration est le lot 180-c). Les routes sandbox
    // et `?combat=` ci-dessus sont exclues à dessein : ce sont des entrées de dev, elles doivent
    // rester déterministes.
    manager.start(loadPersistedScreen() ?? "main-menu", undefined).catch(reportScreenError);
  }
}

void boot(root);
