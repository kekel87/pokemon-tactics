import { beforeEach, describe, expect, it } from "vitest";
import { createKeyboardHoldSource, isContinuousAction } from "./keyboard-hold-source.js";
import { LogicalAction } from "./logical-action.js";

/**
 * Boucle de frames pilotée à la main : la suite tourne en environnement node, sans `rAF`, et un test
 * qui dépendrait d'un vrai repaint ne pourrait ni compter les émissions ni prouver que la boucle
 * s'arrête.
 */
function createFrameClock() {
  let next = 1;
  const pending = new Map<number, () => void>();
  return {
    scheduleFrame(callback: () => void): number {
      const handle = next++;
      pending.set(handle, callback);
      return handle;
    },
    cancelFrame(handle: number): void {
      pending.delete(handle);
    },
    /** Joue exactement une frame. */
    tick(): void {
      const entries = [...pending.entries()];
      pending.clear();
      for (const [, callback] of entries) {
        callback();
      }
    },
    get scheduled(): number {
      return pending.size;
    },
  };
}

describe("keyboard-hold-source", () => {
  let clock: ReturnType<typeof createFrameClock>;
  let emitted: LogicalAction[];
  let source: ReturnType<typeof createKeyboardHoldSource>;

  beforeEach(() => {
    clock = createFrameClock();
    emitted = [];
    source = createKeyboardHoldSource((action) => emitted.push(action), {
      scheduleFrame: clock.scheduleFrame,
      cancelFrame: clock.cancelFrame,
    });
  });

  it("ne prend en charge que les actions continues", () => {
    expect(isContinuousAction(LogicalAction.PanCameraUp)).toBe(true);
    expect(isContinuousAction(LogicalAction.Confirm)).toBe(false);
    // Refusée : l'appelant doit la router normalement, sinon la touche ne ferait plus rien du tout.
    expect(source.press("Space", LogicalAction.Confirm)).toBe(false);
    expect(clock.scheduled).toBe(0);
  });

  it("réémet l'action à chaque frame tant que la touche est tenue", () => {
    expect(source.press("Numpad8", LogicalAction.PanCameraUp)).toBe(true);
    clock.tick();
    clock.tick();
    clock.tick();
    expect(emitted).toEqual([
      LogicalAction.PanCameraUp,
      LogicalAction.PanCameraUp,
      LogicalAction.PanCameraUp,
    ]);
  });

  it("arrête la boucle au relâchement, plutôt que de tourner à vide", () => {
    source.press("Numpad8", LogicalAction.PanCameraUp);
    clock.tick();
    source.release("Numpad8");
    expect(clock.scheduled).toBe(0);
    clock.tick();
    expect(emitted).toEqual([LogicalAction.PanCameraUp]);
  });

  it("émet les deux directions d'une diagonale tenue", () => {
    source.press("Numpad8", LogicalAction.PanCameraUp);
    source.press("Numpad6", LogicalAction.PanCameraRight);
    clock.tick();
    expect(emitted).toEqual([LogicalAction.PanCameraUp, LogicalAction.PanCameraRight]);
    // Une direction lâchée, l'autre continue.
    source.release("Numpad8");
    clock.tick();
    expect(emitted.at(-1)).toBe(LogicalAction.PanCameraRight);
  });

  it("absorbe la répétition automatique de l'OS sans doubler l'émission", () => {
    source.press("Numpad8", LogicalAction.PanCameraUp);
    source.press("Numpad8", LogicalAction.PanCameraUp);
    source.press("Numpad8", LogicalAction.PanCameraUp);
    clock.tick();
    expect(emitted).toEqual([LogicalAction.PanCameraUp]);
  });

  it("relâche par CODE, même si Maj est retombé entre-temps", () => {
    // Le vrai cas : `Maj+↑` tenu, Maj lâché d'abord — le `keyup` de la flèche arrive sans Maj. Une clé
    // qui embarquerait l'état de Maj ne retrouverait pas son entrée et la touche resterait collée.
    source.press("ArrowUp", LogicalAction.PanCameraUp);
    clock.tick();
    source.release("ArrowUp");
    clock.tick();
    expect(emitted).toEqual([LogicalAction.PanCameraUp]);
    expect(clock.scheduled).toBe(0);
  });

  it("tout relâcher coupe la caméra — le cas Alt+Tab", () => {
    source.press("Numpad8", LogicalAction.PanCameraUp);
    source.press("Numpad4", LogicalAction.PanCameraLeft);
    source.releaseAll();
    expect(clock.scheduled).toBe(0);
    clock.tick();
    expect(emitted).toEqual([]);
  });

  it("dispose arrête tout", () => {
    source.press("Numpad8", LogicalAction.PanCameraUp);
    source.dispose();
    expect(clock.scheduled).toBe(0);
    clock.tick();
    expect(emitted).toEqual([]);
  });
});
