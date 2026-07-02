/**
 * The three localized "field global" effects. Canonically each is a battlefield-wide effect; this
 * project relocalizes them as static Manhattan-diamond zones (mirror of Distorsion / the Champs) so
 * positioning stays tactical. A Pokemon standing on a covered tile is subject to the effect.
 */
export const FieldGlobalKind = {
  /** Gravité: grounds airborne mons inside + incoming accuracy ×5/3 against a target inside. */
  Gravity: "gravity",
  /** Zone Étrange (wonder-room): swaps Defense ↔ Special Defense of a defender inside. */
  WonderRoom: "wonder-room",
  /** Zone Magique (magic-room): suppresses held-item effects of a holder inside. */
  MagicRoom: "magic-room",
} as const;

export type FieldGlobalKind = (typeof FieldGlobalKind)[keyof typeof FieldGlobalKind];
