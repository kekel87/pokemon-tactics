import type { AttackStatSource } from "../enums/attack-stat-source";
import type { CallMoveSourceKind } from "../enums/call-move-source-kind";
import type { Category } from "../enums/category";
import type { ChargeReaction } from "../enums/charge-reaction";
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
  /** Explosion move (Destruction): fizzles entirely while a Pokémon with Moiteur (damp) is on the field. */
  isExplosion?: boolean;
  /**
   * Sacrifice / Self-KO family (plan 147): the user faints once the move resolves, unconditionally
   * (Souvenir, Vœu Soin). Unlike `isExplosion` this is NOT blocked by Moiteur (canon: Damp only stops
   * explosions). `isExplosion` implies this behaviour on its own — do not set both.
   */
  selfKo?: boolean;
  /**
   * Self-KO conditional on connecting (Tout ou Rien / final-gambit): the user faints only if the move
   * dealt damage to at least one non-self target (a miss / a Ghost immunity leaves the user alive, CT paid).
   */
  selfKoOnConnect?: boolean;
  /**
   * OHKO family (K.O. en un coup — Abîme / Guillotine / Empal'Korne / Glaciation): the move rolls a
   * flat dedicated accuracy (ignoring Accuracy/Evasion stages, precision abilities/items, Gravity)
   * and, on hit, deals damage equal to the target's max HP. Routed through `handle-damage` so
   * Protection / Ténacité / Baie Ceinture / Clone all apply; type/Ice/Fermeté immunities are
   * pre-filtered engine-side (see `battle/ohko.ts`).
   */
  isOhko?: boolean;
  /** Glaciation: OHKO accuracy is 30% if the user is Ice-type, 20% otherwise. */
  ohkoIceAccuracyRule?: boolean;
  /** Glaciation: an Ice-type target is immune to the OHKO (special rule, outside the type chart). */
  ohkoIceImmunity?: boolean;
  /** Sabotage (knock-off): ×1.5 damage when the target carries a removable item. */
  knockOffBoost?: boolean;
  /** Éructation (belch): the move fails unless the user has eaten a berry this battle. */
  requiresEatenBerry?: boolean;
  /** Dégommage (fling): the move requires the user to hold a flingable item (has a fling power). */
  requiresFlingableItem?: boolean;
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
  /**
   * Jump/levitation move that cannot be launched from within a Gravité zone (Pied Voltige; future
   * Saut / Vol Magnétik). Airborne charge moves (Vol, Rebond) are caught implicitly via their
   * `semiInvulnerableState === Flying` and need not set this flag.
   */
  disabledUnderGravity?: boolean;
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
  /** The move fails wholesale (no damage) unless the user currently has this type (Flamme Ultime → Fire). */
  requiresUserType?: PokemonType;
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
  /**
   * Move-copy family (plan 144): this move executes ANOTHER move resolved at use time (Métronome,
   * Blabla Dodo, Mimique, Photocopie). `prepareCalledMove` rolls/resolves the called move and stores
   * it on `PokemonInstance.pendingCalledMove`; `resolveEffectiveMove` then swaps to it. CT cost and
   * `lastUsedMoveId` stay on this source move; the global-last record gets the called move.
   */
  callMove?: CallMoveSourceKind;
  /**
   * Lock-in multi-turn family (plan 149): on use the caster is locked into repeating this move for a
   * random `minTurns..maxTurns` casts (fixed if min === max). `confuseOnEnd` self-confuses the caster
   * when the lock expires (Mania / Danse Fleurs / Colère / Grand Courroux — canon rampage downside;
   * Brouhaha sets it false). Handled by `battle/lock-in.ts` after the move resolves.
   */
  lockIn?: { minTurns: number; maxTurns: number; confuseOnEnd: boolean };
  /**
   * Brouhaha (uproar): while the caster is locked into this move, it projects a mobile no-sleep aura
   * over Manhattan radius 3 (blocks new sleep + wakes sleepers in range, on the first cast). Sound-
   * based, ignores line of sight, no grounded gate. See `battle/uproar-aura.ts`.
   */
  uproarAura?: boolean;
  /**
   * Priority / timing conditional family (plan 150). The move is selectable ONLY on the user's first
   * completed action of the battle (Bluff / Escarmouche) — the grid reinterpretation of canon "first
   * turn out" (no switch-in here). Filtered in `getLegalActions` + guarded in `submitAction` via
   * `PokemonInstance.lastActedAtAction === undefined`.
   */
  firstActionOnly?: boolean;
  /**
   * Coup Bas (sucker-punch, plan 150): the move fizzles (0 damage, CT paid) unless the target's LAST
   * action was offensive. Reinterprets canon "fails if the target isn't attacking" onto the sequential
   * CT timeline via the action clock, with freshness: `target.lastOffensiveActionAtAction ===
   * target.lastActedAtAction` (its most recent action was a damaging move — not merely "attacked once").
   */
  failsUnlessTargetAggressive?: boolean;
  /**
   * Reactive two-turn charge family (plan 150): Mitra-Poing (`focus`) / Bec-Canon (`beak`) /
   * Carapiège (`shell`). Set alongside `twoTurnCharge` (charge without semi-invulnerability, like
   * skull-bash). Drives the reaction when the charging user is struck during its wait window
   * (`battle/charge-reaction.ts`) and the T2 fire gate. The three values are mutually exclusive.
   */
  chargeReaction?: ChargeReaction;
}
