import type { Direction } from "../enums/direction";

/**
 * Vent Arrière ("tailwind") — a single global directional wind shared by both teams. Reinterpreted
 * for the grid: instead of canonically doubling one team's Speed, the wind blows toward a chosen
 * direction and every Pokemon (either team) whose orientation matches it gains a Charge-Time tempo
 * boost. Only one wind is active at a time; re-casting replaces it. Owned by its setter and counted
 * down on the setter's own turns (mirror of the weather duration model — the CT engine has no
 * discrete rounds), surviving the setter's KO via the ghost clock.
 */
export interface Tailwind {
  /** Direction the wind blows toward; mons oriented this way are boosted. */
  direction: Direction;
  /** Turns left before the wind dies. */
  remainingTurns: number;
  /** Id of the mon that set the wind (drives the "tours du lanceur" countdown + ghost clock). */
  setterPokemonId: string;
}
