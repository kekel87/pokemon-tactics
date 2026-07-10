import { describe, expect, it } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import type { PokemonType } from "../../enums/pokemon-type";
import { StatusType } from "../../enums/status-type";
import { MockBattle, MockPokemon } from "../../testing";
import { DEFAULT_STATUS_RULES } from "../../types/status-rules";
import { createDrowsyTickHandler } from "./drowsy-tick-handler";

const P1 = MockBattle.player1Fast;

function handler() {
  return createDrowsyTickHandler({
    random: () => 0,
    statusRules: DEFAULT_STATUS_RULES,
    pokemonTypesMap: new Map<string, PokemonType[]>(),
    abilityRegistry: undefined,
  });
}

describe("drowsyTickHandler", () => {
  it("puts the mon to sleep when the drowsiness countdown reaches 0", () => {
    const pokemon = MockPokemon.fresh(P1, { drowsyTurns: 1, statusEffects: [] });
    const result = handler()(pokemon.id, MockBattle.stateFrom([pokemon]));

    expect(pokemon.drowsyTurns).toBeUndefined();
    expect(pokemon.statusEffects.some((status) => status.type === StatusType.Asleep)).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.StatusApplied);
  });

  it("does not sleep on the respite turn while the countdown is still > 1", () => {
    const pokemon = MockPokemon.fresh(P1, { drowsyTurns: 2, statusEffects: [] });
    handler()(pokemon.id, MockBattle.stateFrom([pokemon]));

    expect(pokemon.drowsyTurns).toBe(1);
    expect(pokemon.statusEffects.some((status) => status.type === StatusType.Asleep)).toBe(false);
  });

  it("does not stack sleep on a mon that already has a major status", () => {
    const pokemon = MockPokemon.fresh(P1, {
      drowsyTurns: 1,
      statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
    });
    handler()(pokemon.id, MockBattle.stateFrom([pokemon]));

    expect(pokemon.drowsyTurns).toBeUndefined();
    expect(pokemon.statusEffects.some((status) => status.type === StatusType.Asleep)).toBe(false);
  });
});
