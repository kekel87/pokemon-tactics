import { beforeEach, describe, expect, it } from "vitest";
import { BATTLE_TEXT_QUEUE_DELAY_MS } from "../constants";
import { acquireSpawnDelay, resetStaggerState } from "./BattleText";

describe("BattleText queue state", () => {
  beforeEach(() => {
    resetStaggerState();
  });

  it("returns 0 delay for the first text on a target", () => {
    expect(acquireSpawnDelay("target-1", 1000)).toBe(0);
  });

  it("returns increasing delays for successive calls at the same instant", () => {
    const now = 1000;
    expect(acquireSpawnDelay("target-1", now)).toBe(0);
    expect(acquireSpawnDelay("target-1", now)).toBe(BATTLE_TEXT_QUEUE_DELAY_MS);
    expect(acquireSpawnDelay("target-1", now)).toBe(BATTLE_TEXT_QUEUE_DELAY_MS * 2);
  });

  it("resets to 0 when enough time has passed since the last call", () => {
    expect(acquireSpawnDelay("target-1", 1000)).toBe(0);
    expect(acquireSpawnDelay("target-1", 1000 + BATTLE_TEXT_QUEUE_DELAY_MS + 1)).toBe(0);
  });

  it("tracks queues independently per target", () => {
    const now = 1000;
    expect(acquireSpawnDelay("target-a", now)).toBe(0);
    expect(acquireSpawnDelay("target-b", now)).toBe(0);
    expect(acquireSpawnDelay("target-a", now)).toBe(BATTLE_TEXT_QUEUE_DELAY_MS);
    expect(acquireSpawnDelay("target-b", now)).toBe(BATTLE_TEXT_QUEUE_DELAY_MS);
  });

  it("accumulates delay partially when calls come in mid-queue", () => {
    expect(acquireSpawnDelay("target-1", 1000)).toBe(0);
    // 100ms later, still within the queue window
    expect(acquireSpawnDelay("target-1", 1100)).toBe(BATTLE_TEXT_QUEUE_DELAY_MS - 100);
  });
});
