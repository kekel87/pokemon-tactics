import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("Leek (Stick)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Farfetch'd gains +2 crit stages", () => {
    it("Given Farfetch'd with Leek and random=0.12, When uses slash, Then CriticalHit event emitted (stage 2 threshold met)", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.12);

      const farfetchd = MockPokemon.fresh(MockPokemon.base, {
        id: "farfetchd",
        definitionId: "farfetch-d",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["slash"],
        currentPp: { slash: 20 },
        combatStats: { hp: 157, attack: 95, defense: 60, spAttack: 63, spDefense: 67, speed: 65 },
        derivedStats: { movement: 4, jump: 1, initiative: 65 },
        heldItemId: HeldItemId.Leek,
      });
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        combatStats: { hp: 300, attack: 50, defense: 80, spAttack: 50, spDefense: 80, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        currentHp: 300,
        maxHp: 300,
      });
      const { engine } = buildItemTestEngine([farfetchd, target]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "farfetchd",
        moveId: "slash",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(result.events.map((e) => e.type)).toContain(BattleEventType.CriticalHit);
    });

    it("Given Farfetch'd with Leek and random=0.0, When uses slash, Then always crits", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.0);

      const farfetchd = MockPokemon.fresh(MockPokemon.base, {
        id: "farfetchd",
        definitionId: "farfetch-d",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["slash"],
        currentPp: { slash: 20 },
        combatStats: { hp: 157, attack: 95, defense: 60, spAttack: 63, spDefense: 67, speed: 65 },
        derivedStats: { movement: 4, jump: 1, initiative: 65 },
        heldItemId: HeldItemId.Leek,
      });
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        combatStats: { hp: 300, attack: 50, defense: 80, spAttack: 50, spDefense: 80, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([farfetchd, target]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "farfetchd",
        moveId: "slash",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(result.events.map((e) => e.type)).toContain(BattleEventType.CriticalHit);
    });
  });

  describe("Non-Farfetch'd holder gains no crit stages", () => {
    it("Given Squirtle with Leek and random=0.12, When uses tackle, Then no CriticalHit emitted", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.12);

      const squirtle = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "squirtle",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.Leek,
      });
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        combatStats: { hp: 300, attack: 50, defense: 80, spAttack: 50, spDefense: 80, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([squirtle, target]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "squirtle",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.CriticalHit);
    });
  });

  describe("Crit probability is higher with Leek than without", () => {
    it("Given Farfetch'd with Leek vs without, When random=0.12 (above stage-0 threshold 1/24≈0.042, below stage-2 threshold 1/2=0.5), Then Leek produces crit, no Leek does not", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.12);

      const farfetchdWithLeek = MockPokemon.fresh(MockPokemon.base, {
        id: "farfetchd-with",
        definitionId: "farfetch-d",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["scratch"],
        currentPp: { scratch: 35 },
        combatStats: { hp: 157, attack: 95, defense: 60, spAttack: 63, spDefense: 67, speed: 65 },
        derivedStats: { movement: 4, jump: 1, initiative: 65 },
        heldItemId: HeldItemId.Leek,
      });
      const targetWith = MockPokemon.fresh(MockPokemon.base, {
        id: "target-with",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        combatStats: { hp: 300, attack: 50, defense: 80, spAttack: 50, spDefense: 80, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWith } = buildItemTestEngine([farfetchdWithLeek, targetWith]);
      const resultWith = engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "farfetchd-with",
        moveId: "scratch",
        targetPosition: { x: 1, y: 0 },
      });

      const farfetchdWithout = MockPokemon.fresh(MockPokemon.base, {
        id: "farfetchd-without",
        definitionId: "farfetch-d",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["scratch"],
        currentPp: { scratch: 35 },
        combatStats: { hp: 157, attack: 95, defense: 60, spAttack: 63, spDefense: 67, speed: 65 },
        derivedStats: { movement: 4, jump: 1, initiative: 65 },
      });
      const targetWithout = MockPokemon.fresh(MockPokemon.base, {
        id: "target-without",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        combatStats: { hp: 300, attack: 50, defense: 80, spAttack: 50, spDefense: 80, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWithout } = buildItemTestEngine([farfetchdWithout, targetWithout]);
      const resultWithout = engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "farfetchd-without",
        moveId: "scratch",
        targetPosition: { x: 1, y: 0 },
      });

      expect(resultWith.events.map((e) => e.type)).toContain(BattleEventType.CriticalHit);
      expect(resultWithout.events.map((e) => e.type)).not.toContain(BattleEventType.CriticalHit);
    });
  });
});
