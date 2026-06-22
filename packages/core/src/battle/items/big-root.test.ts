import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildItemTestEngine, MockPokemon } from "../../testing";

const BIG_ROOT_DRAIN_MOD = 1.3;

describe("Big Root", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("drain heal boost", () => {
    it("Given holder with Big Root uses giga-drain, Then the heal is floor(baseDrain * 1.3)", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const holderWith = MockPokemon.fresh(MockPokemon.bulbasaur, {
        id: "holder-with",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        currentHp: 1,
        maxHp: 200,
        moveIds: ["giga-drain"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.BigRoot,
      });
      const foeWith = MockPokemon.fresh(MockPokemon.base, {
        id: "foe-with",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWith } = buildItemTestEngine([holderWith, foeWith]);
      const resultWith = engineWith.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "holder-with",
        moveId: "giga-drain",
        targetPosition: { x: 1, y: 0 },
      });

      const holderWithout = MockPokemon.fresh(MockPokemon.bulbasaur, {
        id: "holder-without",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        currentHp: 1,
        maxHp: 200,
        moveIds: ["giga-drain"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const foeWithout = MockPokemon.fresh(MockPokemon.base, {
        id: "foe-without",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine: engineWithout } = buildItemTestEngine([holderWithout, foeWithout]);
      const resultWithout = engineWithout.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "holder-without",
        moveId: "giga-drain",
        targetPosition: { x: 1, y: 0 },
      });

      const healWith = resultWith.events.find(
        (e) =>
          e.type === BattleEventType.HpRestored &&
          "pokemonId" in e &&
          e.pokemonId === "holder-with",
      );
      const healWithout = resultWithout.events.find(
        (e) =>
          e.type === BattleEventType.HpRestored &&
          "pokemonId" in e &&
          e.pokemonId === "holder-without",
      );

      const baseHeal = healWithout && "amount" in healWithout ? healWithout.amount : 0;
      const boostedHeal = healWith && "amount" in healWith ? healWith.amount : 0;
      expect(baseHeal).toBeGreaterThan(0);
      expect(boostedHeal).toBe(Math.floor(baseHeal * BIG_ROOT_DRAIN_MOD));
    });
  });

  describe("liquid-ooze backlash is unaffected", () => {
    it("Given holder with Big Root drains a Suintement (liquid-ooze) foe, Then the holder takes backlash damage and is not healed", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const holder = MockPokemon.fresh(MockPokemon.bulbasaur, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        currentHp: 150,
        maxHp: 200,
        moveIds: ["giga-drain"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.BigRoot,
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        definitionId: "tentacruel",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        abilityId: "liquid-ooze",
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([holder, foe]);

      const hpBefore = holder.currentHp;
      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "holder",
        moveId: "giga-drain",
        targetPosition: { x: 1, y: 0 },
      });

      const healEvents = result.events.filter(
        (e) =>
          e.type === BattleEventType.HpRestored && "pokemonId" in e && e.pokemonId === "holder",
      );
      expect(healEvents).toHaveLength(0);
      expect(holder.currentHp).toBeLessThan(hpBefore);
    });
  });

  describe("heal block suppresses the heal entirely", () => {
    it("Given holder with Big Root is Heal-Blocked, When it uses giga-drain, Then no heal occurs and HealPrevented is emitted", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const holder = MockPokemon.fresh(MockPokemon.bulbasaur, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        currentHp: 1,
        maxHp: 200,
        moveIds: ["giga-drain"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.BigRoot,
        volatileStatuses: [{ type: StatusType.HealBlocked, remainingTurns: 3 }],
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([holder, foe]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "holder",
        moveId: "giga-drain",
        targetPosition: { x: 1, y: 0 },
      });

      const healEvents = result.events.filter(
        (e) =>
          e.type === BattleEventType.HpRestored && "pokemonId" in e && e.pokemonId === "holder",
      );
      expect(healEvents).toHaveLength(0);
      expect(holder.currentHp).toBe(1);
      expect(result.events.map((e) => e.type)).toContain(BattleEventType.HealPrevented);
    });
  });
});
