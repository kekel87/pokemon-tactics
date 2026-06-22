import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { Direction } from "../../enums/direction";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("Punching Glove", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("mutes the target's contact reactions for Poing moves", () => {
    it("Given a Gant de Boxe holder uses Mach Punch into a Casque Brut holder, Then it takes no recoil", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        currentHp: 200,
        maxHp: 200,
        moveIds: ["mach-punch"],
        currentPp: { "mach-punch": 30 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.PunchingGlove,
      });
      const holder = MockPokemon.fresh(MockPokemon.charmander, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.RockyHelmet,
      });
      const { engine, state } = buildItemTestEngine([attacker, holder]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "mach-punch",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(state.pokemon.get("attacker")?.currentHp).toBe(200);
    });

    it("Given the same attacker WITHOUT Gant de Boxe, Then Casque Brut recoils on it (control)", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        currentHp: 200,
        maxHp: 200,
        moveIds: ["mach-punch"],
        currentPp: { "mach-punch": 30 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const holder = MockPokemon.fresh(MockPokemon.charmander, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.RockyHelmet,
      });
      const { engine, state } = buildItemTestEngine([attacker, holder]);

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "mach-punch",
        targetPosition: { x: 1, y: 0 },
      });

      expect(state.pokemon.get("attacker")?.currentHp).toBeLessThan(200);
    });
  });

  describe("boosts Poing-move damage by 10%", () => {
    it("Given a Gant de Boxe holder uses Mach Punch, Then it deals more damage than without the item", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const targetWith = MockPokemon.fresh(MockPokemon.charmander, {
        id: "target-with",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWith } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.squirtle, {
          id: "att-with",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          orientation: Direction.East,
          moveIds: ["mach-punch"],
          currentPp: { "mach-punch": 30 },
          derivedStats: { movement: 3, jump: 1, initiative: 100 },
          heldItemId: HeldItemId.PunchingGlove,
        }),
        targetWith,
      ]);
      engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "att-with",
        moveId: "mach-punch",
        targetPosition: { x: 1, y: 0 },
      });

      const targetWithout = MockPokemon.fresh(MockPokemon.charmander, {
        id: "target-without",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWithout } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.squirtle, {
          id: "att-without",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          orientation: Direction.East,
          moveIds: ["mach-punch"],
          currentPp: { "mach-punch": 30 },
          derivedStats: { movement: 3, jump: 1, initiative: 100 },
        }),
        targetWithout,
      ]);
      engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "att-without",
        moveId: "mach-punch",
        targetPosition: { x: 1, y: 0 },
      });

      const damageWith = 300 - targetWith.currentHp;
      const damageWithout = 300 - targetWithout.currentHp;
      expect(damageWith).toBeGreaterThan(damageWithout);
    });
  });

  describe("does not affect non-Poing moves", () => {
    it("Given a Gant de Boxe holder uses Charge (non-Poing) into a Casque Brut holder, Then contact still recoils on it", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        currentHp: 200,
        maxHp: 200,
        moveIds: ["tackle"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.PunchingGlove,
      });
      const holder = MockPokemon.fresh(MockPokemon.charmander, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.RockyHelmet,
      });
      const { engine, state } = buildItemTestEngine([attacker, holder]);

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      expect(state.pokemon.get("attacker")?.currentHp).toBeLessThan(200);
    });
  });
});
