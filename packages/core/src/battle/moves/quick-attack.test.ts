import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockBattle, MockPokemon } from "../../testing";

describe("quick-attack", () => {
  it("hits enemy at distance 2 and repositions caster adjacent to target", () => {
    const caster = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 4, jump: 2, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const hpBefore = target.currentHp;
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "quick-attack",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(target.id)?.currentHp).toBeLessThan(hpBefore);
    expect(state.pokemon.get(caster.id)?.position).toEqual({ x: 1, y: 0 });
  });

  it("repositions caster without damage when dashing into empty space", () => {
    const caster = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 4, jump: 2, initiative: 100 },
    });
    const distant = MockPokemon.fresh(MockPokemon.base, {
      id: "distant",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, distant]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "quick-attack",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(caster.id)?.position).toEqual({ x: 2, y: 0 });
  });

  it("does not consume hasMoved so caster can move after dashing", () => {
    const caster = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 4, jump: 2, initiative: 100 },
    });
    const distant = MockPokemon.fresh(MockPokemon.base, {
      id: "distant",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([caster, distant]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "quick-attack",
      targetPosition: { x: 2, y: 0 },
    });

    const moveResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: caster.id,
      path: [{ x: 3, y: 0 }],
    });

    expect(moveResult.success).toBe(true);
  });

  it("emits EndTurn direction correctly", () => {
    const caster = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 4, jump: 2, initiative: 100 },
    });
    const distant = MockPokemon.fresh(MockPokemon.base, {
      id: "distant",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([caster, distant]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "quick-attack",
      targetPosition: { x: 2, y: 0 },
    });

    const endResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: caster.id,
      direction: Direction.South,
    });

    expect(endResult.success).toBe(true);
  });

  it("stops on a wall (height 2) and receives fall damage from the impact", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      definitionId: "non-flying",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 30 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const distant = MockPokemon.fresh(MockPokemon.base, {
      id: "distant",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([caster, distant]);
    MockBattle.setTile(state, 2, 0, { height: 2 });
    const hpBefore = state.pokemon.get(caster.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "quick-attack",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.WallImpactDealt);
    expect(state.pokemon.get(caster.id)?.position).toEqual({ x: 1, y: 0 });
    expect(state.pokemon.get(caster.id)?.currentHp).toBeLessThan(hpBefore);
  });

  it("lists the wall tile as a legal dash target (getLegalActions does not filter dash by melee height)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      definitionId: "non-flying",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["quick-attack"],
      currentPp: { "quick-attack": 30 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const distant = MockPokemon.fresh(MockPokemon.base, {
      id: "distant",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([caster, distant]);
    MockBattle.setTile(state, 2, 0, { height: 3 });

    const legalActions = engine.getLegalActions(PlayerId.Player1);
    const wallTargetAction = legalActions.find(
      (a) =>
        a.kind === ActionKind.UseMove &&
        a.moveId === "quick-attack" &&
        a.targetPosition.x === 2 &&
        a.targetPosition.y === 0,
    );
    expect(wallTargetAction).toBeDefined();
  });
});
