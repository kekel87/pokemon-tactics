import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import { getTypeEffectiveness } from "../damage-calculator";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Tout ou Rien (final-gambit): deals fixed damage equal to the caster's CURRENT HP to a single
 * target, then the caster faints (self-KO handled engine-side via `selfKoOnConnect`). The damage is
 * typed (Fighting): the full type chart applies, so a Ghost target is immune (0 damage → the move did
 * not connect → the caster survives, CT paid), and resistances/weaknesses scale the fixed amount
 * (parity with Showdown's Final Gambit, which routes fixed damage through the type chart).
 *
 * Divergence with Effort (`handle-endeavor`) is intentional (see docs/decisions.md): Effort is a pure
 * set-HP with no multipliers, while Tout ou Rien is a typed strike.
 */
export function handleFinalGambit(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target || target.currentHp <= 0) {
    return [];
  }

  const effectiveness = getTypeEffectiveness(
    context.move.type,
    context.targetTypesMap.get(target.id) ?? [],
    context.typeChart,
  );

  // Immune (Ghost): report "no effect" and deal nothing. The caster does NOT connect, so the
  // engine's `selfKoOnConnect` leaves it alive.
  if (effectiveness === 0) {
    return [
      { type: BattleEventType.DamageDealt, targetId: target.id, amount: 0, effectiveness: 0 },
    ];
  }

  const damage = Math.max(1, Math.floor(caster.currentHp * effectiveness));
  const applied = Math.min(damage, target.currentHp);
  target.currentHp -= applied;
  context.shared.lastDamageDealt += applied;

  const clock = context.state.actionCounter ?? 0;
  target.lastDamagedAtAction = clock;
  target.timesHit = (target.timesHit ?? 0) + 1;
  if (caster.playerId !== target.playerId) {
    target.lastDamagedByEnemyAtAction = clock;
  }
  target.lastHitBy = { attackerId: caster.id, moveId: context.move.id };

  const events: BattleEvent[] = [
    { type: BattleEventType.DamageDealt, targetId: target.id, amount: applied, effectiveness },
    {
      type: BattleEventType.FinalGambitApplied,
      attackerId: caster.id,
      targetId: target.id,
      damage: applied,
    },
  ];

  if (target.currentHp <= 0) {
    events.push({ type: BattleEventType.PokemonKo, pokemonId: target.id, countdownStart: 0 });
  }

  return events;
}
