export function toShowdownId(kebab: string): string {
  return kebab.replace(/-/g, "").toLowerCase();
}

export function buildShowdownIdMap(kebabIds: Iterable<string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const kebab of kebabIds) {
    map.set(toShowdownId(kebab), kebab);
  }
  return map;
}

export function fromShowdownId(
  compressed: string,
  showdownIdMap: ReadonlyMap<string, string>,
): string | undefined {
  return showdownIdMap.get(compressed.toLowerCase());
}
