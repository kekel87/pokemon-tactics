import { validateStatSpread } from "../battle/stat-spread-validator";
import { Nature } from "../enums/nature";
import { toShowdownId } from "./showdown-id";
import type { TeamSet } from "./team-set";
import type { TeamSetValidationError } from "./team-set-validation-error";
import { TeamSetValidationErrorKind } from "./team-set-validation-error-kind";
import type { TeamSetValidationResult } from "./team-set-validation-result";
import type { TeamSlot } from "./team-slot";
import { isGenderAllowed, type TeamValidatorRegistry } from "./team-validator-registry";

export interface ValidateTeamSetOptions {
  registry: TeamValidatorRegistry;
  maxSlots?: number;
  minSlots?: number;
}

const DEFAULT_MAX_SLOTS = 6;
const DEFAULT_MIN_SLOTS = 1;
const MAX_MOVES_PER_SLOT = 4;

const ALL_NATURES: ReadonlySet<string> = new Set(Object.values(Nature));

export function validateTeamSet(
  team: TeamSet,
  options: ValidateTeamSetOptions,
): TeamSetValidationResult {
  const errors: TeamSetValidationError[] = [];
  const maxSlots = options.maxSlots ?? DEFAULT_MAX_SLOTS;
  const minSlots = options.minSlots ?? DEFAULT_MIN_SLOTS;

  if (team.slots.length < minSlots) {
    errors.push({
      kind: TeamSetValidationErrorKind.EmptyTeam,
      message: "team.error.emptyTeam",
      context: { min: String(minSlots), actual: String(team.slots.length) },
    });
  }
  if (team.slots.length > maxSlots) {
    errors.push({
      kind: TeamSetValidationErrorKind.TooManyMons,
      message: "team.error.tooManyMons",
      context: { max: String(maxSlots), actual: String(team.slots.length) },
    });
  }

  const seenRoots = new Map<string, number>();
  const seenItems = new Map<string, number>();
  for (const [slotIndex, slot] of team.slots.entries()) {
    errors.push(...validateSlot(slot, slotIndex, options.registry));

    if (options.registry.pokemonIds.has(slot.pokemonId)) {
      const root = options.registry.getSpeciesRoot(slot.pokemonId);
      const previousIndex = seenRoots.get(root);
      if (previousIndex === undefined) {
        seenRoots.set(root, slotIndex);
      } else {
        errors.push({
          kind: TeamSetValidationErrorKind.DuplicatePokemon,
          slotIndex,
          message: "team.error.duplicatePokemon",
          context: { speciesRoot: root, conflictsWithSlot: String(previousIndex) },
        });
      }
    }

    if (slot.heldItemId !== undefined) {
      const previousIndex = seenItems.get(slot.heldItemId);
      if (previousIndex === undefined) {
        seenItems.set(slot.heldItemId, slotIndex);
      } else {
        errors.push({
          kind: TeamSetValidationErrorKind.DuplicateItem,
          slotIndex,
          message: "team.error.duplicateItem",
          context: { itemId: slot.heldItemId, conflictsWithSlot: String(previousIndex) },
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateSlot(
  slot: TeamSlot,
  slotIndex: number,
  registry: TeamValidatorRegistry,
): TeamSetValidationError[] {
  const errors: TeamSetValidationError[] = [];

  if (!registry.pokemonIds.has(slot.pokemonId)) {
    errors.push({
      kind: TeamSetValidationErrorKind.UnknownPokemon,
      slotIndex,
      message: "team.error.unknownPokemon",
      context: { pokemonId: slot.pokemonId },
    });
    return errors;
  }

  if (registry.abilityIds.has(slot.ability)) {
    const legalAbilities = registry.getLegalAbilities(slot.pokemonId);
    if (!legalAbilities.includes(slot.ability)) {
      errors.push({
        kind: TeamSetValidationErrorKind.IllegalAbility,
        slotIndex,
        message: "team.error.illegalAbility",
        context: {
          abilityId: slot.ability,
          pokemonId: slot.pokemonId,
          legalOptions: legalAbilities.join(", "),
        },
      });
    }
  } else {
    errors.push({
      kind: TeamSetValidationErrorKind.UnknownAbility,
      slotIndex,
      message: "team.error.unknownAbility",
      context: { abilityId: slot.ability },
    });
  }

  if (slot.heldItemId !== undefined && !registry.itemIds.has(slot.heldItemId)) {
    errors.push({
      kind: TeamSetValidationErrorKind.UnknownItem,
      slotIndex,
      message: "team.error.unknownItem",
      context: { itemId: slot.heldItemId },
    });
  }

  if (!ALL_NATURES.has(slot.nature)) {
    errors.push({
      kind: TeamSetValidationErrorKind.IllegalNature,
      slotIndex,
      message: "team.error.illegalNature",
      context: { nature: slot.nature },
    });
  }

  const genderConstraint = registry.getGenderConstraint(slot.pokemonId);
  if (!isGenderAllowed(slot.gender, genderConstraint)) {
    errors.push({
      kind: TeamSetValidationErrorKind.IllegalGender,
      slotIndex,
      message: "team.error.illegalGender",
      context: {
        gender: slot.gender ?? "undefined",
        constraint: genderConstraint,
      },
    });
  }

  const spreadValidation = validateStatSpread(slot.statSpread);
  if (!spreadValidation.valid) {
    let total = 0;
    let overStat: string | undefined;
    for (const [key, value] of Object.entries(slot.statSpread)) {
      const v = value ?? 0;
      total += v;
      if (v > 32 && overStat === undefined) {
        overStat = key;
      }
    }
    if (overStat !== undefined) {
      errors.push({
        kind: TeamSetValidationErrorKind.InvalidStatSpread,
        slotIndex,
        message: "team.error.invalidStatSpread",
        context: { reason: "statExceeded", stat: overStat, max: "32" },
      });
    }
    if (total > 66) {
      errors.push({
        kind: TeamSetValidationErrorKind.InvalidStatSpread,
        slotIndex,
        message: "team.error.invalidStatSpread",
        context: { reason: "totalExceeded", total: String(total), max: "66" },
      });
    }
  }

  if (slot.moveIds.length === 0) {
    errors.push({
      kind: TeamSetValidationErrorKind.EmptyMoveList,
      slotIndex,
      message: "team.error.emptyMoveList",
    });
  } else if (slot.moveIds.length > MAX_MOVES_PER_SLOT) {
    errors.push({
      kind: TeamSetValidationErrorKind.TooManyMoves,
      slotIndex,
      message: "team.error.tooManyMoves",
      context: { max: String(MAX_MOVES_PER_SLOT), actual: String(slot.moveIds.length) },
    });
  }

  const seenMoves = new Set<string>();
  const legalMoves = registry.getLegalMoves(slot.pokemonId);
  for (const moveId of slot.moveIds) {
    if (seenMoves.has(moveId)) {
      errors.push({
        kind: TeamSetValidationErrorKind.DuplicateMove,
        slotIndex,
        message: "team.error.duplicateMove",
        context: { moveId },
      });
      continue;
    }
    seenMoves.add(moveId);

    if (!registry.moveIds.has(moveId)) {
      errors.push({
        kind: TeamSetValidationErrorKind.UnknownMove,
        slotIndex,
        message: "team.error.unknownMove",
        context: { moveId },
      });
      continue;
    }

    if (legalMoves.size > 0) {
      const compressed = toShowdownId(moveId);
      if (!legalMoves.has(compressed)) {
        errors.push({
          kind: TeamSetValidationErrorKind.IllegalMove,
          slotIndex,
          message: "team.error.illegalMove",
          context: { moveId, pokemonId: slot.pokemonId },
        });
      }
    }
  }

  return errors;
}
