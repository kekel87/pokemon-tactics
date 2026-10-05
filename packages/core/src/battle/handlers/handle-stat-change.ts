import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import { EffectTarget } from "../../enums/effect-target";
import type { BattleEvent } from "../../types/battle-event";
import { ProtectionReason } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { OpponentStatDrop } from "../../types/opponent-stat-drop";
import type { PokemonInstance } from "../../types/pokemon-instance";
import { manhattanDistance } from "../../utils/manhattan-distance";
import { applyStatStage } from "../apply-stat-stage";
import type { EffectContext } from "../effect-handler-registry";
import { effectiveAbilityId } from "../effective-ability";
import { notifyOpponentStatLowered, resolveOpponentStatDropBlock } from "../opponent-stat-drop";
import { shouldSubstituteBlock } from "../substitute-system";

function statDrop(
  context: EffectContext,
  target: PokemonInstance,
  effect: Extract<Effect, { kind: typeof EffectKind.StatChange }>,
): OpponentStatDrop {
  return {
    state: context.state,
    abilityRegistry: context.abilityRegistry,
    itemRegistry: context.itemRegistry,
    target,
    source: context.attacker,
    stat: effect.stat,
    stages: effect.stages,
  };
}

export function handleStatChange(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.StatChange }>;

  if (effect.chance !== undefined && context.random() * 100 >= effect.chance) {
    return events;
  }

  const affectedPokemon =
    effect.radius === undefined
      ? effect.target === EffectTarget.Self
        ? [context.attacker]
        : context.targets
      : resolveRadiusAllies(context, effect.radius, effect.abilityGate);
  const isEnemyDebuff = effect.target !== EffectTarget.Self && effect.stages < 0;

  for (const pokemon of affectedPokemon) {
    const drop = statDrop(context, pokemon, effect);
    if (isEnemyDebuff) {
      // Corps Sain / Talisman Sain / Brume — Brise Moule ignores the breakable abilities.
      const dropBlock = resolveOpponentStatDropBlock(drop);
      if (dropBlock.blocked) {
        events.push(...dropBlock.events);
        continue;
      }

      if (shouldSubstituteBlock(context.attacker, pokemon, context.move)) {
        events.push({
          type: BattleEventType.StatChangeBlocked,
          pokemonId: pokemon.id,
          stat: effect.stat,
          reason: ProtectionReason.Substitute,
        });
        continue;
      }
    }

    const { events: statEvents, actualChange } = applyStatStage(
      pokemon,
      effect.stat,
      effect.stages,
    );

    if (actualChange === 0) {
      continue;
    }

    events.push(...statEvents);

    if (actualChange < 0) {
      if (!context.shared.loweredPokemonIds) {
        context.shared.loweredPokemonIds = new Set<string>();
      }
      context.shared.loweredPokemonIds.add(pokemon.id);

      // Acharné / Battant (defiant / competitive): retaliate when an opponent lowers a stat.
      if (isEnemyDebuff) {
        events.push(...notifyOpponentStatLowered({ ...drop, stages: actualChange }));
      }
    }
  }

  return events;
}

/**
 * Auto-centred ally buff (howl, magnetic-flux): every living mon on the caster's team (including the
 * caster) inside the Manhattan diamond of `radius`. When `abilityGate` is set, keep only those whose
 * effective ability is listed (magnetic-flux: Plus/Minus) — yields an empty set, hence a no-op, when
 * nobody qualifies.
 */
function resolveRadiusAllies(
  context: EffectContext,
  radius: number,
  abilityGate: string[] | undefined,
): PokemonInstance[] {
  const caster = context.attacker;
  return [...context.state.pokemon.values()].filter((pokemon) => {
    if (pokemon.currentHp <= 0 || pokemon.playerId !== caster.playerId) {
      return false;
    }
    if (manhattanDistance(pokemon.position, caster.position) > radius) {
      return false;
    }
    if (abilityGate !== undefined) {
      const ability = effectiveAbilityId(pokemon);
      return ability !== undefined && abilityGate.includes(ability);
    }
    return true;
  });
}
