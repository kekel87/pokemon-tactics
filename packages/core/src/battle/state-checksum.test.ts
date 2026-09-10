import { describe, expect, it } from "vitest";
import type { BattleState } from "../types/battle-state";
import {
  battleStateChecksum,
  CHECKSUM_FLOAT_DIGITS,
  canonicalize,
  checksumOf,
} from "./state-checksum";

describe("canonicalize", () => {
  it("ignores the key order objects were built in", () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });

  it("treats an undefined value and a missing key as the same state", () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe(canonicalize({ a: 1 }));
    expect(canonicalize({ typeOverride: undefined })).toBe(canonicalize({}));
  });

  it("still separates an explicit null from a missing key", () => {
    expect(canonicalize({ a: null })).not.toBe(canonicalize({}));
  });

  it("ignores the insertion order of a Map", () => {
    const built = new Map([
      ["p2", { hp: 2 }],
      ["p1", { hp: 1 }],
    ]);
    const replayed = new Map([
      ["p1", { hp: 1 }],
      ["p2", { hp: 2 }],
    ]);
    expect(canonicalize(built)).toBe(canonicalize(replayed));
  });

  it("keeps array order, because array order is semantic", () => {
    expect(canonicalize([{ id: "a" }, { id: "b" }])).not.toBe(
      canonicalize([{ id: "b" }, { id: "a" }]),
    );
  });

  it("normalises negative zero", () => {
    expect(canonicalize(-0)).toBe(canonicalize(0));
    expect(canonicalize({ height: -0 })).toBe(canonicalize({ height: 0 }));
  });

  it("quantises non-integers so a last-bit drift cannot register as a divergence", () => {
    const drifted = 0.1 + 0.2; // 0.30000000000000004
    expect(canonicalize(drifted)).toBe(canonicalize(0.3));
    expect(canonicalize(1 / 3)).toBe(canonicalize(Number((1 / 3).toFixed(CHECKSUM_FLOAT_DIGITS))));
  });

  it("still separates two heights a real map can hold", () => {
    expect(canonicalize({ height: 0.5 })).not.toBe(canonicalize({ height: 1 }));
  });

  it("never confuses a number with its own string", () => {
    expect(canonicalize(1)).not.toBe(canonicalize("1"));
    expect(canonicalize(true)).not.toBe(canonicalize("true"));
  });

  it("cannot let two neighbouring strings imitate a third", () => {
    expect(canonicalize(["ab", "c"])).not.toBe(canonicalize(["a", "bc"]));
  });

  it("throws on a non-finite number rather than hashing it", () => {
    expect(() => canonicalize({ hp: Number.NaN })).toThrow(/non fini/);
    expect(() => canonicalize({ hp: Number.POSITIVE_INFINITY })).toThrow(/non fini/);
  });

  it("throws on a shape nobody planned for, instead of hashing it silently", () => {
    expect(() => canonicalize(new Set([1]))).toThrow(/non sérialisable/);
    expect(() => canonicalize(new Date(0))).toThrow(/non sérialisable/);
    expect(() => canonicalize(() => 1)).toThrow(/non sérialisable/);
    expect(() => canonicalize(1n)).toThrow(/non sérialisable/);
  });
});

describe("checksumOf", () => {
  it("renders 16 hexadecimal characters", () => {
    expect(checksumOf("anything")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is stable across calls", () => {
    expect(checksumOf("same")).toBe(checksumOf("same"));
  });

  it("separates a one-character change", () => {
    expect(checksumOf("state-a")).not.toBe(checksumOf("state-b"));
  });

  it("separates two texts of the same characters in another order", () => {
    expect(checksumOf("ab")).not.toBe(checksumOf("ba"));
  });
});

describe("battleStateChecksum", () => {
  const state = (): BattleState =>
    ({
      grid: [[{ position: { x: 0, y: 0 }, height: 0.5, terrain: "grass", occupantId: null }]],
      pokemon: new Map([["p1", { id: "p1", currentHp: 30 }]]),
      activePokemonId: "p1",
      weather: "none",
      weatherTurnsRemaining: 0,
      auras: [],
      fieldTerrains: [],
      distortionZones: [],
      fieldGlobalZones: [],
      entryHazards: [],
      pendingStrikes: [],
      actionCounter: 3,
    }) as unknown as BattleState;

  it("gives the same digest for two states built the same way", () => {
    expect(battleStateChecksum(state())).toBe(battleStateChecksum(state()));
  });

  it("catches a single point of damage", () => {
    const diverged = state();
    diverged.pokemon.get("p1")!.currentHp = 29;
    expect(battleStateChecksum(diverged)).not.toBe(battleStateChecksum(state()));
  });

  it("catches a terrain that loaded differently", () => {
    const diverged = state();
    diverged.grid[0]![0]!.height = 1;
    expect(battleStateChecksum(diverged)).not.toBe(battleStateChecksum(state()));
  });

  it("catches an action clock that drifted", () => {
    const diverged = state();
    diverged.actionCounter = 4;
    expect(battleStateChecksum(diverged)).not.toBe(battleStateChecksum(state()));
  });
});
