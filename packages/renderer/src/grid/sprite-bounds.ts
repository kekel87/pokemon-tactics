import type { ScreenRect } from "./OcclusionFader";

interface BoundedGameObject {
  getTopLeft(): { x: number; y: number };
  getBottomRight(): { x: number; y: number };
}

export function getSpriteScreenBounds(sprite: BoundedGameObject): ScreenRect {
  const topLeft = sprite.getTopLeft();
  const bottomRight = sprite.getBottomRight();
  return {
    left: topLeft.x,
    top: topLeft.y,
    right: bottomRight.x,
    bottom: bottomRight.y,
  };
}

export function getPokemonScreenBounds(
  containerX: number,
  containerY: number,
  bboxSize: number,
): ScreenRect {
  const half = bboxSize / 2;
  return {
    left: containerX - half,
    right: containerX + half,
    top: containerY - half,
    bottom: containerY + half,
  };
}
