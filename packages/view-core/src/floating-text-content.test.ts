import { type BattleEvent, BattleEventType } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { type FloatingTextContext, floatingTextsFor } from "./floating-text-content.js";

const context: FloatingTextContext = {
  getPokemonName: (id) => id,
  getAbilityName: () => "Intimidate",
  getItemName: () => "Leftovers",
  getCurrentHp: () => 100,
  translate: (key) => key,
  getLanguage: () => "en",
};

function map(event: Partial<BattleEvent> & { type: BattleEvent["type"] }) {
  return floatingTextsFor(event as BattleEvent, context);
}

describe("floatingTextsFor", () => {
  it("shows a damage number plus a staggered effectiveness label", () => {
    const texts = map({
      type: BattleEventType.DamageDealt,
      targetId: "p2-x",
      amount: 25,
      effectiveness: 2,
    });
    expect(texts).toHaveLength(2);
    expect(texts[0]).toMatchObject({ pokemonId: "p2-x", text: "-25" });
    expect(texts[0]?.secondary).toBeUndefined();
    expect(texts[1]?.secondary).toBe(true);
    expect(texts[1]?.text.length).toBeGreaterThan(0);
  });

  it("shows a heal number for negative damage", () => {
    const texts = map({
      type: BattleEventType.DamageDealt,
      targetId: "p1-a",
      amount: -10,
      effectiveness: 1,
    });
    expect(texts).toEqual([expect.objectContaining({ pokemonId: "p1-a", text: "+10" })]);
  });

  it("shows immune (no number) when effectiveness is zero", () => {
    const texts = map({
      type: BattleEventType.DamageDealt,
      targetId: "p1-a",
      amount: 0,
      effectiveness: 0,
    });
    expect(texts).toHaveLength(1);
    expect(texts[0]?.text).not.toMatch(/\d/);
  });

  it("shows K.O. instead of a number on a lethal recoil hit", () => {
    const lethalContext: FloatingTextContext = { ...context, getCurrentHp: () => 0 };
    const texts = floatingTextsFor(
      {
        type: BattleEventType.DamageDealt,
        targetId: "p1-a",
        amount: 30,
        effectiveness: 1,
        recoil: true,
      } as BattleEvent,
      lethalContext,
    );
    expect(texts).toHaveLength(1);
    expect(texts[0]?.text).not.toMatch(/\d/);
  });

  it("shows the damage number for a non-lethal recoil hit", () => {
    const texts = map({
      type: BattleEventType.DamageDealt,
      targetId: "p1-a",
      amount: 30,
      effectiveness: 1,
      recoil: true,
    });
    expect(texts[0]?.text).toBe("-30");
  });

  it("shows nothing when the hit is absorbed by a substitute", () => {
    expect(
      map({
        type: BattleEventType.DamageDealt,
        targetId: "p1-a",
        amount: 8,
        effectiveness: 1,
        absorbedBySubstitute: 8,
      }),
    ).toEqual([]);
  });

  it("colours stat rises and drops differently", () => {
    const up = map({
      type: BattleEventType.StatChanged,
      targetId: "p1-a",
      stat: "attack",
      stages: 1,
    });
    const down = map({
      type: BattleEventType.StatChanged,
      targetId: "p1-a",
      stat: "attack",
      stages: -1,
    });
    expect(up[0]?.color).not.toBe(down[0]?.color);
  });

  it("maps single-label events (miss, confused, recharge)", () => {
    expect(map({ type: BattleEventType.MoveMissed, targetId: "p1-a" })).toHaveLength(1);
    expect(map({ type: BattleEventType.ConfusionTriggered, pokemonId: "p1-a" })).toHaveLength(1);
    expect(map({ type: BattleEventType.RechargeStarted, pokemonId: "p1-a" })).toHaveLength(1);
  });

  it("renders the resolved ability name with a bang", () => {
    const texts = map({
      type: BattleEventType.AbilityActivated,
      pokemonId: "p1-a",
      abilityId: "intimidate",
    });
    expect(texts[0]?.text).toBe("Intimidate!");
  });

  it("returns nothing for events without a float", () => {
    expect(map({ type: BattleEventType.TurnStarted, pokemonId: "p1-a" })).toEqual([]);
  });
});
