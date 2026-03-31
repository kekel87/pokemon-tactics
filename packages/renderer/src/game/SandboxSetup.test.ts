import { describe, expect, it } from "vitest";
import { Direction, PlayerId, StatName, StatusType } from "@pokemon-tactic/core";
import { defaultSandboxConfig } from "../testing/mock-sandbox";
import { createSandboxBattle } from "./SandboxSetup";

describe("createSandboxBattle", () => {
  it("creates a battle with player and dummy on sandbox arena", () => {
    const result = createSandboxBattle(defaultSandboxConfig());
    const playerPokemon = result.state.pokemon.get("p1-pikachu");
    const dummyPokemon = result.state.pokemon.get("p2-machop");

    expect(playerPokemon).toBeDefined();
    expect(dummyPokemon).toBeDefined();
    expect(playerPokemon!.position).toEqual({ x: 1, y: 3 });
    expect(dummyPokemon!.position).toEqual({ x: 4, y: 3 });
    expect(playerPokemon!.playerId).toBe(PlayerId.Player1);
    expect(dummyPokemon!.playerId).toBe(PlayerId.Player2);
  });

  it("applies player orientation east and dummy orientation from config", () => {
    const result = createSandboxBattle(defaultSandboxConfig({ dummyDirection: Direction.North }));
    const player = result.state.pokemon.get("p1-pikachu")!;
    const dummy = result.state.pokemon.get("p2-machop")!;

    expect(player.orientation).toBe(Direction.East);
    expect(dummy.orientation).toBe(Direction.North);
  });

  it("overrides player moves when specified", () => {
    const result = createSandboxBattle(defaultSandboxConfig({ moves: ["thunderbolt", "thunder-wave"] }));
    const player = result.state.pokemon.get("p1-pikachu")!;

    expect(player.moveIds).toEqual(["thunderbolt", "thunder-wave"]);
    expect(Object.keys(player.currentPp)).toEqual(["thunderbolt", "thunder-wave"]);
  });

  it("uses default movepool when moves is empty", () => {
    const result = createSandboxBattle(defaultSandboxConfig());
    const player = result.state.pokemon.get("p1-pikachu")!;

    expect(player.moveIds).toEqual(["thunderbolt", "thunder-wave", "double-team", "volt-tackle"]);
  });

  it("applies HP percentage", () => {
    const result = createSandboxBattle(defaultSandboxConfig({ hp: 50, dummyHp: 25 }));
    const player = result.state.pokemon.get("p1-pikachu")!;
    const dummy = result.state.pokemon.get("p2-machop")!;

    expect(player.currentHp).toBe(Math.floor(player.maxHp * 0.5));
    expect(dummy.currentHp).toBe(Math.max(1, Math.floor(dummy.maxHp * 0.25)));
  });

  it("applies status effects", () => {
    const result = createSandboxBattle(defaultSandboxConfig({ status: StatusType.Burned, dummyStatus: StatusType.Paralyzed }));
    const player = result.state.pokemon.get("p1-pikachu")!;
    const dummy = result.state.pokemon.get("p2-machop")!;

    expect(player.statusEffects).toEqual([{ type: StatusType.Burned, remainingTurns: null }]);
    expect(dummy.statusEffects).toEqual([{ type: StatusType.Paralyzed, remainingTurns: null }]);
  });

  it("applies sleep with remaining turns", () => {
    const result = createSandboxBattle(defaultSandboxConfig({ status: StatusType.Asleep }));
    const player = result.state.pokemon.get("p1-pikachu")!;

    expect(player.statusEffects).toEqual([{ type: StatusType.Asleep, remainingTurns: 3 }]);
  });

  it("applies stat stages", () => {
    const result = createSandboxBattle(
      defaultSandboxConfig({
        statStages: { [StatName.Attack]: 2, [StatName.Defense]: -1 },
        dummyStatStages: { [StatName.Speed]: -3 },
      }),
    );
    const player = result.state.pokemon.get("p1-pikachu")!;
    const dummy = result.state.pokemon.get("p2-machop")!;

    expect(player.statStages[StatName.Attack]).toBe(2);
    expect(player.statStages[StatName.Defense]).toBe(-1);
    expect(player.statStages[StatName.Speed]).toBe(0);
    expect(dummy.statStages[StatName.Speed]).toBe(-3);
  });

  it("returns a functional BattleEngine", () => {
    const result = createSandboxBattle(defaultSandboxConfig());
    const actions = result.engine.getLegalActions(PlayerId.Player1);

    expect(actions.length).toBeGreaterThan(0);
  });
});
