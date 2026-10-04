import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AbilityEntry, ItemEntry } from "./build-reference";
import { ABILITY_DESCRIPTION_OVERRIDES, ITEM_DESCRIPTION_OVERRIDES } from "./description-overrides";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(SCRIPTS_DIR, "..");

describe("committed reference abilities.json — game-specific descriptions", () => {
  const abilities = JSON.parse(
    readFileSync(join(PACKAGE_ROOT, "reference/abilities.json"), "utf-8"),
  ) as AbilityEntry[];

  it("Cœur Soin (healer) uses the grid description in fr/en/es, short and long", () => {
    const healer = abilities.find((ability) => ability.id === "healer");
    const expected = ABILITY_DESCRIPTION_OVERRIDES.healer;
    expect(expected).toBeDefined();
    expect(healer?.shortDescription).toEqual(expected);
    expect(healer?.longDescription).toEqual(expected);
  });

  it("every override targets an ability present in the reference", () => {
    const knownIds = new Set(abilities.map((ability) => ability.id));
    expect(Object.keys(ABILITY_DESCRIPTION_OVERRIDES).filter((id) => !knownIds.has(id))).toEqual(
      [],
    );
  });
});

describe("committed reference items.json — game-specific descriptions", () => {
  const items = JSON.parse(
    readFileSync(join(PACKAGE_ROOT, "reference/items.json"), "utf-8"),
  ) as ItemEntry[];

  it("every override targets an item present in the reference and lands there, short and long", () => {
    for (const [id, expected] of Object.entries(ITEM_DESCRIPTION_OVERRIDES)) {
      const item = items.find((entry) => entry.id === id);
      expect(item, id).toBeDefined();
      expect(item?.shortDescription).toEqual(expected);
      expect(item?.longDescription).toEqual(expected);
    }
  });
});
