/*
 * Persists a battle in progress so a reload can resume it (plan 181, lot 180-c).
 *
 * Why this exists: on a phone the browser discards the tab under memory pressure. Lot 180-b made the
 * MENU survive that; a battle — the long session, the one worth saving — still died. No web API
 * prevents the discard, so the answer is to survive it.
 *
 * What is stored, and what deliberately is NOT: the battle's INPUTS only — the map, the teams, the
 * resolved placements, the RNG seed, and the ordered list of validated actions. Never derived state
 * (HP, positions, Charge Time gauges, revealed items…). Replaying the action log on a freshly built
 * engine reproduces all of it exactly, because it is the very code that produced it the first time.
 * A hand-written state serialiser would instead have to enumerate every field of `PokemonInstance`
 * and every engine-private counter, and would silently rot the day one is added.
 *
 * That choice also decides the multiplayer story (Phase 7): an authoritative server holds the same
 * seed + action log, and a client that lost its connection resumes through this very path with the
 * log fetched from the server instead of from here. Hence the port shape below — swapping the store
 * must not touch the combat screen.
 */

import type { Action, PlacementEntry, PlacementTeam } from "@pokemon-tactic/core";
import type { CombatSetup } from "./screens";

const STORAGE_KEY = "pt-battle-resume";

/**
 * Bumped whenever the shape below changes in a way an older entry cannot satisfy. A save from another
 * schema is dropped, never migrated: a battle is cheap to lose, a wrongly restored one is not.
 */
const SAVE_VERSION = 1;

export interface BattleResumeSave {
  version: number;
  /**
   * `__APP_VERSION__` at save time. A game update can change a move's power or a formula, which would
   * make the replay diverge from what the player actually played — silently. Different build → drop.
   */
  buildVersion: string;
  mapUrl: string;
  setup: CombatSetup;
  placementTeams: PlacementTeam[];
  placements: PlacementEntry[];
  seed: number;
  actions: Action[];
}

/**
 * Storage port. The combat screen depends on this, not on `localStorage`, so the multiplayer
 * implementation (log fetched from an authoritative server) drops in without touching the screen.
 *
 * Note there is no time-based expiry, unlike `screen-persistence` (1 h). A battle in progress is a
 * commitment, not a screen left behind: it disappears when it ends, when the player walks back to the
 * menu, or when it can no longer be trusted (schema/build mismatch, replay failure) — never merely
 * because time passed.
 */
export interface BattleResumeStore {
  load(): BattleResumeSave | null;
  save(entry: Omit<BattleResumeSave, "version" | "buildVersion">): void;
  clear(): void;
}

/** Narrows arbitrary stored text to a save this build can actually replay. */
function isValidSave(parsed: unknown, buildVersion: string): parsed is BattleResumeSave {
  if (typeof parsed !== "object" || parsed === null) {
    return false;
  }
  const entry = parsed as Record<string, unknown>;
  if (entry.version !== SAVE_VERSION || entry.buildVersion !== buildVersion) {
    return false;
  }
  if (typeof entry.mapUrl !== "string" || typeof entry.seed !== "number") {
    return false;
  }
  if (!Array.isArray(entry.actions) || !Array.isArray(entry.placements)) {
    return false;
  }
  if (!Array.isArray(entry.placementTeams) || entry.placementTeams.length === 0) {
    return false;
  }
  const setup = entry.setup;
  if (typeof setup !== "object" || setup === null) {
    return false;
  }
  const { teams } = setup as Record<string, unknown>;
  return Array.isArray(teams) && teams.length > 0;
}

export function createBattleResumeStore(buildVersion: string): BattleResumeStore {
  return {
    load() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          return null;
        }
        const parsed: unknown = JSON.parse(stored);
        return isValidSave(parsed, buildVersion) ? parsed : null;
      } catch {
        // Corrupt JSON, or storage blocked (private mode). Treated as "no save".
        return null;
      }
    },
    save(entry) {
      try {
        const full: BattleResumeSave = { ...entry, version: SAVE_VERSION, buildVersion };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
      } catch {
        // Quota exceeded or storage blocked. Losing the resume point is harmless — the battle in
        // front of the player is unaffected, so this must never surface as an error.
      }
    },
    clear() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Same reasoning as `save`.
      }
    },
  };
}

let sharedStore: BattleResumeStore | null = null;

/**
 * The app-wide store, stamped with the running build.
 *
 * Resolved on first call rather than at import time: `__APP_VERSION__` is a Vite `define`, absent
 * under Vitest, so a module-level constant would make this file unimportable from a test.
 */
export function battleResumeStore(): BattleResumeStore {
  sharedStore ??= createBattleResumeStore(__APP_VERSION__);
  return sharedStore;
}
