import pokemonReference from "../reference/pokemon.json" with { type: "json" };
import type { ReferencePokemon } from "../src/loaders/reference-types";
import { rosterPoc } from "../src/roster/roster-poc";
import {
  getLegalAbilities,
  getLegalMoves,
  initializeLearnsetResolver,
} from "../src/team/learnset-resolver";

function toShowdownId(kebab: string): string {
  return kebab.replace(/-/g, "").toLowerCase();
}

interface Violation {
  pokemonId: string;
  kind:
    | "illegal-move"
    | "illegal-ability"
    | "missing-ability"
    | "missing-pokemon"
    | "empty-learnset";
  detail: string;
}

function audit(): Violation[] {
  initializeLearnsetResolver(pokemonReference as unknown as ReferencePokemon[]);
  const violations: Violation[] = [];
  const referenceIds = new Set(
    (pokemonReference as unknown as ReferencePokemon[]).map((p) => p.id),
  );

  for (const entry of rosterPoc) {
    if (entry.id === "dummy") {
      continue;
    }
    if (!referenceIds.has(entry.id)) {
      violations.push({
        pokemonId: entry.id,
        kind: "missing-pokemon",
        detail: `Pokemon "${entry.id}" not in reference/pokemon.json`,
      });
      continue;
    }

    const legalMoves = getLegalMoves(entry.id);
    if (legalMoves.size === 0) {
      violations.push({
        pokemonId: entry.id,
        kind: "empty-learnset",
        detail: "Reference learnset empty — moves skipped (data gap, fix via pnpm data:update)",
      });
    } else {
      for (const moveId of entry.movepool) {
        const compressed = toShowdownId(moveId);
        if (!legalMoves.has(compressed)) {
          violations.push({
            pokemonId: entry.id,
            kind: "illegal-move",
            detail: `"${moveId}" (compressed: "${compressed}") not in learnset`,
          });
        }
      }
    }

    const legalAbilities = getLegalAbilities(entry.id);
    if (entry.abilityId === undefined) {
      if (legalAbilities.length > 0) {
        violations.push({
          pokemonId: entry.id,
          kind: "missing-ability",
          detail: `No abilityId assigned (legal options: ${legalAbilities.join(", ")})`,
        });
      }
    } else if (!legalAbilities.includes(entry.abilityId)) {
      violations.push({
        pokemonId: entry.id,
        kind: "illegal-ability",
        detail: `"${entry.abilityId}" not in legal abilities (${legalAbilities.join(", ")})`,
      });
    }
  }

  return violations;
}

function main(): void {
  const violations = audit();
  if (violations.length === 0) {
    console.log("Audit passed: no violations found.");
    return;
  }

  const blocking = violations.filter((v) => v.kind !== "empty-learnset");
  const warnings = violations.filter((v) => v.kind === "empty-learnset");

  console.log(
    `Found ${violations.length} entry/entries (${blocking.length} blocking, ${warnings.length} warning):\n`,
  );
  const byPokemon = new Map<string, Violation[]>();
  for (const v of violations) {
    const list = byPokemon.get(v.pokemonId) ?? [];
    list.push(v);
    byPokemon.set(v.pokemonId, list);
  }
  for (const [pokemonId, list] of byPokemon) {
    console.log(`\n${pokemonId} (${list.length}):`);
    for (const v of list) {
      console.log(`  [${v.kind}] ${v.detail}`);
    }
  }
  if (blocking.length > 0) {
    process.exit(1);
  }
  console.log(
    "\nNo blocking violations. Empty-learnset warnings are data gaps (fix via pnpm data:update).",
  );
}

main();
