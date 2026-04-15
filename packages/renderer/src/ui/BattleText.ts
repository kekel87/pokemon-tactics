import {
  BATTLE_TEXT_DRIFT_Y,
  BATTLE_TEXT_DURATION_MS,
  BATTLE_TEXT_FONT_SIZE,
  BATTLE_TEXT_QUEUE_DELAY_MS,
  BATTLE_TEXT_STROKE_COLOR,
  BATTLE_TEXT_STROKE_WIDTH,
  DEPTH_BATTLE_TEXT,
  FONT_FAMILY,
} from "../constants";

export interface BattleTextOptions {
  color?: string;
  fontSize?: number;
  duration?: number;
  offsetY?: number;
  /**
   * If set, the spawn delay is read from the per-target queue: the first
   * call spawns immediately, subsequent calls queue up with
   * BATTLE_TEXT_QUEUE_DELAY_MS between spawns. Use this for "primary"
   * texts of a beat (damage, status, miss).
   */
  targetId?: string;
  /**
   * Explicit spawn delay in ms. Takes precedence over targetId. Use this
   * for "secondary" texts that must share the same beat as a primary
   * (e.g. "Super effective!" above the damage number) — compute the delay
   * once via acquireSpawnDelay, pass it to both calls.
   */
  delay?: number;
}

interface QueueState {
  nextSpawnAt: number;
}

const queueStateByTarget: Map<string, QueueState> = new Map();

export function acquireSpawnDelay(targetId: string, now: number): number {
  const state = queueStateByTarget.get(targetId);
  const earliestSpawn = state?.nextSpawnAt ?? now;
  const delay = Math.max(0, earliestSpawn - now);
  queueStateByTarget.set(targetId, {
    nextSpawnAt: Math.max(earliestSpawn, now) + BATTLE_TEXT_QUEUE_DELAY_MS,
  });
  return delay;
}

export function resetStaggerState(): void {
  queueStateByTarget.clear();
}

export function showBattleText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options: BattleTextOptions = {},
): void {
  const {
    color = "#ffffff",
    fontSize = BATTLE_TEXT_FONT_SIZE,
    duration = BATTLE_TEXT_DURATION_MS,
    offsetY = 0,
    targetId,
    delay: explicitDelay,
  } = options;

  let delay: number;
  if (explicitDelay !== undefined) {
    delay = explicitDelay;
  } else if (targetId !== undefined) {
    delay = acquireSpawnDelay(targetId, scene.time.now);
  } else {
    delay = 0;
  }

  const spawn = (): void => {
    const textObject = scene.add.text(x, y + offsetY, text, {
      fontFamily: FONT_FAMILY,
      fontSize: `${fontSize}px`,
      color,
      stroke: BATTLE_TEXT_STROKE_COLOR,
      strokeThickness: BATTLE_TEXT_STROKE_WIDTH,
      fontStyle: "bold",
    });
    textObject.setOrigin(0.5, 0.5);
    textObject.setDepth(DEPTH_BATTLE_TEXT);

    scene.tweens.add({
      targets: textObject,
      y: y + offsetY + BATTLE_TEXT_DRIFT_Y,
      alpha: 0,
      duration,
      ease: "Cubic.easeOut",
      onComplete: () => {
        textObject.destroy();
      },
    });
  };

  if (delay <= 0) {
    spawn();
  } else {
    scene.time.delayedCall(delay, spawn);
  }
}
