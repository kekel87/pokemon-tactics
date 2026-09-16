import type { BattleState, PokemonInstance } from "@pokemon-tactic/core";
import { describe, expect, it, vi } from "vitest";
import { healthRatiosBySide, soleLocalSide, trackedSourcesOf } from "./team-telemetry";
import { TeamSource, type TelemetryTeam } from "./telemetry";

vi.mock("../i18n", () => ({ getLanguage: () => "fr", t: (key: string) => key }));

/**
 * Trois fonctions dont une inversion d'index ne casserait AUCUN test avant ce fichier, et
 * produirait des PV attribués au mauvais camp — donc une posture d'abandon inversée, « il
 * abandonnait en gagnant » au lieu de « en perdant ». C'est la conclusion OPPOSÉE à celle que le
 * lot F doit tirer. Manque relevé en revue de code du plan 212 (2026-09-16).
 */

function stateOf(pokemon: readonly Partial<PokemonInstance>[]): BattleState {
  return {
    pokemon: new Map(pokemon.map((entry, index) => [`p${index}`, entry as PokemonInstance])),
  } as BattleState;
}

describe("healthRatiosBySide", () => {
  it("🔴 rapporte `player-1` au camp 0", () => {
    // Le préfixe est 1-indexé, les camps de la télémétrie 0-indexés. Un `-1` perdu ici inverserait
    // silencieusement l'interprétation de tous les abandons.
    const ratios = healthRatiosBySide(
      stateOf([{ playerId: "player-1", currentHp: 50, maxHp: 100 }]),
    );

    expect(ratios).toEqual({ "0": 0.5 });
  });

  it("somme les PV de l'équipe entière, pas d'un Pokemon", () => {
    const ratios = healthRatiosBySide(
      stateOf([
        { playerId: "player-1", currentHp: 100, maxHp: 100 },
        { playerId: "player-1", currentHp: 0, maxHp: 100 },
        { playerId: "player-2", currentHp: 30, maxHp: 100 },
      ]),
    );

    // Les Pokemon K.O. RESTENT dans l'état : le dénominateur ne fond pas au fil des chutes, et le
    // ratio dit bien « ce qu'il reste de l'équipe » et non « de ceux qui tiennent encore debout ».
    expect(ratios).toEqual({ "0": 0.5, "1": 0.3 });
  });

  it("écarte un camp sans PV maximum plutôt que de rendre NaN", () => {
    const ratios = healthRatiosBySide(stateOf([{ playerId: "player-1", currentHp: 0, maxHp: 0 }]));

    expect(ratios).toEqual({});
  });

  it("ignore un identifiant de joueur qu'il ne sait pas lire", () => {
    // `PlayerId` est un type fermé, donc ce cas est inatteignable par le typage — mais la fonction
    // lit une CHAÎNE au motif `player-<n>`, et le repli doit rester sûr si la convention change.
    const ratios = healthRatiosBySide(
      stateOf([{ playerId: "dummy" as PokemonInstance["playerId"], currentHp: 10, maxHp: 10 }]),
    );

    expect(ratios).toEqual({});
  });
});

describe("soleLocalSide", () => {
  it("rend le camp quand cette machine n'en tient qu'un", () => {
    expect(soleLocalSide(["player-2"])).toBe(1);
  });

  it("🔴 rend null en hot-seat, où tous les camps sont locaux", () => {
    // Désigner un partant y serait une invention, et la posture d'abandon vaut mieux absente que
    // fausse — c'est elle qui doit désigner un correctif.
    expect(soleLocalSide(["player-1", "player-2"])).toBeNull();
  });

  it("rend null quand personne n'est local", () => {
    expect(soleLocalSide([])).toBeNull();
  });
});

describe("trackedSourcesOf", () => {
  const team = (side: number, source: TeamSource): TelemetryTeam => ({ side, source });

  it("suit les équipes humaines, bâties comme aléatoires", () => {
    const tracked = trackedSourcesOf([
      team(0, TeamSource.HumanBuilt),
      team(1, TeamSource.HumanRandom),
    ]);

    expect([...tracked.entries()]).toEqual([
      [0, "human-built"],
      [1, "human-random"],
    ]);
  });

  it("🔴 ne suit JAMAIS les camps de l'IA", () => {
    // Personne n'y décide rien, ni la composition ni les attaques : les compter fausserait les deux
    // blocs du rapport à la fois.
    const tracked = trackedSourcesOf([team(0, TeamSource.AiRandom), team(1, TeamSource.AiBuilt)]);

    expect(tracked.size).toBe(0);
  });
});
