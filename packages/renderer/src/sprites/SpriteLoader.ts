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

export interface SpriteOffsets {
  footOffsetY: number;
  headOffsetY: number;
}

const DEFAULT_SPRITE_OFFSETS: SpriteOffsets = {
  footOffsetY: 4,
  headOffsetY: 0,
};

const TICK_DURATION_MS = 33;

export function preloadPortraitsOnly(scene: Phaser.Scene, definitionIds: string[]): void {
  for (const definitionId of definitionIds) {
    const basePath = `${SPRITE_BASE_PATH}/${definitionId}`;
    scene.load.image(`${definitionId}-portrait`, `${basePath}/portrait-normal.png`);
  }
}

export function preloadPokemonAssets(
  scene: Phaser.Scene,
  pokemonEntries: Array<{ definitionId: string }>,
): void {
  const uniqueDefinitionIds = new Set(pokemonEntries.map((entry) => entry.definitionId));

  for (const definitionId of uniqueDefinitionIds) {
    const basePath = `${SPRITE_BASE_PATH}/${definitionId}`;
    scene.load.atlas(definitionId, `${basePath}/atlas.png`, `${basePath}/atlas.json`);
    scene.load.image(`${definitionId}-portrait`, `${basePath}/portrait-normal.png`);
    scene.load.json(`${definitionId}-offsets`, `${basePath}/offsets.json`);
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
        const frameName = `${animName}-${direction}-${i}`;
        if (!texture.has(frameName)) {
          break;
        }
        frames.push({
          key: definitionId,
          frame: frameName,
          duration: (animMeta.durations[i] ?? 4) * TICK_DURATION_MS,
        });
      }

      if (frames.length === 0) {
        continue;
      }

      const looping = animName === "Idle" || animName === "Walk" || animName === "Sleep";
      scene.anims.create({
        key,
        frames,
        repeat: looping ? -1 : 0,
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

export function getSpriteOffsets(scene: Phaser.Scene, definitionId: string): SpriteOffsets {
  const data = scene.cache.json.get(`${definitionId}-offsets`) as SpriteOffsets | undefined;
  return data ?? DEFAULT_SPRITE_OFFSETS;
}

export function getPortraitKey(definitionId: string): string {
  return `${definitionId}-portrait`;
}
