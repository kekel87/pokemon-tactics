import { type Action, ActionKind, Direction } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { canonicalActionKey, isLegalRemoteAction } from "./remote-action.js";

const endTurn: Action = {
  kind: ActionKind.EndTurn,
  pokemonId: "p1-venusaur",
  direction: Direction.North,
};

const walk: Action = {
  kind: ActionKind.Move,
  pokemonId: "p1-venusaur",
  path: [
    { x: 1, y: 1 },
    { x: 1, y: 2 },
  ],
};

const hitAndRun: Action = {
  kind: ActionKind.UseMove,
  pokemonId: "p2-crobat",
  moveId: "u-turn",
  targetPosition: { x: 3, y: 4 },
};

describe("canonicalActionKey", () => {
  it("distingue les quatre genres d'action", () => {
    const keys = new Set([
      canonicalActionKey(endTurn),
      canonicalActionKey(walk),
      canonicalActionKey(hitAndRun),
      canonicalActionKey({ kind: ActionKind.UndoMove, pokemonId: "p1-venusaur" }),
    ]);
    expect(keys.size).toBe(4);
  });

  it("ignore la case de retraite", () => {
    expect(canonicalActionKey({ ...hitAndRun, retreatPosition: { x: 9, y: 9 } })).toBe(
      canonicalActionKey(hitAndRun),
    );
  });

  it("distingue deux chemins qui finissent sur la même case", () => {
    const detour: Action = {
      kind: ActionKind.Move,
      pokemonId: "p1-venusaur",
      path: [
        { x: 2, y: 1 },
        { x: 1, y: 2 },
      ],
    };
    expect(canonicalActionKey(detour)).not.toBe(canonicalActionKey(walk));
  });

  it("distingue deux orientations de fin de tour", () => {
    expect(canonicalActionKey({ ...endTurn, direction: Direction.South })).not.toBe(
      canonicalActionKey(endTurn),
    );
  });

  it("distingue deux cases visées par la même attaque", () => {
    expect(canonicalActionKey({ ...hitAndRun, targetPosition: { x: 3, y: 5 } })).not.toBe(
      canonicalActionKey(hitAndRun),
    );
  });
});

describe("isLegalRemoteAction", () => {
  it("accepte une action présente dans la liste légale", () => {
    expect(isLegalRemoteAction([walk, endTurn], endTurn)).toBe(true);
  });

  it("refuse une action absente de la liste légale", () => {
    expect(isLegalRemoteAction([endTurn], walk)).toBe(false);
  });

  it("refuse tout quand la liste est vide", () => {
    expect(isLegalRemoteAction([], endTurn)).toBe(false);
  });

  it("accepte une attaque à retraite, dont la liste légale ne porte jamais la retraite", () => {
    expect(
      isLegalRemoteAction([hitAndRun], { ...hitAndRun, retreatPosition: { x: 5, y: 6 } }),
    ).toBe(true);
  });

  it("refuse une attaque à retraite dont la case visée n'est pas légale", () => {
    expect(
      isLegalRemoteAction([hitAndRun], {
        ...hitAndRun,
        targetPosition: { x: 7, y: 7 },
        retreatPosition: { x: 5, y: 6 },
      }),
    ).toBe(false);
  });

  it("refuse une action du bon genre mais du mauvais Pokemon", () => {
    expect(isLegalRemoteAction([endTurn], { ...endTurn, pokemonId: "p2-crobat" })).toBe(false);
  });
});
