import { getAtlasBlobUrl, getAtlasJson, hasSprite } from "./sprite-bundle.js";

/**
 * Warm a battle's sprites before combat starts (plan 135). The whole sprite bundle is
 * already in memory (downloaded at boot behind the splash), so this no longer hits the
 * network — it just pre-mints each combatant's atlas blob URL + parses its atlas JSON so
 * the per-billboard `load()` resolves synchronously instead of slicing on first frame.
 * Combined with the renderer hiding a billboard until its atlas binds, this removes the
 * white-plane FOUC when sprites are placed. Engine-agnostic (no renderer dependency).
 */
export function preloadCombatSprites(pokemonIds: readonly string[]): Promise<void> {
  for (const id of new Set(pokemonIds)) {
    if (hasSprite(id)) {
      getAtlasBlobUrl(id);
      getAtlasJson(id);
    }
  }
  return Promise.resolve();
}
