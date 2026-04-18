import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

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
  scene: Scene;
  atlasJsonUrl: string;
  atlasPngUrl: string;
  animation: string;
  worldFacing: number;
  frameDurationMs?: number;
  scale?: number;
  /** Normalized [0,1] vertical anchor. 0 = bottom of sprite, 0.5 = center. */
  footAnchor?: number;
}

export class DirectionalBillboard {
  readonly root: TransformNode;
  readonly worldFacing: { value: number };

  private readonly plane: Mesh;
  private readonly material: StandardMaterial;
  private readonly texture: Texture;
  private atlasJson: AtlasJson | null = null;
  private currentDirection: PmdDirection = "South";
  private currentFrameIndex = 0;
  private animation: string;
  private frameDurationMs: number;
  private frameElapsedMs = 0;
  private atlasWidth = 1;
  private atlasHeight = 1;
  private readonly baseScale: number;
  private readonly footAnchor: number;

  get direction(): PmdDirection {
    return this.currentDirection;
  }

  constructor(private readonly options: DirectionalBillboardOptions) {
    this.worldFacing = { value: options.worldFacing };
    this.animation = options.animation;
    this.frameDurationMs = options.frameDurationMs ?? 120;
    this.baseScale = options.scale ?? 2;
    this.footAnchor = options.footAnchor ?? 0.1;

    this.root = new TransformNode("pokemon_root", options.scene);

    this.texture = new Texture(
      options.atlasPngUrl,
      options.scene,
      true,
      true,
      Texture.NEAREST_SAMPLINGMODE,
    );
    this.texture.hasAlpha = true;
    this.texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    this.texture.wrapV = Texture.CLAMP_ADDRESSMODE;

    this.material = new StandardMaterial("pokemon_mat", options.scene);
    this.material.diffuseTexture = this.texture;
    this.material.emissiveColor = new Color3(1, 1, 1);
    this.material.disableLighting = true;
    this.material.useAlphaFromDiffuseTexture = true;
    this.material.backFaceCulling = false;
    this.material.transparencyMode = 1;
    this.material.alphaCutOff = 0.5;

    this.plane = MeshBuilder.CreatePlane(
      "pokemon_plane",
      { width: this.baseScale, height: this.baseScale },
      options.scene,
    );
    this.plane.material = this.material;
    this.plane.billboardMode = Mesh.BILLBOARDMODE_Y;
    this.plane.parent = this.root;

    const outlinePoints = [
      new Vector3(-0.5, -0.5, 0),
      new Vector3(0.5, -0.5, 0),
      new Vector3(0.5, 0.5, 0),
      new Vector3(-0.5, 0.5, 0),
      new Vector3(-0.5, -0.5, 0),
    ];
    const outline = MeshBuilder.CreateLines(
      "pokemon_outline",
      { points: outlinePoints, updatable: false },
      options.scene,
    );
    outline.color = new Color3(1, 1, 0);
    outline.parent = this.plane;
    outline.isPickable = false;
  }

  async load(): Promise<void> {
    const [jsonResponse] = await Promise.all([
      fetch(this.options.atlasJsonUrl),
      new Promise<void>((resolve) => {
        this.texture.onLoadObservable.addOnce(() => {
          const size = this.texture.getSize();
          this.atlasWidth = size.width;
          this.atlasHeight = size.height;
          resolve();
        });
      }),
    ]);
    this.atlasJson = (await jsonResponse.json()) as AtlasJson;
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
    if (!frame) return;

    const { x, y, w, h } = frame.frame;
    this.texture.uOffset = x / this.atlasWidth;
    this.texture.vOffset = 1 - (y + h) / this.atlasHeight;
    this.texture.uScale = w / this.atlasWidth;
    this.texture.vScale = h / this.atlasHeight;

    const aspect = w / h;
    this.plane.scaling.set(this.baseScale * aspect, this.baseScale, 1);
    const pivotOffset = (0.5 - this.footAnchor) * this.baseScale;
    this.plane.position.y = pivotOffset;
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
