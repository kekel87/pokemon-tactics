import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("magnetic-flux", () => {
  it("is a no-op when no ally in radius carries Plus or Minus", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["magnetic-flux"],
      currentPp: { "magnetic-flux": 10 },
      abilityId: "pressure",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      abilityId: "soundproof",
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "magnetic-flux",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get(caster.id)?.statStages[StatName.Defense]).toBe(0);
    expect(state.pokemon.get(caster.id)?.statStages[StatName.SpDefense]).toBe(0);
    expect(state.pokemon.get(ally.id)?.statStages[StatName.Defense]).toBe(0);
    expect(state.pokemon.get(ally.id)?.statStages[StatName.SpDefense]).toBe(0);
  });

  it("raises Def and Sp.Def by 1 only for allies in radius carrying Plus/Minus (gate infra ready)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["magnetic-flux"],
      currentPp: { "magnetic-flux": 10 },
      abilityId: "pressure",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const plusAlly = MockPokemon.fresh(MockPokemon.base, {
      id: "plus-ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      abilityId: "plus",
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const { engine, state } = buildMoveTestEngine([caster, plusAlly]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "magnetic-flux",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.pokemon.get(plusAlly.id)?.statStages[StatName.Defense]).toBe(1);
    expect(state.pokemon.get(plusAlly.id)?.statStages[StatName.SpDefense]).toBe(1);
    expect(state.pokemon.get(caster.id)?.statStages[StatName.Defense]).toBe(0);
  });
});
