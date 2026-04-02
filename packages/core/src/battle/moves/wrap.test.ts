import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("wrap", () => {
  it("deals damage and creates a Bind link on adjacent target", () => {
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
    const hpBefore = state.pokemon.get(target.id)!.currentHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "wrap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.LinkCreated);
    expect(state.pokemon.get(target.id)!.currentHp).toBeLessThan(hpBefore);
    expect(state.activeLinks).toHaveLength(1);
    expect(state.activeLinks[0]).toMatchObject({
      sourceId: caster.id,
      targetId: target.id,
      immobilize: true,
    });
    vi.restoreAllMocks();
  });

  it("deals 1/16 max HP per turn to the bound target (no heal to source)", () => {
    // Given: source uses Wrap on adjacent target
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
    const sourceHpBefore = state.pokemon.get(caster.id)!.currentHp;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "wrap",
      targetPosition: { x: 1, y: 0 },
    });

    const hpAfterHit = state.pokemon.get(target.id)!.currentHp;

    // When: a full round passes (both end turn)
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

    // Then: target loses 1/16 max HP from bind tick, source does NOT heal
    const hpAfterTick = state.pokemon.get(target.id)!.currentHp;
    const expectedDrain = Math.max(1, Math.floor(100 / 16)); // 6
    expect(hpAfterHit - hpAfterTick).toBe(expectedDrain);
    expect(state.pokemon.get(caster.id)!.currentHp).toBe(sourceHpBefore);

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
