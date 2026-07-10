import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { PokemonGender } from "../../enums/pokemon-gender";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup(casterGender: PokemonGender, foeGender: PokemonGender) {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["attract"],
    currentPp: { attract: 5 },
    gender: casterGender,
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    gender: foeGender,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([caster, foe]);
}

describe("attract", () => {
  it("infatuates an opposite-gender target", () => {
    const { engine, state } = setup(PokemonGender.Male, PokemonGender.Female);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "attract",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const foe = state.pokemon.get("foe");
    const infatuated = foe?.volatileStatuses.find(
      (volatile) => volatile.type === StatusType.Infatuated,
    );
    expect(infatuated?.sourceId).toBe("caster");
  });

  it("fails on a same-gender target", () => {
    const { engine, state } = setup(PokemonGender.Male, PokemonGender.Male);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "attract",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.map((event) => event.type)).toContain(BattleEventType.MoveFailed);
    expect(
      state.pokemon.get("foe")?.volatileStatuses.some((v) => v.type === StatusType.Infatuated),
    ).toBe(false);
  });
});
