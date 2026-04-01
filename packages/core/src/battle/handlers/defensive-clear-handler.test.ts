import { describe, expect, it } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import { DefensiveKind } from "../../enums/defensive-kind";
import { MockBattle, MockPokemon } from "../../testing";
import { defensiveClearHandler } from "./defensive-clear-handler";

describe("defensiveClearHandler", () => {
  it("returns neutral result when no activeDefense", () => {
    const pokemon = MockPokemon.fresh(MockBattle.player1Fast);
    const state = MockBattle.stateFrom([pokemon]);

    const result = defensiveClearHandler(pokemon.id, state);

    expect(result.events).toHaveLength(0);
    expect(result.skipAction).toBe(false);
    expect(result.pokemonFainted).toBe(false);
  });

  it("clears defense applied in a previous round", () => {
    const pokemon = MockPokemon.fresh(MockBattle.player1Fast, {
      activeDefense: { kind: DefensiveKind.Protect, roundApplied: 1, turnIndexApplied: 0 },
    });
    const state = MockBattle.stateFrom([pokemon]);
    state.roundNumber = 2;
    state.currentTurnIndex = 0;

    const result = defensiveClearHandler(pokemon.id, state);

    expect(pokemon.activeDefense).toBeNull();
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      type: BattleEventType.DefenseCleared,
      pokemonId: pokemon.id,
      defenseKind: DefensiveKind.Protect,
    });
  });

  it("clears defense applied earlier in the same round", () => {
    const pokemon = MockPokemon.fresh(MockBattle.player1Fast, {
      activeDefense: { kind: DefensiveKind.Detect, roundApplied: 1, turnIndexApplied: 0 },
    });
    const state = MockBattle.stateFrom([pokemon]);
    state.roundNumber = 1;
    state.currentTurnIndex = 2;

    const result = defensiveClearHandler(pokemon.id, state);

    expect(pokemon.activeDefense).toBeNull();
    expect(result.events).toHaveLength(1);
  });

  it("does NOT clear defense applied on the current turn", () => {
    const pokemon = MockPokemon.fresh(MockBattle.player1Fast, {
      activeDefense: { kind: DefensiveKind.Counter, roundApplied: 1, turnIndexApplied: 0 },
    });
    const state = MockBattle.stateFrom([pokemon]);
    state.roundNumber = 1;
    state.currentTurnIndex = 0;

    const result = defensiveClearHandler(pokemon.id, state);

    expect(pokemon.activeDefense).not.toBeNull();
    expect(result.events).toHaveLength(0);
  });

  it("returns neutral result for unknown pokemonId", () => {
    const state = MockBattle.stateFrom([]);

    const result = defensiveClearHandler("nonexistent", state);

    expect(result.events).toHaveLength(0);
  });

  it("does not affect other PhaseResult flags", () => {
    const pokemon = MockPokemon.fresh(MockBattle.player1Fast, {
      activeDefense: { kind: DefensiveKind.Endure, roundApplied: 1, turnIndexApplied: 0 },
    });
    const state = MockBattle.stateFrom([pokemon]);
    state.roundNumber = 2;

    const result = defensiveClearHandler(pokemon.id, state);

    expect(result.skipAction).toBe(false);
    expect(result.restrictActions).toBe(false);
    expect(result.pokemonFainted).toBe(false);
  });
});
