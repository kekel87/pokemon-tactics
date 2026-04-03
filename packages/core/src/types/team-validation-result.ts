import type { TeamValidationError } from "../enums/team-validation-error";

export interface TeamValidationResult {
  valid: boolean;
  errors: TeamValidationError[];
}
