import { COMBAT_SPEEDS, CombatSpeed, setCombatSpeed } from "@pokemon-tactic/view-core";
import { initAudio, setMasterVolume } from "../audio/audio-player";
import { DEFAULT_MAP_ID } from "../maps/random-map-id";

const STORAGE_KEY = "pt-settings";

/** The volume slider's range and step, in percent (plan 238). */
export const MAX_VOLUME = 100;
export const VOLUME_STEP = 5;

/** Whose turn is announced by a short cry (plan 238). */
export const TurnCries = {
  None: "none",
  Mine: "mine",
  All: "all",
} as const;
export type TurnCries = (typeof TurnCries)[keyof typeof TurnCries];
export const TURN_CRIES: readonly TurnCries[] = Object.values(TurnCries);

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
   * La dernière carte jouée, par identifiant stable (plan 208).
   *
   * 🔴 Elle est devenue une préférence le jour où l'écran de choix du terrain a disparu : plus
   * personne ne traverse un écran de sélection, donc une carte doit être retenue d'office. Arbitré
   * avec l'humain — la dernière jouée, et `DEFAULT_MAP_ID` (Arène Simple) tant qu'il n'y a rien
   * d'enregistré : voir son en-tête pour pourquoi ce n'est PAS un tirage.
   *
   * Validée à la LECTURE contre le registre (`knownMapIdOrDefault`), pas ici : ce magasin ne connaît
   * pas les cartes, et une carte retirée du jeu ne doit pas ressusciter par le stockage.
   */
  lastMapId: string;
  /**
   * Sens du panoramique au stick droit (plan 186). `panCamera` parle le langage d'un GLISSÉ (on tire
   * le plateau, il suit le doigt), un stick celui d'un regard (je pousse à droite, je regarde à
   * droite) : les deux conventions sont opposées et le bon défaut dépend du joueur.
   */
  invertRightStick: boolean;
  /**
   * Vitesse des combats (plan 233) : réglage d'interface, purement local — il ne touche ni au moteur
   * ni au réseau, donc il s'applique en direct, y compris en plein combat (menu de combat).
   */
  combatSpeed: CombatSpeed;
  /** Volume général en pourcentage, 0 à `MAX_VOLUME` (plan 238). */
  volume: number;
  /** Son coupé (plan 238) — à part du volume, qu'on retrouve tel quel en réactivant. */
  muted: boolean;
  /** Cri au début du tour (plan 238) : personne, les Pokémon joués à cet écran, ou tous. */
  turnCries: TurnCries;
}

const DEFAULT_SETTINGS: GameSettings = {
  damagePreview: true,
  autoPlacement: true,
  lastMapId: DEFAULT_MAP_ID,
  invertRightStick: false,
  combatSpeed: CombatSpeed.Normal,
  volume: 75,
  muted: false,
  turnCries: TurnCries.Mine,
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
  /*
   * L'écriture passe par un accumulateur `Record<string, unknown>` plutôt que par `merged[key]`
   * directement : depuis que le magasin mêle des booléens et une chaîne (`lastMapId`, plan 208), le
   * type de `merged[key]` est l'INTERSECTION des deux, donc `never`, et aucune valeur ne s'y
   * assigne. Le contrôle de type reste le même — c'est lui qui fait la sûreté, pas l'écriture.
   */
  const writable: Record<string, unknown> = merged;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const value = parsed[key];
    if (typeof value === typeof DEFAULT_SETTINGS[key as keyof GameSettings]) {
      writable[key] = value;
    }
  }
  // Une chaîne ne suffit pas : seule une vitesse connue passe.
  if (!COMBAT_SPEEDS.includes(merged.combatSpeed)) {
    merged.combatSpeed = DEFAULT_SETTINGS.combatSpeed;
  }
  if (!Number.isInteger(merged.volume) || merged.volume < 0 || merged.volume > MAX_VOLUME) {
    merged.volume = DEFAULT_SETTINGS.volume;
  }
  if (!TURN_CRIES.includes(merged.turnCries)) {
    merged.turnCries = DEFAULT_SETTINGS.turnCries;
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

/** The gain the audio plays at, 0..1: the volume, unless muted. */
function effectiveVolume(settings: GameSettings): number {
  return settings.muted ? 0 : settings.volume / MAX_VOLUME;
}

export function initSettings(): void {
  currentSettings = loadSettings();
  setCombatSpeed(currentSettings.combatSpeed);
  initAudio(effectiveVolume(currentSettings));
}

export function getSettings(): GameSettings {
  return currentSettings;
}

export function updateSettings(patch: Partial<GameSettings>): void {
  currentSettings = { ...currentSettings, ...patch };
  setCombatSpeed(currentSettings.combatSpeed);
  setMasterVolume(effectiveVolume(currentSettings));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
}
