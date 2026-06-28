import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("mean-look", () => {
  it("applies a position-linked Trapped status with no damage", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["mean-look"],
      currentPp: { "mean-look": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);
    const hpBefore = state.pokemon.get(target.id)?.currentHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "mean-look",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(target.id)?.currentHp).toBe(hpBefore);

    const trapped = state.pokemon
      .get(target.id)
      ?.volatileStatuses.find((v) => v.type === StatusType.Trapped);
    expect(trapped).toBeDefined();
    expect(trapped?.remainingTurns).toBe(-1);
    expect(trapped?.sourceId).toBe(caster.id);
    expect(trapped?.damagePerTurn).toBeUndefined();
  });

  it("immobilizes the trapped target while the caster stays adjacent", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["mean-look"],
      currentPp: { "mean-look": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "mean-look",
      targetPosition: { x: 1, y: 0 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: caster.id,
      direction: Direction.East,
    });

    expect(
      state.pokemon.get(target.id)?.volatileStatuses.some((v) => v.type === StatusType.Trapped),
    ).toBe(true);

    const legalActions = engine.getLegalActions(PlayerId.Player2);
    expect(legalActions.filter((a) => a.kind === ActionKind.Move)).toHaveLength(0);
    expect(legalActions.filter((a) => a.kind === ActionKind.UseMove).length).toBeGreaterThan(0);
  });

  it("releases the target when the caster moves out of adjacency", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["mean-look"],
      currentPp: { "mean-look": 5 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "mean-look",
      targetPosition: { x: 1, y: 0 },
    });

    const moveAction = engine
      .getLegalActions(PlayerId.Player1)
      .find(
        (action) =>
          action.kind === ActionKind.Move &&
          Math.max(
            Math.abs((action.path.at(-1)?.x ?? 0) - 1),
            Math.abs((action.path.at(-1)?.y ?? 0) - 0),
          ) > 1,
      );
    expect(moveAction).toBeDefined();
    if (moveAction?.kind !== ActionKind.Move) {
      throw new Error("expected a Move action");
    }

    engine.submitAction(PlayerId.Player1, moveAction);

    expect(
      state.pokemon.get(target.id)?.volatileStatuses.some((v) => v.type === StatusType.Trapped),
    ).toBe(false);
  });
});
