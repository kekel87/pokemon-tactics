import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("wrap", () => {
  it("deals damage and applies Trapped status on adjacent target", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
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
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);
    const hpBefore = state.pokemon.get(target.id)?.currentHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "wrap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.StatusApplied);
    expect(state.pokemon.get(target.id)?.currentHp).toBeLessThan(hpBefore);

    const trapped = state.pokemon
      .get(target.id)
      ?.volatileStatuses.find((v) => v.type === StatusType.Trapped);
    expect(trapped).toBeDefined();
    expect(trapped?.damagePerTurn).toBe(0.125);

    vi.restoreAllMocks();
  });

  it("immobilizes the trapped target (no Move actions)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
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
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "wrap",
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
    const moveActions = legalActions.filter((a) => a.kind === ActionKind.Move);
    const attackActions = legalActions.filter((a) => a.kind === ActionKind.UseMove);

    expect(moveActions).toHaveLength(0);
    expect(attackActions.length).toBeGreaterThan(0);

    vi.restoreAllMocks();
  });

  it("deals 1/8 max HP per turn to the trapped target", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
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
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "wrap",
      targetPosition: { x: 1, y: 0 },
    });

    const hpAfterHit = state.pokemon.get(target.id)?.currentHp;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: caster.id,
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

    vi.restoreAllMocks();
  });

  it("cannot hit target at range 2", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
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
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "wrap",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });
});
