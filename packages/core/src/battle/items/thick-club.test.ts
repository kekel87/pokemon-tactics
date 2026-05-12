import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("Thick Club", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Marowak with Thick Club deals double physical damage", () => {
    it("Given Marowak with Thick Club, When uses earthquake (Physical), Then damage is greater than without item", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const targetWith = MockPokemon.fresh(MockPokemon.base, {
        id: "target-with",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 500,
        maxHp: 500,
        combatStats: { hp: 500, attack: 50, defense: 100, spAttack: 50, spDefense: 100, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWith } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.base, {
          id: "marowak-with",
          definitionId: "marowak",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          moveIds: ["earthquake"],
          currentPp: { earthquake: 10 },
          combatStats: {
            hp: 170,
            attack: 85,
            defense: 115,
            spAttack: 55,
            spDefense: 85,
            speed: 50,
          },
          derivedStats: { movement: 3, jump: 1, initiative: 50 },
          heldItemId: HeldItemId.ThickClub,
        }),
        targetWith,
      ]);
      engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "marowak-with",
        moveId: "earthquake",
        targetPosition: { x: 1, y: 0 },
      });

      const targetWithout = MockPokemon.fresh(MockPokemon.base, {
        id: "target-without",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 500,
        maxHp: 500,
        combatStats: { hp: 500, attack: 50, defense: 100, spAttack: 50, spDefense: 100, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWithout } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.base, {
          id: "marowak-without",
          definitionId: "marowak",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          moveIds: ["earthquake"],
          currentPp: { earthquake: 10 },
          combatStats: {
            hp: 170,
            attack: 85,
            defense: 115,
            spAttack: 55,
            spDefense: 85,
            speed: 50,
          },
          derivedStats: { movement: 3, jump: 1, initiative: 50 },
        }),
        targetWithout,
      ]);
      engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "marowak-without",
        moveId: "earthquake",
        targetPosition: { x: 1, y: 0 },
      });

      const damageWith = 500 - targetWith.currentHp;
      const damageWithout = 500 - targetWithout.currentHp;
      expect(damageWith).toBeGreaterThan(damageWithout);
    });
  });

  describe("Non-Marowak holder gains no boost", () => {
    it("Given Onix with Thick Club, When uses earthquake (Physical), Then damage same as without item", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const targetWith = MockPokemon.fresh(MockPokemon.base, {
        id: "target-with",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 500,
        maxHp: 500,
        combatStats: { hp: 500, attack: 50, defense: 100, spAttack: 50, spDefense: 100, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWith } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.base, {
          id: "onix-with",
          definitionId: "onix",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          moveIds: ["earthquake"],
          currentPp: { earthquake: 10 },
          combatStats: {
            hp: 165,
            attack: 50,
            defense: 170,
            spAttack: 30,
            spDefense: 50,
            speed: 75,
          },
          derivedStats: { movement: 3, jump: 1, initiative: 75 },
          heldItemId: HeldItemId.ThickClub,
        }),
        targetWith,
      ]);
      engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "onix-with",
        moveId: "earthquake",
        targetPosition: { x: 1, y: 0 },
      });

      const targetWithout = MockPokemon.fresh(MockPokemon.base, {
        id: "target-without",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 500,
        maxHp: 500,
        combatStats: { hp: 500, attack: 50, defense: 100, spAttack: 50, spDefense: 100, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWithout } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.base, {
          id: "onix-without",
          definitionId: "onix",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          moveIds: ["earthquake"],
          currentPp: { earthquake: 10 },
          combatStats: {
            hp: 165,
            attack: 50,
            defense: 170,
            spAttack: 30,
            spDefense: 50,
            speed: 75,
          },
          derivedStats: { movement: 3, jump: 1, initiative: 75 },
        }),
        targetWithout,
      ]);
      engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "onix-without",
        moveId: "earthquake",
        targetPosition: { x: 1, y: 0 },
      });

      const damageWith = 500 - targetWith.currentHp;
      const damageWithout = 500 - targetWithout.currentHp;
      expect(damageWith).toBe(damageWithout);
    });
  });

  describe("Marowak Thick Club does not boost Special moves", () => {
    it("Given Marowak with Thick Club, When uses thunderbolt (Special), Then damage same as without item", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const targetWith = MockPokemon.fresh(MockPokemon.base, {
        id: "target-with",
        playerId: PlayerId.Player2,
        position: { x: 0, y: 2 },
        currentHp: 500,
        maxHp: 500,
        combatStats: { hp: 500, attack: 50, defense: 100, spAttack: 50, spDefense: 100, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWith } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.base, {
          id: "marowak-with",
          definitionId: "marowak",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          moveIds: ["thunderbolt"],
          currentPp: { thunderbolt: 15 },
          combatStats: {
            hp: 170,
            attack: 85,
            defense: 115,
            spAttack: 55,
            spDefense: 85,
            speed: 50,
          },
          derivedStats: { movement: 3, jump: 1, initiative: 50 },
          heldItemId: HeldItemId.ThickClub,
        }),
        targetWith,
      ]);
      engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "marowak-with",
        moveId: "thunderbolt",
        targetPosition: { x: 0, y: 2 },
      });

      const targetWithout = MockPokemon.fresh(MockPokemon.base, {
        id: "target-without",
        playerId: PlayerId.Player2,
        position: { x: 0, y: 2 },
        currentHp: 500,
        maxHp: 500,
        combatStats: { hp: 500, attack: 50, defense: 100, spAttack: 50, spDefense: 100, speed: 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWithout } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.base, {
          id: "marowak-without",
          definitionId: "marowak",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          moveIds: ["thunderbolt"],
          currentPp: { thunderbolt: 15 },
          combatStats: {
            hp: 170,
            attack: 85,
            defense: 115,
            spAttack: 55,
            spDefense: 85,
            speed: 50,
          },
          derivedStats: { movement: 3, jump: 1, initiative: 50 },
        }),
        targetWithout,
      ]);
      engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "marowak-without",
        moveId: "thunderbolt",
        targetPosition: { x: 0, y: 2 },
      });

      const damageWith = 500 - targetWith.currentHp;
      const damageWithout = 500 - targetWithout.currentHp;
      expect(damageWith).toBe(damageWithout);
    });
  });
});
