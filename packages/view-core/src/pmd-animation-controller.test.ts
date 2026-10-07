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
    ["Shoot-South", [frame(40), frame(41), frame(42)]],
    ["Charge-South", [frame(50), frame(51)]],
  ]);
  return {
    framesByKey,
    durationsByAnimation: new Map(),
    hitFrameByAnimation: new Map([
      ["Shoot", 1],
      ["Charge", 0],
    ]),
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
      hitFrameByAnimation: new Map(),
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

describe("PmdAnimationController impact frame", () => {
  it("fires onHit when the zero-based hitFrame shows, before the animation completes", () => {
    const controller = makeController("Idle");
    const calls: string[] = [];
    controller.playOnce("Shoot", {
      onHit: () => calls.push("hit"),
      onComplete: () => calls.push("complete"),
    });
    expect(calls).toEqual([]);
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(41));
    expect(calls).toEqual(["hit"]);
    controller.tick(100, 0);
    controller.tick(100, 0);
    expect(calls).toEqual(["hit", "complete"]);
  });

  it("fires onHit straight away when the hitFrame is the first frame", () => {
    const controller = makeController("Idle");
    let hits = 0;
    controller.playOnce("Charge", { onHit: () => (hits += 1) });
    expect(hits).toBe(1);
    controller.tick(100, 0);
    controller.tick(100, 0);
    expect(hits).toBe(1);
  });

  it("fires onHit with onComplete on the last frame when the animation has no hitFrame", () => {
    const controller = makeController("Idle");
    const calls: string[] = [];
    controller.playOnce("Attack", {
      onHit: () => calls.push("hit"),
      onComplete: () => calls.push("complete"),
    });
    controller.tick(100, 0);
    expect(calls).toEqual([]);
    controller.tick(100, 0);
    expect(calls).toEqual(["hit", "complete"]);
  });

  it("drops a pending onHit when another one-shot replaces the animation", () => {
    const controller = makeController("Idle");
    let hits = 0;
    controller.playOnce("Shoot", { onHit: () => (hits += 1) });
    controller.playOnce("Attack");
    controller.tick(100, 0);
    controller.tick(100, 0);
    expect(hits).toBe(0);
  });
});

describe("PmdAnimationController hit-stop", () => {
  it("holds the attack frame while the hit-stop runs down, then resumes", () => {
    const controller = makeController("Idle");
    controller.playOnce("Shoot");
    controller.tick(100, 0);
    controller.holdFrame(150);
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(41));
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(41));
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(42));
  });

  it("freezes the resting loop too (a struck target)", () => {
    const controller = makeController("Idle");
    controller.holdFrame(100);
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(0));
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(1));
  });

  it("keeps the longer hold when a shorter one comes in", () => {
    const controller = makeController("Idle");
    controller.holdFrame(200);
    controller.holdFrame(50);
    controller.tick(100, 0);
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(0));
  });

  it("runs the hold down in combat time", () => {
    const controller = makeController("Idle");
    controller.holdFrame(100);
    controller.tick(10, 0, 100);
    controller.tick(100, 0, 100);
    expect(controller.currentFrame()).toEqual(frame(1));
  });
});

describe("PmdAnimationController white flash", () => {
  it("shows white for its duration of combat time, then clears", () => {
    const controller = makeController("Idle");
    expect(controller.whiteFlashLevel()).toBe(0);
    controller.flashWhite(100);
    expect(controller.whiteFlashLevel()).toBe(1);
    controller.tick(60, 0);
    expect(controller.whiteFlashLevel()).toBe(1);
    controller.tick(40, 0);
    expect(controller.whiteFlashLevel()).toBe(0);
  });

  it("keeps the longer flash when a shorter one comes in", () => {
    const controller = makeController("Idle");
    controller.flashWhite(200);
    controller.flashWhite(50);
    controller.tick(100, 0);
    expect(controller.whiteFlashLevel()).toBe(1);
  });
});

describe("PmdAnimationController transient reset", () => {
  it("returns to the resting pose with no hold, flash or damage blink left", () => {
    const controller = makeController("Idle");
    controller.playOnce("Shoot");
    controller.tick(100, 0);
    controller.holdFrame(500);
    controller.flashWhite(500);
    controller.flashDamage();

    controller.resetTransientEffects();

    expect(controller.currentAnimation).toBe("Idle");
    expect(controller.currentFrame()).toEqual(frame(0));
    expect(controller.whiteFlashLevel()).toBe(0);
    expect(controller.tint()).toEqual({ r: 1, g: 1, b: 1 });
    controller.tick(100, 0);
    expect(controller.currentFrame()).toEqual(frame(1));
  });
});

describe("PmdAnimationController combat time", () => {
  it("plays a one-shot on the combat delta", () => {
    const controller = makeController("Idle");
    controller.playOnce("Shoot");
    controller.tick(50, 0, 100);
    expect(controller.currentFrame()).toEqual(frame(41));
  });

  it("keeps the resting loop on real time whatever the combat delta", () => {
    const controller = makeController("Idle");
    controller.tick(100, 0, 400);
    expect(controller.currentFrame()).toEqual(frame(1));
  });
});
