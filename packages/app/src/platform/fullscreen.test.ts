import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isFullscreen, isFullscreenSupported, toggleFullscreen } from "./fullscreen";

/**
 * Locks the ordering invariant the module depends on: the landscape lock must only be attempted
 * once the fullscreen promise has RESOLVED (locking earlier throws `SecurityError` on Firefox
 * Android). It lives only in comments in the source, so a well-meaning refactor could reorder the
 * two calls without any visible failure — on desktop, where the lock is a no-op anyway.
 */
interface FullscreenHarness {
  resolveRequest: () => void;
  rejectRequest: (error: Error) => void;
  lock: ReturnType<typeof vi.fn>;
  requestFullscreen: ReturnType<typeof vi.fn>;
  setFullscreenElement: (element: object | null) => void;
}

function setupFullscreen(options: { withOrientationApi?: boolean } = {}): FullscreenHarness {
  let resolveRequest = (): void => undefined;
  let rejectRequest = (_error: Error): void => undefined;
  const requestFullscreen = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        resolveRequest = resolve;
        rejectRequest = reject;
      }),
  );
  const lock = vi.fn(() => Promise.resolve());
  const documentStub = {
    documentElement: { requestFullscreen },
    fullscreenElement: null as object | null,
    exitFullscreen: vi.fn(() => Promise.resolve()),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("document", documentStub);
  vi.stubGlobal("screen", options.withOrientationApi === false ? {} : { orientation: { lock } });

  return {
    resolveRequest: () => resolveRequest(),
    rejectRequest: (error) => rejectRequest(error),
    lock,
    requestFullscreen,
    setFullscreenElement: (element) => {
      documentStub.fullscreenElement = element;
    },
  };
}

describe("fullscreen platform module", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not lock the orientation before the fullscreen request resolves", async () => {
    const harness = setupFullscreen();

    const pending = toggleFullscreen();

    expect(harness.requestFullscreen).toHaveBeenCalledOnce();
    expect(harness.lock).not.toHaveBeenCalled();

    harness.resolveRequest();
    await pending;

    expect(harness.lock).toHaveBeenCalledWith("landscape");
  });

  it("never locks the orientation when the fullscreen request is refused", async () => {
    const harness = setupFullscreen();

    const pending = toggleFullscreen();
    harness.rejectRequest(new Error("refused"));
    await pending;

    expect(harness.lock).not.toHaveBeenCalled();
  });

  it("resolves without locking when the orientation API is absent", async () => {
    const harness = setupFullscreen({ withOrientationApi: false });

    const pending = toggleFullscreen();
    harness.resolveRequest();

    await expect(pending).resolves.toBeUndefined();
  });

  it("reports no support when the API is missing", () => {
    vi.stubGlobal("document", { documentElement: {} });

    expect(isFullscreenSupported()).toBe(false);
  });

  it("does not report fullscreen when the API is missing", () => {
    vi.stubGlobal("document", { documentElement: {} });

    expect(isFullscreen()).toBe(false);
  });

  it("does nothing when toggled on a platform without the API", async () => {
    vi.stubGlobal("document", { documentElement: {} });

    await expect(toggleFullscreen()).resolves.toBeUndefined();
  });

  it("exits instead of requesting when already fullscreen", async () => {
    const harness = setupFullscreen();
    harness.setFullscreenElement({});

    await toggleFullscreen();

    expect(harness.requestFullscreen).not.toHaveBeenCalled();
  });
});
