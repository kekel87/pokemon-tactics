import { EffectKind } from "../enums/effect-kind";
import { EffectTarget } from "../enums/effect-target";
import type { Effect } from "../types/effect";
import type { MoveDefinition } from "../types/move-definition";

/**
 * A "secondary" effect is a chance-based ({@link Effect.chance} < 100) status or stat change
 * applied to the move's targets (the opponent) by a damaging move. Self-targeted effects and
 * guaranteed (100%) effects are *primary*, as are any effect on a non-damaging move.
 *
 * This is the runtime notion the engine already uses for Écran Poudre (shield-dust) target
 * filtering, and the lever for Sans Limite (sheer-force) / Sérénité (serene-grace).
 *
 * Divergence from Showdown (assumed, nil impact on Gen 1): Showdown also treats 100%-chance and
 * self-boost secondaries as secondaries — no Gen-1 move has either.
 */
export function isSecondaryEffect(effect: Effect, moveHasDamage: boolean): boolean {
  if (!moveHasDamage) {
    return false;
  }
  if (effect.kind === EffectKind.Status) {
    if ("target" in effect && effect.target === EffectTarget.Self) {
      return false;
    }
    return effect.chance < 100;
  }
  if (effect.kind === EffectKind.StatChange) {
    if (effect.target === EffectTarget.Self) {
      return false;
    }
    return (effect.chance ?? 100) < 100;
  }
  return false;
}

/** True if the move deals damage and carries at least one secondary effect. */
export function moveHasSecondaryEffect(move: MoveDefinition): boolean {
  const moveHasDamage = move.effects.some(
    (effect) => effect.kind === EffectKind.Damage || effect.kind === EffectKind.Drain,
  );
  return move.effects.some((effect) => isSecondaryEffect(effect, moveHasDamage));
}
