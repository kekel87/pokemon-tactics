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

/** Directional dash (chantier g) : Raichu en bas de la colonne (2,5), face nord, Vive-Attaque
 *  (quick-attack, Dash 2). Le dummy est HORS de l'axe (4,4) → la colonne nord est libre, le dash
 *  glisse aussi loin qu'il peut (portée auto). Confirmer par DIRECTION : cliquer n'importe quelle
 *  tuile de l'axe nord (≠ tuile d'atterrissage) valide le dash — c'est tout l'objet du test. */
export const DASH_DIRECTIONAL = {
  ...DUEL,
  pokemon: "raichu",
  moves: ["quick-attack"],
  playerPosition: { x: 2, y: 5 },
  playerDirection: "north",
  dummyPosition: { x: 4, y: 4 },
} as const;

/** Duel where the player's only move is Séisme (earthquake), a self-centred Zone AoE that does NOT
 *  affect the caster tile → the centre cell is an empty "caster" (cross, no fill). */
export const PREVIEW_QUAKE = { ...DUEL, moves: ["earthquake"] } as const;

/** Entry hazards (plan 131) — Cloyster apprend Picots (`spikes`), un poseur `GroundTarget` (vise
 *  une case au sol ≤4 Manhattan). Le joueur est à (2,3), le dummy inerte à (2,4). On vise une case
 *  libre et traversable à portée — (2,1), distance 2 — pour poser les Picots. La pose émet
 *  `EntryHazardPosted` (journal « Des Picots sont posés au sol ») + peint un mesh au sol
 *  (`hazard_hazards_spikes_1_2_1`). Le DÉCLENCHEMENT à l'entrée n'est PAS pilotable ici (le joueur
 *  ne déclenche pas SES propres pièges — owner-immunity — et le dummy AI ne se déplace jamais) → le
 *  sens du déclenchement reste couvert par les unit/integration du core (`entry-hazard-system`,
 *  `resolve-hazard-traversal`). Picots est un move statut sans jet de précision → cast déterministe. */
export const ENTRY_HAZARD_SPIKES = {
  ...DUEL,
  pokemon: "cloyster",
  moves: ["spikes"],
  playerPosition: { x: 2, y: 3 },
  dummyPosition: { x: 2, y: 4 },
} as const;

/** Distorsion (trick-room) — slow caster, fast foe, both inside the r3 zone (decision 2026-06-18).
 *  Player = Flagadoss (slowbro, base Vit 30) at (2,3) casting Distorsion ; dummy = Électrode
 *  (electrode, base Vit 150) at (2,2), distance 1 → both in the diamond. Once the zone is posted the
 *  CT tempo inverts inside it (slow plays first), so the predicted timeline must list the slow
 *  Flagadoss BEFORE the fast Électrode — the opposite of the no-Distorsion order. Seed fixed for a
 *  replayable run; Distorsion is a Self status move (no accuracy roll), so the cast is deterministic. */
export const DISTORTION_INVERSION = {
  ...DUEL,
  pokemon: "slowbro",
  moves: ["trick-room"],
  playerPosition: { x: 2, y: 3 },
  dummyPokemon: "electrode",
  dummyPosition: { x: 2, y: 2 },
} as const;
