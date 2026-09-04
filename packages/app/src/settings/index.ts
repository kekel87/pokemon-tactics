const STORAGE_KEY = "pt-settings";

/**
 * Préférences persistées du joueur — réglages d'interface ET derniers paramètres de partie choisis
 * (plan 198).
 *
 * Le second groupe (`autoPlacement`, `damagePreview`) n'est PAS lu en cours de combat : ce sont des
 * paramètres de partie, gelés dans le `CombatSetup` à l'entrée en combat (décision #893). Ce magasin
 * ne retient que le dernier choix, pour le re-proposer à l'écran de sélection d'équipe. Le **bac à
 * sable** est le seul lecteur direct restant : c'est le seul chemin qui monte un vrai combat sans
 * configuration de partie. (`?combat=1` n'en est pas un — cette route s'arrête à `mountDemoContent`
 * et ne construit aucun `PresentationContext`, donc elle ne lit ni l'un ni l'autre.)
 *
 * Un magasin séparé pour ce second groupe serait plus pur, mais coûterait une migration pour aucun
 * effet visible (décision #894).
 */
export interface GameSettings {
  /** Paramètre de partie — voir l'en-tête. */
  damagePreview: boolean;
  /** Paramètre de partie — voir l'en-tête. */
  autoPlacement: boolean;
  /**
   * Sens du panoramique au stick droit (plan 186). `panCamera` parle le langage d'un GLISSÉ (on tire
   * le plateau, il suit le doigt), un stick celui d'un regard (je pousse à droite, je regarde à
   * droite) : les deux conventions sont opposées et le bon défaut dépend du joueur.
   */
  invertRightStick: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  damagePreview: true,
  autoPlacement: true,
  invertRightStick: false,
};

let currentSettings: GameSettings = DEFAULT_SETTINGS;

/**
 * Fusionne le magasin lu avec les défauts, en n'acceptant qu'une valeur du BON TYPE.
 *
 * Une clé absente prend son défaut : c'est ce qui dispense ce magasin de toute migration quand on
 * lui ajoute un champ, et qui préserve les choix déjà enregistrés (décision #894).
 *
 * Le contrôle de type n'est pas de la paranoïa depuis le plan 198 : ces valeurs ne pilotent plus
 * seulement l'affichage, elles sont **gelées dans le `CombatSetup`** à l'entrée en combat. Un
 * `{"damagePreview": null}` — magasin trafiqué, ou futur bug d'écriture — traversait le `spread`
 * sans bruit et désactivait la prévision pour toute la partie ; un `"false"` (chaîne) l'aurait
 * activée. On ignore la valeur et on garde le défaut, plutôt que de propager un type faux.
 */
function mergeWithDefaults(parsed: Record<string, unknown>): GameSettings {
  const merged = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof GameSettings)[]) {
    const value = parsed[key];
    if (typeof value === typeof DEFAULT_SETTINGS[key]) {
      merged[key] = value as GameSettings[typeof key];
    }
  }
  return merged;
}

function loadSettings(): GameSettings {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      // `JSON.parse` rend aussi bien `null`, un nombre ou un tableau qu'un objet : seul un objet
      // porte des réglages, tout le reste vaut « rien d'enregistré ».
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return DEFAULT_SETTINGS;
      }
      return mergeWithDefaults(parsed as Record<string, unknown>);
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
