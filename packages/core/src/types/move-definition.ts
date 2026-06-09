import type { AttackStatSource } from "../enums/attack-stat-source";
import type { Category } from "../enums/category";
import type { EffectTier } from "../enums/effect-tier";
import type { FieldTerrain } from "../enums/field-terrain";
import type { FieldTerrainBonusWho } from "../enums/field-terrain-bonus-who";
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
  /** Single-target move that may target an ally or the caster itself, within range (wish). */
  targetsAllyOrSelf?: boolean;
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
  /** Only usable while the user is asleep (snore). */
  requiresAsleep?: boolean;
  /** Only usable once every other move in the moveset has been used at least once (last-resort). */
  requiresAllOtherMovesUsed?: boolean;
  /** The move fails (no damage / no drain) unless the target is asleep (dream-eater). */
  requiresTargetAsleep?: boolean;
  /**
   * Field-terrain (B4) power bonus: multiply base power when `who` stands on `terrain`. Folded into
   * the field-terrain BP multiplier threaded to the damage calc (Rising Voltage, Misty Explosion,
   * Expanding Force ×1.5). Distinct from `fieldTerrainBoostedType` (type morph).
   */
  fieldTerrainPowerBonus?: { who: FieldTerrainBonusWho; terrain: FieldTerrain; multiplier: number };
  /**
   * Field-terrain (B4) Dash range bonus: while the caster stands on `terrain` at the start tile,
   * the Dash `maxDistance` is extended by `bonus` (Grassy Glide: 2 → 4 on Grassy Terrain).
   */
  dashRangeBonusOnFieldTerrain?: { terrain: FieldTerrain; bonus: number };
  /**
   * Field-terrain (B4) targeting override: while the caster stands on `terrain`, the move's
   * effective targeting becomes `targeting` (Expanding Force: Single → Zone r2 on Psychic Terrain).
   * The companion ×1.5 is carried by `fieldTerrainPowerBonus`, resolved separately.
   */
  fieldTerrainTargetingOverride?: { terrain: FieldTerrain; targeting: TargetingPattern };
  /**
   * Field-terrain (B4) type morph (mirror of `weatherBoostedType`): while the caster stands on a
   * field terrain, the move's type follows the terrain and power doubles to 100 (Terrain Pulse).
   */
  fieldTerrainBoostedType?: boolean;
  /**
   * Force Nature (B4): replace the whole move with another, chosen by the field terrain / map tile
   * under the caster (Nature Power). Resolved to a full MoveDefinition at use time.
   */
  naturePowerMorph?: boolean;
}
