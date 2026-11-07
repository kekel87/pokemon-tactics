import { describe, expect, it } from "vitest";
import { FieldGlobalKind } from "../enums/field-global-kind";
import { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import { MockBattle, MockPokemon } from "../testing";
import { isAirborneAt, isAirborneIgnoringZones, isEffectivelyFlying } from "./effective-flying";
import { postFieldGlobalZone } from "./field-global-system";

const NO_ZONE_STATE = MockBattle.stateFrom([]);

function zoneScenario(
  kind: FieldGlobalKind,
  holderOverrides: Parameters<typeof MockPokemon.fresh>[1],
) {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
  });
  const holder = MockPokemon.fresh(MockPokemon.base, {
    id: "holder",
    playerId: PlayerId.Player2,
    position: { x: 6, y: 5 },
    ...holderOverrides,
  });
  const state = MockBattle.stateFrom([caster, holder], 12, 12);
  postFieldGlobalZone(state, caster, kind);
  return { state, holder };
}

describe("isEffectivelyFlying — Ballon (air-balloon)", () => {
  it("treats a grounded Air Balloon holder as airborne", () => {
    const holder = MockPokemon.fresh(MockPokemon.base, {
      heldItemId: HeldItemId.AirBalloon,
    });
    expect(isEffectivelyFlying(NO_ZONE_STATE, holder, [PokemonType.Normal])).toBe(true);
  });

  it("reverts to grounded once the balloon has popped (item cleared)", () => {
    const popped = MockPokemon.fresh(MockPokemon.base, {
      heldItemId: undefined,
    });
    expect(isEffectivelyFlying(NO_ZONE_STATE, popped, [PokemonType.Normal])).toBe(false);
  });

  it("Ingrain grounds the holder even while the balloon is held", () => {
    const rooted = MockPokemon.fresh(MockPokemon.base, {
      heldItemId: HeldItemId.AirBalloon,
      volatileStatuses: [{ type: StatusType.Ingrain, remainingTurns: 1 }],
    });
    expect(isEffectivelyFlying(NO_ZONE_STATE, rooted, [PokemonType.Normal])).toBe(false);
  });

  it("Roost grounds the holder even while the balloon is held", () => {
    const roosted = MockPokemon.fresh(MockPokemon.base, {
      heldItemId: HeldItemId.AirBalloon,
      volatileStatuses: [{ type: StatusType.Roosted, remainingTurns: 1 }],
    });
    expect(isEffectivelyFlying(NO_ZONE_STATE, roosted, [PokemonType.Normal])).toBe(false);
  });

  it("a Flying-type without the balloon is still airborne", () => {
    const flyer = MockPokemon.fresh(MockPokemon.base, {});
    expect(isEffectivelyFlying(NO_ZONE_STATE, flyer, [PokemonType.Flying])).toBe(true);
  });

  it("a grounded non-flyer without the balloon is grounded", () => {
    const grounded = MockPokemon.fresh(MockPokemon.base, {});
    expect(isEffectivelyFlying(NO_ZONE_STATE, grounded, [PokemonType.Normal])).toBe(false);
  });
});

describe("isEffectivelyFlying — Vol Magnétik (magnet-rise)", () => {
  it("a levitating mon is airborne while the counter is positive", () => {
    const levitating = MockPokemon.fresh(MockPokemon.base, { magnetRiseTurns: 5 });
    expect(isEffectivelyFlying(NO_ZONE_STATE, levitating, [PokemonType.Normal])).toBe(true);
  });

  it("stops being airborne once the counter is cleared", () => {
    const expired = MockPokemon.fresh(MockPokemon.base, { magnetRiseTurns: undefined });
    expect(isEffectivelyFlying(NO_ZONE_STATE, expired, [PokemonType.Normal])).toBe(false);
  });

  it("is grounded by Ingrain even while levitating", () => {
    const rooted = MockPokemon.fresh(MockPokemon.base, {
      magnetRiseTurns: 5,
      volatileStatuses: [{ type: StatusType.Ingrain, remainingTurns: -1 }],
    });
    expect(isEffectivelyFlying(NO_ZONE_STATE, rooted, [PokemonType.Normal])).toBe(false);
  });
});

describe("isEffectivelyFlying — Zone Magique (magic-room)", () => {
  it("a Ballon holder standing in a Zone Magique is grounded", () => {
    const { state, holder } = zoneScenario(FieldGlobalKind.MagicRoom, {
      heldItemId: HeldItemId.AirBalloon,
    });
    expect(isEffectivelyFlying(state, holder, [PokemonType.Normal])).toBe(false);
    expect(holder.heldItemId).toBe(HeldItemId.AirBalloon);
  });

  it("the same holder floats again on a tile outside the zone", () => {
    const { state, holder } = zoneScenario(FieldGlobalKind.MagicRoom, {
      heldItemId: HeldItemId.AirBalloon,
    });
    expect(isEffectivelyFlying(state, holder, [PokemonType.Normal], { x: 11, y: 11 })).toBe(true);
  });

  it("Lévitation and the Flying type are not items: still airborne in the zone", () => {
    const levitating = zoneScenario(FieldGlobalKind.MagicRoom, { abilityId: "levitate" });
    expect(isEffectivelyFlying(levitating.state, levitating.holder, [PokemonType.Normal])).toBe(
      true,
    );
    const flyer = zoneScenario(FieldGlobalKind.MagicRoom, {});
    expect(isEffectivelyFlying(flyer.state, flyer.holder, [PokemonType.Flying])).toBe(true);
  });

  it("isAirborneIgnoringZones keeps the Ballon whatever the zone", () => {
    const { holder } = zoneScenario(FieldGlobalKind.MagicRoom, {
      heldItemId: HeldItemId.AirBalloon,
    });
    expect(isAirborneIgnoringZones(holder, [PokemonType.Normal])).toBe(true);
  });
});

describe("isAirborneAt — Gravité and Anti-Air judged per tile", () => {
  it("a flyer is grounded on a Gravité tile and airborne off it", () => {
    const { state, holder } = zoneScenario(FieldGlobalKind.Gravity, {});
    expect(isAirborneAt(state, holder, [PokemonType.Flying])).toBe(false);
    expect(isAirborneAt(state, holder, [PokemonType.Flying], { x: 11, y: 11 })).toBe(true);
  });

  it("a smacked-down flyer is grounded on every tile", () => {
    const { state, holder } = zoneScenario(FieldGlobalKind.WonderRoom, { smackedDown: true });
    expect(isAirborneAt(state, holder, [PokemonType.Flying], { x: 11, y: 11 })).toBe(false);
  });
});
