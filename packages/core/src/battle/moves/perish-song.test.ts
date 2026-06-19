import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, endTurnUntilActor, MockPokemon } from "../../testing";

function makeCaster() {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 4, y: 4 },
    moveIds: ["perish-song"],
    currentPp: { "perish-song": 5 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
}

function detonate(
  engine: ReturnType<typeof buildMoveTestEngine>["engine"],
  state: ReturnType<typeof buildMoveTestEngine>["state"],
): boolean {
  for (let turn = 0; turn < 16; turn += 1) {
    const activeId = state.activePokemonId;
    const player = state.pokemon.get(activeId)?.playerId ?? PlayerId.Player1;
    const result = engine.submitAction(player, {
      kind: ActionKind.EndTurn,
      pokemonId: activeId,
      direction: Direction.South,
    });
    if (result.events.some((event) => event.type === BattleEventType.PerishKo)) {
      return true;
    }
    if (state.pokemon.get("caster") === undefined || state.pokemon.get("caster")?.currentHp === 0) {
      return result.events.some((event) => event.type === BattleEventType.PerishKo);
    }
  }
  return false;
}

describe("perish-song", () => {
  it("posts a mobile death aura on the caster", () => {
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([makeCaster(), foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "perish-song",
      targetPosition: { x: 4, y: 4 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.PerishAuraPosted);
    expect(state.pokemon.get("caster")?.perishAura).toEqual({ turnsRemaining: 3, radius: 2 });
    expect(state.pokemon.get("foe")?.perishAura).toBeUndefined();
  });

  it("detonates after three caster turns, KO'ing everyone inside the radius (caster included)", () => {
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([makeCaster(), foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "perish-song",
      targetPosition: { x: 4, y: 4 },
    });

    expect(detonate(engine, state)).toBe(true);
    expect(state.pokemon.get("caster")?.currentHp).toBe(0);
    expect(state.pokemon.get("foe")?.currentHp).toBe(0);
  });

  it("spares a mon that is outside the radius at detonation", () => {
    const farFoe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 1 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([makeCaster(), farFoe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "perish-song",
      targetPosition: { x: 4, y: 4 },
    });

    detonate(engine, state);

    expect(state.pokemon.get("caster")?.currentHp).toBe(0);
    expect(state.pokemon.get("foe")?.currentHp).toBeGreaterThan(0);
  });

  it("decrements the aura on the caster's turn", () => {
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([makeCaster(), foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "perish-song",
      targetPosition: { x: 4, y: 4 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "caster",
      direction: Direction.South,
    });
    endTurnUntilActor(engine, state, "caster");

    expect(state.pokemon.get("caster")?.perishAura?.turnsRemaining).toBe(2);
  });
});
