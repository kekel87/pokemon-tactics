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

export function initSandboxStudioDom(): SandboxStudioDom {
  if (cachedStudioDom !== null) {
    return cachedStudioDom;
  }
  document.body.dataset.sandbox = "true";

  const gameContainer = document.getElementById("game-container");
  if (!gameContainer) {
    throw new Error("Sandbox studio: #game-container missing from DOM");
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
