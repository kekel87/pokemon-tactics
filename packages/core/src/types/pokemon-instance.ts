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
  /**
   * Runtime ability override (ability-manip family, plan 153: Soucigraine → Insomnie, Imitation
   * copies the target's ability, Échange swaps). Replaces `abilityId` everywhere the effective
   * ability is read (via `effectiveAbilityId`). A single override at a time — a new cast overwrites
   * the previous one. Mirrors `typeOverride`: persists for the rest of the battle (no switch in this
   * game; forced teleport keeps the instance), cleared on KO.
   */
  abilityIdOverride?: string;
  /**
   * Ability suppressed for the rest of the battle (Suc Digestif / gastro-acid, plan 153). Takes
   * priority over `abilityIdOverride`: while true, `effectiveAbilityId` returns undefined (the mon
   * behaves as if it had no ability). Cleared on KO.
   */
  abilitySuppressed?: boolean;
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
  /**
   * Runtime override of the raw Defense / Sp. Def stat (Partage Garde / guard-split, plan 162). When
   * set, replaces the species/transform value inside `effectiveCombatStats` (the single chokepoint the
   * damage calc reads) — never on the InfoPanel base-stat display, mirroring `speedStatOverride`
   * (decision, plan 162). Set to the caster↔target average by Partage Garde, persists for the rest of
   * the battle, cleared on KO, purged by Morphing at cast.
   */
  defenseStatOverride?: number;
  spDefenseStatOverride?: number;
  /**
   * Stockpile layers accumulated by Stockage (stockpile, plan 162), 0..3. Each layer also granted +1
   * Defense / +1 Sp. Def stage. Spent (and the stat boosts undone) by Relâche (spit-up) / Avale
   * (swallow). `undefined` means 0. Reset on KO.
   */
  stockpileCount?: number;
  /**
   * Actual Defense / Sp. Def stat-stage boost granted so far by Stockage (plan 162) — the real applied
   * amount, which may be less than `stockpileCount` if a stage was already near +6. Relâche / Avale
   * undo exactly this (canon: "reset by the number of levels they were raised by Stockpile"), never
   * more. `undefined` means 0. Reset on KO / cleared when the stockpile is spent.
   */
  stockpileDefBoost?: number;
  stockpileSpDefBoost?: number;
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
  /**
   * Grounded by Anti-Air (smack-down, plan 152): a Flying-type mon hit by Anti-Air loses its Ground-
   * move immunity and becomes vulnerable to grounded-only entry hazards, mirroring a Gravité zone but
   * per-instance. Read via `isEffectivelyGrounded`. Persists for the rest of the battle (no switch in
   * this game); cleared on KO.
   */
  smackedDown?: boolean;
  /**
   * Bâillement (yawn, plan 154): drowsiness countdown. Set to 1 on cast; the end-turn
   * `drowsy-tick-handler` decrements it after the target has acted, and at 0 applies Asleep — the
   * canon "one action of respite, then sleep". Not position-linked. Cleared on KO.
   */
  drowsyTurns?: number;
  /**
   * Vol Magnétik (magnet-rise, plan 154): remaining turns of temporary levitation. While `> 0` the mon
   * is effectively flying (Ground immunity + floats over lava/deep-water/hazards) unless a Gravité zone
   * or Anti-Air (`smackedDown`) grounds it — both dominate via `isEffectivelyGrounded`. Decremented
   * every start-turn by `magnet-rise-tick-handler`. Cleared on KO.
   */
  magnetRiseTurns?: number;
  /**
   * Après Vous (after-you, plan 155): when set, this mon is promoted to the strictly-next actor in
   * the CT scheduler at the start of the next `advanceTurn` (via `promoteToImmediateNext`), then the
   * flag is cleared. Set on an ally by the caster; keeps the effect handler free of engine access.
   * Cleared on KO.
   */
  pendingCtPromotion?: boolean;
  /**
   * Morphing / Imposteur (plan 157): snapshot of the copied identity. When set, the mon fights as a
   * copy of `definitionId` — combat stats, base speed, types, ability, moves, weight and gender are
   * read from here (via the `effective*` helpers), while `maxHp`/`currentHp` stay the caster's
   * (#649) and `statStages` are a plain snapshot taken at cast (#650, mutated in place afterwards).
   * Priority is `specific override > transformState > species` (#656): a later Détrempage / Échange /
   * Permuvitesse re-posts its own override which wins; `applyTransform` purges the caster's
   * pre-existing `typeOverride`/`abilityIdOverride`/`abilitySuppressed`/`speedStatOverride` at cast so
   * the morph is the active layer immediately. Also the "already transformed" gate. Cleared on KO.
   */
  transformState?: {
    definitionId: string;
    combatStats: BaseStats;
    baseSpeed: number;
    types: PokemonType[];
    abilityId?: string;
    moveIds: string[];
    weight: number;
    gender: PokemonGender;
  };
}
