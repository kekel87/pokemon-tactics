import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("Mental Herb (end to end)", () => {
  describe("cures Taunt the instant it lands", () => {
    it("Given a Mental Herb holder is hit by taunt, Then Provoc is cured, item consumed, status moves stay legal", () => {
      const taunter = MockPokemon.fresh(MockPokemon.base, {
        id: "taunter",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["taunt"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const holder = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        moveIds: ["water-gun", "withdraw"],
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
        heldItemId: HeldItemId.MentalHerb,
      });
      const { engine } = buildItemTestEngine([taunter, holder]);

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "taunter",
        moveId: "taunt",
        targetPosition: { x: 1, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(holder.volatileStatuses.some((v) => v.type === StatusType.Taunted)).toBe(false);
      expect(holder.heldItemId).toBeUndefined();

      const itemActivated = result.events.find(
        (e) =>
          e.type === BattleEventType.HeldItemActivated &&
          "itemId" in e &&
          e.itemId === HeldItemId.MentalHerb,
      );
      expect(itemActivated).toBeDefined();
      expect(result.events.map((e) => e.type)).toContain(BattleEventType.HeldItemConsumed);
    });
  });

  describe("without the herb the Taunt holds", () => {
    it("Given a holder without Mental Herb is hit by taunt, Then Provoc persists", () => {
      const taunter = MockPokemon.fresh(MockPokemon.base, {
        id: "taunter",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["taunt"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const holder = MockPokemon.fresh(MockPokemon.squirtle, {
        id: "holder",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        moveIds: ["water-gun", "withdraw"],
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const { engine } = buildItemTestEngine([taunter, holder]);

      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "taunter",
        moveId: "taunt",
        targetPosition: { x: 1, y: 0 },
      });

      expect(holder.volatileStatuses.some((v) => v.type === StatusType.Taunted)).toBe(true);
    });
  });
});
