import type { HeldItemDefinition, HeldItemHandler, LocalizedText } from "@pokemon-tactic/core";
import { HeldItemHandlerRegistry } from "@pokemon-tactic/core";
import { completeLocalizedText, type ReferenceLocalizedText } from "../i18n/localized-text";

interface ReferenceItem {
  id: string;
  names: LocalizedText;
  shortDescription: ReferenceLocalizedText;
  flingPower?: number | null;
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
      name: { ...ref.names },
      shortDescription: completeLocalizedText(ref.shortDescription),
      // Fling power (Dégommage) comes from the reference data.
      ...(ref.flingPower == null ? {} : { flingPower: ref.flingPower }),
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
