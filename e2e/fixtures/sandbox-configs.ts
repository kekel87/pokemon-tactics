// Reusable, ID-validated sandbox configs (the dev/test-only URL boot consumes these). Keep the
// Pokemon/move/ability IDs here in sync with packages/data — a bad ID throws at boot. Centralising
// them means one place to fix when the roster changes, and self-documenting test intent.

/** A fixed adjacent duel: player (2,3) vs an inert dummy (2,2). Griffe (scratch) has range 1, so
 *  it always reaches the dummy. Seed is explicit because driving tests assert the RNG outcome. */
export const DUEL = {
  seed: 12345,
  pokemon: "venusaur",
  moves: ["scratch"],
  playerPosition: { x: 2, y: 3 },
  playerDirection: "north",
  dummyPosition: { x: 2, y: 2 },
} as const;

/** Same duel but the dummy is one hit from fainting → any Griffe is lethal (KO log assertion). */
export const DUEL_LETHAL = { ...DUEL, dummyHp: 1 } as const;

/** Player starts poisoned → the HUD must mount a status icon (test-plan §3.4). */
export const POISONED = { status: "poisoned" } as const;

/** Same duel but the only move is a multi-hit one: Balle Graine (bullet-seed) is 100% accuracy so
 *  it always lands, and the seed makes the 2-5 hit count deterministic → the log emits a single
 *  "Touché N fois !" line (test-plan §5 multi-hit). Dummy keeps full HP so it survives the volley. */
export const MULTI_HIT = { ...DUEL, moves: ["bullet-seed"] } as const;

/** Duel where the player's only move is Danse Lames (swords-dance), a self stat-up buff → the
 *  tooltip pattern grid reads as a "buff" intent (test-plan §6 preview colours). */
export const PREVIEW_BUFF = { ...DUEL, moves: ["swords-dance"] } as const;

/** Duel where the player's only move is Fontaine de Vie (life-dew), a self-centred AoE heal → the
 *  tooltip pattern grid reads as a "heal" intent with the caster tile inside the zone. */
export const PREVIEW_HEAL = { ...DUEL, moves: ["life-dew"] } as const;

/** Duel where the player's only move is Bélier (take-down), a dash move → the tooltip pattern grid
 *  draws the dash-trail cells. */
export const PREVIEW_DASH = { ...DUEL, moves: ["take-down"] } as const;

/** Duel where the player's only move is Séisme (earthquake), a self-centred Zone AoE that does NOT
 *  affect the caster tile → the centre cell is an empty "caster" (cross, no fill). */
export const PREVIEW_QUAKE = { ...DUEL, moves: ["earthquake"] } as const;
