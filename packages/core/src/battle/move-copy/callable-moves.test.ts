import { describe, expect, it } from "vitest";
import { buildMoveRegistry } from "../../testing/build-move-registry";
import { isMetronomeCallable, isSleepTalkCallable } from "./callable-moves";

describe("callable-moves", () => {
  const registry = buildMoveRegistry();
  const move = (id: string) => {
    const found = registry.get(id);
    if (!found) {
      throw new Error(`missing move ${id}`);
    }
    return found;
  };

  it("allows a plain damaging move", () => {
    expect(isMetronomeCallable(move("tackle"))).toBe(true);
  });

  it("excludes the move-copy family (anti-recursion)", () => {
    expect(isMetronomeCallable(move("metronome"))).toBe(false);
    expect(isMetronomeCallable(move("sleep-talk"))).toBe(false);
    expect(isMetronomeCallable(move("mirror-move"))).toBe(false);
    expect(isMetronomeCallable(move("copycat"))).toBe(false);
  });

  it("excludes Force Nature (also a metamove)", () => {
    expect(isMetronomeCallable(move("nature-power"))).toBe(false);
  });

  it("excludes two-turn charge moves", () => {
    expect(isMetronomeCallable(move("sky-attack"))).toBe(false);
  });

  it("excludes Hit & Run moves", () => {
    expect(isMetronomeCallable(move("u-turn"))).toBe(false);
  });

  it("excludes sleep-gated and Last Resort moves", () => {
    expect(isMetronomeCallable(move("snore"))).toBe(false);
    expect(isMetronomeCallable(move("last-resort"))).toBe(false);
  });

  it("uses the same exclusions for Blabla Dodo", () => {
    expect(isSleepTalkCallable(move("tackle"))).toBe(true);
    expect(isSleepTalkCallable(move("snore"))).toBe(false);
    expect(isSleepTalkCallable(move("sleep-talk"))).toBe(false);
  });
});
