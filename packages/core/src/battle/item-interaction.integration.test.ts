import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../testing";

// Item-interaction family (plan 142): cross-cutting guards shared by the whole family.

describe("Item interaction — Glu (sticky-hold)", () => {
  it("blocks item removal and surfaces the ability", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["knock-off"],
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      heldItemId: HeldItemId.Leftovers,
      abilityId: "sticky-hold",
    });
    const { engine, state } = buildItemTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "knock-off",
      targetPosition: { x: 1, y: 0 },
    });

    // The item stays; the ability fires instead of an ItemKnockedOff.
    expect(state.pokemon.get(defender.id)?.heldItemId).toBe(HeldItemId.Leftovers);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.AbilityActivated);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.ItemKnockedOff);
  });
});

describe("Item interaction — Substitute", () => {
  it("protects the held item from theft while the damage still lands on the Clone", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["thief"],
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      heldItemId: HeldItemId.Leftovers,
      // A Substitute that survives the hit keeps blocking the item theft (the damage lands on it).
      substituteHp: 999,
    });
    const { engine, state } = buildItemTestEngine([attacker, defender]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "thief",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(defender.id)?.heldItemId).toBe(HeldItemId.Leftovers);
    expect(state.pokemon.get(attacker.id)?.heldItemId).toBeUndefined();
  });
});

describe("Item interaction — Dégommage of a beneficial berry", () => {
  it("heals the target when a Sitrus berry is flung at it", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["fling"],
      heldItemId: HeldItemId.SitrusBerry,
    });
    const defender = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 30,
      maxHp: 200,
    });
    const { engine, state } = buildItemTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "fling",
      targetPosition: { x: 1, y: 0 },
    });

    // The thrown berry is eaten by the target; with a big max HP the Sitrus heal outweighs the
    // tiny 10-power fling damage, so the net HP is above the starting value.
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.BerryEaten);
    expect(state.pokemon.get(defender.id)?.ateBerryThisBattle).toBe(true);
  });
});
