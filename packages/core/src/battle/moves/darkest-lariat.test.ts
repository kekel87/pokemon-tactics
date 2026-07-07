import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function damageAgainst(defenseStage: number): number {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["darkest-lariat"],
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    currentHp: 400,
    maxHp: 400,
    combatStats: { hp: 400, attack: 50, defense: 100, spAttack: 50, spDefense: 100, speed: 10 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
    statStages: {
      [StatName.Attack]: 0,
      [StatName.Defense]: defenseStage,
      [StatName.SpAttack]: 0,
      [StatName.SpDefense]: 0,
      [StatName.Speed]: 0,
      [StatName.Accuracy]: 0,
      [StatName.Evasion]: 0,
    },
  });
  const { engine } = buildMoveTestEngine([attacker, defender], { random: () => 0.99 });
  const result = engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "attacker",
    moveId: "darkest-lariat",
    targetPosition: { x: 1, y: 0 },
  });
  const damage = result.events.find((event) => event.type === BattleEventType.DamageDealt);
  return damage?.type === BattleEventType.DamageDealt ? damage.amount : 0;
}

describe("darkest-lariat", () => {
  it("ignores the target's defensive stat boosts", () => {
    expect(damageAgainst(2)).toBe(damageAgainst(0));
  });

  it("ignores the target's defensive stat drops too", () => {
    expect(damageAgainst(-2)).toBe(damageAgainst(0));
  });
});
