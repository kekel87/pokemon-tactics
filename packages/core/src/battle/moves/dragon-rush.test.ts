import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("dragon-rush", () => {
  it("deals damage and knocks back target by 1 tile", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["dragon-rush"],
      currentPp: { "dragon-rush": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);
    const hpBefore = state.pokemon.get("target")?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "dragon-rush",
      targetPosition: { x: 3, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.KnockbackApplied);
    expect(state.pokemon.get("target")?.currentHp).toBeLessThan(hpBefore);
    expect(state.pokemon.get("target")?.position).toEqual({ x: 4, y: 0 });
  });

  it("applies flinch with 20% chance when random favors it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["dragon-rush"],
      currentPp: { "dragon-rush": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "dragon-rush",
      targetPosition: { x: 3, y: 0 },
    });

    vi.restoreAllMocks();

    expect(
      state.pokemon.get("target")?.volatileStatuses.some((v) => v.type === StatusType.Flinch),
    ).toBe(true);
  });

  it("does not apply flinch when chance roll fails", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["dragon-rush"],
      currentPp: { "dragon-rush": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "dragon-rush",
      targetPosition: { x: 3, y: 0 },
    });

    vi.restoreAllMocks();

    expect(
      state.pokemon.get("target")?.volatileStatuses.some((v) => v.type === StatusType.Flinch),
    ).toBe(false);
  });

  it("repositions caster without damage when dashing into empty space", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["dragon-rush"],
      currentPp: { "dragon-rush": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "dragon-rush",
      targetPosition: { x: 2, y: 5 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("caster")?.position).toEqual({ x: 2, y: 5 });
  });

  it("does not consume hasMoved after dashing", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["dragon-rush"],
      currentPp: { "dragon-rush": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([caster, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "dragon-rush",
      targetPosition: { x: 2, y: 5 },
    });

    vi.restoreAllMocks();

    const moveResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "caster",
      path: [{ x: 2, y: 4 }],
    });

    expect(moveResult.success).toBe(true);
  });
});
