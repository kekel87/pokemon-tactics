import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import { EffectTarget } from "../../enums/effect-target";
import type { BattleEvent } from "../../types/battle-event";
import { ProtectionReason } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { PokemonInstance } from "../../types/pokemon-instance";
import { manhattanDistance } from "../../utils/manhattan-distance";
import { resolveDefensiveAbility } from "../ability-suppression";
import { applyStatStage } from "../apply-stat-stage";
import { isProtectedFromStatDecrease } from "../aura-system";
import type { EffectContext } from "../effect-handler-registry";
import { effectiveAbilityId } from "../effective-ability";
import { shouldSubstituteBlock } from "../substitute-system";

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
    if (isEnemyDebuff) {
      // Brise Moule ignores the target's breakable stat-drop blockers (Corps Sain, Regard Vif,
      // Hyper Cutter, Cœur de Coq, Tempo Perso) → the debuff lands.
      const blockResult = resolveDefensiveAbility(
        context.abilityRegistry,
        pokemon,
        context.attacker,
      )?.onStatChangeBlocked?.({
        self: pokemon,
        stat: effect.stat,
        stages: effect.stages,
        source: context.attacker,
      });
      if (blockResult?.blocked) {
        events.push(...blockResult.events);
        continue;
      }

      // Talisman Sain (clear-amulet): blocks any opponent-inflicted stat drop on the holder.
      const itemBlock = context.itemRegistry?.getForPokemon(pokemon)?.onStatChangeBlocked?.({
        self: pokemon,
        stat: effect.stat,
        stages: effect.stages,
        source: context.attacker,
      });
      if (itemBlock?.blocked) {
        events.push(...itemBlock.events);
        continue;
      }

      const mistProtection = isProtectedFromStatDecrease(context.state, context.attacker, pokemon);
      if (mistProtection.protected) {
        events.push({
          type: BattleEventType.StatChangeBlocked,
          pokemonId: pokemon.id,
          stat: effect.stat,
          reason: ProtectionReason.Mist,
          protectingCasterId: mistProtection.casterId,
        });
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
        const loweredAbility = context.abilityRegistry?.getForPokemon(pokemon);
        if (loweredAbility?.onAfterStatLowered) {
          events.push(
            ...loweredAbility.onAfterStatLowered({
              self: pokemon,
              stat: effect.stat,
              stages: actualChange,
              source: context.attacker,
            }),
          );
        }
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
