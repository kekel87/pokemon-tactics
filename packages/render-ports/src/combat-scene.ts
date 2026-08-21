import type { Direction } from "@pokemon-tactic/core";
import type { HighlightKind } from "./highlight-kind.js";
import type {
  AuraRingSpec,
  DirectionPickerCallbacks,
  DirectionPickerHandle,
  SemiInvulnerableDisplay,
} from "./ports.js";

/**
 * Engine-agnostic combat-scene contract (plan 126 lot F1). Every renderer backend
 * (Babylon, Three, …) implements `CombatScene` + `CombatPokemonHandle`; the app-shell
 * and presentation talk to these neutral interfaces, never to a specific engine's
 * types. The factory `options` (which carry a DOM `HTMLCanvasElement`) stay in each
 * renderer so this contract package remains DOM-free.
 */

/** A picked tile (grid coordinate under the pointer). */
export interface TilePick {
  readonly x: number;
  readonly y: number;
}

/**
 * Where an arrow / d-pad press points **on screen** (plan 184) — never a grid direction.
 *
 * The iso camera snaps between 4 azimuths, so "up" means "the top of the screen" and the grid axis
 * it lands on changes with the rotation. Translating this into a grid step is the renderer's job:
 * it is the only side that knows the current azimuth and the projection.
 */
export type ScreenDirection = "up" | "down" | "left" | "right";

/** A grid cell referenced by a highlight / outline / field-terrain. */
export interface TileHighlightPosition {
  readonly x: number;
  readonly y: number;
}

/** One team's spawn zone, painted with its own colour/alpha (placement phase). */
export interface SpawnZoneHighlight {
  readonly positions: readonly TileHighlightPosition[];
  readonly color: number;
  readonly alpha: number;
}

/** A painted field-terrain ("Champs") zone + its counter pill. */
export interface FieldTerrainSpec {
  /** Every tile inside the zone (Manhattan diamond, already clipped to the grid). */
  readonly tiles: readonly TileHighlightPosition[];
  /** Where the timer pill sits (the setter's target tile). */
  readonly anchor: TileHighlightPosition;
  /** Zone identity colour (which Champ) — fill + perimeter. */
  readonly color: number;
  /** Owning team colour — pill background, so the player can tell whose Champ it is. */
  readonly teamColor: number;
  /** Turns left, shown in the pill. */
  readonly remainingTurns: number;
}

/** An entry-hazard voxel prop on a tile (plan 131): cumulative GLB models per kind + layer count. */
export interface EntryHazardSpec {
  readonly kind: string;
  readonly tile: { x: number; y: number };
  readonly layers: number;
}

/** A team-aura icon stacked to the left of the HP bar. */
export interface AuraIndicatorSpec {
  readonly id: string;
  readonly symbol: string;
  /** Dimmed for a protected ally that is not the caster (caster = 1). */
  readonly alpha?: number;
}

/** A predicted-damage overlay on a target's HP bar (confirm phase). */
export interface DamageEstimateView {
  /** Minimum predicted damage (the guaranteed loss). */
  readonly min: number;
  /** Maximum predicted damage (the possible loss). */
  readonly max: number;
  /** Pre-formatted text (range + facing suffix, or "no effect"); empty = no label. */
  readonly label: string;
  /** No-effect (immunity): greys the label, no band. */
  readonly immune: boolean;
}

/** A Pokemon to spawn on the board at a grid cell, optionally facing a direction. */
/**
 * Which device produced a tile press (plan 183). A finger has no hover, so aiming a directional
 * pattern needs a preview tap before it commits — a mouse already previewed on the way in.
 */
export type TilePointerSource = "pointer" | "touch";

export interface CombatSceneSpawn {
  pokemonId: string;
  spawn: { x: number; y: number };
  /** World facing in radians (default 0 = South-ish). 8-way display is muxed against the camera azimuth. */
  facing?: number;
  /** 1-based team/player number — drives the X-ray silhouette colour. */
  team?: number;
}

/** A Pokemon billboard on the board (added during placement). */
export interface CombatPokemonHandle {
  setFacing(direction: Direction): void;
  moveTo(tile: { x: number; y: number }): void;
  moveAlongPath(
    path: readonly { x: number; y: number }[],
    options?: {
      isFlying?: boolean;
      isGhost?: boolean;
      onTileReached?: (tile: { x: number; y: number }) => void;
    },
  ): Promise<void>;
  playAttack(direction: Direction, animationName: string): Promise<void>;
  impactGlide(tile: { x: number; y: number }, options?: { hurt?: boolean }): Promise<void>;
  impactShake(): Promise<void>;
  setActive(active: boolean): void;
  /** Gravité: land a flyer (grounded → ground idle) or let it float again (Vol/Lévitation). */
  setGroundedByGravity(grounded: boolean): void;
  flashDamage(): void;
  setPreviewFlash(active: boolean): void;
  setConfusionWobble(active: boolean): void;
  updateHp(currentHp: number, maxHp: number): void;
  updateStatus(statusType: string | null): void;
  showDamageEstimate(estimate: DamageEstimateView | null): void;
  setLeftIndicators(specs: readonly AuraIndicatorSpec[]): void;
  setKnockedOut(knockedOut: boolean): void;
  setSemiInvulnerable(state: SemiInvulnerableDisplay): void;
  playOnce(animation: string): void;
  setSubstitute(active: boolean): void;
  /** Morphing / Imposteur (plan 157): swap the displayed sprite to another species. */
  setSpecies(definitionId: string): void;
  setHudVisible(visible: boolean): void;
  koAnimationDurationMs(): number;
  /** Real ms of a Pokémon's Hurt reaction pose, to let it finish before a lethal Faint. */
  hurtAnimationDurationMs(): number;
}

/** The in-engine combat board: terrain, highlights, sprites, picking, camera. */
export interface CombatScene {
  /** Resolves once the map (terrain, heights) is loaded — required before `addPokemon`. */
  readonly ready: Promise<void>;
  /** Resolves once the map AND every sprite added so far have loaded — for the loading overlay
   *  to fade only on a paintable scene (call after the initial spawns are placed). */
  whenReady(): Promise<void>;
  setTileHighlights(kind: HighlightKind, positions: readonly TileHighlightPosition[]): void;
  setSpawnZoneHighlights(zones: readonly SpawnZoneHighlight[]): void;
  setTileOutline(positions: readonly TileHighlightPosition[], beneficial?: boolean): void;
  setFieldTerrains(specs: readonly FieldTerrainSpec[]): void;
  /** Distorsion (Trick Room) zones — same spec shape as field terrains, distinct colour. */
  setDistortionZones(specs: readonly FieldTerrainSpec[]): void;
  /** Entry-hazard voxel props (plan 131): stacked GLB models per kind + layer count (empty clears). */
  setEntryHazards(specs: readonly EntryHazardSpec[]): void;
  /** Permanent ground rings outlining each active aura zone (plan 182; empty clears). */
  setAuraRings(rings: readonly AuraRingSpec[]): void;
  clearHighlights(): void;
  addPokemon(entry: CombatSceneSpawn): CombatPokemonHandle;
  removePokemon(handle: CombatPokemonHandle): void;
  showDirectionPicker(
    tile: { x: number; y: number },
    initialDirection: Direction,
    callbacks: DirectionPickerCallbacks,
  ): DirectionPickerHandle;
  onTileHover(handler: (pick: TilePick | null) => void): void;
  onTileClick(handler: (pick: TilePick, source: TilePointerSource) => void): void;

  // --- Input primitives (plan 184) -------------------------------------------------------------
  // The gesture RULES (tap vs drag, pinch, two-step aiming) live in the app's input layer; what
  // stays here is what genuinely needs the scene: picking, projection, the camera and the picker's
  // rendering. These are the seam between the two.

  /** Tile under a canvas-relative point, or null (nothing there, or the map is still loading). */
  pickTileAt(canvasX: number, canvasY: number): TilePick | null;
  /** Is that canvas point on the compass control? It sits over the board and must win the press. */
  isCompassHitAt(canvasX: number, canvasY: number): boolean;
  /** Paint the tile cursor and emit `onTileHover` — the mouse-hover path, reused by touch and keys. */
  setCursor(pick: TilePick | null): void;
  /**
   * Paint the tile cursor WITHOUT notifying the host (plan 184). Used to park it on the caster while
   * a direction is being aimed: the rotation must read as turning around the Pokémon, and emitting a
   * hover on his own tile would re-aim the very fan being aimed.
   */
  pinCursor(pick: TilePick | null): void;
  /** Emit `onTileClick`: the app decided this gesture is a press on that tile. */
  dispatchTileClick(pick: TilePick, source: TilePointerSource): void;
  /** Facing an open picker currently shows, or null when none is open. */
  directionPickerFacing(): Direction | null;
  /** Which facing a canvas point means for the open picker (whole-screen hit area), or null. */
  aimDirectionPickerAt(canvasX: number, canvasY: number): Direction | null;
  /** Show a facing on the open picker without committing it. */
  previewDirectionPickerFacing(direction: Direction): void;
  /** Commit a facing on the open picker. */
  confirmDirectionPickerFacing(direction: Direction): void;
  /** Pan the camera by a pointer-drag delta, in canvas pixels. */
  panCameraByPixels(deltaX: number, deltaY: number): void;
  /**
   * Step the tile cursor one tile toward a SCREEN direction (plan 184), clamped to the grid, and
   * emit the matching `onTileHover` — the very path the mouse hover takes, so the info panels, the
   * tile panel and the damage forecast follow a keyboard cursor for free.
   *
   * Only the cursor: aiming a facing or a directional fan is decided by the caller, which knows the
   * phase (`aimDirectionPicker`, `gridDirectionFrom`).
   */
  moveCursor(direction: ScreenDirection): void;
  /**
   * Aim an OPEN facing picker toward a screen direction, reporting whether there was one. The arrows
   * must aim it rather than walk the cursor: that phase is answered by the picker alone.
   */
  aimDirectionPicker(direction: ScreenDirection): boolean;
  /**
   * Grid direction a screen direction means, measured from a tile — the projection-based conversion,
   * exposed for the callers that aim something other than the cursor (a directional attack fan).
   */
  gridDirectionFrom(center: { x: number; y: number }, direction: ScreenDirection): Direction | null;
  /** Tile the cursor currently rests on — what Confirm validates. */
  cursorTile(): TilePick | null;
  /**
   * Tile the camera is centred on — the active Pokémon, since the orchestrator recentres on it every
   * turn. Where a keyboard cursor should (re)start from.
   */
  cameraFocusTile(): TilePick | null;
  /**
   * Commit the facing an open direction picker currently shows, reporting whether there was one.
   *
   * Confirm has to offer it to the picker FIRST: the facing choice (end of turn, and every placement)
   * is answered by the picker alone — `onTileClick` has no case for that phase — so without this a
   * keyboard or gamepad could open it and never answer it.
   */
  confirmDirectionPicker(): boolean;
  /** One quarter turn (`-1` left, `1` right): the iso view has exactly 4 azimuths. */
  rotateCamera(step: -1 | 1): void;
  /** Step one notch of the discrete zoom (`1` closer, `-1` further). */
  zoomCamera(step: -1 | 1): void;
  /** Jump straight to a zoom notch (the `1`/`2`/`3` keys); the index is clamped in range. */
  setZoomLevel(index: number): void;
  /**
   * Cancel an open direction picker, reporting whether there was one. Lets the input layer offer the
   * picker the Cancel action first and fall back to the phase-level cancel — the explicit
   * arbitration that replaced a `stopImmediatePropagation()` (plan 184).
   */
  cancelDirectionPicker(): boolean;
  /** Notified with the camera azimuth (radians) whenever the iso view rotates (←/→ snap + ease). */
  onCameraRotated(handler: (azimuth: number) => void): void;
  panCameraTo(tile: { x: number; y: number }): void;
  spawnFloatingText(
    tile: { x: number; y: number },
    text: string,
    color: string,
    options?: { delayMs?: number; secondary?: boolean },
  ): void;
  dispose(): void;
}
