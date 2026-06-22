import { describe, expect, it } from "vitest";
import { PlayerId } from "../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import type { PokemonInstance } from "../types/pokemon-instance";
import { friendGuardMultiplier } from "./friend-guard-system";

const defender = MockPokemon.fresh(MockPokemon.base, {
  id: "defender",
  playerId: PlayerId.Player1,
  position: { x: 0, y: 0 },
});

const guardian = (
  position: { x: number; y: number },
  overrides: Partial<PokemonInstance> = {},
): PokemonInstance =>
  MockPokemon.fresh(MockPokemon.base, {
    id: "guardian",
    playerId: PlayerId.Player1,
    position,
    abilityId: "friend-guard",
    ...overrides,
  });

describe("friendGuardMultiplier — Garde-Ami (friend-guard)", () => {
  it("returns 0.75 when an ally with Garde-Ami sits within Manhattan r2", () => {
    const { state } = buildMoveTestEngine([defender, guardian({ x: 2, y: 0 })]);
    expect(friendGuardMultiplier(state, defender)).toBe(0.75);
  });

  it("returns 1 when the Garde-Ami ally is beyond r2", () => {
    const { state } = buildMoveTestEngine([defender, guardian({ x: 3, y: 0 })]);
    expect(friendGuardMultiplier(state, defender)).toBe(1);
  });

  it("returns 1 when the Garde-Ami ally is KO", () => {
    const { state } = buildMoveTestEngine([defender, guardian({ x: 1, y: 0 }, { currentHp: 0 })]);
    expect(friendGuardMultiplier(state, defender)).toBe(1);
  });

  it("returns 1 when the only Garde-Ami mon is an enemy (not an ally)", () => {
    const { state } = buildMoveTestEngine([
      defender,
      guardian({ x: 1, y: 0 }, { id: "enemy", playerId: PlayerId.Player2 }),
    ]);
    expect(friendGuardMultiplier(state, defender)).toBe(1);
  });
});
