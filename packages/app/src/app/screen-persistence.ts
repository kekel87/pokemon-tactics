/*
 * Remembers which screen the player was on, so a reload lands back there (plan 180-b).
 *
 * Why this exists: on a phone the browser discards the tab under memory pressure (screen locked,
 * app switched away). No web API can prevent that — the tab-unloader is an OS/browser decision — so
 * the only robust answer is to SURVIVE the reload rather than try to avoid it.
 *
 * Deliberate scope: only screens that need NO parameter are remembered. `team-select` needs a
 * `mapUrl`, `team-edit` a `teamId`, `combat` a whole `CombatSetup` — restoring those without their
 * parameters is not possible, and restoring a battle means serialising engine state, which is
 * lot 180-c. Anything else falls back to the main menu, which is why a lost battle returns to the
 * menu instead of half-restoring something wrong.
 *
 * « Besoin d'aucun paramètre » et non « n'en prend aucun » : depuis le plan 199, `map-select` accepte
 * une intention de partie en ligne **optionnelle**, et se monte toujours sans rien. Conséquence
 * assumée : l'hôte qui recharge pendant qu'il choisit son terrain revient sur un choix de terrain
 * LOCAL, son intention en ligne étant perdue avec les paramètres. Il n'y a rien à sauver de mieux —
 * le salon lui-même n'existe plus, son adresse ayant été rendue à l'annuaire — et reprendre un
 * salon en cours est du Lot B3.
 */

import type { ScreenId, ScreenParamsById } from "./screens";

const STORAGE_KEY = "pt-last-screen";

/**
 * Screens whose `mount()` takes no parameters, derived from the params table rather than hand-typed:
 * adding a parameterless screen makes it eligible automatically, and giving an existing screen
 * parameters removes it from the union (and breaks the `satisfies` below until the list is fixed).
 */
type ParamlessScreenId = {
  [Id in ScreenId]: undefined extends ScreenParamsById[Id] ? Id : never;
}[ScreenId];

const RESTORABLE_SCREENS = [
  "main-menu",
  "battle-mode",
  // Le `lobby` ne prend aucun paramètre, et y revenir après un rechargement est la bonne réponse :
  // le salon qu'on était en train de préparer n'existe plus (l'adresse a été rendue à l'annuaire),
  // donc il faut le recréer ou le rejoindre. La reprise d'un salon en cours est du Lot B3.
  "lobby",
  "map-select",
  "my-teams",
  "settings",
  "credits",
] as const satisfies readonly ParamlessScreenId[];

/**
 * A menu screen left behind yesterday is noise, not a resumption — only a recent one is restored.
 * Sized to cover a long sleep/commute, not a new session.
 */
const MAX_AGE_MS = 60 * 60 * 1000;

interface PersistedScreen {
  id: ParamlessScreenId;
  savedAt: number;
}

/**
 * Takes a plain `string`, not a `ScreenId`: the value read back from storage is arbitrary text, and
 * narrowing straight from `string` lets the load path validate without a single type assertion.
 */
function isRestorable(id: string): id is ParamlessScreenId {
  return (RESTORABLE_SCREENS as readonly string[]).includes(id);
}

/**
 * Record the current screen. Screens carrying parameters clear the entry instead of storing one,
 * so leaving a menu for a battle cannot leave a stale menu behind to resume into.
 */
export function saveCurrentScreen(id: ScreenId): void {
  try {
    if (!isRestorable(id)) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const entry: PersistedScreen = { id, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Storage full or blocked (private mode). Losing the resume point is harmless.
  }
}

/** The screen to boot into, or `null` to start from the main menu as usual. */
export function loadPersistedScreen(): ParamlessScreenId | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const { id, savedAt } = parsed as Record<string, unknown>;
    if (typeof id !== "string" || typeof savedAt !== "number") {
      return null;
    }
    // Validated against the current screen table: a renamed or removed screen must not resurrect.
    if (!isRestorable(id)) {
      return null;
    }
    if (Date.now() - savedAt > MAX_AGE_MS) {
      return null;
    }
    return id;
  } catch {
    return null;
  }
}
