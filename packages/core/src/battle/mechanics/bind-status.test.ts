import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { LinkType } from "../../enums/link-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";

describe("bind status", () => {
  function makeSource(overrides?: Partial<Parameters<typeof MockPokemon.fresh>[1]>) {
    return MockPokemon.fresh(MockPokemon.base, {
      id: "source",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["wrap"],
      currentPp: { wrap: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      ...overrides,
    });
  }

  function makeTarget(overrides?: Partial<Parameters<typeof MockPokemon.fresh>[1]>) {
    return MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
      ...overrides,
    });
  }

  it("prevents the bound target from moving", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const source = makeSource();
    const target = makeTarget();
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
    const moveActions = legalActions.filter((a) => a.kind === ActionKind.Move);
    expect(moveActions).toHaveLength(0);

    vi.restoreAllMocks();
  });

  it("does not prevent the bound target from attacking", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const source = makeSource();
    const target = makeTarget();
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
    const useMoveActions = legalActions.filter((a) => a.kind === ActionKind.UseMove);
    expect(useMoveActions.length).toBeGreaterThan(0);

    vi.restoreAllMocks();
  });

  it("breaks when source moves beyond distance 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const source = makeSource({ position: { x: 2, y: 2 } });
    const target = makeTarget({ position: { x: 3, y: 2 } });
    const { engine, state } = buildMoveTestEngine([source, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: source.id,
      moveId: "wrap",
      targetPosition: { x: 3, y: 2 },
    });
    expect(state.activeLinks).toHaveLength(1);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: source.id,
      path: [
        { x: 1, y: 2 },
        { x: 0, y: 2 },
      ],
    });
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

    expect(state.activeLinks).toHaveLength(0);

    vi.restoreAllMocks();
  });

  it("breaks when source is KO", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const source = makeSource({ currentHp: 1, maxHp: 100 });
    const target = makeTarget({
      combatStats: { hp: 100, attack: 200, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
    });
    const { engine, state } = buildMoveTestEngine([source, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: source.id,
      moveId: "wrap",
      targetPosition: { x: 1, y: 0 },
    });
    expect(state.activeLinks).toHaveLength(1);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: source.id,
      direction: Direction.East,
    });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: target.id,
      moveId: "scratch",
      targetPosition: { x: 0, y: 0 },
    });

    expect(state.activeLinks).toHaveLength(0);

    vi.restoreAllMocks();
  });

  it("deals 1/16 HP per turn to the bound target", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const source = makeSource();
    const target = makeTarget({ currentHp: 100, maxHp: 100 });
    const { engine, state } = buildMoveTestEngine([source, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: source.id,
      moveId: "wrap",
      targetPosition: { x: 1, y: 0 },
    });

    const hpAfterHit = state.pokemon.get(target.id)!.currentHp;
    const sourceHpAfterHit = state.pokemon.get(source.id)!.currentHp;

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

    const hpAfterTick = state.pokemon.get(target.id)!.currentHp;
    const sourceHpAfterTick = state.pokemon.get(source.id)!.currentHp;
    const expectedDrain = Math.max(1, Math.floor(100 / 16));

    expect(hpAfterHit - hpAfterTick).toBe(expectedDrain);
    expect(sourceHpAfterTick).toBe(sourceHpAfterHit);

    vi.restoreAllMocks();
  });

  it("expires after duration runs out", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const source = makeSource();
    const target = makeTarget();
    const { engine, state } = buildMoveTestEngine([source, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: source.id,
      moveId: "wrap",
      targetPosition: { x: 1, y: 0 },
    });
    expect(state.activeLinks).toHaveLength(1);

    for (let turn = 0; turn < 4; turn++) {
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: source.id,
        direction: Direction.East,
      });
      if (state.pokemon.get(target.id)!.currentHp <= 0) break;
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: target.id,
        direction: Direction.West,
      });
    }

    expect(state.activeLinks).toHaveLength(0);

    vi.restoreAllMocks();
  });
});
