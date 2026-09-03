import type { PokemonInstance } from "@pokemon-tactic/core";
import { PlayerId } from "@pokemon-tactic/core";
import { MockBattle, MockPokemon } from "@pokemon-tactic/core/testing";
import { describe, expect, it } from "vitest";
import { buildOutcomeSummary } from "./battle-outcome-summary.js";

function member(overrides: Partial<PokemonInstance>): PokemonInstance {
  return { ...MockPokemon.base, ...overrides };
}

const winner = member({
  id: "p1-venusaur",
  definitionId: "venusaur",
  playerId: PlayerId.Player1,
  position: { x: 0, y: 0 },
});

const fallenAlly = member({
  id: "p1-blastoise",
  definitionId: "blastoise",
  playerId: PlayerId.Player1,
  currentHp: 0,
  position: { x: 1, y: 0 },
});

const loser = member({
  id: "p2-charizard",
  definitionId: "charizard",
  playerId: PlayerId.Player2,
  currentHp: 0,
  position: { x: 4, y: 4 },
});

describe("buildOutcomeSummary — récapitulatif de fin de partie (plan 197)", () => {
  it("ne retient que les membres du camp vainqueur", () => {
    const summary = buildOutcomeSummary({
      state: MockBattle.stateFrom([winner, loser]),
      winnerId: PlayerId.Player1,
      elapsedMs: 0,
    });

    expect(summary.winnerTeam).toEqual([{ definitionId: "venusaur", ko: false }]);
  });

  it("marque K.O. un membre à zéro PV", () => {
    const summary = buildOutcomeSummary({
      state: MockBattle.stateFrom([winner, fallenAlly]),
      winnerId: PlayerId.Player1,
      elapsedMs: 0,
    });

    expect(summary.winnerTeam).toEqual([
      { definitionId: "venusaur", ko: false },
      { definitionId: "blastoise", ko: true },
    ]);
  });

  it("rend une équipe vide sur un match nul", () => {
    const summary = buildOutcomeSummary({
      state: MockBattle.stateFrom([fallenAlly, loser]),
      winnerId: null,
      elapsedMs: 0,
    });

    expect(summary.winnerTeam).toEqual([]);
  });

  it("reporte l'horloge d'actions du moteur comme nombre de tours", () => {
    const state = MockBattle.stateFrom([winner, loser]);
    state.actionCounter = 14;

    const summary = buildOutcomeSummary({
      state,
      winnerId: PlayerId.Player1,
      elapsedMs: 0,
    });

    expect(summary.turns).toBe(14);
  });

  it("compte zéro tour quand l'horloge d'actions est absente de l'état", () => {
    const summary = buildOutcomeSummary({
      state: MockBattle.stateFrom([winner, loser]),
      winnerId: PlayerId.Player1,
      elapsedMs: 0,
    });

    expect(summary.turns).toBe(0);
  });

  it("reporte le temps de jeu cumulé comme durée", () => {
    const summary = buildOutcomeSummary({
      state: MockBattle.stateFrom([winner, loser]),
      winnerId: PlayerId.Player1,
      elapsedMs: 200_000,
    });

    expect(summary.durationMs).toBe(200_000);
  });

  it("plancher la durée à zéro quand le temps cumulé est négatif", () => {
    const summary = buildOutcomeSummary({
      state: MockBattle.stateFrom([winner, loser]),
      winnerId: PlayerId.Player1,
      elapsedMs: -5_000,
    });

    expect(summary.durationMs).toBe(0);
  });
});
