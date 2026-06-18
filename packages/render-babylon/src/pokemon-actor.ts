import type { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { SemiInvulnerableDisplay } from "@pokemon-tactic/view-core";

/**
 * The visual contract `combat-scene` drives for one on-field Pokémon, regardless of
 * how it is rendered. `DirectionalBillboard` (PMD 2D sprites) is the production
 * implementation; `GlbPokemonActor` (Cobblemon 3D models) is the POC alternative
 * (plan 129, temps 2). Keeping the seam an interface is what lets the renderer swap
 * art directions without touching the combat loop — and lets the POC be thrown away
 * by deleting one branch in `createBillboard`.
 */
export interface PokemonActor {
  /** Scene node positioned on the tile-top centre; HUD + cursor anchor to it. */
  readonly root: TransformNode;
  /** Live world facing (radians) shared with the cursor/highlight code. */
  readonly worldFacing: { value: number };

  /** Resolves once the model/atlas is loaded (head offset becomes real). */
  load(): Promise<void>;
  /** Per-frame tick: advance animation, keep facing, depth-sort. */
  update(deltaMs: number, cameraAzimuth: number, viewProjection: Matrix): void;

  setWorldFacing(angleRadians: number): void;
  setAnimation(animation: string): void;
  setRestingAnimation(animation: string): void;
  playOnce(animation: string, options?: { freeze?: boolean; onComplete?: () => void }): void;
  playFirstAvailable(candidates: readonly string[], fallback: string): string;
  hasAnimation(animation: string): boolean;
  animationDurationMs(animation: string): number;

  setActive(active: boolean): void;
  setKnockedOut(knockedOut: boolean): void;
  setSubstitute(active: boolean): Promise<void>;
  flashDamage(): void;
  setPreviewFlash(active: boolean): void;
  setConfusionWobble(active: boolean): void;
  setSemiInvulnerable(state: SemiInvulnerableDisplay): void;
  setAttacking(active: boolean): void;

  /** Y offset (world units) from root to the model's top, for HUD anchoring. */
  readonly spriteTopOffsetY: number;
  dispose(): void;
}
