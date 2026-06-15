import { Nature, type TeamSet, type TeamSlot } from "@pokemon-tactic/core";
import { saveTeam } from "./team-storage";

export function generateTeamId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `team-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyTeam(name: string): TeamSet {
  const now = Date.now();
  return {
    id: generateTeamId(),
    name,
    slots: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function touchTeam(team: TeamSet): TeamSet {
  return { ...team, updatedAt: Date.now() };
}

export function formatTeamDate(timestamp: number, language: "fr" | "en"): string {
  const date = new Date(timestamp);
  const locale = language === "fr" ? "fr-FR" : "en-US";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function defaultSlot(pokemonId: string, abilityId: string): TeamSlot {
  return {
    pokemonId,
    ability: abilityId,
    nature: Nature.Hardy,
    moveIds: [],
    statSpread: {},
  };
}

export class SaveDebouncer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: TeamSet | null = null;
  private readonly delayMs: number;
  private readonly listeners: Set<(team: TeamSet) => void> = new Set();

  constructor(delayMs = 300) {
    this.delayMs = delayMs;
  }

  onSaved(listener: (team: TeamSet) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  schedule(team: TeamSet): void {
    this.pending = team;
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending === null) {
      return;
    }
    const team = this.pending;
    this.pending = null;
    saveTeam(team);
    for (const listener of this.listeners) {
      listener(team);
    }
  }
}
