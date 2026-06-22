import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { EntryHazardKind } from "../../enums/entry-hazard-kind";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../../testing";
import { postEntryHazard } from "../entry-hazard-system";

describe("Air Balloon", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Sol-move immunity while held", () => {
    it("Given a Ballon holder hit by a Ground move (mud-slap), Then it takes no damage", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["mud-slap"],
        currentPp: { "mud-slap": 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 200,
        maxHp: 200,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.AirBalloon,
      });
      const { engine, state } = buildItemTestEngine([attacker, holder]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "mud-slap",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(state.pokemon.get("holder")?.currentHp).toBe(200);
      expect(state.pokemon.get("holder")?.heldItemId).toBe(HeldItemId.AirBalloon);
    });
  });

  describe("pops on the first non-Ground damaging hit", () => {
    it("Given a Ballon holder is hit by tackle, Then it takes damage, the balloon pops and is consumed", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["tackle"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 200,
        maxHp: 200,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.AirBalloon,
      });
      const { engine, state } = buildItemTestEngine([attacker, holder]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "tackle",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(state.pokemon.get("holder")?.currentHp).toBeLessThan(200);
      expect(state.pokemon.get("holder")?.heldItemId).toBeUndefined();

      const activated = result.events.find(
        (e) =>
          e.type === BattleEventType.HeldItemActivated &&
          "itemId" in e &&
          e.itemId === HeldItemId.AirBalloon,
      );
      expect(activated).toBeDefined();
      expect(result.events.map((e) => e.type)).toContain(BattleEventType.HeldItemConsumed);
    });
  });

  describe("grounded again once popped", () => {
    it("Given the balloon has already popped, When a Ground move hits, Then it deals damage", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["mud-slap"],
        currentPp: { "mud-slap": 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const grounded = MockPokemon.fresh(MockPokemon.base, {
        id: "grounded",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 200,
        maxHp: 200,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine, state } = buildItemTestEngine([attacker, grounded]);

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "mud-slap",
        targetPosition: { x: 1, y: 0 },
      });

      expect(state.pokemon.get("grounded")?.currentHp).toBeLessThan(200);
    });
  });

  describe("airborne — immune to grounded entry hazards", () => {
    it("Given a Ballon holder walks onto Picots (spikes), Then it takes no hazard damage", () => {
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        currentHp: 200,
        maxHp: 200,
        derivedStats: { movement: 5, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.AirBalloon,
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 5, y: 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine, state } = buildItemTestEngine([holder, foe], 8);
      postEntryHazard(state, EntryHazardKind.Spikes, { x: 0, y: 1 });

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.Move,
        pokemonId: "holder",
        path: [
          { x: 0, y: 1 },
          { x: 0, y: 2 },
        ],
      });

      expect(result.success).toBe(true);
      expect(
        result.events.filter((e) => e.type === BattleEventType.EntryHazardTriggered),
      ).toHaveLength(0);
      expect(state.pokemon.get("holder")?.currentHp).toBe(200);
    });
  });
});
