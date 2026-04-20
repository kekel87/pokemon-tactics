import { beforeEach, describe, expect, it } from "vitest";
import { OCCLUSION_FADE_ALPHA } from "../constants";
import {
  OcclusionFader,
  type OcclusionObstacle,
  type OcclusionPokemonEntry,
  type ScreenRect,
} from "./OcclusionFader";

class FakeSprite {
  alpha = 1;
  setAlpha(value: number): this {
    this.alpha = value;
    return this;
  }
}

function rect(left: number, top: number, size = 10): ScreenRect {
  return { left, top, right: left + size, bottom: top + size };
}

function obstacle(
  depth: number,
  bounds: ScreenRect,
): OcclusionObstacle & { sprite: FakeSprite } {
  return { sprite: new FakeSprite(), depth, screenBounds: bounds };
}

function pokemon(depth: number, bounds: ScreenRect): OcclusionPokemonEntry {
  return { depth, screenBounds: bounds };
}

describe("OcclusionFader", () => {
  let fader: OcclusionFader;

  beforeEach(() => {
    fader = new OcclusionFader();
  });

  it("fades an obstacle that sits in front of and overlaps a Pokemon", () => {
    const front = obstacle(100, rect(0, 0));
    fader.register(front);
    fader.updateAll([pokemon(10, rect(2, 2))]);
    expect(front.sprite.alpha).toBe(OCCLUSION_FADE_ALPHA);
  });

  it("leaves an obstacle at full alpha when the Pokemon is in front (higher depth)", () => {
    const back = obstacle(10, rect(0, 0));
    fader.register(back);
    fader.updateAll([pokemon(100, rect(2, 2))]);
    expect(back.sprite.alpha).toBe(1);
  });

  it("leaves an obstacle at full alpha when bounding boxes do not overlap", () => {
    const far = obstacle(100, rect(0, 0));
    fader.register(far);
    fader.updateAll([pokemon(10, rect(50, 50))]);
    expect(far.sprite.alpha).toBe(1);
  });

  it("keeps a fade applied across multiple Pokemon (reset→test→apply pipeline)", () => {
    const shared = obstacle(100, rect(0, 0));
    fader.register(shared);
    fader.updateAll([pokemon(10, rect(2, 2)), pokemon(11, rect(3, 3))]);
    expect(shared.sprite.alpha).toBe(OCCLUSION_FADE_ALPHA);
  });

  it("resets alpha when Pokemon leaves the overlap area across frames", () => {
    const obs = obstacle(100, rect(0, 0));
    fader.register(obs);
    fader.updateAll([pokemon(10, rect(2, 2))]);
    expect(obs.sprite.alpha).toBe(OCCLUSION_FADE_ALPHA);
    fader.updateAll([pokemon(10, rect(50, 50))]);
    expect(obs.sprite.alpha).toBe(1);
  });

  it("does not fade when the depth gap is within the epsilon (same-cell obstacle)", () => {
    const near = obstacle(10.2, rect(0, 0));
    fader.register(near);
    fader.updateAll([pokemon(10, rect(2, 2))]);
    expect(near.sprite.alpha).toBe(1);
  });

  it("restores alpha on unregister", () => {
    const obs = obstacle(100, rect(0, 0));
    fader.register(obs);
    fader.updateAll([pokemon(10, rect(2, 2))]);
    expect(obs.sprite.alpha).toBe(OCCLUSION_FADE_ALPHA);
    fader.unregister(obs.sprite);
    expect(obs.sprite.alpha).toBe(1);
    expect(fader.size()).toBe(0);
  });

  it("restores alpha for every obstacle on unregisterAll", () => {
    const a = obstacle(100, rect(0, 0));
    const b = obstacle(100, rect(0, 0));
    fader.register(a);
    fader.register(b);
    fader.updateAll([pokemon(10, rect(2, 2))]);
    fader.unregisterAll();
    expect(a.sprite.alpha).toBe(1);
    expect(b.sprite.alpha).toBe(1);
    expect(fader.size()).toBe(0);
  });

  it("resets all alphas and skips updates when disabled", () => {
    const obs = obstacle(100, rect(0, 0));
    fader.register(obs);
    fader.updateAll([pokemon(10, rect(2, 2))]);
    fader.setEnabled(false);
    expect(obs.sprite.alpha).toBe(1);
    fader.updateAll([pokemon(10, rect(2, 2))]);
    expect(obs.sprite.alpha).toBe(1);
  });
});
