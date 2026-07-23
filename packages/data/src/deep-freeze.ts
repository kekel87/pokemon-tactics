/**
 * Recursively freeze a value so shared, cached game data (definitions, type chart) cannot be mutated.
 * These are immutable by contract — the core reads them, gameplay state lives on separate instances.
 * A mutation is always a bug; freezing turns a silent cross-test cache-pollution (Vitest workers
 * share module state under `isolate: false`) into a loud `TypeError` at the mutation site.
 *
 * The `Object.isFrozen` guard makes it safe on a DAG (a sub-tree reachable by more than one path — e.g.
 * shared reference rows in the type chart): each node is frozen once. It does NOT handle true cycles,
 * but the game data is acyclic JSON.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const key of Object.keys(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}
