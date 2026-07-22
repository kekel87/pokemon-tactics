import { Direction, StatusType, Weather } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { normalizeSandboxConfig, type SandboxConfig } from "./sandbox-config.js";

describe("normalizeSandboxConfig", () => {
  it("defaults an empty input to venusaur (player) vs dummy (passive)", () => {
    const config = normalizeSandboxConfig({});
    expect(config.teams[0].control).toBe("player");
    expect(config.teams[0].members[0]?.pokemon).toBe("venusaur");
    expect(config.teams[1].control).toBe("passive");
    expect(config.teams[1].members[0]?.pokemon).toBe("dummy");
  });

  it("maps a legacy flat config to two single-member teams", () => {
    const config = normalizeSandboxConfig({
      pokemon: "charizard",
      moves: ["flamethrower"],
      hp: 60,
      status: "burned",
      dummyPokemon: "blastoise",
      dummyControl: "ai",
      dummyMove: "protect",
    });
    expect(config.teams[0].members[0]).toMatchObject({
      pokemon: "charizard",
      moves: ["flamethrower"],
      hp: 60,
      status: StatusType.Burned,
    });
    expect(config.teams[1].control).toBe("passive");
    expect(config.teams[1].members[0]).toMatchObject({
      pokemon: "blastoise",
      defensiveMove: "protect",
    });
  });

  it("maps legacy dummyControl 'player' to a player team and carries dummyMoves", () => {
    const config = normalizeSandboxConfig({
      pokemon: "venusaur",
      dummyPokemon: "gengar",
      dummyControl: "player",
      dummyMoves: ["shadow-ball", "sludge-bomb"],
    });
    expect(config.teams[1].control).toBe("player");
    expect(config.teams[1].members[0]?.moves).toEqual(["shadow-ball", "sludge-bomb"]);
  });

  it("drops legacy dummyMoves when the dummy is AI-controlled (keeps species movepool)", () => {
    const config = normalizeSandboxConfig({
      pokemon: "venusaur",
      dummyPokemon: "gengar",
      dummyControl: "ai",
      dummyMoves: ["shadow-ball"],
    });
    expect(config.teams[1].members[0]?.moves).toBeUndefined();
  });

  it("passes a v2 config through and defaults a scored team's profile to hard", () => {
    const input: SandboxConfig = {
      seed: 7,
      teams: [
        { control: "scored", members: [{ pokemon: "alakazam" }] },
        { control: "player", members: [{ pokemon: "snorlax" }] },
      ],
    };
    const config = normalizeSandboxConfig(input);
    expect(config.seed).toBe(7);
    expect(config.teams[0].control).toBe("scored");
    expect(config.teams[0].aiProfile).toBe("hard");
  });

  it("keeps an explicit scored aiProfile", () => {
    const config = normalizeSandboxConfig({
      teams: [
        { control: "scored", aiProfile: "easy", members: [{ pokemon: "alakazam" }] },
        { control: "player", members: [{ pokemon: "snorlax" }] },
      ],
    });
    expect(config.teams[0].aiProfile).toBe("easy");
  });

  it("caps a team at six members", () => {
    const members = Array.from({ length: 9 }, () => ({ pokemon: "pikachu" }));
    const config = normalizeSandboxConfig({
      teams: [
        { control: "player", members },
        { control: "passive", members: [{ pokemon: "dummy" }] },
      ],
    });
    expect(config.teams[0].members).toHaveLength(6);
  });

  it("carries global fields (seed, rngMode, mapUrl, weather) from a legacy config", () => {
    const config = normalizeSandboxConfig({
      seed: 99,
      rngMode: "deterministic",
      pokemon: "venusaur",
      dummyPokemon: "dummy",
      mapUrl: "assets/maps/dev/sandbox-los.tmj",
      weather: Weather.Rain,
      weatherTurns: 8,
    });
    expect(config).toMatchObject({
      seed: 99,
      rngMode: "deterministic",
      mapUrl: "assets/maps/dev/sandbox-los.tmj",
      weather: Weather.Rain,
      weatherTurns: 8,
    });
  });

  it("preserves an explicit member direction", () => {
    const config = normalizeSandboxConfig({
      pokemon: "venusaur",
      playerDirection: "east",
      dummyPokemon: "dummy",
    });
    expect(config.teams[0].members[0]?.direction).toBe(Direction.East);
  });
});
