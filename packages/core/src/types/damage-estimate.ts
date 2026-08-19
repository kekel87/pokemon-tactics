import type { PokemonType } from "../enums/pokemon-type";

export interface DamageEstimate {
  readonly min: number;
  readonly max: number;
  readonly effectiveness: number;
  readonly facingModifier: number;
  /** Height differential multiplier (uphill/downhill); 1 when flat or the move ignores height. */
  readonly heightModifier: number;
  /** The attacker's terrain type bonus (e.g. ×1.15 for a Water move standing in water); 1 if none. */
  readonly terrainModifier: number;
  /** Weather power multiplier (sun on Fire, rain on Water…); 1 under clear skies. */
  readonly weatherModifier: number;
  /** Protection / Mur Lumière damage reduction on the defender's side; 1 when no screen applies. */
  readonly screenModifier: number;
  /** Move type AFTER any morph (Force Nature, Champlification) — what the preview must display. */
  readonly resolvedMoveType: PokemonType;
  /** Base power AFTER dynamic-power resolution — the number that actually fed the formula. */
  readonly resolvedPower: number;
}
