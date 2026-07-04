import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadData } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";

const MOVES_DIR = import.meta.dirname ?? ".";

/**
 * Test files in moves/ that cover cross-move mechanics rather than a single move ID.
 * Allowed to exist without a matching implemented move (orphan check only — NOT a
 * coverage exemption: every implemented move still requires its own test file).
 */
const CROSS_MOVE_MECHANIC_TESTS = new Set([
  "hit-and-run",
  "teleport-landing",
  "teleport-pattern",
  "ohko",
]);

function hasTestFile(moveId: string): boolean {
  return (
    existsSync(resolve(MOVES_DIR, `${moveId}.test.ts`)) ||
    existsSync(resolve(MOVES_DIR, `${moveId}.integration.test.ts`))
  );
}

describe("move test coverage", () => {
  it("every implemented move has a positional test file in moves/", () => {
    const moveIds = loadData().moves.map((move) => move.id);
    const missing = moveIds.filter((id) => !hasTestFile(id)).sort();

    expect(
      missing,
      `${missing.length} implemented move(s) without a moves/<id>.test.ts file. ` +
        "Each move must have an end-to-end positional test (see docs/methodology.md). " +
        `Missing:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("has no orphan move test file without a matching implemented move", () => {
    const implemented = new Set(loadData().moves.map((move) => move.id));
    const orphans = readdirSync(MOVES_DIR)
      .filter((file) => file.endsWith(".test.ts"))
      .map((file) => file.replace(/\.integration\.test\.ts$/, "").replace(/\.test\.ts$/, ""))
      .filter((id) => id !== "move-test-coverage")
      .filter((id) => !CROSS_MOVE_MECHANIC_TESTS.has(id))
      .filter((id) => !implemented.has(id))
      .sort();

    expect(
      orphans,
      `Orphan move test file(s) with no implemented move: ${orphans.join(", ")}`,
    ).toEqual([]);
  });
});
