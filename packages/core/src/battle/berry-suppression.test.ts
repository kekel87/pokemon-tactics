import { describe, expect, it } from "vitest";
import { PlayerId } from "../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { areBerriesSuppressed } from "./berry-suppression";

const holder = MockPokemon.fresh(MockPokemon.base, {
  id: "holder",
  playerId: PlayerId.Player1,
  position: { x: 0, y: 0 },
});

describe("areBerriesSuppressed — Tension (unnerve)", () => {
  it("suppresses when a living enemy carries Tension", () => {
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      abilityId: "unnerve",
    });
    const { state } = buildMoveTestEngine([holder, enemy]);
    expect(areBerriesSuppressed(state, holder)).toBe(true);
  });

  it("does not suppress when the Tension enemy is KO", () => {
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      abilityId: "unnerve",
      currentHp: 0,
    });
    const { state } = buildMoveTestEngine([holder, enemy]);
    expect(areBerriesSuppressed(state, holder)).toBe(false);
  });

  it("does not suppress when only an ally carries Tension (own side)", () => {
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      abilityId: "unnerve",
    });
    const { state } = buildMoveTestEngine([holder, ally]);
    expect(areBerriesSuppressed(state, holder)).toBe(false);
  });
});
