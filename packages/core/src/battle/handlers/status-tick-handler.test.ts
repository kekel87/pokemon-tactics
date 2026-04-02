import { describe, expect, it, vi } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import { MockBattle, MockPokemon } from "../../testing";
import { statusTickHandler } from "./status-tick-handler";

const P1 = MockBattle.player1Fast;

describe("statusTickHandler", () => {
  describe("no status", () => {
    it("returns neutral result", () => {
      const pokemon = MockPokemon.fresh(P1, { statusEffects: [] });
      const result = statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(result.skipAction).toBe(false);
      expect(result.restrictActions).toBe(false);
      expect(result.pokemonFainted).toBe(false);
      expect(result.events).toHaveLength(0);
    });
  });

  describe("burned", () => {
    it("inflicts 1/16 max HP", () => {
      const pokemon = MockPokemon.fresh(P1, {
        currentHp: 100,
        maxHp: 100,
        statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
      });
      const result = statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(pokemon.currentHp).toBe(94);
      expect(result.events).toContainEqual({
        type: BattleEventType.DamageDealt,
        targetId: pokemon.id,
        amount: 6,
        effectiveness: 1,
      });
      expect(result.skipAction).toBe(false);
      expect(result.pokemonFainted).toBe(false);
    });

    it("inflicts minimum 1 damage", () => {
      const pokemon = MockPokemon.fresh(P1, {
        currentHp: 10,
        maxHp: 10,
        statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
      });
      statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(pokemon.currentHp).toBe(9);
    });

    it("causes KO when HP reaches 0", () => {
      const pokemon = MockPokemon.fresh(P1, {
        currentHp: 1,
        maxHp: 100,
        statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
      });
      const result = statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(pokemon.currentHp).toBe(0);
      expect(result.pokemonFainted).toBe(true);
      expect(result.events).toContainEqual({
        type: BattleEventType.PokemonKo,
        pokemonId: pokemon.id,
        countdownStart: 0,
      });
    });
  });

  describe("poisoned", () => {
    it("inflicts 1/8 max HP", () => {
      const pokemon = MockPokemon.fresh(P1, {
        currentHp: 100,
        maxHp: 100,
        statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }],
      });
      const result = statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(pokemon.currentHp).toBe(88);
      expect(result.events).toContainEqual({
        type: BattleEventType.DamageDealt,
        targetId: pokemon.id,
        amount: 12,
        effectiveness: 1,
      });
      expect(result.skipAction).toBe(false);
      expect(result.pokemonFainted).toBe(false);
    });

    it("causes KO when HP reaches 0", () => {
      const pokemon = MockPokemon.fresh(P1, {
        currentHp: 5,
        maxHp: 100,
        statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }],
      });
      const result = statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(pokemon.currentHp).toBe(0);
      expect(result.pokemonFainted).toBe(true);
    });
  });

  describe("badly_poisoned", () => {
    it("inflicts 1/16 max HP on first turn (counter = 1)", () => {
      const pokemon = MockPokemon.fresh(P1, {
        currentHp: 160,
        maxHp: 160,
        statusEffects: [{ type: StatusType.BadlyPoisoned, remainingTurns: null }],
        toxicCounter: 0,
      });
      const result = statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(pokemon.toxicCounter).toBe(1);
      expect(pokemon.currentHp).toBe(150);
      expect(result.events).toContainEqual({
        type: BattleEventType.DamageDealt,
        targetId: pokemon.id,
        amount: 10,
        effectiveness: 1,
      });
      expect(result.skipAction).toBe(false);
      expect(result.pokemonFainted).toBe(false);
    });

    it("inflicts increasing damage each turn", () => {
      const pokemon = MockPokemon.fresh(P1, {
        currentHp: 160,
        maxHp: 160,
        statusEffects: [{ type: StatusType.BadlyPoisoned, remainingTurns: null }],
        toxicCounter: 0,
      });
      const state = MockBattle.stateFrom([pokemon]);

      statusTickHandler(pokemon.id, state);
      expect(pokemon.toxicCounter).toBe(1);
      expect(pokemon.currentHp).toBe(150);

      statusTickHandler(pokemon.id, state);
      expect(pokemon.toxicCounter).toBe(2);
      expect(pokemon.currentHp).toBe(130);

      statusTickHandler(pokemon.id, state);
      expect(pokemon.toxicCounter).toBe(3);
      expect(pokemon.currentHp).toBe(100);
    });

    it("caps counter at 15", () => {
      const pokemon = MockPokemon.fresh(P1, {
        currentHp: 1000,
        maxHp: 160,
        statusEffects: [{ type: StatusType.BadlyPoisoned, remainingTurns: null }],
        toxicCounter: 14,
      });
      const state = MockBattle.stateFrom([pokemon]);

      statusTickHandler(pokemon.id, state);
      expect(pokemon.toxicCounter).toBe(15);

      statusTickHandler(pokemon.id, state);
      expect(pokemon.toxicCounter).toBe(15);
    });

    it("inflicts minimum 1 damage", () => {
      const pokemon = MockPokemon.fresh(P1, {
        currentHp: 10,
        maxHp: 10,
        statusEffects: [{ type: StatusType.BadlyPoisoned, remainingTurns: null }],
        toxicCounter: 0,
      });
      statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(pokemon.currentHp).toBe(9);
    });

    it("causes KO when HP reaches 0", () => {
      const pokemon = MockPokemon.fresh(P1, {
        currentHp: 5,
        maxHp: 160,
        statusEffects: [{ type: StatusType.BadlyPoisoned, remainingTurns: null }],
        toxicCounter: 0,
      });
      const result = statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(pokemon.currentHp).toBe(0);
      expect(result.pokemonFainted).toBe(true);
      expect(result.events).toContainEqual({
        type: BattleEventType.PokemonKo,
        pokemonId: pokemon.id,
        countdownStart: 0,
      });
    });
  });

  describe("asleep", () => {
    it("decrements remainingTurns and skips action when still asleep", () => {
      const pokemon = MockPokemon.fresh(P1, {
        statusEffects: [{ type: StatusType.Asleep, remainingTurns: 2 }],
      });
      const result = statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(pokemon.statusEffects[0]?.remainingTurns).toBe(1);
      expect(result.skipAction).toBe(true);
      expect(result.pokemonFainted).toBe(false);
    });

    it("wakes up when remainingTurns reaches 0 and can act", () => {
      const pokemon = MockPokemon.fresh(P1, {
        statusEffects: [{ type: StatusType.Asleep, remainingTurns: 1 }],
      });
      const result = statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(pokemon.statusEffects).toHaveLength(0);
      expect(result.skipAction).toBe(false);
      expect(result.events).toContainEqual({
        type: BattleEventType.StatusRemoved,
        targetId: pokemon.id,
        status: StatusType.Asleep,
      });
    });
  });

  describe("frozen", () => {
    it("thaws at 20% chance", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.19);
      const pokemon = MockPokemon.fresh(P1, {
        statusEffects: [{ type: StatusType.Frozen, remainingTurns: null }],
      });
      const result = statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(pokemon.statusEffects).toHaveLength(0);
      expect(result.skipAction).toBe(false);
      expect(result.events).toContainEqual({
        type: BattleEventType.StatusRemoved,
        targetId: pokemon.id,
        status: StatusType.Frozen,
      });
      vi.restoreAllMocks();
    });

    it("stays frozen at 80% chance", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.2);
      const pokemon = MockPokemon.fresh(P1, {
        statusEffects: [{ type: StatusType.Frozen, remainingTurns: null }],
      });
      const result = statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(pokemon.statusEffects).toHaveLength(1);
      expect(result.skipAction).toBe(true);
      vi.restoreAllMocks();
    });
  });

  describe("paralyzed", () => {
    it("procs at 25% chance — restrictActions true", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.24);
      const pokemon = MockPokemon.fresh(P1, {
        statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
      });
      const result = statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(result.restrictActions).toBe(true);
      expect(result.skipAction).toBe(false);
      vi.restoreAllMocks();
    });

    it("does not proc at 75% chance — normal actions", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.25);
      const pokemon = MockPokemon.fresh(P1, {
        statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
      });
      const result = statusTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

      expect(result.restrictActions).toBe(false);
      expect(result.skipAction).toBe(false);
      vi.restoreAllMocks();
    });
  });
});
