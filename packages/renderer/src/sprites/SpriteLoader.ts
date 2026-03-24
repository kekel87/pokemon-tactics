import type { PokemonInstance } from "@pokemon-tactic/core";

const SPRITE_BASE_PATH = "assets/sprites/pokemon";

interface AnimationMetadata {
  frameWidth: number;
  frameHeight: number;
  durations: number[];
  rushFrame?: number;
  hitFrame?: number;
  returnFrame?: number;
}

interface AtlasMeta {
  animations: Record<string, AnimationMetadata>;
  directions: string[];
}

const TICK_DURATION_MS = 33;

export function preloadPokemonAssets(
  scene: Phaser.Scene,
  pokemonInstances: PokemonInstance[],
): void {
  const uniqueDefinitionIds = new Set(pokemonInstances.map((pokemon) => pokemon.definitionId));

  for (const definitionId of uniqueDefinitionIds) {
    const basePath = `${SPRITE_BASE_PATH}/${definitionId}`;
    scene.load.atlas(definitionId, `${basePath}/atlas.png`, `${basePath}/atlas.json`);
    scene.load.image(`${definitionId}-portrait`, `${basePath}/portrait-normal.png`);
  }
}

export function createPokemonAnimations(scene: Phaser.Scene, definitionId: string): void {
  const texture = scene.textures.get(definitionId);
  if (!texture) {
    return;
  }

  const atlasData = texture.customData as { meta?: AtlasMeta } | undefined;
  const meta = atlasData?.meta;
  if (!meta?.animations || !meta?.directions) {
    return;
  }

  for (const [animName, animMeta] of Object.entries(meta.animations)) {
    for (const direction of meta.directions) {
      const key = `${definitionId}-${animName}-${direction}`;

      if (scene.anims.exists(key)) {
        continue;
      }

      const frameCount = animMeta.durations.length;
      const frames: Phaser.Types.Animations.AnimationFrame[] = [];

      for (let i = 0; i < frameCount; i++) {
        frames.push({
          key: definitionId,
          frame: `${animName}-${direction}-${i}`,
          duration: (animMeta.durations[i] ?? 4) * TICK_DURATION_MS,
        });
      }

      scene.anims.create({
        key,
        frames,
        repeat: animName === "Idle" || animName === "Walk" ? -1 : 0,
      });
    }
  }
}

export function getAnimationKey(
  definitionId: string,
  animation: string,
  direction: string,
): string {
  return `${definitionId}-${animation}-${direction}`;
}

export function getPortraitKey(definitionId: string): string {
  return `${definitionId}-portrait`;
}
