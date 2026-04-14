import { describe, expect, it } from "vitest";
import { BattleEventType } from "../enums/battle-event-type";
import { MockPokemon } from "../testing";
import { applyImpactDamage } from "./apply-impact-damage";

const P1 = MockPokemon.base;

describe("applyImpactDamage", () => {
  it("returns no events when heightDiff ≤ 1", () => {
    const pokemon = MockPokemon.fresh(P1, { currentHp: 100, maxHp: 100 });
    expect(applyImpactDamage(pokemon, 1)).toHaveLength(0);
    expect(applyImpactDamage(pokemon, 0)).toHaveLength(0);
    expect(pokemon.currentHp).toBe(100);
  });

  it("returns WallImpactDealt with correct damage for heightDiff 2 (33%)", () => {
    const pokemon = MockPokemon.fresh(P1, { currentHp: 100, maxHp: 100 });

    const events = applyImpactDamage(pokemon, 2);

    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event?.type).toBe(BattleEventType.WallImpactDealt);
    if (event?.type === BattleEventType.WallImpactDealt) {
      expect(event.amount).toBe(33);
      expect(event.heightDiff).toBe(2);
      expect(event.pokemonId).toBe(pokemon.id);
    }
    expect(pokemon.currentHp).toBe(67);
  });

  it("returns WallImpactDealt with correct damage for heightDiff 3 (66%)", () => {
    const pokemon = MockPokemon.fresh(P1, { currentHp: 100, maxHp: 100 });

    const events = applyImpactDamage(pokemon, 3);

    const event = events[0];
    if (event?.type === BattleEventType.WallImpactDealt) {
      expect(event.amount).toBe(66);
    }
    expect(pokemon.currentHp).toBe(34);
  });

  it("emits PokemonKo when damage brings HP to 0", () => {
    const pokemon = MockPokemon.fresh(P1, { currentHp: 10, maxHp: 100 });

    const events = applyImpactDamage(pokemon, 4);

    expect(pokemon.currentHp).toBe(0);
    expect(events.some((e) => e.type === BattleEventType.PokemonKo)).toBe(true);
  });

  it("does not reduce HP below 0", () => {
    const pokemon = MockPokemon.fresh(P1, { currentHp: 5, maxHp: 100 });

    applyImpactDamage(pokemon, 3);

    expect(pokemon.currentHp).toBe(0);
  });

  it("WallImpactDealt precedes PokemonKo in returned events", () => {
    const pokemon = MockPokemon.fresh(P1, { currentHp: 1, maxHp: 100 });

    const events = applyImpactDamage(pokemon, 2);

    expect(events[0]?.type).toBe(BattleEventType.WallImpactDealt);
    expect(events[1]?.type).toBe(BattleEventType.PokemonKo);
  });
});
