import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("poison-fang", () => {
  it("deals damage to adjacent target", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["poison-fang"],
      currentPp: { "poison-fang": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const hpBefore = defender.currentHp;
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    vi.spyOn(Math, "random").mockReturnValue(0.9);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "poison-fang",
      targetPosition: { x: 1, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(defender.id)?.currentHp).toBeLessThan(hpBefore);
  });

  it("applies BadlyPoisoned when random favors it", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["poison-fang"],
      currentPp: { "poison-fang": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    vi.spyOn(Math, "random").mockReturnValue(0);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "poison-fang",
      targetPosition: { x: 1, y: 0 },
    });

    vi.restoreAllMocks();

    expect(state.pokemon.get(defender.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.BadlyPoisoned }),
    );
  });

  it("does not apply BadlyPoisoned when random is at or above 0.5", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["poison-fang"],
      currentPp: { "poison-fang": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    vi.spyOn(Math, "random").mockReturnValue(0.5);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "poison-fang",
      targetPosition: { x: 1, y: 0 },
    });

    vi.restoreAllMocks();

    expect(
      state.pokemon
        .get(defender.id)
        ?.statusEffects.some((s) => s.type === StatusType.BadlyPoisoned),
    ).toBe(false);
  });

  it("cannot hit target at range 2", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["poison-fang"],
      currentPp: { "poison-fang": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "poison-fang",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(false);
  });
});
