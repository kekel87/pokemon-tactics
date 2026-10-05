import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("Eviolite", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("NFE holder takes reduced damage", () => {
    it("Given Chansey (NFE) with Eviolite, When hit by tackle, Then damage dealt is less than without item", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const chanseyWith = MockPokemon.fresh(MockPokemon.base, {
        id: "chansey-with",
        definitionId: "chansey",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 500,
        maxHp: 500,
        combatStats: { hp: 500, attack: 10, defense: 10, spAttack: 50, spDefense: 110, speed: 55 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.Eviolite,
      });
      const { engine: engineWith } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.squirtle, {
          id: "attacker-with",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          derivedStats: { movement: 3, jump: 1, initiative: 100 },
        }),
        chanseyWith,
      ]);
      engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker-with",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      const chanseyWithout = MockPokemon.fresh(MockPokemon.base, {
        id: "chansey-without",
        definitionId: "chansey",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 500,
        maxHp: 500,
        combatStats: { hp: 500, attack: 10, defense: 10, spAttack: 50, spDefense: 110, speed: 55 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWithout } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.squirtle, {
          id: "attacker-without",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          derivedStats: { movement: 3, jump: 1, initiative: 100 },
        }),
        chanseyWithout,
      ]);
      engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker-without",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      const damageWith = 500 - chanseyWith.currentHp;
      const damageWithout = 500 - chanseyWithout.currentHp;
      expect(damageWith).toBeLessThan(damageWithout);
    });

    it.each(["scyther", "bulbasaur", "magneton"])(
      "Given %s (can still evolve) with Eviolite, When hit by tackle, Then damage is reduced compared to without item",
      (definitionId) => {
        vi.spyOn(Math, "random").mockReturnValue(0.5);

        const holderWith = MockPokemon.fresh(MockPokemon.base, {
          id: "holder-with",
          definitionId,
          playerId: PlayerId.Player2,
          position: { x: 1, y: 0 },
          currentHp: 300,
          maxHp: 300,
          combatStats: {
            hp: 300,
            attack: 115,
            defense: 85,
            spAttack: 60,
            spDefense: 90,
            speed: 115,
          },
          derivedStats: { movement: 3, jump: 1, initiative: 10 },
          heldItemId: HeldItemId.Eviolite,
        });
        const { engine: engineWith } = buildItemTestEngine([
          MockPokemon.fresh(MockPokemon.squirtle, {
            id: "attacker-with",
            playerId: PlayerId.Player1,
            position: { x: 0, y: 0 },
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
          definitionId,
          playerId: PlayerId.Player2,
          position: { x: 1, y: 0 },
          currentHp: 300,
          maxHp: 300,
          combatStats: {
            hp: 300,
            attack: 115,
            defense: 85,
            spAttack: 60,
            spDefense: 90,
            speed: 115,
          },
          derivedStats: { movement: 3, jump: 1, initiative: 10 },
        });
        const { engine: engineWithout } = buildItemTestEngine([
          MockPokemon.fresh(MockPokemon.squirtle, {
            id: "attacker-without",
            playerId: PlayerId.Player1,
            position: { x: 0, y: 0 },
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
        expect(damageWith).toBeLessThan(damageWithout);
      },
    );
  });

  describe("Eviolite does not reduce damage when attacker holds it", () => {
    it("Given attacker with Eviolite, When uses tackle, Then damage dealt is same as without item", () => {
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
          id: "attacker-with",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          derivedStats: { movement: 3, jump: 1, initiative: 100 },
          heldItemId: HeldItemId.Eviolite,
        }),
        targetWith,
      ]);
      engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker-with",
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
          id: "attacker-without",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          derivedStats: { movement: 3, jump: 1, initiative: 100 },
        }),
        targetWithout,
      ]);
      engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker-without",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      const damageWith = 300 - targetWith.currentHp;
      const damageWithout = 300 - targetWithout.currentHp;
      expect(damageWith).toBe(damageWithout);
    });
  });

  describe("non-NFE holder receives no damage reduction", () => {
    it.each(["weezing", "venusaur"])(
      "Given %s (final form) with Eviolite, When hit by tackle, Then damage is same as without item",
      (definitionId) => {
        vi.spyOn(Math, "random").mockReturnValue(0.5);

        const holderWith = MockPokemon.fresh(MockPokemon.base, {
          id: "holder-with",
          definitionId,
          playerId: PlayerId.Player2,
          position: { x: 1, y: 0 },
          currentHp: 300,
          maxHp: 300,
          combatStats: {
            hp: 300,
            attack: 95,
            defense: 125,
            spAttack: 90,
            spDefense: 75,
            speed: 65,
          },
          derivedStats: { movement: 3, jump: 1, initiative: 10 },
          heldItemId: HeldItemId.Eviolite,
        });
        const { engine: engineWith } = buildItemTestEngine([
          MockPokemon.fresh(MockPokemon.squirtle, {
            id: "attacker-with",
            playerId: PlayerId.Player1,
            position: { x: 0, y: 0 },
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
          definitionId,
          playerId: PlayerId.Player2,
          position: { x: 1, y: 0 },
          currentHp: 300,
          maxHp: 300,
          combatStats: {
            hp: 300,
            attack: 95,
            defense: 125,
            spAttack: 90,
            spDefense: 75,
            speed: 65,
          },
          derivedStats: { movement: 3, jump: 1, initiative: 10 },
        });
        const { engine: engineWithout } = buildItemTestEngine([
          MockPokemon.fresh(MockPokemon.squirtle, {
            id: "attacker-without",
            playerId: PlayerId.Player1,
            position: { x: 0, y: 0 },
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
        expect(damageWith).toBe(damageWithout);
      },
    );
  });
});
