import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tacticalOverrides } from "../src/overrides/tactical";
import { type MoveEntry, parseShowdownMoveTexts } from "./build-reference";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(SCRIPTS_DIR, "..");

const SHOWDOWN_MOVE_TEXTS_FIXTURE = [
  "export const MovesText: { [id: IDEntry]: MoveText } = {",
  '\t"10000000voltthunderbolt": {',
  '\t\tname: "10,000,000 Volt Thunderbolt",',
  '\t\tdesc: "Has a very high chance for a critical hit.",',
  '\t\tshortDesc: "Very high critical hit ratio.",',
  "\t},",
  "\tabsorb: {",
  '\t\tname: "Absorb",',
  '\t\tdesc: "The user recovers 1/2 the HP lost by the target.",',
  '\t\tshortDesc: "User recovers 50% of the damage dealt.",',
  "\t\tgen4: {",
  '\t\t\tdesc: "Old generation text that must be ignored.",',
  "\t\t},",
  "\t},",
  "\tcurse: {",
  '\t\tname: "Curse",',
  '\t\tshortDesc: "Curses if Ghost, else \\"+1 Atk, +1 Def, -1 Spe\\".",',
  "\t},",
  "};",
].join("\n");

describe("parseShowdownMoveTexts", () => {
  const texts = parseShowdownMoveTexts(SHOWDOWN_MOVE_TEXTS_FIXTURE);

  it("reads a move whose key is quoted", () => {
    expect(texts.get("10000000voltthunderbolt")).toEqual({
      desc: "Has a very high chance for a critical hit.",
      shortDesc: "Very high critical hit ratio.",
    });
  });

  it("keeps the top-level desc of an unquoted key and ignores the nested generation block", () => {
    expect(texts.get("absorb")).toEqual({
      desc: "The user recovers 1/2 the HP lost by the target.",
      shortDesc: "User recovers 50% of the damage dealt.",
    });
  });

  it("unescapes quotes inside a description", () => {
    expect(texts.get("curse")).toEqual({
      shortDesc: 'Curses if Ghost, else "+1 Atk, +1 Def, -1 Spe".',
    });
  });

  it("returns only the moves present in the source", () => {
    expect([...texts.keys()].sort()).toEqual(["10000000voltthunderbolt", "absorb", "curse"]);
  });
});

describe("committed reference moves.json — English descriptions", () => {
  const moves = JSON.parse(
    readFileSync(join(PACKAGE_ROOT, "reference/moves.json"), "utf-8"),
  ) as MoveEntry[];
  const moveById = new Map(moves.map((move) => [move.id, move]));
  const implementedMoveIds = Object.keys(tacticalOverrides);

  it("has an entry for every implemented move", () => {
    expect(implementedMoveIds.filter((id) => !moveById.has(id))).toEqual([]);
  });

  it.each(["shortDescription", "longDescription"] as const)(
    "has a non-empty English %s for every implemented move",
    (field) => {
      const blank = implementedMoveIds.filter(
        (id) => (moveById.get(id)?.[field].en ?? "").trim() === "",
      );
      expect(blank).toEqual([]);
    },
  );
});
