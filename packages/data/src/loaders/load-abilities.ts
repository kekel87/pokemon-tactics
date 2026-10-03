import type { AbilityDefinition, AbilityHandler } from "@pokemon-tactic/core";
import { completeLocalizedText } from "../i18n/localized-text";
import type { ReferenceAbility } from "./reference-types";

export function loadAbilitiesFromReference(
  referenceData: ReferenceAbility[],
  handlers: AbilityHandler[],
): AbilityDefinition[] {
  const referenceById = new Map<string, ReferenceAbility>();
  for (const ability of referenceData) {
    referenceById.set(ability.id, ability);
  }

  return handlers.map((handler) => {
    const ref = referenceById.get(handler.id);
    if (!ref) {
      throw new Error(`Ability "${handler.id}" not found in reference data`);
    }
    return {
      ...handler,
      breakable: ref.flags.breakable,
      unsuppressable: ref.flags.unsuppressable,
      name: { ...ref.names },
      shortDescription: completeLocalizedText(ref.shortDescription),
    };
  });
}
