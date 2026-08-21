import { describe, expect, it, vi } from "vitest";
import { createInputSourceTracker, InputSource } from "./input-source.js";

describe("createInputSourceTracker", () => {
  it("follows the last deliberate input (last-input-wins)", () => {
    const tracker = createInputSourceTracker();

    tracker.note(InputSource.Keyboard);
    expect(tracker.current()).toBe(InputSource.Keyboard);

    tracker.note(InputSource.Gamepad);
    expect(tracker.current()).toBe(InputSource.Gamepad);

    tracker.note(InputSource.Touch);
    expect(tracker.current()).toBe(InputSource.Touch);
  });

  it("notifies only on an actual change", () => {
    const onChange = vi.fn();
    const tracker = createInputSourceTracker(onChange, InputSource.Pointer);

    tracker.note(InputSource.Pointer);
    expect(onChange).not.toHaveBeenCalled();

    tracker.note(InputSource.Keyboard);
    tracker.note(InputSource.Keyboard);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(InputSource.Keyboard);
  });

  it("ignores a phantom pointermove that did not actually move", () => {
    const tracker = createInputSourceTracker(undefined, InputSource.Pointer);
    tracker.notePointerMove(InputSource.Pointer, 100, 200);

    tracker.note(InputSource.Keyboard);
    tracker.notePointerMove(InputSource.Pointer, 100, 200);

    expect(tracker.current()).toBe(InputSource.Keyboard);
  });

  it("takes over as soon as the pointer really moves", () => {
    const tracker = createInputSourceTracker();
    tracker.notePointerMove(InputSource.Pointer, 100, 200);
    tracker.note(InputSource.Gamepad);

    tracker.notePointerMove(InputSource.Pointer, 101, 200);

    expect(tracker.current()).toBe(InputSource.Pointer);
  });

  it("reports which sources navigate by focus (the chrome may then focus by script)", () => {
    const tracker = createInputSourceTracker();

    tracker.note(InputSource.Pointer);
    expect(tracker.isFocusDriven()).toBe(false);
    tracker.note(InputSource.Touch);
    expect(tracker.isFocusDriven()).toBe(false);

    tracker.note(InputSource.Keyboard);
    expect(tracker.isFocusDriven()).toBe(true);
    tracker.note(InputSource.Gamepad);
    expect(tracker.isFocusDriven()).toBe(true);
  });
});
