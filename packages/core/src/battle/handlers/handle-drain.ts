import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { isHealBlocked } from "../heal-block-system";

export function handleDrain(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.Drain }>;
  const pokemon = context.attacker;

  if (context.shared.lastDamageDealt <= 0) {
    return [];
  }

  const drainAmount = Math.max(1, Math.floor(context.shared.lastDamageDealt * effect.fraction));

  // Suintement (liquid-ooze): draining the holder backfires — the drainer takes the would-be heal
  // as damage instead. Resolves before Heal Block (the backlash lands regardless of heal status).
  const drainedTarget = context.targets[0];
  if (drainedTarget !== undefined) {
    const drainResult = context.abilityRegistry
      ?.getForPokemon(drainedTarget)
      ?.onDrainAttempt?.({ self: drainedTarget, attacker: pokemon, drainAmount });
    if (drainResult?.redirect) {
      const events: BattleEvent[] = [...drainResult.events];
      pokemon.currentHp = Math.max(0, pokemon.currentHp - drainAmount);
      events.push({
        type: BattleEventType.DamageDealt,
        targetId: pokemon.id,
        amount: drainAmount,
        effectiveness: 1,
      });
      if (pokemon.currentHp <= 0) {
        events.push({ type: BattleEventType.PokemonKo, pokemonId: pokemon.id, countdownStart: 0 });
      }
      return events;
    }
  }

  // Anti-Soin (Heal Block): the damage already landed; only the heal portion is suppressed.
  if (isHealBlocked(pokemon)) {
    return [{ type: BattleEventType.HealPrevented, pokemonId: pokemon.id }];
  }

  const missing = pokemon.maxHp - pokemon.currentHp;
  if (missing <= 0) {
    return [];
  }

  // Grosse Racine (big-root): boosts HP recovered from draining moves. The redirected backlash
  // (Suintement) and the Heal Block suppression above are unaffected — only the heal portion grows.
  const drainHealMultiplier =
    context.itemRegistry?.getForPokemon(pokemon)?.onDrainHealModify?.() ?? 1;
  const boostedDrain =
    drainHealMultiplier === 1 ? drainAmount : Math.floor(drainAmount * drainHealMultiplier);

  const healed = Math.min(missing, boostedDrain);
  pokemon.currentHp += healed;

  return [{ type: BattleEventType.HpRestored, pokemonId: pokemon.id, amount: healed }];
}
