import { describe, expect, it } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import { MockBattle, MockPokemon } from "../../testing";
import { cursedTickHandler } from "./cursed-tick-handler";

const P1 = MockBattle.player1Fast;

describe("cursedTickHandler", () => {
  it("inflicts 25% max HP per turn and attributes the source", () => {
    const pokemon = MockPokemon.fresh(P1, {
      currentHp: 100,
      maxHp: 100,
      volatileStatuses: [
        { type: StatusType.Cursed, remainingTurns: -1, damagePerTurn: 0.25, sourceId: "ghost" },
      ],
    });
    const result = cursedTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

    expect(pokemon.currentHp).toBe(75);
    expect(result.events).toContainEqual({
      type: BattleEventType.CurseDamage,
      targetId: pokemon.id,
      amount: 25,
      sourceId: "ghost",
    });
  });

  it("KOs the target when the DoT drops it to 0", () => {
    const pokemon = MockPokemon.fresh(P1, {
      currentHp: 20,
      maxHp: 100,
      volatileStatuses: [
        { type: StatusType.Cursed, remainingTurns: -1, damagePerTurn: 0.25, sourceId: "ghost" },
      ],
    });
    const result = cursedTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

    expect(pokemon.currentHp).toBe(0);
    expect(result.pokemonFainted).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.PokemonKo);
  });

  it("does nothing without a Cursed volatile", () => {
    const pokemon = MockPokemon.fresh(P1, { currentHp: 100, maxHp: 100, volatileStatuses: [] });
    const result = cursedTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

    expect(pokemon.currentHp).toBe(100);
    expect(result.events).toHaveLength(0);
  });
});
