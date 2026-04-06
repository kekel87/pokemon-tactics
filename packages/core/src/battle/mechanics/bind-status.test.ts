import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("trapped status", () => {
  it("prevents the trapped target from moving", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const source = MockPokemon.fresh(MockPokemon.base, {
      id: "source",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["wrap"],
      currentPp: { wrap: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const { engine, state } = buildMoveTestEngine([source, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: source.id,
      moveId: "wrap",
      targetPosition: { x: 1, y: 0 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: source.id,
      direction: Direction.East,
    });

    expect(
      state.pokemon.get(target.id)?.volatileStatuses.some((v) => v.type === StatusType.Trapped),
    ).toBe(true);
    const legalActions = engine.getLegalActions(PlayerId.Player2);
    expect(legalActions.filter((a) => a.kind === ActionKind.Move)).toHaveLength(0);

    vi.restoreAllMocks();
  });

  it("does not prevent the trapped target from attacking", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const source = MockPokemon.fresh(MockPokemon.base, {
      id: "source",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["wrap"],
      currentPp: { wrap: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const { engine } = buildMoveTestEngine([source, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: source.id,
      moveId: "wrap",
      targetPosition: { x: 1, y: 0 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: source.id,
      direction: Direction.East,
    });

    const legalActions = engine.getLegalActions(PlayerId.Player2);
    expect(legalActions.filter((a) => a.kind === ActionKind.UseMove).length).toBeGreaterThan(0);

    vi.restoreAllMocks();
  });

  it("deals damage per turn to the trapped target", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const source = MockPokemon.fresh(MockPokemon.base, {
      id: "source",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["wrap"],
      currentPp: { wrap: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 100,
      maxHp: 100,
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const { engine, state } = buildMoveTestEngine([source, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: source.id,
      moveId: "wrap",
      targetPosition: { x: 1, y: 0 },
    });

    const hpAfterHit = state.pokemon.get(target.id)?.currentHp;
    const sourceHpAfterHit = state.pokemon.get(source.id)?.currentHp;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: source.id,
      direction: Direction.East,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: target.id,
      direction: Direction.West,
    });

    const hpAfterTick = state.pokemon.get(target.id)?.currentHp;
    const expectedDamage = Math.max(1, Math.floor(100 * 0.125));

    expect(hpAfterHit - hpAfterTick).toBe(expectedDamage);
    expect(state.pokemon.get(source.id)?.currentHp).toBe(sourceHpAfterHit);

    vi.restoreAllMocks();
  });

  it("expires after duration runs out", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const source = MockPokemon.fresh(MockPokemon.base, {
      id: "source",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["wrap"],
      currentPp: { wrap: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 200,
      maxHp: 200,
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const { engine, state } = buildMoveTestEngine([source, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: source.id,
      moveId: "wrap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(
      state.pokemon.get(target.id)?.volatileStatuses.some((v) => v.type === StatusType.Trapped),
    ).toBe(true);

    for (let turn = 0; turn < 5; turn++) {
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: source.id,
        direction: Direction.East,
      });
      if (state.pokemon.get(target.id)?.currentHp <= 0) {
        break;
      }
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: target.id,
        direction: Direction.West,
      });
    }

    expect(
      state.pokemon.get(target.id)?.volatileStatuses.some((v) => v.type === StatusType.Trapped),
    ).toBe(false);

    vi.restoreAllMocks();
  });

  it("is freed by knockback", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const source = MockPokemon.fresh(MockPokemon.base, {
      id: "source",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["wrap"],
      currentPp: { wrap: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const knocker = MockPokemon.fresh(MockPokemon.base, {
      id: "knocker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 1 },
      orientation: Direction.East,
      moveIds: ["dragon-tail"],
      currentPp: { "dragon-tail": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([source, knocker, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: source.id,
      moveId: "wrap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(
      state.pokemon.get(target.id)?.volatileStatuses.some((v) => v.type === StatusType.Trapped),
    ).toBe(true);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: source.id,
      direction: Direction.East,
    });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: knocker.id,
      moveId: "dragon-tail",
      targetPosition: { x: 1, y: 0 },
    });

    expect(
      state.pokemon.get(target.id)?.volatileStatuses.some((v) => v.type === StatusType.Trapped),
    ).toBe(false);

    vi.restoreAllMocks();
  });
});
