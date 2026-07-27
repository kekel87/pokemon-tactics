import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { resolveDefensiveAbility } from "./ability-suppression";
import type { HeldItemHandlerRegistry } from "./held-item-handler-registry";

/** Crit rate per accumulated stage (Gen 6+ simplified): 1/24, 1/8, 1/2, always. */
const CRIT_THRESHOLDS: number[] = [1 / 24, 1 / 8, 0.5, 1.0];

/** Crit rate for an already-summed crit stage. */
export function getCritChance(stage: number): number {
  const index = Math.min(stage, CRIT_THRESHOLDS.length - 1);
  return CRIT_THRESHOLDS[Math.max(0, index)] ?? 1.0;
}

/**
 * The odds this hit crits, as a 0-1 probability — the pure extraction of what `calculateDamage`
 * used to compute inline, so the combat preview (plan 175) can show it without rolling anything.
 *
 * Returns exactly `0` when the defender is crit-immune (Coque Armure / Muscle Coque) and exactly
 * `1` when the crit is forced (Yama Arashi's `alwaysCrit`, Affilage's `guaranteedCritArmed`);
 * callers render those two as "Impossible" / "Garanti" rather than as percentages.
 *
 * `attackerItem` is passed already resolved (rather than looked up here) because the caller is the
 * one who knows whether Zone Magique suppresses the holder's item.
 */
export function effectiveCritChance(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: MoveDefinition,
  attackerItem?: ReturnType<HeldItemHandlerRegistry["getForPokemon"]>,
  abilityRegistry?: AbilityHandlerRegistry,
): number {
  // Brise Moule ignores the defender's breakable crit immunity, hence the same resolver as damage.
  if (resolveDefensiveAbility(abilityRegistry, defender, attacker)?.preventsCrit) {
    return 0;
  }
  if (move.alwaysCrit === true || attacker.guaranteedCritArmed === true) {
    return 1;
  }
  const baseCritStage = move.critRatio ?? 0;
  const itemCritStage = attackerItem?.onCritStageBoost?.({ self: attacker, move }) ?? 0;
  const volatileCritStage = attacker.critStageBoost ?? 0;
  return getCritChance(baseCritStage + itemCritStage + volatileCritStage);
}
