import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { MockPokemon, buildMoveTestEngine } from "../../testing";

describe("sludge-bomb", () => {
  it("deals damage to target within blast radius 1", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const hpBefore = target.currentHp;
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "sludge-bomb",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(target.id)?.currentHp).toBeLessThan(hpBefore);
  });

  it("applies poison when random favors it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "sludge-bomb",
      targetPosition: { x: 3, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Poisoned }),
    );

    vi.restoreAllMocks();
  });

  it("does not hit target outside blast radius", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const farTarget = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "far-target",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const hpBefore = farTarget.currentHp;
    const { engine, state } = buildMoveTestEngine([caster, target, farTarget]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "sludge-bomb",
      targetPosition: { x: 3, y: 0 },
    });

    expect(state.pokemon.get(farTarget.id)?.currentHp).toBe(hpBefore);
  });
});
