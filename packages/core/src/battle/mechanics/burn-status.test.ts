import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";

describe("burn status", () => {
  it("deals 1/16 max HP tick damage at start of turn", () => {
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });

    const { engine, state } = buildMoveTestEngine([charmander, bulbasaur]);
    const pokemon = state.pokemon.get("charmander-1")!;
    const hpBefore = pokemon.currentHp;
    const expectedDamage = Math.max(1, Math.floor(pokemon.maxHp / 16));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "charmander-1",
      direction: Direction.South,
    });

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "bulbasaur-1",
      direction: Direction.South,
    });

    expect(pokemon.currentHp).toBe(hpBefore - expectedDamage);
  });

  it("halves Physical move damage", () => {
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const target = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const { engine: normalEngine } = buildMoveTestEngine([charmander, target]);
    const normalEstimate = normalEngine.estimateDamage("charmander-1", "scratch", "bulbasaur-1");

    const burnedCharmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
    });
    const target2 = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const { engine: burnEngine } = buildMoveTestEngine([burnedCharmander, target2]);
    const burnedEstimate = burnEngine.estimateDamage("charmander-1", "scratch", "bulbasaur-1");

    expect(normalEstimate).not.toBeNull();
    expect(burnedEstimate).not.toBeNull();
    expect(burnedEstimate!.max).toBeLessThan(normalEstimate!.max);
    expect(burnedEstimate!.max).toBeLessThanOrEqual(Math.ceil(normalEstimate!.max / 2) + 1);
    expect(burnedEstimate!.max).toBeGreaterThanOrEqual(Math.floor(normalEstimate!.max / 2) - 1);
  });

  it("does not halve Special move damage", () => {
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const target = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const { engine: normalEngine } = buildMoveTestEngine([charmander, target]);
    const normalEstimate = normalEngine.estimateDamage("charmander-1", "ember", "bulbasaur-1");

    const burnedCharmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
    });
    const target2 = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const { engine: burnEngine } = buildMoveTestEngine([burnedCharmander, target2]);
    const burnedEstimate = burnEngine.estimateDamage("charmander-1", "ember", "bulbasaur-1");

    expect(normalEstimate).not.toBeNull();
    expect(burnedEstimate).not.toBeNull();
    expect(burnedEstimate!.min).toBe(normalEstimate!.min);
    expect(burnedEstimate!.max).toBe(normalEstimate!.max);
  });
});
