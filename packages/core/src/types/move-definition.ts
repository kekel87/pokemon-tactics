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
  /** Special move that hits the target's physical Defense instead of Sp. Def (psyshock, psystrike). */
  hitsPhysicalDefense?: boolean;
  /** Force a type-effectiveness multiplier against one type (freeze-dry: x2 vs Water). */
  typeEffectivenessOverride?: { against: PokemonType; multiplier: number };
  /** Re-roll accuracy before each hit after the first; a miss stops the move (triple-axel). */
  perHitAccuracy?: boolean;
  /** Self-damage (fraction of max HP) when the move fails to connect (high-jump-kick, axe-kick). */
  crashOnMiss?: { fraction: number };
}
