/**
 * Warm the browser cache for a battle's sprite atlases before combat starts, so the
 * scene begins with every required sprite ready. We only
 * prefetch the files (PNG + atlas JSON + offsets) — engine-agnostic, no renderer dependency — so
 * the per-billboard `load()` then resolves from disk cache instead of a cold network round-trip.
 * Combined with the renderer hiding a billboard until its atlas binds, this removes the
 * white-plane FOUC when sprites are placed.
 */
export function preloadCombatSprites(pokemonIds: readonly string[]): Promise<void> {
  const unique = [...new Set(pokemonIds)];
  return Promise.all(
    unique.flatMap((id) => {
      const base = `assets/sprites/pokemon/${id}`;
      return [`${base}/atlas.png`, `${base}/atlas.json`, `${base}/offsets.json`].map((url) =>
        fetch(url)
          .then(() => undefined)
          .catch(() => undefined),
      );
    }),
  ).then(() => undefined);
}
