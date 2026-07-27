import { loadData } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { PlayerId } from "../enums/player-id";
import { MockMove, MockPokemon } from "../testing";
import { effectiveCritChance, getCritChance } from "./crit-chance";

const { abilityRegistry } = loadData();

const attacker = () => MockPokemon.fresh(MockPokemon.base, { id: "a", playerId: PlayerId.Player1 });
const defender = () => MockPokemon.fresh(MockPokemon.base, { id: "d", playerId: PlayerId.Player2 });

const critImmuneDefender = () =>
  MockPokemon.fresh(MockPokemon.base, {
    id: "d",
    playerId: PlayerId.Player2,
    abilityId: "battle-armor",
  });

describe("crit-chance", () => {
  describe("getCritChance", () => {
    it("follows the Gen 6+ ladder and saturates past the last stage", () => {
      expect([0, 1, 2, 3, 4].map(getCritChance)).toEqual([1 / 24, 1 / 8, 0.5, 1.0, 1.0]);
    });

    it("clamps a negative stage to the base rate", () => {
      expect(getCritChance(-3)).toBe(1 / 24);
    });
  });

  describe("effectiveCritChance", () => {
    it("is the base rate for a plain move", () => {
      expect(effectiveCritChance(attacker(), defender(), MockMove.physical)).toBe(1 / 24);
    });

    it("adds the move's own crit ratio", () => {
      const highCrit = { ...MockMove.physical, critRatio: 2 };
      expect(effectiveCritChance(attacker(), defender(), highCrit)).toBe(0.5);
    });

    it("adds the attacker's volatile crit boost, cumulating with the move ratio", () => {
      const self = attacker();
      self.critStageBoost = 1;
      const highCrit = { ...MockMove.physical, critRatio: 1 };
      expect(effectiveCritChance(self, defender(), highCrit)).toBe(0.5);
    });

    it("adds the held item's crit stage boost", () => {
      const scopeLens = { onCritStageBoost: () => 2 };
      expect(effectiveCritChance(attacker(), defender(), MockMove.physical, scopeLens)).toBe(0.5);
    });

    it("is exactly 1 when the move always crits", () => {
      const alwaysCrit = { ...MockMove.physical, alwaysCrit: true };
      expect(effectiveCritChance(attacker(), defender(), alwaysCrit)).toBe(1);
    });

    it("is exactly 1 when the attacker armed a guaranteed crit", () => {
      const self = attacker();
      self.guaranteedCritArmed = true;
      expect(effectiveCritChance(self, defender(), MockMove.physical)).toBe(1);
    });

    it("is exactly 0 against a crit-immune defender", () => {
      expect(
        effectiveCritChance(
          attacker(),
          critImmuneDefender(),
          MockMove.physical,
          undefined,
          abilityRegistry,
        ),
      ).toBe(0);
    });

    it("lets crit immunity win over a forced crit", () => {
      const self = attacker();
      self.guaranteedCritArmed = true;
      const alwaysCrit = { ...MockMove.physical, alwaysCrit: true };
      expect(
        effectiveCritChance(self, critImmuneDefender(), alwaysCrit, undefined, abilityRegistry),
      ).toBe(0);
    });
  });
});
