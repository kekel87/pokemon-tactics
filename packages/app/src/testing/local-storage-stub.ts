/**
 * `localStorage` stand-in for the app's unit tests.
 *
 * The suites run on the `node` environment (no jsdom in this repo), so anything touching Web Storage
 * has to provide it. A Map-backed stub is enough: these tests are about what we store and how we
 * validate it on the way back, never about Web Storage semantics.
 *
 * Exists because four suites had each grown their own stub (spies / exposed record / `satisfies
 * Storage`), which is the kind of divergence that makes a storage-related test read differently
 * depending on which file you opened. The backing map is returned alongside so a test can assert on
 * the raw stored text, or seed a value before the module under test is imported.
 */

export interface LocalStorageStub {
  storage: Storage;
  /** Backing store — read it to assert on raw values, write to it to seed one. */
  entries: Map<string, string>;
}

export function createLocalStorageStub(): LocalStorageStub {
  const entries = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    removeItem: (key: string) => entries.delete(key),
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
  return { storage, entries };
}
