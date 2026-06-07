import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { PokemonInstance } from "../../types/pokemon-instance";
import { manhattanDistance } from "../../utils/manhattan-distance";
import { effectConditionHolds } from "../condition-eval";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Heals the move's resolved target(s) by a percent of each target's max HP (heal-pulse, pollen-puff
 * ally branch). When `radius` is set, instead heals every living ally within that Manhattan radius
 * of the caster (life-dew). Never overheals. Bypasses Substitute (real-HP heal, not an attack).
 */
export function handleHealTarget(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.HealTarget }>;

  const radius = effect.radius;
  const recipients: PokemonInstance[] =
    radius === undefined
      ? context.targets
      : [...context.state.pokemon.values()].filter(
          (pokemon) =>
            pokemon.currentHp > 0 &&
            pokemon.playerId === context.attacker.playerId &&
            manhattanDistance(pokemon.position, context.attacker.position) <= radius,
        );

  const events: BattleEvent[] = [];
  for (const recipient of recipients) {
    if (
      effect.appliesIf !== undefined &&
      !effectConditionHolds(effect.appliesIf, context.attacker, recipient)
    ) {
      continue;
    }
    const healed = Math.min(
      recipient.maxHp - recipient.currentHp,
      Math.floor(recipient.maxHp * effect.percent),
    );
    if (healed <= 0) {
      continue;
    }
    recipient.currentHp += healed;
    events.push({ type: BattleEventType.HpRestored, pokemonId: recipient.id, amount: healed });
  }
  return events;
}
