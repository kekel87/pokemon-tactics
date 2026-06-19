import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, endTurnUntilActor, MockPokemon } from "../../testing";

function makeAlly() {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "ally",
    playerId: PlayerId.Player1,
    position: { x: 1, y: 0 },
    moveIds: ["water-gun"],
    currentPp: { "water-gun": 25 },
    derivedStats: { movement: 3, jump: 1, initiative: 60 },
  });
}

function makeFoe() {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 2, y: 0 },
    currentHp: 400,
    maxHp: 400,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
}

function makeCaster() {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["helping-hand"],
    currentPp: { "helping-hand": 20 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
}

describe("helping-hand", () => {
  it("flags the adjacent ally", () => {
    const { engine, state } = buildMoveTestEngine([makeCaster(), makeAlly(), makeFoe()]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "helping-hand",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.HelpingHandPosted);
    expect(state.pokemon.get("ally")?.helpingHand).toBe(true);
  });

  it("boosts the ally's next offensive move and consumes the buff", () => {
    const buffed = buildMoveTestEngine([makeCaster(), makeAlly(), makeFoe()], {
      random: () => 0.5,
    });
    buffed.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "helping-hand",
      targetPosition: { x: 1, y: 0 },
    });
    endTurnUntilActor(buffed.engine, buffed.state, "ally");
    buffed.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "ally",
      moveId: "water-gun",
      targetPosition: { x: 2, y: 0 },
    });
    const buffedDamage = 400 - (buffed.state.pokemon.get("foe")?.currentHp ?? 0);
    const endTurn = buffed.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "ally",
      direction: Direction.South,
    });

    const plain = buildMoveTestEngine([makeCaster(), makeAlly(), makeFoe()], {
      random: () => 0.5,
    });
    endTurnUntilActor(plain.engine, plain.state, "ally");
    plain.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "ally",
      moveId: "water-gun",
      targetPosition: { x: 2, y: 0 },
    });
    const plainDamage = 400 - (plain.state.pokemon.get("foe")?.currentHp ?? 0);

    expect(buffedDamage).toBeGreaterThan(plainDamage);
    expect(endTurn.events.map((event) => event.type)).toContain(
      BattleEventType.HelpingHandConsumed,
    );
    expect(buffed.state.pokemon.get("ally")?.helpingHand).toBeUndefined();
  });

  it("fails without an adjacent ally to target", () => {
    const { engine, state } = buildMoveTestEngine([makeCaster(), makeFoe()]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "helping-hand",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(state.pokemon.get("foe")?.helpingHand).toBeUndefined();
  });
});
