import { describe, expect, it } from "vitest";
import { PlayerId } from "../enums/player-id";
import { MockPokemon } from "../testing";
import { findDampInTargets } from "./damp-system";

const plainTarget = MockPokemon.fresh(MockPokemon.base, {
  id: "plain",
  playerId: PlayerId.Player2,
});
const dampTarget = MockPokemon.fresh(MockPokemon.base, {
  id: "damp",
  playerId: PlayerId.Player2,
  abilityId: "damp",
});

describe("findDampInTargets — Moiteur (damp), relational", () => {
  it("returns undefined when no target carries Moiteur", () => {
    expect(findDampInTargets([plainTarget])).toBeUndefined();
  });

  it("returns the Moiteur holder when it is among the targets", () => {
    expect(findDampInTargets([plainTarget, dampTarget])?.id).toBe("damp");
  });

  it("returns undefined when the only Moiteur target is KO", () => {
    const koDamp = MockPokemon.fresh(MockPokemon.base, {
      id: "damp",
      playerId: PlayerId.Player2,
      abilityId: "damp",
      currentHp: 0,
    });
    expect(findDampInTargets([plainTarget, koDamp])).toBeUndefined();
  });

  it("returns undefined for an empty target list", () => {
    expect(findDampInTargets([])).toBeUndefined();
  });
});
