import "./styles/tokens.css";
import "./styles/game-overlay.css";
import "./styles/info-panel.css";
// Team Builder component styles + the overlay-contract adapter (Jalon 2c).
import "./styles/index.css";
import "./styles/team-builder-overlay.css";
import "./styles/menu-screens.css";
import "./styles/map-select.css";
import { type Navigate, ScreenManager } from "./app/screen-manager.js";
import { createBabylonPreview } from "./babylon/babylon-preview.js";
import { createCombatScreen, DEMO_POKEMON, mountSandboxStudio } from "./babylon/combat-screen.js";
import { mountGameStage } from "./babylon/game-stage.js";
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
    combat: () => createCombatScreen(navigate),
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
    );
  } else if (query.has("combat")) {
    manager.start("combat", { mapUrl }).catch(reportScreenError);
  } else {
    manager.start("main-menu", undefined).catch(reportScreenError);
  }
}
