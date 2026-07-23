import type { BattleState } from "../types/battle-state";
import type { HeldItemDefinition } from "../types/held-item-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { isHeldItemSuppressed } from "./field-global-system";
import type { HeldItemHandlerRegistry } from "./held-item-handler-registry";

/**
 * The held-item definition a mon effectively carries **right now** — its registry entry, unless the
 * holder stands in a Zone Magique (magic-room), which suppresses every held item. Reading
 * `registry.getForPokemon(pokemon)` directly would ignore the zone; route through here instead.
 *
 * ⚠️ **Partial adoption (decision #714).** Only the audited item effects are routed through this
 * helper today: secondary-block (Cape Obscure), trapping items (Carapace Mue / Accro Griffe / Bande
 * Étreinte), end-of-turn regen, CT-gain modifiers, and arena-trap escape. **Many other live item
 * reads still call `registry.getForPokemon(...)` directly and are NOT suppressed by Zone Magique**
 * (Veste de Combat `forbidsStatusMoves`, Orbe Vie, Dé Pipé, Grosse Racine, Fling, immunité météo…) —
 * canonically they should be. Catalogued as a residual backlog item in `docs/next.md`. New live-item
 * reads should go through this helper; extending it to the residual set is not yet in scope.
 *
 * Not used by the pure stat helpers `effectiveWeight` (Pierrallégée) — which threads `state` itself —
 * nor `effectiveBaseSpeed` (Poudre Vite, documented carve-out): those read `heldItemId` off the
 * species path without a registry lookup.
 */
export function effectiveHeldItem(
  state: BattleState,
  pokemon: PokemonInstance,
  registry: HeldItemHandlerRegistry | null | undefined,
): HeldItemDefinition | undefined {
  if (isHeldItemSuppressed(state, pokemon)) {
    return undefined;
  }
  return registry?.getForPokemon(pokemon);
}
