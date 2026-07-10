import { describe, expect, it } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import { MockBattle, MockPokemon } from "../../testing";
import { magnetRiseTickHandler } from "./magnet-rise-tick-handler";

const P1 = MockBattle.player1Fast;

describe("magnetRiseTickHandler", () => {
  it("decrements the levitation counter without an event while turns remain", () => {
    const pokemon = MockPokemon.fresh(P1, { magnetRiseTurns: 5 });
    const result = magnetRiseTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

    expect(pokemon.magnetRiseTurns).toBe(4);
    expect(result.events).toHaveLength(0);
  });

  it("expires levitation and emits MagnetRiseEnded on the last turn", () => {
    const pokemon = MockPokemon.fresh(P1, { magnetRiseTurns: 1 });
    const result = magnetRiseTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

    expect(pokemon.magnetRiseTurns).toBeUndefined();
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.MagnetRiseEnded);
  });

  it("is a no-op when the mon is not levitating", () => {
    const pokemon = MockPokemon.fresh(P1, {});
    const result = magnetRiseTickHandler(pokemon.id, MockBattle.stateFrom([pokemon]));

    expect(pokemon.magnetRiseTurns).toBeUndefined();
    expect(result.events).toHaveLength(0);
  });
});
