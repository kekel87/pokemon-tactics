import type { MoveDefinition } from "@pokemon-tactic/core";
import { loadData } from "@pokemon-tactic/data";
import { MoveEffectForm } from "@pokemon-tactic/render-ports";
import { describe, expect, it } from "vitest";
import {
  CastPose,
  castPose,
  moveEffectForm,
  movePose,
  TargetRelation,
  targetRelation,
} from "./move-effect-form.js";

const MOVES = loadData().moves;
const MOVES_BY_ID = new Map(MOVES.map((move) => [move.id, move]));

function moveById(id: string): MoveDefinition {
  const move = MOVES_BY_ID.get(id);
  if (!move) {
    throw new Error(`unknown move ${id}`);
  }
  return move;
}

function formOf(id: string): MoveEffectForm {
  const move = moveById(id);
  return moveEffectForm(move, targetRelation(move));
}

const ALL_FORMS: ReadonlySet<string> = new Set(Object.values(MoveEffectForm));

describe("moveEffectForm", () => {
  it.each([
    ["teleport", MoveEffectForm.Vanish],
    ["fly", MoveEffectForm.Vanish],
    ["dig", MoveEffectForm.Vanish],
    ["quick-attack", MoveEffectForm.Rush],
    ["take-down", MoveEffectForm.Rush],
    ["u-turn", MoveEffectForm.Melee],
    ["tackle", MoveEffectForm.Melee],
    ["lick", MoveEffectForm.Melee],
    ["bonemerang", MoveEffectForm.Melee],
  ])("gives %s the %s form", (id, form) => {
    expect(formOf(id)).toBe(form);
  });

  it.each([
    ["razor-leaf", MoveEffectForm.Blade],
    ["air-slash", MoveEffectForm.Blade],
    ["slash", MoveEffectForm.Slash],
    ["cut", MoveEffectForm.Slash],
    ["aerial-ace", MoveEffectForm.Slash],
  ])("tells a thrown blade from a contact slash: %s is %s", (id, form) => {
    expect(formOf(id)).toBe(form);
  });

  it.each([
    ["bite", MoveEffectForm.Bite],
    ["crunch", MoveEffectForm.Bite],
    ["super-fang", MoveEffectForm.Bite],
    ["leech-life", MoveEffectForm.Bite],
    ["thunder-punch", MoveEffectForm.Punch],
    ["rock-smash", MoveEffectForm.Punch],
    ["feint", MoveEffectForm.Punch],
    ["scratch", MoveEffectForm.Claw],
    ["dragon-claw", MoveEffectForm.Claw],
    ["fury-swipes", MoveEffectForm.Claw],
    ["double-kick", MoveEffectForm.Kick],
    ["stomp", MoveEffectForm.Kick],
    ["karate-chop", MoveEffectForm.Chop],
    ["knock-off", MoveEffectForm.Chop],
    ["peck", MoveEffectForm.Jab],
    ["poison-jab", MoveEffectForm.Jab],
    ["poison-sting", MoveEffectForm.Jab],
    ["drill-peck", MoveEffectForm.Jab],
  ])("reads the melee family of %s from its flags or lists: %s", (id, form) => {
    expect(formOf(id)).toBe(form);
  });

  it.each([
    ["sing", MoveEffectForm.Song],
    ["round", MoveEffectForm.Song],
    ["perish-song", MoveEffectForm.Song],
    ["growl", MoveEffectForm.Cry],
    ["roar", MoveEffectForm.Cry],
    ["uproar", MoveEffectForm.Cry],
    ["howl", MoveEffectForm.Cry],
    ["supersonic", MoveEffectForm.TargetWave],
    ["screech", MoveEffectForm.TargetWave],
    ["hyper-voice", MoveEffectForm.SoundWave],
    ["bug-buzz", MoveEffectForm.SoundWave],
  ])("gives the sound move %s the %s form", (id, form) => {
    expect(formOf(id)).toBe(form);
  });

  it.each([
    ["leer", MoveEffectForm.Gaze],
    ["glare", MoveEffectForm.Gaze],
    ["mean-look", MoveEffectForm.Gaze],
    ["thunder-wave", MoveEffectForm.TargetWave],
    ["hypnosis", MoveEffectForm.TargetWave],
    ["heal-pulse", MoveEffectForm.TargetWave],
    ["protect", MoveEffectForm.Screen],
    ["reflect", MoveEffectForm.Screen],
    ["withdraw", MoveEffectForm.Screen],
    ["iron-defense", MoveEffectForm.Screen],
    ["poison-powder", MoveEffectForm.StatusCloud],
    ["sleep-powder", MoveEffectForm.StatusCloud],
    ["sand-attack", MoveEffectForm.StatusCloud],
    ["spikes", MoveEffectForm.GroundMarker],
    ["stealth-rock", MoveEffectForm.GroundMarker],
    ["helping-hand", MoveEffectForm.AllyBuff],
    ["wish", MoveEffectForm.AllyBuff],
    ["swords-dance", MoveEffectForm.Concentration],
    ["recover", MoveEffectForm.Concentration],
    ["toxic", MoveEffectForm.TargetStatus],
    ["will-o-wisp", MoveEffectForm.TargetStatus],
  ])("gives the status move %s the %s form", (id, form) => {
    expect(formOf(id)).toBe(form);
  });

  it.each([
    [TargetRelation.Enemy, MoveEffectForm.TargetStatus],
    [TargetRelation.Ally, MoveEffectForm.AllyBuff],
    [TargetRelation.Self, MoveEffectForm.Concentration],
  ])("follows the relation for a single-target status landing on %s", (relation, form) => {
    expect(moveEffectForm(moveById("toxic"), relation)).toBe(form);
  });

  it.each([
    ["counter", MoveEffectForm.Screen],
    ["mirror-coat", MoveEffectForm.Screen],
    ["metal-burst", MoveEffectForm.Concentration],
  ])("gives the damaging self move %s the %s form", (id, form) => {
    expect(formOf(id)).toBe(form);
  });

  it.each([
    ["flamethrower", MoveEffectForm.Stream],
    ["hydro-pump", MoveEffectForm.Stream],
    ["psybeam", MoveEffectForm.Stream],
    ["ice-beam", MoveEffectForm.Beam],
    ["solar-beam", MoveEffectForm.Beam],
    ["gust", MoveEffectForm.Wind],
    ["heat-wave", MoveEffectForm.Wind],
    ["razor-wind", MoveEffectForm.Breath],
    ["sludge-bomb", MoveEffectForm.Blast],
    ["fire-blast", MoveEffectForm.Blast],
    ["earthquake", MoveEffectForm.Burst],
    ["surf", MoveEffectForm.Burst],
    ["night-shade", MoveEffectForm.Burst],
    ["ember", MoveEffectForm.Projectile],
    ["rock-throw", MoveEffectForm.Projectile],
    ["psychic", MoveEffectForm.Projectile],
  ])("gives the ranged move %s the %s form", (id, form) => {
    expect(formOf(id)).toBe(form);
  });

  it("gives every move of the game a known form", () => {
    const unformed = MOVES.filter((move) => !ALL_FORMS.has(formOf(move.id))).map((move) => move.id);
    expect(unformed).toEqual([]);
  });
});

describe("targetRelation", () => {
  const caster = { x: 2, y: 2 };

  it("is self when every affected tile is the caster's", () => {
    expect(
      targetRelation(moveById("wish"), { caster, affectedTiles: [caster, { ...caster }] }),
    ).toBe(TargetRelation.Self);
  });

  it("is not self when the footprint reaches past the caster", () => {
    expect(
      targetRelation(moveById("swords-dance"), {
        caster,
        affectedTiles: [caster, { x: 2, y: 3 }],
      }),
    ).toBe(TargetRelation.Enemy);
  });

  it("is not self on an empty footprint, even for a self-targeting move", () => {
    expect(targetRelation(moveById("swords-dance"), { caster, affectedTiles: [] })).toBe(
      TargetRelation.Enemy,
    );
  });

  it.each([
    ["helping-hand", TargetRelation.Ally],
    ["wish", TargetRelation.Ally],
    ["tackle", TargetRelation.Enemy],
  ])("reads %s off the move's ally flags when it lands elsewhere: %s", (id, relation) => {
    expect(targetRelation(moveById(id), { caster, affectedTiles: [{ x: 3, y: 2 }] })).toBe(
      relation,
    );
  });

  it.each([
    ["swords-dance", TargetRelation.Self],
    ["helping-hand", TargetRelation.Ally],
    ["ember", TargetRelation.Enemy],
  ])("falls back on the targeting without a footprint: %s is %s", (id, relation) => {
    expect(targetRelation(moveById(id))).toBe(relation);
  });
});

describe("castPose", () => {
  it.each([
    ["tackle", CastPose.Attack],
    ["bite", CastPose.Attack],
    ["quick-attack", CastPose.Attack],
    ["dig", CastPose.Attack],
    ["earthquake", CastPose.Attack],
    ["magnitude", CastPose.Attack],
    ["rapid-spin", CastPose.Attack],
    ["petal-blizzard", CastPose.Shoot],
    ["surf", CastPose.Shoot],
    ["razor-leaf", CastPose.Shoot],
    ["air-slash", CastPose.Shoot],
    ["rock-throw", CastPose.Shoot],
    ["flamethrower", CastPose.Shoot],
    ["thunder-wave", CastPose.Shoot],
    ["protect", CastPose.Charge],
    ["swords-dance", CastPose.Charge],
    ["helping-hand", CastPose.Charge],
  ])("poses %s as %s", (id, pose) => {
    expect(movePose(moveById(id))).toBe(pose);
  });

  it("gathers power for a two-turn move's charge", () => {
    expect(castPose(MoveEffectForm.Charge, moveById("solar-beam"))).toBe(CastPose.Charge);
  });

  it("strikes the ground only for a physical burst", () => {
    expect(castPose(MoveEffectForm.Burst, moveById("earthquake"))).toBe(CastPose.Attack);
    expect(castPose(MoveEffectForm.Projectile, moveById("earthquake"))).toBe(CastPose.Shoot);
  });
});
