import { loadData } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { BattleEventType } from "../enums/battle-event-type";
import { HeldItemId } from "../enums/held-item-id";
import { StatusType } from "../enums/status-type";
import { MockPokemon } from "../testing";
import { tryMentalHerbCure } from "./mental-herb";

const itemRegistry = loadData().itemRegistry;

const RESTRICTING_VOLATILES = [
  StatusType.Taunted,
  StatusType.Encored,
  StatusType.Disabled,
  StatusType.Infatuated,
  StatusType.HealBlocked,
] as const;

describe("tryMentalHerbCure", () => {
  describe("cures a restricting volatile and consumes the herb", () => {
    for (const status of RESTRICTING_VOLATILES) {
      it(`Given a Mental Herb holder afflicted by ${status}, Then the volatile is removed, item consumed, events emitted`, () => {
        const holder = MockPokemon.fresh(MockPokemon.base, {
          id: "holder",
          heldItemId: HeldItemId.MentalHerb,
          volatileStatuses: [{ type: status, remainingTurns: 3 }],
        });

        const events = tryMentalHerbCure(holder, status, itemRegistry);

        expect(holder.volatileStatuses.some((v) => v.type === status)).toBe(false);
        expect(holder.heldItemId).toBeUndefined();
        expect(events.map((e) => e.type)).toEqual([
          BattleEventType.HeldItemActivated,
          BattleEventType.StatusRemoved,
          BattleEventType.HeldItemConsumed,
        ]);
        const removed = events.find((e) => e.type === BattleEventType.StatusRemoved);
        expect(removed && "status" in removed ? removed.status : undefined).toBe(status);
      });
    }
  });

  describe("does not cure a non-restricting volatile", () => {
    it("Given a Mental Herb holder is Confused, Then nothing happens and the herb is kept", () => {
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        heldItemId: HeldItemId.MentalHerb,
        volatileStatuses: [{ type: StatusType.Confused, remainingTurns: 3 }],
      });

      const events = tryMentalHerbCure(holder, StatusType.Confused, itemRegistry);

      expect(events).toHaveLength(0);
      expect(holder.volatileStatuses.some((v) => v.type === StatusType.Confused)).toBe(true);
      expect(holder.heldItemId).toBe(HeldItemId.MentalHerb);
    });
  });

  describe("does nothing without the herb", () => {
    it("Given a holder without Mental Herb is Taunted, Then the volatile remains", () => {
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        volatileStatuses: [{ type: StatusType.Taunted, remainingTurns: 3 }],
      });

      const events = tryMentalHerbCure(holder, StatusType.Taunted, itemRegistry);

      expect(events).toHaveLength(0);
      expect(holder.volatileStatuses.some((v) => v.type === StatusType.Taunted)).toBe(true);
    });

    it("Given a holder with a non-curing item is Taunted, Then the volatile remains", () => {
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        heldItemId: HeldItemId.Leftovers,
        volatileStatuses: [{ type: StatusType.Taunted, remainingTurns: 3 }],
      });

      const events = tryMentalHerbCure(holder, StatusType.Taunted, itemRegistry);

      expect(events).toHaveLength(0);
      expect(holder.heldItemId).toBe(HeldItemId.Leftovers);
    });
  });

  describe("no-op when the volatile was never applied", () => {
    it("Given a Mental Herb holder with no Taunt volatile, Then nothing happens", () => {
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        heldItemId: HeldItemId.MentalHerb,
        volatileStatuses: [],
      });

      const events = tryMentalHerbCure(holder, StatusType.Taunted, itemRegistry);

      expect(events).toHaveLength(0);
      expect(holder.heldItemId).toBe(HeldItemId.MentalHerb);
    });
  });

  describe("no registry", () => {
    it("Given no item registry is provided, Then nothing happens", () => {
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        heldItemId: HeldItemId.MentalHerb,
        volatileStatuses: [{ type: StatusType.Taunted, remainingTurns: 3 }],
      });

      const events = tryMentalHerbCure(holder, StatusType.Taunted, undefined);

      expect(events).toHaveLength(0);
      expect(holder.volatileStatuses.some((v) => v.type === StatusType.Taunted)).toBe(true);
    });
  });
});
