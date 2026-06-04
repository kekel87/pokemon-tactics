import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { createPrng } from "../../utils/prng";

const DEFENDER_STATS = {
  hp: 200,
  attack: 150,
  defense: 60,
  spAttack: 50,
  spDefense: 60,
  speed: 50,
};

function foulPlayDamage(
  defenderStats: typeof DEFENDER_STATS,
  options: {
    defenderStages?: Partial<Record<StatName, number>>;
    attackerStages?: Partial<Record<StatName, number>>;
  } = {},
): number {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["foul-play"],
    currentPp: { "foul-play": 15 },
    combatStats: { hp: 100, attack: 30, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
    statStages: { ...MockPokemon.base.statStages, ...options.attackerStages },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const defender = MockPokemon.fresh(MockPokemon.charmander, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    maxHp: defenderStats.hp,
    currentHp: defenderStats.hp,
    combatStats: defenderStats,
    statStages: { ...MockPokemon.charmander.statStages, ...options.defenderStages },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine, state } = buildMoveTestEngine([attacker, defender], { random: createPrng(0) });
  const hpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;
  engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: attacker.id,
    moveId: "foul-play",
    targetPosition: { x: 1, y: 0 },
  });
  return hpBefore - (state.pokemon.get(defender.id)?.currentHp ?? 0);
}

describe("foul-play", () => {
  it("deals damage to an adjacent target", () => {
    const damage = foulPlayDamage(DEFENDER_STATS);

    expect(damage).toBeGreaterThan(0);
  });

  it("scales damage with the target's Attack, not the user's", () => {
    const strongTarget = foulPlayDamage(DEFENDER_STATS);
    const weakTarget = foulPlayDamage({ ...DEFENDER_STATS, attack: 20 });

    expect(strongTarget).toBeGreaterThan(weakTarget);
  });

  it("increases damage when the target's Attack is raised", () => {
    const baseline = foulPlayDamage(DEFENDER_STATS);
    const boosted = foulPlayDamage(DEFENDER_STATS, { defenderStages: { [StatName.Attack]: 2 } });

    expect(boosted).toBeGreaterThan(baseline);
  });

  it("ignores the user's Attack stat stages", () => {
    const baseline = foulPlayDamage(DEFENDER_STATS);
    const userBoosted = foulPlayDamage(DEFENDER_STATS, {
      attackerStages: { [StatName.Attack]: 6 },
    });

    expect(userBoosted).toBe(baseline);
  });

  it("is absorbed by the target's Substitute", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["foul-play"],
      currentPp: { "foul-play": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      substituteHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);
    const hpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "foul-play",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get(defender.id)?.currentHp).toBe(hpBefore);
    expect(state.pokemon.get(defender.id)?.substituteHp).toBeLessThan(200);
  });
});
