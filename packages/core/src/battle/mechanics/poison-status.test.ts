import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";

describe("poison status", () => {
  it("deals 1/8 max HP tick damage at start of turn", () => {
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
      statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }],
    });

    const { engine, state } = buildMoveTestEngine([charmander, bulbasaur]);
    const pokemon = state.pokemon.get("bulbasaur-1")!;
    const hpBefore = pokemon.currentHp;
    const expectedDamage = Math.max(1, Math.floor(pokemon.maxHp / 8));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "charmander-1",
      direction: Direction.South,
    });

    expect(pokemon.currentHp).toBe(hpBefore - expectedDamage);
  });

  it("kills when HP is low enough", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
      currentHp: 1,
      statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }],
    });

    const { engine } = buildMoveTestEngine([charmander, bulbasaur]);
    const allEvents: BattleEvent[] = [];
    engine.on(BattleEventType.BattleEnded, (e) => allEvents.push(e));
    engine.on(BattleEventType.PokemonKo, (e) => allEvents.push(e));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "charmander-1",
      direction: Direction.South,
    });

    expect(allEvents.some((e) => e.type === BattleEventType.PokemonKo)).toBe(true);
    expect(allEvents.some((e) => e.type === BattleEventType.BattleEnded)).toBe(true);

    const battleEnded = allEvents.find(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.BattleEnded }> =>
        e.type === BattleEventType.BattleEnded,
    );
    expect(battleEnded?.winnerId).toBe(PlayerId.Player1);

    vi.restoreAllMocks();
  });
});
