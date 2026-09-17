import { describe, expect, it } from "vitest";
import { StatName } from "../enums/stat-name";
import { MockBattle } from "../testing/mock-battle";
import { MockPokemon, ZERO_STAT_STAGES } from "../testing/mock-pokemon";
import { createRepetitionGuard, MAX_REPETITION_SIGNAL } from "./repetition-guard";

describe("createRepetitionGuard", () => {
  it("returns 0 the first time, then counts later visits", () => {
    const guard = createRepetitionGuard();
    const state = MockBattle.stateFrom([MockPokemon.fresh(MockPokemon.base)]);

    expect(guard.observe(state)).toBe(0);
    expect(guard.observe(state)).toBe(1);
    expect(guard.observe(state)).toBe(2);
  });

  it("never returns more than the cap, however long the loop runs", () => {
    const guard = createRepetitionGuard();
    const state = MockBattle.stateFrom([MockPokemon.fresh(MockPokemon.base)]);
    let last = 0;
    for (let i = 0; i < 50; i++) {
      last = guard.observe(state);
    }

    expect(last).toBe(MAX_REPETITION_SIGNAL);
  });

  it("tells two positions apart", () => {
    const guard = createRepetitionGuard();
    const here = MockBattle.stateFrom([
      MockPokemon.fresh(MockPokemon.base, { position: { x: 1, y: 1 } }),
    ]);
    const elsewhere = MockBattle.stateFrom([
      MockPokemon.fresh(MockPokemon.base, { position: { x: 2, y: 1 } }),
    ]);

    guard.observe(here);
    expect(guard.observe(elsewhere)).toBe(0);
    expect(guard.observe(here)).toBe(1);
  });

  it("sees a health change", () => {
    const guard = createRepetitionGuard();
    const full = MockBattle.stateFrom([MockPokemon.fresh(MockPokemon.base, { currentHp: 100 })]);
    const hurt = MockBattle.stateFrom([MockPokemon.fresh(MockPokemon.base, { currentHp: 40 })]);

    guard.observe(full);
    expect(guard.observe(hurt)).toBe(0);
  });

  it("sees a stat-stage change", () => {
    const guard = createRepetitionGuard();
    const neutral = MockBattle.stateFrom([MockPokemon.fresh(MockPokemon.base)]);
    const boosted = MockBattle.stateFrom([
      MockPokemon.fresh(MockPokemon.base, {
        statStages: { ...ZERO_STAT_STAGES, [StatName.Defense]: 2 },
      }),
    ]);

    guard.observe(neutral);
    expect(guard.observe(boosted)).toBe(0);
  });

  it("does not depend on Pokemon insertion order", () => {
    const guard = createRepetitionGuard();
    const alpha = MockPokemon.fresh(MockPokemon.base, { id: "alpha", position: { x: 1, y: 1 } });
    const beta = MockPokemon.fresh(MockPokemon.base, { id: "beta", position: { x: 3, y: 3 } });

    guard.observe(MockBattle.stateFrom([alpha, beta]));
    expect(guard.observe(MockBattle.stateFrom([beta, alpha]))).toBe(1);
  });

  it("counts for itself only", () => {
    const oneSide = createRepetitionGuard();
    const otherSide = createRepetitionGuard();
    const state = MockBattle.stateFrom([MockPokemon.fresh(MockPokemon.base)]);

    oneSide.observe(state);
    oneSide.observe(state);

    expect(otherSide.observe(state)).toBe(0);
  });
});
