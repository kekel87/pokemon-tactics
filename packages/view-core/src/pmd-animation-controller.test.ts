import { describe, expect, it } from "vitest";
import {
  type AtlasFrame,
  type AtlasIndex,
  type PmdAnimationConfig,
  PmdAnimationController,
} from "./pmd-animation-controller.js";

const CONFIG: PmdAnimationConfig = {
  frameDurationMs: 100,
  tickDurationMs: 100,
  defaultFrameTicks: 1,
  pulsePeriodMs: 1000,
  pulseMinScale: 0.9,
  pulseMaxScale: 1.1,
  flashDurationMs: 50,
  flashRepeat: 2,
  damageFlashDimLevel: 0.4,
  previewFlashPeriodMs: 600,
  previewFlashDimLevel: 0.5,
  confusionWobblePeriodMs: 400,
  confusionWobbleAngle: 0.2,
  semiInvulnerableLift: 2,
  spriteGroundOffsetPx: 4,
  hudAnchorMarginPx: 2,
  koTintColor: 0x808080,
};

function frame(x: number): AtlasFrame {
  return { frame: { x, y: 0, w: 24, h: 24 } };
}

function makeAtlas(): AtlasIndex {
  const framesByKey = new Map<string, AtlasFrame[]>([
    ["Idle-South", [frame(0), frame(1), frame(2)]],
    ["Attack-South", [frame(10), frame(11)]],
    ["Faint-South", [frame(20), frame(21)]],
    ["Hurt-South", [frame(30)]],
  ]);
  return {
    framesByKey,
    durationsByAnimation: new Map(),
    atlasWidth: 240,
    atlasHeight: 24,
    footOffsetY: 4,
    headOffsetY: -10,
  };
}

function makeController(animation = "Idle"): PmdAnimationController {
  const controller = new PmdAnimationController(CONFIG, {
    animation,
    worldFacing: 0,
    pixelsPerWorldUnit: 24,
  });
  controller.bindAtlas(makeAtlas());
  controller.resolveRestingFallback();
  return controller;
}

describe("PmdAnimationController frame loop", () => {
  it("loops a looping animation, wrapping past the last frame", () => {
    const controller = makeController("Idle");
    expect(controller.currentFrame()).toEqual(frame(0));
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(1));
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(2));
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(0));
  });

  it("holds each frame for its own duration, advancing frame-rate independently", () => {
    const controller = makeController("Idle");
    controller.tick(250, 0);
    expect(controller.currentFrame()).toEqual(frame(2));
  });
});

describe("PmdAnimationController one-shots", () => {
  it("reverts to the resting animation after a one-shot ends", () => {
    const controller = makeController("Idle");
    controller.playOnce("Attack");
    expect(controller.currentFrame()).toEqual(frame(10));
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(11));
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(0));
  });

  it("fires onComplete exactly once when the one-shot lands its last frame", () => {
    const controller = makeController("Idle");
    let completed = 0;
    controller.playOnce("Attack", { onComplete: () => (completed += 1) });
    controller.tick(100, 0);
    controller.tick(100, 0);
    controller.tick(100, 0);
    expect(completed).toBe(1);
  });

  it("freezes a frozen one-shot on its last frame", () => {
    const controller = makeController("Idle");
    controller.playOnce("Faint", { freeze: true });
    controller.tick(100, 0);
    controller.tick(100, 0);
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(21));
  });
});

describe("PmdAnimationController KO", () => {
  it("kicks Faint once on the false to true edge and freezes; repeats are no-ops", () => {
    const controller = makeController("Idle");
    expect(controller.setKnockedOut(true)).toBe(true);
    expect(controller.setKnockedOut(true)).toBe(false);
    controller.tick(100, 0);
    controller.tick(100, 0);
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(21));
  });

  it("tints KO grey and white when alive", () => {
    const controller = makeController("Idle");
    expect(controller.tint()).toEqual({ r: 1, g: 1, b: 1 });
    controller.setKnockedOut(true);
    expect(controller.tint()).toEqual({ r: 128 / 255, g: 128 / 255, b: 128 / 255 });
  });
});

describe("PmdAnimationController fallbacks", () => {
  it("falls back to a resting animation the atlas actually carries", () => {
    const controller = new PmdAnimationController(CONFIG, {
      animation: "Idle",
      worldFacing: 0,
      pixelsPerWorldUnit: 24,
    });
    controller.bindAtlas({
      framesByKey: new Map([["Hover-South", [frame(0)]]]),
      durationsByAnimation: new Map(),
      atlasWidth: 24,
      atlasHeight: 24,
      footOffsetY: 0,
      headOffsetY: 0,
    });
    controller.resolveRestingFallback();
    expect(controller.currentFrame()).toEqual(frame(0));
  });

  it("returns the fallback when no flying glide candidate is present", () => {
    const controller = makeController("Idle");
    const chosen = controller.playFirstAvailable(["FlyingIdle", "Hover", "Walk"], "Walk");
    expect(chosen).toBe("Walk");
  });
});

describe("PmdAnimationController metrics", () => {
  it("derives frame world size from pixels-per-unit and frame size", () => {
    const controller = makeController("Idle");
    controller.refreshFrameMetrics();
    expect(controller.frameWorldHeight).toBeCloseTo(1);
    expect(controller.frameWorldWidth).toBeCloseTo(1);
  });
});
