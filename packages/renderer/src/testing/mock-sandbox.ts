import { Direction } from "@pokemon-tactic/core";
import type { SandboxConfig } from "../types/SandboxConfig";

export function defaultSandboxConfig(overrides: Partial<SandboxConfig> = {}): SandboxConfig {
  return {
    pokemon: "pikachu",
    moves: [],
    hp: 100,
    status: null,
    statStages: {},
    dummyPokemon: "machop",
    dummyMove: null,
    dummyDirection: Direction.West,
    dummyHp: 100,
    dummyStatus: null,
    dummyStatStages: {},
    ...overrides,
  };
}
