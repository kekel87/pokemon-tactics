import type { Direction } from "../enums/direction";
import type { HeldItemId } from "../enums/held-item-id";
import type { Nature } from "../enums/nature";
import type { PlayerId } from "../enums/player-id";
import type { PokemonGender } from "../enums/pokemon-gender";
import type { StatName } from "../enums/stat-name";
import type { ActiveDefense } from "./active-defense";
import type { BaseStats } from "./base-stats";
import type { DerivedStats } from "./derived-stats";
import type { Position } from "./position";
import type { SemiInvulnerableState } from "./semi-invulnerable-state";
import type { StatSpread } from "./stat-spread";
import type { StatusEffect } from "./status-effect";
import type { VolatileStatus } from "./volatile-status";

export interface PokemonInstance {
  id: string;
  definitionId: string;
  playerId: PlayerId;
  level: number;
  currentHp: number;
  maxHp: number;
  baseStats: BaseStats;
  combatStats: BaseStats;
  /** Body weight in kilograms (from the species definition); drives weight-based move power. */
  weight: number;
  derivedStats: DerivedStats;
  statStages: Record<StatName, number>;
  statusEffects: StatusEffect[];
  position: Position;
  orientation: Direction;
  moveIds: string[];
  activeDefense: ActiveDefense | null;
  /** `actionCounter` of the last turn this mon used Endure/Detect-style defense (anti-spam gate). */
  lastEndureAtAction: number | null;
  toxicCounter: number;
  volatileStatuses: VolatileStatus[];
  recharging: boolean;
  gender: PokemonGender;
  nature: Nature;
  statSpread?: StatSpread;
  abilityId?: string;
  abilityFirstTriggered?: boolean;
  heldItemId?: HeldItemId;
  lockedMoveId?: string;
  chargingMove?: { moveId: string; targetPosition?: Position };
  semiInvulnerableState?: SemiInvulnerableState;
  substituteHp?: number;
  lastUsedMoveId?: string;
  /** Consecutive-cast count for Rollout (Roulade) — snowballs Dash range + power. Reset to 0 on any other move. */
  rolloutStreak?: number;
  /**
   * Action-clock stamps (B3 conditional-damage moves). Each holds the value of
   * `BattleState.actionCounter` at the moment the event happened. A stamp older than
   * `lastActedAtAction` means "not since my last action". Model-agnostic (round & CT).
   */
  /** `actionCounter` when this mon last completed an action. */
  lastActedAtAction?: number;
  /** `actionCounter` when this mon last took any damage. */
  lastDamagedAtAction?: number;
  /** `actionCounter` when this mon last took damage from an enemy. */
  lastDamagedByEnemyAtAction?: number;
  /**
   * True while this mon holds a stat boost it has not yet "cashed in" by acting.
   * Set on any stat raise; cleared at the start of this mon's next action.
   * Drives Alluring Voice / Burning Jealousy (the CT-equivalent of "stats raised this turn").
   */
  hasFreshStatBoost?: boolean;
  /** Number of damaging hits taken since entering battle (Rage Fist). Never reset per-turn. */
  timesHit?: number;
  /** True when this mon's last resolved move failed (missed / blocked / immune) — Stomping Tantrum. */
  lastMoveFailed?: boolean;
  /** Move ids this mon has used at least once (Last Resort gate). */
  usedMoveIds?: string[];
  /**
   * True if this mon changed position this turn (own movement, knockback, or ice slide).
   * Reset at the start of each turn. Gates the Ingrain heal-over-time tick (B2 healing).
   */
  movedThisTurn?: boolean;
  /**
   * Pending Wish heal (B2 healing). `healAmount` is frozen at cast (50% of the caster's max HP);
   * `castAtAction` is `BattleState.actionCounter` at cast. Fires on the target's next turn when
   * `actionCounter > castAtAction`. Follows the mon, not the tile.
   */
  pendingWish?: { healAmount: number; castAtAction: number };
  /**
   * One-shot Charge-Time tax from Dépit (spite). Added to this mon's `actionCost` on its next
   * completed action, then cleared — delaying its following turn. Cleared on KO.
   */
  pendingCtPenalty?: number;
  /**
   * Requiem (perish-song) death aura, owned by the caster. A mobile zone of Manhattan `radius`
   * centred on the caster (recomputed from its live position, so it follows the caster). Decremented
   * on the caster's own turn; when `turnsRemaining` reaches 0 every living mon inside the zone faints
   * — allies, enemies and the caster itself (always at the centre → a true sacrifice). Cleared on KO
   * (the aura dies with its caster, no ghost clock).
   */
  perishAura?: { turnsRemaining: number; radius: number };
  /**
   * Helping Hand buff (Coup d'Main): set on an adjacent ally. On the ally's NEXT completed action it
   * is consumed: an offensive move (`power > 0`) is multiplied by `HELPING_HAND_MULTIPLIER`; a
   * status/heal move wastes it. Either way it clears after that action. Cleared on KO.
   */
  helpingHand?: boolean;
}
