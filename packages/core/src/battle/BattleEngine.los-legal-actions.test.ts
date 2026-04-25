import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { MockBattle } from "../testing/mock-battle";
import { MockMove } from "../testing/mock-move";
import { MockPokemon } from "../testing/mock-pokemon";
import { BattleEngine } from "./BattleEngine";

describe("BattleEngine.getLegalActions — LoS non-regression", () => {
  it("never generates a UseMove through a tall pillar (LoS blocked)", () => {
    const rangedMove = MockMove.fresh(MockMove.special, { id: "ranged-test" });
    const moveRegistry = new Map([["ranged-test", rangedMove]]);
    const pokemonTypesMap = new Map([["test", [PokemonType.Normal]]]);

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "p1",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 2 },
      moveIds: ["ranged-test"],
      currentPp: { "ranged-test": 20 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "p2",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      moveIds: [],
      currentPp: {},
    });
    const state = MockBattle.stateFrom([attacker, enemy], 5, 5);
    MockBattle.setTile(state, 2, 2, { height: 3 });

    const engine = new BattleEngine(state, moveRegistry, undefined, pokemonTypesMap);
    const legalActions = engine.getLegalActions(PlayerId.Player1);

    const attacksThroughPillar = legalActions.filter(
      (a) =>
        a.kind === ActionKind.UseMove && a.targetPosition?.x === 3 && a.targetPosition?.y === 2,
    );
    expect(attacksThroughPillar).toHaveLength(0);
  });

  it("generates UseMove for a sound move even with a tall pillar in the way", () => {
    const soundMove = MockMove.fresh(MockMove.special, {
      id: "sound-test",
      flags: { sound: true },
    });
    const moveRegistry = new Map([["sound-test", soundMove]]);
    const pokemonTypesMap = new Map([["test", [PokemonType.Normal]]]);

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "p1",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 2 },
      moveIds: ["sound-test"],
      currentPp: { "sound-test": 20 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "p2",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      moveIds: [],
      currentPp: {},
    });
    const state = MockBattle.stateFrom([attacker, enemy], 5, 5);
    MockBattle.setTile(state, 2, 2, { height: 3 });

    const engine = new BattleEngine(state, moveRegistry, undefined, pokemonTypesMap);
    const legalActions = engine.getLegalActions(PlayerId.Player1);

    const soundAttacks = legalActions.filter(
      (a) =>
        a.kind === ActionKind.UseMove && a.targetPosition?.x === 3 && a.targetPosition?.y === 2,
    );
    expect(soundAttacks.length).toBeGreaterThan(0);
  });
});
