import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { Direction } from "../enums/direction";
import type { Action } from "../types/action";
import { createPrng } from "../utils/prng";
import { pickRandomAction } from "./random-ai";

describe("pickRandomAction", () => {
  const actions: Action[] = [
    { kind: ActionKind.EndTurn, pokemonId: "p1", direction: Direction.North },
    { kind: ActionKind.EndTurn, pokemonId: "p1", direction: Direction.South },
    { kind: ActionKind.EndTurn, pokemonId: "p1", direction: Direction.East },
  ];

  it("returns an action from the list", () => {
    const random = createPrng(42);
    const action = pickRandomAction(actions, random);
    expect(actions).toContain(action);
  });

  it("throws on empty list", () => {
    expect(() => pickRandomAction([], createPrng(1))).toThrow("No legal actions");
  });

  it("is deterministic with same seed", () => {
    const results1 = Array.from({ length: 10 }, () => pickRandomAction(actions, createPrng(42)));
    const results2 = Array.from({ length: 10 }, () => pickRandomAction(actions, createPrng(42)));
    expect(results1).toEqual(results2);
  });
});
