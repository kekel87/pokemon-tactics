import type { AbilityDefinition } from "../types/ability-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { effectiveAbilityId } from "./effective-ability";

/**
 * Resolves the defensive ability of `target` as seen by `attacker` during an attack.
 *
 * Brise Moule (mold-breaker) ignores the target's `breakable` abilities while attacking
 * (Lévitation, Fermeté, Isograisse, Écran Poudre, …). Reactive abilities that are not
 * breakable (Statik, Corps Ardent, …) still resolve normally and keep triggering.
 *
 * Mirrors the `scrappy` id-check pattern: call this instead of `registry.getForPokemon(target)`
 * at every defensive site where the target's ability is consulted during the attacker's move.
 */
export function resolveDefensiveAbility(
  registry: AbilityHandlerRegistry | undefined,
  target: PokemonInstance,
  attacker: PokemonInstance,
): AbilityDefinition | undefined {
  const ability = registry?.getForPokemon(target);
  if (!ability) {
    return undefined;
  }
  if (effectiveAbilityId(attacker) === "mold-breaker" && ability.breakable) {
    return undefined;
  }
  return ability;
}
