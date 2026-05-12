import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("Salac Berry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("no activation when holder above 25% HP", () => {
    it("Given holder at 80% HP, When takes small damage and stays above 25%, Then no Speed boost and item not consumed", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const maxHp = 400;
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: maxHp,
        maxHp,
        combatStats: {
          hp: maxHp,
          attack: 50,
          defense: 500,
          spAttack: 50,
          spDefense: 500,
          speed: 50,
        },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.SalacBerry,
      });
      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        combatStats: { hp: 104, attack: 53, defense: 70, spAttack: 55, spDefense: 69, speed: 48 },
      });
      const { engine } = buildItemTestEngine([attacker, holder]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);

      const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("holder");
      expect(holderAfter?.currentHp).toBeGreaterThan(maxHp * 0.25);

      expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.HeldItemConsumed);
      expect(holderAfter?.heldItemId).toBe(HeldItemId.SalacBerry);
    });
  });

  describe("activates when holder drops to ≤25% HP", () => {
    it("Given holder at ≤25% HP after hit, When damage received, Then Speed +1, HeldItemConsumed emitted, item cleared", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const maxHp = 400;
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 101,
        maxHp,
        combatStats: {
          hp: maxHp,
          attack: 50,
          defense: 200,
          spAttack: 50,
          spDefense: 200,
          speed: 50,
        },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.SalacBerry,
      });
      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        combatStats: { hp: 104, attack: 500, defense: 70, spAttack: 55, spDefense: 69, speed: 48 },
      });
      const { engine } = buildItemTestEngine([attacker, holder]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);

      const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("holder");
      expect(holderAfter?.currentHp).toBeGreaterThan(0);
      expect(holderAfter?.currentHp).toBeLessThanOrEqual(maxHp * 0.25);

      expect(holderAfter?.statStages[StatName.Speed]).toBe(1);

      expect(result.events.map((e) => e.type)).toContain(BattleEventType.HeldItemConsumed);
      expect(result.events.map((e) => e.type)).toContain(BattleEventType.StatChanged);

      const statChanged = result.events.find(
        (e) =>
          e.type === BattleEventType.StatChanged &&
          "stat" in e &&
          e.stat === StatName.Speed &&
          "targetId" in e &&
          e.targetId === "holder",
      );
      expect(statChanged).toBeDefined();

      expect(holderAfter?.heldItemId).toBeUndefined();
    });
  });

  describe("no activation when Speed already at +6", () => {
    it("Given holder at ≤25% HP with Speed stage +6, When damage received, Then item not consumed", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const maxHp = 400;
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 101,
        maxHp,
        combatStats: {
          hp: maxHp,
          attack: 50,
          defense: 200,
          spAttack: 50,
          spDefense: 200,
          speed: 50,
        },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.SalacBerry,
        statStages: {
          hp: 0,
          attack: 0,
          defense: 0,
          spAttack: 0,
          spDefense: 0,
          speed: 6,
          accuracy: 0,
          evasion: 0,
        },
      });
      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        combatStats: { hp: 104, attack: 500, defense: 70, spAttack: 55, spDefense: 69, speed: 48 },
      });
      const { engine } = buildItemTestEngine([attacker, holder]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);

      const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("holder");
      expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.HeldItemConsumed);
      expect(holderAfter?.heldItemId).toBe(HeldItemId.SalacBerry);
      expect(holderAfter?.statStages[StatName.Speed]).toBe(6);
    });
  });
});
