import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MOVE_URL = "assets/audio/ui/move.mp3";
const MANIFEST_URL = "assets/audio/sounds-manifest.json";
const BIN_URL = "assets/audio/sounds.bin";
const BUNDLE_SOUND = "hit:normal";
const BUNDLE_BYTES = 64;
const HIT_OFFSET = 16;
const HIT_LENGTH = 24;

const FAILURES = ["missing", "offline", "undecodable"] as const;

describe("sound bank", () => {
  let bank: typeof import("./sound-bank");
  let fetched: string[];
  let failure: (typeof FAILURES)[number] | null;
  let decodedLengths: number[];

  const context = {
    decodeAudioData: async (encoded: ArrayBuffer): Promise<{ byteLength: number }> => {
      decodedLengths.push(encoded.byteLength);
      if (failure === "undecodable") {
        throw new Error("undecodable");
      }
      return { byteLength: encoded.byteLength };
    },
  } as unknown as BaseAudioContext;

  beforeEach(async () => {
    fetched = [];
    failure = null;
    decodedLengths = [];
    vi.stubGlobal("fetch", async (url: string) => {
      fetched.push(url);
      if (failure === "offline") {
        throw new Error("offline");
      }
      return {
        ok: failure !== "missing",
        status: failure === "missing" ? 404 : 200,
        arrayBuffer: async () => new ArrayBuffer(url === BIN_URL ? BUNDLE_BYTES : 8),
        json: async () => ({
          sounds: { [BUNDLE_SOUND]: [HIT_OFFSET, HIT_LENGTH, 300] },
          moves: {},
          effects: {},
        }),
      };
    });
    vi.resetModules();
    bank = await import("./sound-bank");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("interface sounds", () => {
    it.each(["move", "open", "error"])(
      "loads « ui:%s » from its own file under assets/audio/ui, without the battle bundle",
      async (name) => {
        const sound = await bank.decodeSound(context, `ui:${name}`);

        expect(sound).not.toBeNull();
        expect(fetched).toEqual([`assets/audio/ui/${name}.mp3`]);
      },
    );

    it("keeps a loaded sound: the next press fetches nothing", async () => {
      const first = await bank.decodeSound(context, "ui:move");

      const second = await bank.decodeSound(context, "ui:move");

      expect(second).toBe(first);
      expect(fetched).toEqual([MOVE_URL]);
    });

    it("shares one load between two presses that come before it ends", async () => {
      await Promise.all([
        bank.decodeSound(context, "ui:move"),
        bank.decodeSound(context, "ui:move"),
      ]);

      expect(fetched).toEqual([MOVE_URL]);
    });

    it.each(FAILURES)(
      "gives a silent sound for a file that is %s, and asks again at the next press",
      async (failing) => {
        failure = failing;
        expect(await bank.decodeSound(context, "ui:move")).toBeNull();
        failure = null;

        expect(await bank.decodeSound(context, "ui:move")).not.toBeNull();
        expect(fetched).toEqual([MOVE_URL, MOVE_URL]);
      },
    );
  });

  describe("bundle sounds", () => {
    it("decodes a battle sound from its byte range of the bundle, not from a file of its own", async () => {
      const sound = await bank.decodeSound(context, BUNDLE_SOUND);

      expect(sound).not.toBeNull();
      expect([...fetched].sort()).toEqual([BIN_URL, MANIFEST_URL].sort());
      expect(decodedLengths).toEqual([HIT_LENGTH]);
    });

    it("gives a silent sound for an id the bundle does not have", async () => {
      expect(await bank.decodeSound(context, "cry:missingno")).toBeNull();
      expect(decodedLengths).toEqual([]);
    });

    it("resolves the loading veil's wait when the bundle fails to load", async () => {
      failure = "missing";

      await expect(bank.soundBundleReady()).resolves.toBeUndefined();
      expect(await bank.decodeSound(context, BUNDLE_SOUND)).toBeNull();
    });
  });
});
