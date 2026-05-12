import { describe, expect, it } from "vitest";
import { HeldItemId } from "../../enums/held-item-id";
import { Nature } from "../../enums/nature";
import { PokemonGender } from "../../enums/pokemon-gender";
import type { ShowdownExportRegistry } from "../showdown-export";
import { exportTeamToShowdown } from "../showdown-export";
import type { TeamSet } from "../team-set";

const registry: ShowdownExportRegistry = {
  getPokemonName: (id) => ({ charizard: "Charizard", snorlax: "Snorlax" })[id] ?? id,
  getAbilityName: (id) => ({ blaze: "Blaze", "thick-fat": "Thick Fat" })[id] ?? id,
  getItemName: (id) =>
    ({ [HeldItemId.Leftovers]: "Leftovers", [HeldItemId.ChoiceBand]: "Choice Band" })[id] ?? id,
  getMoveName: (id) =>
    ({
      flamethrower: "Flamethrower",
      "aerial-ace": "Aerial Ace",
      "dragon-claw": "Dragon Claw",
      roost: "Roost",
      "body-slam": "Body Slam",
      rest: "Rest",
    })[id] ?? id,
};

function buildTeam(overrides?: Partial<TeamSet>): TeamSet {
  return {
    id: "t",
    name: "Test",
    createdAt: 0,
    updatedAt: 0,
    slots: [
      {
        pokemonId: "charizard",
        ability: "blaze",
        nature: Nature.Timid,
        moveIds: ["flamethrower", "aerial-ace", "dragon-claw", "roost"],
        statSpread: { spAttack: 31, speed: 31, hp: 4 },
        heldItemId: HeldItemId.Leftovers,
      },
    ],
    ...overrides,
  };
}

describe("exportTeamToShowdown", () => {
  it("produces a full block for a single mon", () => {
    const out = exportTeamToShowdown(buildTeam(), registry);
    expect(out).toBe(
      [
        "Charizard @ Leftovers",
        "Ability: Blaze",
        "Level: 50",
        "EVs: 32 HP / 248 SpA / 230 Spe",
        "Timid Nature",
        "- Flamethrower",
        "- Aerial Ace",
        "- Dragon Claw",
        "- Roost",
      ].join("\n"),
    );
  });

  it("omits item when undefined", () => {
    const out = exportTeamToShowdown(
      buildTeam({
        slots: [
          {
            pokemonId: "charizard",
            ability: "blaze",
            nature: Nature.Timid,
            moveIds: ["flamethrower"],
            statSpread: {},
          },
        ],
      }),
      registry,
    );
    expect(out).toContain("Charizard\n");
    expect(out).not.toContain("@");
  });

  it("omits EVs line when all zero", () => {
    const out = exportTeamToShowdown(
      buildTeam({
        slots: [
          {
            pokemonId: "charizard",
            ability: "blaze",
            nature: Nature.Timid,
            moveIds: ["flamethrower"],
            statSpread: {},
          },
        ],
      }),
      registry,
    );
    expect(out).not.toContain("EVs:");
  });

  it("never exports IVs", () => {
    const out = exportTeamToShowdown(buildTeam(), registry);
    expect(out).not.toContain("IVs:");
  });

  it("adds (M) for male", () => {
    const out = exportTeamToShowdown(
      buildTeam({
        slots: [
          {
            pokemonId: "charizard",
            ability: "blaze",
            nature: Nature.Timid,
            moveIds: ["flamethrower"],
            statSpread: {},
            gender: PokemonGender.Male,
          },
        ],
      }),
      registry,
    );
    expect(out).toContain("Charizard (M)");
  });

  it("adds (F) for female", () => {
    const out = exportTeamToShowdown(
      buildTeam({
        slots: [
          {
            pokemonId: "charizard",
            ability: "blaze",
            nature: Nature.Timid,
            moveIds: ["flamethrower"],
            statSpread: {},
            gender: PokemonGender.Female,
          },
        ],
      }),
      registry,
    );
    expect(out).toContain("Charizard (F)");
  });

  it("omits gender for genderless", () => {
    const out = exportTeamToShowdown(
      buildTeam({
        slots: [
          {
            pokemonId: "charizard",
            ability: "blaze",
            nature: Nature.Timid,
            moveIds: ["flamethrower"],
            statSpread: {},
            gender: PokemonGender.Genderless,
          },
        ],
      }),
      registry,
    );
    expect(out).not.toContain("(M)");
    expect(out).not.toContain("(F)");
  });

  it("separates multiple mons with blank line", () => {
    const out = exportTeamToShowdown(
      buildTeam({
        slots: [
          {
            pokemonId: "charizard",
            ability: "blaze",
            nature: Nature.Timid,
            moveIds: ["flamethrower"],
            statSpread: {},
          },
          {
            pokemonId: "snorlax",
            ability: "thick-fat",
            nature: Nature.Careful,
            moveIds: ["body-slam", "rest"],
            statSpread: {},
          },
        ],
      }),
      registry,
    );
    expect(out).toContain("\n\nSnorlax");
  });
});
