import { preloadPokemonAssets } from "../sprites/SpriteLoader";

export function buildEngagedSpritesQueue(
  engagedPokemonIds: readonly string[],
): (scene: Phaser.Scene) => void {
  return (scene) => {
    if (engagedPokemonIds.length === 0) {
      return;
    }
    preloadPokemonAssets(
      scene,
      engagedPokemonIds.map((id) => ({ definitionId: id })),
    );
  };
}
