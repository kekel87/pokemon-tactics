import { describe, expect, it } from "vitest";
import { MockPokemon } from "../testing";
import type { AbilityDefinition } from "../types/ability-definition";
import { AbilityHandlerRegistry } from "./ability-handler-registry";
import { resolveDefensiveAbility } from "./ability-suppression";

const breakableAbility: AbilityDefinition = {
  id: "levitate",
  breakable: true,
  name: { fr: "Lévitation", en: "Levitate" },
  shortDescription: { fr: "Lévitation", en: "Levitate" },
};
const reactiveAbility: AbilityDefinition = {
  id: "static",
  breakable: false,
  name: { fr: "Statik", en: "Static" },
  shortDescription: { fr: "Statik", en: "Static" },
};

const registry = new AbilityHandlerRegistry([breakableAbility, reactiveAbility]);

const levitator = MockPokemon.fresh(MockPokemon.base, { id: "target", abilityId: "levitate" });
const staticTarget = MockPokemon.fresh(MockPokemon.base, { id: "target", abilityId: "static" });
const moldBreaker = MockPokemon.fresh(MockPokemon.base, {
  id: "attacker",
  abilityId: "mold-breaker",
});
const plainAttacker = MockPokemon.fresh(MockPokemon.base, { id: "attacker", abilityId: "guts" });

describe("resolveDefensiveAbility", () => {
  it("returns undefined when a mold-breaker attacker faces a breakable ability", () => {
    expect(resolveDefensiveAbility(registry, levitator, moldBreaker)).toBeUndefined();
  });

  it("returns the ability when a mold-breaker attacker faces a non-breakable ability", () => {
    expect(resolveDefensiveAbility(registry, staticTarget, moldBreaker)?.id).toBe("static");
  });

  it("returns the breakable ability when the attacker lacks mold-breaker", () => {
    expect(resolveDefensiveAbility(registry, levitator, plainAttacker)?.id).toBe("levitate");
  });

  it("returns undefined when the registry is missing", () => {
    expect(resolveDefensiveAbility(undefined, levitator, moldBreaker)).toBeUndefined();
  });

  it("returns undefined when the target has no ability", () => {
    const abilityless = MockPokemon.fresh(MockPokemon.base, { id: "target", abilityId: undefined });
    expect(resolveDefensiveAbility(registry, abilityless, moldBreaker)).toBeUndefined();
  });
});
