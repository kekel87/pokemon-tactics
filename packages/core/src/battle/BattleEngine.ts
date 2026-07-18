import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { CallMoveSourceKind } from "../enums/call-move-source-kind";
import { Category } from "../enums/category";
import { ChargeReaction } from "../enums/charge-reaction";
import { Direction } from "../enums/direction";
import { DynamicPowerKind } from "../enums/dynamic-power-kind";
import { EffectKind } from "../enums/effect-kind";
import { EffectTarget } from "../enums/effect-target";
import { EntryHazardKind } from "../enums/entry-hazard-kind";
import { FieldGlobalKind } from "../enums/field-global-kind";
import { HitAndRunRetreatFallbackReason } from "../enums/hit-and-run-retreat-fallback-reason";
import { MoveFailedReason } from "../enums/move-failed-reason";
import { PokemonType } from "../enums/pokemon-type";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { TargetingKind } from "../enums/targeting-kind";
import { isTerrainPassable, TerrainType } from "../enums/terrain-type";
import { Weather } from "../enums/weather";
import { Grid } from "../grid/Grid";
import { hasLineOfSight } from "../grid/line-of-sight";
import { resolveTargeting } from "../grid/targeting";
import { isValidHitAndRunRetreat } from "../grid/validate-hit-and-run-retreat";
import type { Action, ActionResult } from "../types/action";
import type { BattleEvent } from "../types/battle-event";
import { AuraDissipatedReason } from "../types/battle-event";
import type { BattleReplay } from "../types/battle-replay";
import type { BattleState } from "../types/battle-state";
import type { CtTimelineEntry } from "../types/ct-timeline-entry";
import type { DamageEstimate } from "../types/damage-estimate";
import type { EntryHazardCell } from "../types/entry-hazard-cell";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { RangeConfig } from "../types/range-config";
import { DEFAULT_STATUS_RULES, type StatusRules } from "../types/status-rules";
import type { TargetingPattern } from "../types/targeting-pattern";
import type { TileState } from "../types/tile-state";
import type { TraversalContext } from "../types/traversal-context";
import type { TypeChart } from "../types/type-chart";
import { directionFromTo, stepInDirection } from "../utils/direction";
import { manhattanDistance } from "../utils/manhattan-distance";
import type { RandomFn } from "../utils/prng";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { checkAccuracy, consumeLockedOn } from "./accuracy-check";
import { applyImpactDamage } from "./apply-impact-damage";
import { removeAurasOfCaster } from "./aura-system";
import { areBerriesSuppressed } from "./berry-suppression";
import { ChargeTimeTurnSystem } from "./ChargeTimeTurnSystem";
import {
  CT_START,
  CT_THRESHOLD,
  CT_WAIT,
  computeCtActionCost,
  computeCtGain,
  computeMoveCost,
} from "./ct-costs";
import { estimateDamage, getTypeEffectiveness } from "./damage-calculator";
import { findDampInTargets } from "./damp-system";
import { getAttackOrigin } from "./defense-check";
import {
  decrementDistortionTimer,
  invertedDistortionSpeed,
  isInDistortionZone,
} from "./distortion-system";
import { processEffects } from "./effect-processor";
import { effectiveBaseSpeed } from "./effective-base-speed";
import { isEffectivelyFlying, resolveBaseTypes } from "./effective-flying";
import { effectiveMoveIds } from "./effective-move-ids";
import {
  absorbsToxicSpikes,
  getEntryHazardsAt,
  isGroundedOnlyHazard,
  removeEntryHazardCell,
  spikesDamage,
  stealthRockDamage,
} from "./entry-hazard-system";
import { FacingZone, getFacingModifier, getFacingZone } from "./facing-modifier";
import { calculateFallDamage } from "./fall-damage";
import { isAirborneMove, isEffectivelyGrounded, isHeldItemSuppressed } from "./field-global-system";
import {
  decrementFieldTerrainsTimer,
  getFieldTerrainBpMultiplier,
  getFieldTerrainDamageMultiplier,
  getFieldTerrainMovePowerMultiplier,
  isEnemyPsychicBarrierAt,
  isOnFieldTerrain,
  PSYCHIC_BARRIER_IMPACT_HEIGHT,
  resolveEffectiveTargeting,
  resolveFieldTerrainPulseMove,
} from "./field-terrain-system";
import { tickFutureSightStrikesForCaster } from "./future-sight-system";
import { createAurasTickHandler } from "./handlers/aura-tick-handler";
import { cursedTickHandler } from "./handlers/cursed-tick-handler";
import { defensiveClearHandler } from "./handlers/defensive-clear-handler";
import { distortionDecrementHandler } from "./handlers/distortion-tick-handler";
import { createDrowsyTickHandler } from "./handlers/drowsy-tick-handler";
import { fieldGlobalDecrementHandler } from "./handlers/field-global-tick-handler";
import {
  createFieldTerrainHealHandler,
  fieldTerrainDecrementHandler,
} from "./handlers/field-terrain-tick-handler";
import { isImmuneToStatusByType } from "./handlers/handle-status";
import { hotTickHandler } from "./handlers/hot-tick-handler";
import { createInfatuationTickHandler } from "./handlers/infatuation-tick-handler";
import { magnetRiseTickHandler } from "./handlers/magnet-rise-tick-handler";
import { perishTickHandler } from "./handlers/perish-tick-handler";
import { roostedClearHandler } from "./handlers/roosted-clear-handler";
import { sacrificeBondExpireHandler } from "./handlers/sacrifice-bond-expire-handler";
import { createSeededTickHandler } from "./handlers/seeded-tick-handler";
import { createStatusTickHandler } from "./handlers/status-tick-handler";
import { tailwindDecrementHandler } from "./handlers/tailwind-tick-handler";
import { createTerrainTickHandler } from "./handlers/terrain-tick-handler";
import { timedVolatileTickHandler } from "./handlers/timed-volatile-tick-handler";
import { trappedTickHandler } from "./handlers/trapped-tick-handler";
import { createWeatherTickHandler } from "./handlers/weather-tick-handler";
import { wishTickHandler } from "./handlers/wish-tick-handler";
import { isHealBlocked, isHealingMove } from "./heal-block-system";
import { getHeightModifier } from "./height-modifier";
import { canEnterTerrain, canStopOn, canTraverse } from "./height-traversal";
import type { HeldItemHandlerRegistry } from "./held-item-handler-registry";
import { collectImprisonedMoveIds } from "./imprison-system";
import { type KnockbackOutcome, predictKnockbackOutcome } from "./knockback-prediction";
import { isLockInMove, resolveLockIn } from "./lock-in";
import { isMetronomeCallable, isSleepTalkCallable } from "./move-copy/callable-moves";
import { resolveNaturePowerMove } from "./nature-power-system";
import { type OhkoImmunity, ohkoAccuracy, ohkoImmunityReason } from "./ohko";
import { checkPositionLinkedStatuses } from "./position-linked-statuses";
import { computePressureBonus } from "./pressure";
import { pendingRolloutIndex, recordLastUsedMove, rolloutRangeForIndex } from "./rollout-streak";
import {
  canMoveHitSemiInvulnerable,
  getSemiInvulnerableDamageMultiplier,
} from "./semi-invulnerable";
import { clampStages, computeMovement, isMajorStatus } from "./stat-modifier";
import { tailwindSpeedMultiplier } from "./tailwind-system";
import {
  getImmuneTerrains,
  getMovementPenalty,
  getTerrainTypeBonusFactor,
  isTerrainImmune,
} from "./terrain-effects";
import type { PhaseHandler } from "./turn-pipeline";
import { TurnPipeline } from "./turn-pipeline";
import { decrementWeatherTimer, effectiveWeather, setWeather } from "./weather-system";

type EventHandler = (event: BattleEvent) => void;

interface ReachableTile {
  position: Position;
  path: Position[];
}

interface BfsNode {
  position: Position;
  path: Position[];
  distance: number;
}

export class BattleEngine {
  private readonly state: BattleState;
  private readonly moveRegistry: Map<string, MoveDefinition>;
  private readonly typeChart: TypeChart;
  private readonly chargeTimeTurnSystem: ChargeTimeTurnSystem;
  private readonly listeners: Map<string, Set<EventHandler>>;
  private readonly grid: Grid;
  private readonly pokemonTypesMap: Map<string, PokemonType[]>;
  private readonly turnPipeline: TurnPipeline;
  private readonly random: RandomFn;
  private readonly seed: number;
  private readonly statusRules: StatusRules;
  private readonly abilityRegistry: AbilityHandlerRegistry | null;
  private readonly itemRegistry: HeldItemHandlerRegistry | null;
  private readonly recordedActions: Action[] = [];
  private turnState = {
    hasMoved: false,
    hasActed: false,
    lastMoveId: null as string | null,
    lastTargetIds: [] as string[],
  };
  private preMoveSnapshot: { position: Position; orientation: Direction; hadBurn: boolean } | null =
    null;
  private restrictActions = false;
  private confusedThisTurn = false;
  /**
   * Affilage (laser-focus): snapshot of the actor's `guaranteedCritArmed` at the start of its action.
   * Consumed at end of turn only when it was already armed BEFORE this action (so the arming action
   * itself is not consumed — the crit lands on the NEXT action).
   */
  private critArmedAtActionStart = false;
  /** End-turn terrain tick handler, also reused to apply terrain the instant Gravité grounds a mon. */
  private readonly terrainTickHandler: PhaseHandler;
  private confusionChecked = false;
  private flinchedThisTurn = false;
  private battleOver = false;

  private startupEvents: BattleEvent[] = [];

  constructor(
    state: BattleState,
    moveRegistry: Map<string, MoveDefinition>,
    typeChart: TypeChart = {} as TypeChart,
    pokemonTypesMap: Map<string, PokemonType[]> = new Map(),
    turnPipeline: TurnPipeline = new TurnPipeline(),
    random?: RandomFn,
    seed = 0,
    statusRules: StatusRules = DEFAULT_STATUS_RULES,
    abilityRegistry: AbilityHandlerRegistry | null = null,
    itemRegistry: HeldItemHandlerRegistry | null = null,
  ) {
    this.state = state;
    // Normalize the action clock (B3 conditional-damage moves): always present at runtime
    // so stamps/streaks can be read and mutated regardless of how the state was built.
    this.state.actionCounter ??= 0;
    this.state.lastAllyFaintAtAction ??= {};
    this.state.lastTeamActionMoveId ??= {};
    this.state.echoStreak ??= 0;
    // Stamp each mon's spawn tile once (eject items resolve their spawn zone from these). At init the
    // current position IS the spawn tile; `??=` keeps a value already set by a state-builder/replay.
    for (const pokemon of this.state.pokemon.values()) {
      pokemon.spawnPosition ??= { ...pokemon.position };
    }
    this.moveRegistry = moveRegistry;
    this.typeChart = typeChart;
    this.pokemonTypesMap = pokemonTypesMap;
    this.turnPipeline = turnPipeline;
    // RNG injection: production paths (`BattleSetup`, replay-runner) always inject a seeded
    // PRNG (`createPrng(seed)`) so combat is deterministic, replayable, and never touches global
    // Math.random in the shipped app. The Math.random fallback below is a TEST-ONLY seam: unit
    // tests construct the engine without a `random` and drive outcomes via `vi.spyOn(Math, …)`.
    this.random = random ?? (() => Math.random());
    this.seed = seed;
    this.statusRules = statusRules;
    this.abilityRegistry = abilityRegistry;
    this.itemRegistry = itemRegistry;
    this.listeners = new Map();
    this.grid = new Grid(state.grid[0]?.length ?? 0, state.grid.length, state.grid);
    this.turnPipeline.registerStartTurn(defensiveClearHandler, 50);
    this.turnPipeline.registerStartTurn(
      createStatusTickHandler(this.random, this.statusRules, this.abilityRegistry ?? undefined),
      100,
    );
    this.turnPipeline.registerStartTurn(createInfatuationTickHandler(this.random), 150);
    // Vol Magnétik (plan 154): decrement the levitation counter at the start of the caster's turn.
    this.turnPipeline.registerStartTurn(magnetRiseTickHandler, 190);
    this.turnPipeline.registerStartTurn(wishTickHandler, 175);
    this.turnPipeline.registerStartTurn(sacrificeBondExpireHandler, 180);
    this.turnPipeline.registerEndTurn(
      createWeatherTickHandler({
        pokemonTypesMap: this.pokemonTypesMap,
        abilityRegistry: this.abilityRegistry ?? undefined,
        itemRegistry: this.itemRegistry ?? undefined,
      }),
      150,
    );
    this.turnPipeline.registerEndTurn(createAurasTickHandler(), 160);
    this.turnPipeline.registerEndTurn(
      createSeededTickHandler(this.abilityRegistry ?? undefined),
      200,
    );
    this.turnPipeline.registerEndTurn(hotTickHandler, 250);
    this.turnPipeline.registerEndTurn(createFieldTerrainHealHandler(this.pokemonTypesMap), 260);
    this.turnPipeline.registerEndTurn(fieldTerrainDecrementHandler, 265);
    this.turnPipeline.registerEndTurn(distortionDecrementHandler, 268);
    this.turnPipeline.registerEndTurn(fieldGlobalDecrementHandler, 269);
    this.turnPipeline.registerEndTurn(tailwindDecrementHandler, 152);
    this.turnPipeline.registerEndTurn(perishTickHandler, 280);
    this.turnPipeline.registerEndTurn(trappedTickHandler, 300);
    // Malédiction (plan 154): Cursed DoT ticks alongside the other damagePerTurn volatiles.
    this.turnPipeline.registerEndTurn(cursedTickHandler, 305);
    // Bâillement (plan 154): drowsiness → sleep, after the mon has acted this turn (respite window).
    this.turnPipeline.registerEndTurn(
      createDrowsyTickHandler({
        random: this.random,
        statusRules: this.statusRules,
        pokemonTypesMap: this.pokemonTypesMap,
        abilityRegistry: this.abilityRegistry ?? undefined,
      }),
      310,
    );
    this.turnPipeline.registerEndTurn(timedVolatileTickHandler, 350);
    this.terrainTickHandler = createTerrainTickHandler(
      this.pokemonTypesMap,
      this.itemRegistry ?? undefined,
    );
    this.turnPipeline.registerEndTurn(this.terrainTickHandler, 400);
    this.turnPipeline.registerEndTurn(roostedClearHandler, 500);

    const pokemonIds = [...state.pokemon.keys()];
    this.chargeTimeTurnSystem = new ChargeTimeTurnSystem(pokemonIds, (id) =>
      this.getCtGainForPokemon(id),
    );
    this.syncCtSnapshot();
    this.advanceTurn([]);

    this.triggerBattleStart();
  }

  getGrid(): Grid {
    return this.grid;
  }

  consumeStartupEvents(): BattleEvent[] {
    const events = this.startupEvents;
    this.startupEvents = [];
    return events;
  }

  /**
   * TEST SEAM: pin which mon takes the next turn, coherently with the Charge Time scheduler. The
   * Charge Time system picks the fastest mon at construction; isolated move/item tests use this to
   * make a chosen mon the actor so the result is independent of relative Speed.
   */
  pinActiveForTest(pokemonId: string): void {
    // Already this mon's freshly-started turn (it was the natural Charge Time first actor): do not
    // re-run advanceTurn, which would tick its start-of-turn pipeline twice (e.g. sleep counter).
    if (this.state.activePokemonId === pokemonId) {
      return;
    }
    this.chargeTimeTurnSystem.forceActor(pokemonId);
    this.advanceTurn([]);
  }

  addStartupEvents(events: readonly BattleEvent[]): void {
    this.startupEvents.push(...events);
  }

  rerunBattleStartChecks(): void {
    if (!this.abilityRegistry) {
      return;
    }
    for (const pokemon of this.state.pokemon.values()) {
      if (pokemon.currentHp <= 0) {
        continue;
      }
      const ability = this.abilityRegistry.getForPokemon(pokemon);
      if (!ability?.onBattleStart) {
        continue;
      }
      const events = ability.onBattleStart({
        self: pokemon,
        state: this.state,
        pokemonTypesMap: this.pokemonTypesMap,
      });
      this.startupEvents.push(...events);
    }
  }

  getGameState(_playerId: string): BattleState {
    return this.state;
  }

  exportReplay(): BattleReplay {
    return { seed: this.seed, actions: [...this.recordedActions] };
  }

  estimateDamage(
    attackerId: string,
    moveId: string,
    defenderId: string,
    targetPosition?: Position,
    attackerPosition?: Position,
  ): DamageEstimate | null {
    const attacker = this.state.pokemon.get(attackerId);
    const defender = this.state.pokemon.get(defenderId);
    const rawMove = this.moveRegistry.get(moveId);
    if (!attacker || !defender || !rawMove) {
      return null;
    }
    const attackerTypes = this.effectiveTypesOf(attacker);
    const defenderTypes = this.effectiveTypesOf(defender);
    // B4 morphs the AI must see for correct scoring: Nature Power full swap, then Terrain Pulse type.
    const morphedMove = resolveNaturePowerMove(
      (id) => this.moveRegistry.get(id),
      this.state,
      this.grid,
      attacker,
      rawMove,
    );
    const move = resolveFieldTerrainPulseMove(this.state, attacker, attackerTypes, morphedMove);
    const fieldTerrainBp =
      getFieldTerrainBpMultiplier(this.state, attacker, attackerTypes, move) *
      getFieldTerrainMovePowerMultiplier(
        this.state,
        attacker,
        attackerTypes,
        defender,
        defenderTypes,
        move,
      );
    const fieldTerrainDamage = getFieldTerrainDamageMultiplier(
      this.state,
      defender,
      defenderTypes,
      move,
    );
    // Lookahead: evaluate the hit as if the attacker stood on `attackerPosition` (a candidate move
    // destination), so height / terrain / facing reflect where it would actually fire from.
    const originPosition = attackerPosition ?? attacker.position;
    const attackerHeight = this.grid.getTile(originPosition)?.height ?? 0;
    const defenderHeight = this.grid.getTile(defender.position)?.height ?? 0;
    const heightMod = getHeightModifier(
      attackerHeight,
      defenderHeight,
      move.ignoresHeight ?? false,
    );
    const attackerTerrain = this.grid.getTile(originPosition)?.terrain;
    const terrainMod = attackerTerrain
      ? getTerrainTypeBonusFactor(
          attackerTerrain,
          move.type,
          attackerTypes,
          this.isEffectivelyFlying(attacker),
        )
      : 1.0;
    const attackOrigin = getAttackOrigin(
      originPosition === attacker.position ? attacker : { ...attacker, position: originPosition },
      move,
      targetPosition ?? defender.position,
    );
    const facingMod = getFacingModifier(getFacingZone(attackOrigin, defender));
    return estimateDamage(
      attacker,
      defender,
      move,
      this.typeChart,
      attackerTypes,
      defenderTypes,
      heightMod,
      terrainMod,
      facingMod,
      this.abilityRegistry ?? undefined,
      this.itemRegistry ?? undefined,
      fieldTerrainBp,
      fieldTerrainDamage,
    );
  }

  /**
   * The B4-resolved move for a given caster (Nature Power swap / Expanding Force targeting / Grassy
   * Glide range), from the caster's current tile. Used by the renderer to preview the morphed
   * targeting and tooltip. Returns the raw move when nothing morphs, or null when unknown.
   */
  getEffectiveMove(pokemonId: string, moveId: string): MoveDefinition | null {
    const pokemon = this.state.pokemon.get(pokemonId);
    const move = this.moveRegistry.get(moveId);
    if (!pokemon || !move) {
      return null;
    }
    return this.resolveEffectiveMove(pokemon, move);
  }

  /**
   * Move-copy (plan 144): commit a call-move (Métronome / Blabla Dodo / Mimique / Photocopie) and
   * resolve the move it will execute, WITHOUT consuming the turn. Stores the result on the caster's
   * `pendingCalledMove` so the final `submitAction(UseMove, sourceMoveId, targetPosition)` swaps to it
   * (via `resolveEffectiveMove`). Returns the called move id, its effective targeting (to highlight),
   * and `reveal` (false ⇒ the renderer masks the move's identity — the random callers).
   *
   * Idempotent within a turn: a pending resolution for the same source is returned unchanged (the
   * PRNG only rolls once), so cancelling the placement and re-selecting the source returns the SAME
   * called move (anti-reroll). `selectedTargetId` feeds the `target-last` source (Mimique).
   * Returns `{ failed: true }` when there is no move to call (Mimique/Photocopie before any move was
   * used, or an empty pool).
   */
  prepareCalledMove(
    casterId: string,
    sourceMoveId: string,
    selectedTargetId?: string,
  ): { calledMoveId: string; targeting: TargetingPattern; reveal: boolean } | { failed: true } {
    const caster = this.state.pokemon.get(casterId);
    const sourceMove = this.moveRegistry.get(sourceMoveId);
    if (!caster || !sourceMove || sourceMove.callMove === undefined) {
      return { failed: true };
    }

    const existing = caster.pendingCalledMove;
    const pending =
      existing !== undefined && existing.sourceMoveId === sourceMoveId
        ? existing
        : (() => {
            const resolved = this.resolveCalledMove(caster, sourceMove.callMove, selectedTargetId);
            if (resolved === null) {
              return undefined;
            }
            return { sourceMoveId, calledMoveId: resolved.calledMoveId, reveal: resolved.reveal };
          })();
    if (pending === undefined) {
      return { failed: true };
    }
    caster.pendingCalledMove = pending;

    const effectiveMove = this.resolveEffectiveMove(caster, sourceMove);
    return {
      calledMoveId: pending.calledMoveId,
      targeting: effectiveMove.targeting,
      reveal: pending.reveal,
    };
  }

  /** Resolve which move a call-move executes. Returns null when nothing can be called. */
  private resolveCalledMove(
    caster: PokemonInstance,
    source: CallMoveSourceKind,
    selectedTargetId: string | undefined,
  ): { calledMoveId: string; reveal: boolean } | null {
    switch (source) {
      case CallMoveSourceKind.RandomAll: {
        const pool = [...this.moveRegistry.values()].filter(isMetronomeCallable);
        if (pool.length === 0) {
          return null;
        }
        const picked = pool[Math.floor(this.random() * pool.length)];
        return picked ? { calledMoveId: picked.id, reveal: false } : null;
      }
      case CallMoveSourceKind.RandomOwnAsleep: {
        const pool = effectiveMoveIds(caster)
          .map((id) => this.moveRegistry.get(id))
          .filter(
            (move): move is MoveDefinition => move !== undefined && isSleepTalkCallable(move),
          );
        if (pool.length === 0) {
          return null;
        }
        const picked = pool[Math.floor(this.random() * pool.length)];
        return picked ? { calledMoveId: picked.id, reveal: false } : null;
      }
      case CallMoveSourceKind.TargetLast: {
        const target =
          selectedTargetId === undefined ? undefined : this.state.pokemon.get(selectedTargetId);
        const lastId = target?.lastUsedMoveId;
        if (lastId === undefined || this.moveRegistry.get(lastId) === undefined) {
          return null;
        }
        return { calledMoveId: lastId, reveal: true };
      }
      case CallMoveSourceKind.GlobalLast: {
        const lastId = this.state.lastMoveUsedGlobally;
        if (lastId === undefined || this.moveRegistry.get(lastId) === undefined) {
          return null;
        }
        return { calledMoveId: lastId, reveal: true };
      }
    }
  }

  /**
   * True if the mon is airborne by its own nature (Flying type / Lévitation / Ballon), ignoring any
   * Gravité zone. The renderer uses this to know which mons Gravité should visually land.
   */
  isAirborneIgnoringGravity(pokemonId: string): boolean {
    const pokemon = this.state.pokemon.get(pokemonId);
    if (!pokemon) {
      return false;
    }
    return isEffectivelyFlying(pokemon, this.effectiveTypesOf(pokemon));
  }

  getReachableTilesForPokemon(pokemonId: string): Position[] {
    if (this.battleOver) {
      return [];
    }
    const pokemon = this.state.pokemon.get(pokemonId);
    if (!pokemon || pokemon.currentHp <= 0) {
      return [];
    }
    return this.getReachableTiles(pokemon).map((tile) => tile.position);
  }

  getTileAt(position: Position): TileState | null {
    return this.grid.getTile(position) ?? null;
  }

  getPokemonTypes(pokemonId: string): PokemonType[] {
    const pokemon = this.state.pokemon.get(pokemonId);
    if (!pokemon) {
      return [];
    }
    return this.effectiveTypesOf(pokemon);
  }

  /**
   * AI helper (plan 148): the OHKO immunity a target has against a move (Fermeté / type / Glace), or
   * null if the K.O. would connect. Mirrors the engine's pre-roll immunity check so the scorer never
   * plays an OHKO into an immune target.
   */
  ohkoImmunityAgainst(
    attacker: PokemonInstance,
    move: MoveDefinition,
    target: PokemonInstance,
  ): OhkoImmunity | null {
    return ohkoImmunityReason(move, attacker, target, {
      typeChart: this.typeChart,
      targetTypes: this.effectiveTypesOf(target),
      abilityRegistry: this.abilityRegistry ?? undefined,
      scrappyGhostBypass: this.abilityRegistry?.getForPokemon(attacker)?.id === "scrappy",
      groundedByGravity: isEffectivelyGrounded(this.state, target),
    });
  }

  /**
   * Override-aware base types of an instance — the single point every type read in the engine goes
   * through, so a runtime `typeOverride` (type-manip family) propagates to STAB, effectiveness,
   * terrain, hazards and status immunity. Roost filtering layers on top separately where needed.
   */
  private effectiveTypesOf(pokemon: PokemonInstance): PokemonType[] {
    return resolveBaseTypes(pokemon, this.pokemonTypesMap);
  }

  /** Psychic-terrain barrier predicate for a dasher (B4), fed into the traversal context. */
  private buildDashBarrierPredicate(dasher: PokemonInstance): (position: Position) => boolean {
    const dasherTypes = this.getPokemonTypes(dasher.id);
    return (position) => isEnemyPsychicBarrierAt(this.state, dasher, dasherTypes, position);
  }

  /**
   * Single source of truth for B4 move/targeting morphs (decisions D/E/F/G). Resolved from the
   * caster's CURRENT tile so legality/AI, preview and execution stay aligned:
   *  - Nature Power → full move swap (energy-ball / hydro-pump / ... / tri-attack);
   *  - Expanding Force → Single → Zone r2 targeting override on Psychic Terrain;
   *  - Grassy Glide → Dash maxDistance extended on Grassy Terrain.
   * The returned MoveDefinition keeps the source `id`/`pp` accounting via the caller (PP is spent on
   * the original move id), but exposes the resolved type/category/power/effects and the effective
   * targeting pattern.
   */
  private resolveEffectiveMove(pokemon: PokemonInstance, move: MoveDefinition): MoveDefinition {
    // Move-copy (plan 144): a call-move with a pending resolution swaps to the called move FIRST, so
    // the rest of the resolution (Nature Power / Dash terrain bonuses) runs on the called move.
    let source = move;
    const pending = pokemon.pendingCalledMove;
    if (pending !== undefined && pending.sourceMoveId === move.id) {
      const called = this.moveRegistry.get(pending.calledMoveId);
      if (called !== undefined) {
        source = called;
      }
    }
    const swapped = resolveNaturePowerMove(
      (id) => this.moveRegistry.get(id),
      this.state,
      this.grid,
      pokemon,
      source,
    );
    const casterTypes = this.effectiveTypesOf(pokemon);
    let targeting = resolveEffectiveTargeting(swapped, pokemon, casterTypes, this.state);
    if (
      targeting.kind === TargetingKind.Dash &&
      swapped.dashRangeBonusOnFieldTerrain !== undefined
    ) {
      const { terrain, bonus } = swapped.dashRangeBonusOnFieldTerrain;
      if (isOnFieldTerrain(this.state, pokemon, casterTypes, terrain)) {
        targeting = { ...targeting, maxDistance: targeting.maxDistance + bonus };
      }
    }
    if (
      targeting.kind === TargetingKind.Dash &&
      swapped.dynamicPower?.kind === DynamicPowerKind.RolloutStreak
    ) {
      // Rollout snowball: range grows with the consecutive-cast streak (capped), same index the
      // power resolver reads, so preview / legality / execution all agree.
      const maxDistance = rolloutRangeForIndex(pendingRolloutIndex(pokemon, swapped.id));
      targeting = { ...targeting, maxDistance };
    }
    return targeting === swapped.targeting ? swapped : { ...swapped, targeting };
  }

  computePathDistance(from: Position, to: Position, pokemonId: string): number {
    const pokemon = this.state.pokemon.get(pokemonId);
    const pokemonTypes = pokemon ? this.effectiveTypesOf(pokemon) : [];
    const isFlying = pokemon
      ? this.isEffectivelyFlying(pokemon)
      : pokemonTypes.includes(PokemonType.Flying);
    const isGhost = pokemonTypes.includes(PokemonType.Ghost);
    const immuneTerrains = getImmuneTerrains(
      pokemon ? this.terrainTypesOf(pokemon) : pokemonTypes,
      isFlying,
    );

    const posKey = (p: Position): string => `${p.x},${p.y}`;
    const visited = new Set<string>();
    const queue: Array<{ position: Position; distance: number }> = [
      { position: from, distance: 0 },
    ];
    visited.add(posKey(from));

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }
      if (current.position.x === to.x && current.position.y === to.y) {
        return current.distance;
      }
      const neighbors = this.grid.getNeighbors(current.position);
      for (const neighbor of neighbors) {
        const key = posKey(neighbor.position);
        if (visited.has(key)) {
          continue;
        }
        const currentTile = this.grid.getTile(current.position);
        const currentHeight = currentTile?.height ?? 0;
        const currentTerrain = currentTile?.terrain ?? TerrainType.Normal;
        if (
          !canTraverse({
            fromHeight: currentHeight,
            toHeight: neighbor.height,
            fromTerrain: currentTerrain,
            toTerrain: neighbor.terrain,
            isFlying,
            isGhost,
            immuneTerrains,
          })
        ) {
          continue;
        }
        visited.add(key);
        queue.push({ position: neighbor.position, distance: current.distance + 1 });
      }
    }

    return Number.POSITIVE_INFINITY;
  }

  /**
   * Read-only prediction of a knockback's outcome on `target` if `attackerId` pushed it now (no
   * mutation). Used by the AI to value ring-out plays (pushing a foe off a ledge / into lethal
   * terrain). Returns null when the push would not move the target.
   */
  predictKnockback(
    attackerId: string,
    target: PokemonInstance,
    distance: number,
  ): KnockbackOutcome | null {
    const attacker = this.state.pokemon.get(attackerId);
    if (!attacker) {
      return null;
    }
    return predictKnockbackOutcome({
      attackerPosition: attacker.position,
      target,
      distance,
      grid: this.grid,
      targetTypes: this.effectiveTypesOf(target),
      state: this.state,
    });
  }

  /**
   * Height-aware line of sight between two tiles (single-target convention: reference = the lower of
   * the two heights). Used by the AI lookahead to reject « phantom sniper » positions that could not
   * actually fire over the wall.
   */
  hasLineOfSightFrom(from: Position, to: Position): boolean {
    const fromHeight = this.grid.getTile(from)?.height ?? 0;
    const toHeight = this.grid.getTile(to)?.height ?? 0;
    return hasLineOfSight(this.grid, from, to, Math.min(fromHeight, toHeight));
  }

  private getCurrentActorId(): string {
    const id = this.state.activePokemonId;
    if (!id) {
      throw new Error("No current actor");
    }
    return id;
  }

  getLegalActions(playerId: string): Action[] {
    if (this.battleOver) {
      return [];
    }

    const currentPokemonId = this.getCurrentActorId();
    const currentPokemon = this.state.pokemon.get(currentPokemonId);

    if (!currentPokemon || currentPokemon.playerId !== playerId) {
      return [];
    }

    const actions: Action[] = [];

    for (const direction of [Direction.North, Direction.South, Direction.East, Direction.West]) {
      actions.push({ kind: ActionKind.EndTurn, pokemonId: currentPokemonId, direction });
    }

    const isTrapped = currentPokemon.volatileStatuses.some((v) => v.type === StatusType.Trapped);
    const isCharging = currentPokemon.chargingMove !== undefined;
    const mustActFirst = isCharging && !this.turnState.hasActed;
    // Asleep (B3): the only thing a sleeping mon may do is use a requiresAsleep move (snore).
    // No displacement, and every other move is hidden — it can otherwise only wait (EndTurn).
    const isAsleep = currentPokemon.statusEffects.some((s) => s.type === StatusType.Asleep);

    if (
      !this.turnState.hasMoved &&
      !this.restrictActions &&
      !isTrapped &&
      !mustActFirst &&
      !this.flinchedThisTurn &&
      !isAsleep
    ) {
      const reachableTiles = this.getReachableTiles(currentPokemon);
      for (const reachable of reachableTiles) {
        actions.push({
          kind: ActionKind.Move,
          pokemonId: currentPokemonId,
          path: reachable.path,
        });
      }
    }

    if (this.turnState.hasMoved && this.preMoveSnapshot !== null && !this.flinchedThisTurn) {
      actions.push({ kind: ActionKind.UndoMove, pokemonId: currentPokemonId });
    }

    if (!this.turnState.hasActed && !currentPokemon.recharging && !this.flinchedThisTurn) {
      const allyIds = new Set<string>();
      for (const [id, p] of this.state.pokemon) {
        if (p.playerId === currentPokemon.playerId && id !== currentPokemonId) {
          allyIds.add(id);
        }
      }
      const traversalContext: TraversalContext = { allyIds, canTraverseEnemies: false };
      const isTaunted = currentPokemon.volatileStatuses.some((v) => v.type === StatusType.Taunted);
      // Veste de Combat (assault-vest): the holder may not select status-category moves.
      const forbidsStatusMoves =
        this.itemRegistry?.getForPokemon(currentPokemon)?.forbidsStatusMoves === true;
      const disabledMoveId = currentPokemon.volatileStatuses.find(
        (v) => v.type === StatusType.Disabled,
      )?.moveId;
      const encoredMoveId = currentPokemon.volatileStatuses.find(
        (v) => v.type === StatusType.Encored,
      )?.moveId;
      // Possessif: aggregate the imprisoned move ids once (not per move).
      const imprisonedMoveIds = collectImprisonedMoveIds(this.state, currentPokemon.playerId);
      const healBlocked = isHealBlocked(currentPokemon);
      // Gravité: a mon standing in a Gravity zone cannot launch airborne/jump moves (Vol, Rebond,
      // Pied Voltige…). Underground/underwater charge moves (Tunnel, Plongée) stay legal.
      const groundedByGravity = isEffectivelyGrounded(this.state, currentPokemon);

      for (const moveId of effectiveMoveIds(currentPokemon)) {
        const move = this.moveRegistry.get(moveId);
        if (!move) {
          continue;
        }

        if ((isTaunted || forbidsStatusMoves) && move.category === Category.Status) {
          continue;
        }

        if (groundedByGravity && isAirborneMove(move)) {
          continue;
        }

        // Possessif (imprison): a move shared with a living enemy that holds Imprisoning is sealed.
        if (imprisonedMoveIds.has(moveId)) {
          continue;
        }

        // Anti-Soin (Heal Block): a Heal-Blocked mon cannot select HP-restoring moves.
        if (healBlocked && isHealingMove(move)) {
          continue;
        }

        if (disabledMoveId !== undefined && moveId === disabledMoveId) {
          continue;
        }

        // Rancune (grudge): a move sealed on this mon by an enemy's Rancune stays unusable all battle.
        if (currentPokemon.grudgeLockedMoveIds?.includes(moveId) === true) {
          continue;
        }

        if (encoredMoveId !== undefined && moveId !== encoredMoveId) {
          continue;
        }

        if (currentPokemon.lockedMoveId !== undefined && moveId !== currentPokemon.lockedMoveId) {
          continue;
        }

        // Lock-in multi-turn (plan 149): a mid-rampage mon may only repeat the locked move.
        if (currentPokemon.lockInMoveId !== undefined && moveId !== currentPokemon.lockInMoveId) {
          continue;
        }

        // Snore (B3): only usable while asleep; conversely a sleeping mon may use nothing else.
        if (move.requiresAsleep === true && !isAsleep) {
          continue;
        }
        if (isAsleep && move.requiresAsleep !== true) {
          continue;
        }

        // Bluff / Escarmouche (plan 150): usable only on the user's first action of the battle.
        if (move.firstActionOnly === true && currentPokemon.lastActedAtAction !== undefined) {
          continue;
        }

        // Last Resort (B3): only usable once every other move has been used at least once.
        if (move.requiresAllOtherMovesUsed === true) {
          const otherMoveIds = currentPokemon.moveIds.filter((id) => id !== moveId);
          const allOthersUsed =
            otherMoveIds.length > 0 &&
            otherMoveIds.every((id) => currentPokemon.usedMoveIds?.includes(id) === true);
          if (!allOthersUsed) {
            continue;
          }
        }

        // Éructation (belch): only usable after the user has eaten a berry this battle.
        if (move.requiresEatenBerry === true && currentPokemon.ateBerryThisBattle !== true) {
          continue;
        }

        // Dégommage (fling): only usable while the user holds a flingable item.
        if (
          move.requiresFlingableItem === true &&
          (this.itemRegistry?.getForPokemon(currentPokemon)?.flingPower ?? undefined) === undefined
        ) {
          continue;
        }

        // B4 morphs (Nature Power swap, Expanding Force targeting, Grassy Glide range) resolved from
        // the caster's current tile so legality matches preview and execution exactly.
        const effectiveMove = this.resolveEffectiveMove(currentPokemon, move);

        if (this.restrictActions && effectiveMove.targeting.kind === TargetingKind.Dash) {
          continue;
        }

        // The charge turn is skipped ONLY for sun-skip moves under sun (e.g. Lance-Soleil); every
        // other two-turn move still winds up, so legality must mirror execution (l.1103-1106).
        const isChargeT1 = move.twoTurnCharge && currentPokemon.chargingMove === undefined;
        const skipsChargeThisTurn =
          move.sunSkipsCharge === true && this.getEffectiveWeather() === Weather.Sun;
        if (isChargeT1 && !skipsChargeThisTurn) {
          actions.push({
            kind: ActionKind.UseMove,
            pokemonId: currentPokemonId,
            moveId,
            targetPosition: { ...currentPokemon.position },
          });
          continue;
        }

        const targetPositions = this.getValidTargetPositions(currentPokemon, effectiveMove);
        const moveContext = { type: effectiveMove.type, flags: effectiveMove.flags };
        for (const targetPosition of targetPositions) {
          const affectedTiles =
            effectiveMove.targetsAllyOrSelf === true &&
            this.isSelfTile(currentPokemon, targetPosition)
              ? [{ ...currentPokemon.position }]
              : resolveTargeting(
                  effectiveMove.targeting,
                  currentPokemon,
                  targetPosition,
                  this.grid,
                  traversalContext,
                  moveContext,
                );
          if (affectedTiles.length === 0) {
            continue;
          }
          actions.push({
            kind: ActionKind.UseMove,
            pokemonId: currentPokemonId,
            moveId,
            targetPosition,
          });
        }
      }
    }

    return actions;
  }

  submitAction(playerId: string, action: Action): ActionResult {
    if (this.battleOver) {
      return { success: false, events: [], error: ActionError.BattleOver };
    }

    const currentPokemonId = this.getCurrentActorId();
    const currentPokemon = this.state.pokemon.get(currentPokemonId);

    if (!currentPokemon || currentPokemon.playerId !== playerId) {
      return { success: false, events: [], error: ActionError.NotYourTurn };
    }

    if (action.pokemonId !== currentPokemonId) {
      return { success: false, events: [], error: ActionError.WrongPokemon };
    }

    const confusionEvents: BattleEvent[] = [];
    if (!this.confusionChecked) {
      this.confusionChecked = true;
      this.processFlinch(currentPokemon, confusionEvents);
      this.processConfusion(currentPokemon, confusionEvents);
    }

    if (
      this.flinchedThisTurn &&
      (action.kind === ActionKind.Move ||
        action.kind === ActionKind.UseMove ||
        action.kind === ActionKind.UndoMove)
    ) {
      return { success: false, events: confusionEvents, error: ActionError.InvalidAction };
    }

    let result: ActionResult;

    switch (action.kind) {
      case ActionKind.EndTurn:
        result = this.executeEndTurn(action.pokemonId, action.direction);
        break;
      case ActionKind.Move: {
        if (this.confusedThisTurn) {
          result = this.executeConfusedMove(currentPokemon);
        } else {
          result = this.executeMove(currentPokemon, action.path);
        }
        break;
      }
      case ActionKind.UseMove: {
        if (this.confusedThisTurn) {
          result = this.executeConfusedUseMove(
            currentPokemon,
            action.moveId,
            action.targetPosition,
          );
        } else {
          result = this.executeUseMove(
            currentPokemon,
            action.moveId,
            action.targetPosition,
            action.retreatPosition,
          );
        }
        break;
      }
      case ActionKind.UndoMove:
        result = this.executeUndoMove(currentPokemon);
        break;
    }

    if (confusionEvents.length > 0) {
      result = { ...result, events: [...confusionEvents, ...result.events] };
    }

    if (result.success) {
      this.recordedActions.push(action);
    }

    return result;
  }

  on(eventType: string, handler: EventHandler): void {
    let handlers = this.listeners.get(eventType);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(eventType, handlers);
    }
    handlers.add(handler);
  }

  off(eventType: string, handler: EventHandler): void {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: BattleEvent): void {
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }

  private isEffectivelyFlying(pokemon: PokemonInstance): boolean {
    // Gravité (zone) / Anti-Air (smack-down): a grounded mon loses its airborne status for terrain,
    // entry-hazards, knockback and movement traversal (the type-chart Ground immunity is overridden
    // separately in the damage calc). Both feed the shared `isEffectivelyGrounded` predicate.
    if (isEffectivelyGrounded(this.state, pokemon)) {
      return false;
    }
    const types = this.effectiveTypesOf(pokemon);
    return isEffectivelyFlying(pokemon, types);
  }

  /**
   * Types used for TERRAIN immunity (traversal, stopping, terrain effects). A mon grounded by a
   * Gravité zone loses its Flying-type terrain immunity too — so it can no longer cross/rest on lava
   * or overfly obstacles, matching the grounded gameplay. Other type resistances are unchanged.
   */
  private terrainTypesOf(pokemon: PokemonInstance): PokemonType[] {
    const types = this.effectiveTypesOf(pokemon);
    if (isEffectivelyGrounded(this.state, pokemon)) {
      return types.filter((type) => type !== PokemonType.Flying);
    }
    return types;
  }

  /**
   * Apply entry-hazards + terrain the instant a Gravité zone lands on a mon, so a formerly-airborne
   * mon (Flying/Levitate/Balloon) caught over lava or a hazard suffers it immediately rather than
   * escaping on its next turn. Only mons that would be airborne without the zone are re-evaluated;
   * grounded mons already take their terrain on the normal end-turn tick.
   */
  private applyGravityGroundingOnCast(events: BattleEvent[]): void {
    for (const zone of this.state.fieldGlobalZones) {
      if (zone.kind !== FieldGlobalKind.Gravity) {
        continue;
      }
      for (const tile of zone.tiles) {
        const occupantId = this.grid.getOccupant(tile);
        if (!occupantId) {
          continue;
        }
        const mon = this.state.pokemon.get(occupantId);
        if (!mon || mon.currentHp <= 0) {
          continue;
        }
        // Skip mons that were already grounded — their terrain runs on the normal end-turn tick.
        if (!isEffectivelyFlying(mon, this.effectiveTypesOf(mon))) {
          continue;
        }
        this.applyGroundingTerrainTick(mon, events);
        if (this.battleOver) {
          return;
        }
      }
    }
  }

  /**
   * Apply a freshly-grounded mon's tile hazards + terrain damage immediately (Gravité zone cast /
   * Anti-Air smack-down), so it can't escape the tick by acting first. Mirrors the end-turn terrain
   * tick but fired at grounding time.
   */
  private applyGroundingTerrainTick(mon: PokemonInstance, events: BattleEvent[]): void {
    this.applyEntryHazardsOnPath(mon, [{ ...mon.position }], events);
    if (mon.currentHp <= 0) {
      this.handleKo(mon.id, events);
      return;
    }
    const terrainResult = this.terrainTickHandler(mon.id, this.state);
    for (const event of terrainResult.events) {
      this.emit(event);
      events.push(event);
    }
    if (mon.currentHp <= 0) {
      this.handleKo(mon.id, events);
    }
  }

  private triggerBattleStart(): void {
    if (!this.abilityRegistry) {
      return;
    }
    for (const pokemon of this.state.pokemon.values()) {
      const ability = this.abilityRegistry.getForPokemon(pokemon);
      if (!ability) {
        continue;
      }
      if (ability.onBattleStart) {
        const events = ability.onBattleStart({
          self: pokemon,
          state: this.state,
          pokemonTypesMap: this.pokemonTypesMap,
        });
        this.startupEvents.push(...events);
      }
      if (ability.onAuraCheck) {
        const auraEvents = ability.onAuraCheck({
          self: pokemon,
          state: this.state,
          pokemonTypesMap: this.pokemonTypesMap,
        });
        this.startupEvents.push(...auraEvents);
      }
      if (ability.weatherAutoSetter && pokemon.currentHp > 0) {
        const { weather, turns } = ability.weatherAutoSetter;
        const weatherEvents = setWeather(this.state, weather, turns, pokemon.id);
        this.startupEvents.push(...weatherEvents);
      }
    }
  }

  private emitPositionLinkedChecks(events: BattleEvent[]): void {
    const linkedEvents = checkPositionLinkedStatuses(this.state);
    for (const event of linkedEvents) {
      this.emit(event);
      events.push(event);
    }
    if (this.abilityRegistry) {
      for (const pokemon of this.state.pokemon.values()) {
        if (pokemon.currentHp <= 0) {
          continue;
        }
        const ability = this.abilityRegistry.getForPokemon(pokemon);
        if (!ability?.onAuraCheck) {
          continue;
        }
        const auraEvents = ability.onAuraCheck({
          self: pokemon,
          state: this.state,
          pokemonTypesMap: this.pokemonTypesMap,
        });
        for (const event of auraEvents) {
          this.emit(event);
          events.push(event);
        }
      }
    }
  }

  private getValidTargetPositions(pokemon: PokemonInstance, move: MoveDefinition): Position[] {
    // `move` is the already-resolved effective move (see the getLegalActions call site), so its
    // targeting reflects any caster-type override (Malédiction) via `resolveEffectiveMove`.
    const targeting = move.targeting;
    switch (targeting.kind) {
      case TargetingKind.Self:
        return [pokemon.position];
      case TargetingKind.Zone:
      case TargetingKind.Cross:
        return [pokemon.position];
      case TargetingKind.Single: {
        const tiles = this.grid.getTilesInRange(
          pokemon.position,
          targeting.range.min,
          targeting.range.max,
        );
        if (move.targetsAlly === true) {
          return tiles.filter((position) => this.isAdjacentAllyTile(pokemon, position));
        }
        if (move.targetsAllyOrSelf === true) {
          const allyTiles = tiles.filter((position) => this.isAdjacentAllyTile(pokemon, position));
          return [{ ...pokemon.position }, ...allyTiles];
        }
        return tiles;
      }
      case TargetingKind.Cone:
      case TargetingKind.Line:
      case TargetingKind.Slash:
        return this.getFourDirectionPositions(pokemon.position);
      case TargetingKind.Dash:
        return this.getDashPositions(pokemon.position, targeting.maxDistance);
      case TargetingKind.Blast:
        return this.grid.getTilesInRange(
          pokemon.position,
          targeting.range.min,
          targeting.range.max,
        );
      case TargetingKind.Teleport: {
        const allTiles = this.grid.getTilesInRange(
          pokemon.position,
          targeting.range.min,
          targeting.range.max,
        );
        const casterTypes = this.effectiveTypesOf(pokemon);
        const casterFlying = this.isEffectivelyFlying(pokemon);
        return allTiles.filter((position) => {
          const tile = this.grid.getTile(position);
          if (!tile) {
            return false;
          }
          if (this.grid.getOccupant(position) !== null) {
            return false;
          }
          if (
            !isTerrainPassable(tile.terrain) &&
            !isTerrainImmune(tile.terrain, casterTypes, casterFlying)
          ) {
            return false;
          }
          return true;
        });
      }
      case TargetingKind.HitAndRun:
        return this.grid.getTilesInRange(
          pokemon.position,
          targeting.hitRange.min,
          targeting.hitRange.max,
        );
      case TargetingKind.GroundTarget:
        return this.grid.getTilesInRange(
          pokemon.position,
          targeting.range.min,
          targeting.range.max,
        );
    }
  }

  private isAdjacentAllyTile(caster: PokemonInstance, position: Position): boolean {
    const occupantId = this.grid.getOccupant(position);
    if (occupantId === null || occupantId === caster.id) {
      return false;
    }
    const occupant = this.state.pokemon.get(occupantId);
    if (!occupant || occupant.currentHp <= 0) {
      return false;
    }
    return occupant.playerId === caster.playerId;
  }

  private isSelfTile(caster: PokemonInstance, position: Position): boolean {
    return caster.position.x === position.x && caster.position.y === position.y;
  }

  private getFourDirectionPositions(origin: Position): Position[] {
    return [
      { x: origin.x, y: origin.y - 1 },
      { x: origin.x, y: origin.y + 1 },
      { x: origin.x - 1, y: origin.y },
      { x: origin.x + 1, y: origin.y },
    ].filter((p) => this.grid.isInBounds(p));
  }

  private getDashPositions(origin: Position, maxDistance: number): Position[] {
    const positions: Position[] = [];
    for (const direction of [Direction.North, Direction.South, Direction.East, Direction.West]) {
      for (let step = 1; step <= maxDistance; step++) {
        const position = stepInDirection(origin, direction, step);
        if (!this.grid.isInBounds(position)) {
          break;
        }
        positions.push(position);
      }
    }
    return positions;
  }

  private executeUseMove(
    pokemon: PokemonInstance,
    moveId: string,
    targetPosition: Position,
    retreatPosition?: Position,
  ): ActionResult {
    if (this.turnState.hasActed) {
      return { success: false, events: [], error: ActionError.AlreadyActed };
    }

    const move = this.moveRegistry.get(moveId);
    if (!move) {
      return { success: false, events: [], error: ActionError.UnknownMove };
    }

    if (!effectiveMoveIds(pokemon).includes(moveId)) {
      return { success: false, events: [], error: ActionError.MoveNotInMoveset };
    }

    // Veste de Combat (assault-vest): status moves are illegal for the holder — defensive guard
    // mirroring getLegalActions (no dedicated event, like the imprison / Heal Block gates).
    if (
      move.category === Category.Status &&
      this.itemRegistry?.getForPokemon(pokemon)?.forbidsStatusMoves === true
    ) {
      return { success: false, events: [], error: ActionError.InvalidAction };
    }

    // Gravité: airborne/jump moves are illegal from within a Gravity zone — defensive guard
    // mirroring getLegalActions. Emits GravityMoveBlocked for log feedback.
    if (isEffectivelyGrounded(this.state, pokemon) && isAirborneMove(move)) {
      const gravityBlockedEvent: BattleEvent = {
        type: BattleEventType.GravityMoveBlocked,
        pokemonId: pokemon.id,
        moveId,
      };
      this.emit(gravityBlockedEvent);
      return { success: false, events: [gravityBlockedEvent], error: ActionError.InvalidAction };
    }

    const isTaunted = pokemon.volatileStatuses.some((v) => v.type === StatusType.Taunted);
    if (isTaunted && move.category === Category.Status) {
      const tauntBlockedEvent: BattleEvent = {
        type: BattleEventType.TauntBlocked,
        pokemonId: pokemon.id,
        moveId,
      };
      this.emit(tauntBlockedEvent);
      return {
        success: false,
        events: [tauntBlockedEvent],
        error: ActionError.InvalidAction,
      };
    }

    const disabledMoveId = pokemon.volatileStatuses.find(
      (v) => v.type === StatusType.Disabled,
    )?.moveId;
    if (disabledMoveId !== undefined && moveId === disabledMoveId) {
      const disableBlockedEvent: BattleEvent = {
        type: BattleEventType.DisableBlocked,
        pokemonId: pokemon.id,
        moveId,
      };
      this.emit(disableBlockedEvent);
      return { success: false, events: [disableBlockedEvent], error: ActionError.InvalidAction };
    }

    const encoredMoveId = pokemon.volatileStatuses.find(
      (v) => v.type === StatusType.Encored,
    )?.moveId;
    if (encoredMoveId !== undefined && moveId !== encoredMoveId) {
      const encoreBlockedEvent: BattleEvent = {
        type: BattleEventType.EncoreBlocked,
        pokemonId: pokemon.id,
        moveId,
      };
      this.emit(encoreBlockedEvent);
      return { success: false, events: [encoreBlockedEvent], error: ActionError.InvalidAction };
    }

    // Rancune (grudge): a move sealed on this mon by an enemy's Rancune is unusable — defensive guard
    // mirroring getLegalActions (no dedicated blocked event, like the imprison / Snore gates).
    if (pokemon.grudgeLockedMoveIds?.includes(moveId) === true) {
      return { success: false, events: [], error: ActionError.InvalidAction };
    }

    // Lock-in multi-turn (plan 149): defensive guard mirroring getLegalActions — a mid-rampage mon
    // may only repeat its locked move.
    if (pokemon.lockInMoveId !== undefined && moveId !== pokemon.lockInMoveId) {
      return { success: false, events: [], error: ActionError.InvalidAction };
    }

    // Possessif (imprison) + Anti-Soin (Heal Block) gates — defensive guards mirroring
    // getLegalActions. The move simply isn't legal; no dedicated "blocked" event (like Snore).
    if (collectImprisonedMoveIds(this.state, pokemon.playerId).has(moveId)) {
      return { success: false, events: [], error: ActionError.InvalidAction };
    }
    if (isHealBlocked(pokemon) && isHealingMove(move)) {
      return { success: false, events: [], error: ActionError.InvalidAction };
    }

    // Snore / Last Resort gates (B3) — defensive guards mirroring getLegalActions.
    if (
      move.requiresAsleep === true &&
      !pokemon.statusEffects.some((s) => s.type === StatusType.Asleep)
    ) {
      return { success: false, events: [], error: ActionError.InvalidAction };
    }
    if (move.requiresAllOtherMovesUsed === true) {
      const otherMoveIds = pokemon.moveIds.filter((id) => id !== moveId);
      const allOthersUsed =
        otherMoveIds.length > 0 &&
        otherMoveIds.every((id) => pokemon.usedMoveIds?.includes(id) === true);
      if (!allOthersUsed) {
        return { success: false, events: [], error: ActionError.InvalidAction };
      }
    }
    if (move.requiresEatenBerry === true && pokemon.ateBerryThisBattle !== true) {
      return { success: false, events: [], error: ActionError.InvalidAction };
    }
    if (
      move.requiresFlingableItem === true &&
      (this.itemRegistry?.getForPokemon(pokemon)?.flingPower ?? undefined) === undefined
    ) {
      return { success: false, events: [], error: ActionError.InvalidAction };
    }

    // Bluff / Escarmouche (plan 150): defensive guard mirroring getLegalActions — usable only on the
    // user's first action of the battle.
    if (move.firstActionOnly === true && pokemon.lastActedAtAction !== undefined) {
      return { success: false, events: [], error: ActionError.InvalidAction };
    }

    const isFiringCharged = pokemon.chargingMove?.moveId === moveId;
    if (move.twoTurnCharge && !isFiringCharged) {
      const activeWeather = this.getEffectiveWeather();
      const skipDueToWeather = move.sunSkipsCharge === true && activeWeather === Weather.Sun;
      if (!skipDueToWeather) {
        pokemon.chargingMove = {
          moveId,
          targetPosition: pokemon.position,
          ...(move.chargeReaction === undefined ? {} : { reaction: move.chargeReaction }),
        };
        pokemon.lockedMoveId = moveId;
        // Reactive-charge family (plan 150): start the wait window with clean reaction flags so a
        // prior charge can't leak state into this one.
        pokemon.focusInterrupted = undefined;
        pokemon.shellTrapArmed = undefined;
        if (move.semiInvulnerableState !== undefined) {
          pokemon.semiInvulnerableState = move.semiInvulnerableState;
        }
        const chargingEvent: BattleEvent = {
          type: BattleEventType.MoveCharging,
          pokemonId: pokemon.id,
          moveId,
        };
        this.emit(chargingEvent);
        const chargeEventsAccumulator: BattleEvent[] = [chargingEvent];

        for (const event of this.applyChargeEffects(pokemon, move)) {
          this.emit(event);
          chargeEventsAccumulator.push(event);
        }

        this.turnState.hasActed = true;
        this.turnState.hasMoved = true;
        this.turnState.lastMoveId = moveId;
        recordLastUsedMove(pokemon, move);
        return { success: true, events: chargeEventsAccumulator };
      }
    }

    const allyIds = new Set<string>();
    for (const [id, p] of this.state.pokemon) {
      if (p.playerId === pokemon.playerId && id !== pokemon.id) {
        allyIds.add(id);
      }
    }
    const traversalContext: TraversalContext = { allyIds, canTraverseEnemies: false };

    // Move-copy (plan 144): a call-move without a pending resolution (direct submit by AI / tests,
    // or a renderer that skipped the preview step) resolves the called move here, anchored on the
    // occupant of the chosen tile for the target-last source (Mimique). A failed resolution (nothing
    // to copy) fizzles but still consumes the turn.
    if (move.callMove !== undefined && pokemon.pendingCalledMove?.sourceMoveId !== moveId) {
      const occupantId = this.grid.getOccupant(targetPosition);
      const prepared = this.prepareCalledMove(pokemon.id, moveId, occupantId ?? undefined);
      if ("failed" in prepared) {
        const failEvent: BattleEvent = {
          type: BattleEventType.MoveCopyFailed,
          pokemonId: pokemon.id,
          moveId,
        };
        this.emit(failEvent);
        this.turnState.hasActed = true;
        this.turnState.lastMoveId = moveId;
        recordLastUsedMove(pokemon, move);
        return { success: true, events: [failEvent] };
      }
    }

    // B4 morphs (Nature Power full swap, Expanding Force targeting override, Grassy Glide range)
    // resolved from the caster's current tile. PP is still spent on the original move id.
    const effectiveMove = this.resolveEffectiveMove(pokemon, move);

    // Self-cast of an ally-or-self move (wish on oneself): the Single range excludes distance 0,
    // so resolve to the caster's own tile explicitly to match getLegalActions.
    const affectedTiles =
      effectiveMove.targetsAllyOrSelf === true && this.isSelfTile(pokemon, targetPosition)
        ? [{ ...pokemon.position }]
        : resolveTargeting(
            effectiveMove.targeting,
            pokemon,
            targetPosition,
            this.grid,
            traversalContext,
            {
              type: effectiveMove.type,
              flags: effectiveMove.flags,
            },
          );

    if (affectedTiles.length === 0) {
      return { success: false, events: [], error: ActionError.InvalidTarget };
    }

    if (effectiveMove.targetsAlly === true && !this.isAdjacentAllyTile(pokemon, targetPosition)) {
      return { success: false, events: [], error: ActionError.InvalidTarget };
    }

    if (
      effectiveMove.targetsAllyOrSelf === true &&
      !this.isAdjacentAllyTile(pokemon, targetPosition) &&
      !this.isSelfTile(pokemon, targetPosition)
    ) {
      return { success: false, events: [], error: ActionError.InvalidTarget };
    }

    if (isFiringCharged) {
      pokemon.chargingMove = undefined;
      pokemon.lockedMoveId = undefined;
      pokemon.semiInvulnerableState = undefined;
    }

    const events: BattleEvent[] = [];

    const isSelfTarget =
      pokemon.position.x === targetPosition.x && pokemon.position.y === targetPosition.y;
    if (!isSelfTarget) {
      pokemon.orientation = directionFromTo(pokemon.position, targetPosition);
    }

    const didMorph = effectiveMove.id !== move.id;
    // Terrain Pulse type morph (decision D) is applied at hit time in handle-damage; resolve it here
    // too purely for the "becomes type X" log event.
    const pulseType =
      effectiveMove.fieldTerrainBoostedType === true
        ? resolveFieldTerrainPulseMove(
            this.state,
            pokemon,
            this.effectiveTypesOf(pokemon),
            effectiveMove,
          ).type
        : effectiveMove.type;
    const moveStarted: BattleEvent = {
      type: BattleEventType.MoveStarted,
      attackerId: pokemon.id,
      moveId,
      direction: pokemon.orientation,
      ...(didMorph ? { resolvedMoveId: effectiveMove.id } : {}),
      ...(effectiveMove.fieldTerrainBoostedType === true && pulseType !== effectiveMove.type
        ? { resolvedType: pulseType }
        : {}),
    };
    this.emit(moveStarted);
    events.push(moveStarted);

    const targets: PokemonInstance[] = [];

    for (const tile of affectedTiles) {
      const occupantId = this.grid.getOccupant(tile);
      if (occupantId === null || occupantId === pokemon.id) {
        continue;
      }
      const target = this.state.pokemon.get(occupantId);
      if (!target || target.currentHp <= 0) {
        continue;
      }

      if (
        target.semiInvulnerableState !== undefined &&
        !canMoveHitSemiInvulnerable(effectiveMove, target.semiInvulnerableState)
      ) {
        continue;
      }

      const defenderTile = this.grid.getTile(target.position);
      const defenderTypes = this.effectiveTypesOf(target);
      const tallGrassBonus =
        defenderTile?.terrain === TerrainType.TallGrass &&
        !isTerrainImmune(TerrainType.TallGrass, defenderTypes, this.isEffectivelyFlying(target))
          ? 1
          : 0;
      const forceHit =
        (this.abilityRegistry?.getForPokemon(pokemon)?.onAccuracyOverride?.() ?? false) ||
        (this.abilityRegistry?.getForPokemon(target)?.onAccuracyOverride?.() ?? false);

      // OHKO family (K.O. en un coup): special immunities are resolved BEFORE the accuracy roll so an
      // immune target reports "no effect" / Fermeté (not a random "missed"). On hit, damage = max HP
      // is injected in handle-damage; everything else (Protection/Ténacité/Baie Ceinture/Clone) flows
      // through the normal damage path.
      if (effectiveMove.isOhko) {
        const immunity = ohkoImmunityReason(effectiveMove, pokemon, target, {
          typeChart: this.typeChart,
          targetTypes: defenderTypes,
          abilityRegistry: this.abilityRegistry ?? undefined,
          scrappyGhostBypass: this.abilityRegistry?.getForPokemon(pokemon)?.id === "scrappy",
          groundedByGravity: isEffectivelyGrounded(this.state, target),
        });
        if (immunity === "sturdy") {
          const sturdyEvent: BattleEvent = {
            type: BattleEventType.AbilityActivated,
            pokemonId: target.id,
            abilityId: "sturdy",
            targetIds: [target.id],
          };
          this.emit(sturdyEvent);
          events.push(sturdyEvent);
          continue;
        }
        if (immunity) {
          const noEffect: BattleEvent = {
            type: BattleEventType.DamageDealt,
            targetId: target.id,
            amount: 0,
            effectiveness: 0,
          };
          this.emit(noEffect);
          events.push(noEffect);
          continue;
        }
        const hits =
          forceHit ||
          consumeLockedOn(pokemon) ||
          this.random() * 100 < ohkoAccuracy(effectiveMove, this.effectiveTypesOf(pokemon));
        if (hits) {
          targets.push(target);
        } else {
          const missEvent: BattleEvent = {
            type: BattleEventType.MoveMissed,
            attackerId: pokemon.id,
            targetId: target.id,
          };
          this.emit(missEvent);
          events.push(missEvent);
        }
        continue;
      }

      if (
        forceHit ||
        checkAccuracy(
          effectiveMove,
          pokemon,
          target,
          this.random,
          tallGrassBonus,
          this.abilityRegistry ?? undefined,
          this.state,
          this.itemRegistry ?? undefined,
        )
      ) {
        targets.push(target);
      } else {
        const missEvent: BattleEvent = {
          type: BattleEventType.MoveMissed,
          attackerId: pokemon.id,
          targetId: target.id,
        };
        this.emit(missEvent);
        events.push(missEvent);
      }
    }

    // Moiteur (damp): relational, not field-wide. An explosion move (Destruction) fizzles entirely
    // when a living Moiteur holder is among its targets. The move still counts as used (CT paid) but
    // ALL its effects are skipped — including the self-KO Recoil (a self-effect that would otherwise
    // still cost the caster ~1 HP even with the damage zeroed out).
    // Reactive-charge T2 gate (plan 150): a Mitra-Poing whose focus was broken during the charge, or
    // a Carapiège that was never armed by a physical hit, fizzles on its strike turn (0 damage, CT
    // paid). Bec-Canon has no gate (it always fires; its burn was applied reactively at charge time).
    if (isFiringCharged && move.chargeReaction !== undefined) {
      const focusLost =
        move.chargeReaction === ChargeReaction.Focus && pokemon.focusInterrupted === true;
      const trapUnarmed =
        move.chargeReaction === ChargeReaction.Shell && pokemon.shellTrapArmed !== true;
      if (focusLost || trapUnarmed) {
        const failEvent: BattleEvent = {
          type: BattleEventType.MoveFailed,
          attackerId: pokemon.id,
          moveId,
          reason: focusLost ? MoveFailedReason.Focus : MoveFailedReason.ShellTrap,
        };
        this.emit(failEvent);
        events.push(failEvent);
        targets.length = 0;
      }
      pokemon.focusInterrupted = undefined;
      pokemon.shellTrapArmed = undefined;
    }

    // Coup Bas (sucker-punch, plan 150): fizzles unless the target's LAST action was offensive
    // (`lastOffensiveActionAtAction === lastActedAtAction`). Reinterprets canon "fails if the target
    // isn't attacking" on the sequential CT timeline, with freshness (avoids the sticky
    // "attacked once, forever aggressive" of lastUsedMoveId).
    if (move.failsUnlessTargetAggressive === true && targets.length > 0) {
      const suckerTarget = targets[0];
      const targetIsAggressive =
        suckerTarget !== undefined &&
        suckerTarget.lastActedAtAction !== undefined &&
        suckerTarget.lastOffensiveActionAtAction === suckerTarget.lastActedAtAction;
      if (!targetIsAggressive) {
        const failEvent: BattleEvent = {
          type: BattleEventType.MoveFailed,
          attackerId: pokemon.id,
          moveId,
        };
        this.emit(failEvent);
        events.push(failEvent);
        targets.length = 0;
      }
    }

    // Relâche / Avale (spit-up / swallow, plan 162): fizzle (CT paid) with no stockpile layer.
    if (move.failsWithoutStockpile === true && (pokemon.stockpileCount ?? 0) <= 0) {
      const failEvent: BattleEvent = {
        type: BattleEventType.MoveFailed,
        attackerId: pokemon.id,
        moveId,
      };
      this.emit(failEvent);
      events.push(failEvent);
      targets.length = 0;
    }

    let dampFizzled = false;
    if (move.isExplosion === true) {
      const dampHolder = findDampInTargets(targets);
      if (dampHolder) {
        dampFizzled = true;
        const failEvent: BattleEvent = {
          type: BattleEventType.MoveFailed,
          attackerId: pokemon.id,
          moveId,
        };
        this.emit(failEvent);
        events.push(failEvent);
        const dampEvent: BattleEvent = {
          type: BattleEventType.AbilityActivated,
          pokemonId: dampHolder.id,
          abilityId: "damp",
          targetIds: [pokemon.id],
        };
        this.emit(dampEvent);
        events.push(dampEvent);
        targets.length = 0;
      }
    }

    // Dream Eater (B2): the move fails unless the target is asleep. Drop awake targets; if that
    // leaves nothing to hit, the move fizzles (no damage / no drain) but still counts as used.
    if (move.requiresTargetAsleep === true && targets.length > 0) {
      const asleepTargets = targets.filter((target) =>
        target.statusEffects.some((status) => status.type === StatusType.Asleep),
      );
      if (asleepTargets.length === 0) {
        const failEvent: BattleEvent = {
          type: BattleEventType.MoveFailed,
          attackerId: pokemon.id,
          moveId,
        };
        this.emit(failEvent);
        events.push(failEvent);
      }
      targets.length = 0;
      targets.push(...asleepTargets);
    }

    // Flamme Ultime (burn-up): the move fails wholesale (no damage) unless the user currently has the
    // required type. Gated before damage so a typeless/non-Fire user can't keep firing it.
    if (move.requiresUserType !== undefined) {
      if (!this.effectiveTypesOf(pokemon).includes(move.requiresUserType)) {
        const failEvent: BattleEvent = {
          type: BattleEventType.MoveFailed,
          attackerId: pokemon.id,
          moveId,
        };
        this.emit(failEvent);
        events.push(failEvent);
        targets.length = 0;
      }
    }

    const attackerTypes = this.effectiveTypesOf(pokemon);
    const targetTypesMap = new Map<string, PokemonType[]>();
    for (const target of targets) {
      targetTypesMap.set(target.id, this.effectiveTypesOf(target));
    }

    const attackerHeight = this.grid.getTile(pokemon.position)?.height ?? 0;
    const heightMod = getHeightModifier(
      attackerHeight,
      this.grid.getTile(targetPosition)?.height ?? 0,
      effectiveMove.ignoresHeight ?? false,
    );

    const attackerTile = this.grid.getTile(pokemon.position);
    const terrainMod = attackerTile
      ? getTerrainTypeBonusFactor(
          attackerTile.terrain,
          effectiveMove.type,
          attackerTypes,
          this.isEffectivelyFlying(pokemon),
        )
      : 1.0;

    const attackOrigin = getAttackOrigin(pokemon, effectiveMove, targetPosition);
    const facingModifierMap = new Map<string, number>();
    for (const target of targets) {
      const facingZone = getFacingZone(attackOrigin, target);
      let modifier = getFacingModifier(facingZone);
      // Poursuite (pursuit): ×2 when the hit lands in the target's Back zone — stacks with the
      // universal 1.15 back bonus (→ 2.3× from behind), the grid reinterpretation of "×2 if fleeing".
      if (effectiveMove.pursuitBackstab === true && facingZone === FacingZone.Back) {
        modifier *= 2;
      }
      if (target.semiInvulnerableState !== undefined) {
        modifier *= getSemiInvulnerableDamageMultiplier(
          effectiveMove,
          target.semiInvulnerableState,
        );
      }
      facingModifierMap.set(target.id, modifier);
    }

    if (effectiveMove.targeting.kind === TargetingKind.Dash) {
      this.dashMoveCaster(pokemon, targetPosition, events);
    }

    // Echoed Voice crescendo (B3): ramp the team streak BEFORE damage resolves so the
    // dynamic-power resolver reads the up-to-date value for this cast.
    if (move.dynamicPower?.kind === DynamicPowerKind.EchoCrescendo) {
      const previousTeamMove = this.state.lastTeamActionMoveId?.[pokemon.playerId];
      this.state.echoStreak =
        previousTeamMove === moveId ? Math.min(5, (this.state.echoStreak ?? 0) + 1) : 1;
    }

    const effectEvents = dampFizzled
      ? []
      : processEffects({
          attacker: pokemon,
          targets,
          move: effectiveMove,
          state: this.state,
          typeChart: this.typeChart,
          attackerTypes,
          targetTypesMap,
          moveTypeOf: (id) => this.moveRegistry.get(id)?.type,
          targetPosition,
          random: this.random,
          heightModifier: heightMod,
          terrainModifier: terrainMod,
          facingModifierMap,
          statusRules: this.statusRules,
          abilityRegistry: this.abilityRegistry ?? undefined,
          itemRegistry: this.itemRegistry ?? undefined,
        });

    for (const event of effectEvents) {
      this.emit(event);
      events.push(event);
    }

    for (const event of effectEvents) {
      // Vœu Soin (healing-wish): a KO'd ally brought back to the field must re-enter the CT scheduler
      // (a merely-healed living occupant is already scheduled — no-op there).
      if (event.type === BattleEventType.PokemonRevived && event.revived) {
        this.chargeTimeTurnSystem.onPokemonRevived(event.pokemonId);
        continue;
      }
      if (event.type === BattleEventType.PokemonKo) {
        this.handleKo(event.pokemonId, events);
        if (this.battleOver) {
          return { success: true, events };
        }
        const target = this.state.pokemon.get(event.pokemonId);
        const attackerAbility = this.abilityRegistry?.getForPokemon(pokemon);
        if (attackerAbility?.onAfterKO && target) {
          const koEvents = attackerAbility.onAfterKO({
            self: pokemon,
            target,
            move: effectiveMove,
            state: this.state,
          });
          for (const e of koEvents) {
            this.emit(e);
            events.push(e);
          }
        }
      }
    }

    // Gravité: the instant the zone is posted, mons caught inside it are grounded NOW — apply their
    // tile's entry-hazards + terrain immediately (a flyer over lava melts at once instead of escaping
    // on its next turn). Only mons that were airborne (and are now grounded) are re-evaluated.
    if (
      effectiveMove.effects.some(
        (effect) =>
          effect.kind === EffectKind.PostFieldGlobal &&
          effect.fieldGlobalKind === FieldGlobalKind.Gravity,
      )
    ) {
      this.applyGravityGroundingOnCast(events);
      if (this.battleOver) {
        return { success: true, events };
      }
    }

    // Anti-Air (smack-down): the target it just grounded takes its tile's hazards + terrain NOW
    // (mirror of the Gravité on-cast tick), so it can't escape the tick by acting on its own turn.
    const smackedTargetIds: string[] = [];
    for (const event of events) {
      if (event.type === BattleEventType.SmackedDown) {
        smackedTargetIds.push(event.targetId);
      }
    }
    for (const targetId of smackedTargetIds) {
      const smacked = this.state.pokemon.get(targetId);
      if (smacked && smacked.currentHp > 0) {
        this.applyGroundingTerrainTick(smacked, events);
        if (this.battleOver) {
          return { success: true, events };
        }
      }
    }

    // Ability manip (plan 153): suppressing/replacing/swapping away Lévitation grounds a floating mon
    // NOW (mirror of Anti-Air above) — a de-levitated mon standing over lava/deep water drowns/burns
    // this instant instead of escaping until its next terrain tick.
    const abilityChangedIds: string[] = [];
    for (const event of events) {
      if (event.type === BattleEventType.AbilityChanged) {
        abilityChangedIds.push(event.pokemonId);
      }
    }
    for (const changedId of abilityChangedIds) {
      const changed = this.state.pokemon.get(changedId);
      if (changed && changed.currentHp > 0 && !this.isEffectivelyFlying(changed)) {
        this.applyGroundingTerrainTick(changed, events);
        if (this.battleOver) {
          return { success: true, events };
        }
      }
    }

    // Interversion (ally-switch, plan 155): both swapped mons take their new tile's terrain NOW
    // (mirror of Anti-Air / ability-manip grounding tick), so a grounded mon swapped onto lava/deep
    // water burns/drowns this instant; a levitating mon (Vol Magnétik) floats over it.
    const swappedIds: string[] = [];
    for (const event of events) {
      if (event.type === BattleEventType.AlliesSwapped) {
        swappedIds.push(event.casterId, event.allyId);
      }
    }
    for (const swappedId of swappedIds) {
      const swapped = this.state.pokemon.get(swappedId);
      if (swapped && swapped.currentHp > 0 && !this.isEffectivelyFlying(swapped)) {
        this.applyGroundingTerrainTick(swapped, events);
        if (this.battleOver) {
          return { success: true, events };
        }
      }
    }

    // Whether the move landed a real (non-recoil, non-self, super-effective-or-neutral) hit. Shared by
    // Tout ou Rien's conditional self-KO and the crash-on-miss recoil below (single source of truth).
    const moveConnected = effectEvents.some(
      (event) =>
        event.type === BattleEventType.DamageDealt &&
        event.targetId !== pokemon.id &&
        event.recoil !== true &&
        (event.effectiveness ?? 0) > 0,
    );

    // Sacrifice / Self-KO family (plan 147). Three flavours converge here:
    //  - Explosion (Destruction, Explo-Brume): unconditional, but skipped when Moiteur fizzled it.
    //  - Plain self-KO (Souvenir, Vœu Soin): unconditional, NOT blocked by Moiteur.
    //  - Conditional self-KO (Tout ou Rien): faints only if the move connected on a non-self target.
    // Emit the self-damage (recoil) first so the renderer animates the HP bar down before the KO.
    const explosionSelfKo = move.isExplosion === true && !dampFizzled;
    const plainSelfKo = move.selfKo === true;
    const connectSelfKo = move.selfKoOnConnect === true && moveConnected;
    if ((explosionSelfKo || plainSelfKo || connectSelfKo) && pokemon.currentHp > 0) {
      const selfDamage = pokemon.currentHp;
      pokemon.currentHp = 0;
      const selfDamageEvent: BattleEvent = {
        type: BattleEventType.DamageDealt,
        targetId: pokemon.id,
        amount: selfDamage,
        effectiveness: 1,
        recoil: true,
      };
      this.emit(selfDamageEvent);
      events.push(selfDamageEvent);
      const selfKoEvent: BattleEvent = {
        type: BattleEventType.PokemonKo,
        pokemonId: pokemon.id,
        countdownStart: 0,
      };
      this.emit(selfKoEvent);
      events.push(selfKoEvent);
      this.handleKo(pokemon.id, events);
      if (this.battleOver) {
        return { success: true, events };
      }
    }

    if (effectiveMove.crashOnMiss && pokemon.currentHp > 0) {
      if (!moveConnected) {
        const crashDamage = Math.max(
          1,
          Math.floor(pokemon.maxHp * effectiveMove.crashOnMiss.fraction),
        );
        pokemon.currentHp = Math.max(0, pokemon.currentHp - crashDamage);
        const crashEvent: BattleEvent = {
          type: BattleEventType.DamageDealt,
          targetId: pokemon.id,
          amount: crashDamage,
          effectiveness: 1,
          recoil: true,
        };
        this.emit(crashEvent);
        events.push(crashEvent);
        if (pokemon.currentHp <= 0) {
          const koEvent: BattleEvent = {
            type: BattleEventType.PokemonKo,
            pokemonId: pokemon.id,
            countdownStart: 0,
          };
          this.emit(koEvent);
          events.push(koEvent);
          this.handleKo(pokemon.id, events);
          if (this.battleOver) {
            return { success: true, events };
          }
        }
      }
    }

    this.emitPositionLinkedChecks(events);

    if (effectiveMove.targeting.kind === TargetingKind.Teleport) {
      this.teleportMoveCaster(pokemon, targetPosition, events);
    }

    if (effectiveMove.targeting.kind === TargetingKind.HitAndRun && pokemon.currentHp > 0) {
      this.hitAndRunMoveCaster(
        pokemon,
        effectiveMove.targeting.retreatRange,
        retreatPosition,
        targets.length > 0,
        events,
      );
    }

    this.applyChoiceLock(pokemon, moveId);

    // Charge (B3): a Charge'd Electric move consumes the volatile after dealing its boosted hit.
    if (effectiveMove.type === PokemonType.Electric && moveId !== "charge") {
      this.removeChargedVolatile(pokemon);
    }

    this.turnState.hasActed = true;
    this.turnState.lastMoveId = moveId;
    recordLastUsedMove(pokemon, move);
    // Lock-in multi-turn (plan 149): advance the rampage counter — locks on the first cast, ticks
    // down each turn, self-confuses (Mania / Danse Fleurs / Colère / Grand Courroux) or wakes/blocks
    // sleep (Brouhaha) as it resolves. Runs whatever the cast's outcome (a miss still burns a turn).
    if (isLockInMove(move) && pokemon.currentHp > 0) {
      for (const event of resolveLockIn(
        pokemon,
        move,
        this.random,
        this.state,
        this.effectiveTypesOf(pokemon),
      )) {
        events.push(event);
        this.emit(event);
      }
    }
    // Move-copy (plan 144): `lastUsedMoveId` stays on the source move (recordLastUsedMove above), but
    // the GLOBAL last move (Photocopie) records the move actually executed — never a metamove.
    if (effectiveMove.callMove === undefined) {
      this.state.lastMoveUsedGlobally = effectiveMove.id;
    }
    // Consume / release the call-move resolution: the action is done (the matching pending was just
    // fired, or any abandoned pending from this turn is dropped).
    pokemon.pendingCalledMove = undefined;
    if (pokemon.usedMoveIds === undefined) {
      pokemon.usedMoveIds = [];
    }
    if (!pokemon.usedMoveIds.includes(moveId)) {
      pokemon.usedMoveIds.push(moveId);
    }
    // Track move failure for Stomping Tantrum: a damaging move that connected with no target
    // (missed / immune / fully blocked) counts as failed. Status/self moves never "fail" here.
    const isDamagingMove = effectiveMove.effects.some(
      (effect) => effect.kind === EffectKind.Damage,
    );
    if (isDamagingMove) {
      const connectedWithTarget = effectEvents.some(
        (event) =>
          event.type === BattleEventType.DamageDealt &&
          event.targetId !== pokemon.id &&
          event.recoil !== true &&
          (event.effectiveness ?? 0) > 0,
      );
      pokemon.lastMoveFailed = !connectedWithTarget;
    } else {
      pokemon.lastMoveFailed = false;
    }
    this.turnState.lastTargetIds = targets.map((t) => t.id);
    this.preMoveSnapshot = null;

    if (move.recharge && pokemon.currentHp > 0) {
      pokemon.recharging = true;
      const rechargeEvent: BattleEvent = {
        type: BattleEventType.RechargeStarted,
        pokemonId: pokemon.id,
      };
      this.emit(rechargeEvent);
      events.push(rechargeEvent);
    }

    return { success: true, events };
  }

  private executeConfusedMove(pokemon: PokemonInstance): ActionResult {
    if (this.turnState.hasMoved) {
      return { success: false, events: [], error: ActionError.AlreadyMoved };
    }

    const events: BattleEvent[] = [];
    const directions = [Direction.North, Direction.South, Direction.East, Direction.West];
    const randomDirection =
      directions[Math.floor(this.random() * directions.length)] ?? Direction.North;
    const steps = Math.floor(this.random() * 2) + 1;

    const path: Position[] = [];
    let currentPos = pokemon.position;
    for (let i = 0; i < steps; i++) {
      const next = stepInDirection(currentPos, randomDirection, 1);
      if (!this.grid.isInBounds(next)) {
        break;
      }
      const tile = this.grid.getTile(next);
      if (!tile || !isTerrainPassable(tile.terrain)) {
        break;
      }
      const occupant = tile.occupantId;
      if (occupant !== null && occupant !== pokemon.id) {
        const occupantPokemon = this.state.pokemon.get(occupant);
        if (occupantPokemon && occupantPokemon.currentHp > 0) {
          break;
        }
      }
      path.push(next);
      currentPos = next;
    }

    if (path.length === 0) {
      this.turnState.hasMoved = true;
      return { success: true, events };
    }

    const origin = { ...pokemon.position };
    this.grid.setOccupant(origin, null);
    const destination = path[path.length - 1] as Position;
    this.grid.setOccupant(destination, pokemon.id);
    pokemon.position = destination;
    pokemon.movedThisTurn = true;
    pokemon.orientation = randomDirection;

    const moveEvent: BattleEvent = {
      type: BattleEventType.PokemonMoved,
      pokemonId: pokemon.id,
      path,
    };
    this.emit(moveEvent);
    events.push(moveEvent);

    this.turnState.hasMoved = true;

    this.emitPositionLinkedChecks(events);

    return { success: true, events };
  }

  private executeConfusedUseMove(
    pokemon: PokemonInstance,
    moveId: string,
    targetPosition: Position,
  ): ActionResult {
    const move = this.moveRegistry.get(moveId);
    if (!move) {
      return this.executeUseMove(pokemon, moveId, targetPosition);
    }

    const targeting = move.targeting;
    const isSelfTargeting =
      targeting.kind === TargetingKind.Self ||
      targeting.kind === TargetingKind.Zone ||
      targeting.kind === TargetingKind.Cross;
    const isSelfOnly = targeting.kind === TargetingKind.Self;
    const isSelfBuff =
      isSelfOnly &&
      move.effects.every(
        (e) => e.kind === EffectKind.StatChange && "target" in e && e.target === EffectTarget.Self,
      );

    if (isSelfBuff || isSelfOnly) {
      return this.executeUseMove(pokemon, moveId, targetPosition);
    }

    const isDirectional =
      targeting.kind === TargetingKind.Cone ||
      targeting.kind === TargetingKind.Line ||
      targeting.kind === TargetingKind.Slash;

    if (isDirectional || isSelfTargeting) {
      const directions = [Direction.North, Direction.South, Direction.East, Direction.West];
      const randomDirection =
        directions[Math.floor(this.random() * directions.length)] ?? Direction.North;
      const redirectedTarget = stepInDirection(pokemon.position, randomDirection, 1);

      const events: BattleEvent[] = [];
      const redirectEvent: BattleEvent = {
        type: BattleEventType.ConfusionRedirected,
        pokemonId: pokemon.id,
        originalDirection: directionFromTo(pokemon.position, targetPosition),
        newDirection: randomDirection,
      };
      this.emit(redirectEvent);
      events.push(redirectEvent);

      const result = this.executeUseMove(pokemon, moveId, redirectedTarget);
      return {
        success: result.success,
        events: [...events, ...result.events],
        error: result.error,
      };
    }

    const allies: PokemonInstance[] = [];
    for (const [, p] of this.state.pokemon) {
      if (p.playerId === pokemon.playerId && p.id !== pokemon.id && p.currentHp > 0) {
        if (targeting.kind === TargetingKind.Single) {
          const distance = manhattanDistance(pokemon.position, p.position);
          if (distance >= targeting.range.min && distance <= targeting.range.max) {
            allies.push(p);
          }
        } else if (targeting.kind === TargetingKind.Dash) {
          const distance = manhattanDistance(pokemon.position, p.position);
          if (distance <= targeting.maxDistance) {
            const dx = p.position.x - pokemon.position.x;
            const dy = p.position.y - pokemon.position.y;
            if (dx === 0 || dy === 0) {
              allies.push(p);
            }
          }
        } else if (targeting.kind === TargetingKind.Blast) {
          const distance = manhattanDistance(pokemon.position, p.position);
          if (distance >= targeting.range.min && distance <= targeting.range.max) {
            allies.push(p);
          }
        }
      }
    }

    if (allies.length === 0) {
      const events: BattleEvent[] = [];
      const failEvent: BattleEvent = {
        type: BattleEventType.ConfusionFailed,
        pokemonId: pokemon.id,
        reason: "no_ally_in_range",
      };
      this.emit(failEvent);
      events.push(failEvent);
      this.turnState.hasActed = true;
      this.preMoveSnapshot = null;
      return { success: true, events };
    }

    const randomAlly = allies[Math.floor(this.random() * allies.length)];
    if (!randomAlly) {
      this.turnState.hasActed = true;
      this.preMoveSnapshot = null;
      return { success: true, events: [] };
    }
    const events: BattleEvent[] = [];
    const redirectEvent: BattleEvent = {
      type: BattleEventType.ConfusionRedirected,
      pokemonId: pokemon.id,
      originalTarget: `${targetPosition.x},${targetPosition.y}`,
      newTarget: randomAlly.id,
    };
    this.emit(redirectEvent);
    events.push(redirectEvent);

    const result = this.executeUseMove(pokemon, moveId, randomAlly.position);
    return {
      success: result.success,
      events: [...events, ...result.events],
      error: result.error,
    };
  }

  private dashMoveCaster(
    pokemon: PokemonInstance,
    targetPosition: Position,
    events: BattleEvent[],
  ): void {
    const direction = directionFromTo(pokemon.position, targetPosition);
    let destination: Position | null = null;
    let wallHeightDiff = 0;
    const distance = manhattanDistance(pokemon.position, targetPosition);
    const isFlying = this.isEffectivelyFlying(pokemon);
    let previousHeight = this.grid.getTile(pokemon.position)?.height ?? 0;
    const isBarrierTile = this.buildDashBarrierPredicate(pokemon);
    let previousIsBarrier = isBarrierTile(pokemon.position);
    let psychicBarrierAt: Position | null = null;

    for (let step = 1; step <= distance; step++) {
      const position = stepInDirection(pokemon.position, direction, step);
      if (!this.grid.isInBounds(position)) {
        break;
      }
      // Psychic-terrain barrier (B4): stop at the edge when crossing into an enemy zone. Block +
      // wall-impact damage are applied after the partial move, mirroring the height-wall path below.
      const isBarrier = isBarrierTile(position);
      if (isBarrier && !previousIsBarrier) {
        psychicBarrierAt = { ...position };
        break;
      }
      previousIsBarrier = isBarrier;
      const tileHeight = this.grid.getTile(position)?.height ?? 0;
      if (!isFlying && tileHeight - previousHeight > 0.5) {
        wallHeightDiff = tileHeight - previousHeight;
        break;
      }
      const occupant = this.grid.getOccupant(position);
      if (occupant !== null && occupant !== pokemon.id) {
        const occupantPokemon = this.state.pokemon.get(occupant);
        if (occupantPokemon && occupantPokemon.currentHp > 0) {
          break;
        }
        continue;
      }
      destination = position;
      previousHeight = tileHeight;
    }

    // Psychic barrier: announce the repel and deal wall-impact damage via the SAME resolver as a
    // height wall (applyImpactDamage → calculateFallDamage), with a synthetic impact height.
    const applyPsychicBarrier = (): void => {
      if (!psychicBarrierAt) {
        return;
      }
      const blockEvent: BattleEvent = {
        type: BattleEventType.DashBlockedByPsychicTerrain,
        pokemonId: pokemon.id,
        blockedAt: psychicBarrierAt,
      };
      this.emit(blockEvent);
      events.push(blockEvent);
      for (const event of applyImpactDamage(pokemon, PSYCHIC_BARRIER_IMPACT_HEIGHT)) {
        this.emit(event);
        events.push(event);
      }
    };

    if (destination === null) {
      if (wallHeightDiff > 0 && !isFlying) {
        for (const event of applyImpactDamage(pokemon, wallHeightDiff)) {
          this.emit(event);
          events.push(event);
        }
      }
      applyPsychicBarrier();
      return;
    }

    const origin = pokemon.position;
    const originHeight = this.grid.getTile(origin)?.height ?? 0;
    const destHeight = this.grid.getTile(destination)?.height ?? 0;
    this.grid.setOccupant(origin, null);
    this.grid.setOccupant(destination, pokemon.id);
    pokemon.position = destination;
    pokemon.movedThisTurn = true;
    pokemon.orientation = direction;

    const moveEvent: BattleEvent = {
      type: BattleEventType.PokemonMoved,
      pokemonId: pokemon.id,
      path: [destination],
    };
    this.emit(moveEvent);
    events.push(moveEvent);

    if (wallHeightDiff > 0 && !isFlying) {
      for (const event of applyImpactDamage(pokemon, wallHeightDiff)) {
        this.emit(event);
        events.push(event);
      }
    }

    applyPsychicBarrier();

    const dashHeightDiff = originHeight - destHeight;
    if (dashHeightDiff > 0) {
      if (!isFlying) {
        const fallDamage = calculateFallDamage(dashHeightDiff, pokemon.maxHp);
        if (fallDamage > 0) {
          pokemon.currentHp = Math.max(0, pokemon.currentHp - fallDamage);
          const fallEvent: BattleEvent = {
            type: BattleEventType.FallDamageDealt,
            pokemonId: pokemon.id,
            amount: fallDamage,
            heightDiff: dashHeightDiff,
          };
          this.emit(fallEvent);
          events.push(fallEvent);
          if (pokemon.currentHp <= 0) {
            const koEvent: BattleEvent = {
              type: BattleEventType.PokemonKo,
              pokemonId: pokemon.id,
              countdownStart: 0,
            };
            this.emit(koEvent);
            events.push(koEvent);
          }
        }
      }
    }

    if (pokemon.currentHp > 0) {
      this.applyEntryHazardsOnPath(pokemon, [destination], events);
    }
  }

  private teleportMoveCaster(
    pokemon: PokemonInstance,
    targetPosition: Position,
    events: BattleEvent[],
  ): void {
    const origin = { ...pokemon.position };

    if (origin.x === targetPosition.x && origin.y === targetPosition.y) {
      return;
    }

    this.grid.setOccupant(origin, null);
    this.grid.setOccupant(targetPosition, pokemon.id);
    pokemon.position = { ...targetPosition };
    pokemon.movedThisTurn = true;

    const teleportedEvent: BattleEvent = {
      type: BattleEventType.Teleported,
      pokemonId: pokemon.id,
      fromPosition: origin,
      toPosition: { ...targetPosition },
      targetTile: { ...targetPosition },
    };
    this.emit(teleportedEvent);
    events.push(teleportedEvent);

    this.applyLandingTerrainEffects(pokemon, targetPosition, events);
    if (pokemon.currentHp > 0) {
      this.applyEntryHazardsOnPath(pokemon, [{ ...targetPosition }], events);
    }
  }

  private applyLandingTerrainEffects(
    pokemon: PokemonInstance,
    landingPosition: Position,
    events: BattleEvent[],
  ): void {
    const landingTile = this.grid.getTile(landingPosition);
    if (!landingTile) {
      return;
    }

    if (isTerrainPassable(landingTile.terrain)) {
      return;
    }

    const pokemonTypes = this.effectiveTypesOf(pokemon);
    const isFlying = this.isEffectivelyFlying(pokemon);
    if (isTerrainImmune(landingTile.terrain, pokemonTypes, isFlying)) {
      return;
    }

    pokemon.currentHp = 0;
    const lethalEvent: BattleEvent = {
      type: BattleEventType.LethalTerrainKo,
      pokemonId: pokemon.id,
      terrain: landingTile.terrain,
    };
    this.emit(lethalEvent);
    events.push(lethalEvent);

    const koEvent: BattleEvent = {
      type: BattleEventType.PokemonKo,
      pokemonId: pokemon.id,
      countdownStart: 0,
    };
    this.emit(koEvent);
    events.push(koEvent);
    this.handleKo(pokemon.id, events);
  }

  /**
   * Trigger entry hazards for every trapped tile a Pokemon ENTERS along `path` (plan 131). The path
   * never includes the start tile, so a hazard posted under a stationary mon doesn't fire. Damage
   * (Picots / Pièges de Roc) and Speed drops (Toile Gluante) stack per distinct trapped tile; poison
   * (Pics Toxik) is idempotent. Team-agnostic — any mon entering a trapped tile is affected. KO
   * mid-path stops the traversal (mirror of the Magma loop).
   */
  private applyEntryHazardsOnPath(
    pokemon: PokemonInstance,
    path: Position[],
    events: BattleEvent[],
  ): void {
    if (this.state.entryHazards.length === 0) {
      return;
    }
    const types = this.effectiveTypesOf(pokemon);
    const isFlying = this.isEffectivelyFlying(pokemon);
    for (const step of path) {
      if (pokemon.currentHp <= 0) {
        return;
      }
      for (const cell of getEntryHazardsAt(this.state, step)) {
        if (isGroundedOnlyHazard(cell.kind) && isFlying) {
          continue;
        }
        this.triggerEntryHazardCell(pokemon, cell, types, events);
        if (pokemon.currentHp <= 0) {
          const koEvent: BattleEvent = {
            type: BattleEventType.PokemonKo,
            pokemonId: pokemon.id,
            countdownStart: 0,
          };
          this.emit(koEvent);
          events.push(koEvent);
          this.handleKo(pokemon.id, events);
          return;
        }
      }
    }
  }

  private triggerEntryHazardCell(
    pokemon: PokemonInstance,
    cell: EntryHazardCell,
    types: PokemonType[],
    events: BattleEvent[],
  ): void {
    switch (cell.kind) {
      case EntryHazardKind.Spikes: {
        const damage = spikesDamage(pokemon.maxHp, cell.layers);
        this.dealEntryHazardDamage(pokemon, cell, damage, events);
        return;
      }
      case EntryHazardKind.StealthRock: {
        const multiplier = getTypeEffectiveness(PokemonType.Rock, types, this.typeChart);
        const damage = stealthRockDamage(pokemon.maxHp, multiplier);
        if (damage <= 0) {
          return;
        }
        this.dealEntryHazardDamage(pokemon, cell, damage, events);
        return;
      }
      case EntryHazardKind.ToxicSpikes: {
        if (absorbsToxicSpikes(cell.kind, types)) {
          removeEntryHazardCell(this.state, cell);
          const absorbedEvent: BattleEvent = {
            type: BattleEventType.EntryHazardAbsorbed,
            pokemonId: pokemon.id,
            tile: { ...cell.tile },
          };
          this.emit(absorbedEvent);
          events.push(absorbedEvent);
          return;
        }
        const status = cell.layers >= 2 ? StatusType.BadlyPoisoned : StatusType.Poisoned;
        if (isImmuneToStatusByType(types, status)) {
          return;
        }
        if (pokemon.statusEffects.some((s) => isMajorStatus(s.type))) {
          return;
        }
        pokemon.statusEffects.push({ type: status, remainingTurns: null });
        if (status === StatusType.BadlyPoisoned) {
          pokemon.toxicCounter = 0;
        }
        const statusEvent: BattleEvent = {
          type: BattleEventType.EntryHazardTriggered,
          pokemonId: pokemon.id,
          kind: cell.kind,
          tile: { ...cell.tile },
          status,
        };
        this.emit(statusEvent);
        events.push(statusEvent);
        return;
      }
      case EntryHazardKind.StickyWeb: {
        const currentStage = pokemon.statStages[StatName.Speed];
        const newStage = clampStages(currentStage, -1);
        if (newStage === currentStage) {
          return;
        }
        pokemon.statStages[StatName.Speed] = newStage;
        pokemon.derivedStats.movement = computeMovement(effectiveBaseSpeed(pokemon), newStage);
        const webEvent: BattleEvent = {
          type: BattleEventType.EntryHazardTriggered,
          pokemonId: pokemon.id,
          kind: cell.kind,
          tile: { ...cell.tile },
          speedStages: newStage - currentStage,
        };
        this.emit(webEvent);
        events.push(webEvent);
        return;
      }
    }
  }

  private dealEntryHazardDamage(
    pokemon: PokemonInstance,
    cell: EntryHazardCell,
    damage: number,
    events: BattleEvent[],
  ): void {
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    const event: BattleEvent = {
      type: BattleEventType.EntryHazardTriggered,
      pokemonId: pokemon.id,
      kind: cell.kind,
      tile: { ...cell.tile },
      damage,
    };
    this.emit(event);
    events.push(event);
  }

  private hitAndRunMoveCaster(
    pokemon: PokemonInstance,
    retreatRange: RangeConfig,
    retreatPosition: Position | undefined,
    hitLanded: boolean,
    events: BattleEvent[],
  ): void {
    if (!hitLanded) {
      this.emitHitAndRunFallback(pokemon, HitAndRunRetreatFallbackReason.Miss, events);
      return;
    }

    if (retreatPosition === undefined) {
      this.emitHitAndRunFallback(pokemon, HitAndRunRetreatFallbackReason.Missing, events);
      return;
    }

    if (!isValidHitAndRunRetreat(pokemon.position, retreatPosition, retreatRange, this.grid)) {
      this.emitHitAndRunFallback(pokemon, HitAndRunRetreatFallbackReason.Invalid, events);
      return;
    }

    const origin = { ...pokemon.position };
    this.grid.setOccupant(origin, null);
    this.grid.setOccupant(retreatPosition, pokemon.id);
    pokemon.position = { ...retreatPosition };
    pokemon.movedThisTurn = true;

    const retreatEvent: BattleEvent = {
      type: BattleEventType.HitAndRunRetreat,
      pokemonId: pokemon.id,
      fromPosition: origin,
      toPosition: { ...retreatPosition },
    };
    this.emit(retreatEvent);
    events.push(retreatEvent);

    this.applyLandingTerrainEffects(pokemon, retreatPosition, events);
    if (pokemon.currentHp > 0) {
      this.applyEntryHazardsOnPath(pokemon, [{ ...retreatPosition }], events);
    }
  }

  private emitHitAndRunFallback(
    pokemon: PokemonInstance,
    reason: HitAndRunRetreatFallbackReason,
    events: BattleEvent[],
  ): void {
    const fallbackEvent: BattleEvent = {
      type: BattleEventType.HitAndRunRetreatFallback,
      pokemonId: pokemon.id,
      reason,
    };
    this.emit(fallbackEvent);
    events.push(fallbackEvent);
  }

  private getReachableTiles(pokemon: PokemonInstance): ReachableTile[] {
    const result: ReachableTile[] = [];
    const visited = new Map<string, number>();
    const posKey = (p: Position): string => `${p.x},${p.y}`;
    const pokemonTypes = this.effectiveTypesOf(pokemon);
    const isFlying = this.isEffectivelyFlying(pokemon);
    const isGhost = pokemonTypes.includes(PokemonType.Ghost);
    const immuneTerrains = getImmuneTerrains(this.terrainTypesOf(pokemon), isFlying);

    const queue: BfsNode[] = [{ position: pokemon.position, path: [], distance: 0 }];
    visited.set(posKey(pokemon.position), 0);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }

      if (current.distance > 0) {
        const occupant = this.grid.getOccupant(current.position);
        const currentTile = this.grid.getTile(current.position);
        if (
          occupant === null &&
          currentTile &&
          canStopOn(currentTile.terrain, isFlying, immuneTerrains)
        ) {
          result.push({ position: current.position, path: current.path });
        }
      }

      const neighbors = this.grid.getNeighbors(current.position);
      for (const neighbor of neighbors) {
        const key = posKey(neighbor.position);

        const currentTileForNeighbor = this.grid.getTile(current.position);
        const currentHeight = currentTileForNeighbor?.height ?? 0;
        const currentTerrain = currentTileForNeighbor?.terrain ?? TerrainType.Normal;
        if (
          !canTraverse({
            fromHeight: currentHeight,
            toHeight: neighbor.height,
            fromTerrain: currentTerrain,
            toTerrain: neighbor.terrain,
            isFlying,
            isGhost,
            immuneTerrains,
          })
        ) {
          continue;
        }

        const occupant = neighbor.occupantId;
        if (occupant !== null) {
          const occupantPokemon = this.state.pokemon.get(occupant);
          if (
            occupantPokemon &&
            occupantPokemon.currentHp > 0 &&
            occupantPokemon.playerId !== pokemon.playerId
          ) {
            continue;
          }
        }

        const penalty = getMovementPenalty(neighbor.terrain, pokemonTypes, isFlying);
        const newDistance = current.distance + 1 + penalty;

        if (newDistance > pokemon.derivedStats.movement) {
          continue;
        }

        const existingDistance = visited.get(key);
        if (existingDistance !== undefined && existingDistance <= newDistance) {
          continue;
        }

        visited.set(key, newDistance);
        queue.push({
          position: neighbor.position,
          path: [...current.path, neighbor.position],
          distance: newDistance,
        });
      }
    }

    return result;
  }

  private executeMove(pokemon: PokemonInstance, path: Position[]): ActionResult {
    if (this.turnState.hasMoved) {
      return { success: false, events: [], error: ActionError.AlreadyMoved };
    }

    const origin = { ...pokemon.position };
    const validationError = this.validateMovePath(pokemon, path);
    if (validationError) {
      return { success: false, events: [], error: validationError };
    }

    const hadBurn = pokemon.statusEffects.some((s) => s.type === StatusType.Burned);
    this.preMoveSnapshot = {
      position: { ...origin },
      orientation: pokemon.orientation,
      hadBurn,
    };

    const events: BattleEvent[] = [];
    const pokemonTypes = this.effectiveTypesOf(pokemon);

    this.grid.setOccupant(origin, null);
    const destination = path[path.length - 1] as Position;
    this.grid.setOccupant(destination, pokemon.id);
    pokemon.position = destination;
    pokemon.movedThisTurn = true;

    const from = path.length > 1 ? (path[path.length - 2] as Position) : origin;
    pokemon.orientation = directionFromTo(from, destination);

    const moveEvent: BattleEvent = {
      type: BattleEventType.PokemonMoved,
      pokemonId: pokemon.id,
      path,
    };
    this.emit(moveEvent);
    events.push(moveEvent);

    const hasMajor = pokemon.statusEffects.some((s) => isMajorStatus(s.type));
    if (!hasMajor) {
      for (const step of path) {
        const tile = this.grid.getTile(step);
        if (tile?.terrain !== TerrainType.Magma) {
          continue;
        }
        if (isTerrainImmune(TerrainType.Magma, pokemonTypes, this.isEffectivelyFlying(pokemon))) {
          break;
        }
        const item = this.itemRegistry?.getForPokemon(pokemon);
        const terrainResult = item?.onTerrainTick?.({ pokemon, terrain: TerrainType.Magma });
        if (terrainResult?.blocked) {
          events.push(...terrainResult.events);
          break;
        }
        pokemon.statusEffects.push({ type: StatusType.Burned, remainingTurns: null });
        const statusEvent: BattleEvent = {
          type: BattleEventType.TerrainStatusApplied,
          pokemonId: pokemon.id,
          terrain: TerrainType.Magma,
          status: StatusType.Burned,
        };
        this.emit(statusEvent);
        events.push(statusEvent);
        break;
      }
    }

    this.applyEntryHazardsOnPath(pokemon, path, events);

    this.turnState.hasMoved = true;

    this.emitPositionLinkedChecks(events);

    return { success: true, events };
  }

  private executeUndoMove(pokemon: PokemonInstance): ActionResult {
    if (!this.preMoveSnapshot) {
      return { success: false, events: [], error: ActionError.InvalidAction };
    }

    const events: BattleEvent[] = [];
    const currentPosition = { ...pokemon.position };

    this.grid.setOccupant(currentPosition, null);
    this.grid.setOccupant(this.preMoveSnapshot.position, pokemon.id);
    pokemon.position = { ...this.preMoveSnapshot.position };
    pokemon.orientation = this.preMoveSnapshot.orientation;

    if (!this.preMoveSnapshot.hadBurn) {
      pokemon.statusEffects = pokemon.statusEffects.filter((s) => s.type !== StatusType.Burned);
    }

    this.turnState.hasMoved = false;

    const cancelEvent: BattleEvent = {
      type: BattleEventType.MoveCancelled,
      pokemonId: pokemon.id,
      position: this.preMoveSnapshot.position,
    };
    this.emit(cancelEvent);
    events.push(cancelEvent);

    this.preMoveSnapshot = null;

    this.emitPositionLinkedChecks(events);

    return { success: true, events };
  }

  private validateMovePath(pokemon: PokemonInstance, path: Position[]): ActionError | null {
    if (path.length === 0) {
      return ActionError.EmptyPath;
    }

    const pokemonTypes = this.effectiveTypesOf(pokemon);
    const isFlying = this.isEffectivelyFlying(pokemon);
    const isGhost = pokemonTypes.includes(PokemonType.Ghost);
    const immuneTerrains = getImmuneTerrains(pokemonTypes, isFlying);

    let totalCost = 0;
    let currentPosition = pokemon.position;
    for (const step of path) {
      if (manhattanDistance(currentPosition, step) !== 1) {
        return ActionError.NonAdjacentStep;
      }

      if (!this.grid.isInBounds(step)) {
        return ActionError.OutOfBounds;
      }

      const tile = this.grid.getTile(step);
      if (!tile) {
        return ActionError.ImpassableTile;
      }

      if (!canEnterTerrain(tile.terrain, isFlying, isGhost, immuneTerrains)) {
        return ActionError.ImpassableTile;
      }

      const currentTile = this.grid.getTile(currentPosition);
      const fromHeight = currentTile?.height ?? 0;
      const fromTerrain = currentTile?.terrain ?? TerrainType.Normal;
      if (
        !canTraverse({
          fromHeight,
          toHeight: tile.height,
          fromTerrain,
          toTerrain: tile.terrain,
          isFlying,
          isGhost,
          immuneTerrains,
        })
      ) {
        return ActionError.JumpTooHigh;
      }

      const isLastStep = step === path[path.length - 1];
      if (isLastStep && !canStopOn(tile.terrain, isFlying, immuneTerrains)) {
        return ActionError.ImpassableTile;
      }

      totalCost += 1 + getMovementPenalty(tile.terrain, pokemonTypes, isFlying);
      if (totalCost > pokemon.derivedStats.movement) {
        return ActionError.PathTooLong;
      }

      const occupant = tile.occupantId;
      if (occupant !== null && occupant !== pokemon.id) {
        const occupantPokemon = this.state.pokemon.get(occupant);
        if (occupantPokemon && occupantPokemon.currentHp > 0) {
          if (occupantPokemon.playerId !== pokemon.playerId) {
            return ActionError.BlockedByEnemy;
          }
          if (isLastStep) {
            return ActionError.DestinationOccupied;
          }
        } else if (isLastStep) {
          return ActionError.DestinationOccupied;
        }
      }

      currentPosition = step;
    }

    return null;
  }

  private executeEndTurn(pokemonId: string, direction: Direction): ActionResult {
    const pokemon = this.state.pokemon.get(pokemonId);
    if (pokemon) {
      pokemon.orientation = direction;
    }
    const events: BattleEvent[] = [];

    if (pokemon?.recharging && !this.turnState.hasActed) {
      pokemon.recharging = false;
      const rechargeEndEvent: BattleEvent = {
        type: BattleEventType.RechargeEnded,
        pokemonId,
      };
      this.emit(rechargeEndEvent);
      events.push(rechargeEndEvent);
    }

    if (pokemon && pokemon.chargingMove !== undefined && !this.turnState.hasActed) {
      pokemon.chargingMove = undefined;
      pokemon.lockedMoveId = undefined;
      pokemon.semiInvulnerableState = undefined;
      // Reactive-charge family (plan 150): drop the reaction flags with the abandoned charge.
      pokemon.focusInterrupted = undefined;
      pokemon.shellTrapArmed = undefined;
      const cancelEvent: BattleEvent = {
        type: BattleEventType.MoveCancelled,
        pokemonId,
        position: { ...pokemon.position },
      };
      this.emit(cancelEvent);
      events.push(cancelEvent);
    }

    // Move-copy (plan 144): a call-move resolution prepared but never fired (player ended the turn
    // instead of placing it) is dropped here — no carry-over to the next turn.
    if (pokemon !== undefined) {
      pokemon.pendingCalledMove = undefined;
    }

    this.endCurrentTurn(pokemonId, events);
    return { success: true, events };
  }

  /**
   * Start-of-action bookkeeping for the action clock (B3): tick the monotonic counter and clear
   * the actor's "fresh stat boost" flag (it cashes in its setup by acting). Runs in both loops.
   */
  private beginActorTurn(pokemonId: string): void {
    this.state.actionCounter = (this.state.actionCounter ?? 0) + 1;
    const startingPokemon = this.state.pokemon.get(pokemonId);
    if (startingPokemon !== undefined) {
      startingPokemon.hasFreshStatBoost = false;
    }
    // Affilage: remember whether the crit was already armed before this action (see endCurrentTurn).
    this.critArmedAtActionStart = startingPokemon?.guaranteedCritArmed === true;
  }

  /**
   * Asleep exception (B3): a sleeping mon normally skips its turn, but if it holds a usable
   * requiresAsleep move (snore) it gets a restricted turn (that move or wait — no displacement).
   */
  private canActWhileAsleep(pokemonId: string): boolean {
    const pokemon = this.state.pokemon.get(pokemonId);
    if (pokemon === undefined || !pokemon.statusEffects.some((s) => s.type === StatusType.Asleep)) {
      return false;
    }
    return pokemon.moveIds.some((moveId) => {
      const move = this.moveRegistry.get(moveId);
      return move?.requiresAsleep === true;
    });
  }

  /** Remove the Charge volatile after the user fires an Electric move (B3). */
  private removeChargedVolatile(pokemon: PokemonInstance): void {
    const index = pokemon.volatileStatuses.findIndex((v) => v.type === StatusType.Charged);
    if (index !== -1) {
      pokemon.volatileStatuses.splice(index, 1);
    }
  }

  private endCurrentTurn(pokemonId: string, events: BattleEvent[]): void {
    // Action clock (B3): stamp this actor's completed action and record the team's last move so
    // "since my last action" / "team previous action" conditions resolve on later turns.
    const actingPokemon = this.state.pokemon.get(pokemonId);
    if (actingPokemon !== undefined) {
      actingPokemon.lastActedAtAction = this.state.actionCounter ?? 0;
      // Coup Bas fraîcheur (plan 150): stamp this action as offensive when the move used was a
      // damaging move (`power > 0`). Sucker-punch reads `lastOffensiveActionAtAction === lastActedAtAction`.
      const lastMoveUsed = this.turnState.lastMoveId
        ? this.moveRegistry.get(this.turnState.lastMoveId)
        : undefined;
      if (lastMoveUsed !== undefined && lastMoveUsed.power > 0) {
        actingPokemon.lastOffensiveActionAtAction = this.state.actionCounter ?? 0;
      }
      // Affilage (laser-focus): the one-shot guaranteed crit is spent after the caster's NEXT action
      // (whether it attacked or wasted the focus on a status move). Only clear when it was armed
      // BEFORE this action — never on the arming action itself.
      if (this.critArmedAtActionStart && actingPokemon.guaranteedCritArmed === true) {
        actingPokemon.guaranteedCritArmed = undefined;
      }
      if (this.state.lastTeamActionMoveId === undefined) {
        this.state.lastTeamActionMoveId = {};
      }
      this.state.lastTeamActionMoveId[actingPokemon.playerId] =
        this.turnState.lastMoveId ?? undefined;
    }

    const turnEnded: BattleEvent = { type: BattleEventType.TurnEnded, pokemonId };
    this.emit(turnEnded);
    events.push(turnEnded);

    const endTurnResult = this.turnPipeline.executeEndTurn(pokemonId, this.state);
    for (const event of endTurnResult.events) {
      this.emit(event);
      events.push(event);
    }

    // Coup d'Main (helping-hand): the buff lasts until the end of the buffed mon's turn. Whatever it
    // did (offensive move already boosted in handle-damage, or wasted on a status move), clear it now.
    if (actingPokemon !== undefined && actingPokemon.helpingHand === true) {
      actingPokemon.helpingHand = undefined;
      const consumed: BattleEvent = {
        type: BattleEventType.HelpingHandConsumed,
        pokemonId: actingPokemon.id,
      };
      this.emit(consumed);
      events.push(consumed);
    }

    // Prescience (future-sight): the strike counts down on its caster's own turns; resolve here.
    this.resolveFutureSightStrikes(pokemonId, events);
    if (this.battleOver) {
      return;
    }

    const activePokemon = this.state.pokemon.get(pokemonId);
    if (activePokemon && activePokemon.currentHp > 0) {
      // Zone Magique (magic-room): a holder inside the zone has its end-of-turn item effects (Restes
      // regen, terrain seeds…) suppressed while it stands inside.
      const item = isHeldItemSuppressed(this.state, activePokemon)
        ? undefined
        : this.itemRegistry?.getForPokemon(activePokemon);
      // Tension (unnerve): a living enemy with Tension blocks end-of-turn berry consumption.
      const berryBlocked =
        item?.isBerry === true && areBerriesSuppressed(this.state, activePokemon);
      if (item?.onEndTurn && !berryBlocked) {
        const selfTypes = this.effectiveTypesOf(activePokemon);
        const itemEvents = item.onEndTurn({
          pokemon: activePokemon,
          state: this.state,
          selfTypes,
        });
        for (const event of itemEvents) {
          this.emit(event);
          events.push(event);
        }
        if (activePokemon.currentHp <= 0) {
          const koEvent: BattleEvent = {
            type: BattleEventType.PokemonKo,
            pokemonId: activePokemon.id,
            countdownStart: 0,
          };
          this.emit(koEvent);
          events.push(koEvent);
          this.handleKo(activePokemon.id, events);
        }
      }

      const ability = this.abilityRegistry?.getForPokemon(activePokemon);
      if (ability?.onEndTurn && activePokemon.currentHp > 0) {
        const abilityEvents = ability.onEndTurn({
          self: activePokemon,
          state: this.state,
          random: this.random,
          weather: this.getEffectiveWeather(),
        });
        for (const event of abilityEvents) {
          this.emit(event);
          events.push(event);
        }
      }
    }

    if (endTurnResult.pokemonFainted) {
      for (const event of endTurnResult.events) {
        if (event.type === BattleEventType.PokemonKo) {
          this.handleKo(event.pokemonId, events);
          if (this.battleOver) {
            return;
          }
        }
      }
    }

    if (!this.battleOver) {
      this.payCtActionCost(pokemonId);
      this.advanceTurn(events);
    }
  }

  private applyChargeEffects(pokemon: PokemonInstance, move: MoveDefinition): BattleEvent[] {
    if (!move.chargeEffects || move.chargeEffects.length === 0) {
      return [];
    }

    for (const effect of move.chargeEffects) {
      if ("target" in effect && effect.target !== EffectTarget.Self) {
        throw new Error(
          `chargeEffects only support EffectTarget.Self (move "${move.id}", kind "${effect.kind}")`,
        );
      }
    }

    const syntheticMove: MoveDefinition = { ...move, effects: move.chargeEffects };
    const attackerTypes = this.effectiveTypesOf(pokemon);
    const targetTypesMap = new Map<string, PokemonType[]>();
    targetTypesMap.set(pokemon.id, attackerTypes);

    return processEffects({
      attacker: pokemon,
      targets: [pokemon],
      move: syntheticMove,
      state: this.state,
      typeChart: this.typeChart,
      attackerTypes,
      targetTypesMap,
      moveTypeOf: (id) => this.moveRegistry.get(id)?.type,
      targetPosition: pokemon.position,
      random: this.random,
      heightModifier: 1,
      terrainModifier: 1,
      facingModifierMap: new Map(),
      statusRules: this.statusRules,
      abilityRegistry: this.abilityRegistry ?? undefined,
      itemRegistry: this.itemRegistry ?? undefined,
    });
  }

  private processFlinch(pokemon: PokemonInstance, events: BattleEvent[]): void {
    const flinchIndex = pokemon.volatileStatuses.findIndex((v) => v.type === StatusType.Flinch);
    if (flinchIndex === -1) {
      return;
    }
    pokemon.volatileStatuses.splice(flinchIndex, 1);
    this.flinchedThisTurn = true;

    const flinchEvent: BattleEvent = {
      type: BattleEventType.Flinched,
      pokemonId: pokemon.id,
    };
    this.emit(flinchEvent);
    events.push(flinchEvent);

    const removedEvent: BattleEvent = {
      type: BattleEventType.StatusRemoved,
      targetId: pokemon.id,
      status: StatusType.Flinch,
    };
    this.emit(removedEvent);
    events.push(removedEvent);

    const ability = this.abilityRegistry?.getForPokemon(pokemon);
    if (ability?.onFlinch && pokemon.currentHp > 0) {
      const flinchEvents = ability.onFlinch({ self: pokemon, state: this.state });
      for (const event of flinchEvents) {
        this.emit(event);
        events.push(event);
      }
    }
  }

  private processConfusion(pokemon: PokemonInstance, events: BattleEvent[]): void {
    const confusionIndex = pokemon.volatileStatuses.findIndex(
      (v) => v.type === StatusType.Confused,
    );
    if (confusionIndex === -1) {
      return;
    }

    const confusion = pokemon.volatileStatuses[confusionIndex];
    if (!confusion) {
      return;
    }
    confusion.remainingTurns--;

    if (confusion.remainingTurns <= 0) {
      pokemon.volatileStatuses.splice(confusionIndex, 1);
      const removedEvent: BattleEvent = {
        type: BattleEventType.StatusRemoved,
        targetId: pokemon.id,
        status: StatusType.Confused,
      };
      this.emit(removedEvent);
      events.push(removedEvent);
      return;
    }

    const roll = this.random();
    if (roll < 0.5) {
      this.confusedThisTurn = true;
      const triggeredEvent: BattleEvent = {
        type: BattleEventType.ConfusionTriggered,
        pokemonId: pokemon.id,
      };
      this.emit(triggeredEvent);
      events.push(triggeredEvent);
    } else {
      const resistedEvent: BattleEvent = {
        type: BattleEventType.ConfusionResisted,
        pokemonId: pokemon.id,
      };
      this.emit(resistedEvent);
      events.push(resistedEvent);
    }
  }

  getEffectiveWeather(): Weather {
    return effectiveWeather(this.state, (target) => {
      if (target.currentHp <= 0) {
        return false;
      }
      const handler = this.abilityRegistry?.getForPokemon(target);
      return handler?.suppressesWeatherEffects === true;
    });
  }

  private emitWeatherAbilityActivation(pokemonId: string, events: BattleEvent[]): void {
    const pokemon = this.state.pokemon.get(pokemonId);
    if (!pokemon || pokemon.currentHp <= 0) {
      return;
    }
    const activeWeather = this.getEffectiveWeather();
    if (activeWeather === Weather.None) {
      return;
    }
    const handler = this.abilityRegistry?.getForPokemon(pokemon);
    if (!handler) {
      return;
    }
    const matchesSpeed = handler.weatherSpeedBoost?.weather === activeWeather;
    const matchesEvasion = handler.weatherEvasionBoost?.weather === activeWeather;
    if (!matchesSpeed && !matchesEvasion) {
      return;
    }
    const event: BattleEvent = {
      type: BattleEventType.AbilityActivated,
      pokemonId: pokemon.id,
      abilityId: handler.id,
      targetIds: [],
    };
    this.emit(event);
    events.push(event);
  }

  private handleKo(pokemonId: string, events: BattleEvent[]): void {
    const pokemon = this.state.pokemon.get(pokemonId);
    if (!pokemon) {
      return;
    }

    // Sacrifice family (plan 147): resolve Lien du Destin / Rancune while the KO'd mon still carries
    // its volatiles and `lastHitBy` (both cleared below). Read the killing-blow attribution once.
    const killedBy = pokemon.lastHitBy;
    const hasDestinyBond = pokemon.volatileStatuses.some((v) => v.type === StatusType.DestinyBond);
    const hasGrudge = pokemon.volatileStatuses.some((v) => v.type === StatusType.Grudge);
    if (killedBy) {
      const killer = this.state.pokemon.get(killedBy.attackerId);
      // Rancune: permanently seal the killing move on its attacker (the attacker survives).
      if (hasGrudge && killer && killer.currentHp > 0) {
        const locked = killer.grudgeLockedMoveIds ?? [];
        if (!locked.includes(killedBy.moveId)) {
          killer.grudgeLockedMoveIds = [...locked, killedBy.moveId];
        }
        const grudgeEvent: BattleEvent = {
          type: BattleEventType.GrudgeTriggered,
          casterId: pokemonId,
          attackerId: killer.id,
          moveId: killedBy.moveId,
        };
        this.emit(grudgeEvent);
        events.push(grudgeEvent);
      }
      // Lien du Destin: drag the living killer down too (recursive KO). The "killer alive" guard also
      // prevents A↔B ping-pong: a mon already at 0 HP cannot be dragged again.
      if (hasDestinyBond && killer && killer.currentHp > 0) {
        const bondEvent: BattleEvent = {
          type: BattleEventType.DestinyBondTriggered,
          casterId: pokemonId,
          victimId: killer.id,
        };
        this.emit(bondEvent);
        events.push(bondEvent);
        killer.currentHp = 0;
        const koEvent: BattleEvent = {
          type: BattleEventType.PokemonKo,
          pokemonId: killer.id,
          countdownStart: 0,
        };
        this.emit(koEvent);
        events.push(koEvent);
        this.handleKo(killer.id, events);
      }
    }

    // Ghost clock: a KO'd mon that set environmental effects (weather / field zones) stays in the
    // CT scheduler so those durations keep counting down on its would-be turns (advanceTurn). Auras
    // (team barriers) die with their caster — removeAurasOfCaster below — so they grant no ghost.
    if (!this.hasEnvironmentalEffectSetBy(pokemonId)) {
      this.chargeTimeTurnSystem.onPokemonKO(pokemonId);
    }

    // Action clock (B3): record the faint for Retaliate ("ally fainted since my last action").
    if (this.state.lastAllyFaintAtAction === undefined) {
      this.state.lastAllyFaintAtAction = {};
    }
    this.state.lastAllyFaintAtAction[pokemon.playerId] = this.state.actionCounter ?? 0;

    pokemon.activeDefense = null;
    pokemon.chargingMove = undefined;
    pokemon.lockedMoveId = undefined;
    // Reactive-charge family (plan 150): a fresh corpse holds no pending charge reaction.
    pokemon.focusInterrupted = undefined;
    pokemon.shellTrapArmed = undefined;
    pokemon.lockInMoveId = undefined;
    pokemon.lockInTurnsRemaining = undefined;
    pokemon.pendingCalledMove = undefined;
    pokemon.substituteHp = undefined;
    pokemon.pendingWish = undefined;
    pokemon.pendingCtPenalty = undefined;
    pokemon.perishAura = undefined;
    pokemon.helpingHand = undefined;
    pokemon.critStageBoost = undefined;
    pokemon.guaranteedCritArmed = undefined;
    pokemon.typeOverride = undefined;
    pokemon.speedStatOverride = undefined;
    // Partage Garde / Stockage family (plan 162): a fresh corpse reverts to its species defenses.
    pokemon.defenseStatOverride = undefined;
    pokemon.spDefenseStatOverride = undefined;
    pokemon.stockpileCount = undefined;
    pokemon.stockpileDefBoost = undefined;
    pokemon.stockpileSpDefBoost = undefined;
    // Morphing / Imposteur (plan 157): a fresh corpse reverts to its own species identity.
    pokemon.transformState = undefined;
    // Ability-manip family (plan 153): a fresh corpse reverts to its species ability.
    pokemon.abilityIdOverride = undefined;
    pokemon.abilitySuppressed = undefined;
    pokemon.lastHitBy = undefined;
    pokemon.grudgeLockedMoveIds = undefined;
    pokemon.smackedDown = undefined;
    // Buff/statut family (plan 154): drowsiness + temporary levitation die with the mon.
    pokemon.drowsyTurns = undefined;
    pokemon.magnetRiseTurns = undefined;
    // Après Vous (plan 155): a pending CT promotion dies with the mon.
    pokemon.pendingCtPromotion = undefined;
    pokemon.volatileStatuses = [];

    for (const other of this.state.pokemon.values()) {
      const seededBefore = other.volatileStatuses.length;
      other.volatileStatuses = other.volatileStatuses.filter(
        (v) => !(v.type === StatusType.Seeded && v.sourceId === pokemonId),
      );
      if (other.volatileStatuses.length < seededBefore) {
        const removedEvent: BattleEvent = {
          type: BattleEventType.StatusRemoved,
          targetId: other.id,
          status: StatusType.Seeded,
        };
        this.emit(removedEvent);
        events.push(removedEvent);
      }
    }

    const removedAuras = removeAurasOfCaster(this.state, pokemonId);
    for (const aura of removedAuras) {
      const dissipatedEvent: BattleEvent = {
        type: BattleEventType.AuraDissipated,
        casterId: pokemonId,
        kind: aura.kind,
        reason: AuraDissipatedReason.CasterKo,
      };
      this.emit(dissipatedEvent);
      events.push(dissipatedEvent);
    }

    const eliminatedEvent: BattleEvent = {
      type: BattleEventType.PokemonEliminated,
      pokemonId,
    };
    this.emit(eliminatedEvent);
    events.push(eliminatedEvent);

    this.checkVictory(events);
  }

  private checkVictory(events: BattleEvent[]): void {
    if (this.battleOver) {
      return;
    }
    const playersAlive = new Set<string>();
    for (const pokemon of this.state.pokemon.values()) {
      if (pokemon.currentHp > 0) {
        playersAlive.add(pokemon.playerId);
      }
    }

    // size 1 → that player wins; size 0 → a mutual KO (e.g. a Requiem detonation wiping every
    // remaining mon of both sides) ends the battle as a draw (winnerId null).
    if (playersAlive.size <= 1) {
      const winnerId = playersAlive.size === 1 ? ([...playersAlive][0] as string) : null;
      this.battleOver = true;
      const endEvent: BattleEvent = {
        type: BattleEventType.BattleEnded,
        winnerId,
      };
      this.emit(endEvent);
      events.push(endEvent);
    }
  }

  private getCtGainForPokemon(pokemonId: string): number {
    const pokemon = this.state.pokemon.get(pokemonId);
    if (!pokemon) {
      return 0;
    }
    const baseStat = effectiveBaseSpeed(pokemon);
    const stages = pokemon.statStages[StatName.Speed] ?? 0;
    // Trick Room ("Distorsion"): inside a zone the tempo is reflected — feed an inverted base Speed
    // (and inverted Speed stages) through the usual curve so slow mons act first while the gain stays
    // in the normal magnitude band (no zone-wide speed-up).
    const inDistortion = isInDistortionZone(this.state, pokemon.position);
    const base = inDistortion
      ? computeCtGain(invertedDistortionSpeed(baseStat), -stages)
      : computeCtGain(baseStat, stages);
    // Vent Arrière (tailwind): a mon aligned with the wind gains ×1.5 tempo, applied AFTER the
    // Distorsion inversion so a mon both in a zone and aligned still gets the wind boost on its
    // (already inverted) gain.
    const windMultiplier = tailwindSpeedMultiplier(this.state, pokemon);
    // Zone Magique (magic-room) suppresses held-item effects while the holder stands inside it.
    const item = isHeldItemSuppressed(this.state, pokemon)
      ? undefined
      : this.itemRegistry?.getForPokemon(pokemon);
    const modifier = item?.onCtGainModify?.({ pokemon }) ?? 1.0;
    return Math.round(base * windMultiplier * modifier);
  }

  private computeCurrentMoveCost(): number {
    if (!this.turnState.hasActed || !this.turnState.lastMoveId) {
      return 0;
    }
    const move = this.moveRegistry.get(this.turnState.lastMoveId);
    if (!move) {
      return 600;
    }
    const attackerId = this.state.activePokemonId;
    const pressureBonus = computePressureBonus(
      attackerId,
      move,
      this.turnState.lastTargetIds,
      this.state,
      this.abilityRegistry,
    );
    return computeMoveCost(move.pp, move.power, move.effectTier) + pressureBonus;
  }

  private syncCtSnapshot(): void {
    if (this.chargeTimeTurnSystem) {
      this.state.ctSnapshot = this.chargeTimeTurnSystem.getCtSnapshot();
    }
  }

  predictCtTimeline(count: number, moveId?: string): CtTimelineEntry[] {
    if (count <= 0) {
      return [];
    }

    const activePokemonId = this.state.activePokemonId;
    if (!activePokemonId) {
      return [];
    }

    let actionCost: number;
    if (moveId === undefined) {
      actionCost = computeCtActionCost(this.turnState.hasMoved, false, 0);
    } else {
      const move = this.moveRegistry.get(moveId);
      const moveCost = move ? computeMoveCost(move.pp, move.power, move.effectTier) : CT_START;
      actionCost = computeCtActionCost(this.turnState.hasMoved, true, moveCost);
    }

    const ctMap = new Map<string, number>(
      Object.entries(this.chargeTimeTurnSystem.getCtSnapshot()),
    );
    const activeCt = ctMap.get(activePokemonId) ?? 0;
    ctMap.set(activePokemonId, activeCt - actionCost);

    const livePokemonIds = new Set(
      [...this.state.pokemon.values()].filter((p) => p.currentHp > 0).map((p) => p.id),
    );
    for (const id of [...ctMap.keys()]) {
      if (!livePokemonIds.has(id)) {
        ctMap.delete(id);
      }
    }

    const result: CtTimelineEntry[] = [];
    const MAX_TICKS = 10_000;
    let ticks = 0;

    while (result.length < count && ticks < MAX_TICKS) {
      let bestId: string | null = null;
      let bestCt = CT_THRESHOLD - 1;
      for (const [id, ct] of ctMap) {
        if (ct > bestCt || (ct === bestCt && bestId !== null && id < bestId)) {
          bestId = id;
          bestCt = ct;
        }
      }

      if (bestId === null) {
        for (const [id, ct] of ctMap) {
          ctMap.set(id, ct + this.getCtGainForPokemon(id));
        }
        ticks++;
      } else {
        result.push({ pokemonId: bestId, ct: ctMap.get(bestId) ?? 0 });
        const current = ctMap.get(bestId) ?? 0;
        ctMap.set(bestId, current - CT_WAIT);
      }
    }

    return result;
  }

  private advanceTurn(events: BattleEvent[]): void {
    const ctSystem = this.chargeTimeTurnSystem;

    // Après Vous (after-you, plan 155): consume any pending CT promotion before picking the next
    // actor. The just-acted caster's cost is already applied (onActionComplete ran before this), so
    // promoting the flagged ally to max+1 makes it strictly the next actor without disturbing anyone
    // else's gauge.
    for (const mon of this.state.pokemon.values()) {
      if (mon.pendingCtPromotion === true) {
        ctSystem.promoteToImmediateNext(mon.id);
        mon.pendingCtPromotion = undefined;
      }
    }

    const MAX_SKIP_ITERATIONS = 50;
    let iterations = 0;

    while (iterations < MAX_SKIP_ITERATIONS) {
      const nextPokemonId = ctSystem.getNextActorId();

      // Ghost clock: a KO'd mon still in the scheduler set persistent environmental effects
      // (weather / field zones). It never takes a turn — on its would-be turn we count its
      // durations down, pay a wait-sized CT cost, and drop it once nothing of its remains.
      const candidate = this.state.pokemon.get(nextPokemonId);
      if (candidate && candidate.currentHp <= 0) {
        this.tickGhostTurn(nextPokemonId, events);
        if (this.battleOver) {
          return;
        }
        ctSystem.onActionComplete(nextPokemonId, CT_WAIT);
        if (!this.hasEnvironmentalEffectSetBy(nextPokemonId)) {
          ctSystem.onPokemonKO(nextPokemonId);
        }
        this.syncCtSnapshot();
        iterations++;
        continue;
      }

      this.turnState = {
        hasMoved: false,
        hasActed: false,
        lastMoveId: null,
        lastTargetIds: [],
      };
      this.preMoveSnapshot = null;
      this.restrictActions = false;
      this.confusedThisTurn = false;
      this.confusionChecked = false;
      this.flinchedThisTurn = false;

      this.state.activePokemonId = nextPokemonId;
      this.syncCtSnapshot();

      this.beginActorTurn(nextPokemonId);

      const turnStarted: BattleEvent = {
        type: BattleEventType.TurnStarted,
        pokemonId: nextPokemonId,
      };
      this.emit(turnStarted);
      events.push(turnStarted);

      this.emitWeatherAbilityActivation(nextPokemonId, events);

      const startTurnResult = this.turnPipeline.executeStartTurn(nextPokemonId, this.state);
      for (const event of startTurnResult.events) {
        this.emit(event);
        events.push(event);
      }

      // Vol Magnétik (magnet-rise, plan 154): when levitation expires this start-turn, a mon left
      // standing over lava / deep water / hazards takes its tile's terrain NOW (mirror of Anti-Air),
      // so it can't use its own turn to walk off scot-free.
      for (const event of startTurnResult.events) {
        if (event.type === BattleEventType.MagnetRiseEnded) {
          const landed = this.state.pokemon.get(event.pokemonId);
          if (landed && landed.currentHp > 0 && !this.isEffectivelyFlying(landed)) {
            this.applyGroundingTerrainTick(landed, events);
            if (this.battleOver) {
              return;
            }
          }
        }
      }

      if (startTurnResult.pokemonFainted) {
        this.handleKo(nextPokemonId, events);
        if (this.battleOver) {
          return;
        }
        ctSystem.onActionComplete(nextPokemonId, CT_START);
        this.syncCtSnapshot();
        iterations++;
        continue;
      }

      if (startTurnResult.skipAction && !this.canActWhileAsleep(nextPokemonId)) {
        const skipEnded: BattleEvent = {
          type: BattleEventType.TurnEnded,
          pokemonId: nextPokemonId,
        };
        this.emit(skipEnded);
        events.push(skipEnded);

        // Action clock (B3): a skipped turn (flinch / sleep / full paralysis) still consumes the
        // actor's turn, so stamp lastActedAtAction — otherwise its "since my last action" stamps
        // would stay stale and falsely trigger Avalanche / Revenge / Assurance later.
        const skippedPokemon = this.state.pokemon.get(nextPokemonId);
        if (skippedPokemon !== undefined) {
          skippedPokemon.lastActedAtAction = this.state.actionCounter ?? 0;
        }

        const endTurnResult = this.turnPipeline.executeEndTurn(nextPokemonId, this.state);
        for (const event of endTurnResult.events) {
          this.emit(event);
          events.push(event);
        }
        if (endTurnResult.pokemonFainted) {
          for (const event of endTurnResult.events) {
            if (event.type === BattleEventType.PokemonKo) {
              this.handleKo(event.pokemonId, events);
              if (this.battleOver) {
                return;
              }
            }
          }
        }

        const skipPokemonCt = this.state.pokemon.get(nextPokemonId);
        if (skipPokemonCt && skipPokemonCt.currentHp > 0) {
          const skipAbilityCt = this.abilityRegistry?.getForPokemon(skipPokemonCt);
          if (skipAbilityCt?.onEndTurn) {
            const abilityEvents = skipAbilityCt.onEndTurn({
              self: skipPokemonCt,
              state: this.state,
              random: this.random,
              weather: this.getEffectiveWeather(),
            });
            for (const event of abilityEvents) {
              this.emit(event);
              events.push(event);
            }
          }
        }

        ctSystem.onActionComplete(nextPokemonId, CT_START);
        this.syncCtSnapshot();
        iterations++;
        continue;
      }

      if (startTurnResult.restrictActions) {
        this.restrictActions = true;
      }

      const nextPokemon = this.state.pokemon.get(nextPokemonId);
      if (nextPokemon) {
        this.processFlinch(nextPokemon, events);
        this.processConfusion(nextPokemon, events);
        this.confusionChecked = true;
      }

      break;
    }
  }

  /** Charge the acting mon's CT for the action it just completed (move / move-only / wait). */
  private payCtActionCost(pokemonId: string): void {
    const moveCost = this.computeCurrentMoveCost();
    let actionCost = computeCtActionCost(
      this.turnState.hasMoved,
      this.turnState.hasActed,
      moveCost,
    );

    // Dépit (spite): consume the one-shot CT tax on this mon's next completed action.
    const pokemon = this.state.pokemon.get(pokemonId);
    if (pokemon?.pendingCtPenalty !== undefined) {
      actionCost += pokemon.pendingCtPenalty;
      pokemon.pendingCtPenalty = undefined;
    }

    this.chargeTimeTurnSystem.onActionComplete(pokemonId, actionCost);
    this.syncCtSnapshot();
  }

  /** True when this mon set an environmental effect still alive (weather it set, or a field zone). */
  private hasEnvironmentalEffectSetBy(pokemonId: string): boolean {
    const ownsWeather =
      this.state.weather !== Weather.None &&
      this.state.weatherTurnsRemaining > 0 &&
      this.state.weatherSetterPokemonId === pokemonId;
    const ownsField = this.state.fieldTerrains.some((zone) => zone.casterId === pokemonId);
    const ownsDistortion = this.state.distortionZones.some((zone) => zone.casterId === pokemonId);
    const ownsFieldGlobal = this.state.fieldGlobalZones.some((zone) => zone.casterId === pokemonId);
    const ownsTailwind = this.state.tailwind?.setterPokemonId === pokemonId;
    const ownsPendingStrike = this.state.pendingStrikes.some(
      (strike) => strike.casterId === pokemonId,
    );
    return (
      ownsWeather ||
      ownsField ||
      ownsDistortion ||
      ownsFieldGlobal ||
      ownsTailwind ||
      ownsPendingStrike
    );
  }

  /**
   * Resolves Prescience (future-sight) strikes owned by `pokemonId` on its turn (live or ghost):
   * counts each down by one and lands those reaching 0 as an AoE around the locked tile. Mutates HP
   * (done in the system), emits the strike + KO events, and runs KO cleanup. Returns early if the
   * battle ends from a landing KO.
   */
  private resolveFutureSightStrikes(pokemonId: string, events: BattleEvent[]): void {
    const landings = tickFutureSightStrikesForCaster(this.state, pokemonId, {
      typeChart: this.typeChart,
      pokemonTypesMap: this.pokemonTypesMap,
      random: this.random,
    });
    for (const landing of landings) {
      const struck: BattleEvent = {
        type: BattleEventType.FutureSightStruck,
        casterId: landing.strike.casterId,
        tile: landing.strike.centerPosition,
        hits: landing.hits.map((hit) => ({
          pokemonId: hit.pokemonId,
          damage: hit.damage,
          fainted: hit.fainted,
        })),
      };
      this.emit(struck);
      events.push(struck);
      for (const hit of landing.hits) {
        if (!hit.fainted) {
          continue;
        }
        const koEvent: BattleEvent = {
          type: BattleEventType.PokemonKo,
          pokemonId: hit.pokemonId,
          countdownStart: 0,
        };
        this.emit(koEvent);
        events.push(koEvent);
        this.handleKo(hit.pokemonId, events);
        if (this.battleOver) {
          return;
        }
      }
    }
  }

  /**
   * Ghost turn (post-KO setter): count down the weather it set and the field zones it owns, emitting
   * the same expiry events the live pipeline would. Auras are never ghosted — they died at KO.
   */
  private tickGhostTurn(pokemonId: string, events: BattleEvent[]): void {
    if (this.state.weather !== Weather.None && this.state.weatherSetterPokemonId === pokemonId) {
      for (const event of decrementWeatherTimer(this.state)) {
        this.emit(event);
        events.push(event);
      }
    }
    for (const entry of decrementFieldTerrainsTimer(this.state, pokemonId)) {
      const event: BattleEvent = {
        type: BattleEventType.FieldTerrainExpired,
        casterId: entry.casterId,
        kind: entry.kind,
      };
      this.emit(event);
      events.push(event);
    }
    for (const entry of decrementDistortionTimer(this.state, pokemonId)) {
      const event: BattleEvent = {
        type: BattleEventType.DistortionExpired,
        casterId: entry.casterId,
      };
      this.emit(event);
      events.push(event);
    }
    // Prescience strikes owned by a KO'd caster keep landing on the caster's ghost turns.
    this.resolveFutureSightStrikes(pokemonId, events);
  }

  private applyChoiceLock(pokemon: PokemonInstance, moveId: string): void {
    if (pokemon.lockedMoveId !== undefined) {
      return;
    }
    const item = this.itemRegistry?.getForPokemon(pokemon);
    if (item?.onMoveLock?.()) {
      pokemon.lockedMoveId = moveId;
    }
  }
}
