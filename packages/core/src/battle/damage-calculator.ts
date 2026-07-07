import { AttackStatSource } from "../enums/attack-stat-source";
import { Category } from "../enums/category";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType as StatusTypeEnum } from "../enums/status-type";
import { Weather } from "../enums/weather";
import type { DamageEstimate } from "../types/damage-estimate";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { RandomFn } from "../utils/prng";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { resolveDefensiveAbility } from "./ability-suppression";
import { resolveDynamicPower } from "./dynamic-power-system";
import type { HeldItemHandlerRegistry } from "./held-item-handler-registry";
import { getEffectiveStat } from "./stat-modifier";

const BATTLE_LEVEL = 50;

type TypeChart = Record<PokemonType, Record<PokemonType, number>>;

const CRIT_THRESHOLDS: number[] = [1 / 24, 1 / 8, 0.5, 1.0];

function getCritChance(stage: number): number {
  const index = Math.min(stage, CRIT_THRESHOLDS.length - 1);
  return CRIT_THRESHOLDS[Math.max(0, index)] ?? 1.0;
}

export interface DamageResult {
  damage: number;
  isCrit: boolean;
}

/**
 * Per-hit field-global modifiers resolved by the caller (which holds BattleState): Gravité grounding
 * (Ground hits a Flying defender), Zone Étrange (swap the defender's Def ↔ Sp.Def), and Zone Magique
 * (suppress the attacker's / defender's held-item effects). All default off.
 */
export interface FieldGlobalDamageContext {
  defenderGroundedByGravity?: boolean;
  defenderDefensesSwapped?: boolean;
  attackerItemSuppressed?: boolean;
  defenderItemSuppressed?: boolean;
}

/**
 * Selects the offensive stat (raw value + stage) for the damage formula.
 * Default: the user's Attack (physical) or Sp. Atk (special). `attackStatSource` overrides this:
 * `UserDefense` uses the user's Defense (body-press), `TargetAttack` the target's Attack (foul-play).
 */
function resolveAttackStat(
  move: MoveDefinition,
  attacker: PokemonInstance,
  defender: PokemonInstance,
  isPhysical: boolean,
): { stat: number; stage: number } {
  switch (move.attackStatSource) {
    case AttackStatSource.UserDefense:
      return { stat: attacker.combatStats.defense, stage: attacker.statStages.defense };
    case AttackStatSource.TargetAttack:
      return { stat: defender.combatStats.attack, stage: defender.statStages.attack };
    default:
      return isPhysical
        ? { stat: attacker.combatStats.attack, stage: attacker.statStages.attack }
        : { stat: attacker.combatStats.spAttack, stage: attacker.statStages.spAttack };
  }
}

export function calculateDamageWithCrit(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: MoveDefinition,
  typeChart: TypeChart,
  attackerTypes: PokemonType[],
  defenderTypes: PokemonType[],
  rollFactor?: number,
  random: RandomFn = () => Math.random(),
  heightModifier = 1.0,
  terrainModifier = 1.0,
  facingModifier = 1.0,
  abilityRegistry?: AbilityHandlerRegistry,
  itemRegistry?: HeldItemHandlerRegistry,
  weatherBpMultiplier = 1.0,
  defenseWeatherMultiplier = 1.0,
  screenMultiplier = 1.0,
  brickBreakMultiplier = 1.0,
  fieldTerrainBpMultiplier = 1.0,
  fieldTerrainDamageMultiplier = 1.0,
  weather: Weather = Weather.None,
  targetAlreadyActed = false,
  fieldGlobal: FieldGlobalDamageContext = {},
): DamageResult {
  if (move.category === Category.Status || move.power === 0) {
    return { damage: 0, isCrit: false };
  }

  const attackerAbility = abilityRegistry?.getForPokemon(attacker);
  // Brise Moule (attacker) ignores the defender's breakable abilities (Isograisse, Filtre,
  // Multiécaille, Armurbaston/Coque Armure crit-block, …) during this hit.
  const defenderAbility = resolveDefensiveAbility(abilityRegistry, defender, attacker);

  // Querelleur (scrappy): Normal- and Fighting-type moves ignore Ghost's type immunity.
  const scrappyGhostBypass = attackerAbility?.id === "scrappy";

  const effectiveness = getTypeEffectiveness(
    move.type,
    defenderTypes,
    typeChart,
    move.typeEffectivenessOverride,
    scrappyGhostBypass,
    fieldGlobal.defenderGroundedByGravity === true,
  );
  if (effectiveness === 0) {
    return { damage: 0, isCrit: false };
  }

  const isPhysical = move.category === Category.Physical;
  const { stat: attackStat, stage: attackStage } = resolveAttackStat(
    move,
    attacker,
    defender,
    isPhysical,
  );
  // Zone Étrange (wonder-room): a defender inside the zone swaps its Def ↔ Sp.Def bases. The stat
  // STAGE stays attached to its original slot (Gen 6+), so we flip which base the chosen stage reads
  // — i.e. flip the physical/special selection for the defensive stat only.
  const usesPhysicalDefense = isPhysical || move.hitsPhysicalDefense === true;
  const readsPhysicalDefenseBase =
    fieldGlobal.defenderDefensesSwapped === true ? !usesPhysicalDefense : usesPhysicalDefense;
  const defenseStat = readsPhysicalDefenseBase
    ? defender.combatStats.defense
    : defender.combatStats.spDefense;
  const defenseStage = usesPhysicalDefense
    ? defender.statStages.defense
    : defender.statStages.spDefense;

  // Inconscient (unaware): the holder ignores the opponent's stat stages when computing damage.
  // Attacker's unaware ignores the defender's defensive stages; defender's unaware ignores the
  // attacker's offensive stages.
  const attackStageForCalc = defenderAbility?.id === "unaware" ? 0 : attackStage;
  // Dark Lariat (darkest-lariat): ignore the target's defensive stat stages (both signs).
  const defenseStageForCalc =
    move.ignoresDefensiveStages === true || attackerAbility?.id === "unaware" ? 0 : defenseStage;

  let effectiveAttack = getEffectiveStat(attackStat, attackStageForCalc);

  const isBurned = attacker.statusEffects.some((s) => s.type === StatusTypeEnum.Burned);
  const gutsIgnoresBurn = attackerAbility?.id === "guts";
  if (isBurned && isPhysical && !gutsIgnoresBurn && !move.ignoresBurnAttackDrop) {
    effectiveAttack = Math.floor(effectiveAttack / 2);
  }

  // Zone Magique (magic-room): a holder inside the zone has its held-item effects suppressed.
  const attackerItem = fieldGlobal.attackerItemSuppressed
    ? undefined
    : itemRegistry?.getForPokemon(attacker);

  const baseCritStage = move.critRatio ?? 0;
  const itemCritStage = attackerItem?.onCritStageBoost?.({ self: attacker, move }) ?? 0;
  const volatileCritStage = attacker.critStageBoost ?? 0;
  const totalCritStage = baseCritStage + itemCritStage + volatileCritStage;
  // Yama Arashi (alwaysCrit) / Affilage (guaranteedCritArmed) force a crit; `preventsCrit` (Coque
  // Armure / Muscle Coque) still overrides — crit immunity wins.
  const forcedCrit = move.alwaysCrit === true || attacker.guaranteedCritArmed === true;
  const isCrit = defenderAbility?.preventsCrit
    ? false
    : forcedCrit || random() < getCritChance(totalCritStage);

  const critDefenseStage = isCrit ? Math.max(0, defenseStageForCalc) : defenseStageForCalc;
  const effectiveDefense = Math.floor(
    getEffectiveStat(defenseStat, critDefenseStage) * defenseWeatherMultiplier,
  );

  const adjustedPower = Math.max(
    1,
    Math.floor(move.power * weatherBpMultiplier * fieldTerrainBpMultiplier),
  );
  const baseDamage = Math.floor(
    (((2 * BATTLE_LEVEL) / 5 + 2) * adjustedPower * effectiveAttack) / effectiveDefense / 50 + 2,
  );

  const stab = getStab(move.type, attackerTypes, attackerAbility?.id);

  const roll = rollFactor ?? random() * 0.15 + 0.85;

  const attackerAbilityMod =
    attackerAbility?.onDamageModify?.({
      self: attacker,
      opponent: defender,
      move,
      isAttacker: true,
      attackerTypes,
      defenderTypes,
      effectiveness,
      isCrit,
      weather,
      targetAlreadyActed,
    }) ?? 1.0;

  const defenderAbilityMod =
    defenderAbility?.onDamageModify?.({
      self: defender,
      opponent: attacker,
      move,
      isAttacker: false,
      attackerTypes,
      defenderTypes,
      effectiveness,
      isCrit,
      weather,
      targetAlreadyActed,
    }) ?? 1.0;

  const attackerItemMod =
    attackerItem?.onDamageModify?.({
      self: attacker,
      opponent: defender,
      move,
      isAttacker: true,
      attackerTypes,
      defenderTypes,
      effectiveness,
      isCrit,
      weather,
      targetAlreadyActed,
    }) ?? 1.0;

  const defenderItem = fieldGlobal.defenderItemSuppressed
    ? undefined
    : itemRegistry?.getForPokemon(defender);
  const defenderItemMod =
    defenderItem?.onDamageModify?.({
      self: defender,
      opponent: attacker,
      move,
      isAttacker: false,
      attackerTypes,
      defenderTypes,
      effectiveness,
      isCrit,
      weather,
      targetAlreadyActed,
    }) ?? 1.0;

  const critMod = isCrit ? 1.5 : 1.0;
  const effectiveScreenMultiplier = isCrit ? 1.0 : screenMultiplier;

  // Sabotage (knock-off): ×1.5 when the target carries a removable item (Glu protects it).
  const knockOffMod =
    move.knockOffBoost === true &&
    defender.heldItemId !== undefined &&
    defenderAbility?.id !== "sticky-hold"
      ? 1.5
      : 1.0;

  const damage = Math.max(
    1,
    Math.floor(
      baseDamage *
        stab *
        effectiveness *
        roll *
        heightModifier *
        terrainModifier *
        facingModifier *
        attackerAbilityMod *
        defenderAbilityMod *
        attackerItemMod *
        defenderItemMod *
        critMod *
        effectiveScreenMultiplier *
        brickBreakMultiplier *
        knockOffMod *
        fieldTerrainDamageMultiplier,
    ),
  );

  return { damage, isCrit };
}

const NO_CRIT: RandomFn = () => 1;

export function calculateDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: MoveDefinition,
  typeChart: TypeChart,
  attackerTypes: PokemonType[],
  defenderTypes: PokemonType[],
  rollFactor?: number,
  heightModifier = 1.0,
  terrainModifier = 1.0,
  facingModifier = 1.0,
  abilityRegistry?: AbilityHandlerRegistry,
  itemRegistry?: HeldItemHandlerRegistry,
  weatherBpMultiplier = 1.0,
  defenseWeatherMultiplier = 1.0,
  screenMultiplier = 1.0,
  brickBreakMultiplier = 1.0,
  fieldTerrainBpMultiplier = 1.0,
  fieldTerrainDamageMultiplier = 1.0,
  weather: Weather = Weather.None,
  targetAlreadyActed = false,
): number {
  return calculateDamageWithCrit(
    attacker,
    defender,
    move,
    typeChart,
    attackerTypes,
    defenderTypes,
    rollFactor,
    NO_CRIT,
    heightModifier,
    terrainModifier,
    facingModifier,
    abilityRegistry,
    itemRegistry,
    weatherBpMultiplier,
    defenseWeatherMultiplier,
    screenMultiplier,
    brickBreakMultiplier,
    fieldTerrainBpMultiplier,
    fieldTerrainDamageMultiplier,
    weather,
    targetAlreadyActed,
  ).damage;
}

export function getTypeEffectiveness(
  moveType: PokemonType,
  defenderTypes: PokemonType[],
  typeChart: TypeChart,
  override?: { against: PokemonType; multiplier: number },
  scrappyGhostBypass = false,
  gravityGroundBypass = false,
): number {
  let multiplier = 1;
  const attackerRow = typeChart[moveType];
  if (!attackerRow) {
    return 1;
  }
  for (const defType of defenderTypes) {
    // Querelleur (scrappy): treat Ghost as neutral for Normal/Fighting moves (no immunity).
    if (
      scrappyGhostBypass &&
      defType === PokemonType.Ghost &&
      (moveType === PokemonType.Normal || moveType === PokemonType.Fighting)
    ) {
      continue;
    }
    // Gravité: a grounded defender loses its Flying-type immunity to Ground moves.
    if (gravityGroundBypass && defType === PokemonType.Flying && moveType === PokemonType.Ground) {
      continue;
    }
    if (override && defType === override.against) {
      multiplier *= override.multiplier;
      continue;
    }
    const value = attackerRow[defType];
    if (value !== undefined) {
      multiplier *= value;
    }
  }
  return multiplier;
}

export function getStab(
  moveType: PokemonType,
  attackerTypes: PokemonType[],
  abilityId?: string,
): number {
  if (!attackerTypes.includes(moveType)) {
    return 1;
  }
  return abilityId === "adaptability" ? 2.0 : 1.5;
}

const ROLL_MIN = 0.85;
const ROLL_MAX = 1.0;

export function estimateDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: MoveDefinition,
  typeChart: TypeChart,
  attackerTypes: PokemonType[],
  defenderTypes: PokemonType[],
  heightModifier = 1.0,
  terrainModifier = 1.0,
  facingModifier = 1.0,
  abilityRegistry?: AbilityHandlerRegistry,
  itemRegistry?: HeldItemHandlerRegistry,
  fieldTerrainBpMultiplier = 1.0,
  fieldTerrainDamageMultiplier = 1.0,
): DamageEstimate {
  const resolvedMove = resolveDynamicPower(move, attacker, defender);
  const effectiveness = getTypeEffectiveness(
    resolvedMove.type,
    defenderTypes,
    typeChart,
    resolvedMove.typeEffectivenessOverride,
  );
  const min = calculateDamage(
    attacker,
    defender,
    resolvedMove,
    typeChart,
    attackerTypes,
    defenderTypes,
    ROLL_MIN,
    heightModifier,
    terrainModifier,
    facingModifier,
    abilityRegistry,
    itemRegistry,
    1.0,
    1.0,
    1.0,
    1.0,
    fieldTerrainBpMultiplier,
    fieldTerrainDamageMultiplier,
  );
  const max = calculateDamage(
    attacker,
    defender,
    resolvedMove,
    typeChart,
    attackerTypes,
    defenderTypes,
    ROLL_MAX,
    heightModifier,
    terrainModifier,
    facingModifier,
    abilityRegistry,
    itemRegistry,
    1.0,
    1.0,
    1.0,
    1.0,
    fieldTerrainBpMultiplier,
    fieldTerrainDamageMultiplier,
  );
  return { min, max, effectiveness, facingModifier };
}
