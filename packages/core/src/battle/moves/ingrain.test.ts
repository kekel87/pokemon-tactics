import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { PokemonType } from "../../enums/pokemon-type";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { isEffectivelyFlying } from "../effective-flying";

describe("ingrain", () => {
  it("applies Ingrain volatile on self", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["ingrain"],
      currentPp: { ingrain: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "ingrain",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    const pokemon = state.pokemon.get(user.id)!;
    expect(pokemon.volatileStatuses.some((v) => v.type === StatusType.Ingrain)).toBe(true);
  });

  it("heals 1/8 maxHp on end-turn when the mon did not move", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["ingrain"],
      currentPp: { ingrain: 20 },
      currentHp: 80,
      maxHp: 160,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "ingrain",
      targetPosition: { x: 0, y: 0 },
    });

    // End user's turn (did not move)
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: user.id,
      direction: Direction.South,
    });

    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HpRestored);
    // 1/8 of 160 = 20
    expect(state.pokemon.get(user.id)?.currentHp).toBe(100);
  });

  it("does not tick when the mon moved this turn", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["ingrain"],
      currentPp: { ingrain: 20 },
      currentHp: 80,
      maxHp: 160,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "ingrain",
      targetPosition: { x: 0, y: 0 },
    });

    // Simulate movement by setting the flag directly on state
    const userPokemon = state.pokemon.get(user.id)!;
    userPokemon.movedThisTurn = true;
    const hpBeforeEndTurn = userPokemon.currentHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: user.id,
      direction: Direction.South,
    });

    // No heal tick expected because movedThisTurn was true
    const healEvents = result.events.filter((e) => e.type === BattleEventType.HpRestored);
    expect(healEvents).toHaveLength(0);
    expect(state.pokemon.get(user.id)?.currentHp).toBe(hpBeforeEndTurn);
  });

  it("is uprooted (volatile removed, no heal) when the mon moved", () => {
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["ingrain"],
      currentPp: { ingrain: 20 },
      currentHp: 80,
      maxHp: 160,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([user, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "ingrain",
      targetPosition: { x: 0, y: 0 },
    });

    state.pokemon.get(user.id)!.movedThisTurn = true;
    const hpBeforeEndTurn = state.pokemon.get(user.id)!.currentHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: user.id,
      direction: Direction.South,
    });

    const pokemon = state.pokemon.get(user.id)!;
    expect(pokemon.volatileStatuses.some((v) => v.type === StatusType.Ingrain)).toBe(false);
    expect(pokemon.currentHp).toBe(hpBeforeEndTurn);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.StatusRemoved && e.status === StatusType.Ingrain,
      ),
    ).toBe(true);
  });

  it("grounds a Flying-type: isEffectivelyFlying is false while Ingrain is active, true without", () => {
    const flyingTypes = [PokemonType.Normal, PokemonType.Flying];
    const rooted = MockPokemon.fresh(MockPokemon.base, {
      id: "rooted",
      playerId: PlayerId.Player1,
      volatileStatuses: [{ type: StatusType.Ingrain, remainingTurns: 1 }],
    });
    const airborne = MockPokemon.fresh(MockPokemon.base, {
      id: "airborne",
      playerId: PlayerId.Player1,
      volatileStatuses: [],
    });

    expect(isEffectivelyFlying(rooted, flyingTypes)).toBe(false);
    expect(isEffectivelyFlying(airborne, flyingTypes)).toBe(true);
  });
});
