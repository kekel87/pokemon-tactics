import { describe, expect, it } from "vitest";
import { MockPokemon } from "../testing";
import {
  METRONOME_MAX_STEPS,
  metronomeDamageMultiplier,
  pendingMetronomeSteps,
} from "./metronome-streak";

describe("pendingMetronomeSteps", () => {
  it("returns 0 for a fresh user with no recorded move", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.squirtle, {});
    expect(pendingMetronomeSteps(pokemon, "tackle")).toBe(0);
  });

  it("increments when the same move continues after a successful use", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.squirtle, {
      lastUsedMoveId: "tackle",
      metronomeStreak: 0,
      lastMoveFailed: false,
    });
    expect(pendingMetronomeSteps(pokemon, "tackle")).toBe(1);
  });

  it("keeps climbing across multiple consecutive successful uses", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.squirtle, {
      lastUsedMoveId: "tackle",
      metronomeStreak: 3,
      lastMoveFailed: false,
    });
    expect(pendingMetronomeSteps(pokemon, "tackle")).toBe(4);
  });

  it("resets to 0 when the move changes", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.squirtle, {
      lastUsedMoveId: "tackle",
      metronomeStreak: 5,
      lastMoveFailed: false,
    });
    expect(pendingMetronomeSteps(pokemon, "water-gun")).toBe(0);
  });

  it("resets to 0 when the previous use failed", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.squirtle, {
      lastUsedMoveId: "tackle",
      metronomeStreak: 5,
      lastMoveFailed: true,
    });
    expect(pendingMetronomeSteps(pokemon, "tackle")).toBe(0);
  });

  it("clamps at the maximum step count", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.squirtle, {
      lastUsedMoveId: "tackle",
      metronomeStreak: METRONOME_MAX_STEPS,
      lastMoveFailed: false,
    });
    expect(pendingMetronomeSteps(pokemon, "tackle")).toBe(METRONOME_MAX_STEPS);
  });
});

describe("metronomeDamageMultiplier", () => {
  it("is neutral at zero steps", () => {
    expect(metronomeDamageMultiplier(0)).toBe(1);
  });

  it("adds 10% per step", () => {
    expect(metronomeDamageMultiplier(1)).toBeCloseTo(1.1);
  });

  it("caps at +100% over the maximum streak", () => {
    expect(metronomeDamageMultiplier(METRONOME_MAX_STEPS)).toBeCloseTo(2.0);
  });
});
