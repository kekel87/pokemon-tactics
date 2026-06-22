import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildItemTestEngine, MockPokemon } from "../../testing";
import { ProtectionReason } from "../../types/battle-event";

describe("Clear Amulet", () => {
  describe("blocks opponent-inflicted stat drops", () => {
    it("Given a Talisman Sain holder is hit by Groz'Yeux, Then its Defense stays at 0 and the block events fire", () => {
      const attacker = MockPokemon.fresh(MockPokemon.base, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        moveIds: ["leer"],
        currentPp: { leer: 30 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.ClearAmulet,
      });
      const { engine, state } = buildItemTestEngine([attacker, holder]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "leer",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(state.pokemon.get("holder")?.statStages[StatName.Defense]).toBe(0);

      const activated = result.events.find(
        (e) =>
          e.type === BattleEventType.HeldItemActivated &&
          "itemId" in e &&
          e.itemId === HeldItemId.ClearAmulet,
      );
      expect(activated).toBeDefined();

      const blocked = result.events.find(
        (e) =>
          e.type === BattleEventType.StatChangeBlocked &&
          "reason" in e &&
          e.reason === ProtectionReason.HeldItem,
      );
      expect(blocked).toBeDefined();
    });

    it("Given a holder without the amulet is hit by Groz'Yeux, Then its Defense drops to -1 (control)", () => {
      const attacker = MockPokemon.fresh(MockPokemon.base, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        moveIds: ["leer"],
        currentPp: { leer: 30 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine, state } = buildItemTestEngine([attacker, target]);

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "leer",
        targetPosition: { x: 1, y: 0 },
      });

      expect(state.pokemon.get("target")?.statStages[StatName.Defense]).toBe(-1);
    });
  });

  describe("does not block self-inflicted drops", () => {
    it("Given a Talisman Sain holder uses Draco-Météore, Then its own Sp.Atk still drops", () => {
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        moveIds: ["overheat"],
        currentPp: { overheat: 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.ClearAmulet,
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
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
        moveId: "overheat",
        targetPosition: { x: 1, y: 0 },
      });

      expect(state.pokemon.get("holder")?.statStages[StatName.SpAttack]).toBe(-2);
    });
  });
});
