import type { PokemonType, Position, StatusType } from "@pokemon-tactic/core";
import type { AttackPlayback } from "./combat-scene.js";

/**
 * The generic shape a move's visual effect takes (plan 234, VFX lot 2a), after PMD Origins' own
 * families (its emitters, poses and pictures), coloured by the move's type. Resolved from the move's
 * targeting, category and flags, plus a few short lists taken from PMD Origins' move data.
 */
export const MoveEffectForm = {
  /** Teleport-like moves (Vol, Tunnel, Téléport): a puff where the caster lands. */
  Vanish: "vanish",
  /** One blow's spark on the struck Pokémon (every blow of any move). */
  Impact: "impact",
  /** A plain melee blow: the caster lunges; the blow's spark does the rest. */
  Melee: "melee",
  /** Melee blows that leave their own mark on the target, oriented along the blow. */
  Bite: "bite",
  Slash: "slash",
  Claw: "claw",
  Punch: "punch",
  Kick: "kick",
  Chop: "chop",
  /** A peck, a horn, a sting: quick thrusts. */
  Jab: "jab",
  /** A charge across the board, trailing after-images of the caster. */
  Rush: "rush",
  /** A ray: a stretched body from the caster, its head running to the end of the line. */
  Beam: "beam",
  /** A continuous jet of particles along the line (Lance-Flammes, Hydrocanon, Rafale Psy). */
  Stream: "stream",
  /** A projectile flying to the target; the target takes the blow on arrival. */
  Projectile: "projectile",
  /** A blade swept across the three tiles before the caster (Tranch'Herbe, Lame d'Air). */
  Blade: "blade",
  /** A bomb lobbed to the impact tile, bursting over the blast on arrival. */
  Blast: "blast",
  /** A ring growing over the zone, a burst on each affected tile. */
  Burst: "burst",
  /** A projectile that drops onto the aimed tile (entry hazards). */
  GroundMarker: "ground-marker",
  /** Particles released in a 90° fan, flying to the cone's edge. */
  Breath: "breath",
  /** The fan with gusts of wind. */
  Wind: "wind",
  /** A tinted cloud over the affected tiles (status on a zone or a cone). */
  StatusCloud: "status-cloud",
  /** Rings that follow the move's footprint. */
  SoundWave: "sound-wave",
  /** Music notes rising and spreading (Berceuse, Chant Canon, Requiem). */
  Song: "song",
  /** A cry bursting from the caster's mouth (Rugissement, Hurlement, Aboiement). */
  Cry: "cry",
  /** A glint in the eye, on the caster and on its targets (Groz'Yeux, Regard Noir). */
  Gaze: "gaze",
  /** Wave rings on the target (Cage Éclair, Hypnose, Ultrason). */
  TargetWave: "target-wave",
  /** A sparkle on the enemy the status lands on. */
  TargetStatus: "target-status",
  /** Rising particles on the ally the status lands on. */
  AllyBuff: "ally-buff",
  /** Power gathering onto the caster. */
  Concentration: "concentration",
  /** A protective panel before the caster (Abri, Reflet, Mur Lumière, Repli). */
  Screen: "screen",
  /** The first turn of a two-turn move: the caster gathers power. */
  Charge: "charge",
  /** A stat goes up on this Pokémon: little strokes rising (any move, from the stat event). */
  StatUp: "stat-up",
  /** A stat goes down on this Pokémon: little strokes falling. */
  StatDown: "stat-down",
  /** HP drained: bubbles fly from the struck Pokémon back to the caster. */
  Drain: "drain",
  /** HP restored on this Pokémon: a ring on the ground and sparkles rising. */
  Heal: "heal",
  /** A status shows on this Pokémon: when it lands, and again each turn it holds or bites. */
  Status: "status",
  /** A protection blocks a blow on this Pokémon: a shield flashes. */
  Shield: "shield",
  /** A status or a stat drop is blocked on this Pokémon: a small ring closes in. */
  Blocked: "blocked",
} as const;
export type MoveEffectForm = (typeof MoveEffectForm)[keyof typeof MoveEffectForm];

/** What a move effect needs to play: its form, its type, and where it lands. */
export interface MoveEffectSpec {
  form: MoveEffectForm;
  type: PokemonType;
  /** The tile the caster aimed at. */
  targetPosition: Position;
  /** Every tile the move resolved on. */
  affectedTiles: readonly Position[];
  /** The blow's effectiveness (a super-effective spark is bigger). */
  effectiveness: number;
  /**
   * The struck Pokémon, when the effect aims at it (a blow's mark, drained HP): the renderer then
   * aims at the tile its sprite stands on now — the engine state handed over is already final, a
   * knockback included.
   */
  targetPokemonId?: string;
  /** The status shown, for the `status` form. */
  status?: StatusType;
}

/**
 * A move effect in flight. `impact` resolves when the effect reaches its target (a projectile's
 * arrival; at once for effects that do not travel), `done` when the last particle is gone. The
 * timings are known up front, in combat ms, for the workshop's sequence.
 */
export interface MoveEffectPlayback extends AttackPlayback {
  durationMs: number;
  impactMs: number;
}

/** An effect that has nothing to play (no scene yet, no such Pokémon): already landed and over. */
export const SETTLED_MOVE_EFFECT: MoveEffectPlayback = {
  impact: Promise.resolve(),
  done: Promise.resolve(),
  durationMs: 0,
  impactMs: 0,
};
