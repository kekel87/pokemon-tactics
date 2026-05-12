import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("Black Sludge", () => {
  describe("Poison-type holder heals on end turn", () => {
    it("Given Weezing (Poison) with Black Sludge at partial HP, When end turn, Then HP increases and HpRestored emitted", () => {
      const weezing = MockPokemon.fresh(MockPokemon.base, {
        id: "weezing",
        definitionId: "weezing",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        currentHp: 100,
        maxHp: 200,
        combatStats: { hp: 200, attack: 95, defense: 125, spAttack: 90, spDefense: 75, speed: 65 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.BlackSludge,
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 5, y: 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([weezing, foe]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "weezing",
        direction: Direction.East,
      });

      expect(result.events.map((e) => e.type)).toContain(BattleEventType.HpRestored);
      const weezingAfter = engine.getGameState(PlayerId.Player1).pokemon.get("weezing");
      expect(weezingAfter?.currentHp).toBeGreaterThan(100);
    });

    it("Given Weezing with Black Sludge at full HP, When end turn, Then no heal emitted", () => {
      const weezing = MockPokemon.fresh(MockPokemon.base, {
        id: "weezing",
        definitionId: "weezing",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        currentHp: 200,
        maxHp: 200,
        combatStats: { hp: 200, attack: 95, defense: 125, spAttack: 90, spDefense: 75, speed: 65 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.BlackSludge,
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 5, y: 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([weezing, foe]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "weezing",
        direction: Direction.East,
      });

      expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.HpRestored);
      const weezingAfter = engine.getGameState(PlayerId.Player1).pokemon.get("weezing");
      expect(weezingAfter?.currentHp).toBe(200);
    });
  });

  describe("non-Poison holder takes damage on end turn", () => {
    it("Given Squirtle (non-Poison) with Black Sludge, When end turn, Then HP decreases and DamageDealt emitted", () => {
      const squirtle = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "squirtle",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        currentHp: 104,
        maxHp: 104,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.BlackSludge,
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 5, y: 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([squirtle, foe]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "squirtle",
        direction: Direction.East,
      });

      expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
      const squirtleAfter = engine.getGameState(PlayerId.Player1).pokemon.get("squirtle");
      expect(squirtleAfter?.currentHp).toBeLessThan(104);
    });
  });

  describe("non-Poison holder KO'd by Black Sludge", () => {
    it("Given non-Poison holder at exactly 1/8 HP, When end turn, Then HP reaches 0 and PokemonKo emitted", () => {
      const maxHp = 80;
      const squirtle = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "squirtle",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        currentHp: 10,
        maxHp,
        combatStats: { hp: maxHp, attack: 53, defense: 70, spAttack: 55, spDefense: 69, speed: 48 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.BlackSludge,
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 5, y: 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([squirtle, foe]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "squirtle",
        direction: Direction.East,
      });

      expect(result.events.map((e) => e.type)).toContain(BattleEventType.PokemonKo);
      const squirtleAfter = engine.getGameState(PlayerId.Player1).pokemon.get("squirtle");
      expect(squirtleAfter?.currentHp).toBe(0);
    });
  });
});
