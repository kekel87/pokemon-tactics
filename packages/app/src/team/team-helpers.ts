import type { PokemonGender, TeamSet, TeamSlot } from "@pokemon-tactic/core";
import type { OpSet } from "@pokemon-tactic/data";
import { countAction, TelemetryAction } from "../analytics/telemetry";
import { Language, t } from "../i18n";
import { resolveSlotGender } from "./gender-helpers";
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

/**
 * Une équipe vide, déjà sauvegardée, prête à ouvrir dans l'éditeur. Deux portes y mènent : « Mes
 * équipes » et le sélecteur d'équipe d'un camp (plan 228).
 */
export function createSavedEmptyTeam(): TeamSet {
  // Le Team Builder est-il utilisé, ou joue-t-on avec les équipes par défaut ? (plan 196)
  countAction(TelemetryAction.TeamSave);
  const team = createEmptyTeam(t("teamBuilder.untitledTeam"));
  saveTeam(team);
  return team;
}

export function touchTeam(team: TeamSet): TeamSet {
  return { ...team, updatedAt: Date.now() };
}

const DATE_LOCALES: Record<Language, string> = {
  [Language.French]: "fr-FR",
  [Language.English]: "en-US",
  [Language.Spanish]: "es-ES",
};

export function formatTeamDate(timestamp: number, language: Language): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(DATE_LOCALES[language], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Un emplacement tiré d'un build — partagé par le bouton « appliquer un build » et le tirage
 * aléatoire. Genre : celui déjà choisi, sinon celui qu'impose le build (Attraction de Ronflex),
 * sinon tiré (avec `rng` pour un tirage rejoué).
 */
export function slotFromOpSet(
  opSet: OpSet,
  currentGender: PokemonGender | undefined,
  rng?: () => number,
): TeamSlot {
  const gender = resolveSlotGender(
    opSet.pokemonId,
    currentGender ?? opSet.gender ?? undefined,
    rng,
  );
  return {
    pokemonId: opSet.pokemonId,
    ability: opSet.ability,
    nature: opSet.nature,
    moveIds: opSet.moveIds.slice(0, 4),
    statSpread: { ...opSet.statSpread },
    ...(opSet.heldItemId === null ? {} : { heldItemId: opSet.heldItemId }),
    ...(gender === undefined ? {} : { gender }),
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
