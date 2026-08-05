import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
import { buildItemTestEngine, MockBattle, MockPokemon } from "../testing";
import type { BattleEvent } from "../types/battle-event";
import { applyRevealsFromEvents } from "./reveal-tracking";

function scene() {
  const holder = MockPokemon.fresh(MockPokemon.base, {
    id: "holder",
    heldItemId: HeldItemId.Leftovers,
  });
  const other = MockPokemon.fresh(MockPokemon.base, { id: "other", position: { x: 1, y: 0 } });
  return { state: MockBattle.stateFrom([holder, other]), holder, other };
}

function apply(events: BattleEvent[]) {
  const built = scene();
  applyRevealsFromEvents(built.state, events);
  return built;
}

describe("applyRevealsFromEvents", () => {
  it("reveals the item of a holder whose item just acted", () => {
    const { holder } = apply([
      {
        type: BattleEventType.HeldItemActivated,
        pokemonId: "holder",
        itemId: HeldItemId.Leftovers,
        targetIds: [],
      },
    ]);
    expect(holder.revealedItem).toBe(true);
  });

  it("reveals a consumed, burnt, flung or recycled item", () => {
    for (const type of [
      BattleEventType.HeldItemConsumed,
      BattleEventType.ItemBurned,
      BattleEventType.ItemFlung,
      BattleEventType.ItemRecycled,
      BattleEventType.ItemKnockedOff,
    ] as const) {
      const { holder } = apply([{ type, pokemonId: "holder", itemId: HeldItemId.Leftovers }]);
      expect(holder.revealedItem).toBe(true);
    }
  });

  it("reveals an eaten berry to its eater", () => {
    const { holder } = apply([
      { type: BattleEventType.BerryEaten, eaterId: "holder", itemId: HeldItemId.SitrusBerry },
    ]);
    expect(holder.revealedItem).toBe(true);
  });

  it("reveals both ends of a theft and of a swap", () => {
    const stolen = apply([
      {
        type: BattleEventType.ItemStolen,
        thiefId: "other",
        victimId: "holder",
        itemId: HeldItemId.Leftovers,
      },
    ]);
    expect(stolen.holder.revealedItem).toBe(true);
    expect(stolen.other.revealedItem).toBe(true);

    const swapped = apply([
      {
        type: BattleEventType.ItemsSwapped,
        pokemonId: "holder",
        otherId: "other",
        itemId: HeldItemId.Leftovers,
        otherItemId: HeldItemId.ChoiceBand,
      },
    ]);
    expect(swapped.holder.revealedItem).toBe(true);
    expect(swapped.other.revealedItem).toBe(true);
  });

  it("reveals an ability that activated", () => {
    const { holder } = apply([
      {
        type: BattleEventType.AbilityActivated,
        pokemonId: "holder",
        abilityId: "static",
        targetIds: [],
      },
    ]);
    expect(holder.revealedAbility).toBe(true);
    expect(holder.revealedItem).toBeUndefined();
  });

  it("reveals nothing from an event that named no item", () => {
    const { holder } = apply([{ type: BattleEventType.ItemMoveFailed, pokemonId: "holder" }]);
    expect(holder.revealedItem).toBeUndefined();
    expect(holder.revealedAbility).toBeUndefined();
  });

  it("is wired to submitAction: Restes healing at end of turn reveals the item", () => {
    const holder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      heldItemId: HeldItemId.Leftovers,
      currentHp: 10,
    });
    const other = MockPokemon.fresh(MockPokemon.charmander, {
      id: "other",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
    });
    const { engine, state } = buildItemTestEngine([holder, other], 6, "holder");

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "holder",
    });

    expect(result.events.map((event) => event.type)).toContain(BattleEventType.HeldItemActivated);
    expect(state.pokemon.get("holder")?.revealedItem).toBe(true);
  });

  it("is wired to consumeStartupEvents: Intimidation firing on entry reveals the ability", () => {
    const intimidator = MockPokemon.fresh(MockPokemon.base, {
      id: "intimidator",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "intimidate",
    });
    const neighbour = MockPokemon.fresh(MockPokemon.charmander, {
      id: "neighbour",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });
    const { engine, state } = buildItemTestEngine([intimidator, neighbour], 6, "intimidator");

    const startupEvents = engine.consumeStartupEvents();

    expect(startupEvents.map((event) => event.type)).toContain(BattleEventType.AbilityActivated);
    expect(state.pokemon.get("intimidator")?.revealedAbility).toBe(true);
  });

  it("ignores an event pointing at a Pokémon that is not on the field", () => {
    const { state } = scene();
    expect(() =>
      applyRevealsFromEvents(state, [
        {
          type: BattleEventType.HeldItemActivated,
          pokemonId: "ghost",
          itemId: HeldItemId.Leftovers,
          targetIds: [],
        },
      ]),
    ).not.toThrow();
  });
});
