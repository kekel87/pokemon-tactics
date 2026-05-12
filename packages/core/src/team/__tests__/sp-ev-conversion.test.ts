import { describe, expect, it } from "vitest";
import { EV_PER_STAT_MAX, EV_TOTAL_MAX, evToSp, spToEv } from "../sp-ev-conversion";

describe("spToEv", () => {
  it("converts SP to EV with 1:8 ratio", () => {
    expect(spToEv({ attack: 31, spAttack: 31, speed: 4 })).toEqual({
      attack: 248,
      spAttack: 248,
      speed: 14,
    });
  });

  it("clamps per-stat at 252 EV", () => {
    expect(spToEv({ hp: 50 })).toEqual({ hp: EV_PER_STAT_MAX });
  });

  it("clamps total at 510 EV with priority order HP/Atk/Def/SpA/SpD/Spe", () => {
    const result = spToEv({
      hp: 32,
      attack: 32,
      defense: 32,
      spAttack: 32,
      spDefense: 32,
      speed: 32,
    });
    const total = Object.values(result).reduce((s, v) => s + (v ?? 0), 0);
    expect(total).toBeLessThanOrEqual(EV_TOTAL_MAX);
    expect(result.hp).toBe(EV_PER_STAT_MAX);
    expect(result.attack).toBe(EV_PER_STAT_MAX);
    expect(result.defense ?? 0).toBeLessThan(EV_PER_STAT_MAX);
    expect(result.speed).toBeUndefined();
  });

  it("omits zero stats from output", () => {
    expect(spToEv({ attack: 10 })).toEqual({ attack: 80 });
    expect(spToEv({})).toEqual({});
  });
});

describe("evToSp", () => {
  it("converts EV to SP with floor(ev/8)", () => {
    expect(evToSp({ attack: 252, spAttack: 252, speed: 4 })).toEqual({
      attack: 31,
      spAttack: 31,
    });
  });

  it("clamps per-stat at 32 SP", () => {
    expect(evToSp({ hp: 500 })).toEqual({ hp: 32 });
  });

  it("clamps total at 66 SP with priority order", () => {
    const result = evToSp({
      hp: 252,
      attack: 252,
      defense: 252,
      spAttack: 252,
      spDefense: 252,
      speed: 252,
    });
    const total = Object.values(result).reduce((s, v) => s + (v ?? 0), 0);
    expect(total).toBeLessThanOrEqual(66);
    expect(result.hp).toBe(31);
    expect(result.attack).toBe(31);
  });

  it("omits zero stats", () => {
    expect(evToSp({})).toEqual({});
  });
});

describe("round-trip", () => {
  it("preserves typical Smogon spread approximately", () => {
    const original = { attack: 31, spAttack: 0, speed: 31 };
    const ev = spToEv(original);
    const back = evToSp(ev);
    expect(back.attack).toBe(31);
    expect(back.speed).toBe(31);
    expect(back.spAttack).toBeUndefined();
  });

  it("handles 508 EV Smogon spread (252/252/4) → SP → back", () => {
    const ev = { hp: 252, spAttack: 252, spDefense: 4 };
    const sp = evToSp(ev);
    expect(sp).toEqual({ hp: 31, spAttack: 31 });
    const reconverted = spToEv(sp);
    expect(reconverted.hp).toBe(248);
    expect(reconverted.spAttack).toBe(248);
  });
});
