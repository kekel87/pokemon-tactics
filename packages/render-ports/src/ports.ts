import type {
  BattleEvent,
  Direction,
  MoveDefinition,
  Position,
  SemiInvulnerableDisplay,
} from "@pokemon-tactic/core";
import type { InfoPanelData, TimelineView, WeatherView } from "./view-models.js";

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
  /** Float aura symbols over a caster's aura-radius tiles on hover (empty clears). */
  setAuraGroundIcons(cells: readonly Position[], symbols: readonly string[]): void;
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
}

export interface TurnInfoView {
  activePokemonId: string;
  playerId: string;
}

/** Semantic instruction the chrome localises (keeps the FSM free of i18n key strings). */
export type BattleInstruction = "selectTarget" | "confirm" | "selectRetreat";

/** Screen-anchored chrome port (impl: minimal DOM 4a; final panels 4b). */
export interface BattleChrome {
  showActionMenu(view: ActionMenuView): void;
  showAttackSubmenu(view: AttackSubmenuView): void;
  showSelectedMove(move: SelectedMoveView, instruction: BattleInstruction): void;
  updateInstruction(instruction: BattleInstruction): void;
  hideMenus(): void;
  updateTurnInfo(info: TurnInfoView): void;
  /** Set the info panel to the hovered/active Pokémon (null clears it). */
  updateInfoPanel(view: InfoPanelData | null): void;
  /** Set the weather HUD (null hides it). */
  updateWeather(view: WeatherView | null): void;
  /** Refresh the turn timeline (active + predicted order). */
  updateTimeline(view: TimelineView): void;
  showVictory(winnerId: string | null): void;
}

/** Feedback port. 7b: no-op + console.debug; engine billboards (text) + DOM log land at 4c. */
export interface BattleFeedback {
  report(event: BattleEvent): void;
}

export interface BattleOrchestratorConfig {
  /** Insert a confirm step between target selection and execution (parity default). */
  confirmAttack: boolean;
}
