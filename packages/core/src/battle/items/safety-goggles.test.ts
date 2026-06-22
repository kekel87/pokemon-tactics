import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { Weather } from "../../enums/weather";
import { buildItemTestEngine, MockPokemon } from "../../testing";
import { setWeather } from "../weather-system";

describe("Safety Goggles", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Poudre-move immunity", () => {
    it("Given a Lunettes Filtre holder is hit by Poudre Dodo, Then no sleep is applied and the item activates", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
        id: "caster",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["sleep-powder"],
        currentPp: { "sleep-powder": 15 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.SafetyGoggles,
      });
      const { engine, state } = buildItemTestEngine([caster, holder]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "caster",
        moveId: "sleep-powder",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(state.pokemon.get("holder")?.statusEffects).toHaveLength(0);
      const activated = result.events.find(
        (e) =>
          e.type === BattleEventType.HeldItemActivated &&
          "itemId" in e &&
          e.itemId === HeldItemId.SafetyGoggles,
      );
      expect(activated).toBeDefined();
    });

    it("Given a holder without the goggles is hit by Poudre Dodo, Then it falls asleep (control)", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
        id: "caster",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["sleep-powder"],
        currentPp: { "sleep-powder": 15 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine, state } = buildItemTestEngine([caster, target]);

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "caster",
        moveId: "sleep-powder",
        targetPosition: { x: 1, y: 0 },
      });

      expect(
        state.pokemon.get("target")?.statusEffects.some((s) => s.type === StatusType.Asleep),
      ).toBe(true);
    });

    it("Given a Lunettes Filtre holder is hit by a non-Poudre move, Then it lands normally", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["water-gun"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 200,
        maxHp: 200,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.SafetyGoggles,
      });
      const { engine, state } = buildItemTestEngine([attacker, holder]);

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "water-gun",
        targetPosition: { x: 1, y: 0 },
      });

      expect(state.pokemon.get("holder")?.currentHp).toBeLessThan(200);
    });
  });

  describe("weather chip immunity", () => {
    it("Given a sandstorm, Then the Lunettes Filtre holder takes no chip on its turn", () => {
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        currentHp: 160,
        maxHp: 160,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.SafetyGoggles,
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 4, y: 4 },
        currentHp: 160,
        maxHp: 160,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine, state } = buildItemTestEngine([holder, foe]);
      setWeather(state, Weather.Sandstorm, 5);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "holder",
        direction: Direction.South,
      });

      expect(result.success).toBe(true);
      expect(state.pokemon.get("holder")?.currentHp).toBe(160);
      expect(result.events.some((e) => e.type === BattleEventType.WeatherDamage)).toBe(false);
    });

    it("Given a sandstorm and no goggles, Then the control mon takes chip on its turn (control)", () => {
      const control = MockPokemon.fresh(MockPokemon.base, {
        id: "control",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        currentHp: 160,
        maxHp: 160,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 4, y: 4 },
        currentHp: 160,
        maxHp: 160,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine, state } = buildItemTestEngine([control, foe]);
      setWeather(state, Weather.Sandstorm, 5);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "control",
        direction: Direction.South,
      });

      expect(result.success).toBe(true);
      expect(state.pokemon.get("control")?.currentHp).toBeLessThan(160);
      expect(result.events.some((e) => e.type === BattleEventType.WeatherDamage)).toBe(true);
    });
  });
});
