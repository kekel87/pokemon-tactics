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

  it("clears defense applied on a previous turn", () => {
    const pokemon = MockPokemon.fresh(MockBattle.player1Fast, {
      activeDefense: { kind: DefensiveKind.Protect, appliedAtAction: 1 },
    });
    const state = MockBattle.stateFrom([pokemon]);
    state.actionCounter = 2;

    const result = defensiveClearHandler(pokemon.id, state);

    expect(pokemon.activeDefense).toBeNull();
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      type: BattleEventType.DefenseCleared,
      pokemonId: pokemon.id,
      defenseKind: DefensiveKind.Protect,
    });
  });

  it("clears a defense applied several actions ago", () => {
    const pokemon = MockPokemon.fresh(MockBattle.player1Fast, {
      activeDefense: { kind: DefensiveKind.Detect, appliedAtAction: 1 },
    });
    const state = MockBattle.stateFrom([pokemon]);
    state.actionCounter = 4;

    const result = defensiveClearHandler(pokemon.id, state);

    expect(pokemon.activeDefense).toBeNull();
    expect(result.events).toHaveLength(1);
  });

  it("does NOT clear defense applied on the current turn", () => {
    const pokemon = MockPokemon.fresh(MockBattle.player1Fast, {
      activeDefense: { kind: DefensiveKind.Counter, appliedAtAction: 1 },
    });
    const state = MockBattle.stateFrom([pokemon]);
    state.actionCounter = 1;

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
      activeDefense: { kind: DefensiveKind.Endure, appliedAtAction: 1 },
    });
    const state = MockBattle.stateFrom([pokemon]);
    state.actionCounter = 2;

    const result = defensiveClearHandler(pokemon.id, state);

    expect(result.skipAction).toBe(false);
    expect(result.restrictActions).toBe(false);
    expect(result.pokemonFainted).toBe(false);
  });
});
