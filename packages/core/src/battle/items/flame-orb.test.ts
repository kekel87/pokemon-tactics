import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("Flame Orb", () => {
  describe("applies Burned status on end turn when holder has no status", () => {
    it("Given holder with no status, When end turn, Then Burned applied and StatusApplied emitted", () => {
      const holder = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.FlameOrb,
        statusEffects: [],
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 5, y: 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([holder, foe]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "holder",
        direction: Direction.East,
      });

      expect(result.events.map((e) => e.type)).toContain(BattleEventType.StatusApplied);
      const statusApplied = result.events.find(
        (e) =>
          e.type === BattleEventType.StatusApplied &&
          "status" in e &&
          e.status === StatusType.Burned,
      );
      expect(statusApplied).toBeDefined();

      const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("holder");
      expect(holderAfter?.statusEffects.some((s) => s.type === StatusType.Burned)).toBe(true);
    });
  });

  describe("no-op when already Burned", () => {
    it("Given holder already Burned, When end turn, Then no additional StatusApplied emitted", () => {
      const holder = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.FlameOrb,
        statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 5, y: 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([holder, foe]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "holder",
        direction: Direction.East,
      });

      const statusAppliedEvents = result.events.filter(
        (e) =>
          e.type === BattleEventType.StatusApplied &&
          "status" in e &&
          e.status === StatusType.Burned,
      );
      expect(statusAppliedEvents).toHaveLength(0);
    });
  });

  describe("no-op when already Poisoned", () => {
    it("Given holder already Poisoned, When end turn, Then no Burned applied", () => {
      const holder = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.FlameOrb,
        statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }],
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 5, y: 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([holder, foe]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "holder",
        direction: Direction.East,
      });

      const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("holder");
      expect(holderAfter?.statusEffects.some((s) => s.type === StatusType.Burned)).toBe(false);

      const burnApplied = result.events.find(
        (e) =>
          e.type === BattleEventType.StatusApplied &&
          "status" in e &&
          e.status === StatusType.Burned,
      );
      expect(burnApplied).toBeUndefined();
    });
  });

  describe("HeldItemActivated emitted on activation", () => {
    it("Given holder with no status, When end turn, Then HeldItemActivated emitted", () => {
      const holder = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.FlameOrb,
        statusEffects: [],
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 5, y: 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([holder, foe]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "holder",
        direction: Direction.East,
      });

      expect(result.events.map((e) => e.type)).toContain(BattleEventType.HeldItemActivated);
    });
  });
});
