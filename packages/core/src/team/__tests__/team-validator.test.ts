import { describe, expect, it } from "vitest";
import { HeldItemId } from "../../enums/held-item-id";
import { Nature } from "../../enums/nature";
import { PokemonGender } from "../../enums/pokemon-gender";
import type { TeamSet } from "../team-set";
import { TeamSetValidationErrorKind } from "../team-set-validation-error-kind";
import type { TeamSlot } from "../team-slot";
import { validateTeamSet } from "../team-validator";
import { GenderConstraint, type TeamValidatorRegistry } from "../team-validator-registry";

function buildRegistry(overrides?: Partial<TeamValidatorRegistry>): TeamValidatorRegistry {
  const learnsetByPokemon: Record<string, ReadonlySet<string>> = {
    charizard: new Set(["flamethrower", "aerialace", "dragonclaw", "roost", "fireblast"]),
    snorlax: new Set(["bodyslam", "rest", "crunch"]),
    pikachu: new Set(["thunderbolt", "quickattack"]),
    raichu: new Set(["thunderbolt", "quickattack"]),
    nidoking: new Set(["earthquake"]),
  };
  const abilitiesByPokemon: Record<string, readonly string[]> = {
    charizard: ["blaze", "solar-power"],
    snorlax: ["immunity", "thick-fat"],
    pikachu: ["static"],
    raichu: ["static", "lightning-rod"],
    nidoking: ["poison-point"],
  };
  const speciesRoot: Record<string, string> = {
    charizard: "charizard",
    snorlax: "snorlax",
    pikachu: "pikachu",
    raichu: "pikachu",
    nidoking: "nidoking",
  };
  const genderConstraint: Record<string, GenderConstraint> = {
    charizard: GenderConstraint.Any,
    snorlax: GenderConstraint.Any,
    pikachu: GenderConstraint.Any,
    raichu: GenderConstraint.Any,
    nidoking: GenderConstraint.MaleOnly,
  };
  return {
    pokemonIds: new Set(["charizard", "snorlax", "pikachu", "raichu", "nidoking"]),
    moveIds: new Set([
      "flamethrower",
      "aerial-ace",
      "dragon-claw",
      "roost",
      "fire-blast",
      "body-slam",
      "rest",
      "crunch",
      "thunderbolt",
      "quick-attack",
      "earthquake",
    ]),
    abilityIds: new Set([
      "blaze",
      "solar-power",
      "immunity",
      "thick-fat",
      "static",
      "lightning-rod",
      "poison-point",
    ]),
    itemIds: new Set([HeldItemId.Leftovers, HeldItemId.ChoiceBand, HeldItemId.LifeOrb]),
    getLegalAbilities: (id) => abilitiesByPokemon[id] ?? [],
    getLegalMoves: (id) => learnsetByPokemon[id] ?? new Set(),
    getSpeciesRoot: (id) => speciesRoot[id] ?? id,
    getGenderConstraint: (id) => genderConstraint[id] ?? GenderConstraint.Any,
    ...overrides,
  };
}

function buildSlot(overrides?: Partial<TeamSlot>): TeamSlot {
  return {
    pokemonId: "charizard",
    ability: "blaze",
    nature: Nature.Timid,
    moveIds: ["flamethrower", "aerial-ace", "dragon-claw", "roost"],
    statSpread: { spAttack: 31, speed: 31, hp: 4 },
    ...overrides,
  };
}

function buildTeam(slots: TeamSlot[], overrides?: Partial<TeamSet>): TeamSet {
  return {
    id: "test-team",
    name: "Test",
    slots,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("validateTeamSet — valid team", () => {
  it("accepts a clean single-mon team", () => {
    const result = validateTeamSet(buildTeam([buildSlot()]), {
      registry: buildRegistry(),
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe("EmptyTeam / TooManyMons", () => {
  it("reports EmptyTeam", () => {
    const result = validateTeamSet(buildTeam([]), {
      registry: buildRegistry(),
    });
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.EmptyTeam)).toBe(true);
  });

  it("reports TooManyMons", () => {
    const slots = Array.from({ length: 7 }, () =>
      buildSlot({ pokemonId: "snorlax", ability: "thick-fat", moveIds: ["body-slam"] }),
    );
    const result = validateTeamSet(buildTeam(slots), {
      registry: buildRegistry(),
    });
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.TooManyMons)).toBe(true);
  });
});

describe("DuplicatePokemon — species root", () => {
  it("blocks raichu + pikachu (same species root)", () => {
    const result = validateTeamSet(
      buildTeam([
        buildSlot({
          pokemonId: "raichu",
          ability: "static",
          moveIds: ["thunderbolt"],
          statSpread: {},
        }),
        buildSlot({
          pokemonId: "pikachu",
          ability: "static",
          moveIds: ["thunderbolt"],
          statSpread: {},
        }),
      ]),
      { registry: buildRegistry() },
    );
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.DuplicatePokemon)).toBe(
      true,
    );
  });
});

describe("DuplicateItem", () => {
  it("blocks 2 slots with same item", () => {
    const result = validateTeamSet(
      buildTeam([
        buildSlot({ heldItemId: HeldItemId.Leftovers }),
        buildSlot({
          pokemonId: "snorlax",
          ability: "thick-fat",
          moveIds: ["body-slam"],
          heldItemId: HeldItemId.Leftovers,
          statSpread: {},
        }),
      ]),
      { registry: buildRegistry() },
    );
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.DuplicateItem)).toBe(
      true,
    );
  });

  it("allows multiple slots without items", () => {
    const result = validateTeamSet(
      buildTeam([
        buildSlot(),
        buildSlot({
          pokemonId: "snorlax",
          ability: "thick-fat",
          moveIds: ["body-slam"],
          statSpread: {},
        }),
      ]),
      { registry: buildRegistry() },
    );
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.DuplicateItem)).toBe(
      false,
    );
  });
});

describe("IllegalAbility / UnknownAbility", () => {
  it("flags IllegalAbility when ability not in Pokemon's abilities", () => {
    const result = validateTeamSet(buildTeam([buildSlot({ ability: "intimidate" })]), {
      registry: buildRegistry({ abilityIds: new Set(["blaze", "intimidate"]) }),
    });
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.IllegalAbility)).toBe(
      true,
    );
  });

  it("flags UnknownAbility", () => {
    const result = validateTeamSet(buildTeam([buildSlot({ ability: "fake-ability" })]), {
      registry: buildRegistry(),
    });
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.UnknownAbility)).toBe(
      true,
    );
  });
});

describe("IllegalMove / DuplicateMove / UnknownMove / EmptyMoveList / TooManyMoves", () => {
  it("flags IllegalMove for move not in learnset", () => {
    const result = validateTeamSet(buildTeam([buildSlot({ moveIds: ["earthquake"] })]), {
      registry: buildRegistry(),
    });
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.IllegalMove)).toBe(true);
  });

  it("flags DuplicateMove", () => {
    const result = validateTeamSet(
      buildTeam([buildSlot({ moveIds: ["flamethrower", "flamethrower"] })]),
      { registry: buildRegistry() },
    );
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.DuplicateMove)).toBe(
      true,
    );
  });

  it("flags UnknownMove", () => {
    const result = validateTeamSet(buildTeam([buildSlot({ moveIds: ["fake-move"] })]), {
      registry: buildRegistry(),
    });
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.UnknownMove)).toBe(true);
  });

  it("flags EmptyMoveList", () => {
    const result = validateTeamSet(buildTeam([buildSlot({ moveIds: [] })]), {
      registry: buildRegistry(),
    });
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.EmptyMoveList)).toBe(
      true,
    );
  });

  it("flags TooManyMoves", () => {
    const result = validateTeamSet(
      buildTeam([
        buildSlot({
          moveIds: ["flamethrower", "aerial-ace", "dragon-claw", "roost", "fire-blast"],
        }),
      ]),
      { registry: buildRegistry() },
    );
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.TooManyMoves)).toBe(
      true,
    );
  });
});

describe("IllegalNature / UnknownPokemon / UnknownItem", () => {
  it("flags IllegalNature", () => {
    const result = validateTeamSet(buildTeam([buildSlot({ nature: "not-a-nature" as never })]), {
      registry: buildRegistry(),
    });
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.IllegalNature)).toBe(
      true,
    );
  });

  it("flags UnknownPokemon", () => {
    const result = validateTeamSet(buildTeam([buildSlot({ pokemonId: "missingno" })]), {
      registry: buildRegistry(),
    });
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.UnknownPokemon)).toBe(
      true,
    );
  });

  it("flags UnknownItem", () => {
    const result = validateTeamSet(buildTeam([buildSlot({ heldItemId: "fake-item" as never })]), {
      registry: buildRegistry(),
    });
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.UnknownItem)).toBe(true);
  });
});

describe("IllegalGender", () => {
  it("flags female on male-only Pokemon", () => {
    const result = validateTeamSet(
      buildTeam([
        buildSlot({
          pokemonId: "nidoking",
          ability: "poison-point",
          moveIds: ["earthquake"],
          statSpread: {},
          gender: PokemonGender.Female,
        }),
      ]),
      { registry: buildRegistry() },
    );
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.IllegalGender)).toBe(
      true,
    );
  });

  it("allows undefined gender on male-only Pokemon", () => {
    const result = validateTeamSet(
      buildTeam([
        buildSlot({
          pokemonId: "nidoking",
          ability: "poison-point",
          moveIds: ["earthquake"],
          statSpread: {},
        }),
      ]),
      { registry: buildRegistry() },
    );
    expect(result.errors.some((e) => e.kind === TeamSetValidationErrorKind.IllegalGender)).toBe(
      false,
    );
  });
});

describe("InvalidStatSpread", () => {
  it("flags total > 66 SP", () => {
    const result = validateTeamSet(
      buildTeam([buildSlot({ statSpread: { hp: 32, attack: 32, defense: 32 } })]),
      { registry: buildRegistry() },
    );
    expect(
      result.errors.some(
        (e) =>
          e.kind === TeamSetValidationErrorKind.InvalidStatSpread &&
          e.context?.reason === "totalExceeded",
      ),
    ).toBe(true);
  });

  it("flags single stat > 32 SP", () => {
    const result = validateTeamSet(buildTeam([buildSlot({ statSpread: { hp: 33 } })]), {
      registry: buildRegistry(),
    });
    expect(
      result.errors.some(
        (e) =>
          e.kind === TeamSetValidationErrorKind.InvalidStatSpread &&
          e.context?.reason === "statExceeded",
      ),
    ).toBe(true);
  });
});
