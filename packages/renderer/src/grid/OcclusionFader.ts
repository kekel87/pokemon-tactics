import { OCCLUSION_DEPTH_EPSILON, OCCLUSION_FADE_ALPHA } from "../constants";

export interface ScreenRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface OcclusionFadable {
  setAlpha(alpha: number): unknown;
}

export interface OcclusionObstacle {
  readonly sprite: OcclusionFadable;
  readonly depth: number;
  readonly screenBounds: ScreenRect;
}

export interface OcclusionPokemonEntry {
  readonly depth: number;
  readonly screenBounds: ScreenRect;
}

function rectanglesOverlap(a: ScreenRect, b: ScreenRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export class OcclusionFader {
  private readonly obstacles: OcclusionObstacle[] = [];
  private enabled = true;

  register(obstacle: OcclusionObstacle): void {
    this.obstacles.push(obstacle);
  }

  unregister(sprite: OcclusionFadable): void {
    const index = this.obstacles.findIndex((obstacle) => obstacle.sprite === sprite);
    if (index < 0) {
      return;
    }
    const removed = this.obstacles[index];
    this.obstacles.splice(index, 1);
    removed?.sprite.setAlpha(1);
  }

  unregisterAll(): void {
    for (const obstacle of this.obstacles) {
      obstacle.sprite.setAlpha(1);
    }
    this.obstacles.length = 0;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;
    if (!enabled) {
      for (const obstacle of this.obstacles) {
        obstacle.sprite.setAlpha(1);
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  size(): number {
    return this.obstacles.length;
  }

  // Reset all → test all → apply. Entrelacer casserait le cas "plusieurs
  // Pokemon derrière la même déco" : un apply partiel serait réécrasé.
  updateAll(pokemons: readonly OcclusionPokemonEntry[]): void {
    if (!this.enabled) {
      return;
    }
    for (const obstacle of this.obstacles) {
      obstacle.sprite.setAlpha(1);
    }
    for (const obstacle of this.obstacles) {
      for (const pokemon of pokemons) {
        if (obstacle.depth <= pokemon.depth + OCCLUSION_DEPTH_EPSILON) {
          continue;
        }
        if (!rectanglesOverlap(obstacle.screenBounds, pokemon.screenBounds)) {
          continue;
        }
        obstacle.sprite.setAlpha(OCCLUSION_FADE_ALPHA);
        break;
      }
    }
  }
}
