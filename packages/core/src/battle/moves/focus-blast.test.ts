import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("focus-blast", () => {
  it("deals damage to single target in range 1-4 (when hits)", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["focus-blast"],
      currentPp: { "focus-blast": 100 },
      combatStats: { hp: 100, attack: 50, defense: 50, spAttack: 130, spDefense: 50, speed: 100 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    let hits = 0;
    for (let attempt = 0; attempt < 20 && hits === 0; attempt++) {
      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: attacker.id,
        moveId: "focus-blast",
        targetPosition: { x: 3, y: 0 },
      });
      if (!result.success) {
        break;
      }
      const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
      if (damageEvents.length > 0) {
        hits++;
        break;
      }
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: attacker.id,
        direction: attacker.orientation,
      });
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "defender",
        direction: defender.orientation,
      });
    }

    expect(hits).toBeGreaterThan(0);
    const defenderAfter = state.pokemon.get("defender");
    expect(defenderAfter?.currentHp ?? 9999).toBeLessThan(9999);
  });

  it("can lower target SpDefense with 10% chance secondary", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["focus-blast"],
      currentPp: { "focus-blast": 100 },
      combatStats: { hp: 100, attack: 50, defense: 50, spAttack: 130, spDefense: 50, speed: 100 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender]);

    let secondaryProcs = 0;
    for (let attempt = 0; attempt < 50; attempt++) {
      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: attacker.id,
        moveId: "focus-blast",
        targetPosition: { x: 3, y: 0 },
      });
      if (!result.success) {
        break;
      }
      const statEvent = result.events.find(
        (e) =>
          e.type === BattleEventType.StatChanged &&
          "stat" in e &&
          e.stat === StatName.SpDefense &&
          "stages" in e &&
          e.stages === -1,
      );
      if (statEvent) {
        secondaryProcs++;
        break;
      }
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: attacker.id,
        direction: attacker.orientation,
      });
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "defender",
        direction: defender.orientation,
      });
    }

    expect(secondaryProcs).toBeGreaterThanOrEqual(1);
  });
});
