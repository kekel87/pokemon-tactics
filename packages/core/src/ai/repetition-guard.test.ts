import { describe, expect, it } from "vitest";
import { StatName } from "../enums/stat-name";
import { MockBattle } from "../testing/mock-battle";
import { MockPokemon, ZERO_STAT_STAGES } from "../testing/mock-pokemon";
import { createRepetitionGuard } from "./repetition-guard";

describe("createRepetitionGuard", () => {
  it("rend 0 la première fois, puis compte les passages suivants", () => {
    const guard = createRepetitionGuard();
    const state = MockBattle.stateFrom([MockPokemon.fresh(MockPokemon.base)]);

    expect(guard.observe(state)).toBe(0);
    expect(guard.observe(state)).toBe(1);
    expect(guard.observe(state)).toBe(2);
  });

  it("distingue deux positions différentes", () => {
    const guard = createRepetitionGuard();
    const ici = MockBattle.stateFrom([
      MockPokemon.fresh(MockPokemon.base, { position: { x: 1, y: 1 } }),
    ]);
    const ailleurs = MockBattle.stateFrom([
      MockPokemon.fresh(MockPokemon.base, { position: { x: 2, y: 1 } }),
    ]);

    guard.observe(ici);
    expect(guard.observe(ailleurs)).toBe(0);
    expect(guard.observe(ici)).toBe(1);
  });

  it("voit un changement de PV", () => {
    const guard = createRepetitionGuard();
    const plein = MockBattle.stateFrom([MockPokemon.fresh(MockPokemon.base, { currentHp: 100 })]);
    const blesse = MockBattle.stateFrom([MockPokemon.fresh(MockPokemon.base, { currentHp: 40 })]);

    guard.observe(plein);
    expect(guard.observe(blesse)).toBe(0);
  });

  it("voit un changement de cran de stat", () => {
    const guard = createRepetitionGuard();
    const neutre = MockBattle.stateFrom([MockPokemon.fresh(MockPokemon.base)]);
    const boosted = MockBattle.stateFrom([
      MockPokemon.fresh(MockPokemon.base, {
        statStages: { ...ZERO_STAT_STAGES, [StatName.Defense]: 2 },
      }),
    ]);

    guard.observe(neutre);
    expect(guard.observe(boosted)).toBe(0);
  });

  it("🔴 ne dépend PAS de l'ordre d'insertion des Pokemon", () => {
    /*
     * Le multijoueur P2P rejoue l'IA à l'identique chez chaque pair. Deux pairs qui auraient inséré
     * les mêmes Pokemon dans un ordre différent doivent produire la MÊME signature : sinon le filet
     * dévie chez l'un et pas chez l'autre, et les deux parties cessent de concorder sans erreur — la
     * divergence la plus coûteuse à diagnostiquer du multijoueur.
     */
    const guard = createRepetitionGuard();
    const alpha = MockPokemon.fresh(MockPokemon.base, {
      id: "alpha",
      position: { x: 1, y: 1 },
    });
    const beta = MockPokemon.fresh(MockPokemon.base, {
      id: "beta",
      position: { x: 3, y: 3 },
    });

    guard.observe(MockBattle.stateFrom([alpha, beta]));
    expect(guard.observe(MockBattle.stateFrom([beta, alpha]))).toBe(1);
  });

  it("chaque filet compte pour lui seul", () => {
    const unCamp = createRepetitionGuard();
    const autreCamp = createRepetitionGuard();
    const state = MockBattle.stateFrom([MockPokemon.fresh(MockPokemon.base)]);

    unCamp.observe(state);
    unCamp.observe(state);

    expect(autreCamp.observe(state)).toBe(0);
  });
});
