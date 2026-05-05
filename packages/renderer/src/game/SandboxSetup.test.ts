import { Direction, PlayerId, StatName, StatusType } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { DEFAULT_SANDBOX_CONFIG } from "../types/SandboxConfig";
import { createSandboxBattle } from "./SandboxSetup";

describe("createSandboxBattle", () => {
  it("creates a battle with player and dummy on sandbox arena", () => {
    const result = createSandboxBattle(DEFAULT_SANDBOX_CONFIG);
    const playerPokemon = result.state.pokemon.get("p1-venusaur");
    const dummyPokemon = result.state.pokemon.get("p2-dummy");

    expect(playerPokemon).toBeDefined();
    expect(dummyPokemon).toBeDefined();
    expect(playerPokemon?.position).toEqual({ x: 3, y: 4 });
    expect(dummyPokemon?.position).toEqual({ x: 3, y: 1 });
    expect(playerPokemon?.playerId).toBe(PlayerId.Player1);
    expect(dummyPokemon?.playerId).toBe(PlayerId.Player2);
  });

  it("applies player orientation north and dummy orientation from config", () => {
    const result = createSandboxBattle({
      ...DEFAULT_SANDBOX_CONFIG,
      dummyDirection: Direction.East,
    });
    const player = result.state.pokemon.get("p1-venusaur")!;
    const dummy = result.state.pokemon.get("p2-dummy")!;

    expect(player.orientation).toBe(Direction.North);
    expect(dummy.orientation).toBe(Direction.East);
  });

  it("overrides player moves when specified", () => {
    const result = createSandboxBattle({
      ...DEFAULT_SANDBOX_CONFIG,
      moves: ["razor-leaf", "sleep-powder"],
    });
    const player = result.state.pokemon.get("p1-venusaur")!;

    expect(player.moveIds).toEqual(["razor-leaf", "sleep-powder"]);
    expect(Object.keys(player.currentPp)).toEqual(["razor-leaf", "sleep-powder"]);
  });

  it("uses default movepool when moves is empty", () => {
    const result = createSandboxBattle(DEFAULT_SANDBOX_CONFIG);
    const player = result.state.pokemon.get("p1-venusaur")!;

    expect(player.moveIds).toEqual(["razor-leaf", "leech-seed", "sleep-powder", "sludge-bomb"]);
  });

  it("applies HP percentage", () => {
    const result = createSandboxBattle({ ...DEFAULT_SANDBOX_CONFIG, hp: 50, dummyHp: 25 });
    const player = result.state.pokemon.get("p1-venusaur")!;
    const dummy = result.state.pokemon.get("p2-dummy")!;

    expect(player.currentHp).toBe(Math.floor(player.maxHp * 0.5));
    expect(dummy.currentHp).toBe(Math.max(1, Math.floor(dummy.maxHp * 0.25)));
  });

  it("applies status effects", () => {
    const result = createSandboxBattle({
      ...DEFAULT_SANDBOX_CONFIG,
      status: StatusType.Burned,
      dummyStatus: StatusType.Paralyzed,
    });
    const player = result.state.pokemon.get("p1-venusaur")!;
    const dummy = result.state.pokemon.get("p2-dummy")!;

    expect(player.statusEffects).toEqual([{ type: StatusType.Burned, remainingTurns: null }]);
    expect(dummy.statusEffects).toEqual([{ type: StatusType.Paralyzed, remainingTurns: null }]);
  });

  it("applies sleep with remaining turns", () => {
    const result = createSandboxBattle({ ...DEFAULT_SANDBOX_CONFIG, status: StatusType.Asleep });
    const player = result.state.pokemon.get("p1-venusaur")!;

    expect(player.statusEffects).toEqual([{ type: StatusType.Asleep, remainingTurns: 3 }]);
  });

  it("applies stat stages", () => {
    const result = createSandboxBattle({
      ...DEFAULT_SANDBOX_CONFIG,
      statStages: { [StatName.Attack]: 2, [StatName.Defense]: -1 },
      dummyStatStages: { [StatName.Speed]: -3 },
    });
    const player = result.state.pokemon.get("p1-venusaur")!;
    const dummy = result.state.pokemon.get("p2-dummy")!;

    expect(player.statStages[StatName.Attack]).toBe(2);
    expect(player.statStages[StatName.Defense]).toBe(-1);
    expect(player.statStages[StatName.Speed]).toBe(0);
    expect(dummy.statStages[StatName.Speed]).toBe(-3);
  });

  it("returns a functional BattleEngine", () => {
    const result = createSandboxBattle(DEFAULT_SANDBOX_CONFIG);
    const activePlayerId = result.state.turnOrder[result.state.currentTurnIndex]?.startsWith("p1")
      ? PlayerId.Player1
      : PlayerId.Player2;
    const actions = result.engine.getLegalActions(activePlayerId);

    expect(actions.length).toBeGreaterThan(0);
  });
});
