import { describe, expect, it } from "vitest";
import { PlayerId } from "../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import {
  DISTORTION_DEFAULT_DURATION,
  DISTORTION_SPEED_PIVOT,
  decrementDistortionTimer,
  invertedDistortionSpeed,
  isInDistortionZone,
  postDistortion,
} from "./distortion-system";

function freshState() {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 9, y: 9 },
  });
  return buildMoveTestEngine([caster, foe], { gridSize: 10 });
}

describe("invertedDistortionSpeed — speed reflection", () => {
  it("reflects base Speed around the pivot so slow becomes fast and vice-versa", () => {
    expect(invertedDistortionSpeed(20)).toBe(DISTORTION_SPEED_PIVOT - 20);
    expect(invertedDistortionSpeed(150)).toBe(DISTORTION_SPEED_PIVOT - 150);
    expect(invertedDistortionSpeed(20)).toBeGreaterThan(invertedDistortionSpeed(150));
  });

  it("clamps to a positive floor of 1 for a base Speed above the pivot", () => {
    expect(invertedDistortionSpeed(DISTORTION_SPEED_PIVOT + 50)).toBe(1);
  });
});

describe("postDistortion — Champs-style posting", () => {
  it("posts a Manhattan-diamond zone centered on the caster (25 tiles, r3, 5 turns)", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    postDistortion(state, caster);
    expect(state.distortionZones).toHaveLength(1);
    expect(state.distortionZones[0]?.tiles.length).toBe(25);
    expect(state.distortionZones[0]?.remainingTurns).toBe(DISTORTION_DEFAULT_DURATION);
    expect(state.distortionZones[0]?.anchor).toEqual({ x: 5, y: 5 });
  });

  it("replaces (refreshes) a zone re-posted on the exact same epicenter", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    postDistortion(state, caster);
    state.distortionZones[0]!.remainingTurns = 2;
    postDistortion(state, caster);
    expect(state.distortionZones).toHaveLength(1);
    expect(state.distortionZones[0]?.remainingTurns).toBe(DISTORTION_DEFAULT_DURATION);
  });

  it("coexists with a second zone posted on a different epicenter", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    postDistortion(state, caster);
    caster.position = { x: 1, y: 1 };
    postDistortion(state, caster);
    expect(state.distortionZones).toHaveLength(2);
  });
});

describe("isInDistortionZone", () => {
  it("is true inside the zone and false outside it", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    postDistortion(state, caster);
    expect(isInDistortionZone(state, { x: 5, y: 5 })).toBe(true);
    expect(isInDistortionZone(state, { x: 7, y: 5 })).toBe(true);
    expect(isInDistortionZone(state, { x: 9, y: 5 })).toBe(false);
  });
});

describe("decrementDistortionTimer — caster turns only", () => {
  it("only decrements the zones owned by the acting caster", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    const foe = state.pokemon.get("foe");
    if (!caster || !foe) {
      throw new Error("missing mons");
    }
    postDistortion(state, caster);
    postDistortion(state, foe);
    const expired = decrementDistortionTimer(state, "caster");
    expect(expired).toHaveLength(0);
    expect(state.distortionZones.find((z) => z.casterId === "caster")?.remainingTurns).toBe(4);
    expect(state.distortionZones.find((z) => z.casterId === "foe")?.remainingTurns).toBe(5);
  });

  it("removes and reports a zone that reaches zero", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    postDistortion(state, caster);
    let expired: ReturnType<typeof decrementDistortionTimer> = [];
    for (let i = 0; i < DISTORTION_DEFAULT_DURATION; i++) {
      expired = decrementDistortionTimer(state, "caster");
    }
    expect(state.distortionZones).toHaveLength(0);
    expect(expired).toEqual([{ casterId: "caster" }]);
  });
});
