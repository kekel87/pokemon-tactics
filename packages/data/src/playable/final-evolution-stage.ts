import pokemonReference from "../../reference/pokemon.json" with { type: "json" };
import type { ReferencePokemon } from "../loaders/reference-types";
import { playablePokemon } from "./playable-pokemon";

const PLAYABLE_IDS: ReadonlySet<string> = new Set(playablePokemon.map((entry) => entry.id));

/**
 * Species some PLAYABLE species evolves from (plan 232). Restricted to the playable roster on
 * purpose: Nosferalto stays a final stage until Nostenfer becomes playable, then drops out on its
 * own — adding a generation needs no edit here. Not the same set as Évoluroc's holders
 * (`EVIOLITE_ELIGIBLE_SPECIES_IDS`), which follow the official rule over every species.
 */
const PLAYABLE_PRE_EVOLUTION_IDS: ReadonlySet<string> = new Set(
  (pokemonReference as unknown as readonly ReferencePokemon[]).flatMap((pokemon) =>
    PLAYABLE_IDS.has(pokemon.id) && pokemon.evolvesFrom !== null ? [pokemon.evolvesFrom] : [],
  ),
);

export function isFinalEvolutionStage(pokemonId: string): boolean {
  return !PLAYABLE_PRE_EVOLUTION_IDS.has(pokemonId);
}
