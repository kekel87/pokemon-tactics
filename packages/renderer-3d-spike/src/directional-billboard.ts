import * as THREE from "three";

export type PmdDirection =
  | "South"
  | "SouthEast"
  | "East"
  | "NorthEast"
  | "North"
  | "NorthWest"
  | "West"
  | "SouthWest";

const DIRECTION_SECTORS: PmdDirection[] = [
  "South",
  "SouthEast",
  "East",
  "NorthEast",
  "North",
  "NorthWest",
  "West",
  "SouthWest",
];

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
}

interface AtlasMeta {
  size: { w: number; h: number };
}

interface AtlasJson {
  frames: Record<string, AtlasFrame>;
  meta: AtlasMeta;
}

export interface DirectionalBillboardOptions {
  atlasJsonUrl: string;
  atlasPngUrl: string;
  animation: string;
  worldFacing: number;
  frameDurationMs?: number;
  scale?: number;
  /** Normalized [0,1] vertical anchor. 0 = bottom of sprite, 0.5 = center. Default 0.1 (feet near bottom). */
  footAnchor?: number;
}

export class DirectionalBillboard {
  readonly object = new THREE.Object3D();
  readonly worldFacing: { value: number };

  private readonly sprite: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private atlasJson: AtlasJson | null = null;
  private currentDirection: PmdDirection = "South";
  get direction(): PmdDirection {
    return this.currentDirection;
  }
  private currentFrameIndex = 0;
  private animation: string;
  private frameDurationMs: number;
  private frameElapsedMs = 0;
  private atlasWidth = 1;
  private atlasHeight = 1;

  constructor(private readonly options: DirectionalBillboardOptions) {
    this.worldFacing = { value: options.worldFacing };
    this.animation = options.animation;
    this.frameDurationMs = options.frameDurationMs ?? 120;

    const texture = new THREE.TextureLoader().load(options.atlasPngUrl, (loaded) => {
      this.atlasWidth = loaded.image.width;
      this.atlasHeight = loaded.image.height;
      this.applyCurrentFrame();
    });
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    this.material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.01,
    });

    this.sprite = new THREE.Sprite(this.material);
    this.sprite.center.set(0.5, options.footAnchor ?? 0.1);
    this.sprite.scale.setScalar(options.scale ?? 2);
    this.object.add(this.sprite);
  }

  async load(): Promise<void> {
    const response = await fetch(this.options.atlasJsonUrl);
    this.atlasJson = (await response.json()) as AtlasJson;
    this.applyCurrentFrame();
  }

  setAnimation(animation: string): void {
    if (this.animation === animation) return;
    this.animation = animation;
    this.currentFrameIndex = 0;
    this.frameElapsedMs = 0;
    this.applyCurrentFrame();
  }

  setWorldFacing(angleRadians: number): void {
    this.worldFacing.value = angleRadians;
  }

  update(deltaMs: number, cameraAzimuth: number): void {
    const nextDirection = computeDisplayDirection(this.worldFacing.value, cameraAzimuth);
    if (nextDirection !== this.currentDirection) {
      this.currentDirection = nextDirection;
      this.applyCurrentFrame();
    }

    this.frameElapsedMs += deltaMs;
    if (this.frameElapsedMs >= this.frameDurationMs) {
      this.frameElapsedMs = 0;
      this.currentFrameIndex += 1;
      this.applyCurrentFrame();
    }
  }

  private applyCurrentFrame(): void {
    if (!this.atlasJson) return;
    const { frames } = this.atlasJson;
    const directionFrames = Object.keys(frames).filter((key) =>
      key.startsWith(`${this.animation}-${this.currentDirection}-`),
    );
    if (directionFrames.length === 0) return;

    this.currentFrameIndex = this.currentFrameIndex % directionFrames.length;
    const frameName = `${this.animation}-${this.currentDirection}-${this.currentFrameIndex}`;
    const frame = frames[frameName];
    if (!frame || !this.material.map) return;

    const { x, y, w, h } = frame.frame;
    this.material.map.offset.set(x / this.atlasWidth, 1 - (y + h) / this.atlasHeight);
    this.material.map.repeat.set(w / this.atlasWidth, h / this.atlasHeight);
    this.material.map.needsUpdate = true;

    const aspect = w / h;
    const baseScale = this.options.scale ?? 2;
    this.sprite.scale.set(baseScale * aspect, baseScale, 1);
  }
}

export function computeDisplayDirection(
  worldFacingRadians: number,
  cameraAzimuthRadians: number,
): PmdDirection {
  const relative = worldFacingRadians - cameraAzimuthRadians;
  const normalized = ((relative % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const sector = Math.round(normalized / (Math.PI / 4)) % 8;
  const direction = DIRECTION_SECTORS[sector];
  if (!direction) throw new Error(`Invalid sector ${sector}`);
  return direction;
}
