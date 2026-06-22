import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { Direction } from "../../enums/direction";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("Protective Pads", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("nullifies the target's contact reactions", () => {
    it("Given an attacker with Pare-Effet uses a contact move into a Casque Brut holder, Then it takes no recoil", () => {
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
        heldItemId: HeldItemId.ProtectivePads,
      });
      const holder = MockPokemon.fresh(MockPokemon.charmander, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.RockyHelmet,
      });
      const { engine, state } = buildItemTestEngine([attacker, holder]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(state.pokemon.get("attacker")?.currentHp).toBe(200);
    });

    it("Given the same attacker WITHOUT Pare-Effet, Then Casque Brut recoils on it (control)", () => {
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
      });
      const holder = MockPokemon.fresh(MockPokemon.charmander, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
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

    it("Given an attacker with Pare-Effet uses a contact move into a Statik holder, Then it is not paralysed", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const attacker = MockPokemon.fresh(MockPokemon.base, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        moveIds: ["scratch"],
        currentPp: { scratch: 35 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.ProtectivePads,
      });
      const pikachu = MockPokemon.fresh(MockPokemon.base, {
        id: "pikachu",
        definitionId: "pikachu",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
        abilityId: "static",
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine, state } = buildItemTestEngine([attacker, pikachu]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "scratch",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(
        state.pokemon.get("attacker")?.statusEffects.some((s) => s.type === StatusType.Paralyzed),
      ).toBe(false);
    });

    it("Given the same attacker WITHOUT Pare-Effet, Then Statik paralyses it (control)", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const attacker = MockPokemon.fresh(MockPokemon.base, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        moveIds: ["scratch"],
        currentPp: { scratch: 35 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const pikachu = MockPokemon.fresh(MockPokemon.base, {
        id: "pikachu",
        definitionId: "pikachu",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
        abilityId: "static",
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine, state } = buildItemTestEngine([attacker, pikachu]);

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "scratch",
        targetPosition: { x: 1, y: 0 },
      });

      expect(
        state.pokemon.get("attacker")?.statusEffects.some((s) => s.type === StatusType.Paralyzed),
      ).toBe(true);
    });
  });

  describe("does not affect non-contact moves", () => {
    it("Given a Pare-Effet holder uses a non-contact move, Then it lands normally and the target takes damage", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        moveIds: ["water-gun"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.ProtectivePads,
      });
      const target = MockPokemon.fresh(MockPokemon.charmander, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        orientation: Direction.West,
        currentHp: 200,
        maxHp: 200,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine, state } = buildItemTestEngine([attacker, target]);

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "water-gun",
        targetPosition: { x: 1, y: 0 },
      });

      expect(state.pokemon.get("target")?.currentHp).toBeLessThan(200);
    });
  });
});
