import { EffectKind } from "../enums/effect-kind";
import { StatusType } from "../enums/status-type";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * HP-restoring effect kinds gated by Heal Block ("Anti-Soin"). Drain is intentionally excluded: a
 * drain move still deals damage and stays usable — only its heal portion is suppressed at apply
 * time. CureTeamStatus (Aromatherapy) is excluded too: it cures status, never restores HP (canon —
 * Heal Block only affects HP-restoring moves).
 */
const HEAL_EFFECT_KINDS: ReadonlySet<EffectKind> = new Set<EffectKind>([
  EffectKind.HealSelf,
  EffectKind.HealTarget,
  EffectKind.HealByTargetStat,
  EffectKind.PostHealOverTime,
  EffectKind.PostWish,
]);

/** True when the move restores HP — such moves are hidden from a Heal-Blocked mon's legal actions. */
export function isHealingMove(move: MoveDefinition): boolean {
  return move.effects.some((effect) => HEAL_EFFECT_KINDS.has(effect.kind));
}

/** True while this mon carries the Heal Block ("Anti-Soin") volatile. */
export function isHealBlocked(pokemon: PokemonInstance): boolean {
  return pokemon.volatileStatuses.some((volatile) => volatile.type === StatusType.HealBlocked);
}
