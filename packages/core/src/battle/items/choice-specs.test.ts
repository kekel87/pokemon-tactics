import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("Choice Specs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("damage boost — Special move", () => {
    it("Given Mewtwo with Choice Specs, When uses psychic (Special), Then damage dealt is greater than without item", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const targetWith = MockPokemon.fresh(MockPokemon.base, {
        id: "target-with",
        playerId: PlayerId.Player2,
        position: { x: 0, y: 2 },
        currentHp: 9999,
        maxHp: 9999,
        combatStats: {
          hp: 9999,
          attack: 50,
          defense: 500,
          spAttack: 50,
          spDefense: 200,
          speed: 10,
        },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWith } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.base, {
          id: "mewtwo-with",
          definitionId: "mewtwo",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          moveIds: ["psychic"],
          currentPp: { psychic: 10 },
          combatStats: {
            hp: 416,
            attack: 110,
            defense: 90,
            spAttack: 194,
            spDefense: 120,
            speed: 130,
          },
          derivedStats: { movement: 4, jump: 1, initiative: 130 },
          heldItemId: HeldItemId.ChoiceSpecs,
        }),
        targetWith,
      ]);
      engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "mewtwo-with",
        moveId: "psychic",
        targetPosition: { x: 0, y: 2 },
      });

      const targetWithout = MockPokemon.fresh(MockPokemon.base, {
        id: "target-without",
        playerId: PlayerId.Player2,
        position: { x: 0, y: 2 },
        currentHp: 9999,
        maxHp: 9999,
        combatStats: {
          hp: 9999,
          attack: 50,
          defense: 500,
          spAttack: 50,
          spDefense: 200,
          speed: 10,
        },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWithout } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.base, {
          id: "mewtwo-without",
          definitionId: "mewtwo",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          moveIds: ["psychic"],
          currentPp: { psychic: 10 },
          combatStats: {
            hp: 416,
            attack: 110,
            defense: 90,
            spAttack: 194,
            spDefense: 120,
            speed: 130,
          },
          derivedStats: { movement: 4, jump: 1, initiative: 130 },
        }),
        targetWithout,
      ]);
      engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "mewtwo-without",
        moveId: "psychic",
        targetPosition: { x: 0, y: 2 },
      });

      const damageWith = 500 - targetWith.currentHp;
      const damageWithout = 500 - targetWithout.currentHp;
      expect(damageWith).toBeGreaterThan(damageWithout);
    });
  });

  describe("damage boost — Physical move", () => {
    it("Given Mewtwo with Choice Specs, When uses scratch (Physical), Then damage equal to without item (no boost)", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const targetWith = MockPokemon.fresh(MockPokemon.base, {
        id: "target-with",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 9999,
        maxHp: 9999,
        combatStats: {
          hp: 9999,
          attack: 50,
          defense: 300,
          spAttack: 50,
          spDefense: 300,
          speed: 10,
        },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWith } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.base, {
          id: "mewtwo-with",
          definitionId: "mewtwo",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          moveIds: ["scratch"],
          currentPp: { scratch: 35 },
          combatStats: {
            hp: 416,
            attack: 110,
            defense: 90,
            spAttack: 194,
            spDefense: 120,
            speed: 130,
          },
          derivedStats: { movement: 4, jump: 1, initiative: 130 },
          heldItemId: HeldItemId.ChoiceSpecs,
        }),
        targetWith,
      ]);
      engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "mewtwo-with",
        moveId: "scratch",
        targetPosition: { x: 1, y: 0 },
      });

      const targetWithout = MockPokemon.fresh(MockPokemon.base, {
        id: "target-without",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 9999,
        maxHp: 9999,
        combatStats: {
          hp: 9999,
          attack: 50,
          defense: 300,
          spAttack: 50,
          spDefense: 300,
          speed: 10,
        },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWithout } = buildItemTestEngine([
        MockPokemon.fresh(MockPokemon.base, {
          id: "mewtwo-without",
          definitionId: "mewtwo",
          playerId: PlayerId.Player1,
          position: { x: 0, y: 0 },
          moveIds: ["scratch"],
          currentPp: { scratch: 35 },
          combatStats: {
            hp: 416,
            attack: 110,
            defense: 90,
            spAttack: 194,
            spDefense: 120,
            speed: 130,
          },
          derivedStats: { movement: 4, jump: 1, initiative: 130 },
        }),
        targetWithout,
      ]);
      engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "mewtwo-without",
        moveId: "scratch",
        targetPosition: { x: 1, y: 0 },
      });

      const damageWith = 500 - targetWith.currentHp;
      const damageWithout = 500 - targetWithout.currentHp;
      expect(damageWith).toBe(damageWithout);
    });
  });

  describe("move lock after use", () => {
    it("Given Mewtwo with Choice Specs, When uses psychic, Then lockedMoveId is set to psychic", () => {
      const mewtwo = MockPokemon.fresh(MockPokemon.base, {
        id: "mewtwo",
        definitionId: "mewtwo",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["psychic", "ice-beam"],
        currentPp: { psychic: 10, "ice-beam": 10 },
        combatStats: {
          hp: 416,
          attack: 110,
          defense: 90,
          spAttack: 194,
          spDefense: 120,
          speed: 130,
        },
        derivedStats: { movement: 4, jump: 1, initiative: 130 },
        heldItemId: HeldItemId.ChoiceSpecs,
      });
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 0, y: 2 },
        currentHp: 9999,
        maxHp: 9999,
        combatStats: {
          hp: 9999,
          attack: 50,
          defense: 500,
          spAttack: 50,
          spDefense: 500,
          speed: 10,
        },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([mewtwo, target]);

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "mewtwo",
        moveId: "psychic",
        targetPosition: { x: 0, y: 2 },
      });

      const state = engine.getGameState(PlayerId.Player1);
      expect(state.pokemon.get("mewtwo")?.lockedMoveId).toBe("psychic");
    });

    it("Given Mewtwo with Choice Specs locked on psychic, When getLegalActions, Then only psychic available as move", () => {
      const mewtwo = MockPokemon.fresh(MockPokemon.base, {
        id: "mewtwo",
        definitionId: "mewtwo",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["psychic", "ice-beam"],
        currentPp: { psychic: 10, "ice-beam": 10 },
        combatStats: {
          hp: 416,
          attack: 110,
          defense: 90,
          spAttack: 194,
          spDefense: 120,
          speed: 130,
        },
        derivedStats: { movement: 4, jump: 1, initiative: 130 },
        heldItemId: HeldItemId.ChoiceSpecs,
        lockedMoveId: "psychic",
      });
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 0, y: 2 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([mewtwo, target]);

      const actions = engine.getLegalActions(PlayerId.Player1);
      const useMoveActions = actions.filter((a) => a.kind === ActionKind.UseMove);
      for (const a of useMoveActions) {
        if (a.kind === ActionKind.UseMove) {
          expect(a.moveId).toBe("psychic");
        }
      }
    });
  });

  describe("move lock state after successful use", () => {
    it("Given Mewtwo with Choice Specs uses psychic successfully, When state read, Then lockedMoveId defined and action succeeded", () => {
      const mewtwo = MockPokemon.fresh(MockPokemon.base, {
        id: "mewtwo",
        definitionId: "mewtwo",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["psychic", "thunderbolt"],
        currentPp: { psychic: 10, thunderbolt: 15 },
        combatStats: {
          hp: 416,
          attack: 110,
          defense: 90,
          spAttack: 194,
          spDefense: 120,
          speed: 130,
        },
        derivedStats: { movement: 4, jump: 1, initiative: 130 },
        heldItemId: HeldItemId.ChoiceSpecs,
      });
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 0, y: 2 },
        currentHp: 9999,
        maxHp: 9999,
        combatStats: {
          hp: 9999,
          attack: 50,
          defense: 500,
          spAttack: 50,
          spDefense: 500,
          speed: 10,
        },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([mewtwo, target]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "mewtwo",
        moveId: "psychic",
        targetPosition: { x: 0, y: 2 },
      });

      expect(result.success).toBe(true);
      expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);

      const state = engine.getGameState(PlayerId.Player1);
      expect(state.pokemon.get("mewtwo")?.lockedMoveId).toBe("psychic");
    });
  });
});
