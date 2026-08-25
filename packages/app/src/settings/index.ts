const STORAGE_KEY = "pt-settings";

export interface GameSettings {
  damagePreview: boolean;
  /**
   * Sens du panoramique au stick droit (plan 186). `panCamera` parle le langage d'un GLISSÉ (on tire
   * le plateau, il suit le doigt), un stick celui d'un regard (je pousse à droite, je regarde à
   * droite) : les deux conventions sont opposées et le bon défaut dépend du joueur.
   */
  invertRightStick: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  damagePreview: true,
  invertRightStick: false,
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
