import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { Direction } from "../../enums/direction";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("Eject items", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Bouton Fuite (eject-button)", () => {
    it("Given the holder is hit while away from its spawn, Then it teleports home and the item is consumed", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 3, y: 2 },
        orientation: Direction.West,
        moveIds: ["tackle"],
        currentPp: { tackle: 30 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const holder = MockPokemon.fresh(MockPokemon.charmander, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 2, y: 2 },
        orientation: Direction.East,
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.EjectButton,
      });
      const { engine, state } = buildItemTestEngine([attacker, holder]);
      const liveHolder = state.pokemon.get("holder");
      if (liveHolder !== undefined) {
        liveHolder.spawnPosition = { x: 0, y: 5 };
      }

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "tackle",
        targetPosition: { x: 2, y: 2 },
      });

      expect(state.pokemon.get("holder")?.position).toEqual({ x: 0, y: 5 });
      expect(state.pokemon.get("holder")?.heldItemId).toBeUndefined();
    });
  });

  describe("Carton Rouge (red-card)", () => {
    it("Given the holder is hit, Then the ATTACKER is teleported to its spawn and the item is consumed", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 3, y: 2 },
        orientation: Direction.West,
        moveIds: ["tackle"],
        currentPp: { tackle: 30 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const holder = MockPokemon.fresh(MockPokemon.charmander, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 2, y: 2 },
        orientation: Direction.East,
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.RedCard,
      });
      const { engine, state } = buildItemTestEngine([attacker, holder]);
      const liveAttacker = state.pokemon.get("attacker");
      if (liveAttacker !== undefined) {
        liveAttacker.spawnPosition = { x: 5, y: 5 };
      }

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "tackle",
        targetPosition: { x: 2, y: 2 },
      });

      expect(state.pokemon.get("attacker")?.position).toEqual({ x: 5, y: 5 });
      expect(state.pokemon.get("holder")?.heldItemId).toBeUndefined();
    });
  });
});
