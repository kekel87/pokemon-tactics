import { describe, expect, it } from "vitest";
import { FieldGlobalKind } from "../enums/field-global-kind";
import { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import {
  decrementFieldGlobalTimer,
  FIELD_GLOBAL_DEFAULT_DURATION,
  isGroundedByGravityZone,
  isHeldItemSuppressed,
  isInFieldGlobalZone,
  postFieldGlobalZone,
} from "./field-global-system";

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

describe("postFieldGlobalZone", () => {
  it("posts a Manhattan-diamond zone centered on the caster (25 tiles, r3, 5 turns)", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    postFieldGlobalZone(state, caster, FieldGlobalKind.Gravity);
    expect(state.fieldGlobalZones).toHaveLength(1);
    expect(state.fieldGlobalZones[0]?.tiles.length).toBe(25);
    expect(state.fieldGlobalZones[0]?.kind).toBe(FieldGlobalKind.Gravity);
    expect(state.fieldGlobalZones[0]?.remainingTurns).toBe(FIELD_GLOBAL_DEFAULT_DURATION);
  });

  it("replaces a same-kind zone re-posted on the exact same epicenter", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    postFieldGlobalZone(state, caster, FieldGlobalKind.Gravity);
    state.fieldGlobalZones[0]!.remainingTurns = 2;
    postFieldGlobalZone(state, caster, FieldGlobalKind.Gravity);
    expect(state.fieldGlobalZones).toHaveLength(1);
    expect(state.fieldGlobalZones[0]?.remainingTurns).toBe(FIELD_GLOBAL_DEFAULT_DURATION);
  });

  it("coexists with a different kind posted on the same epicenter", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    postFieldGlobalZone(state, caster, FieldGlobalKind.Gravity);
    postFieldGlobalZone(state, caster, FieldGlobalKind.MagicRoom);
    expect(state.fieldGlobalZones).toHaveLength(2);
  });
});

describe("isInFieldGlobalZone", () => {
  it("matches only the queried kind inside the diamond", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    postFieldGlobalZone(state, caster, FieldGlobalKind.WonderRoom);
    expect(isInFieldGlobalZone(state, { x: 5, y: 5 }, FieldGlobalKind.WonderRoom)).toBe(true);
    expect(isInFieldGlobalZone(state, { x: 5, y: 5 }, FieldGlobalKind.Gravity)).toBe(false);
    expect(isInFieldGlobalZone(state, { x: 9, y: 5 }, FieldGlobalKind.WonderRoom)).toBe(false);
  });
});

describe("isHeldItemSuppressed", () => {
  it("suppresses the held item of a holder standing in a Zone Magique", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    const foe = state.pokemon.get("foe");
    if (!caster || !foe) {
      throw new Error("missing mons");
    }
    foe.position = { x: 6, y: 5 };
    foe.heldItemId = HeldItemId.LifeOrb;
    postFieldGlobalZone(state, caster, FieldGlobalKind.MagicRoom);
    expect(isHeldItemSuppressed(state, foe)).toBe(true);
    foe.position = { x: 9, y: 9 };
    expect(isHeldItemSuppressed(state, foe)).toBe(false);
  });
});

describe("isGroundedByGravityZone", () => {
  it("grounds a mon standing in a Gravité zone only", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    const foe = state.pokemon.get("foe");
    if (!caster || !foe) {
      throw new Error("missing mons");
    }
    foe.position = { x: 6, y: 5 };
    postFieldGlobalZone(state, caster, FieldGlobalKind.Gravity);
    expect(isGroundedByGravityZone(state, foe)).toBe(true);
    postFieldGlobalZone(state, caster, FieldGlobalKind.WonderRoom);
    foe.position = { x: 9, y: 9 };
    expect(isGroundedByGravityZone(state, foe)).toBe(false);
  });
});

describe("decrementFieldGlobalTimer — caster turns only", () => {
  it("only decrements zones owned by the acting caster", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    const foe = state.pokemon.get("foe");
    if (!caster || !foe) {
      throw new Error("missing mons");
    }
    postFieldGlobalZone(state, caster, FieldGlobalKind.Gravity);
    postFieldGlobalZone(state, foe, FieldGlobalKind.MagicRoom);
    const expired = decrementFieldGlobalTimer(state, "caster");
    expect(expired).toHaveLength(0);
    expect(state.fieldGlobalZones.find((z) => z.casterId === "caster")?.remainingTurns).toBe(4);
    expect(state.fieldGlobalZones.find((z) => z.casterId === "foe")?.remainingTurns).toBe(5);
  });

  it("removes and reports a zone that reaches zero", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    postFieldGlobalZone(state, caster, FieldGlobalKind.Gravity);
    let expired: ReturnType<typeof decrementFieldGlobalTimer> = [];
    for (let i = 0; i < FIELD_GLOBAL_DEFAULT_DURATION; i++) {
      expired = decrementFieldGlobalTimer(state, "caster");
    }
    expect(state.fieldGlobalZones).toHaveLength(0);
    expect(expired).toEqual([{ kind: FieldGlobalKind.Gravity, casterId: "caster" }]);
  });
});
