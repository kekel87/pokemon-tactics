import { Category, type MoveDefinition, type Position, TargetingKind } from "@pokemon-tactic/core";
import { MoveEffectForm } from "@pokemon-tactic/render-ports";

/** Who a move lands on, as the effect needs to tell: the caster, an ally, or an enemy. */
export const TargetRelation = {
  Self: "self",
  Ally: "ally",
  Enemy: "enemy",
} as const;
export type TargetRelation = (typeof TargetRelation)[keyof typeof TargetRelation];

/*
 * Families our move flags do not carry, read off PMD Origins' move data (the pose and the picture
 * each move uses, audinowho/DumpAsset Data/Skill, surveyed 2026-10-08 for plan 234).
 */
const CLAW_MOVES = new Set([
  "scratch",
  "fury-swipes",
  "dragon-claw",
  "metal-claw",
  "shadow-claw",
  "crush-claw",
]);
const KICK_MOVES = new Set([
  "low-kick",
  "double-kick",
  "blaze-kick",
  "mega-kick",
  "low-sweep",
  "high-jump-kick",
  "axe-kick",
  "stomp",
]);
const CHOP_MOVES = new Set(["karate-chop", "brick-break", "cross-chop", "dual-chop", "knock-off"]);
const JAB_MOVES = new Set([
  "poison-sting",
  "drill-peck",
  "twineedle",
  "peck",
  "megahorn",
  "horn-attack",
  "fell-stinger",
  "fury-attack",
  "poison-jab",
  "drill-run",
  "pluck",
  "horn-drill",
]);
/** Bites and punches PMD Origins draws as such beyond our `bite` / `punch` flags. */
const EXTRA_BITE_MOVES = new Set(["super-fang", "leech-life", "bug-bite"]);
const EXTRA_PUNCH_MOVES = new Set(["rock-smash", "feint"]);
const GAZE_MOVES = new Set([
  "mean-look",
  "lock-on",
  "glare",
  "disable",
  "scary-face",
  "baby-doll-eyes",
  "leer",
]);
const SCREEN_MOVES = new Set([
  "withdraw",
  "minimize",
  "defense-curl",
  "protect",
  "detect",
  "wide-guard",
  "quick-guard",
  "endure",
  "iron-defense",
  "barrier",
  "reflect",
  "light-screen",
  "safeguard",
  "harden",
  "counter",
  "mirror-coat",
]);
const TARGET_WAVE_MOVES = new Set([
  "thunder-wave",
  "hypnosis",
  "supersonic",
  "heal-pulse",
  "screech",
]);
const SONG_MOVES = new Set(["sing", "perish-song", "round", "snore"]);
const CRY_MOVES = new Set(["growl", "roar", "snarl", "howl", "uproar"]);
/** Line moves PMD Origins draws as a jet of particles rather than a ray. */
const STREAM_MOVES = new Set(["flamethrower", "hydro-pump", "psybeam"]);

/**
 * Who a move lands on. In combat the move's footprint settles it (every tile on the caster = itself,
 * Vœu on its own tile included); without one (the workshop's sheet), the move's own targeting does.
 */
export function targetRelation(
  move: MoveDefinition,
  footprint?: { caster: Position; affectedTiles: readonly Position[] },
): TargetRelation {
  const onCaster = footprint
    ? footprint.affectedTiles.length > 0 &&
      footprint.affectedTiles.every(
        (tile) => tile.x === footprint.caster.x && tile.y === footprint.caster.y,
      )
    : move.targeting.kind === TargetingKind.Self;
  if (onCaster) {
    return TargetRelation.Self;
  }
  return move.targetsAlly === true || move.targetsAllyOrSelf === true
    ? TargetRelation.Ally
    : TargetRelation.Enemy;
}

/**
 * The generic shape of a move's visual effect (plan 234, VFX lot 2a), after PMD Origins' families —
 * the first rule that matches wins. Melee shapes come before the sound flag (a contact move reads as
 * a blow), and the sound flag before the area shapes (a roar is a cry, whatever its footprint).
 */
export function moveEffectForm(move: MoveDefinition, relation: TargetRelation): MoveEffectForm {
  const { targeting } = move;
  if (targeting.kind === TargetingKind.Teleport) {
    return MoveEffectForm.Vanish;
  }
  if (move.category === Category.Status) {
    return statusForm(move, relation);
  }
  if (targeting.kind === TargetingKind.Self) {
    return SCREEN_MOVES.has(move.id) ? MoveEffectForm.Screen : MoveEffectForm.Concentration;
  }
  if (isMeleeShape(move)) {
    return meleeForm(move);
  }
  if (move.flags?.sound === true) {
    return soundForm(move);
  }
  switch (targeting.kind) {
    case TargetingKind.Line:
      return STREAM_MOVES.has(move.id) ? MoveEffectForm.Stream : MoveEffectForm.Beam;
    case TargetingKind.Cone:
      return move.flags?.wind === true ? MoveEffectForm.Wind : MoveEffectForm.Breath;
    case TargetingKind.Blast:
      return MoveEffectForm.Blast;
    case TargetingKind.Zone:
    case TargetingKind.Cross:
      return MoveEffectForm.Burst;
    case TargetingKind.GroundTarget:
      return MoveEffectForm.GroundMarker;
    default:
      return MoveEffectForm.Projectile;
  }
}

/** Shapes that strike next to the caster, or carry it to its target. */
function isMeleeShape(move: MoveDefinition): boolean {
  const { targeting } = move;
  const isContact = move.flags?.contact === true;
  switch (targeting.kind) {
    case TargetingKind.Dash:
    case TargetingKind.HitAndRun:
    case TargetingKind.Slash:
      return true;
    case TargetingKind.Single:
      return isContact || targeting.range.max <= 1;
    case TargetingKind.Line:
    case TargetingKind.Cross:
      return isContact;
    default:
      return false;
  }
}

function meleeForm(move: MoveDefinition): MoveEffectForm {
  const flags = move.flags ?? {};
  if (move.targeting.kind === TargetingKind.Dash) {
    return MoveEffectForm.Rush;
  }
  if (flags.slicing === true && flags.contact !== true) {
    return MoveEffectForm.Blade;
  }
  if (flags.bite === true || EXTRA_BITE_MOVES.has(move.id)) {
    return MoveEffectForm.Bite;
  }
  if (flags.slicing === true) {
    return MoveEffectForm.Slash;
  }
  if (CLAW_MOVES.has(move.id)) {
    return MoveEffectForm.Claw;
  }
  if (flags.punch === true || EXTRA_PUNCH_MOVES.has(move.id)) {
    return MoveEffectForm.Punch;
  }
  if (KICK_MOVES.has(move.id)) {
    return MoveEffectForm.Kick;
  }
  if (CHOP_MOVES.has(move.id)) {
    return MoveEffectForm.Chop;
  }
  if (JAB_MOVES.has(move.id)) {
    return MoveEffectForm.Jab;
  }
  return MoveEffectForm.Melee;
}

function soundForm(move: MoveDefinition): MoveEffectForm {
  if (SONG_MOVES.has(move.id)) {
    return MoveEffectForm.Song;
  }
  if (CRY_MOVES.has(move.id)) {
    return MoveEffectForm.Cry;
  }
  return TARGET_WAVE_MOVES.has(move.id) ? MoveEffectForm.TargetWave : MoveEffectForm.SoundWave;
}

function statusForm(move: MoveDefinition, relation: TargetRelation): MoveEffectForm {
  if (move.flags?.sound === true) {
    return soundForm(move);
  }
  if (GAZE_MOVES.has(move.id)) {
    return MoveEffectForm.Gaze;
  }
  if (TARGET_WAVE_MOVES.has(move.id)) {
    return MoveEffectForm.TargetWave;
  }
  if (SCREEN_MOVES.has(move.id)) {
    return MoveEffectForm.Screen;
  }
  switch (move.targeting.kind) {
    case TargetingKind.Zone:
    case TargetingKind.Cone:
    case TargetingKind.Line:
    case TargetingKind.Cross:
    case TargetingKind.Blast:
      return MoveEffectForm.StatusCloud;
    case TargetingKind.GroundTarget:
      return MoveEffectForm.GroundMarker;
    default:
      break;
  }
  if (relation === TargetRelation.Ally) {
    return MoveEffectForm.AllyBuff;
  }
  if (relation === TargetRelation.Self) {
    return MoveEffectForm.Concentration;
  }
  return MoveEffectForm.TargetStatus;
}

/** Forms where the caster lunges at its target on the blow, as PMD Origins' melee poses do. */
export const LUNGE_FORMS: ReadonlySet<MoveEffectForm> = new Set<MoveEffectForm>([
  MoveEffectForm.Melee,
  MoveEffectForm.Bite,
  MoveEffectForm.Slash,
  MoveEffectForm.Claw,
  MoveEffectForm.Punch,
  MoveEffectForm.Kick,
  MoveEffectForm.Chop,
  MoveEffectForm.Jab,
]);

/**
 * Melee families whose every blow leaves its own mark, tinted by the type, in place of the generic
 * spark (playtest 2026-10-08: the mark alone reads better than mark + spark).
 */
export const STRIKE_MARK_FORMS: ReadonlySet<MoveEffectForm> = new Set<MoveEffectForm>([
  MoveEffectForm.Bite,
  MoveEffectForm.Slash,
  MoveEffectForm.Claw,
  MoveEffectForm.Punch,
  MoveEffectForm.Kick,
  MoveEffectForm.Chop,
  MoveEffectForm.Jab,
]);

/** The caster's PMD pose for a move: the name of the sprite's animation it plays. */
export const CastPose = {
  Attack: "Attack",
  Shoot: "Shoot",
  Charge: "Charge",
} as const;
export type CastPose = (typeof CastPose)[keyof typeof CastPose];

/** Forms played on the caster itself or on an ally: the caster gathers power (Charge pose). */
const GATHERING_FORMS: ReadonlySet<MoveEffectForm> = new Set<MoveEffectForm>([
  MoveEffectForm.Concentration,
  MoveEffectForm.Screen,
  MoveEffectForm.AllyBuff,
  MoveEffectForm.Charge,
]);
/** Forms where the caster strikes in person (Attack pose). */
const STRIKING_FORMS: ReadonlySet<MoveEffectForm> = new Set<MoveEffectForm>([
  ...LUNGE_FORMS,
  MoveEffectForm.Rush,
  MoveEffectForm.Vanish,
]);

/**
 * The caster's PMD pose for a move (plan 234), read off its effect family — the gesture, not the
 * category (decision-195: Séisme is physical yet no blow, Jet-Pierres physical yet a throw): it
 * strikes in person (Attack), sends something off (Shoot), or gathers power on itself or an ally
 * (Charge). Replaces the hand-kept table that had stopped at 112 moves out of 512.
 */
export function castPose(form: MoveEffectForm, move: MoveDefinition): CastPose {
  // A physical zone around the caster (Séisme, Ampleur, Tour Rapide) strikes the ground in person.
  // A wind (Tempête Florale) is sent off instead.
  const strikesGround =
    form === MoveEffectForm.Burst &&
    move.category === Category.Physical &&
    move.flags?.wind !== true;
  if (STRIKING_FORMS.has(form) || strikesGround) {
    return CastPose.Attack;
  }
  return GATHERING_FORMS.has(form) ? CastPose.Charge : CastPose.Shoot;
}

/** The pose a move plays, from its own targeting (no battle footprint at hand: the workshop). */
export function movePose(move: MoveDefinition): CastPose {
  return castPose(moveEffectForm(move, targetRelation(move)), move);
}
