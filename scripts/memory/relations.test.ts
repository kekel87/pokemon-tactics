import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VERBES_SUIVIS, verifierVerbe } from "./relations.mjs";

describe("verifierVerbe — vocabulaire fermé", () => {
  it("admet les verbes accentués tels qu'écrits", () => {
    expect(verifierVerbe("résout").ok).toBe(true);
    expect(verifierVerbe("succède-à").ok).toBe(true);
  });

  it("refuse une variante d'orthographe et liste les verbes admis", () => {
    const verdict = verifierVerbe("decoule-de");
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.message).toContain("découle-de");
  });

  it("refuse le lien vague qu'il remplace", () => {
    expect(verifierVerbe("lié-à").ok).toBe(false);
  });
});

describe("VERBES_SUIVIS — la ligne de voisins du hook", () => {
  it("ne suit jamais cite ni voir-aussi", () => {
    expect(VERBES_SUIVIS).not.toContain("cite");
    expect(VERBES_SUIVIS).not.toContain("voir-aussi");
  });

  it("est recopiée à l'identique, dans le même ordre, par le hook Python", () => {
    const hook = readFileSync(
      path.join(import.meta.dirname, "../../.claude/hooks/inject-memory-recall.py"),
      "utf8",
    );
    const tuple = VERBES_SUIVIS.map((verbe) => `"${verbe}"`).join(", ");
    expect(hook).toContain(`VERBES_SUIVIS = (${tuple})`);
  });
});
