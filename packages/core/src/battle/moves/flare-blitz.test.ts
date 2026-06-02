import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("flare-blitz", () => {
  it("hits enemy and repositions caster adjacent to target", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["flare-blitz"],
      currentPp: { "flare-blitz": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);
    const hpBefore = state.pokemon.get(target.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "flare-blitz",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(target.id)?.currentHp).toBeLessThan(hpBefore);
    expect(state.pokemon.get(caster.id)?.position).toEqual({ x: 2, y: 0 });
    vi.restoreAllMocks();
  });

  it("attacker takes recoil damage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const maxHp = 120;
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: maxHp,
      maxHp,
      moveIds: ["flare-blitz"],
      currentPp: { "flare-blitz": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "flare-blitz",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter(
      (e): e is Extract<typeof e, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt,
    );
    const recoilEvent = damageEvents.find((e) => e.targetId === caster.id);
    expect(recoilEvent).toBeDefined();
    expect(state.pokemon.get(caster.id)?.currentHp).toBeLessThan(maxHp);
    vi.restoreAllMocks();
  });

  it("applies burn when proc triggers", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["flare-blitz"],
      currentPp: { "flare-blitz": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "flare-blitz",
      targetPosition: { x: 3, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Burned }),
    );
    vi.restoreAllMocks();
  });

  it("does not consume hasMoved after dashing", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["flare-blitz"],
      currentPp: { "flare-blitz": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "flare-blitz",
      targetPosition: { x: 2, y: 5 },
    });

    expect(state.pokemon.get(caster.id)?.position).toEqual({ x: 2, y: 5 });

    const moveResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: caster.id,
      path: [{ x: 2, y: 4 }],
    });

    expect(moveResult.success).toBe(true);
  });
});
