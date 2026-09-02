import type { TeamSelection } from "@pokemon-tactic/core";
import type { TelemetryTeam } from "../analytics/telemetry";
import type { BattleResumeSave } from "./battle-persistence";

/**
 * Screen FSM (plan 120) — screen IDs and legal transition table.
 * Source of truth for the transition diagram in docs/plans/120-jalon4a-fsm-scenes.md.
 */
export type ScreenId =
  | "main-menu"
  | "battle-mode"
  | "map-select"
  | "team-select"
  | "my-teams"
  | "team-edit"
  | "settings"
  | "controls"
  | "credits"
  | "combat";

/** Battle configuration carried from team-select into combat (plan 120 step 6). */
export interface CombatSetup {
  teams: TeamSelection[];
  formatKey: string;
  autoPlacement: boolean;
  /**
   * Provenance des équipes pour `battle_started` (plan 196). Portée ici parce que `TeamSelection`
   * (core) ne connaît pas la notion d'équipe éphémère : c'est un concept de l'écran de sélection,
   * et le core n'a pas à l'apprendre pour de la télémétrie.
   *
   * Absente sur les chemins qui ne passent pas par l'écran de sélection (bac à sable, `?combat=1`),
   * qui n'émettent donc rien — ce qui est le comportement voulu.
   */
  telemetryTeams?: readonly TelemetryTeam[];
}

/** Params passed to each screen's mount(). Extended as plan 120 steps land. */
export interface ScreenParamsById {
  "main-menu": undefined;
  "battle-mode": undefined;
  "map-select": undefined;
  "team-select": { mapUrl: string };
  "my-teams": undefined;
  "team-edit": { teamId: string };
  settings: undefined;
  controls: undefined;
  credits: undefined;
  /**
   * No `setup` = the `?combat=1` dev route (Jalon 3 demo content until step 7).
   * A `resume` (plan 181) rebuilds a battle from its saved action log and skips the placement phase.
   */
  combat: { mapUrl: string; setup?: CombatSetup; resume?: BattleResumeSave };
}

export const SCREEN_TRANSITIONS: Readonly<Record<ScreenId, readonly ScreenId[]>> = {
  // `combat` is reachable straight from the menu by the resume entry (plan 181) — the only way into a
  // battle that skips map + team selection, because the saved battle already carries both.
  "main-menu": ["battle-mode", "my-teams", "settings", "credits", "combat"],
  "battle-mode": ["map-select", "main-menu"],
  "map-select": ["team-select", "battle-mode"],
  "team-select": ["combat", "map-select"],
  "my-teams": ["team-edit", "main-menu"],
  "team-edit": ["my-teams"],
  settings: ["main-menu", "controls"],
  // On n'entre dans les contrôles que depuis Réglages : le retour y ramène, plutôt que d'éjecter le
  // joueur jusqu'au menu principal (revue 2026-08-25).
  controls: ["settings"],
  credits: ["main-menu"],
  combat: ["main-menu"],
};
