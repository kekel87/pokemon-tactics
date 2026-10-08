import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PokemonType, type Position, StatusType } from "@pokemon-tactic/core";
import { MoveEffectForm, type MoveEffectSpec } from "@pokemon-tactic/render-ports";
import { hexToColor3 } from "./babylon-color.js";
import {
  BABYLON_MOVE_EFFECT_BEAM_FRAME_MS,
  BABYLON_MOVE_EFFECT_BEAM_LINGER_MS,
  BABYLON_MOVE_EFFECT_BEAM_SCALE,
  BABYLON_MOVE_EFFECT_DRAIN_ARC_MIN,
  BABYLON_MOVE_EFFECT_DRAIN_ARC_SPREAD,
  BABYLON_MOVE_EFFECT_DRAIN_BUBBLE_SCALE,
  BABYLON_MOVE_EFFECT_DRAIN_BUBBLES,
  BABYLON_MOVE_EFFECT_DRAIN_FLIGHT_MS,
  BABYLON_MOVE_EFFECT_FAN_BURSTS,
  BABYLON_MOVE_EFFECT_FAN_EVERY_MS,
  BABYLON_MOVE_EFFECT_FAN_PER_BURST,
  BABYLON_MOVE_EFFECT_GATHER_COUNT,
  BABYLON_MOVE_EFFECT_GATHER_EVERY_MS,
  BABYLON_MOVE_EFFECT_GATHER_RADIUS,
  BABYLON_MOVE_EFFECT_GATHER_SCALE,
  BABYLON_MOVE_EFFECT_GATHER_TRAVEL_MS,
  BABYLON_MOVE_EFFECT_GAZE_SCALE,
  BABYLON_MOVE_EFFECT_GROUND_SQUASH,
  BABYLON_MOVE_EFFECT_HEAL_RINGS,
  BABYLON_MOVE_EFFECT_HEAL_SPARKLES,
  BABYLON_MOVE_EFFECT_MARK_MIN_LIFE_MS,
  BABYLON_MOVE_EFFECT_MARK_REACH,
  BABYLON_MOVE_EFFECT_MIN_FLIGHT_MS,
  BABYLON_MOVE_EFFECT_PROJECTILE_TILES_PER_SECOND,
  BABYLON_MOVE_EFFECT_SONG_ARC,
  BABYLON_MOVE_EFFECT_SONG_NOTES,
  BABYLON_MOVE_EFFECT_SONG_TRAVEL_MS,
  BABYLON_MOVE_EFFECT_SPREAD_MS_PER_TILE,
  BABYLON_MOVE_EFFECT_STAT_LIFE_MS,
  BABYLON_MOVE_EFFECT_STAT_STROKES,
  BABYLON_MOVE_EFFECT_STAT_TRAVEL,
  BABYLON_MOVE_EFFECT_STATUS_DRIFT,
  BABYLON_MOVE_EFFECT_STATUS_RISERS,
  BABYLON_MOVE_EFFECT_STREAM_EVERY_MS,
  BABYLON_MOVE_EFFECT_STREAM_SHOTS,
  BABYLON_MOVE_EFFECT_STRONG_MARK_SCALE,
  BABYLON_MOVE_EFFECT_TILE_MS,
} from "./babylon-constants.js";
import { type Particle, particle, stripLifeMs } from "./babylon-move-effect-particle.js";
import {
  MOVE_EFFECT_DRAIN_COLOR,
  MOVE_EFFECT_HEAL_COLOR,
  MOVE_EFFECT_SPARK_WHITE_MIX,
  MOVE_EFFECT_STAT_DOWN_COLOR,
  MOVE_EFFECT_STAT_UP_COLOR,
  MOVE_EFFECT_TINT_WHITE_MIX,
  MOVE_EFFECT_TYPE_COLORS,
} from "./constants.js";
import { MOVE_EFFECT_STRIPS, type MoveEffectStripKey } from "./move-effect-atlas.js";

/** What laying an effect out needs from the scene: tile positions and the camera's view. */
export interface LayoutContext {
  /** A tile at a Pokémon's chest height. */
  worldAt(tile: Position): Vector3;
  /** A tile's top, just above the ground. */
  groundAt(tile: Position): Vector3;
  /** On-screen angle (radians, counter-clockwise, 0 = right) of the way from one point to another. */
  screenAngle(from: Vector3, to: Vector3): number;
}

interface EffectLayout {
  particles: Particle[];
  /** When the effect reaches its target (a shot's arrival); 0 for effects that do not travel. */
  impactMs: number;
}

/** Display scale of each strip against the sprites' pixel density (1 = same pixel size). */
const STRIP_SCALE: Partial<Record<MoveEffectStripKey, number>> = {
  orb: 0.45,
  "status-burned": 0.45,
  "status-paralyzed": 0.5,
  shield: 0.55,
  screen: 0.5,
  hit: 0.8,
  "hit-strong": 0.8,
  ring: 0.7,
  "mark-bite": 0.6,
  "mark-slash": 1.3,
  "wide-slash": 0.75,
  "mark-claw": 0.8,
  "mark-jab": 0.7,
  "mark-punch": 0.8,
  "mark-kick": 0.8,
  "mark-chop": 0.8,
  "stat-ring": 0.6,
  "heal-sparkle": 0.7,
};

function tintsWithWhite(whiteMix: number): Record<PokemonType, Color4> {
  const tints = {} as Record<PokemonType, Color4>;
  for (const type of Object.values(PokemonType)) {
    const color = Color3.Lerp(hexToColor3(MOVE_EFFECT_TYPE_COLORS[type]), Color3.White(), whiteMix);
    tints[type] = new Color4(color.r, color.g, color.b, 1);
  }
  return tints;
}

function fixedTint(hex: number): Color4 {
  const color = hexToColor3(hex);
  return new Color4(color.r, color.g, color.b, 1);
}

/** Type tints, shared read-only by the sprites. */
const EFFECT_TINTS = tintsWithWhite(MOVE_EFFECT_TINT_WHITE_MIX);
const SPARK_TINTS = tintsWithWhite(MOVE_EFFECT_SPARK_WHITE_MIX);
const UNTINTED = new Color4(1, 1, 1, 1);
const STAT_UP_TINT = fixedTint(MOVE_EFFECT_STAT_UP_COLOR);
const STAT_DOWN_TINT = fixedTint(MOVE_EFFECT_STAT_DOWN_COLOR);
const DRAIN_TINT = fixedTint(MOVE_EFFECT_DRAIN_COLOR);
const HEAL_TINT = fixedTint(MOVE_EFFECT_HEAL_COLOR);

/** How a status shows (PMD Origins' own pictures, untinted), and whether its pictures drift up. */
const STATUS_LOOKS: Partial<Record<StatusType, { strip: MoveEffectStripKey; rising: boolean }>> = {
  [StatusType.Burned]: { strip: "status-burned", rising: false },
  [StatusType.Poisoned]: { strip: "status-poisoned", rising: true },
  [StatusType.BadlyPoisoned]: { strip: "status-poisoned", rising: true },
  [StatusType.Paralyzed]: { strip: "status-paralyzed", rising: false },
  [StatusType.Asleep]: { strip: "status-asleep", rising: true },
  [StatusType.Frozen]: { strip: "status-frozen", rising: false },
  [StatusType.Confused]: { strip: "status-confused", rising: false },
  [StatusType.Infatuated]: { strip: "status-infatuated", rising: true },
};

/** The mark each melee family leaves where its blow lands, tinted by the move's type. */
const MARK_STRIPS: Partial<Record<MoveEffectForm, MoveEffectStripKey>> = {
  [MoveEffectForm.Bite]: "mark-bite",
  [MoveEffectForm.Slash]: "mark-slash",
  [MoveEffectForm.Claw]: "mark-claw",
  [MoveEffectForm.Jab]: "mark-jab",
  [MoveEffectForm.Punch]: "mark-punch",
  [MoveEffectForm.Kick]: "mark-kick",
  [MoveEffectForm.Chop]: "mark-chop",
};

/** Where a mark lands between the caster's mouth (0) and the target (1): a bite at the mouth itself. */
const MARK_REACHES: Partial<Record<MoveEffectForm, number>> = {
  [MoveEffectForm.Bite]: 0,
};

/** Where the strokes and risers stand around a Pokémon (world X/Z offsets). */
const AROUND_OFFSETS: readonly (readonly [number, number])[] = [
  [-0.22, 0.05],
  [0.18, -0.08],
  [0.02, 0.2],
  [-0.08, -0.22],
  [0.24, 0.16],
  [-0.2, -0.12],
];

/** A fixed spread of values in [0, 1) by index: varied, yet the same at every replay (scrub). */
function scatter(index: number): number {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** Straight-line distance, in tiles: how long a shot flies, how long a ray is. */
function tileDistance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Flight time over a distance (tiles) at PMD Origins' pace, never shorter than a glimpse. */
function flightMs(distance: number): number {
  return Math.max(
    BABYLON_MOVE_EFFECT_MIN_FLIGHT_MS,
    (distance / BABYLON_MOVE_EFFECT_PROJECTILE_TILES_PER_SECOND) * 1000,
  );
}

/** PMD's Dir8 row (Down, DownLeft, Left, UpLeft, Up, UpRight, Right, DownRight) for a screen angle. */
function directionRowForAngle(angle: number): number {
  const octant = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  // Octant 0 = right, counter-clockwise (screen Y up).
  return [6, 5, 4, 3, 2, 1, 0, 7][octant] ?? 0;
}

/** The orb is a growing ball: a moving one loops on its middle frames. */
const ORB_MIDDLE_FRAMES = [5, 7] as const;

/** The rotation that turns a picture drawn pointing down into one pointing along `angle`. */
function pointAlong(angle: number): number {
  return angle + Math.PI / 2;
}

/** The type's own projectile when the sheet has one (untinted), else the white orb, tinted. */
function projectileLook(type: PokemonType): { strip: MoveEffectStripKey; tint: Color4 } {
  const own = `projectile-${type}`;
  if (own in MOVE_EFFECT_STRIPS) {
    return { strip: own as MoveEffectStripKey, tint: UNTINTED };
  }
  return { strip: "orb", tint: EFFECT_TINTS[type] };
}

function scaled(strip: MoveEffectStripKey, factor = 1): number {
  return (STRIP_SCALE[strip] ?? 1) * factor;
}

/**
 * The particles of one move effect (plan 234), after PMD Origins' families: its emitters, its pace
 * (10 tiles/s), its pictures, and the move's type as their colour. `origin` is the tile the effect
 * plays from (the caster, or the struck Pokémon for a spark); `launch` is where a travelling effect
 * leaves from (the caster's mouth when the sprite knows it).
 */
export function layoutMoveEffect(
  context: LayoutContext,
  origin: Position,
  spec: MoveEffectSpec,
  launch: Vector3,
): EffectLayout {
  const tint = EFFECT_TINTS[spec.type];
  const tiles = spec.affectedTiles;
  const at = (tile: Position): Vector3 => context.worldAt(tile);
  const burstAt = (strip: MoveEffectStripKey, tile: Position, startMs: number, color: Color4) => {
    const point = at(tile);
    return particle(strip, point, point, startMs, stripLifeMs(strip), color, {
      scale: scaled(strip),
    });
  };
  /** A ring laid flat on a tile, seen in perspective. */
  const groundRing = (
    strip: MoveEffectStripKey,
    tile: Position,
    startMs: number,
    color: Color4,
  ) => {
    const point = context.groundAt(tile);
    return particle(strip, point, point, startMs, stripLifeMs(strip), color, {
      scale: scaled(strip),
      squash: BABYLON_MOVE_EFFECT_GROUND_SQUASH,
    });
  };
  /** Rings grow outwards at PMD Origins' pace. */
  const growth = (tile: Position): number =>
    tileDistance(origin, tile) * BABYLON_MOVE_EFFECT_TILE_MS;
  /** The footprint's middle, seen from the caster: the real axis of a cone (not its far corner). */
  const axisPoint = (): Vector3 => {
    const around = tiles.filter((tile) => tileDistance(origin, tile) > 0);
    if (around.length === 0) {
      return at(spec.targetPosition);
    }
    return around
      .reduce<Vector3>((sum, tile) => sum.addInPlace(at(tile)), Vector3.Zero())
      .scaleInPlace(1 / around.length);
  };
  const farthest = (): Position =>
    tiles.reduce(
      (best, tile) => (tileDistance(origin, tile) > tileDistance(origin, best) ? tile : best),
      spec.targetPosition,
    );

  switch (spec.form) {
    case MoveEffectForm.Projectile: {
      const look = projectileLook(spec.type);
      const lifeMs = flightMs(tileDistance(origin, spec.targetPosition));
      const end = at(spec.targetPosition);
      return {
        particles: [
          particle(look.strip, launch, end, 0, lifeMs, look.tint, {
            scale: scaled(look.strip),
            loop: [0, MOVE_EFFECT_STRIPS[look.strip].frames - 1],
          }),
        ],
        impactMs: lifeMs,
      };
    }
    case MoveEffectForm.Blade: {
      // One wide sweep across the three tiles before the caster, in the type's colour.
      const middle = axisPoint();
      const strip = MOVE_EFFECT_STRIPS["wide-slash"];
      return {
        particles: [
          particle("wide-slash", middle, middle, 0, stripLifeMs("wide-slash"), tint, {
            scale: scaled("wide-slash"),
            row: strip.rows > 1 ? directionRowForAngle(context.screenAngle(at(origin), middle)) : 0,
            inFront: true,
          }),
        ],
        impactMs: 0,
      };
    }
    case MoveEffectForm.Blast:
    case MoveEffectForm.GroundMarker: {
      const landing =
        spec.form === MoveEffectForm.Blast
          ? blastCenter(tiles, spec.targetPosition)
          : spec.targetPosition;
      const distance = tileDistance(origin, landing);
      const look = projectileLook(spec.type);
      const lifeMs = flightMs(distance);
      // PMD Origins lobs at half the distance high.
      const lob = particle(look.strip, launch, at(landing), 0, lifeMs, look.tint, {
        scale: scaled(look.strip),
        arc: distance / 2,
        loop: [0, MOVE_EFFECT_STRIPS[look.strip].frames - 1],
      });
      const landed =
        spec.form === MoveEffectForm.Blast
          ? tiles.flatMap((tile) => [
              groundRing("ring", tile, lifeMs, tint),
              burstAt("smoke", tile, lifeMs, tint),
            ])
          : [burstAt("puff", landing, lifeMs, tint)];
      return { particles: [lob, ...landed], impactMs: lifeMs };
    }
    case MoveEffectForm.Beam: {
      const end = farthest();
      const tip = at(end);
      const growMs = tileDistance(origin, end) * BABYLON_MOVE_EFFECT_TILE_MS;
      const lifeMs = growMs + BABYLON_MOVE_EFFECT_BEAM_LINGER_MS;
      const angle = pointAlong(context.screenAngle(launch, tip));
      const beamFrames = MOVE_EFFECT_STRIPS["beam-body"].frames;
      const options = {
        travelMs: growMs,
        angle,
        scale: BABYLON_MOVE_EFFECT_BEAM_SCALE,
        frameMs: BABYLON_MOVE_EFFECT_BEAM_FRAME_MS,
        loop: [0, beamFrames - 1] as const,
      };
      return {
        particles: [
          particle("beam-body", launch, tip, 0, lifeMs, tint, { ...options, stretched: true }),
          particle("beam-head", launch, tip, 0, lifeMs, tint, options),
        ],
        impactMs: growMs,
      };
    }
    case MoveEffectForm.Stream: {
      const end = at(farthest());
      const look = projectileLook(spec.type);
      const lifeMs = flightMs(tileDistance(origin, farthest()));
      const particles = Array.from({ length: BABYLON_MOVE_EFFECT_STREAM_SHOTS }, (_, index) =>
        particle(
          look.strip,
          launch,
          end,
          index * BABYLON_MOVE_EFFECT_STREAM_EVERY_MS,
          lifeMs,
          look.tint,
          {
            scale: scaled(look.strip),
            loop: [0, MOVE_EFFECT_STRIPS[look.strip].frames - 1],
          },
        ),
      );
      return { particles, impactMs: lifeMs };
    }
    case MoveEffectForm.Breath:
    case MoveEffectForm.Wind: {
      // Released in a 90° fan around the blow's direction, flying to the cone's edge.
      const reach = tileDistance(origin, farthest());
      const start = at(origin);
      const heading = axisPoint().subtract(start);
      const baseAngle = Math.atan2(heading.z, heading.x);
      const look =
        spec.form === MoveEffectForm.Wind
          ? { strip: "gust" as MoveEffectStripKey, tint }
          : projectileLook(spec.type);
      const lifeMs = flightMs(reach);
      const count = BABYLON_MOVE_EFFECT_FAN_BURSTS * BABYLON_MOVE_EFFECT_FAN_PER_BURST;
      const particles = Array.from({ length: count }, (_, index) => {
        const spread = (scatter(index) - 0.5) * (Math.PI / 2);
        const direction = new Vector3(
          Math.cos(baseAngle + spread),
          0,
          Math.sin(baseAngle + spread),
        );
        const startMs =
          Math.floor(index / BABYLON_MOVE_EFFECT_FAN_PER_BURST) * BABYLON_MOVE_EFFECT_FAN_EVERY_MS;
        return particle(
          look.strip,
          launch,
          start.add(direction.scale(reach)),
          startMs,
          lifeMs,
          look.tint,
          {
            scale: scaled(look.strip),
            loop: [0, MOVE_EFFECT_STRIPS[look.strip].frames - 1],
          },
        );
      });
      return { particles, impactMs: 0 };
    }
    case MoveEffectForm.Burst:
      return {
        particles: tiles.flatMap((tile) => [
          groundRing("ring", tile, growth(tile), tint),
          burstAt("smoke", tile, growth(tile), tint),
        ]),
        impactMs: 0,
      };
    case MoveEffectForm.StatusCloud:
      return {
        particles: tiles.map((tile) => burstAt("smoke", tile, growth(tile), tint)),
        impactMs: 0,
      };
    case MoveEffectForm.SoundWave:
      return {
        particles: [
          burstAt("wave", origin, 0, tint),
          ...tiles
            .filter((tile) => tileDistance(origin, tile) > 0)
            .map((tile) => burstAt("wave", tile, growth(tile), tint)),
        ],
        impactMs: 0,
      };
    case MoveEffectForm.Song: {
      const destinations = tiles.length > 0 ? tiles : [origin];
      const noteCount = MOVE_EFFECT_STRIPS.notes.frames;
      const particles = Array.from({ length: BABYLON_MOVE_EFFECT_SONG_NOTES }, (_, index) => {
        const tile = destinations[index % destinations.length] ?? origin;
        const destination = at(tile).add(new Vector3(0, BABYLON_MOVE_EFFECT_STATUS_DRIFT, 0));
        return particle(
          "notes",
          launch,
          destination,
          index * BABYLON_MOVE_EFFECT_SPREAD_MS_PER_TILE,
          BABYLON_MOVE_EFFECT_SONG_TRAVEL_MS,
          UNTINTED,
          {
            heldFrame: Math.floor(scatter(index) * noteCount),
            arc: BABYLON_MOVE_EFFECT_SONG_ARC,
          },
        );
      });
      return { particles, impactMs: 0 };
    }
    case MoveEffectForm.Cry: {
      const toward = axisPoint();
      return {
        particles: [
          particle("cry", launch, launch, 0, stripLifeMs("cry"), UNTINTED, {
            row: directionRowForAngle(context.screenAngle(launch, toward)),
          }),
        ],
        impactMs: 0,
      };
    }
    case MoveEffectForm.Gaze:
      return {
        particles: [
          particle("gaze", launch, launch, 0, stripLifeMs("gaze"), UNTINTED, {
            scale: BABYLON_MOVE_EFFECT_GAZE_SCALE,
          }),
          ...tiles
            .filter((tile) => tileDistance(origin, tile) > 0)
            .map((tile) => burstAt("sparkle", tile, stripLifeMs("gaze") / 2, tint)),
        ],
        impactMs: 0,
      };
    case MoveEffectForm.TargetWave:
      return {
        particles: tiles.flatMap((tile) => [
          burstAt("wave", tile, 0, tint),
          burstAt("wave", tile, 2 * BABYLON_MOVE_EFFECT_SPREAD_MS_PER_TILE, tint),
        ]),
        impactMs: 0,
      };
    case MoveEffectForm.TargetStatus:
      return {
        particles: tiles.flatMap((tile) => [
          burstAt("sparkle", tile, 0, tint),
          burstAt("sparkle", tile, 2 * BABYLON_MOVE_EFFECT_SPREAD_MS_PER_TILE, tint),
        ]),
        impactMs: 0,
      };
    case MoveEffectForm.Concentration:
    case MoveEffectForm.Charge:
      return { particles: gatherOn(context, origin, tint), impactMs: 0 };
    case MoveEffectForm.AllyBuff:
      return { particles: tiles.flatMap((tile) => gatherOn(context, tile, tint)), impactMs: 0 };
    case MoveEffectForm.Screen:
      return { particles: [burstAt("screen", origin, 0, tint)], impactMs: 0 };
    case MoveEffectForm.Bite:
    case MoveEffectForm.Slash:
    case MoveEffectForm.Claw:
    case MoveEffectForm.Jab:
    case MoveEffectForm.Punch:
    case MoveEffectForm.Kick:
    case MoveEffectForm.Chop: {
      // One blow's mark, where it lands: from the caster's mouth (at the end of its lunge) towards
      // the struck Pokémon, drawn over the sprites, oriented along the blow, in the type's colour.
      const stripKey = MARK_STRIPS[spec.form];
      if (!stripKey) {
        return { particles: [], impactMs: 0 };
      }
      const strip = MOVE_EFFECT_STRIPS[stripKey];
      const target = at(spec.targetPosition);
      const reach = MARK_REACHES[spec.form] ?? BABYLON_MOVE_EFFECT_MARK_REACH;
      const mark = Vector3.Lerp(launch, target, reach);
      const angle = context.screenAngle(launch, target);
      return {
        particles: [
          // A one-picture mark (a fist, a foot) still shows for a beat.
          particle(
            stripKey,
            mark,
            mark,
            0,
            Math.max(BABYLON_MOVE_EFFECT_MARK_MIN_LIFE_MS, stripLifeMs(stripKey)),
            tint,
            {
              scale: scaled(
                stripKey,
                spec.effectiveness > 1 ? BABYLON_MOVE_EFFECT_STRONG_MARK_SCALE : 1,
              ),
              row: strip.rows > 1 ? directionRowForAngle(angle) : 0,
              angle: stripKey === "mark-claw" ? pointAlong(angle) : 0,
              inFront: true,
            },
          ),
        ],
        impactMs: 0,
      };
    }
    case MoveEffectForm.Vanish:
      // One puff where the Pokémon lands (a flyer or a digger takes off unseen, on the charge turn).
      return { particles: [burstAt("puff", spec.targetPosition, 0, tint)], impactMs: 0 };
    case MoveEffectForm.StatUp:
    case MoveEffectForm.StatDown:
      return {
        particles: statStrokes(context, origin, spec.form === MoveEffectForm.StatUp),
        impactMs: 0,
      };
    case MoveEffectForm.Drain: {
      // Bubbles leave the struck Pokémon and fly back to the caster (the origin).
      const from = at(spec.targetPosition);
      const to = at(origin);
      const particles = Array.from({ length: BABYLON_MOVE_EFFECT_DRAIN_BUBBLES }, (_, index) =>
        particle(
          "orb",
          from,
          to,
          index * BABYLON_MOVE_EFFECT_SPREAD_MS_PER_TILE,
          BABYLON_MOVE_EFFECT_DRAIN_FLIGHT_MS,
          DRAIN_TINT,
          {
            scale: BABYLON_MOVE_EFFECT_DRAIN_BUBBLE_SCALE,
            arc:
              BABYLON_MOVE_EFFECT_DRAIN_ARC_MIN +
              scatter(index) * BABYLON_MOVE_EFFECT_DRAIN_ARC_SPREAD,
            loop: ORB_MIDDLE_FRAMES,
          },
        ),
      );
      return { particles, impactMs: 0 };
    }
    case MoveEffectForm.Heal:
      return {
        particles: [
          ...Array.from({ length: BABYLON_MOVE_EFFECT_HEAL_RINGS }, (_, index) =>
            groundRing(
              "stat-ring",
              origin,
              index * 2 * BABYLON_MOVE_EFFECT_SPREAD_MS_PER_TILE,
              HEAL_TINT,
            ),
          ),
          ...risers(
            context,
            "heal-sparkle",
            origin,
            BABYLON_MOVE_EFFECT_HEAL_SPARKLES,
            HEAL_TINT,
            BABYLON_MOVE_EFFECT_STAT_LIFE_MS,
          ),
        ],
        impactMs: 0,
      };
    case MoveEffectForm.Status: {
      const look = spec.status === undefined ? undefined : STATUS_LOOKS[spec.status];
      if (!look) {
        return { particles: [], impactMs: 0 };
      }
      return {
        particles: look.rising
          ? risers(
              context,
              look.strip,
              origin,
              BABYLON_MOVE_EFFECT_STATUS_RISERS,
              UNTINTED,
              stripLifeMs(look.strip) * 2,
            )
          : [burstAt(look.strip, origin, 0, UNTINTED)],
        impactMs: 0,
      };
    }
    case MoveEffectForm.Shield:
      return { particles: [burstAt("shield", origin, 0, UNTINTED)], impactMs: 0 };
    case MoveEffectForm.Blocked:
      return { particles: [groundRing("blocked-ring", origin, 0, UNTINTED)], impactMs: 0 };
    case MoveEffectForm.Impact:
      // One blow's spark, on the struck Pokémon (the origin); bigger when super effective.
      return {
        particles: [
          burstAt(spec.effectiveness > 1 ? "hit-strong" : "hit", origin, 0, SPARK_TINTS[spec.type]),
        ],
        impactMs: 0,
      };
    case MoveEffectForm.Melee:
    case MoveEffectForm.Rush:
      // The caster's own lunge or run carries these; each blow brings its spark.
      return { particles: [], impactMs: 0 };
  }
}

/** A blast's centre: the footprint tile nearest its middle (an edge or an interception clips it). */
function blastCenter(tiles: readonly Position[], fallback: Position): Position {
  if (tiles.length === 0) {
    return fallback;
  }
  const middle = {
    x: tiles.reduce((sum, tile) => sum + tile.x, 0) / tiles.length,
    y: tiles.reduce((sum, tile) => sum + tile.y, 0) / tiles.length,
  };
  return tiles.reduce((best, tile) =>
    tileDistance(tile, middle) < tileDistance(best, middle) ? tile : best,
  );
}

/** Power gathering onto a tile: particles converging from all around (PMD Origins' gather emitter). */
function gatherOn(context: LayoutContext, tile: Position, tint: Color4): Particle[] {
  const center = context.worldAt(tile);
  return Array.from({ length: BABYLON_MOVE_EFFECT_GATHER_COUNT }, (_, index) => {
    const angle = (index / BABYLON_MOVE_EFFECT_GATHER_COUNT) * Math.PI * 2;
    const from = center.add(
      new Vector3(
        Math.cos(angle) * BABYLON_MOVE_EFFECT_GATHER_RADIUS,
        (scatter(index) - 0.5) * BABYLON_MOVE_EFFECT_GATHER_RADIUS,
        Math.sin(angle) * BABYLON_MOVE_EFFECT_GATHER_RADIUS,
      ),
    );
    return particle(
      "orb",
      from,
      center,
      index * BABYLON_MOVE_EFFECT_GATHER_EVERY_MS,
      BABYLON_MOVE_EFFECT_GATHER_TRAVEL_MS,
      tint,
      {
        scale: BABYLON_MOVE_EFFECT_GATHER_SCALE,
        loop: ORB_MIDDLE_FRAMES,
      },
    );
  });
}

/** Pictures drifting up from a tile, staggered (bubbles, Z, hearts, heal sparkles). */
function risers(
  context: LayoutContext,
  strip: MoveEffectStripKey,
  tile: Position,
  count: number,
  tint: Color4,
  lifeMs: number,
): Particle[] {
  const center = context.worldAt(tile);
  return Array.from({ length: count }, (_, index) => {
    const [offsetX, offsetZ] = AROUND_OFFSETS[index % AROUND_OFFSETS.length] ?? [0, 0];
    const from = center.add(new Vector3(offsetX, 0, offsetZ));
    const to = from.add(new Vector3(0, BABYLON_MOVE_EFFECT_STATUS_DRIFT, 0));
    return particle(strip, from, to, index * BABYLON_MOVE_EFFECT_SPREAD_MS_PER_TILE, lifeMs, tint, {
      scale: scaled(strip),
    });
  });
}

/** A stat change on a tile: strokes rising (up) or falling (down) around the Pokémon. */
function statStrokes(context: LayoutContext, tile: Position, rising: boolean): Particle[] {
  const center = context.worldAt(tile);
  const travel = new Vector3(0, BABYLON_MOVE_EFFECT_STAT_TRAVEL / 2, 0);
  return Array.from({ length: BABYLON_MOVE_EFFECT_STAT_STROKES }, (_, index) => {
    const [offsetX, offsetZ] = AROUND_OFFSETS[index % AROUND_OFFSETS.length] ?? [0, 0];
    const stroke = center.add(new Vector3(offsetX, 0, offsetZ));
    const low = stroke.subtract(travel);
    const high = stroke.add(travel);
    return particle(
      "stat-line",
      rising ? low : high,
      rising ? high : low,
      index * BABYLON_MOVE_EFFECT_SPREAD_MS_PER_TILE,
      BABYLON_MOVE_EFFECT_STAT_LIFE_MS,
      rising ? STAT_UP_TINT : STAT_DOWN_TINT,
      {
        flipped: rising,
      },
    );
  });
}
