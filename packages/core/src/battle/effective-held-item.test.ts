import { loadData } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { FieldGlobalKind } from "../enums/field-global-kind";
import { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { effectiveHeldItem } from "./effective-held-item";
import { postFieldGlobalZone } from "./field-global-system";

const itemRegistry = loadData().itemRegistry;

function freshState() {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 6, y: 5 },
    heldItemId: HeldItemId.Leftovers,
  });
  return buildMoveTestEngine([caster, foe], { gridSize: 10 });
}

describe("effectiveHeldItem", () => {
  it("returns the registry definition of a holder outside any Zone Magique", () => {
    const { state } = freshState();
    const foe = state.pokemon.get("foe");
    if (!foe) {
      throw new Error("missing foe");
    }
    expect(effectiveHeldItem(state, foe, itemRegistry)?.id).toBe(HeldItemId.Leftovers);
  });

  it("returns undefined for a holder standing in a Zone Magique", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    const foe = state.pokemon.get("foe");
    if (!caster || !foe) {
      throw new Error("missing mons");
    }
    postFieldGlobalZone(state, caster, FieldGlobalKind.MagicRoom);
    expect(effectiveHeldItem(state, foe, itemRegistry)).toBeUndefined();
  });

  it("un-suppresses the item once the holder leaves the Zone Magique", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    const foe = state.pokemon.get("foe");
    if (!caster || !foe) {
      throw new Error("missing mons");
    }
    postFieldGlobalZone(state, caster, FieldGlobalKind.MagicRoom);
    foe.position = { x: 9, y: 9 };
    expect(effectiveHeldItem(state, foe, itemRegistry)?.id).toBe(HeldItemId.Leftovers);
  });

  it("returns undefined when no registry is provided", () => {
    const { state } = freshState();
    const foe = state.pokemon.get("foe");
    if (!foe) {
      throw new Error("missing foe");
    }
    expect(effectiveHeldItem(state, foe, undefined)).toBeUndefined();
  });
});
