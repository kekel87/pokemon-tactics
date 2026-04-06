import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("knockback", () => {
  function makeAttacker(overrides?: Partial<Parameters<typeof MockPokemon.fresh>[1]>) {
    return MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      orientation: Direction.East,
      moveIds: ["dragon-tail"],
      currentPp: { "dragon-tail": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      ...overrides,
    });
  }

  function makeFoe(overrides?: Partial<Parameters<typeof MockPokemon.fresh>[1]>) {
    return MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      ...overrides,
    });
  }

  it("pushes target 1 tile in direction opposite to attacker", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = makeAttacker();
    const foe = makeFoe();
    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dragon-tail",
      targetPosition: { x: 3, y: 2 },
    });

    expect(state.pokemon.get(foe.id)?.position).toEqual({ x: 4, y: 2 });
    const _knockbackEvents = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: attacker.id,
      direction: Direction.East,
    });
    vi.restoreAllMocks();
  });

  it("is blocked by grid edge", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = makeAttacker({ position: { x: 4, y: 2 } });
    const foe = makeFoe({ position: { x: 5, y: 2 } });
    const { engine, state } = buildMoveTestEngine([attacker, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dragon-tail",
      targetPosition: { x: 5, y: 2 },
    });

    expect(state.pokemon.get(foe.id)?.position).toEqual({ x: 5, y: 2 });
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.KnockbackBlocked);
    vi.restoreAllMocks();
  });

  it("is blocked by occupied tile", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = makeAttacker();
    const foe = makeFoe();
    const blocker = MockPokemon.fresh(MockPokemon.base, {
      id: "blocker",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foe, blocker]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dragon-tail",
      targetPosition: { x: 3, y: 2 },
    });

    expect(state.pokemon.get(foe.id)?.position).toEqual({ x: 3, y: 2 });
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.KnockbackBlocked);
    vi.restoreAllMocks();
  });

  it("deals damage even when knockback is blocked", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = makeAttacker({ position: { x: 4, y: 2 } });
    const foe = makeFoe({ position: { x: 5, y: 2 } });
    const { engine, state } = buildMoveTestEngine([attacker, foe]);
    const hpBefore = state.pokemon.get(foe.id)?.currentHp;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dragon-tail",
      targetPosition: { x: 5, y: 2 },
    });

    expect(state.pokemon.get(foe.id)?.currentHp).toBeLessThan(hpBefore);
    vi.restoreAllMocks();
  });

  it("pushes multiple targets individually with slash pattern", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = makeAttacker();
    const foeFront = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-front",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const foeDiag = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-diag",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 1 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, foeFront, foeDiag]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dragon-tail",
      targetPosition: { x: 3, y: 2 },
    });

    expect(state.pokemon.get(foeFront.id)?.position).toEqual({ x: 4, y: 2 });
    expect(state.pokemon.get(foeDiag.id)?.position).toEqual({ x: 4, y: 1 });
    vi.restoreAllMocks();
  });
});
