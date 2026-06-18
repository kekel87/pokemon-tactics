import type { Direction } from "@pokemon-tactic/core";
import type { HighlightKind } from "./highlight-kind.js";
import type {
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
    options?: { isFlying?: boolean; isGhost?: boolean },
  ): Promise<void>;
  playAttack(direction: Direction, animationName: string): Promise<void>;
  impactGlide(tile: { x: number; y: number }, options?: { hurt?: boolean }): Promise<void>;
  impactShake(): Promise<void>;
  setActive(active: boolean): void;
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
  setAuraGroundIcons(cells: readonly { x: number; y: number }[], symbols: readonly string[]): void;
  clearHighlights(): void;
  addPokemon(entry: CombatSceneSpawn): CombatPokemonHandle;
  removePokemon(handle: CombatPokemonHandle): void;
  showDirectionPicker(
    tile: { x: number; y: number },
    initialDirection: Direction,
    callbacks: DirectionPickerCallbacks,
  ): DirectionPickerHandle;
  onTileHover(handler: (pick: TilePick | null) => void): void;
  onTileClick(handler: (pick: TilePick) => void): void;
  panCameraTo(tile: { x: number; y: number }): void;
  spawnFloatingText(
    tile: { x: number; y: number },
    text: string,
    color: string,
    options?: { delayMs?: number; secondary?: boolean },
  ): void;
  dispose(): void;
}
