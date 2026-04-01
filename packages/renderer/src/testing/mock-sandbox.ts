import { Direction } from "@pokemon-tactic/core";
import type { SandboxConfig } from "../types/SandboxConfig";

export function defaultSandboxConfig(overrides: Partial<SandboxConfig> = {}): SandboxConfig {
  return {
    pokemon: "bulbasaur",
    moves: [],
    hp: 100,
    status: null,
    statStages: {},
    dummyPokemon: "dummy",
    dummyMove: null,
    dummyDirection: Direction.South,
    dummyHp: 100,
    dummyLevel: 50,
    dummyBaseStats: null,
    dummyStatus: null,
    dummyStatStages: {},
    ...overrides,
  };
}
