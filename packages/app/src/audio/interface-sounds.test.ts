import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogicalAction } from "../input/logical-action";
import {
  FakeDialogElement,
  FakeDocument,
  FakeElement,
  FakeMutationObserver,
} from "../testing/interface-sound-doubles";
import { playInterfaceSound } from "./audio-player";

vi.mock("./audio-player", () => ({ playInterfaceSound: vi.fn() }));

const CURSOR = ["ui:move", { volume: 0.6 }];
const CONFIRMATION = ["ui:move", { rate: 1.19 }];
const BACK = ["ui:move", { rate: 0.84, volume: 0.8 }];
const OPENING = ["ui:open", {}];
const REFUSAL = ["ui:error", {}];

const DIRECTIONS = [
  LogicalAction.CursorUp,
  LogicalAction.CursorDown,
  LogicalAction.CursorLeft,
  LogicalAction.CursorRight,
];

describe("interface sounds", () => {
  let sounds: typeof import("./interface-sounds");
  let page: FakeDocument;
  let firstControl: FakeElement;
  let secondControl: FakeElement;
  let dialog: FakeDialogElement;

  const played = () => vi.mocked(playInterfaceSound).mock.calls;

  const endTask = (): void => {
    vi.advanceTimersByTime(0);
  };

  beforeEach(async () => {
    page = new FakeDocument();
    firstControl = new FakeElement("BUTTON");
    secondControl = new FakeElement("BUTTON");
    dialog = new FakeDialogElement();
    page.activeElement = firstControl;
    FakeMutationObserver.created.length = 0;
    vi.mocked(playInterfaceSound).mockClear();
    vi.useFakeTimers();
    vi.stubGlobal("document", page);
    vi.stubGlobal("Element", FakeElement);
    vi.stubGlobal("HTMLDialogElement", FakeDialogElement);
    vi.stubGlobal("MutationObserver", FakeMutationObserver);
    vi.resetModules();
    sounds = await import("./interface-sounds");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("withInterfaceSounds", () => {
    it.each(DIRECTIONS)("plays the cursor at once when « %s » moved the focus", (direction) => {
      const router = sounds.withInterfaceSounds({
        handle: () => {
          page.activeElement = secondControl;
          return true;
        },
      });

      router.handle(direction);

      expect(played()).toEqual([CURSOR]);
    });

    it("stays silent when a direction ran against an edge", () => {
      const router = sounds.withInterfaceSounds({ handle: () => true });

      router.handle(LogicalAction.CursorDown);
      endTask();

      expect(played()).toEqual([]);
    });

    it("stays silent when a direction nobody consumed left the focus elsewhere", () => {
      const router = sounds.withInterfaceSounds({
        handle: () => {
          page.activeElement = secondControl;
          return false;
        },
      });

      router.handle(LogicalAction.CursorDown);
      endTask();

      expect(played()).toEqual([]);
    });

    it("plays the cursor when a direction gave the focus to a control from nowhere", () => {
      page.activeElement = null;
      const router = sounds.withInterfaceSounds({
        handle: () => {
          page.activeElement = firstControl;
          return true;
        },
      });

      router.handle(LogicalAction.CursorDown);

      expect(played()).toEqual([CURSOR]);
    });

    it("plays the confirmation once the task of a consumed Confirm is over", () => {
      const router = sounds.withInterfaceSounds({ handle: () => true });

      router.handle(LogicalAction.Confirm);
      expect(played()).toEqual([]);

      endTask();
      expect(played()).toEqual([CONFIRMATION]);
    });

    it("plays the step back once the task of a consumed Cancel is over", () => {
      const router = sounds.withInterfaceSounds({ handle: () => true });

      router.handle(LogicalAction.Cancel);
      endTask();

      expect(played()).toEqual([BACK]);
    });

    it.each([LogicalAction.Confirm, LogicalAction.Cancel])(
      "stays silent when nobody consumed « %s »",
      (action) => {
        const router = sounds.withInterfaceSounds({ handle: () => false });

        router.handle(action);
        endTask();

        expect(played()).toEqual([]);
      },
    );

    it.each([LogicalAction.RotateCameraLeft, LogicalAction.ZoomIn, LogicalAction.CycleTargetNext])(
      "stays silent on « %s », which is neither a move, a choice nor a step back",
      (action) => {
        const router = sounds.withInterfaceSounds({
          handle: () => {
            page.activeElement = secondControl;
            return true;
          },
        });

        router.handle(action);
        endTask();

        expect(played()).toEqual([]);
      },
    );

    it.each([true, false])(
      "hands every action to the router and returns its answer (%s)",
      (consumed) => {
        const handle = vi.fn(() => consumed);
        const router = sounds.withInterfaceSounds({ handle });

        const answers = [
          LogicalAction.CursorLeft,
          LogicalAction.Confirm,
          LogicalAction.Cancel,
          LogicalAction.ZoomIn,
        ].map((action) => router.handle(action));

        expect(answers).toEqual([consumed, consumed, consumed, consumed]);
        expect(handle.mock.calls).toEqual([
          [LogicalAction.CursorLeft],
          [LogicalAction.Confirm],
          [LogicalAction.Cancel],
          [LogicalAction.ZoomIn],
        ]);
      },
    );
  });

  describe("variants of the cursor sound", () => {
    const variant = (index: number): { soundId?: string; rate: number; volume: number } => {
      const [soundId, { rate = 1, volume = 1 } = {}] = played()[index] ?? [];
      return { soundId, rate, volume };
    };

    it("tells a confirmation and a step back from a move: higher, lower, the move the quietest", () => {
      const router = sounds.withInterfaceSounds({ handle: () => true });
      sounds.playCursorSound();
      router.handle(LogicalAction.Confirm);
      endTask();
      router.handle(LogicalAction.Cancel);
      endTask();

      const [cursor, confirmation, back] = [variant(0), variant(1), variant(2)];

      expect(played()).toHaveLength(3);
      expect(confirmation.soundId).toBe(cursor.soundId);
      expect(back.soundId).toBe(cursor.soundId);
      expect(confirmation.rate).toBeGreaterThan(cursor.rate);
      expect(back.rate).toBeLessThan(cursor.rate);
      expect(cursor.volume).toBeLessThan(Math.min(confirmation.volume, back.volume));
    });
  });

  describe("clicks", () => {
    beforeEach(() => {
      sounds.installInterfaceSounds();
    });

    it("plays the confirmation for a click on a button", () => {
      page.click(firstControl);
      endTask();

      expect(played()).toEqual([CONFIRMATION]);
    });

    it("plays the confirmation for a click on what a button holds", () => {
      page.click(new FakeElement("SPAN", firstControl));
      endTask();

      expect(played()).toEqual([CONFIRMATION]);
    });

    it("plays the confirmation for a click on a link", () => {
      const link = new FakeElement("A");
      link.href = "https://example.test";

      page.click(link);
      endTask();

      expect(played()).toEqual([CONFIRMATION]);
    });

    it("stays silent for a click on a disabled button, or on what it holds", () => {
      firstControl.disabled = true;

      page.click(firstControl);
      page.click(new FakeElement("SPAN", firstControl));
      endTask();

      expect(played()).toEqual([]);
    });

    it.each(["DIV", "INPUT", "CANVAS", "A"])(
      "stays silent for a click on a bare « %s »",
      (tagName) => {
        page.click(new FakeElement(tagName));
        endTask();

        expect(played()).toEqual([]);
      },
    );

    it("stays silent for a click whose target is no element", () => {
      page.click(null);
      page.click(page);
      endTask();

      expect(played()).toEqual([]);
    });

    it("only listens: the click goes on to its control untouched", () => {
      page.click(firstControl);
      page.click(new FakeElement("DIV"));

      expect(page.interferences).toEqual([]);
    });
  });

  describe("dialogs", () => {
    beforeEach(() => {
      sounds.installInterfaceSounds();
    });

    it("plays the opening when a dialog opens", () => {
      page.setDialogOpen(dialog, true);
      endTask();

      expect(played()).toEqual([OPENING]);
    });

    it("plays the step back when a dialog closes with nothing chosen", () => {
      page.setDialogOpen(dialog, false);
      endTask();

      expect(played()).toEqual([BACK]);
    });

    it("stays silent when the open attribute of something else changes", () => {
      page.mutateOpenAttribute(new FakeElement("DETAILS"));
      endTask();

      expect(played()).toEqual([]);
    });
  });

  describe("one press, one sound", () => {
    let router: ReturnType<typeof sounds.withInterfaceSounds>;

    beforeEach(() => {
      sounds.installInterfaceSounds();
      router = sounds.withInterfaceSounds({ handle: () => true });
    });

    it("plays the opening alone when a click opens a dialog", () => {
      page.click(firstControl);
      page.setDialogOpen(dialog, true);
      endTask();

      expect(played()).toEqual([OPENING]);
    });

    it("plays the opening alone when a consumed Confirm opens a dialog", () => {
      router.handle(LogicalAction.Confirm);
      page.setDialogOpen(dialog, true);
      endTask();

      expect(played()).toEqual([OPENING]);
    });

    it("plays the opening alone whichever of the dialog and the click was heard first", () => {
      page.setDialogOpen(dialog, true);
      page.click(firstControl);
      endTask();

      expect(played()).toEqual([OPENING]);
    });

    it("plays the refusal alone when the dialog that opens is a refusal", () => {
      page.click(firstControl);
      page.setDialogOpen(dialog, true);
      sounds.playRefusalSound();
      endTask();

      expect(played()).toEqual([REFUSAL]);
    });

    it("plays the refusal alone when it was said before the dialog opened", () => {
      sounds.playRefusalSound();
      page.setDialogOpen(dialog, true);
      endTask();

      expect(played()).toEqual([REFUSAL]);
    });

    it("plays the refusal alone over the confirmation of the press it answers", () => {
      router.handle(LogicalAction.Confirm);
      sounds.playRefusalSound();
      endTask();

      expect(played()).toEqual([REFUSAL]);
    });

    it("plays the refusal at the end of the task when nothing else was heard", () => {
      sounds.playRefusalSound();
      expect(played()).toEqual([]);

      endTask();
      expect(played()).toEqual([REFUSAL]);
    });

    it("keeps the confirmation when the click closes its dialog", () => {
      page.click(firstControl);
      page.setDialogOpen(dialog, false);
      endTask();

      expect(played()).toEqual([CONFIRMATION]);
    });

    it("keeps the confirmation when the dialog closed before its click was heard", () => {
      page.setDialogOpen(dialog, false);
      page.click(firstControl);
      endTask();

      expect(played()).toEqual([CONFIRMATION]);
    });

    it("plays one step back when a consumed Cancel closes a dialog", () => {
      router.handle(LogicalAction.Cancel);
      page.setDialogOpen(dialog, false);
      endTask();

      expect(played()).toEqual([BACK]);
    });

    it("plays the opening alone when a choice closes a dialog and opens the next", () => {
      const next = new FakeDialogElement();

      page.click(firstControl);
      page.setDialogOpen(dialog, false);
      page.setDialogOpen(next, true);
      endTask();

      expect(played()).toEqual([OPENING]);
    });

    it("plays one sound for a press heard several times over", () => {
      router.handle(LogicalAction.Confirm);
      page.click(firstControl);
      page.click(firstControl);
      endTask();

      expect(played()).toEqual([CONFIRMATION]);
    });

    it("plays nothing more once the task is over", () => {
      page.click(firstControl);
      endTask();

      vi.advanceTimersByTime(1000);

      expect(played()).toHaveLength(1);
    });

    it("judges every press on its own: a refusal does not outlive its task", () => {
      sounds.playRefusalSound();
      endTask();
      page.click(firstControl);
      endTask();
      router.handle(LogicalAction.Cancel);
      endTask();

      expect(played()).toEqual([REFUSAL, CONFIRMATION, BACK]);
    });

    it("plays the cursor of a move on top of the press: a selection that moves is not a press", () => {
      sounds.playCursorSound();
      router.handle(LogicalAction.Confirm);
      endTask();

      expect(played()).toEqual([CURSOR, CONFIRMATION]);
    });
  });
});
