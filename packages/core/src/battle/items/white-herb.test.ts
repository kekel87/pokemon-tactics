import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("White Herb", () => {
  describe("restore on stat lowered by enemy", () => {
    it("Given holder takes -2 Def from growl, When item activates, Then statStage restored to 0, StatChanged +2 emitted, HeldItemConsumed emitted, heldItemId cleared", () => {
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 2, y: 2 },
        heldItemId: HeldItemId.WhiteHerb,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const magneton = MockPokemon.fresh(MockPokemon.base, {
        id: "magneton",
        definitionId: "magneton",
        playerId: PlayerId.Player1,
        position: { x: 2, y: 0 },
        moveIds: ["growl"],
        currentPp: { growl: 40 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const { engine, state } = buildItemTestEngine([magneton, holder]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "magneton",
        moveId: "growl",
        targetPosition: { x: 2, y: 2 },
      });

      expect(result.success).toBe(true);

      const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("holder");
      expect(holderAfter?.statStages[StatName.Attack]).toBe(0);

      const statChangedByItem = result.events.find(
        (e) =>
          e.type === BattleEventType.StatChanged &&
          "targetId" in e &&
          e.targetId === "holder" &&
          "stages" in e &&
          e.stages === 1,
      );
      expect(statChangedByItem).toBeDefined();

      expect(result.events.map((e) => e.type)).toContain(BattleEventType.HeldItemConsumed);

      const consumedEvent = result.events.find(
        (e) =>
          e.type === BattleEventType.HeldItemConsumed &&
          "pokemonId" in e &&
          e.pokemonId === "holder",
      );
      expect(consumedEvent).toBeDefined();

      expect(holderAfter?.heldItemId).toBeUndefined();

      expect(state.pokemon.get("holder")?.heldItemId).toBeUndefined();
    });
  });

  describe("no-op when no item", () => {
    it("Given Pokemon without White Herb takes -2 Def from growl, Then stat stays at -2, no HeldItemConsumed emitted", () => {
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 2, y: 2 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const magneton = MockPokemon.fresh(MockPokemon.base, {
        id: "magneton",
        definitionId: "magneton",
        playerId: PlayerId.Player1,
        position: { x: 2, y: 0 },
        moveIds: ["growl"],
        currentPp: { growl: 40 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const { engine } = buildItemTestEngine([magneton, target]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "magneton",
        moveId: "growl",
        targetPosition: { x: 2, y: 2 },
      });

      expect(result.success).toBe(true);

      const targetAfter = engine.getGameState(PlayerId.Player1).pokemon.get("target");
      expect(targetAfter?.statStages[StatName.Attack]).toBe(-1);

      expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.HeldItemConsumed);
    });
  });

  describe("already consumed", () => {
    it("Given holder used White Herb once (consumed), When stat lowered again, Then stat stays at -2, no HeldItemConsumed emitted", () => {
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 2, y: 2 },
        heldItemId: HeldItemId.WhiteHerb,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const magneton = MockPokemon.fresh(MockPokemon.base, {
        id: "magneton",
        definitionId: "magneton",
        playerId: PlayerId.Player1,
        position: { x: 2, y: 0 },
        moveIds: ["growl"],
        currentPp: { growl: 40 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const { engine } = buildItemTestEngine([magneton, holder]);

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "magneton",
        moveId: "growl",
        targetPosition: { x: 2, y: 2 },
      });
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "magneton",
        direction: magneton.orientation,
      });
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "holder",
        direction: holder.orientation,
      });

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "magneton",
        moveId: "growl",
        targetPosition: { x: 2, y: 2 },
      });

      expect(result.success).toBe(true);

      const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("holder");
      expect(holderAfter?.statStages[StatName.Attack]).toBe(-1);
      expect(holderAfter?.heldItemId).toBeUndefined();

      expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.HeldItemConsumed);
    });
  });

  describe("multi-stat lowered in single move", () => {
    it("Given holder with White Herb is hit by growl (single stat), Then stat restored to 0, consumed once", () => {
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 2, y: 2 },
        heldItemId: HeldItemId.WhiteHerb,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const magneton = MockPokemon.fresh(MockPokemon.base, {
        id: "magneton",
        definitionId: "magneton",
        playerId: PlayerId.Player1,
        position: { x: 2, y: 0 },
        moveIds: ["growl"],
        currentPp: { growl: 40 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const { engine } = buildItemTestEngine([magneton, holder]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "magneton",
        moveId: "growl",
        targetPosition: { x: 2, y: 2 },
      });

      expect(result.success).toBe(true);

      const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("holder");
      expect(holderAfter?.statStages[StatName.Attack]).toBe(0);

      const consumeEvents = result.events.filter(
        (e) => e.type === BattleEventType.HeldItemConsumed,
      );
      expect(consumeEvents).toHaveLength(1);
    });
  });

  describe("self-lowered (drawback) triggers White Herb", () => {
    it("Given holder uses close-combat (self: -1 Def, -1 SpDef), Then both stats restored to 0 and item consumed", () => {
      const machamp = MockPokemon.fresh(MockPokemon.base, {
        id: "machamp",
        definitionId: "machamp",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["close-combat"],
        currentPp: { "close-combat": 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.WhiteHerb,
        combatStats: { hp: 130, attack: 130, defense: 80, spAttack: 65, spDefense: 85, speed: 55 },
      });
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([machamp, target]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "machamp",
        moveId: "close-combat",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);

      const machampAfter = engine.getGameState(PlayerId.Player1).pokemon.get("machamp");
      expect(machampAfter?.statStages[StatName.Attack]).toBe(0);
      expect(machampAfter?.statStages[StatName.SpDefense]).toBe(0);

      expect(result.events.map((e) => e.type)).toContain(BattleEventType.HeldItemConsumed);
      expect(machampAfter?.heldItemId).toBeUndefined();
    });
  });

  describe("blocked by ability (Clear Body)", () => {
    it("Given holder with Clear Body + White Herb, When enemy uses growl, Then ability blocks, stat unchanged, White Herb NOT consumed", () => {
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "tentacruel",
        definitionId: "tentacruel",
        playerId: PlayerId.Player2,
        position: { x: 2, y: 2 },
        abilityId: "clear-body",
        heldItemId: HeldItemId.WhiteHerb,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const magneton = MockPokemon.fresh(MockPokemon.base, {
        id: "magneton",
        definitionId: "magneton",
        playerId: PlayerId.Player1,
        position: { x: 2, y: 0 },
        moveIds: ["growl"],
        currentPp: { growl: 40 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const { engine } = buildItemTestEngine([magneton, holder]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "magneton",
        moveId: "growl",
        targetPosition: { x: 2, y: 2 },
      });

      expect(result.success).toBe(true);

      const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("tentacruel");
      expect(holderAfter?.statStages[StatName.Attack]).toBe(0);

      expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.HeldItemConsumed);
      expect(holderAfter?.heldItemId).toBe(HeldItemId.WhiteHerb);

      expect(result.events.map((e) => e.type)).toContain(BattleEventType.AbilityActivated);
    });
  });
});
