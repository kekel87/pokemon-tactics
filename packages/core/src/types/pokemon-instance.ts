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
  currentPp: Record<string, number>;
  activeDefense: ActiveDefense | null;
  lastEndureRound: number | null;
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
}
