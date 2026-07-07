import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
import { buildMoveTestEngine, endTurnUntilActor, MockPokemon } from "../testing";

// Misc Batch B (plan 152): cross-cutting behaviour of Anti-Air (smack-down) grounding — a Flying-type
// target normally immune to Ground moves becomes hittable once smacked down.

function duel(attackerMoves: string[]) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: attackerMoves,
    combatStats: { hp: 100, attack: 120, defense: 55, spAttack: 120, spDefense: 55, speed: 120 },
    derivedStats: { movement: 3, jump: 1, initiative: 200 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    definitionId: "pidgey",
    position: { x: 1, y: 0 },
    currentHp: 300,
    maxHp: 300,
    combatStats: { hp: 300, attack: 40, defense: 40, spAttack: 40, spDefense: 40, speed: 10 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([attacker, foe]);
}

describe("Misc Batch B — grounding integration", () => {
  it("leaves a Flying target immune to Ground before Anti-Air", () => {
    const { engine, state } = duel(["mud-slap"]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "mud-slap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get("foe")?.currentHp).toBe(300);
  });

  it("makes a Flying target take Ground damage after Anti-Air grounds it", () => {
    const { engine, state } = duel(["smack-down", "mud-slap"]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "smack-down",
      targetPosition: { x: 1, y: 0 },
    });
    const hpAfterSmack = state.pokemon.get("foe")?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "attacker",
      direction: Direction.South,
    });
    endTurnUntilActor(engine, state, "attacker");
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "mud-slap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get("foe")?.smackedDown).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBeLessThan(hpAfterSmack);
  });
});
