import { describe, expect, it } from "vitest";
import { HeldItemId } from "../enums/held-item-id";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import { MockPokemon } from "../testing";
import { isEffectivelyFlying } from "./effective-flying";

describe("isEffectivelyFlying — Ballon (air-balloon)", () => {
  it("treats a grounded Air Balloon holder as airborne", () => {
    const holder = MockPokemon.fresh(MockPokemon.base, {
      heldItemId: HeldItemId.AirBalloon,
    });
    expect(isEffectivelyFlying(holder, [PokemonType.Normal])).toBe(true);
  });

  it("reverts to grounded once the balloon has popped (item cleared)", () => {
    const popped = MockPokemon.fresh(MockPokemon.base, {
      heldItemId: undefined,
    });
    expect(isEffectivelyFlying(popped, [PokemonType.Normal])).toBe(false);
  });

  it("Ingrain grounds the holder even while the balloon is held", () => {
    const rooted = MockPokemon.fresh(MockPokemon.base, {
      heldItemId: HeldItemId.AirBalloon,
      volatileStatuses: [{ type: StatusType.Ingrain, remainingTurns: 1 }],
    });
    expect(isEffectivelyFlying(rooted, [PokemonType.Normal])).toBe(false);
  });

  it("Roost grounds the holder even while the balloon is held", () => {
    const roosted = MockPokemon.fresh(MockPokemon.base, {
      heldItemId: HeldItemId.AirBalloon,
      volatileStatuses: [{ type: StatusType.Roosted, remainingTurns: 1 }],
    });
    expect(isEffectivelyFlying(roosted, [PokemonType.Normal])).toBe(false);
  });

  it("a Flying-type without the balloon is still airborne", () => {
    const flyer = MockPokemon.fresh(MockPokemon.base, {});
    expect(isEffectivelyFlying(flyer, [PokemonType.Flying])).toBe(true);
  });

  it("a grounded non-flyer without the balloon is grounded", () => {
    const grounded = MockPokemon.fresh(MockPokemon.base, {});
    expect(isEffectivelyFlying(grounded, [PokemonType.Normal])).toBe(false);
  });
});

describe("isEffectivelyFlying — Vol Magnétik (magnet-rise)", () => {
  it("a levitating mon is airborne while the counter is positive", () => {
    const levitating = MockPokemon.fresh(MockPokemon.base, { magnetRiseTurns: 5 });
    expect(isEffectivelyFlying(levitating, [PokemonType.Normal])).toBe(true);
  });

  it("stops being airborne once the counter is cleared", () => {
    const expired = MockPokemon.fresh(MockPokemon.base, { magnetRiseTurns: undefined });
    expect(isEffectivelyFlying(expired, [PokemonType.Normal])).toBe(false);
  });

  it("is grounded by Ingrain even while levitating", () => {
    const rooted = MockPokemon.fresh(MockPokemon.base, {
      magnetRiseTurns: 5,
      volatileStatuses: [{ type: StatusType.Ingrain, remainingTurns: -1 }],
    });
    expect(isEffectivelyFlying(rooted, [PokemonType.Normal])).toBe(false);
  });
});
