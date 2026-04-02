import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("toxic", () => {
  function makeCaster() {
    return MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["toxic"],
      currentPp: { toxic: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
  }

  function makeTarget(position = { x: 1, y: 0 }) {
    return MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
  }

  it("applies badly_poisoned to target at range 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = makeCaster();
    const target = makeTarget();
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "toxic",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.StatusApplied);
    expect(state.pokemon.get(target.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.BadlyPoisoned }),
    );
    vi.restoreAllMocks();
  });

  it("applies badly_poisoned at range 2", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = makeCaster();
    const target = makeTarget({ x: 2, y: 0 });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "toxic",
      targetPosition: { x: 2, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.BadlyPoisoned }),
    );
    vi.restoreAllMocks();
  });

  it("does not apply to target already with a major status", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = makeCaster();
    const target = makeTarget();
    target.statusEffects = [{ type: StatusType.Burned, remainingTurns: null }];
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "toxic",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.statusEffects).toHaveLength(1);
    expect(state.pokemon.get(target.id)?.statusEffects[0]?.type).toBe(StatusType.Burned);
    vi.restoreAllMocks();
  });

  it("badly_poisoned deals increasing damage over turns", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = makeCaster();
    const target = makeTarget();
    target.currentHp = 160;
    target.maxHp = 160;
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "toxic",
      targetPosition: { x: 1, y: 0 },
    });

    const poisonedTarget = state.pokemon.get(target.id)!;
    expect(poisonedTarget.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.BadlyPoisoned }),
    );
    expect(poisonedTarget.toxicCounter).toBe(0);
    vi.restoreAllMocks();
  });
});
