import { describe, expect, it } from "vitest";
import { HeldItemId } from "../../enums/held-item-id";
import { Nature } from "../../enums/nature";
import { PokemonGender } from "../../enums/pokemon-gender";
import { importShowdownTeam, type ShowdownImportRegistry } from "../showdown-import";

const registry: ShowdownImportRegistry = {
  pokemonByShowdownId: new Map([
    ["charizard", "charizard"],
    ["snorlax", "snorlax"],
    ["mrmime", "mr-mime"],
  ]),
  abilityByShowdownId: new Map([
    ["blaze", "blaze"],
    ["thickfat", "thick-fat"],
    ["solarpower", "solar-power"],
  ]),
  itemByShowdownId: new Map<string, HeldItemId>([
    ["leftovers", HeldItemId.Leftovers],
    ["choiceband", HeldItemId.ChoiceBand],
  ]),
  moveByShowdownId: new Map([
    ["flamethrower", "flamethrower"],
    ["aerialace", "aerial-ace"],
    ["dragonclaw", "dragon-claw"],
    ["roost", "roost"],
    ["bodyslam", "body-slam"],
  ]),
  natureByName: new Map<string, Nature>([
    ["Timid", Nature.Timid],
    ["Adamant", Nature.Adamant],
    ["Careful", Nature.Careful],
  ]),
};

describe("importShowdownTeam — basic parsing", () => {
  it("parses a single full block", () => {
    const text = [
      "Charizard @ Leftovers",
      "Ability: Blaze",
      "Level: 50",
      "EVs: 4 HP / 252 SpA / 252 Spe",
      "Timid Nature",
      "- Flamethrower",
      "- Aerial Ace",
      "- Dragon Claw",
      "- Roost",
    ].join("\n");
    const { team, warnings } = importShowdownTeam(text, registry);
    expect(warnings).toEqual([]);
    expect(team).not.toBeNull();
    expect(team!.slots).toHaveLength(1);
    const slot = team!.slots[0]!;
    expect(slot.pokemonId).toBe("charizard");
    expect(slot.ability).toBe("blaze");
    expect(slot.heldItemId).toBe(HeldItemId.Leftovers);
    expect(slot.nature).toBe(Nature.Timid);
    expect(slot.moveIds).toEqual(["flamethrower", "aerial-ace", "dragon-claw", "roost"]);
    expect(slot.statSpread).toEqual({ spAttack: 31, speed: 31 });
  });

  it("parses multi-mon team with blank line separator", () => {
    const text = `Charizard @ Leftovers
Ability: Blaze
Timid Nature
- Flamethrower

Snorlax @ Choice Band
Ability: Thick Fat
Adamant Nature
- Body Slam`;
    const { team } = importShowdownTeam(text, registry);
    expect(team!.slots).toHaveLength(2);
    expect(team!.slots[1]!.pokemonId).toBe("snorlax");
  });
});

describe("nicknames and genders", () => {
  it("strips nickname keeping species", () => {
    const text = `Flame (Charizard) @ Leftovers
Ability: Blaze
Timid Nature
- Flamethrower`;
    const { team } = importShowdownTeam(text, registry);
    expect(team!.slots[0]!.pokemonId).toBe("charizard");
  });

  it("parses (M) gender", () => {
    const text = `Charizard (M) @ Leftovers
Ability: Blaze
Timid Nature
- Flamethrower`;
    const { team } = importShowdownTeam(text, registry);
    expect(team!.slots[0]!.gender).toBe(PokemonGender.Male);
  });

  it("parses (F) gender", () => {
    const text = `Charizard (F)
Ability: Blaze
Timid Nature
- Flamethrower`;
    const { team } = importShowdownTeam(text, registry);
    expect(team!.slots[0]!.gender).toBe(PokemonGender.Female);
  });

  it("parses nickname + gender", () => {
    const text = `Flame (Charizard) (M) @ Leftovers
Ability: Blaze
Timid Nature
- Flamethrower`;
    const { team } = importShowdownTeam(text, registry);
    expect(team!.slots[0]!.pokemonId).toBe("charizard");
    expect(team!.slots[0]!.gender).toBe(PokemonGender.Male);
  });
});

describe("ignored fields", () => {
  it("ignores IVs / Tera / Happiness / Shiny / Pokeball lines silently", () => {
    const text = `Charizard @ Leftovers
Ability: Blaze
Level: 50
Tera Type: Fire
Happiness: 255
Shiny: Yes
Pokeball: Premier Ball
IVs: 31 HP / 0 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe
Timid Nature
- Flamethrower`;
    const { warnings } = importShowdownTeam(text, registry);
    expect(warnings.filter((w) => w.kind === "unknown-line")).toEqual([]);
  });
});

describe("unknown content", () => {
  it("warns on unknown move", () => {
    const text = `Charizard @ Leftovers
Ability: Blaze
Timid Nature
- Hyper Beam`;
    const { warnings } = importShowdownTeam(text, registry);
    expect(warnings.some((w) => w.kind === "unknown-move")).toBe(true);
  });

  it("warns on unknown ability", () => {
    const text = `Charizard @ Leftovers
Ability: Unknown
Timid Nature
- Flamethrower`;
    const { warnings } = importShowdownTeam(text, registry);
    expect(warnings.some((w) => w.kind === "unknown-ability")).toBe(true);
  });

  it("returns null team on unknown species", () => {
    const text = `Missingno @ Leftovers
Ability: Blaze
Timid Nature
- Flamethrower`;
    const { team, warnings } = importShowdownTeam(text, registry);
    expect(team).toBeNull();
    expect(warnings.some((w) => w.kind === "unknown-pokemon")).toBe(true);
  });
});

describe("EV bounds", () => {
  it("warns on EV total > 510", () => {
    const text = `Charizard @ Leftovers
Ability: Blaze
EVs: 252 HP / 252 Atk / 252 SpA
Timid Nature
- Flamethrower`;
    const { warnings } = importShowdownTeam(text, registry);
    expect(warnings.some((w) => w.kind === "ev-total-exceeded")).toBe(true);
  });

  it("warns on EV stat > 252", () => {
    const text = `Charizard @ Leftovers
Ability: Blaze
EVs: 300 SpA
Timid Nature
- Flamethrower`;
    const { warnings } = importShowdownTeam(text, registry);
    expect(warnings.some((w) => w.kind === "ev-stat-exceeded")).toBe(true);
  });
});

describe("Mr-Mime case", () => {
  it("handles mr-mime via mrmime compressed id", () => {
    const text = `Mr. Mime @ Leftovers
Ability: Blaze
Timid Nature
- Flamethrower`;
    const { team } = importShowdownTeam(text, registry);
    expect(team!.slots[0]!.pokemonId).toBe("mr-mime");
  });
});
