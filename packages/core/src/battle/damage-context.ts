import { Category } from "../enums/category";
import { FieldGlobalKind } from "../enums/field-global-kind";
import type { FieldTerrain } from "../enums/field-terrain";
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
  getFieldTerrainAt,
  getFieldTerrainBpMultiplier,
  getFieldTerrainDamageMultiplier,
  getFieldTerrainMovePowerMultiplier,
  resolveFieldTerrainPulseMove,
} from "./field-terrain-system";
import { friendGuardMultiplier } from "./friend-guard-system";
import { HELPING_HAND_MULTIPLIER } from "./handlers/handle-helping-hand";
import {
  effectiveWeather,
  getWeatherAccuracyOverride,
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
 * Le sous-ensemble de {@link DamageContext} qui ne dépend QUE du lanceur — donc calculable sans
 * cible (plan 192).
 *
 * Sert l'infobulle d'attaque, consultée au survol, avant tout choix de cible. Extrait de
 * {@link resolveDamageContext}, qui le consomme : c'est la même leçon que le commentaire de ce
 * fichier raconte déjà pour la prévision de dégâts — deux calculs séparés du même contexte avaient
 * dérivé, et l'infobulle serait le troisième si elle recalculait dans son coin.
 *
 * Ce qui est exclu, parce que ça exige une cible : efficacité de type, esquive, murs, défense
 * adverse, orientation, hauteur, Analyste.
 */
/**
 * Pourquoi la valeur effective d'un move diffère de sa fiche, du seul point de vue du lanceur.
 *
 * Produit ICI et pas dans la vue : le core a déjà tout sous la main (météo effective après talents,
 * champ sous le lanceur, volatiles), et le redériver côté présentation rouvrirait la porte à la
 * dérive que ce fichier existe pour fermer.
 */
export type CasterMoveCause =
  | { readonly kind: "weather"; readonly weather: Weather }
  | { readonly kind: "field-terrain"; readonly terrain: FieldTerrain }
  | { readonly kind: "helping-hand" }
  | { readonly kind: "charge" }
  | { readonly kind: "move-morph"; readonly resolvedMoveId: string };

export interface CasterMoveContext {
  /** Le move après Champlification, la morphe météo de Météore et le doublement du Chargeur. */
  readonly resolvedMove: MoveDefinition;
  readonly activeWeather: Weather;
  /** Multiplicateur de puissance dû à la météo (Lance-Soleil sous pluie inclus). */
  readonly weatherBpMultiplier: number;
  /**
   * Multiplicateur de puissance dû au champ sous le lanceur (`getFieldTerrainBpMultiplier`).
   *
   * N'inclut PAS `getFieldTerrainMovePowerMultiplier` : celui-là exige une cible et ses types, donc
   * il reste dans {@link DamageContext} et n'a rien à faire dans une infobulle sans cible.
   */
  readonly fieldTerrainBpMultiplier: number;
  /** Précision imposée par la météo (Blizzard sous Neige, Fatal-Foudre sous Pluie), sinon `undefined`. */
  readonly weatherAccuracyOverride: number | undefined;
  /** Coup d'Main posé sur le lanceur. */
  readonly helpingHandMultiplier: number;
  /** Le lanceur est brûlé ET ce move en subit la réduction (physique, hors Cran). */
  readonly burnHalvesDamage: boolean;
  /** Causes à nommer, dans l'ordre d'affichage. Vide quand la fiche vaut la réalité. */
  readonly causes: readonly CasterMoveCause[];
}

export function resolveCasterMoveContext(
  state: BattleState,
  attacker: PokemonInstance,
  move: MoveDefinition,
  attackerTypes: PokemonType[],
  abilityRegistry?: AbilityHandlerRegistry,
): CasterMoveContext {
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
  const chargeDoubled =
    resolvedMove.type === PokemonType.Electric &&
    attacker.volatileStatuses.some((v) => v.type === StatusType.Charged);
  if (chargeDoubled) {
    resolvedMove = { ...resolvedMove, power: resolvedMove.power * 2 };
  }

  const causes: CasterMoveCause[] = [];
  if (resolvedMove.id !== move.id) {
    causes.push({ kind: "move-morph", resolvedMoveId: resolvedMove.id });
  }
  if (chargeDoubled) {
    causes.push({ kind: "charge" });
  }
  const weatherBp = weatherBpFor(resolvedMove, activeWeather);
  const weatherAccuracy = getWeatherAccuracyOverride(resolvedMove.id, activeWeather);
  if (weatherBp !== 1 || weatherAccuracy !== undefined) {
    causes.push({ kind: "weather", weather: activeWeather });
  }
  const fieldTerrainBp = getFieldTerrainBpMultiplier(state, attacker, attackerTypes, resolvedMove);
  const fieldTerrain = getFieldTerrainAt(state, attacker.position);
  if (fieldTerrainBp !== 1 && fieldTerrain !== null) {
    causes.push({ kind: "field-terrain", terrain: fieldTerrain });
  }
  const helpingHandMultiplier =
    attacker.helpingHand === true && resolvedMove.power > 0 ? HELPING_HAND_MULTIPLIER : 1;
  if (helpingHandMultiplier !== 1) {
    causes.push({ kind: "helping-hand" });
  }

  const isPhysical = resolvedMove.category === Category.Physical;
  // Cran (guts) : même détection que `damage-calculator.ts`, par id de talent.
  const gutsIgnoresBurn = abilityRegistry?.getForPokemon(attacker)?.id === "guts";

  return {
    resolvedMove,
    activeWeather,
    weatherBpMultiplier: weatherBpFor(resolvedMove, activeWeather),
    fieldTerrainBpMultiplier: getFieldTerrainBpMultiplier(
      state,
      attacker,
      attackerTypes,
      resolvedMove,
    ),
    weatherAccuracyOverride: getWeatherAccuracyOverride(resolvedMove.id, activeWeather),
    helpingHandMultiplier:
      attacker.helpingHand === true && resolvedMove.power > 0 ? HELPING_HAND_MULTIPLIER : 1,
    causes,
    burnHalvesDamage:
      isPhysical &&
      !gutsIgnoresBurn &&
      resolvedMove.ignoresBurnAttackDrop !== true &&
      attacker.statusEffects.some((effect) => effect.type === StatusType.Burned),
  };
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
  // Le volet indépendant de la cible vient de la MÊME fonction que l'infobulle d'attaque (plan 192) :
  // deux calculs séparés du même contexte avaient déjà dérivé une fois, cf. l'en-tête de ce fichier.
  const caster = resolveCasterMoveContext(state, attacker, move, attackerTypes, abilityRegistry);
  const { resolvedMove, activeWeather } = caster;

  const usesPhysicalDefense =
    resolvedMove.category === Category.Physical || resolvedMove.hitsPhysicalDefense === true;
  const brickBreak = computeBrickBreakInteraction(state, target, resolvedMove);

  const helpingHand = caster.helpingHandMultiplier;

  return {
    resolvedMove,
    activeWeather,
    weatherBpMultiplier: caster.weatherBpMultiplier,
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
      caster.fieldTerrainBpMultiplier *
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
