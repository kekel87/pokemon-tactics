import type { TeamSelection } from "@pokemon-tactic/core";

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
  | "credits"
  | "combat";

/** Battle configuration carried from team-select into combat (plan 120 step 6). */
export interface CombatSetup {
  teams: TeamSelection[];
  formatKey: string;
  autoPlacement: boolean;
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
  credits: undefined;
  /** No `setup` = the `?combat=1` dev route (Jalon 3 demo content until step 7). */
  combat: { mapUrl: string; setup?: CombatSetup };
}

export const SCREEN_TRANSITIONS: Readonly<Record<ScreenId, readonly ScreenId[]>> = {
  "main-menu": ["battle-mode", "my-teams", "settings", "credits"],
  "battle-mode": ["map-select", "main-menu"],
  "map-select": ["team-select", "battle-mode"],
  "team-select": ["combat", "map-select"],
  "my-teams": ["team-edit", "main-menu"],
  "team-edit": ["my-teams"],
  settings: ["main-menu"],
  credits: ["main-menu"],
  combat: ["main-menu"],
};
