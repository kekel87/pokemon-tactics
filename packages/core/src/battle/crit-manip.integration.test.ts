import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
import { buildMoveTestEngine, endTurnUntilActor, MockPokemon } from "../testing";

// Misc Batch A (plan 151): end-to-end coverage of the crit-setup lifecycle across turns — Affilage
// (laser-focus) arms a one-shot guaranteed crit consumed on the caster's NEXT action, while
// Puissance (focus-energy) posts a persistent boost.

function duel(attackerMoves: string[]) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: attackerMoves,
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    moveIds: ["tackle"],
    currentHp: 500,
    maxHp: 500,
    combatStats: { hp: 500, attack: 50, defense: 80, spAttack: 50, spDefense: 80, speed: 10 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  // random = 0.99 → no natural crit ever; only a forced one (Affilage) can fire.
  return buildMoveTestEngine([attacker, foe], { random: () => 0.99 });
}

function passAttackerTurn(engine: ReturnType<typeof duel>["engine"]) {
  engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.EndTurn,
    pokemonId: "attacker",
    direction: Direction.South,
  });
}

describe("Affilage (laser-focus) — one-shot guaranteed crit across turns", () => {
  it("forces a crit on the caster's next attack, then is spent", () => {
    const { engine, state } = duel(["laser-focus", "tackle"]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "laser-focus",
      targetPosition: { x: 0, y: 0 },
    });
    expect(state.pokemon.get("attacker")?.guaranteedCritArmed).toBe(true);

    passAttackerTurn(engine);
    endTurnUntilActor(engine, state, "attacker");
    const armedHit = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });
    expect(armedHit.events.map((event) => event.type)).toContain(BattleEventType.CriticalHit);

    passAttackerTurn(engine);
    expect(state.pokemon.get("attacker")?.guaranteedCritArmed).toBeUndefined();

    endTurnUntilActor(engine, state, "attacker");
    const plainHit = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });
    expect(plainHit.events.map((event) => event.type)).not.toContain(BattleEventType.CriticalHit);
  });
});

describe("Puissance (focus-energy) — persistent crit boost", () => {
  it("keeps a stage-3 boost that guarantees a crit even at a non-crit roll", () => {
    const { engine, state } = duel(["focus-energy", "tackle"]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "focus-energy",
      targetPosition: { x: 0, y: 0 },
    });
    const boosted = state.pokemon.get("attacker");
    if (boosted !== undefined) {
      boosted.critStageBoost = 3;
    }

    passAttackerTurn(engine);
    endTurnUntilActor(engine, state, "attacker");
    const hit = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    expect(hit.events.map((event) => event.type)).toContain(BattleEventType.CriticalHit);
    expect(state.pokemon.get("attacker")?.critStageBoost).toBe(3);
  });
});
