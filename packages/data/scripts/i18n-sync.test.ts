import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildI18nMaps, type MoveEntry, type PokemonEntry } from "./build-reference";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(SCRIPTS_DIR, "..");

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(PACKAGE_ROOT, relativePath), "utf-8")) as T;
}

describe("i18n name maps", () => {
  const moves = readJson<MoveEntry[]>("reference/moves.json");
  const pokemon = readJson<PokemonEntry[]>("reference/pokemon.json");
  const generated = buildI18nMaps(moves, pokemon);

  const committed = {
    movesFr: readJson<Record<string, string>>("src/i18n/moves.fr.json"),
    movesEn: readJson<Record<string, string>>("src/i18n/moves.en.json"),
    pokemonNamesFr: readJson<Record<string, string>>("src/i18n/pokemon-names.fr.json"),
    pokemonNamesEn: readJson<Record<string, string>>("src/i18n/pokemon-names.en.json"),
  };

  it("committed src/i18n/*.json match what build-reference generates (run pnpm data:update after a data change)", () => {
    expect(committed.movesFr).toEqual(generated.movesFr);
    expect(committed.movesEn).toEqual(generated.movesEn);
    expect(committed.pokemonNamesFr).toEqual(generated.pokemonNamesFr);
    expect(committed.pokemonNamesEn).toEqual(generated.pokemonNamesEn);
  });

  it("keeps en↔fr parity for both moves and pokemon names", () => {
    expect(Object.keys(generated.movesFr).sort()).toEqual(Object.keys(generated.movesEn).sort());
    expect(Object.keys(generated.pokemonNamesFr).sort()).toEqual(
      Object.keys(generated.pokemonNamesEn).sort(),
    );
  });
});
