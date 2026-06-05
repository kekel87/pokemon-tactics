import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { createPrng } from "../../utils/prng";

const BASE_STATS = {
  hp: 200,
  attack: 50,
  defense: 50,
  spAttack: 50,
  spDefense: 50,
  speed: 50,
};

function psystrikeDamage(defenderStats: typeof BASE_STATS): number {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["psystrike"],
    currentPp: { psystrike: 10 },
    combatStats: { hp: 100, attack: 50, defense: 50, spAttack: 130, spDefense: 50, speed: 50 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 2, y: 0 },
    maxHp: defenderStats.hp,
    currentHp: defenderStats.hp,
    combatStats: defenderStats,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine, state } = buildMoveTestEngine([attacker, defender], { random: createPrng(0) });
  const hpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;
  engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: attacker.id,
    moveId: "psystrike",
    targetPosition: { x: 2, y: 0 },
  });
  return hpBefore - (state.pokemon.get(defender.id)?.currentHp ?? 0);
}

describe("psystrike", () => {
  it("deals damage to a target within range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["psystrike"],
      currentPp: { psystrike: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);
    const hpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "psystrike",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(defender.id)?.currentHp).toBeLessThan(hpBefore);
  });

  it("cannot hit a target beyond max range of 4", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["psystrike"],
      currentPp: { psystrike: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "psystrike",
      targetPosition: { x: 5, y: 0 },
    });

    expect(result.success).toBe(false);
  });

  it("deals less damage to a high-Defense target despite low SpDef (uses physical defense)", () => {
    const highDefLowSpDef = psystrikeDamage({ ...BASE_STATS, defense: 200, spDefense: 30 });
    const lowDefHighSpDef = psystrikeDamage({ ...BASE_STATS, defense: 30, spDefense: 200 });

    expect(highDefLowSpDef).toBeLessThan(lowDefHighSpDef);
  });

  it("is unaffected by raising only the target's SpDef", () => {
    const baseline = psystrikeDamage(BASE_STATS);
    const highSpDefOnly = psystrikeDamage({ ...BASE_STATS, spDefense: 200 });

    expect(highSpDefOnly).toBe(baseline);
  });
});
