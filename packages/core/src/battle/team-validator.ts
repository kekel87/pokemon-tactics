import { TeamValidationError } from "../enums/team-validation-error";
import type { TeamSelection } from "../types/team-selection";
import type { TeamValidationResult } from "../types/team-validation-result";

export function validateTeamSelection(
  selection: TeamSelection,
  allDefinitionIds: string[],
  maxTeamSize: number,
): TeamValidationResult {
  const errors: TeamValidationError[] = [];

  if (selection.pokemonDefinitionIds.length === 0) {
    errors.push(TeamValidationError.EmptyTeam);
  }

  if (selection.pokemonDefinitionIds.length > maxTeamSize) {
    errors.push(TeamValidationError.ExceedsMaxSize);
  }

  const seen = new Set<string>();
  let hasDuplicate = false;
  for (const id of selection.pokemonDefinitionIds) {
    if (seen.has(id)) {
      hasDuplicate = true;
    }
    seen.add(id);
  }
  if (hasDuplicate) {
    errors.push(TeamValidationError.DuplicatePokemon);
  }

  if (selection.pokemonDefinitionIds.some((id) => !allDefinitionIds.includes(id))) {
    errors.push(TeamValidationError.UnknownPokemon);
  }

  return { valid: errors.length === 0, errors };
}
