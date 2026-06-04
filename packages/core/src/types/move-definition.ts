import type { AttackStatSource } from "../enums/attack-stat-source";
import type { Category } from "../enums/category";
import type { EffectTier } from "../enums/effect-tier";
import type { PokemonType } from "../enums/pokemon-type";
import type { Weather } from "../enums/weather";
import type { DynamicPowerSpec } from "./dynamic-power-spec";
import type { Effect } from "./effect";
import type { MoveFlags } from "./move-flags";
import type { SemiInvulnerableState } from "./semi-invulnerable-state";
import type { TargetingPattern } from "./targeting-pattern";

export interface MoveDefinition {
  id: string;
  name: string;
  type: PokemonType;
  category: Category;
  power: number;
  accuracy: number;
  pp: number;
  targeting: TargetingPattern;
  effects: Effect[];
  recharge?: boolean;
  ignoresHeight?: boolean;
  flags?: MoveFlags;
  effectTier?: EffectTier;
  critRatio?: number;
  bypassAccuracy?: boolean;
  bypassProtect?: boolean;
  weatherSetter?: { type: Weather; turns: number };
  weatherBoostedType?: boolean;
  twoTurnCharge?: boolean;
  sunSkipsCharge?: boolean;
  semiInvulnerableState?: SemiInvulnerableState;
  chargeEffects?: Effect[];
  targetsAlly?: boolean;
  /** Recompute base power at hit time from battle state (facade, hex, electro-ball, ...). */
  dynamicPower?: DynamicPowerSpec;
  /** Skip the burn physical-attack halving (facade). */
  ignoresBurnAttackDrop?: boolean;
  /** Override the offensive stat used in the damage formula (body-press, foul-play). */
  attackStatSource?: AttackStatSource;
}
