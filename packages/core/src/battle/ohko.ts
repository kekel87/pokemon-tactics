import { PokemonType } from "../enums/pokemon-type";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { TypeChart } from "../types/type-chart";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { resolveDefensiveAbility } from "./ability-suppression";
import { getTypeEffectiveness } from "./damage-calculator";

/** Reason a target is immune to a one-hit-KO move (drives the log / no-effect message). */
export type OhkoImmunity = "type" | "ice" | "sturdy";

/** True when the move is a one-hit-KO move (K.O. en un coup). */
export function isOhkoMove(move: MoveDefinition): boolean {
  return move.isOhko === true;
}

/**
 * Flat OHKO accuracy for the current level-50 ruleset. The canon `(user level − target level + base)`
 * formula collapses to the base percentage because every Pokemon is level 50 (Δlevel = 0). Glaciation
 * uses 30% when the user is Ice-type, 20% otherwise; the other OHKO moves are a flat 30%.
 */
export function ohkoAccuracy(move: MoveDefinition, attackerTypes: PokemonType[]): number {
  if (move.ohkoIceAccuracyRule && !attackerTypes.includes(PokemonType.Ice)) {
    return 20;
  }
  return 30;
}

/**
 * Immunities that must be checked BEFORE the accuracy roll (so an immune target reports "no effect" /
 * Fermeté, not a random "missed"):
 * - `"type"`: the move's type does nothing to the target (Ghost vs Normal, Flying/Levitate vs Ground).
 * - `"ice"`: Glaciation against an Ice-type target (special rule — Ice vs Ice is ×0.5 on the chart,
 *   so this is not caught by type effectiveness).
 * - `"sturdy"`: Fermeté grants full immunity to OHKO moves (bypassed by Brise Moule, via
 *   `resolveDefensiveAbility`).
 */
export function ohkoImmunityReason(
  move: MoveDefinition,
  attacker: PokemonInstance,
  target: PokemonInstance,
  context: {
    typeChart: TypeChart;
    targetTypes: PokemonType[];
    abilityRegistry?: AbilityHandlerRegistry;
    scrappyGhostBypass?: boolean;
    groundedByGravity?: boolean;
  },
): OhkoImmunity | null {
  const effectiveness = getTypeEffectiveness(
    move.type,
    context.targetTypes,
    context.typeChart,
    move.typeEffectivenessOverride,
    context.scrappyGhostBypass ?? false,
    context.groundedByGravity ?? false,
  );
  if (effectiveness === 0) {
    return "type";
  }
  if (move.ohkoIceImmunity && context.targetTypes.includes(PokemonType.Ice)) {
    return "ice";
  }
  if (resolveDefensiveAbility(context.abilityRegistry, target, attacker)?.id === "sturdy") {
    return "sturdy";
  }
  return null;
}
