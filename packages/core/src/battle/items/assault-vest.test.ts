import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("Assault Vest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("special damage reduction", () => {
    it("Given holder with Assault Vest, When hit by a special move (water-gun), Then takes less damage than without item", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const holderWith = MockPokemon.fresh(MockPokemon.base, {
        id: "holder-with",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        combatStats: { hp: 300, attack: 55, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.AssaultVest,
      });
      const { engine: engineWith } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.squirtle, {
          id: "attacker-with",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          moveIds: ["water-gun"],
          derivedStats: { movement: 3, jump: 1, initiative: 100 },
        }),
        holderWith,
      ]);
      engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker-with",
        moveId: "water-gun",
        targetPosition: { x: 1, y: 0 },
      });

      const holderWithout = MockPokemon.fresh(MockPokemon.base, {
        id: "holder-without",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        combatStats: { hp: 300, attack: 55, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWithout } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.squirtle, {
          id: "attacker-without",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          moveIds: ["water-gun"],
          derivedStats: { movement: 3, jump: 1, initiative: 100 },
        }),
        holderWithout,
      ]);
      engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker-without",
        moveId: "water-gun",
        targetPosition: { x: 1, y: 0 },
      });

      const damageWith = 300 - holderWith.currentHp;
      const damageWithout = 300 - holderWithout.currentHp;
      expect(damageWith).toBeGreaterThan(0);
      expect(damageWith).toBeLessThan(damageWithout);
    });

    it("Given holder with Assault Vest, When hit by a physical move (tackle), Then damage is unchanged", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const holderWith = MockPokemon.fresh(MockPokemon.base, {
        id: "holder-with",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        combatStats: { hp: 300, attack: 55, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.AssaultVest,
      });
      const { engine: engineWith } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.squirtle, {
          id: "attacker-with",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          moveIds: ["tackle"],
          derivedStats: { movement: 3, jump: 1, initiative: 100 },
        }),
        holderWith,
      ]);
      engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker-with",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      const holderWithout = MockPokemon.fresh(MockPokemon.base, {
        id: "holder-without",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        combatStats: { hp: 300, attack: 55, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWithout } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.squirtle, {
          id: "attacker-without",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          moveIds: ["tackle"],
          derivedStats: { movement: 3, jump: 1, initiative: 100 },
        }),
        holderWithout,
      ]);
      engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker-without",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      const damageWith = 300 - holderWith.currentHp;
      const damageWithout = 300 - holderWithout.currentHp;
      expect(damageWith).toBeGreaterThan(0);
      expect(damageWith).toBe(damageWithout);
    });

    it("Given an Assault Vest holder attacks with a special move, Then its own outgoing damage is unaffected", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const attackerWith = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker-with",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["water-gun"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.AssaultVest,
      });
      const targetWith = MockPokemon.fresh(MockPokemon.base, {
        id: "target-with",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWith } = buildItemTestEngine([attackerWith, targetWith]);
      engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker-with",
        moveId: "water-gun",
        targetPosition: { x: 1, y: 0 },
      });

      const attackerWithout = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker-without",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["water-gun"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const targetWithout = MockPokemon.fresh(MockPokemon.base, {
        id: "target-without",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWithout } = buildItemTestEngine([attackerWithout, targetWithout]);
      engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker-without",
        moveId: "water-gun",
        targetPosition: { x: 1, y: 0 },
      });

      const damageWith = 300 - targetWith.currentHp;
      const damageWithout = 300 - targetWithout.currentHp;
      expect(damageWith).toBeGreaterThan(0);
      expect(damageWith).toBe(damageWithout);
    });
  });

  describe("status move restriction", () => {
    it("Given holder with Assault Vest, Then status-category moves are absent from getLegalActions", () => {
      const holder = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["water-gun", "withdraw"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.AssaultVest,
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([holder, foe]);

      const moveActions = engine
        .getLegalActions(PlayerId.Player1)
        .filter((action) => action.kind === ActionKind.UseMove);

      const moveIds = new Set(
        moveActions.map((action) => (action.kind === ActionKind.UseMove ? action.moveId : "")),
      );
      expect(moveIds.has("water-gun")).toBe(true);
      expect(moveIds.has("withdraw")).toBe(false);
    });

    it("Given a Pokemon without Assault Vest, Then its status moves remain selectable", () => {
      const holder = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["water-gun", "withdraw"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([holder, foe]);

      const moveIds = new Set(
        engine
          .getLegalActions(PlayerId.Player1)
          .map((action) => (action.kind === ActionKind.UseMove ? action.moveId : "")),
      );
      expect(moveIds.has("withdraw")).toBe(true);
    });

    it("Given holder with Assault Vest, When submitting a status move, Then it is rejected with InvalidAction and no events", () => {
      const holder = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["water-gun", "withdraw"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.AssaultVest,
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([holder, foe]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "holder",
        moveId: "withdraw",
        targetPosition: { x: 0, y: 0 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(ActionError.InvalidAction);
      expect(result.events).toHaveLength(0);
    });
  });
});
