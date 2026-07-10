import type { PokemonType } from "../enums/pokemon-type";
import type { StatName } from "../enums/stat-name";
import type { StatusType } from "../enums/status-type";
import type { Weather } from "../enums/weather";
import type { BattleEvent } from "./battle-event";
import type { BattleState } from "./battle-state";
import type { MoveDefinition } from "./move-definition";
import type { PokemonInstance } from "./pokemon-instance";

export interface DamageModifyContext {
  self: PokemonInstance;
  opponent: PokemonInstance;
  move: MoveDefinition;
  isAttacker: boolean;
  attackerTypes: PokemonType[];
  defenderTypes: PokemonType[];
  effectiveness: number;
  isCrit: boolean;
  /** Effective weather at resolution time (None if a weather-suppressing ability is active). */
  weather: Weather;
  /** True if the opponent has already acted before this move in the current action sequence. */
  targetAlreadyActed: boolean;
}

export interface AfterDamageContext {
  self: PokemonInstance;
  attacker: PokemonInstance;
  move: MoveDefinition;
  damageDealt: number;
  wasAtMaxHp: boolean;
  isCrit: boolean;
  state: BattleState;
  selfTypes: PokemonType[];
  attackerTypes: PokemonType[];
  random: () => number;
  /** True when the attacker holds Pare-Effet: contact-triggered reactions must not fire. */
  contactNullified?: boolean;
}

export interface AfterDamageDealtContext {
  self: PokemonInstance;
  target: PokemonInstance;
  move: MoveDefinition;
  damageDealt: number;
  state: BattleState;
  selfTypes: PokemonType[];
  targetTypes: PokemonType[];
  random: () => number;
}

export interface AfterStatusContext {
  self: PokemonInstance;
  source: PokemonInstance | null;
  status: StatusType;
  state: BattleState;
  selfTypes: PokemonType[];
  sourceTypes: PokemonType[];
  random: () => number;
}

export interface StatusBlockContext {
  self: PokemonInstance;
  status: StatusType;
  source: PokemonInstance | null;
  /** Effective weather at infliction time (None if a weather-suppressing ability is active). */
  weather: Weather;
}

export interface MoveImmunityContext {
  self: PokemonInstance;
  move: MoveDefinition;
}

export interface AbilityAccuracyContext {
  self: PokemonInstance;
  target: PokemonInstance;
  move: MoveDefinition;
}

export interface AbilityEvasionContext {
  /** The defender (ability holder) being targeted. */
  self: PokemonInstance;
  /** The attacker whose move accuracy is being checked. */
  target: PokemonInstance;
  move: MoveDefinition;
}

export interface DrainAttemptContext {
  /** The drained Pokemon (the ability holder). */
  self: PokemonInstance;
  /** The attacker that would heal from the drain. */
  attacker: PokemonInstance;
  /** HP the attacker would have recovered. */
  drainAmount: number;
}

export interface DrainAttemptResult {
  redirect: boolean;
  events: BattleEvent[];
}

export interface StatusDurationContext {
  self: PokemonInstance;
  status: StatusType;
  duration: number;
}

export interface StatChangeBlockContext {
  self: PokemonInstance;
  stat: StatName;
  stages: number;
  source: PokemonInstance | null;
}

export interface AbilityStatLoweredContext {
  self: PokemonInstance;
  stat: StatName;
  stages: number;
  source: PokemonInstance | null;
}

export interface TypeImmunityContext {
  self: PokemonInstance;
  moveType: PokemonType;
}

export interface AfterKOContext {
  self: PokemonInstance;
  target: PokemonInstance;
  move: MoveDefinition;
  state: BattleState;
}

export interface BattleStartContext {
  self: PokemonInstance;
  state: BattleState;
  pokemonTypesMap: Map<string, PokemonType[]>;
}

export interface AuraCheckContext {
  self: PokemonInstance;
  state: BattleState;
  pokemonTypesMap: Map<string, PokemonType[]>;
}

export interface BlockResult {
  blocked: boolean;
  events: BattleEvent[];
}

export interface DurationModifyResult {
  duration: number;
  events: BattleEvent[];
}

export interface AbilityEndTurnContext {
  self: PokemonInstance;
  state: BattleState;
  random: () => number;
  /** Effective weather (None if a weather-suppressing ability like Ciel Gris is active). */
  weather: Weather;
}

export interface AbilityFlinchContext {
  self: PokemonInstance;
  state: BattleState;
}

export interface AbilityHandler {
  id: string;
  /**
   * True if Brise Moule (mold-breaker) ignores this ability while attacking.
   * Mirrors Showdown's `breakable` ability flag (injected from the reference by load-abilities).
   * Defensive abilities that hinder a move's execution are breakable; reactive abilities
   * (Statik, Corps Ardent, …) are not. Read by `resolveDefensiveAbility`.
   */
  breakable?: boolean;
  /**
   * True if this ability cannot be suppressed by Suc Digestif (gastro-acid) — Showdown's
   * `unsuppressable` flag (injected from the reference by load-abilities). No Gen 1 roster ability is
   * unsuppressable in practice, but the gate is honoured for correctness. Read by `handleSuppressAbility`.
   */
  unsuppressable?: boolean;
  blocksIndirectDamage?: boolean;
  blocksRecoil?: boolean;
  preventsCrit?: boolean;
  accuracyMultiplier?: number;
  targetedCtBonus?: number;
  weatherSpeedBoost?: { weather: Weather; multiplier: number };
  weatherEvasionBoost?: { weather: Weather; stages: number };
  weatherAutoSetter?: { weather: Weather; turns: number };
  /** Speed (CT) multiplier applied while the holder carries a major status (Pied Véloce). */
  statusSpeedBoost?: { multiplier: number };
  suppressesWeatherEffects?: boolean;
  onAccuracyOverride?: () => boolean;
  onAccuracyModify?: (context: AbilityAccuracyContext) => number;
  onEvasionModify?: (context: AbilityEvasionContext) => number;
  onMoveImmunity?: (context: MoveImmunityContext) => BlockResult;
  onDrainAttempt?: (context: DrainAttemptContext) => DrainAttemptResult;
  onAfterKO?: (context: AfterKOContext) => BattleEvent[];
  onDamageModify?: (context: DamageModifyContext) => number;
  onAfterDamageReceived?: (context: AfterDamageContext) => BattleEvent[];
  onAfterDamageDealt?: (context: AfterDamageDealtContext) => BattleEvent[];
  onAfterStatusReceived?: (context: AfterStatusContext) => BattleEvent[];
  onStatusBlocked?: (context: StatusBlockContext) => BlockResult;
  onStatusDurationModify?: (context: StatusDurationContext) => DurationModifyResult;
  onStatChangeBlocked?: (context: StatChangeBlockContext) => BlockResult;
  onAfterStatLowered?: (context: AbilityStatLoweredContext) => BattleEvent[];
  onTypeImmunity?: (context: TypeImmunityContext) => BlockResult;
  onBattleStart?: (context: BattleStartContext) => BattleEvent[];
  onAuraCheck?: (context: AuraCheckContext) => BattleEvent[];
  onEndTurn?: (context: AbilityEndTurnContext) => BattleEvent[];
  onFlinch?: (context: AbilityFlinchContext) => BattleEvent[];
}

export interface AbilityDefinition extends AbilityHandler {
  name: { fr: string; en: string };
  shortDescription: { fr: string; en: string };
}
