import { describe, expect, it } from "vitest";
import { PlayerId } from "../enums/player-id";
import { MockPokemon } from "../testing/mock-pokemon";
import type { PokemonInstance } from "../types/pokemon-instance";
import { campBiasFactors, campFactorOf, campStrengths } from "./camp-bias";

/**
 * La pondération de cible en mêlée générale (plan 213, lot G).
 *
 * 🔴 Le test qui compte le plus est celui de la NEUTRALITÉ à deux camps : il protège 21 parties sur
 * 22 du trafic réel. Le biais ne doit rien changer là où il n'a rien à départager.
 */

/**
 * Un Pokemon dont seuls le camp et les PV comptent ici — bâti sur `MockPokemon`, jamais à la main
 * (`.claude/rules/core.md`). `maxHp` est forcé pour que les fractions attendues soient lisibles.
 */
let seq = 0;
function mon(playerId: PlayerId, currentHp: number, maxHp = 100): PokemonInstance {
  seq += 1;
  return MockPokemon.fresh(MockPokemon.bulbasaur, {
    id: `${playerId}-${seq}`,
    playerId,
    currentHp,
    maxHp,
  });
}

describe("campStrengths", () => {
  it("rend une fraction des PV du camp, pas un total brut", () => {
    const strengths = campStrengths([mon(PlayerId.Player1, 50), mon(PlayerId.Player1, 100)]);

    expect(strengths.get(PlayerId.Player1)).toBe(0.75);
  });

  it("🔴 ne fait pas mener six Pokemon blessés sur deux Pokemon intacts", () => {
    // C'est le cas qui condamne le décompte brut : en PV totaux, le camp de six l'emporte largement.
    const strengths = campStrengths([
      ...Array.from({ length: 6 }, () => mon(PlayerId.Player1, 20)),
      mon(PlayerId.Player2, 100),
      mon(PlayerId.Player2, 100),
    ]);

    expect(strengths.get(PlayerId.Player1)).toBeCloseTo(0.2);
    expect(strengths.get(PlayerId.Player2)).toBe(1);
  });

  it("compte un Pokemon tombé comme zéro, sans le faire disparaître du dénominateur", () => {
    const strengths = campStrengths([mon(PlayerId.Player1, 0), mon(PlayerId.Player1, 100)]);

    expect(strengths.get(PlayerId.Player1)).toBe(0.5);
  });
});

describe("campBiasFactors", () => {
  it("🔴 ne départage RIEN quand il n'y a qu'un seul camp adverse", () => {
    // La garde qui couvre TOUT format à deux camps — 1v1, mais aussi 2v6 et 4v4. Une carte vide fait
    // lire la neutralité partout, donc le score est identique à ce qu'il serait sans ce code.
    const factors = campBiasFactors(
      [mon(PlayerId.Player1, 100), mon(PlayerId.Player2, 10), mon(PlayerId.Player2, 100)],
      PlayerId.Player1,
    );

    expect(factors.size).toBe(0);
  });

  it("désigne le meneur et le traînard parmi trois camps", () => {
    const factors = campBiasFactors(
      [
        mon(PlayerId.Player1, 100),
        mon(PlayerId.Player2, 100),
        mon(PlayerId.Player3, 50),
        mon(PlayerId.Player4, 10),
      ],
      PlayerId.Player1,
    );

    expect(campFactorOf(factors, PlayerId.Player2)).toBe(1.2);
    expect(campFactorOf(factors, PlayerId.Player4)).toBe(0.9);
  });

  it("laisse les camps du milieu strictement neutres", () => {
    const factors = campBiasFactors(
      [
        mon(PlayerId.Player1, 100),
        mon(PlayerId.Player2, 100),
        mon(PlayerId.Player3, 50),
        mon(PlayerId.Player4, 10),
      ],
      PlayerId.Player1,
    );

    expect(campFactorOf(factors, PlayerId.Player3)).toBe(1);
  });

  it("🔴 ne désigne personne quand les camps sont à égalité", () => {
    // Début de partie, tout le monde intact. Sans ce garde, l'ordre d'itération de la `Map` élirait
    // un « meneur » au hasard — et pas le même d'une machine à l'autre.
    const factors = campBiasFactors(
      [mon(PlayerId.Player1, 100), mon(PlayerId.Player2, 100), mon(PlayerId.Player3, 100)],
      PlayerId.Player1,
    );

    expect(factors.size).toBe(0);
  });

  it("🔴 garde sa granularité à douze camps d'un seul Pokemon", () => {
    // Un décompte de vivants ne vaudrait que 0 ou 1 ici : aucun classement possible, précisément au
    // format où la question est la plus fine.
    const factors = campBiasFactors(
      [
        mon(PlayerId.Player1, 100),
        mon(PlayerId.Player2, 90),
        mon(PlayerId.Player3, 60),
        mon(PlayerId.Player4, 20),
      ],
      PlayerId.Player1,
    );

    expect(campFactorOf(factors, PlayerId.Player2)).toBe(1.2);
    expect(campFactorOf(factors, PlayerId.Player4)).toBe(0.9);
    expect(campFactorOf(factors, PlayerId.Player3)).toBe(1);
  });

  it("ignore un camp entièrement tombé", () => {
    // Il ne reste alors qu'un seul camp adverse debout : plus rien à départager.
    const factors = campBiasFactors(
      [mon(PlayerId.Player1, 100), mon(PlayerId.Player2, 40), mon(PlayerId.Player3, 0)],
      PlayerId.Player1,
    );

    expect(factors.size).toBe(0);
  });

  it("ne se prend jamais lui-même pour cible, même s'il mène", () => {
    const factors = campBiasFactors(
      [mon(PlayerId.Player1, 100), mon(PlayerId.Player2, 50), mon(PlayerId.Player3, 10)],
      PlayerId.Player1,
    );

    expect(factors.has(PlayerId.Player1)).toBe(false);
  });
});
