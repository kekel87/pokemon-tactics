import { SUBSTITUTE_SPRITE_ID } from "../constants";
import type { SandboxConfig } from "../types/SandboxConfig";
import type { TeamSelectResult } from "./TeamSelectScene";

export interface EngagedIdsInput {
  sandboxMode?: boolean;
  sandboxConfig?: SandboxConfig | null;
  teamSelectResult?: TeamSelectResult;
}

export function extractEngagedPokemonIds(data: EngagedIdsInput | undefined): string[] {
  if (!data) {
    return [];
  }
  const ids = new Set<string>();

  if (data.sandboxMode && data.sandboxConfig) {
    ids.add(data.sandboxConfig.pokemon);
    ids.add(data.sandboxConfig.dummyPokemon);
  }

  if (data.teamSelectResult) {
    for (const team of data.teamSelectResult.teams) {
      for (const definitionId of team.pokemonDefinitionIds) {
        ids.add(definitionId);
      }
    }
  }

  if (ids.size > 0) {
    ids.add(SUBSTITUTE_SPRITE_ID);
  }

  return Array.from(ids);
}
