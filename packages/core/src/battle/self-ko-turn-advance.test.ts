import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { PlayerId } from "../enums/player-id";
import { MockBattle, MockMove, MockPokemon } from "../testing";
import type { MoveDefinition } from "../types/move-definition";
import { BattleEngine } from "./BattleEngine";

const fresh = MockPokemon.fresh;

describe("BattleEngine.submitAction — self-KO advances the turn immediately", () => {
  const registry = new Map<string, MoveDefinition>([[MockMove.selfKo.id, MockMove.selfKo]]);

  const actor = fresh(MockBattle.player1Fast, {
    id: "sacrifice",
    position: { x: 0, y: 0 },
    moveIds: [MockMove.selfKo.id],
    currentPp: { [MockMove.selfKo.id]: MockMove.selfKo.pp },
  });
  const ally = fresh(MockBattle.player1Medium, { id: "ally", position: { x: 2, y: 0 } });
  const enemy = fresh(MockBattle.player2Slow, { id: "enemy" });

  it("leaves the self-KO'd actor fainted and no longer active", () => {
    const state = MockBattle.stateFrom([actor, ally, enemy]);
    const engine = new BattleEngine(state, registry);
    engine.pinActiveForTest("sacrifice");

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "sacrifice",
      moveId: MockMove.selfKo.id,
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("sacrifice")?.currentHp).toBe(0);
    expect(state.activePokemonId).not.toBe("sacrifice");
  });

  it("never offers the fainted actor a follow-up Move or UseMove action", () => {
    const state = MockBattle.stateFrom([actor, ally, enemy]);
    const engine = new BattleEngine(state, registry);
    engine.pinActiveForTest("sacrifice");

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "sacrifice",
      moveId: MockMove.selfKo.id,
      targetPosition: { x: 0, y: 0 },
    });

    const corpseActions = engine
      .getLegalActions(PlayerId.Player1)
      .filter(
        (action) =>
          (action.kind === ActionKind.Move || action.kind === ActionKind.UseMove) &&
          action.pokemonId === "sacrifice",
      );

    expect(corpseActions).toEqual([]);
  });
});
