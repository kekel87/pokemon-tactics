import type { AbilityDefinition, AbilityHandler } from "@pokemon-tactic/core";
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
      name: { fr: ref.names.fr, en: ref.names.en },
      shortDescription: {
        fr: ref.shortDescription.fr,
        en: ref.shortDescription.en,
      },
    };
  });
}
