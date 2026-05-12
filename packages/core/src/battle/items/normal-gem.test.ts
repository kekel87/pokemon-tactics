import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("Normal Gem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("damage boost on Normal move", () => {
    it("Given attacker with Normal Gem, When uses tackle (Normal), Then damage greater than without item", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const targetWith = MockPokemon.fresh(MockPokemon.base, {
        id: "target-with",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        combatStats: { hp: 300, attack: 50, defense: 80, spAttack: 50, spDefense: 80, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWith } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.squirtle, {
          id: "att-with",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          derivedStats: { movement: 3, jump: 1, initiative: 100 },
          heldItemId: HeldItemId.NormalGem,
        }),
        targetWith,
      ]);
      engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "att-with",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
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
      const { engine: engineWithout } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.squirtle, {
          id: "att-without",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          derivedStats: { movement: 3, jump: 1, initiative: 100 },
        }),
        targetWithout,
      ]);
      engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "att-without",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      const damageWith = 300 - targetWith.currentHp;
      const damageWithout = 300 - targetWithout.currentHp;
      expect(damageWith).toBeGreaterThan(damageWithout);
    });
  });

  describe("no boost on non-Normal move", () => {
    it("Given attacker with Normal Gem, When uses water-gun (Water), Then damage same as without item", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const targetWith = MockPokemon.fresh(MockPokemon.base, {
        id: "target-with",
        playerId: PlayerId.Player2,
        position: { x: 0, y: 2 },
        currentHp: 300,
        maxHp: 300,
        combatStats: { hp: 300, attack: 50, defense: 80, spAttack: 50, spDefense: 80, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWith } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.squirtle, {
          id: "att-with",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          derivedStats: { movement: 3, jump: 1, initiative: 100 },
          heldItemId: HeldItemId.NormalGem,
        }),
        targetWith,
      ]);
      engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "att-with",
        moveId: "water-gun",
        targetPosition: { x: 0, y: 2 },
      });

      const targetWithout = MockPokemon.fresh(MockPokemon.base, {
        id: "target-without",
        playerId: PlayerId.Player2,
        position: { x: 0, y: 2 },
        currentHp: 300,
        maxHp: 300,
        combatStats: { hp: 300, attack: 50, defense: 80, spAttack: 50, spDefense: 80, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWithout } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.squirtle, {
          id: "att-without",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          derivedStats: { movement: 3, jump: 1, initiative: 100 },
        }),
        targetWithout,
      ]);
      engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "att-without",
        moveId: "water-gun",
        targetPosition: { x: 0, y: 2 },
      });

      const damageWith = 300 - targetWith.currentHp;
      const damageWithout = 300 - targetWithout.currentHp;
      expect(damageWith).toBe(damageWithout);
    });
  });

  describe("consumed after Normal move damage", () => {
    it("Given attacker with Normal Gem, When uses tackle (Normal), Then HeldItemConsumed emitted and heldItemId cleared", () => {
      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.NormalGem,
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
      const { engine } = buildItemTestEngine([attacker, target]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(result.events.map((e) => e.type)).toContain(BattleEventType.HeldItemConsumed);

      const consumedEvent = result.events.find(
        (e) =>
          e.type === BattleEventType.HeldItemConsumed &&
          "pokemonId" in e &&
          e.pokemonId === "attacker",
      );
      expect(consumedEvent).toBeDefined();

      const attackerAfter = engine.getGameState(PlayerId.Player1).pokemon.get("attacker");
      expect(attackerAfter?.heldItemId).toBeUndefined();
    });
  });

  describe("not consumed after non-Normal move", () => {
    it("Given attacker with Normal Gem, When uses water-gun (Water), Then item not consumed", () => {
      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.NormalGem,
      });
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 0, y: 2 },
        currentHp: 300,
        maxHp: 300,
        combatStats: { hp: 300, attack: 50, defense: 80, spAttack: 50, spDefense: 80, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([attacker, target]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "water-gun",
        targetPosition: { x: 0, y: 2 },
      });

      expect(result.success).toBe(true);
      expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.HeldItemConsumed);

      const attackerAfter = engine.getGameState(PlayerId.Player1).pokemon.get("attacker");
      expect(attackerAfter?.heldItemId).toBe(HeldItemId.NormalGem);
    });
  });

  describe("consumed only once per Normal move", () => {
    it("Given attacker with Normal Gem, When uses tackle once, Then exactly one HeldItemConsumed emitted", () => {
      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.NormalGem,
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
      const { engine } = buildItemTestEngine([attacker, target]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      const consumeEvents = result.events.filter(
        (e) => e.type === BattleEventType.HeldItemConsumed,
      );
      expect(consumeEvents).toHaveLength(1);
    });
  });
});
