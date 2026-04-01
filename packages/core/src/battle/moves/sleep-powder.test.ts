import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { MockPokemon, buildMoveTestEngine } from "../../testing";

describe("sleep-powder", () => {
  it("applies sleep to adjacent target when random favors it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "sleep-powder",
      targetPosition: caster.position,
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.StatusApplied);
    expect(state.pokemon.get(target.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Asleep }),
    );

    vi.restoreAllMocks();
  });

  it("does not affect target outside zone radius 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const farTarget = MockPokemon.fresh(MockPokemon.charmander, {
      id: "far-target",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, farTarget]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "sleep-powder",
      targetPosition: caster.position,
    });

    expect(state.pokemon.get(farTarget.id)?.statusEffects).toHaveLength(0);

    vi.restoreAllMocks();
  });
});
