import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("supersonic", () => {
  function makeCaster() {
    return MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["supersonic"],
      currentPp: { supersonic: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
  }

  function makeTarget(position = { x: 2, y: 0 }) {
    return MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
  }

  it("applies confusion to target in range", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = makeCaster();
    const target = makeTarget();
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "supersonic",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.StatusApplied);
    const targetPokemon = state.pokemon.get(target.id)!;
    expect(targetPokemon.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Confused }),
    );
    expect(targetPokemon.volatileStatuses[0]!.remainingTurns).toBeGreaterThanOrEqual(1);
    expect(targetPokemon.volatileStatuses[0]!.remainingTurns).toBeLessThanOrEqual(4);
    vi.restoreAllMocks();
  });

  it("applies confusion at range 3", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = makeCaster();
    const target = makeTarget({ x: 3, y: 0 });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "supersonic",
      targetPosition: { x: 3, y: 0 },
    });

    expect(state.pokemon.get(target.id)!.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Confused }),
    );
    vi.restoreAllMocks();
  });

  it("does not apply confusion if target already confused", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = makeCaster();
    const target = makeTarget();
    target.volatileStatuses = [{ type: StatusType.Confused, remainingTurns: 3 }];
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "supersonic",
      targetPosition: { x: 2, y: 0 },
    });

    expect(state.pokemon.get(target.id)!.volatileStatuses).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it("confusion coexists with a major status", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = makeCaster();
    const target = makeTarget();
    target.statusEffects = [{ type: StatusType.Burned, remainingTurns: null }];
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "supersonic",
      targetPosition: { x: 2, y: 0 },
    });

    const targetPokemon = state.pokemon.get(target.id)!;
    expect(targetPokemon.statusEffects).toHaveLength(1);
    expect(targetPokemon.statusEffects[0]!.type).toBe(StatusType.Burned);
    expect(targetPokemon.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Confused }),
    );
    vi.restoreAllMocks();
  });
});
