import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("Throat Spray", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("raises Sp. Atk after a Son move", () => {
    it("Given a Spray Gorge holder uses Aboiement (Son), Then its Sp. Atk rises by 1 and the item is consumed", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const holder = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        moveIds: ["snarl"],
        currentPp: { snarl: 15 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.ThroatSpray,
      });
      const foe = MockPokemon.fresh(MockPokemon.charmander, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine, state } = buildItemTestEngine([holder, foe]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "holder",
        moveId: "snarl",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(state.pokemon.get("holder")?.statStages[StatName.SpAttack]).toBe(1);
      expect(state.pokemon.get("holder")?.heldItemId).toBeUndefined();

      const activated = result.events.find(
        (e) =>
          e.type === BattleEventType.HeldItemActivated &&
          "itemId" in e &&
          e.itemId === HeldItemId.ThroatSpray,
      );
      expect(activated).toBeDefined();

      const statChanged = result.events.find(
        (e) =>
          e.type === BattleEventType.StatChanged && "stat" in e && e.stat === StatName.SpAttack,
      );
      expect(statChanged).toBeDefined();

      const consumed = result.events.find(
        (e) =>
          e.type === BattleEventType.HeldItemConsumed &&
          "itemId" in e &&
          e.itemId === HeldItemId.ThroatSpray,
      );
      expect(consumed).toBeDefined();
    });

    it("Given a Spray Gorge holder uses Rugissement (Son status), Then its Sp. Atk still rises by 1 and the item is consumed", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const holder = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        moveIds: ["growl"],
        currentPp: { growl: 40 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.ThroatSpray,
      });
      const foe = MockPokemon.fresh(MockPokemon.charmander, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine, state } = buildItemTestEngine([holder, foe]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "holder",
        moveId: "growl",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(state.pokemon.get("holder")?.statStages[StatName.SpAttack]).toBe(1);
      expect(state.pokemon.get("holder")?.heldItemId).toBeUndefined();
    });
  });

  describe("does nothing for non-Son moves", () => {
    it("Given a Spray Gorge holder uses Charge (non-Son), Then its Sp. Atk is unchanged and the item is kept", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const holder = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        moveIds: ["tackle"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.ThroatSpray,
      });
      const foe = MockPokemon.fresh(MockPokemon.charmander, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine, state } = buildItemTestEngine([holder, foe]);

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "holder",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      expect(state.pokemon.get("holder")?.statStages[StatName.SpAttack]).toBe(0);
      expect(state.pokemon.get("holder")?.heldItemId).toBe(HeldItemId.ThroatSpray);
    });
  });
});
