import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { PokemonType } from "../../enums/pokemon-type";
import { StatName } from "../../enums/stat-name";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup(casterTypes: PokemonType[]) {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["curse"],
    currentPp: { curse: 5 },
    currentHp: 100,
    maxHp: 100,
    typeOverride: casterTypes,
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([caster, foe]);
}

describe("curse", () => {
  it("Ghost caster sacrifices 50% HP and posts a Cursed DoT on the enemy", () => {
    const { engine, state } = setup([PokemonType.Ghost]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "curse",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.Cursed);
    expect(state.pokemon.get("caster")?.currentHp).toBe(50);
    const foe = state.pokemon.get("foe");
    expect(foe?.volatileStatuses.some((volatile) => volatile.type === StatusType.Cursed)).toBe(
      true,
    );
  });

  it("non-Ghost caster buffs itself (-1 Spe / +1 Atk / +1 Def) with no HP cost", () => {
    const { engine, state } = setup([PokemonType.Normal]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "curse",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    const caster = state.pokemon.get("caster");
    expect(caster?.currentHp).toBe(100);
    expect(caster?.statStages[StatName.Speed]).toBe(-1);
    expect(caster?.statStages[StatName.Attack]).toBe(1);
    expect(caster?.statStages[StatName.Defense]).toBe(1);
  });
});
