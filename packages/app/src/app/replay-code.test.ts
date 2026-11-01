import { ForfeitReason } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { MockBattleResume } from "../testing/mock-battle-resume";
import {
  decodeReplayCode,
  encodeReplayCode,
  ReplayCodeError,
  type ReplayData,
} from "./replay-code";

const BUILD = "test-build";

const replay: ReplayData = {
  mapUrl: MockBattleResume.mapUrl,
  setup: MockBattleResume.setup,
  placementTeams: MockBattleResume.placementTeams,
  placements: MockBattleResume.placements,
  seed: MockBattleResume.seed,
  actions: MockBattleResume.savedProgress.actions,
};

/** Fabrique un code à partir d'une enveloppe arbitraire, avec le même emballage que le vrai. */
async function codeOf(payload: string): Promise<string> {
  const stream = new Blob([new TextEncoder().encode(payload)])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `PTR1.${base64}`;
}

const envelope = (overrides: Record<string, unknown>) =>
  JSON.stringify({ format: 1, buildVersion: BUILD, data: replay, ...overrides });

describe("replay code", () => {
  it("round-trips a replay to identical data", async () => {
    const code = await encodeReplayCode(replay, BUILD);
    const result = await decodeReplayCode(code, BUILD);

    expect(result).toEqual({ ok: true, data: replay });
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

    const result = await decodeReplayCode(await encodeReplayCode(withLiveFields, BUILD), BUILD);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.setup).toEqual({ ...replay.setup, localSeat: 1 });
      expect(result.data.setup).not.toHaveProperty("roomCode");
      expect(result.data.setup).not.toHaveProperty("battleId");
      expect(result.data.setup).not.toHaveProperty("telemetryTeams");
    }
  });

  it("tolerates whitespace and line breaks in a pasted code", async () => {
    const code = await encodeReplayCode(replay, BUILD);
    const wrapped = `  ${code.slice(0, 20)}\n${code.slice(20, 40)}\r\n ${code.slice(40)}  \n`;

    expect(await decodeReplayCode(wrapped, BUILD)).toEqual({ ok: true, data: replay });
  });

  it("refuses a text that is not a replay code", async () => {
    expect(await decodeReplayCode("bonjour tout le monde", BUILD)).toEqual({
      ok: false,
      error: ReplayCodeError.NotACode,
    });
  });

  it("refuses a truncated code as unreadable", async () => {
    const code = await encodeReplayCode(replay, BUILD);

    expect(await decodeReplayCode(code.slice(0, 30), BUILD)).toEqual({
      ok: false,
      error: ReplayCodeError.Unreadable,
    });
  });

  it("refuses a marker with nothing after it as unreadable", async () => {
    expect(await decodeReplayCode("PTR1.", BUILD)).toEqual({
      ok: false,
      error: ReplayCodeError.Unreadable,
    });
  });

  it("refuses a payload that is not valid JSON as unreadable", async () => {
    expect(await decodeReplayCode(await codeOf("{pas du json"), BUILD)).toEqual({
      ok: false,
      error: ReplayCodeError.Unreadable,
    });
  });

  it("refuses a JSON payload that is not an object as unreadable", async () => {
    expect(await decodeReplayCode(await codeOf("null"), BUILD)).toEqual({
      ok: false,
      error: ReplayCodeError.Unreadable,
    });
  });

  it("refuses a payload whose data has the wrong shape as unreadable", async () => {
    const code = await codeOf(envelope({ data: { mapUrl: MockBattleResume.mapUrl } }));

    expect(await decodeReplayCode(code, BUILD)).toEqual({
      ok: false,
      error: ReplayCodeError.Unreadable,
    });
  });

  it("refuses a format this version does not know", async () => {
    expect(await decodeReplayCode(await codeOf(envelope({ format: 2 })), BUILD)).toEqual({
      ok: false,
      error: ReplayCodeError.UnknownFormat,
    });
  });

  it("refuses a code written by another build of the game", async () => {
    const code = await encodeReplayCode(replay, "another-build");

    expect(await decodeReplayCode(code, BUILD)).toEqual({
      ok: false,
      error: ReplayCodeError.OtherVersion,
    });
  });

  it("brings a foreign host's map URL back to the registry URL", async () => {
    const hostile = { ...replay, mapUrl: "https://example.com/assets/maps/simple-arena.tmj" };

    const result = await decodeReplayCode(await encodeReplayCode(hostile, BUILD), BUILD);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mapUrl).toBe(MockBattleResume.mapUrl);
    }
  });

  it("refuses a map that is not in the registry", async () => {
    const unknown = { ...replay, mapUrl: "https://example.com/evil.tmj" };

    expect(await decodeReplayCode(await encodeReplayCode(unknown, BUILD), BUILD)).toEqual({
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

    const result = await decodeReplayCode(await encodeReplayCode(withForfeits, BUILD), BUILD);

    expect(result).toEqual({ ok: true, data: withForfeits });
  });

  it("accepts a replay without a forfeits field", async () => {
    const result = await decodeReplayCode(await codeOf(envelope({})), BUILD);

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

    expect(await decodeReplayCode(code, BUILD)).toEqual({
      ok: false,
      error: ReplayCodeError.Unreadable,
    });
  });
});
