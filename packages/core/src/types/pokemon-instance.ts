import type { ChargeReaction } from "../enums/charge-reaction";
import type { Direction } from "../enums/direction";
import type { HeldItemId } from "../enums/held-item-id";
import type { Nature } from "../enums/nature";
import type { PlayerId } from "../enums/player-id";
import type { PokemonGender } from "../enums/pokemon-gender";
import type { PokemonType } from "../enums/pokemon-type";
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
  /**
   * Tile this mon started the battle on (stamped once at engine init). The team's spawn zone is the
   * union of its members' `spawnPosition`s. Drives the eject items (Bouton Fuite / Carton Rouge),
   * which teleport a mon back to a safe tile of its spawn zone.
   */
  spawnPosition?: Position;
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
  /**
   * Last item this mon consumed by its own effect (berry eaten, gem spent, White Herb…). Set by
   * `consumeHeldItem`; restored by Recyclage (recycle). NOT set when an item is knocked off, stolen,
   * burned, corroded or flung — those removals are not recyclable by the loser. Survives KO.
   */
  consumedItemId?: HeldItemId;
  /**
   * True once this mon has eaten any berry this battle (own consumption, or a berry fed to it via
   * Picore/Piqûre/Dégommage). Gates Éructation (belch). Never reset. Survives KO.
   */
  ateBerryThisBattle?: boolean;
  /**
   * Persistent crit-stage boost (Baie Lansat, future Puissance/Affilage). Added to the move's
   * `critRatio` + item crit boost in the damage calc. Cleared on KO.
   */
  critStageBoost?: number;
  /**
   * One-shot guaranteed critical hit (Affilage / laser-focus, plan 151). When set, the caster's next
   * offensive move is forced to crit in the damage calc, regardless of its crit stage. Armed by the
   * `ArmGuaranteedCrit` effect; consumed at the end of the caster's NEXT completed action (whether it
   * attacked or not — the focus lasts one turn, canon). Cleared on KO. Stacks with `critStageBoost`
   * (Puissance stays posted for later hits).
   */
  guaranteedCritArmed?: boolean;
  lockedMoveId?: string;
  /**
   * Lock-in multi-turn family (plan 149: Mania / Danse Fleurs / Colère / Grand Courroux / Brouhaha).
   * While `lockInTurnsRemaining > 0`, the mon is forced to repeat `lockInMoveId` — filtered in
   * `getLegalActions` + guarded in `submitAction` (own branch, kept distinct from `lockedMoveId` which
   * two-turn charge / Choice already use). Set + decremented AFTER the move resolves each turn; when it
   * reaches 0 the lock clears and (for `confuseOnEnd` moves) the caster is confused. Cleared on KO.
   */
  lockInMoveId?: string;
  lockInTurnsRemaining?: number;
  chargingMove?: { moveId: string; targetPosition?: Position; reaction?: ChargeReaction };
  /**
   * Reactive-charge state (plan 150). `focusInterrupted` is set when a Mitra-Poing (`focus`) user
   * takes any direct damage while charging → its T2 strike fails. `shellTrapArmed` is set when a
   * Carapiège (`shell`) user is hit by a physical move while charging → the T2 strike is enabled
   * (else it fails). Both are posted by `battle/charge-reaction.ts`, read at the T2 fire gate, and
   * cleared when the charge resolves / is cancelled / on KO. Bec-Canon (`beak`) needs no flag (its
   * burn is applied immediately in the hook).
   */
  focusInterrupted?: boolean;
  shellTrapArmed?: boolean;
  /**
   * Move-copy family (plan 144). Set by `prepareCalledMove` when the caster commits a call-move
   * (Métronome / Blabla Dodo / Mimique / Photocopie): holds the move rolled/resolved for this turn
   * so the renderer can reveal its targeting pattern (name masked for the random ones) before the
   * player places the target. `reveal` = whether the called move's identity is shown (true for the
   * deterministic copies, false for the random ones). Sticky across a cancelled placement — re-
   * selecting the source move returns the SAME called move (anti-reroll); the roll only advances the
   * PRNG once per turn. Consumed when the matching move fires; cleared at end of turn and on KO.
   */
  pendingCalledMove?: { sourceMoveId: string; calledMoveId: string; reveal: boolean };
  semiInvulnerableState?: SemiInvulnerableState;
  substituteHp?: number;
  /**
   * Runtime type override (type-manip family: Conversion, Conversion 2, Copie-Type, Détrempage,
   * Flamme Ultime). When set, replaces the species types everywhere (STAB, effectiveness, terrain,
   * hazards, status immunity) via `resolveBaseTypes`. A single override at a time — a new cast
   * overwrites the previous one. `[]` means typeless (mono-Fire after Flamme Ultime), distinct from
   * `undefined` (no override). Persists for the rest of the battle (no switch in this game; forced
   * teleport keeps the instance). Cleared on KO.
   */
  typeOverride?: PokemonType[];
  /**
   * Runtime override of the raw Speed stat (Permuvitesse / speed-swap, plan 146). When set, replaces
   * `baseStats.speed` on the movement + turn-order (ctGain) paths via `effectiveBaseSpeed` — never on
   * the InfoPanel base-stat display, which keeps showing the species value (decision #597). Mirrors
   * `typeOverride`: a single by-instance override, persists for the rest of the battle (no switch in
   * this game; forced teleport keeps the instance), cleared on KO.
   */
  speedStatOverride?: number;
  lastUsedMoveId?: string;
  /** Consecutive-cast count for Rollout (Roulade) — snowballs Dash range + power. Reset to 0 on any other move. */
  rolloutStreak?: number;
  /**
   * Consecutive successful uses of the same move (Métronome objet) — 0..METRONOME_MAX_STEPS.
   * Drives the cumulative damage boost. Reset to 0 when the move changes or the previous use failed.
   */
  metronomeStreak?: number;
  /**
   * Action-clock stamps (B3 conditional-damage moves). Each holds the value of
   * `BattleState.actionCounter` at the moment the event happened. A stamp older than
   * `lastActedAtAction` means "not since my last action". Model-agnostic (round & CT).
   */
  /** `actionCounter` when this mon last completed an action. */
  lastActedAtAction?: number;
  /**
   * `actionCounter` when this mon last completed an OFFENSIVE action (a damaging move, `power > 0`).
   * Coup Bas (sucker-punch, plan 150) succeeds only when this equals `lastActedAtAction` — i.e. the
   * mon's most recent action was an attack, not a status move / displacement / wait. Freshness gate
   * that avoids the "attacked once, forever aggressive" stickiness of `lastUsedMoveId`.
   */
  lastOffensiveActionAtAction?: number;
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
  /**
   * Attribution of the last damaging hit this mon received (plan 147). Stamped in `handle-damage`
   * on every non-recoil hit that lowers HP; read by `handleKo` to resolve Lien du Destin (KO the
   * killer) and Rancune (lock the killing move on the killer). Overwritten by each new hit.
   */
  lastHitBy?: { attackerId: string; moveId: string };
  /**
   * Move ids permanently locked on this mon by an enemy's Rancune (grudge, plan 147): the mon KO'd a
   * Rancune holder with this move, so it can no longer select it for the rest of the battle. Filtered
   * in `getLegalActions` + guarded in `submitAction`. Cleared on KO (a fresh corpse holds no grudge-lock).
   */
  grudgeLockedMoveIds?: string[];
}
