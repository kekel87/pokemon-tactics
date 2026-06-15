import { HOVER_CURSOR_OPTIONS } from "../constants";

const STORAGE_KEY = "pt-settings";

export interface GameSettings {
  damagePreview: boolean;
  hoverCursorKey: string;
}

const DEFAULT_SETTINGS: GameSettings = {
  damagePreview: true,
  hoverCursorKey: HOVER_CURSOR_OPTIONS[0].key,
};

let currentSettings: GameSettings = DEFAULT_SETTINGS;

function loadSettings(): GameSettings {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<GameSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

export function initSettings(): void {
  currentSettings = loadSettings();
}

export function getSettings(): GameSettings {
  return currentSettings;
}

export function updateSettings(patch: Partial<GameSettings>): void {
  currentSettings = { ...currentSettings, ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
}
