import { Nature, type TeamSet } from "@pokemon-tactic/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalStorageStub, type LocalStorageStub } from "../../testing/local-storage-stub";
import { clearAllTeams, deleteTeam, listTeamSummaries, loadTeam, saveTeam } from "../team-storage";

function buildTeam(id: string, name: string): TeamSet {
  return {
    id,
    name,
    slots: [
      {
        pokemonId: "charizard",
        ability: "blaze",
        nature: Nature.Timid,
        moveIds: ["flamethrower"],
        statSpread: { spAttack: 31 },
      },
    ],
    createdAt: 1000,
    updatedAt: 1000,
  };
}

describe("team-storage", () => {
  let stub: LocalStorageStub;

  beforeEach(() => {
    stub = createLocalStorageStub();
    vi.stubGlobal("localStorage", stub.storage);
  });

  afterEach(() => {
    clearAllTeams();
    vi.unstubAllGlobals();
  });

  it("save then load returns identical team", () => {
    const team = buildTeam("t1", "Alpha");
    saveTeam(team);
    expect(loadTeam("t1")).toEqual(team);
  });

  it("list summaries returns saved teams", () => {
    saveTeam(buildTeam("t1", "Alpha"));
    saveTeam(buildTeam("t2", "Beta"));
    const summaries = listTeamSummaries();
    expect(summaries).toHaveLength(2);
    expect(summaries.map((s) => s.id).sort()).toEqual(["t1", "t2"]);
  });

  it("delete removes a team", () => {
    saveTeam(buildTeam("t1", "Alpha"));
    deleteTeam("t1");
    expect(loadTeam("t1")).toBeNull();
  });

  it("load missing team returns null", () => {
    expect(loadTeam("does-not-exist")).toBeNull();
  });

  it("recovers gracefully from corrupted JSON", () => {
    stub.entries.set("pokemon-tactics:teams", "not-valid-json{");
    expect(listTeamSummaries()).toEqual([]);
  });

  it("resets on schema version mismatch", () => {
    stub.entries.set(
      "pokemon-tactics:teams",
      JSON.stringify({ version: 99, teams: { t1: buildTeam("t1", "Old") } }),
    );
    expect(listTeamSummaries()).toEqual([]);
  });
});
