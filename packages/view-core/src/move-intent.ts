import type { MoveDefinition } from "@pokemon-tactic/core";
import {
  DISTORTION_RADIUS,
  EffectKind,
  EffectTarget,
  FIELD_TERRAIN_RADIUS,
} from "@pokemon-tactic/core";

/** Preview intent of a move, driving the target/AoE colour on both the ground and the tooltip grid. */
export type MoveIntent = "attack" | "buff" | "heal";

const HEAL_EFFECT_KINDS: ReadonlySet<EffectKind> = new Set([
  EffectKind.HealSelf,
  EffectKind.HealTarget,
  EffectKind.HealByTargetStat,
  EffectKind.CureTeamStatus,
  EffectKind.PostHealOverTime,
  EffectKind.PostWish,
]);

/**
 * Classifies a move into a preview intent so the ground tile previews
 * (`BattleOrchestrator`) and the MoveTooltip pattern grid speak the same colour
 * language: red = attack, blue = buff, green = heal.
 *
 * A move that deals damage is always an attack (red), even if it also drains/heals.
 * A non-damaging move that restores HP / cures status reads as heal (green).
 * A non-damaging move that lowers a target's stat or inflicts status reads as an
 * attack (red). Anything else (self/ally stat boosts, screens…) is a buff (blue).
 */
export function moveIntent(move: MoveDefinition): MoveIntent {
  const hasDamage = move.effects.some((effect) => effect.kind === EffectKind.Damage);
  if (hasDamage) {
    return "attack";
  }
  if (move.effects.some((effect) => HEAL_EFFECT_KINDS.has(effect.kind))) {
    return "heal";
  }
  const hasOffensive = move.effects.some(
    (effect) =>
      (effect.kind === EffectKind.StatChange && effect.target === EffectTarget.Targets) ||
      effect.kind === EffectKind.Status ||
      // Prescience (future-sight): a delayed damaging strike — reads as an attack (red zone).
      effect.kind === EffectKind.PostFutureSight ||
      // Effort (endeavor) / Balance (pain-split): hostile HP manipulation on an enemy.
      effect.kind === EffectKind.Endeavor ||
      effect.kind === EffectKind.PainSplit,
  );
  return hasOffensive ? "attack" : "buff";
}

/**
 * Manhattan radius of a self-centred AoE effect (life-dew heal, aromatherapy cure,
 * field terrain), or `undefined` for a single-tile self move. Lets both the ground
 * preview and the tooltip grid draw the full affected zone around the caster.
 */
export function selfPreviewRadius(move: MoveDefinition): number | undefined {
  for (const effect of move.effects) {
    if (effect.kind === EffectKind.HealTarget && effect.radius !== undefined) {
      return effect.radius;
    }
    if (effect.kind === EffectKind.CureTeamStatus) {
      return effect.radius;
    }
    if (effect.kind === EffectKind.PostFieldTerrain) {
      return FIELD_TERRAIN_RADIUS;
    }
    if (effect.kind === EffectKind.PostDistortion) {
      return DISTORTION_RADIUS;
    }
    if (effect.kind === EffectKind.RemoveEntryHazards) {
      return effect.radius;
    }
  }
  return undefined;
}
