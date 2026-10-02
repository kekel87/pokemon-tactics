import { describe, expect, it } from "vitest";
import {
  candidatsFusion,
  invalidesMalFormees,
  recopies,
  relationsHorsVocabulaire,
} from "./audit.mjs";

const LONGUE =
  "Section : le relais TURN débloque le jeu en ligne derrière un NAT symétrique, mesuré en 4G.";

describe("candidatsFusion", () => {
  it("rapproche deux morceaux d'une même entité découpée", () => {
    const paires = candidatsFusion(
      [
        { name: "statut-maj-couche-actions-logiques-p1", type: "historique" },
        { name: "statut-maj-couche-actions-logiques-p2", type: "historique" },
      ],
      new Map(),
    );
    expect(paires).toHaveLength(1);
  });

  it("ne compare pas deux types différents", () => {
    expect(
      candidatsFusion(
        [
          { name: "relais-turn-cloudflare-nat", type: "decision" },
          { name: "relais-turn-cloudflare-nat", type: "plan" },
        ],
        new Map(),
      ),
    ).toEqual([]);
  });

  it("ignore les noms réduits à un mot distinctif", () => {
    expect(
      candidatsFusion(
        [
          { name: "decision-280-bis", type: "decision" },
          { name: "decision-281-bis", type: "decision" },
        ],
        new Map(),
      ),
    ).toEqual([]);
  });

  it("ajoute 0,1 par voisin commun", () => {
    const entites = [
      { name: "maillage-pairs-mesure-p1", type: "backlog" },
      { name: "maillage-pairs-mesure-p2", type: "backlog" },
    ];
    const voisinage = new Map([
      ["maillage-pairs-mesure-p1", new Set(["plan-210"])],
      ["maillage-pairs-mesure-p2", new Set(["plan-210"])],
    ]);
    expect(candidatsFusion(entites, new Map())[0]?.score).toBeCloseTo(1);
    expect(candidatsFusion(entites, voisinage)[0]?.score).toBeCloseTo(1.1);
  });
});

describe("recopies", () => {
  it("trouve une longue observation recopiée, à la casse et aux accents près", () => {
    const r = recopies([
      { entity: "a", content: LONGUE },
      { entity: "b", content: LONGUE.toUpperCase() },
    ]);
    expect(r.map((x) => x.entites)).toEqual([["a", "b"]]);
  });

  it("laisse passer une formule courte partagée", () => {
    expect(
      recopies([
        { entity: "a", content: "Contexte : plan 119 jalon 1 (2026-06-08)" },
        { entity: "b", content: "Contexte : plan 119 jalon 1 (2026-06-08)" },
      ]),
    ).toEqual([]);
  });
});

describe("invalidesMalFormees", () => {
  it("accepte le format complet et signale les autres", () => {
    const r = invalidesMalFormees([
      { entity: "a", content: "INVALID 2026-10-02: remplacé par decision-1100 — ancien fait" },
      { entity: "b", content: "INVALID: faux" },
      { entity: "c", content: "un fait vivant" },
    ]);
    expect(r.map((o) => o.entity)).toEqual(["b"]);
  });
});

describe("relationsHorsVocabulaire", () => {
  it("garde seulement les verbes hors tableau", () => {
    expect(
      relationsHorsVocabulaire([
        { de: "a", verbe: "résout", vers: "b" },
        { de: "a", verbe: "lié-à", vers: "b" },
      ]),
    ).toEqual([{ de: "a", verbe: "lié-à", vers: "b" }]);
  });
});
