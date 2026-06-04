import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { PokemonInstance } from "../../types/pokemon-instance";
import { createPrng } from "../../utils/prng";

const ATTACKER_STATS = {
  hp: 120,
  attack: 20,
  defense: 200,
  spAttack: 20,
  spDefense: 50,
  speed: 50,
};

function bodyPressDamage(
  attackerStats: typeof ATTACKER_STATS,
  attackerStages?: Partial<Record<StatName, number>>,
  attackerExtra?: Partial<PokemonInstance>,
): number {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["body-press"],
    currentPp: { "body-press": 10 },
    combatStats: attackerStats,
    statStages: { ...MockPokemon.base.statStages, ...attackerStages },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
    ...attackerExtra,
  });
  const defender = MockPokemon.fresh(MockPokemon.charmander, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    maxHp: 500,
    currentHp: 500,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine, state } = buildMoveTestEngine([attacker, defender], { random: createPrng(0) });
  const hpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;
  engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: attacker.id,
    moveId: "body-press",
    targetPosition: { x: 1, y: 0 },
  });
  return hpBefore - (state.pokemon.get(defender.id)?.currentHp ?? 0);
}

describe("body-press", () => {
  it("deals damage to an adjacent target", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["body-press"],
      currentPp: { "body-press": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);
    const hpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "body-press",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(defender.id)?.currentHp).toBeLessThan(hpBefore);
  });

  it("cannot hit a target out of range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["body-press"],
      currentPp: { "body-press": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "body-press",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(false);
  });

  it("scales damage with the user's Defense, not its Attack", () => {
    const highDefense = bodyPressDamage(ATTACKER_STATS);
    const highAttack = bodyPressDamage({ ...ATTACKER_STATS, attack: 200, defense: 20 });

    expect(highDefense).toBeGreaterThan(highAttack);
  });

  it("increases damage when the user's Defense is raised", () => {
    const baseline = bodyPressDamage(ATTACKER_STATS);
    const boosted = bodyPressDamage(ATTACKER_STATS, { [StatName.Defense]: 2 });

    expect(boosted).toBeGreaterThan(baseline);
  });

  it("ignores the user's Attack stat stages", () => {
    const baseline = bodyPressDamage(ATTACKER_STATS);
    const attackBoosted = bodyPressDamage(ATTACKER_STATS, { [StatName.Attack]: 6 });

    expect(attackBoosted).toBe(baseline);
  });

  it("is not boosted by Guts (the user's Attack is unused)", () => {
    const gutsHealthy = bodyPressDamage(ATTACKER_STATS, undefined, { abilityId: "guts" });
    const gutsBurned = bodyPressDamage(ATTACKER_STATS, undefined, {
      abilityId: "guts",
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
    });

    expect(gutsBurned).toBe(gutsHealthy);
  });
});
