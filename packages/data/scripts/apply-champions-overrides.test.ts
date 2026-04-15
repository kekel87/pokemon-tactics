import { describe, expect, it } from "vitest";
import {
  type AbilityEntry,
  applyChampionsOverrides,
  type MoveEntry,
  type PokemonEntry,
} from "./build-reference";
import type { ChampionsOverride } from "./champions-override.types";

function makeMove(overrides: Partial<MoveEntry> = {}): MoveEntry {
  return {
    id: "thunderbolt",
    generation: 1,
    names: { en: "Thunderbolt", fr: "Tonnerre" },
    type: "electric",
    category: "special",
    power: 90,
    accuracy: 100,
    pp: 15,
    maxPp: 24,
    priority: 0,
    target: "normal",
    shortDescription: { en: "10% chance to paralyze.", fr: null },
    longDescription: { en: null, fr: null },
    secondary: null,
    drain: null,
    recoil: null,
    critRatio: 1,
    flags: {},
    ignoresAbility: false,
    isSignatureOf: null,
    ...overrides,
  };
}

function makeAbility(overrides: Partial<AbilityEntry> = {}): AbilityEntry {
  return {
    id: "blaze",
    generation: 3,
    names: { en: "Blaze", fr: "Brasier" },
    shortDescription: { en: "Fire boost at low HP.", fr: null },
    longDescription: { en: null, fr: null },
    flags: { breakable: false, ignorable: false, unsuppressable: false },
    ...overrides,
  } as AbilityEntry;
}

function emptyOverride(partial: Partial<ChampionsOverride> = {}): ChampionsOverride {
  return {
    version: "test",
    fetchedAt: "2026-04-15T00:00:00Z",
    source: "test",
    moves: {},
    pokemon: {},
    abilities: {},
    items: {},
    learnsets: {},
    status: {},
    ...partial,
  };
}

describe("applyChampionsOverrides", () => {
  it("applies pp override and recalculates maxPp", () => {
    const move = makeMove({ id: "baneful-bunker", pp: 10, maxPp: 16 });
    const override = emptyOverride({
      moves: { banefulbunker: { pp: 5 } },
    });

    const summary = applyChampionsOverrides([move], [], [], [], override);

    expect(summary.moves).toBe(1);
    expect(move.pp).toBe(5);
    expect(move.maxPp).toBe(8); // floor(5 * 1.6) = 8
  });

  it("applies basePower override to power field", () => {
    const move = makeMove({ id: "beak-blast", power: 100 });
    const override = emptyOverride({
      moves: { beakblast: { basePower: 120 } },
    });

    const summary = applyChampionsOverrides([move], [], [], [], override);

    expect(summary.moves).toBe(1);
    expect(move.power).toBe(120);
  });

  it("leaves moves unchanged when not in override", () => {
    const move = makeMove({ pp: 15, maxPp: 24, power: 90 });
    const override = emptyOverride({
      moves: { somethingelse: { pp: 5 } },
    });

    applyChampionsOverrides([move], [], [], [], override);

    expect(move.pp).toBe(15);
    expect(move.maxPp).toBe(24);
    expect(move.power).toBe(90);
  });

  it("collects unknown move IDs in skippedUnknownIds (no throw)", () => {
    const move = makeMove({ id: "thunderbolt" });
    const override = emptyOverride({
      moves: { fakemove: { pp: 10 }, thunderbolt: { pp: 16 } },
    });

    const summary = applyChampionsOverrides([move], [], [], [], override);

    expect(summary.moves).toBe(1);
    expect(move.pp).toBe(16);
    expect(summary.skippedUnknownIds).toEqual(["move:fakemove"]);
  });

  it("maps kebab-case IDs to Showdown lowercase-concat format", () => {
    const move = makeMove({ id: "aurora-beam", power: 65 });
    const override = emptyOverride({
      moves: { aurorabeam: { basePower: 80 } },
    });

    applyChampionsOverrides([move], [], [], [], override);

    expect(move.power).toBe(80);
  });

  it("applies ability description override", () => {
    const ability = makeAbility({ id: "blaze" });
    const override = emptyOverride({
      abilities: { blaze: { shortDesc: "Changed by Champions" } },
    });

    const summary = applyChampionsOverrides([], [ability], [], [], override);

    expect(summary.abilities).toBe(1);
    expect(ability.shortDescription.en).toBe("Changed by Champions");
  });

  it("removes secondary effect when override sets it to null", () => {
    const move = makeMove({
      id: "test-move",
      secondary: { chance: 30, status: "par", boosts: null, volatileStatus: null },
    });
    const override = emptyOverride({
      moves: { testmove: { secondary: null } },
    });

    applyChampionsOverrides([move], [], [], [], override);

    expect(move.secondary).toBeNull();
  });

  it("replaces secondary effect with override values", () => {
    const move = makeMove({ id: "ivy-cudgel", secondary: null });
    const override = emptyOverride({
      moves: {
        ivycudgel: {
          secondary: { chance: 20, volatileStatus: "flinch" },
        },
      },
    });

    applyChampionsOverrides([move], [], [], [], override);

    expect(move.secondary).toEqual({
      chance: 20,
      status: null,
      boosts: null,
      volatileStatus: "flinch",
    });
  });

  it("handles empty override (no-op)", () => {
    const move = makeMove({ pp: 15, power: 90 });
    const override = emptyOverride();

    const summary = applyChampionsOverrides([move], [], [], [], override);

    expect(summary.moves).toBe(0);
    expect(summary.skippedUnknownIds).toEqual([]);
    expect(move.pp).toBe(15);
    expect(move.power).toBe(90);
  });

  it("replaces learnset entirely on Pokemon match", () => {
    const pokemon: PokemonEntry = {
      id: "venusaur",
      dexNumber: 3,
      generation: 1,
      names: { en: "Venusaur", fr: "Florizarre" },
      genus: { en: null, fr: null },
      types: ["grass", "poison"],
      height: 2,
      weight: 100,
      color: "green",
      shape: null,
      habitat: null,
      genderRatio: { male: 87.5, female: 12.5 },
      catchRate: 45,
      baseFriendship: 50,
      baseExperience: 263,
      growthRate: "medium-slow",
      evYields: {},
      baseStats: { hp: 80, atk: 82, def: 83, spa: 100, spd: 100, spe: 80 },
      abilities: { ability1: "overgrow", ability2: null, hidden: "chlorophyll" },
      learnset: {
        levelUp: [{ level: 1, move: "old-move" }],
        tm: ["solar-beam"],
        tutor: [],
      },
      evolvesFrom: "ivysaur",
      evolutions: [],
      pokedexEntries: {},
      flags: { isLegendary: false, isMythical: false, isUltraBeast: false, isParadox: false },
      cry: null,
      forms: [],
    } as unknown as PokemonEntry;

    const override = emptyOverride({
      learnsets: {
        venusaur: {
          learnset: {
            earthquake: ["9M"],
            tackle: ["9L1"],
            "body-slam": ["9T"],
          },
        },
      },
    });

    const summary = applyChampionsOverrides([], [], [], [pokemon], override);

    expect(summary.learnsets).toBe(1);
    expect(pokemon.learnset.tm).toEqual(["earthquake"]);
    expect(pokemon.learnset.levelUp).toEqual([{ level: 1, move: "tackle" }]);
    expect(pokemon.learnset.tutor).toEqual(["body-slam"]);
  });
});
