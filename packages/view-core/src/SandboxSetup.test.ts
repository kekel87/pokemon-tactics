import { ActionKind, Direction, PlayerId, StatName, StatusType } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { createSandboxBattle, sandboxInstanceId } from "./SandboxSetup";
import { DEFAULT_SANDBOX_CONFIG, normalizeSandboxConfig } from "./sandbox-config.js";

const PLAYER = sandboxInstanceId(0, 0, "venusaur");
const DUMMY = sandboxInstanceId(1, 0, "dummy");

describe("createSandboxBattle", () => {
  it("creates a battle with team 1 and team 2 on the sandbox arena", () => {
    const result = createSandboxBattle(DEFAULT_SANDBOX_CONFIG);
    const player = result.state.pokemon.get(PLAYER);
    const dummy = result.state.pokemon.get(DUMMY);

    expect(player).toBeDefined();
    expect(dummy).toBeDefined();
    expect(player?.position).toEqual({ x: 3, y: 4 });
    expect(dummy?.position).toEqual({ x: 3, y: 1 });
    expect(player?.playerId).toBe(PlayerId.Player1);
    expect(dummy?.playerId).toBe(PlayerId.Player2);
  });

  it("defaults team orientations and honours an explicit member direction", () => {
    const config = normalizeSandboxConfig({
      teams: [
        { control: "player", members: [{ pokemon: "venusaur" }] },
        { control: "passive", members: [{ pokemon: "dummy", direction: Direction.East }] },
      ],
    });
    const result = createSandboxBattle(config);

    expect(result.state.pokemon.get(PLAYER)?.orientation).toBe(Direction.North);
    expect(result.state.pokemon.get(DUMMY)?.orientation).toBe(Direction.East);
  });

  it("overrides a member's moves when specified", () => {
    const config = normalizeSandboxConfig({
      teams: [
        {
          control: "player",
          members: [{ pokemon: "venusaur", moves: ["razor-leaf", "sleep-powder"] }],
        },
        { control: "passive", members: [{ pokemon: "dummy" }] },
      ],
    });
    const result = createSandboxBattle(config);

    expect(result.state.pokemon.get(PLAYER)?.moveIds).toEqual(["razor-leaf", "sleep-powder"]);
  });

  it("uses the default movepool head when a member has no move override", () => {
    const result = createSandboxBattle(DEFAULT_SANDBOX_CONFIG);

    expect(result.state.pokemon.get(PLAYER)?.moveIds).toEqual([
      "growth",
      "weather-ball",
      "giga-drain",
      "sludge-bomb",
    ]);
  });

  it("applies HP percentage per member", () => {
    const config = normalizeSandboxConfig({
      teams: [
        { control: "player", members: [{ pokemon: "venusaur", hp: 50 }] },
        { control: "passive", members: [{ pokemon: "dummy", hp: 25 }] },
      ],
    });
    const result = createSandboxBattle(config);
    const player = result.state.pokemon.get(PLAYER)!;
    const dummy = result.state.pokemon.get(DUMMY)!;

    expect(player.currentHp).toBe(Math.floor(player.maxHp * 0.5));
    expect(dummy.currentHp).toBe(Math.max(1, Math.floor(dummy.maxHp * 0.25)));
  });

  it("spawns a member with hp 0 fainted (revive-target scenarios)", () => {
    const config = normalizeSandboxConfig({
      teams: [
        {
          control: "player",
          members: [{ pokemon: "venusaur" }, { pokemon: "charizard", hp: 0 }],
        },
        { control: "passive", members: [{ pokemon: "dummy" }] },
      ],
    });
    const result = createSandboxBattle(config);

    expect(result.state.pokemon.get(sandboxInstanceId(0, 1, "charizard"))?.currentHp).toBe(0);
  });

  it("never hands a turn to a member that starts fainted", () => {
    const config = normalizeSandboxConfig({
      seed: 1,
      teams: [
        {
          control: "player",
          members: [{ pokemon: "venusaur" }, { pokemon: "charizard", hp: 0 }],
        },
        { control: "passive", members: [{ pokemon: "dummy" }] },
      ],
    });
    const { engine, state } = createSandboxBattle(config);
    const faintedId = sandboxInstanceId(0, 1, "charizard");

    for (let i = 0; i < 8; i++) {
      expect(state.activePokemonId).not.toBe(faintedId);
      const active = state.pokemon.get(state.activePokemonId);
      const endTurn = active
        ? engine.getLegalActions(active.playerId).find((a) => a.kind === ActionKind.EndTurn)
        : undefined;
      if (!endTurn) {
        break;
      }
      engine.submitAction(active!.playerId, endTurn);
    }
  });

  it("applies status effects per member", () => {
    const config = normalizeSandboxConfig({
      teams: [
        { control: "player", members: [{ pokemon: "venusaur", status: StatusType.Burned }] },
        { control: "passive", members: [{ pokemon: "dummy", status: StatusType.Paralyzed }] },
      ],
    });
    const result = createSandboxBattle(config);

    expect(result.state.pokemon.get(PLAYER)?.statusEffects).toEqual([
      { type: StatusType.Burned, remainingTurns: null },
    ]);
    expect(result.state.pokemon.get(DUMMY)?.statusEffects).toEqual([
      { type: StatusType.Paralyzed, remainingTurns: null },
    ]);
  });

  it("applies sleep with remaining turns", () => {
    const config = normalizeSandboxConfig({
      teams: [
        { control: "player", members: [{ pokemon: "venusaur", status: StatusType.Asleep }] },
        { control: "passive", members: [{ pokemon: "dummy" }] },
      ],
    });
    const result = createSandboxBattle(config);

    expect(result.state.pokemon.get(PLAYER)?.statusEffects).toEqual([
      { type: StatusType.Asleep, remainingTurns: 3 },
    ]);
  });

  it("applies stat stages per member", () => {
    const config = normalizeSandboxConfig({
      teams: [
        {
          control: "player",
          members: [
            { pokemon: "venusaur", statStages: { [StatName.Attack]: 2, [StatName.Defense]: -1 } },
          ],
        },
        {
          control: "passive",
          members: [{ pokemon: "dummy", statStages: { [StatName.Speed]: -3 } }],
        },
      ],
    });
    const result = createSandboxBattle(config);
    const player = result.state.pokemon.get(PLAYER)!;
    const dummy = result.state.pokemon.get(DUMMY)!;

    expect(player.statStages[StatName.Attack]).toBe(2);
    expect(player.statStages[StatName.Defense]).toBe(-1);
    expect(player.statStages[StatName.Speed]).toBe(0);
    expect(dummy.statStages[StatName.Speed]).toBe(-3);
  });

  it("applies ability overrides per member", () => {
    const config = normalizeSandboxConfig({
      teams: [
        { control: "player", members: [{ pokemon: "venusaur", ability: "chlorophyll" }] },
        { control: "passive", members: [{ pokemon: "dummy", ability: "swift-swim" }] },
      ],
    });
    const result = createSandboxBattle(config);

    expect(result.state.pokemon.get(PLAYER)?.abilityId).toBe("chlorophyll");
    expect(result.state.pokemon.get(DUMMY)?.abilityId).toBe("swift-swim");
  });

  it("returns a functional BattleEngine", () => {
    const result = createSandboxBattle(DEFAULT_SANDBOX_CONFIG);
    const activePlayerId = result.state.activePokemonId.startsWith("p1")
      ? PlayerId.Player1
      : PlayerId.Player2;
    const actions = result.engine.getLegalActions(activePlayerId);

    expect(actions.length).toBeGreaterThan(0);
  });

  it("assigns team/member-scoped ids and cascades a second member to a distinct free tile", () => {
    const config = normalizeSandboxConfig({
      teams: [
        { control: "player", members: [{ pokemon: "venusaur" }, { pokemon: "charizard" }] },
        { control: "passive", members: [{ pokemon: "dummy" }] },
      ],
    });
    const result = createSandboxBattle(config);
    const a = result.state.pokemon.get(sandboxInstanceId(0, 0, "venusaur"))?.position;
    const b = result.state.pokemon.get(sandboxInstanceId(0, 1, "charizard"))?.position;

    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(`${a?.x},${a?.y}`).not.toBe(`${b?.x},${b?.y}`);
  });
});
