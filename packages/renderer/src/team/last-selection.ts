const STORAGE_KEY = "pt:team-select:last-v1";

export type LastSelection = Record<number, string>;

interface StoredSchema {
  version: number;
  bySlot: LastSelection;
}

const SCHEMA_VERSION = 1;

export function loadLastSelection(): LastSelection {
  const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (raw === null || raw === undefined) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as StoredSchema;
    if (parsed.version !== SCHEMA_VERSION) {
      return {};
    }
    return { ...parsed.bySlot };
  } catch {
    return {};
  }
}

export function saveLastSelectionEntry(slotIndex: number, teamId: string | null): void {
  const current = loadLastSelection();
  if (teamId === null) {
    delete current[slotIndex];
  } else {
    current[slotIndex] = teamId;
  }
  const next: StoredSchema = { version: SCHEMA_VERSION, bySlot: current };
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearLastSelection(): void {
  globalThis.localStorage?.removeItem(STORAGE_KEY);
}
