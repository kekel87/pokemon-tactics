import type { TeamSelection } from "@pokemon-tactic/core";
import type { NetworkSeeds } from "@pokemon-tactic/network";
import type { TelemetryTeam } from "../analytics/telemetry";
import type { BattleResumeSave } from "./battle-persistence";

/**
 * Screen FSM (plan 120) — screen IDs and legal transition table.
 * Source of truth for the transition diagram in docs/plans/120-jalon4a-fsm-scenes.md.
 */
export type ScreenId =
  | "main-menu"
  | "battle-mode"
  | "lobby"
  | "map-select"
  | "team-select"
  | "my-teams"
  | "team-edit"
  | "settings"
  | "controls"
  | "credits"
  | "combat";

/**
 * Ce qu'un écran doit savoir d'une partie en ligne (plan 199).
 *
 * Le **format est déjà gravé** quand cet objet existe : il se choisit dans le `lobby`, avant la
 * création du salon, ce qui fixe le nombre de places avant la naissance du code et supprime donc
 * toute éjection de joueur (décision #896).
 */
export type NetworkIntent =
  | { readonly role: "host"; readonly teamCount: number }
  /** L'invité ne configure rien : la carte et le format lui arrivent de l'hôte. */
  | { readonly role: "guest"; readonly code: string };

/** Battle configuration carried from team-select into combat (plan 120 step 6). */
export interface CombatSetup {
  teams: TeamSelection[];
  formatKey: string;
  autoPlacement: boolean;
  /**
   * Prévisualisation des dégâts (plan 198) : paramètre de PARTIE, pas réglage d'interface — gelé ici
   * à l'entrée en combat plutôt que relu en direct dans `getSettings()` (décision #893). En ligne,
   * l'hôte le fixe pour tout le monde ; deux joueurs ne peuvent pas jouer sous deux règles
   * différentes.
   */
  damagePreview: boolean;
  /**
   * Provenance des équipes pour `battle_started` (plan 196). Portée ici parce que `TeamSelection`
   * (core) ne connaît pas la notion d'équipe éphémère : c'est un concept de l'écran de sélection,
   * et le core n'a pas à l'apprendre pour de la télémétrie.
   *
   * Absente sur les chemins qui ne passent pas par l'écran de sélection (bac à sable, `?combat=1`),
   * qui n'émettent donc rien — ce qui est le comportement voulu.
   */
  telemetryTeams?: readonly TelemetryTeam[];
  /**
   * Les trois graines d'une partie en ligne (plan 199, décision #902) : combat, placement, IA.
   * **Absentes en local**, où une seule source d'entropie est tirée à l'entrée en combat.
   *
   * Il en faut trois et non une parce que le placement automatique **tire au hasard** et le faisait
   * depuis un tirage local : sans graine venue de l'hôte, deux pairs obtiennent deux plateaux
   * différents avant le premier tour. La troisième rend l'IA rejouable des deux côtés sans qu'un seul
   * message ne s'échange (décision #901).
   */
  seeds?: NetworkSeeds;
}

/** Params passed to each screen's mount(). Extended as plan 120 steps land. */
export interface ScreenParamsById {
  "main-menu": undefined;
  "battle-mode": undefined;
  lobby: undefined;
  /** `network` = l'hôte choisit le terrain de sa partie en ligne ; le format est déjà gravé. */
  "map-select": { network?: NetworkIntent } | undefined;
  /**
   * `mapUrl` absent = l'invité d'une partie en ligne : il n'a pas choisi de carte, elle lui arrive de
   * l'hôte, et il n'en verra que le nom (plan 199).
   */
  "team-select": { mapUrl?: string; network?: NetworkIntent };
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
  "battle-mode": ["map-select", "lobby", "main-menu"],
  // L'hôte passe par le choix du terrain, l'invité entre directement dans la salle d'attente : la
  // carte lui arrive de l'hôte, il n'a rien à choisir (plan 199).
  lobby: ["map-select", "team-select", "battle-mode"],
  "map-select": ["team-select", "battle-mode", "lobby"],
  // Le retour de la salle d'attente rend au `lobby` en ligne, à l'écran de terrain en local. L'hôte
  // change aussi de carte par ce chemin, la transition existant dans les deux sens.
  "team-select": ["combat", "map-select", "lobby"],
  "my-teams": ["team-edit", "main-menu"],
  "team-edit": ["my-teams"],
  settings: ["main-menu", "controls"],
  // On n'entre dans les contrôles que depuis Réglages : le retour y ramène, plutôt que d'éjecter le
  // joueur jusqu'au menu principal (revue 2026-08-25).
  controls: ["settings"],
  credits: ["main-menu"],
  combat: ["main-menu"],
};
