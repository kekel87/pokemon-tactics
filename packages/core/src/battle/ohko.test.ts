import { loadData } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { PokemonType } from "../enums/pokemon-type";
import type { MoveDefinition } from "../types/move-definition";
import { isOhkoMove, ohkoAccuracy } from "./ohko";

const moves = new Map(loadData().moves.map((move) => [move.id, move]));

function move(id: string): MoveDefinition {
  const definition = moves.get(id);
  if (!definition) {
    throw new Error(`missing move ${id}`);
  }
  return definition;
}

describe("ohkoAccuracy", () => {
  it("is a flat 30 for a standard OHKO move regardless of the user's types", () => {
    expect(ohkoAccuracy(move("guillotine"), [])).toBe(30);
    expect(ohkoAccuracy(move("fissure"), [PokemonType.Ground])).toBe(30);
  });

  it("is 30 for Glaciation when the user is Ice-type", () => {
    expect(ohkoAccuracy(move("sheer-cold"), [PokemonType.Ice])).toBe(30);
    expect(ohkoAccuracy(move("sheer-cold"), [PokemonType.Water, PokemonType.Ice])).toBe(30);
  });

  it("is 20 for Glaciation when the user is not Ice-type", () => {
    expect(ohkoAccuracy(move("sheer-cold"), [PokemonType.Water])).toBe(20);
    expect(ohkoAccuracy(move("sheer-cold"), [])).toBe(20);
  });
});

describe("isOhkoMove", () => {
  it("is true for the OHKO family", () => {
    expect(isOhkoMove(move("guillotine"))).toBe(true);
    expect(isOhkoMove(move("fissure"))).toBe(true);
    expect(isOhkoMove(move("horn-drill"))).toBe(true);
    expect(isOhkoMove(move("sheer-cold"))).toBe(true);
  });

  it("is false for a regular move", () => {
    expect(isOhkoMove(move("tackle"))).toBe(false);
  });
});
