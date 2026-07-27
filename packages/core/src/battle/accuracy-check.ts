import { FieldGlobalKind } from "../enums/field-global-kind";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { Weather } from "../enums/weather";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { RandomFn } from "../utils/prng";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { resolveDefensiveAbility } from "./ability-suppression";
import {
  GRAVITY_ACCURACY_MULTIPLIER,
  isHeldItemSuppressed,
  isInFieldGlobalZone,
} from "./field-global-system";
import type { HeldItemHandlerRegistry } from "./held-item-handler-registry";
import { getStatMultiplier } from "./stat-modifier";
import { effectiveWeather, getWeatherAccuracyOverride } from "./weather-system";

/**
 * Verrouillage (lock-on): if the attacker holds the LockedOn volatile, its next move is a guaranteed
 * hit. Consumes the volatile and returns true. Extracted so the OHKO branch (which bypasses
 * `checkAccuracy`) can honor Verrouillage exactly once, without a double decrement.
 */
export function consumeLockedOn(attacker: PokemonInstance): boolean {
  const lockedOnIndex = attacker.volatileStatuses.findIndex((v) => v.type === StatusType.LockedOn);
  if (lockedOnIndex !== -1) {
    attacker.volatileStatuses.splice(lockedOnIndex, 1);
    return true;
  }
  return false;
}

/**
 * The accuracy a move would actually be rolled against, as a percentage — the pure half of
 * `checkAccuracy`, with no RNG and no mutation. `null` means "hits for sure" (Verrouillage armed,
 * `bypassAccuracy`, or an effective accuracy that already reached 100%), which the combat preview
 * (plan 175) renders through its own localised label instead of a computed percentage.
 *
 * Reads the Verrouillage volatile WITHOUT consuming it: the consumption is a side effect that must
 * stay in `checkAccuracy`, so previewing a move never spends the lock-on.
 */
export function computeEffectiveAccuracy(
  move: MoveDefinition,
  attacker: PokemonInstance,
  defender: PokemonInstance,
  terrainEvasionBonus = 0,
  abilityRegistry?: AbilityHandlerRegistry,
  state?: BattleState,
  itemRegistry?: HeldItemHandlerRegistry,
): number | null {
  if (attacker.volatileStatuses.some((v) => v.type === StatusType.LockedOn)) {
    return null;
  }

  if (move.bypassAccuracy) {
    return null;
  }

  const accuracyStages = attacker.statStages[StatName.Accuracy];
  let evasionStages = defender.statStages[StatName.Evasion] + terrainEvasionBonus;

  let activeWeather: Weather = Weather.None;
  if (state) {
    activeWeather = effectiveWeather(state, (target) => {
      if (target.currentHp <= 0) {
        return false;
      }
      const handler = abilityRegistry?.getForPokemon(target);
      return handler?.suppressesWeatherEffects === true;
    });
    // Brise Moule ignores the defender's breakable weather evasion (Voile Sable, Rideau Neige).
    const defenderAbility = resolveDefensiveAbility(abilityRegistry, defender, attacker);
    if (
      defenderAbility?.weatherEvasionBoost &&
      defenderAbility.weatherEvasionBoost.weather === activeWeather &&
      activeWeather !== Weather.None
    ) {
      evasionStages += defenderAbility.weatherEvasionBoost.stages;
    }
  }

  const accuracyMultiplier = getStatMultiplier(accuracyStages);
  const evasionMultiplier = getStatMultiplier(evasionStages);
  const attackerAbility = abilityRegistry?.getForPokemon(attacker);
  const abilityAccBonus = attackerAbility?.accuracyMultiplier ?? 1;
  const abilityAccModifier =
    attackerAbility?.onAccuracyModify?.({ self: attacker, target: defender, move }) ?? 1;
  // Brise Moule ignores the defender's breakable evasion modifiers (Pieds Confus, Peau Miracle).
  const abilityEvasionModifier =
    resolveDefensiveAbility(abilityRegistry, defender, attacker)?.onEvasionModify?.({
      self: defender,
      target: attacker,
      move,
    }) ?? 1;
  // Zone Magique (magic-room): a holder inside the zone has its item accuracy/evasion effects nulled.
  const itemAccBonus =
    state && isHeldItemSuppressed(state, attacker)
      ? 1
      : (itemRegistry
          ?.getForPokemon(attacker)
          ?.onAccuracyModify?.({ self: attacker, target: defender, move }) ?? 1);
  const itemEvasionBonus =
    state && isHeldItemSuppressed(state, defender)
      ? 1
      : (itemRegistry
          ?.getForPokemon(defender)
          ?.onEvasionModify?.({ self: defender, target: attacker, move }) ?? 1);

  // Gravité: attacks against a target standing in a Gravity zone get ×5/3 accuracy (canon).
  const gravityAccBonus =
    state && isInFieldGlobalZone(state, defender.position, FieldGlobalKind.Gravity)
      ? GRAVITY_ACCURACY_MULTIPLIER
      : 1;

  const weatherAccuracyOverride =
    state && activeWeather !== Weather.None
      ? getWeatherAccuracyOverride(move.id, activeWeather)
      : undefined;
  const baseAccuracy = weatherAccuracyOverride ?? move.accuracy;

  const effectiveAccuracy =
    (baseAccuracy *
      accuracyMultiplier *
      abilityAccBonus *
      abilityAccModifier *
      abilityEvasionModifier *
      itemAccBonus *
      itemEvasionBonus *
      gravityAccBonus) /
    evasionMultiplier;

  return effectiveAccuracy >= 100 ? null : effectiveAccuracy;
}

export function checkAccuracy(
  move: MoveDefinition,
  attacker: PokemonInstance,
  defender: PokemonInstance,
  random: RandomFn = () => Math.random(),
  terrainEvasionBonus = 0,
  abilityRegistry?: AbilityHandlerRegistry,
  state?: BattleState,
  itemRegistry?: HeldItemHandlerRegistry,
): boolean {
  // Verrouillage is consumed here (and only here) before the pure computation reads it.
  if (consumeLockedOn(attacker)) {
    return true;
  }

  const effectiveAccuracy = computeEffectiveAccuracy(
    move,
    attacker,
    defender,
    terrainEvasionBonus,
    abilityRegistry,
    state,
    itemRegistry,
  );
  if (effectiveAccuracy === null) {
    return true;
  }

  return random() * 100 < effectiveAccuracy;
}
