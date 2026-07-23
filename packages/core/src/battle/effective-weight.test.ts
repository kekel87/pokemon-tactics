import { describe, expect, it } from "vitest";
import { FieldGlobalKind } from "../enums/field-global-kind";
import { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { effectiveWeight } from "./effective-weight";
import { postFieldGlobalZone } from "./field-global-system";

describe("effectiveWeight", () => {
  it("returns the species weight without a Pierrallégée", () => {
    const mon = MockPokemon.fresh(MockPokemon.base, { weight: 10 });
    expect(effectiveWeight(mon)).toBe(10);
  });

  it("halves the weight for a Pierrallégée (float-stone) holder", () => {
    const mon = MockPokemon.fresh(MockPokemon.base, {
      weight: 10,
      heldItemId: HeldItemId.FloatStone,
    });
    expect(effectiveWeight(mon)).toBe(5);
  });

  it("keeps the halving when no state is passed (tooltip preview / snapshot path)", () => {
    const mon = MockPokemon.fresh(MockPokemon.base, {
      weight: 10,
      heldItemId: HeldItemId.FloatStone,
    });
    expect(effectiveWeight(mon, undefined)).toBe(5);
  });

  it("suppresses the Pierrallégée halving for a holder standing in a Zone Magique", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
    });
    const holder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      playerId: PlayerId.Player2,
      position: { x: 6, y: 5 },
      weight: 10,
      heldItemId: HeldItemId.FloatStone,
    });
    const { state } = buildMoveTestEngine([caster, holder], { gridSize: 10 });
    const zoned = state.pokemon.get("holder");
    const zoneCaster = state.pokemon.get("caster");
    if (!zoned || !zoneCaster) {
      throw new Error("missing mons");
    }
    postFieldGlobalZone(state, zoneCaster, FieldGlobalKind.MagicRoom);
    expect(effectiveWeight(zoned, state)).toBe(10);
    zoned.position = { x: 9, y: 9 };
    expect(effectiveWeight(zoned, state)).toBe(5);
  });
});
