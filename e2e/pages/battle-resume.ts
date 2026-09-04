import type { Page } from "@playwright/test";

/**
 * The fields of the resume save a test judges. The rest of the payload (placements, setup, seed…) is
 * the source's business — a test that asserted its full shape would break on every schema change
 * without ever catching a real regression.
 */
export interface ResumeSaveDatum {
  version: number;
  buildVersion: string;
  mapUrl: string;
  /** Validated actions recorded so far — the only field that GROWS as the battle is played. */
  actionCount: number;
}

/**
 * Page Object for the battle-in-progress save (plan 181) — the `localStorage` entry that lets a tab
 * discarded mid-battle come back into it.
 *
 * The key is a **test contract**, like `pt-last-screen` in {@link AppShell}: the app writes it after
 * every validated action, the menu reads it to decide whether to offer « Reprendre le combat », and
 * a test judges the datum rather than the raw JSON.
 *
 * `write` takes RAW TEXT on purpose: a corrupt entry (invalid JSON) is one of the cases the reader
 * must survive, and it cannot be expressed as an object. Writing then reloading is also how the real
 * failure happens — the entry outlives the document, it is not injected before boot.
 */
export class BattleResumeStore {
  private static readonly KEY = "pt-battle-resume";

  /**
   * A save whose SHAPE is complete: every field the reader inspects is present and well-typed, so a
   * rejection can only come from the stamp a test tampers with (`version` / `buildVersion`) and never
   * from a field that would have been refused anyway. Deliberately carries no action: a rejected save
   * is never replayed, so its content is irrelevant — only its acceptance is under test.
   */
  static readonly wellFormedSave = {
    version: 1,
    buildVersion: "0.0.0-not-the-running-build",
    mapUrl: "assets/maps/simple-arena.tmj",
    setup: {
      teams: [
        { playerId: "player-1", pokemonDefinitionIds: ["raichu"], controller: "human" },
        { playerId: "player-2", pokemonDefinitionIds: ["arbok"], controller: "ai" },
      ],
      formatKey: "2v1",
      autoPlacement: true,
      damagePreview: true,
    },
    placementTeams: [
      { playerId: "player-1", availablePokemonIds: ["raichu"], controller: "human" },
      { playerId: "player-2", availablePokemonIds: ["arbok"], controller: "ai" },
    ],
    placements: [],
    seed: 1,
    actions: [],
    savedAt: 0,
  };

  constructor(private readonly page: Page) {}

  /** The datum of the stored save, or `null` when there is none (or it is not readable JSON). */
  async read(): Promise<ResumeSaveDatum | null> {
    const stored = await this.raw();
    if (stored === null) {
      return null;
    }
    const parsed = JSON.parse(stored) as {
      version?: number;
      buildVersion?: string;
      mapUrl?: string;
      actions?: unknown[];
    };
    return {
      version: parsed.version ?? -1,
      buildVersion: parsed.buildVersion ?? "",
      mapUrl: parsed.mapUrl ?? "",
      actionCount: parsed.actions?.length ?? -1,
    };
  }

  /** Recorded action count, or `-1` when no save is stored — poll-friendly (never throws). */
  async actionCount(): Promise<number> {
    return (await this.read())?.actionCount ?? -1;
  }

  raw(): Promise<string | null> {
    return this.page.evaluate((key) => localStorage.getItem(key), BattleResumeStore.KEY);
  }

  /** Replace the stored entry with arbitrary text. The next boot (reload) reads it. */
  async write(rawEntry: string): Promise<void> {
    await this.page.evaluate(([key, value]) => localStorage.setItem(key, value), [
      BattleResumeStore.KEY,
      rawEntry,
    ] as const);
  }
}
