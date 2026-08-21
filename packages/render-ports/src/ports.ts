import type {
  AuraKind,
  BattleEvent,
  Direction,
  MoveDefinition,
  Position,
  SemiInvulnerableDisplay,
} from "@pokemon-tactic/core";
import type {
  InfoPanelData,
  TailwindView,
  TileInfoChip,
  TileInfoData,
  TimelineView,
  WeatherView,
} from "./view-models.js";

/**
 * Render-backend ports (plan 125). The presentation layer (orchestrator) drives
 * these imperatively; each backend (Babylon, …) implements them as a humble
 * object that only renders. No backend imports the orchestrator — only this
 * contract.
 */

/** Which highlight layer the board should paint (mapped to the renderer's HighlightKind by the adapter). */
export type BoardHighlight = "move" | "attack" | "retreat" | "enemy";

/** Attack-target preview layer: buff (blue), attack (red), heal (green), dash trail (yellow), or blast intercept (orange). */
export type AttackPreviewKind = "buff" | "attack" | "heal" | "dash" | "blast";

/** Semi-invulnerable display lives in core; re-exported so port consumers keep importing it here. */
export type { SemiInvulnerableDisplay };

/** Callbacks for the in-engine direction picker (reuses the placement voxel arrows, décision #487). */
export interface DirectionPickerCallbacks {
  onPreview: (direction: Direction) => void;
  onConfirm: (direction: Direction) => void;
  onCancel: () => void;
}

/** Handle to an open direction picker; `dispose` tears it down without firing callbacks. */
export interface DirectionPickerHandle {
  dispose(): void;
}

/** A predicted-damage overlay for one target during the confirm phase. */
export interface BoardDamageEstimate {
  readonly pokemonId: string;
  /** Minimum predicted damage (guaranteed loss). */
  readonly min: number;
  /** Maximum predicted damage (possible loss). */
  readonly max: number;
  /** Pre-formatted text (range + facing suffix, or "no effect"); empty = no label. */
  readonly label: string;
  /** No-effect (immunity): greys the label, no band. */
  readonly immune: boolean;
}

/** One painted field-terrain ("Champs") zone for the board (tiles + timer pill). */
export interface BoardFieldTerrain {
  readonly tiles: readonly Position[];
  readonly anchor: Position;
  /** Zone identity colour (which Champ) — fill + perimeter. */
  readonly color: number;
  /** Owning team colour — pill background. */
  readonly teamColor: number;
  readonly remainingTurns: number;
}

/** An entry-hazard voxel prop on a tile (plan 131): one stacked model set per kind + layer count. */
export interface BoardEntryHazard {
  readonly kind: string;
  readonly tile: Position;
  /** Stacked layers (drives how many cumulative voxel models to show). */
  readonly layers: number;
}

/**
 * Which aura a ground ring draws. Wider than `AuraKind`: Requiem lives on
 * `pokemon.perishAura` and Brouhaha on a lock-in move id, so neither has an
 * `AuraKind` to key off.
 */
export type AuraRingKind = AuraKind | "perish-aura" | "uproar";

/** One aura zone drawn as a stair-stepped voxel outline on the ground (plan 182). */
export interface AuraRingSpec {
  /** Stable across frames — `${kind}:${casterPokemonId}`. */
  readonly id: string;
  readonly kind: AuraRingKind;
  readonly casterPokemonId: string;
  /** Every tile inside the zone (Manhattan diamond, already clipped to the grid). */
  readonly tiles: readonly Position[];
  /** Aura identity colour — continues the emoji shown on the HP bar. */
  readonly color: number;
  /** 0-based height in the stack of rings sharing this caster (lift = (index + 1) × pitch). */
  readonly stackIndex: number;
}

/** A team-aura icon shown left of a Pokémon's HP bar (caster + protected allies). */
export interface BoardAuraIndicator {
  readonly id: string;
  readonly symbol: string;
  /** Dimmed for a protected ally that is not the caster. */
  readonly alpha?: number;
}

/** World-anchored rendering port (impl: Babylon combat scene). */
export interface BoardView {
  setHighlights(kind: BoardHighlight, tiles: readonly Position[]): void;
  /** Replace the range outline; `beneficial` paints it blue (ally/self moves) instead of red. */
  setOutline(tiles: readonly Position[], beneficial?: boolean): void;
  clearHighlights(): void;
  /** Paint an attack-target preview layer (affected tiles for the hovered/locked target). */
  showPreview(kind: AttackPreviewKind, tiles: readonly Position[]): void;
  /** Clear all attack-target preview layers (leaves the range highlights intact). */
  clearPreview(): void;
  /** Snap a Pokémon's billboard to a tile (re-sync / non-walk relocations). */
  moveTo(pokemonId: string, tile: Position): void;
  /** Glide a Pokémon along a path of tiles (per-step Walk/Hop + flyer glide), resolving once it lands. */
  moveAlongPath(
    pokemonId: string,
    path: readonly Position[],
    options: {
      isFlying: boolean;
      isGhost: boolean;
      /** Fired as the sprite arrives on each path tile — used to tick entry hazards per tile. */
      onTileReached?: (tile: Position) => void;
    },
  ): Promise<void>;
  setFacing(pokemonId: string, direction: Direction): void;
  /** Face a direction and play a one-shot attack animation, resolving when it ends. */
  playAttack(pokemonId: string, direction: Direction, animationName: string): Promise<void>;
  /** Glide a Pokémon to a tile without changing facing (knockback / ice-slide). */
  impactGlide(pokemonId: string, tile: Position, options?: { hurt?: boolean }): Promise<void>;
  /** Hurt pose + brief shake (knockback blocked), resolving when it ends. */
  impactShake(pokemonId: string): Promise<void>;
  /** Mark the current actor (breathing pulse); null clears it. */
  setActive(pokemonId: string | null): void;
  /** Gravité: land a flyer (grounded) or restore its float (Vol/Lévitation). */
  setGroundedByGravity(pokemonId: string, grounded: boolean): void;
  flashDamage(pokemonId: string): void;
  /** Replace the set of Pokémon flashing as locked attack targets (empty clears). */
  setPreviewFlash(pokemonIds: readonly string[]): void;
  /** Replace the predicted-damage overlays shown during the confirm phase (empty clears). */
  setDamageEstimates(estimates: readonly BoardDamageEstimate[]): void;
  /** Update a Pokémon's world HP bar fill. */
  updateHp(pokemonId: string, currentHp: number, maxHp: number): void;
  /** Show a Pokémon's major status icon over its sprite, or clear it when null. */
  updateStatus(pokemonId: string, statusType: string | null): void;
  /** Roll a Pokémon's sprite while it is confused (volatile), upright when cleared. */
  setConfusionWobble(pokemonId: string, active: boolean): void;
  setKnockedOut(pokemonId: string, knockedOut: boolean): void;
  setSemiInvulnerable(pokemonId: string, state: SemiInvulnerableDisplay): void;
  /** Clonage (substitute): show the dummy doll while the volatile is up, real sprite when broken. */
  setSubstitute(pokemonId: string, active: boolean): void;
  /** Morphing / Imposteur (plan 157): swap a Pokémon's sprite to another species. */
  setSpecies(pokemonId: string, definitionId: string): void;
  /** Show/hide a Pokémon's world HUD (HP bar + status), e.g. hidden during direction selection. */
  setHudVisible(pokemonId: string, visible: boolean): void;
  /** Real ms of a Pokémon's Faint animation, to pace the KO beat on its full length. */
  koAnimationDurationMs(pokemonId: string): number;
  /** Real ms of a Pokémon's Hurt reaction pose, to let it finish before a lethal Faint. */
  hurtAnimationDurationMs(pokemonId: string): number;
  /** Replace the painted field-terrain ("Champs") zones (empty clears). */
  setFieldTerrains(zones: readonly BoardFieldTerrain[]): void;
  /** Replace the painted Distorsion (Trick Room) zones (empty clears). */
  setDistortionZones(zones: readonly BoardFieldTerrain[]): void;
  /** Replace the entry-hazard voxel props (empty clears). */
  setEntryHazards(hazards: readonly BoardEntryHazard[]): void;
  /** Replace a Pokémon's team-aura icons (left of its HP bar; empty clears). */
  setAuraIndicators(pokemonId: string, indicators: readonly BoardAuraIndicator[]): void;
  /** Replace the permanent ground rings outlining every active aura zone (empty clears). */
  setAuraRings(rings: readonly AuraRingSpec[]): void;
  panCameraTo(tile: Position): void;
  showDirectionPicker(
    center: Position,
    initial: Direction,
    callbacks: DirectionPickerCallbacks,
  ): DirectionPickerHandle;
}

export interface ActionMenuView {
  canMove: boolean;
  canAct: boolean;
  canUndoMove: boolean;
  onMove: () => void;
  onAttack: () => void;
  onWait: () => void;
  onUndoMove: () => void;
}

/** Why a move can't be picked this turn (semantic — the chrome localises it). */
export type BlockedMoveTag = "taunt" | "disable" | "encore";

/** One move row in the attack submenu (all of the actor's moves, greyed when unusable). */
export interface AttackSubmenuMoveView {
  definition: MoveDefinition;
  hasTargets: boolean;
  /** Charge Time "tempo" rating 1..CT_TEMPO_MAX (heavier = the user waits longer before acting again). */
  costTempo: number;
  /**
   * Charge Time cost in raw CT (plan 178): the exact figure the 5-step `costTempo` gauge compresses,
   * so two moves sharing a tempo rating stay comparable. Base cost only — the Pression surcharge is
   * per-target (`computePressureBonus`) and no target is picked yet at submenu time.
   */
  ctCost: number;
  /**
   * Secondary-effect chip (plan 178) — built by the shared `buildSecondaryEffectChip`, the same
   * builder the confirm-phase forecast uses, so the tooltip cannot drift from it. Null when the move
   * carries no chance-based side effect. Passed as a view-model fragment rather than rebuilt in the
   * chrome, which has no status-icon resolver of its own.
   */
  effectChip: TileInfoChip | null;
  blockedTag?: BlockedMoveTag;
}

export interface AttackSubmenuView {
  moves: readonly AttackSubmenuMoveView[];
  onSelect: (moveId: string) => void;
  onCancel: () => void;
}

/** The locked-in move shown while picking a target/retreat tile. */
export interface SelectedMoveView {
  definition: MoveDefinition;
  /**
   * Move-copy (plan 144): hide the move's identity (Métronome / Blabla Dodo rolled a random move).
   * The chrome shows "???" and no type icon — only the board pattern is revealed.
   */
  masked?: boolean;
  /**
   * Back out of this phase (plan 183). Same handler Escape drives; the chrome renders it as the
   * Cancel button the attack submenu already had, which is the only way back on a touch screen.
   */
  onCancel: () => void;
}

export interface TurnInfoView {
  activePokemonId: string;
  playerId: string;
}

/**
 * Semantic instruction the chrome localises (keeps the FSM free of i18n key strings).
 *
 * `selectMoveDestination` / `selectDirection` joined at plan 183: those two phases used to blank the
 * chrome entirely, which left a touch player with no visible way back (Escape does not exist on a
 * finger). They now show an instruction plus a Cancel button like every other phase.
 */
export type BattleInstruction =
  | "selectTarget"
  /** Cône/ligne/fauche/charge : on vise une DIRECTION, pas une case — dire « cible » induisait en erreur. */
  | "aimDirection"
  | "confirm"
  | "selectRetreat"
  | "selectMoveDestination"
  | "selectDirection";

/** Screen-anchored chrome port (impl: minimal DOM 4a; final panels 4b). */
export interface BattleChrome {
  showActionMenu(view: ActionMenuView): void;
  showAttackSubmenu(view: AttackSubmenuView): void;
  showSelectedMove(move: SelectedMoveView, instruction: BattleInstruction): void;
  updateInstruction(instruction: BattleInstruction): void;
  /**
   * Instruction line + Cancel button for a phase with no move to show (plan 183): picking a movement
   * destination, or a facing. These two used to call `hideMenus`, leaving nothing on screen at all.
   */
  showCancellableInstruction(instruction: BattleInstruction, onCancel: () => void): void;
  hideMenus(): void;
  updateTurnInfo(info: TurnInfoView): void;
  /**
   * Left panel: the ACTIVE Pokémon, and only it (human 2026-07-25 — hovering another mon no longer
   * hijacks this card; that readout moved to the cursor card).
   */
  updateInfoPanel(view: InfoPanelData | null): void;
  /**
   * Cursor card (plan 175): the Pokémon under the cursor, and during a confirm the focused target
   * with its forecast (`InfoPanelData.preview`). Same component as the left panel by design.
   */
  updateCursorPanel(view: InfoPanelData | null): void;
  /** Set the tile-info panel to the hovered/active tile's terrain + modifiers (null clears it). */
  updateTileInfo(view: TileInfoData | null): void;
  /** Set the weather HUD (null hides it). */
  updateWeather(view: WeatherView | null): void;
  /** Set the Vent Arrière (tailwind) HUD (null hides it). */
  updateTailwind(view: TailwindView | null): void;
  /** Push the live camera azimuth (radians) so direction indicators rotate with the iso view. */
  updateCameraAzimuth(azimuth: number): void;
  /** Refresh the turn timeline (active + predicted order). */
  updateTimeline(view: TimelineView): void;
  /**
   * Walk the focus through the buttons of the menu currently on screen (plan 184): the keyboard and
   * gamepad equivalent of moving the mouse over them. Skips disabled entries.
   */
  focusMenuStep(delta: 1 | -1): void;
  /**
   * Does the menu currently hold the focus? Lets the input layer leave Space / Enter to the
   * browser's own activation of a focused button instead of claiming the key.
   */
  isMenuFocused(): boolean;
  /**
   * Activate the focused menu entry, reporting whether there was one — for a GAMEPAD, where no
   * native activation follows: a pad press is not a keyboard event, so nothing would happen at all
   * (retour humain 2026-08-21, manette Switch Pro).
   */
  activateFocusedMenuItem(): boolean;
  /** Step the timeline's predicted-order list (it only scrolled by wheel before plan 184). */
  scrollTimeline(delta: 1 | -1): void;
  showVictory(winnerId: string | null): void;
}

/** Feedback port. 7b: no-op + console.debug; engine billboards (text) + DOM log land at 4c. */
export interface BattleFeedback {
  report(event: BattleEvent): void;
}

export interface BattleOrchestratorConfig {
  /** Insert a confirm step between target selection and execution (parity default). */
  confirmAttack: boolean;
  /**
   * Player ids a human drives (plan 176). The fog needs the identity of the VIEWER, not of the actor:
   * the panels follow the acting player while they are human (hotseat), and stay on the human's side
   * during an AI turn — otherwise every enemy turn would render the enemy as an "ally" and print in
   * clear exactly what the fog withholds. Empty/omitted → the actor is the viewer (legacy behaviour).
   */
  humanPlayerIds?: readonly string[];
  /**
   * Fired whenever the engine's action log has grown — after a human action is accepted, and after the
   * AI hook returns (the AI submits its own actions). The host uses it to persist the battle so a
   * reload can resume it (plan 181); the orchestrator itself knows nothing of storage.
   */
  onActionCommitted?: () => void;
}
