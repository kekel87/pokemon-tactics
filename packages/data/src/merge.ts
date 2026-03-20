export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  ...overrides: Record<string, unknown>[]
): T {
  const result = { ...base };
  for (const override of overrides) {
    for (const key of Object.keys(override)) {
      const overrideValue = override[key];
      const baseValue = (result as Record<string, unknown>)[key];
      if (
        overrideValue !== null &&
        typeof overrideValue === "object" &&
        !Array.isArray(overrideValue) &&
        baseValue !== null &&
        typeof baseValue === "object" &&
        !Array.isArray(baseValue)
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          baseValue as Record<string, unknown>,
          overrideValue as Record<string, unknown>,
        );
      } else {
        (result as Record<string, unknown>)[key] = overrideValue;
      }
    }
  }
  return result;
}
