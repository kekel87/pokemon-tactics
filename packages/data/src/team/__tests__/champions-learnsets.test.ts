import { describe, expect, it } from "vitest";
import { buildTeamBuilderRegistry } from "../team-builder-registry";

describe("Champions learnsets (plan 223)", () => {
  const { validator } = buildTeamBuilderRegistry();

  it("Rafflesia learns Vampigraine, Synthèse and Vole-Force, and keeps Méga-Sangsue", () => {
    const legalMoves = validator.getLegalMoves("vileplume");
    expect(legalMoves.has("leech-seed")).toBe(true);
    expect(legalMoves.has("synthesis")).toBe(true);
    expect(legalMoves.has("strength-sap")).toBe(true);
    expect(legalMoves.has("mega-drain")).toBe(true);
  });

  it("Canarticho loses Picpic and learns Malédiction", () => {
    const legalMoves = validator.getLegalMoves("farfetch-d");
    expect(legalMoves.has("peck")).toBe(false);
    expect(legalMoves.has("curse")).toBe(true);
  });

  it("M. Mime loses Métronome and learns Hypnose", () => {
    const legalMoves = validator.getLegalMoves("mr-mime");
    expect(legalMoves.has("metronome")).toBe(false);
    expect(legalMoves.has("hypnosis")).toBe(true);
  });
});
