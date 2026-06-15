import "./styles/sandbox-studio.css";
import { DEFAULT_SANDBOX_CONFIG, type SandboxConfig } from "./types/SandboxConfig";

function parseSandboxEnvConfig(): SandboxConfig | null {
  const raw = import.meta.env.VITE_SANDBOX_CONFIG;
  if (raw) {
    try {
      const partial = JSON.parse(raw) as Partial<SandboxConfig>;
      return { ...DEFAULT_SANDBOX_CONFIG, ...partial };
    } catch {
      throw new Error("Invalid VITE_SANDBOX_CONFIG JSON — check your sandbox config");
    }
  }
  return null;
}

export const sandboxBootConfig: { enabled: boolean; config: SandboxConfig | null } = {
  enabled: Boolean(import.meta.env.VITE_SANDBOX),
  config: import.meta.env.VITE_SANDBOX ? parseSandboxEnvConfig() : null,
};

export interface SandboxStudioDom {
  header: HTMLElement;
  headerActions: HTMLElement;
  columns: HTMLElement;
  playerColumn: HTMLElement;
  dummyColumn: HTMLElement;
  battleStrip: HTMLElement;
}

let cachedStudioDom: SandboxStudioDom | null = null;

/**
 * Build the studio chrome (header / player + dummy columns / battle strip) around
 * the game host. Phaser passes its `#game-container`; the Babylon build passes its
 * `#game-root` (which `sandbox-studio.css` reflows from fixed-fullscreen to a flex
 * child via `body[data-sandbox] #game-root`). Defaults to `#game-container`.
 */
export function initSandboxStudioDom(host?: HTMLElement): SandboxStudioDom {
  if (cachedStudioDom !== null) {
    return cachedStudioDom;
  }
  document.body.dataset.sandbox = "true";

  const gameContainer = host ?? document.getElementById("game-container");
  if (!gameContainer) {
    throw new Error("Sandbox studio: game host (#game-container) missing from DOM");
  }

  const header = document.createElement("header");
  header.className = "sb-header";

  const title = document.createElement("span");
  title.className = "sb-header-title";
  title.textContent = "Sandbox Studio";
  header.appendChild(title);

  const headerActions = document.createElement("div");
  headerActions.className = "sb-header-actions";
  header.appendChild(headerActions);

  const columns = document.createElement("div");
  columns.className = "sb-columns";

  const playerColumn = document.createElement("div");
  playerColumn.className = "sb-column sb-column-player";

  const dummyColumn = document.createElement("div");
  dummyColumn.className = "sb-column sb-column-dummy";

  columns.appendChild(playerColumn);
  columns.appendChild(dummyColumn);

  const battleStrip = document.createElement("footer");
  battleStrip.className = "sb-battle-strip";

  document.body.insertBefore(header, gameContainer);
  gameContainer.insertAdjacentElement("afterend", columns);
  columns.insertAdjacentElement("afterend", battleStrip);

  cachedStudioDom = {
    header,
    headerActions,
    columns,
    playerColumn,
    dummyColumn,
    battleStrip,
  };
  return cachedStudioDom;
}

export function getSandboxStudioDom(): SandboxStudioDom {
  if (cachedStudioDom === null) {
    throw new Error("Sandbox studio DOM not initialized — call initSandboxStudioDom() first.");
  }
  return cachedStudioDom;
}

/**
 * Remove the studio chrome (header / columns / battle strip) and the
 * `body[data-sandbox]` flag, so exiting the sandbox to the FSM main menu leaves a
 * clean DOM (the menu screen mounts into `#game-root`, a sibling of this chrome).
 */
export function teardownSandboxStudioDom(): void {
  if (cachedStudioDom === null) {
    return;
  }
  cachedStudioDom.header.remove();
  cachedStudioDom.columns.remove();
  cachedStudioDom.battleStrip.remove();
  cachedStudioDom = null;
  delete document.body.dataset.sandbox;
}
