import "./styles/layers.css";
// ui-dom component styles imported individually (not via the package index.css):
// Vite-dev does not resolve nested @imports inside a dependency's CSS, so the
// index.css @import chain silently unloaded every ui-dom style in dev.
import "@pokemon-tactic/ui-dom/styles/modal.css";
import "@pokemon-tactic/ui-dom/styles/info-panel.css";
import "@pokemon-tactic/ui-dom/styles/placement.css";
import "@pokemon-tactic/ui-dom/styles/battle-chrome.css";
import "@pokemon-tactic/ui-dom/styles/battle-log.css";
import "@pokemon-tactic/ui-dom/styles/move-tooltip.css";
import "@pokemon-tactic/ui-dom/styles/turn-timeline.css";
import "@pokemon-tactic/ui-dom/styles/weather-hud.css";
import "./styles/tokens.css";
import "./styles/game-overlay.css";
// Team Builder component styles + the overlay-contract adapter (Jalon 2c).
import "./styles/index.css";
import "./styles/team-builder-overlay.css";
import "./styles/menu-screens.css";
import "./styles/map-select.css";
import { mountGameStage } from "@pokemon-tactic/ui-dom";
import { type Navigate, ScreenManager } from "./app/screen-manager.js";
import { createBabylonPreview } from "./babylon/babylon-preview.js";
import { createCombatScreen, DEMO_POKEMON, mountSandboxStudio } from "./babylon/combat-screen.js";
import { getRendererBackend } from "./renderer-backend.js";
import { sandboxBootConfig, teardownSandboxStudioDom } from "./sandbox-boot.js";
import { DEFAULT_SANDBOX_CONFIG } from "./types/SandboxConfig.js";
import { createBattleModeScreen } from "./ui/dom/screens/battle-mode-screen.js";
import { createCreditsScreen } from "./ui/dom/screens/credits-screen.js";
import { createMainMenuScreen } from "./ui/dom/screens/main-menu-screen.js";
import { createMapSelectScreen } from "./ui/dom/screens/map-select-screen.js";
import { createMyTeamsScreen } from "./ui/dom/screens/my-teams-screen.js";
import { createSettingsScreen } from "./ui/dom/screens/settings-screen.js";
import { createTeamEditScreen } from "./ui/dom/screens/team-edit-screen.js";
import { createTeamSelectScreen } from "./ui/dom/screens/team-select-screen.js";

const root = document.getElementById("game-root");
if (!root) {
  throw new Error("Element #game-root not found");
}

const query = new URLSearchParams(window.location.search);
// Routes (plan 120 step 9):
//   default        → FSM boot on the main menu
//   VITE_SANDBOX   → straight into a player-vs-dummy sandbox combat (pnpm dev:sandbox)
//   ?combat=1      → straight to the combat screen (dev shortcut, Jalon 3 demo content)
//   ?map=<name>    → battlefield map (without `.tmj`) used by the combat/preview routes
//   ?preview=1     → dev tuning harness (free rotation, sliders, Team Builder toggle)
const mapName = query.get("map") ?? "desert";
const mapUrl = `/assets/maps/${mapName}.tmj`;
// Plan 125/126: the rendering backend is consumed through a seam so it stays
// swappable. The menus/team UI are engine-agnostic DOM; only the combat screen +
// sandbox studio consume the backend. Babylon is currently the sole engine.
const backend = getRendererBackend();

if (query.has("preview")) {
  document.getElementById("hint")?.removeAttribute("hidden");
  const stage = mountGameStage(root);
  createBabylonPreview({
    canvas: stage.canvas,
    worldLayer: stage.worldLayer,
    screenLayer: stage.screenLayer,
    mapUrl,
    pokemon: DEMO_POKEMON,
  });
} else {
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
    credits: () => createCreditsScreen(navigate),
    combat: () => createCombatScreen(navigate, backend),
  });
  if (sandboxBootConfig.enabled) {
    // The sandbox studio is mounted directly (not via the manager), so "Back to
    // menu" is a boot-level entry, not a guarded in-app navigation: tear down the
    // studio chrome + battle, then `start` (unguarded) the main menu.
    const studio = mountSandboxStudio(
      root,
      sandboxBootConfig.config ?? DEFAULT_SANDBOX_CONFIG,
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
    manager.start("main-menu", undefined).catch(reportScreenError);
  }
}
