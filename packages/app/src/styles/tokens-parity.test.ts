import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TEAM_COLORS } from "@pokemon-tactic/render-ports";
import { FONT_FAMILY } from "@pokemon-tactic/view-core";
import { describe, expect, it } from "vitest";

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "tokens.css");
const css = readFileSync(cssPath, "utf8");

function cssVar(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (match?.[1] === undefined) {
    throw new Error(`CSS variable --${name} not found in tokens.css`);
  }
  return match[1].trim();
}

function toCssHex(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

describe("design token parity (TS ↔ tokens.css)", () => {
  it("keeps --font-family in sync with view-core FONT_FAMILY", () => {
    expect(cssVar("font-family")).toBe(FONT_FAMILY);
  });

  it("keeps --team-N in sync with render-ports TEAM_COLORS", () => {
    TEAM_COLORS.forEach((color, index) => {
      expect(cssVar(`team-${index + 1}`)).toBe(toCssHex(color));
    });
  });
});
