import { describe, expect, it } from "vitest";
import { PokemonType } from "../enums/pokemon-type";
import { MockPokemon } from "../testing";
import type { TypeChart } from "../types/type-chart";
import { computeStrikeDamage, freezeOffense } from "./future-sight-system";

const neutralChart = {
  [PokemonType.Psychic]: { [PokemonType.Normal]: 1 },
} as unknown as TypeChart;

const caster = (level: number) => MockPokemon.fresh(MockPokemon.base, { id: "caster", level });

const strike = (level: number) =>
  freezeOffense({
    attacker: caster(level),
    attackerTypes: [PokemonType.Normal],
    moveType: PokemonType.Psychic,
    power: 120,
  });

describe("Prescience — le niveau du lanceur est gelé au lancement", () => {
  it("gèle le niveau du lanceur, pas une constante", () => {
    expect(strike(30).level).toBe(30);
    expect(strike(50).level).toBe(50);
  });

  it("frappe moins fort quand le lanceur est de niveau inférieur, à statistiques égales", () => {
    const defender = MockPokemon.fresh(MockPokemon.base, { id: "cible" });
    const damageAt = (level: number) =>
      computeStrikeDamage(strike(level), defender, [PokemonType.Normal], neutralChart, 1.0);

    expect(damageAt(30)).toBeLessThan(damageAt(50));
    expect(damageAt(100)).toBeGreaterThan(damageAt(50));
  });
});
