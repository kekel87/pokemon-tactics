import { ForfeitReason } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { MockBattleResume } from "../testing/mock-battle-resume";
import {
  decodeReplayCode,
  encodeReplayCode,
  ReplayCodeError,
  type ReplayData,
  type SharedReplay,
} from "./replay-code";

const FINGERPRINT = "test-fingerprint";

const shared = (data: ReplayData): SharedReplay => ({ data, fingerprint: FINGERPRINT });

const replay: ReplayData = {
  mapUrl: MockBattleResume.mapUrl,
  setup: MockBattleResume.setup,
  placementTeams: MockBattleResume.placementTeams,
  placements: MockBattleResume.placements,
  seed: MockBattleResume.seed,
  actions: MockBattleResume.savedProgress.actions,
};

/** Fabrique un code à partir d'une enveloppe arbitraire, avec le même emballage que le vrai. */
async function codeOf(payload: string, marker = "PTR2."): Promise<string> {
  const stream = new Blob([new TextEncoder().encode(payload)])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${marker}${base64}`;
}

const envelope = (overrides: Record<string, unknown>) =>
  JSON.stringify({ fingerprint: FINGERPRINT, data: replay, ...overrides });

describe("replay code", () => {
  it("round-trips a replay to identical data", async () => {
    const code = await encodeReplayCode(shared(replay));
    const result = await decodeReplayCode(code);

    expect(result).toEqual({ ok: true, replay: shared(replay) });
  });

  it("strips the room code, battle id and telemetry teams but keeps the local seat", async () => {
    const withLiveFields: ReplayData = {
      ...replay,
      setup: {
        ...replay.setup,
        roomCode: "ABCD",
        battleId: "battle-1",
        telemetryTeams: [],
        localSeat: 1,
      },
    };

    const result = await decodeReplayCode(await encodeReplayCode(shared(withLiveFields)));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.replay.data.setup).toEqual({ ...replay.setup, localSeat: 1 });
      expect(result.replay.data.setup).not.toHaveProperty("roomCode");
      expect(result.replay.data.setup).not.toHaveProperty("battleId");
      expect(result.replay.data.setup).not.toHaveProperty("telemetryTeams");
    }
  });

  it("tolerates whitespace and line breaks in a pasted code", async () => {
    const code = await encodeReplayCode(shared(replay));
    const wrapped = `  ${code.slice(0, 20)}\n${code.slice(20, 40)}\r\n ${code.slice(40)}  \n`;

    expect(await decodeReplayCode(wrapped)).toEqual({ ok: true, replay: shared(replay) });
  });

  it("refuses a text that is not a replay code", async () => {
    expect(await decodeReplayCode("bonjour tout le monde")).toEqual({
      ok: false,
      error: ReplayCodeError.NotACode,
    });
  });

  it("refuses a truncated code as unreadable", async () => {
    const code = await encodeReplayCode(shared(replay));

    expect(await decodeReplayCode(code.slice(0, 30))).toEqual({
      ok: false,
      error: ReplayCodeError.Unreadable,
    });
  });

  it("refuses a marker with nothing after it as unreadable", async () => {
    expect(await decodeReplayCode("PTR2.")).toEqual({
      ok: false,
      error: ReplayCodeError.Unreadable,
    });
  });

  it("refuses a payload that is not valid JSON as unreadable", async () => {
    expect(await decodeReplayCode(await codeOf("{pas du json"))).toEqual({
      ok: false,
      error: ReplayCodeError.Unreadable,
    });
  });

  it("refuses a JSON payload that is not an object as unreadable", async () => {
    expect(await decodeReplayCode(await codeOf("null"))).toEqual({
      ok: false,
      error: ReplayCodeError.Unreadable,
    });
  });

  it("refuses a payload whose data has the wrong shape as unreadable", async () => {
    const code = await codeOf(envelope({ data: { mapUrl: MockBattleResume.mapUrl } }));

    expect(await decodeReplayCode(code)).toEqual({
      ok: false,
      error: ReplayCodeError.Unreadable,
    });
  });

  it("refuses a format this version does not know", async () => {
    expect(await decodeReplayCode(await codeOf(envelope({}), "PTR9."))).toEqual({
      ok: false,
      error: ReplayCodeError.UnknownFormat,
    });
  });

  it("refuses a code of the first format as another version", async () => {
    const legacy = JSON.stringify({ format: 1, buildVersion: "old-build", data: replay });

    expect(await decodeReplayCode(await codeOf(legacy, "PTR1."))).toEqual({
      ok: false,
      error: ReplayCodeError.OtherVersion,
    });
  });

  it("refuses a code without a fingerprint as unreadable", async () => {
    const code = await codeOf(JSON.stringify({ data: replay }));

    expect(await decodeReplayCode(code)).toEqual({ ok: false, error: ReplayCodeError.Unreadable });
  });

  it.each([
    ["double quotes", (code: string) => `"${code}"`],
    ["typographic quotes", (code: string) => `“${code}”`],
    ["backticks", (code: string) => `\`${code}\``],
    ["a code block", (code: string) => `\`\`\`\n${code}\n\`\`\``],
    ["a code block with a language", (code: string) => `\`\`\`text\n${code}\n\`\`\``],
  ])("accepts a code wrapped in %s", async (_label, wrap) => {
    const code = await encodeReplayCode(shared(replay));

    expect(await decodeReplayCode(wrap(code))).toEqual({ ok: true, replay: shared(replay) });
  });

  it("refuses an oversized text as unreadable before decoding it", async () => {
    const code = `PTR2.${"A".repeat(200_001)}`;

    expect(await decodeReplayCode(code)).toEqual({ ok: false, error: ReplayCodeError.Unreadable });
  });

  it("refuses a payload that inflates beyond the limit as unreadable", async () => {
    const code = await codeOf(envelope({ padding: " ".repeat(2_000_001) }));

    expect(await decodeReplayCode(code)).toEqual({ ok: false, error: ReplayCodeError.Unreadable });
  });

  it("leaves the rematch music choice out of the code", async () => {
    const withChoice = { ...replay, setup: { ...replay.setup, musicChoiceId: "random" } };

    const result = await decodeReplayCode(await encodeReplayCode(shared(withChoice)));

    expect(result).toEqual({ ok: true, replay: shared(replay) });
  });

  it("brings a foreign host's map URL back to the registry URL", async () => {
    const hostile = { ...replay, mapUrl: "https://example.com/assets/maps/simple-arena.tmj" };

    const result = await decodeReplayCode(await encodeReplayCode(shared(hostile)));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.replay.data.mapUrl).toBe(MockBattleResume.mapUrl);
    }
  });

  it("refuses a map that is not in the registry", async () => {
    const unknown = { ...replay, mapUrl: "https://example.com/evil.tmj" };

    expect(await decodeReplayCode(await encodeReplayCode(shared(unknown)))).toEqual({
      ok: false,
      error: ReplayCodeError.Unreadable,
    });
  });

  it("round-trips forfeits", async () => {
    const withForfeits: ReplayData = {
      ...replay,
      forfeits: [
        {
          afterAction: 1,
          playerId: replay.placementTeams[0]?.playerId ?? "",
          reason: ForfeitReason.Resigned,
        },
      ],
    };

    const result = await decodeReplayCode(await encodeReplayCode(shared(withForfeits)));

    expect(result).toEqual({ ok: true, replay: shared(withForfeits) });
  });

  it("accepts a replay without a forfeits field", async () => {
    const result = await decodeReplayCode(await codeOf(envelope({})));

    expect(result.ok).toBe(true);
  });

  const knownPlayer = MockBattleResume.placementTeams[0]?.playerId ?? "";
  const otherPlayer = MockBattleResume.placementTeams[1]?.playerId ?? "";
  const actionCount = MockBattleResume.savedProgress.actions.length;

  it.each([
    ["an unknown player", [{ afterAction: 0, playerId: "inconnu" }]],
    ["a reason outside ForfeitReason", [{ afterAction: 0, playerId: knownPlayer, reason: "nope" }]],
    ["a non-integer rank", [{ afterAction: 0.5, playerId: knownPlayer }]],
    ["a non-numeric rank", [{ afterAction: "0", playerId: knownPlayer }]],
    ["a negative rank", [{ afterAction: -1, playerId: knownPlayer }]],
    ["a rank beyond the action log", [{ afterAction: actionCount + 1, playerId: knownPlayer }]],
    [
      "a decreasing order",
      [
        { afterAction: actionCount, playerId: knownPlayer },
        { afterAction: 0, playerId: otherPlayer },
      ],
    ],
    ["an entry that is not an object", [null]],
    ["forfeits that are not an array", { afterAction: 0, playerId: knownPlayer }],
  ])("refuses forfeits with %s as unreadable", async (_label, forfeits) => {
    const code = await codeOf(envelope({ data: { ...replay, forfeits } }));

    expect(await decodeReplayCode(code)).toEqual({
      ok: false,
      error: ReplayCodeError.Unreadable,
    });
  });
});
