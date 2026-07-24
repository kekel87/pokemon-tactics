import { loadData } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { FieldGlobalKind } from "../enums/field-global-kind";
import { HeldItemId } from "../enums/held-item-id";
import { PokemonType } from "../enums/pokemon-type";
import { MockBattle, MockMove, MockPokemon } from "../testing";
import { postFieldGlobalZone } from "./field-global-system";
import { isImmuneToPowderMove } from "./powder-immunity";

const itemRegistry = loadData().itemRegistry;
const powderMove = MockMove.fresh(MockMove.status, { flags: { powder: true } });
const nonPowderMove = MockMove.fresh(MockMove.status, { flags: { powder: false } });

describe("isImmuneToPowderMove", () => {
  it("returns false for a non-powder move regardless of type", () => {
    const target = MockPokemon.fresh(MockPokemon.base);
    const attacker = MockPokemon.fresh(MockPokemon.base, { id: "attacker" });
    const state = MockBattle.stateFrom([target, attacker]);
    expect(
      isImmuneToPowderMove(
        state,
        target,
        nonPowderMove,
        [PokemonType.Grass],
        attacker,
        undefined,
        undefined,
      ),
    ).toBe(false);
  });

  it("returns true for a powder move against a Grass-type target", () => {
    const target = MockPokemon.fresh(MockPokemon.base);
    const attacker = MockPokemon.fresh(MockPokemon.base, { id: "attacker" });
    const state = MockBattle.stateFrom([target, attacker]);
    expect(
      isImmuneToPowderMove(
        state,
        target,
        powderMove,
        [PokemonType.Grass, PokemonType.Poison],
        attacker,
        undefined,
        undefined,
      ),
    ).toBe(true);
  });

  it("returns false for a powder move against a non-immune target", () => {
    const target = MockPokemon.fresh(MockPokemon.base);
    const attacker = MockPokemon.fresh(MockPokemon.base, { id: "attacker" });
    const state = MockBattle.stateFrom([target, attacker]);
    expect(
      isImmuneToPowderMove(
        state,
        target,
        powderMove,
        [PokemonType.Fire],
        attacker,
        undefined,
        undefined,
      ),
    ).toBe(false);
  });

  it("returns true for a Lunettes Filtre holder against a powder move", () => {
    const target = MockPokemon.fresh(MockPokemon.base, { heldItemId: HeldItemId.SafetyGoggles });
    const attacker = MockPokemon.fresh(MockPokemon.base, { id: "attacker" });
    const state = MockBattle.stateFrom([target, attacker]);
    expect(
      isImmuneToPowderMove(
        state,
        target,
        powderMove,
        [PokemonType.Fire],
        attacker,
        undefined,
        itemRegistry,
      ),
    ).toBe(true);
  });

  it("returns false when the Lunettes Filtre holder stands in a Zone Magique", () => {
    const target = MockPokemon.fresh(MockPokemon.base, { heldItemId: HeldItemId.SafetyGoggles });
    const attacker = MockPokemon.fresh(MockPokemon.base, { id: "attacker" });
    const state = MockBattle.stateFrom([target, attacker]);
    postFieldGlobalZone(state, target, FieldGlobalKind.MagicRoom);
    expect(
      isImmuneToPowderMove(
        state,
        target,
        powderMove,
        [PokemonType.Fire],
        attacker,
        undefined,
        itemRegistry,
      ),
    ).toBe(false);
  });
});
