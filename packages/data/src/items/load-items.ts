import type { HeldItemDefinition, HeldItemHandler } from "@pokemon-tactic/core";
import { HeldItemHandlerRegistry } from "@pokemon-tactic/core";

interface ReferenceItem {
  id: string;
  names: { fr: string; en: string };
  shortDescription: { fr: string; en: string };
}

export function loadItemsFromReference(
  referenceData: ReferenceItem[],
  handlers: HeldItemHandler[],
): HeldItemDefinition[] {
  const referenceById = new Map<string, ReferenceItem>();
  for (const item of referenceData) {
    referenceById.set(item.id, item);
  }

  return handlers.map((handler) => {
    const ref = referenceById.get(handler.id);
    if (!ref) {
      throw new Error(`Item "${handler.id}" not found in reference data`);
    }
    return {
      ...handler,
      name: { fr: ref.names.fr, en: ref.names.en },
      shortDescription: {
        fr: ref.shortDescription.fr ?? "",
        en: ref.shortDescription.en ?? "",
      },
    };
  });
}

export function buildItemRegistry(
  referenceData: ReferenceItem[],
  handlers: HeldItemHandler[],
): HeldItemHandlerRegistry {
  const definitions = loadItemsFromReference(referenceData, handlers);
  return new HeldItemHandlerRegistry(definitions);
}
