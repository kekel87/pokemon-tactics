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
 * **Full adoption (plan 171, decision #714).** Every live held-item *effect* read routes through
 * this helper (or through the equivalent `fieldGlobal.*ItemSuppressed` / inline `isHeldItemSuppressed`
 * guard already present at a handful of damage/accuracy sites) — Veste de Combat `forbidsStatusMoves`,
 * Orbe Vie & type-boost items, Dé Pipé `maximizesMultiHit`, Grosse Racine `onDrainHealModify`,
 * Lancer/Dégommage (fling), weather-damage immunity, `onMoveImmunity`/`onTypeImmunity`,
 * `onStatChangeBlocked`, `onFlinchChance`, `onAfterMoveUse`, terrain-tick blocks, Herbe Mentale,
 * Choice-lock, arena-trap escape, trapping items, secondary-block, end-of-turn regen, CT modifiers,
 * and the powder-immunity gate shared by the grid-targeting path (Poudre Fureur, `powder-immunity.ts`).
 * New live-item effect reads MUST go through here.
 *
 * **Deliberate carve-outs (NOT routed):**
 * - Pure stat helpers `effectiveWeight` (Pierrallégée) — threads `state` itself — and
 *   `effectiveBaseSpeed` (Poudre Vite, Métamorph carve-out): read `heldItemId` off the species path
 *   without a registry lookup, suppression handled inline.
 * - Berry *manipulation* moves (canon: Zone Magique nullifies effects but the berry is still
 *   physically there, so the move still works): Calcination burning the target's berry
 *   (`handle-burn-target-item.ts`) and Picore/Piqûre eating the enemy berry
 *   (`handle-eat-target-berry.ts`). Human decision 2026-07-24.
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
