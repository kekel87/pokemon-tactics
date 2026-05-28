import { PlayerController, PlayerId, TurnSystemKind } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";

import { DEFAULT_SANDBOX_CONFIG } from "../types/SandboxConfig";
import { extractEngagedPokemonIds } from "./extract-engaged-ids";

describe("extractEngagedPokemonIds", () => {
  it("returns an empty list for undefined input", () => {
    expect(extractEngagedPokemonIds(undefined)).toEqual([]);
  });

  it("returns player + dummy ids in sandbox mode", () => {
    const ids = extractEngagedPokemonIds({
      sandboxMode: true,
      sandboxConfig: DEFAULT_SANDBOX_CONFIG,
    });
    expect(ids).toContain(DEFAULT_SANDBOX_CONFIG.pokemon);
    expect(ids).toContain(DEFAULT_SANDBOX_CONFIG.dummyPokemon);
    expect(ids).toContain("dummy");
  });

  it("deduplicates across teams in placement mode", () => {
    const ids = extractEngagedPokemonIds({
      teamSelectResult: {
        teams: [
          {
            playerId: PlayerId.Player1,
            pokemonDefinitionIds: ["charizard", "snorlax"],
            controller: PlayerController.Human,
          },
          {
            playerId: PlayerId.Player2,
            pokemonDefinitionIds: ["snorlax", "alakazam"],
            controller: PlayerController.Ai,
          },
        ],
        autoPlacement: false,
        turnSystemKind: TurnSystemKind.ChargeTime,
        mapUrl: "assets/maps/simple-arena.tmj",
        formatKey: "2v6",
      },
    });
    expect(ids.sort()).toEqual(["alakazam", "charizard", "dummy", "snorlax"]);
  });

  it("scales to a 12v1 hot-seat lineup", () => {
    const teams = Array.from({ length: 13 }, (_, i) => ({
      playerId: `player-${i + 1}` as PlayerId,
      pokemonDefinitionIds: [`mon-${i % 5}`],
      controller: PlayerController.Ai,
    }));
    const ids = extractEngagedPokemonIds({
      teamSelectResult: {
        teams,
        autoPlacement: true,
        turnSystemKind: TurnSystemKind.ChargeTime,
        mapUrl: "assets/maps/simple-arena.tmj",
        formatKey: "13v1",
      },
    });
    expect(ids).toHaveLength(6);
  });
});
