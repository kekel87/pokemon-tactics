import { describe, expect, it } from "vitest";
import { PlayerId } from "../enums/player-id";
import { MockPokemon } from "../testing";
import {
  pendingRolloutIndex,
  rolloutEffectivePower,
  rolloutPowerForIndex,
  rolloutRangeForIndex,
} from "./rollout-streak";

const ROLLOUT_MOVE_ID = "rollout";

describe("rollout-streak", () => {
  describe("rolloutPowerForIndex", () => {
    it("doubles each consecutive cast, capped at 480 (canon Rollout)", () => {
      expect([1, 2, 3, 4, 5, 6].map(rolloutPowerForIndex)).toEqual([30, 60, 120, 240, 480, 480]);
    });
  });

  describe("rolloutRangeForIndex", () => {
    it("grows +1 per consecutive cast, capped at 5", () => {
      expect([1, 2, 3, 4, 5, 6].map(rolloutRangeForIndex)).toEqual([2, 3, 4, 5, 5, 5]);
    });
  });

  describe("pendingRolloutIndex", () => {
    const caster = () =>
      MockPokemon.fresh(MockPokemon.base, { id: "c", playerId: PlayerId.Player1 });

    it("is 1 on a fresh start (last move was not Rollout)", () => {
      const pokemon = caster();
      pokemon.lastUsedMoveId = "tackle";
      pokemon.rolloutStreak = 3;
      expect(pendingRolloutIndex(pokemon, ROLLOUT_MOVE_ID)).toBe(1);
    });

    it("is streak+1 when the previous move was Rollout", () => {
      const pokemon = caster();
      pokemon.lastUsedMoveId = ROLLOUT_MOVE_ID;
      pokemon.rolloutStreak = 2;
      expect(pendingRolloutIndex(pokemon, ROLLOUT_MOVE_ID)).toBe(3);
    });

    it("is 1 when no streak has started yet", () => {
      const pokemon = caster();
      expect(pendingRolloutIndex(pokemon, ROLLOUT_MOVE_ID)).toBe(1);
    });
  });

  describe("rolloutEffectivePower", () => {
    const caster = () =>
      MockPokemon.fresh(MockPokemon.base, { id: "c", playerId: PlayerId.Player1 });

    it("matches the streak power without Boul'Armure", () => {
      const pokemon = caster();
      pokemon.lastUsedMoveId = ROLLOUT_MOVE_ID;
      pokemon.rolloutStreak = 4;
      expect(rolloutEffectivePower(pokemon, ROLLOUT_MOVE_ID)).toBe(480);
    });

    it("doubles the streak power once Boul'Armure has been used (up to 960)", () => {
      const pokemon = caster();
      pokemon.usedDefenseCurl = true;
      expect(rolloutEffectivePower(pokemon, ROLLOUT_MOVE_ID)).toBe(60);
      pokemon.lastUsedMoveId = ROLLOUT_MOVE_ID;
      pokemon.rolloutStreak = 4;
      expect(rolloutEffectivePower(pokemon, ROLLOUT_MOVE_ID)).toBe(960);
    });
  });
});
