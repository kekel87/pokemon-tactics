import { Category } from "../enums/category";
import { FieldGlobalKind } from "../enums/field-global-kind";
import { PokemonType } from "../enums/pokemon-type";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { Weather } from "../enums/weather";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { computeBrickBreakInteraction, computeScreenMultiplier } from "./aura-system";
import type { FieldGlobalDamageContext } from "./damage-calculator";
import {
  isEffectivelyGrounded,
  isHeldItemSuppressed,
  isInFieldGlobalZone,
} from "./field-global-system";
import {
  getFieldTerrainBpMultiplier,
  getFieldTerrainDamageMultiplier,
  getFieldTerrainMovePowerMultiplier,
  resolveFieldTerrainPulseMove,
} from "./field-terrain-system";
import { friendGuardMultiplier } from "./friend-guard-system";
import { HELPING_HAND_MULTIPLIER } from "./handlers/handle-helping-hand";
import {
  effectiveWeather,
  getWeatherBallBp,
  getWeatherBallType,
  getWeatherBpModifier,
  getWeatherDefenseStatBoost,
} from "./weather-system";

/**
 * Everything that shapes a hit besides the raw formula: the move after every morph, the weather /
 * screen / field multipliers, and the two multipliers the engine applies *after* the damage roll.
 *
 * Single source for both the real hit (`handle-damage.ts`) and the forecast
 * (`BattleEngine.estimateDamage`). They used to compute this twice, by hand, and had already drifted:
 * the estimate ignored Météore's weather morph, Lance-Soleil's rain penalty, the Chargeur volatile,
 * Coup d'Main and Garde Amie — so the previewed number, and every AI heuristic reading it, was wrong
 * whenever one of those was in play.
 */
export interface DamageContext {
  /** The move after Champlification, Météore's weather morph and the Chargeur doubling. */
  readonly resolvedMove: MoveDefinition;
  readonly activeWeather: Weather;
  readonly weatherBpMultiplier: number;
  readonly defenseWeatherMultiplier: number;
  readonly screenMultiplier: number;
  readonly brickBreakMultiplier: number;
  /** Brise Barrière: the caster whose screens this hit shatters, if any (the real hit removes them). */
  readonly brickBreakCasterId: string | null;
  readonly fieldTerrainBpMultiplier: number;
  readonly fieldTerrainDamageMultiplier: number;
  readonly targetAlreadyActed: boolean;
  readonly fieldGlobal: FieldGlobalDamageContext;
  /** Coup d'Main ×1.5 and Garde Amie ×0.75 — applied to the damage AFTER the roll, never to the BP. */
  readonly postRollMultiplier: number;
}

/** Météore (weather-ball): the active weather rewrites both its type and its base power. */
function resolveWeatherBallMove(move: MoveDefinition, activeWeather: Weather): MoveDefinition {
  if (!move.weatherBoostedType) {
    return move;
  }
  return {
    ...move,
    type: getWeatherBallType(activeWeather),
    power: getWeatherBallBp(activeWeather, move.power),
  };
}

const SOLAR_BEAM_WEAKENING_WEATHER: ReadonlySet<Weather> = new Set<Weather>([
  Weather.Rain,
  Weather.Sandstorm,
  Weather.Snow,
]);

/** Lance-Soleil (solar-beam) is halved by any weather that hides the sun. */
function weatherBpFor(move: MoveDefinition, activeWeather: Weather): number {
  const base = getWeatherBpModifier(move.type, activeWeather);
  return move.id === "solar-beam" && SOLAR_BEAM_WEAKENING_WEATHER.has(activeWeather)
    ? base * 0.5
    : base;
}

/**
 * Resolve the shared context for one attacker→target pair.
 *
 * `resolveDynamicPower` is deliberately NOT applied here: the real hit needs it per-hit (multi-hit
 * power overrides), and the estimate applies it itself inside `estimateDamage`.
 */
export function resolveDamageContext(
  state: BattleState,
  attacker: PokemonInstance,
  target: PokemonInstance,
  move: MoveDefinition,
  attackerTypes: PokemonType[],
  defenderTypes: PokemonType[],
  abilityRegistry?: AbilityHandlerRegistry,
): DamageContext {
  const activeWeather = effectiveWeather(state, (pokemon) => {
    if (pokemon.currentHp <= 0) {
      return false;
    }
    return abilityRegistry?.getForPokemon(pokemon)?.suppressesWeatherEffects === true;
  });

  let resolvedMove = resolveFieldTerrainPulseMove(
    state,
    attacker,
    attackerTypes,
    resolveWeatherBallMove(move, activeWeather),
  );
  // Charge (B3): the user's next Electric move is doubled while the Chargeur volatile is held.
  if (
    resolvedMove.type === PokemonType.Electric &&
    attacker.volatileStatuses.some((v) => v.type === StatusType.Charged)
  ) {
    resolvedMove = { ...resolvedMove, power: resolvedMove.power * 2 };
  }

  const usesPhysicalDefense =
    resolvedMove.category === Category.Physical || resolvedMove.hitsPhysicalDefense === true;
  const brickBreak = computeBrickBreakInteraction(state, target, resolvedMove);

  const helpingHand =
    attacker.helpingHand === true && resolvedMove.power > 0 ? HELPING_HAND_MULTIPLIER : 1;

  return {
    resolvedMove,
    activeWeather,
    weatherBpMultiplier: weatherBpFor(resolvedMove, activeWeather),
    defenseWeatherMultiplier: getWeatherDefenseStatBoost(
      defenderTypes,
      usesPhysicalDefense ? StatName.Defense : StatName.SpDefense,
      activeWeather,
    ),
    screenMultiplier: brickBreak.breakAuraCasterId
      ? 1.0
      : computeScreenMultiplier(state, attacker, target, resolvedMove),
    brickBreakMultiplier: brickBreak.multiplier,
    brickBreakCasterId: brickBreak.breakAuraCasterId ?? null,
    fieldTerrainBpMultiplier:
      getFieldTerrainBpMultiplier(state, attacker, attackerTypes, resolvedMove) *
      getFieldTerrainMovePowerMultiplier(
        state,
        attacker,
        attackerTypes,
        target,
        defenderTypes,
        resolvedMove,
      ),
    fieldTerrainDamageMultiplier: getFieldTerrainDamageMultiplier(
      state,
      target,
      defenderTypes,
      resolvedMove,
    ),
    // Analyste (analytic): the holder acts after the target when the target's last action is more
    // recent than the holder's.
    targetAlreadyActed: (target.lastActedAtAction ?? -1) > (attacker.lastActedAtAction ?? -1),
    fieldGlobal: {
      defenderGroundedByGravity: isEffectivelyGrounded(state, target),
      defenderDefensesSwapped: isInFieldGlobalZone(
        state,
        target.position,
        FieldGlobalKind.WonderRoom,
      ),
      attackerItemSuppressed: isHeldItemSuppressed(state, attacker),
      defenderItemSuppressed: isHeldItemSuppressed(state, target),
    },
    postRollMultiplier: helpingHand * friendGuardMultiplier(state, target),
  };
}
