import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { SPITE_CT_PENALTY } from "../handlers/handle-spite-ct-tax";

describe("spite (Dépit)", () => {
  it("posts a one-shot CT penalty on the target", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["spite"],
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
    });
    const { engine, state } = buildMoveTestEngine([attacker, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "spite",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.SpiteApplied)).toBe(true);
    expect(state.pokemon.get("target")?.pendingCtPenalty).toBe(SPITE_CT_PENALTY);
  });

  it("is blocked by Substitute", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["spite"],
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      substituteHp: 25,
    });
    const { engine, state } = buildMoveTestEngine([attacker, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "spite",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.some((e) => e.type === BattleEventType.SpiteFailed)).toBe(true);
    expect(state.pokemon.get("target")?.pendingCtPenalty).toBeUndefined();
  });

  it("consumes the penalty on the target's next completed action", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle"],
      pendingCtPenalty: SPITE_CT_PENALTY,
    });
    const other = MockPokemon.fresh(MockPokemon.base, {
      id: "other",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      moveIds: ["tackle"],
    });
    const { engine, state } = buildMoveTestEngine([target, other], { activePokemonId: "target" });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "target",
      direction: Direction.South,
    });

    expect(state.pokemon.get("target")?.pendingCtPenalty).toBeUndefined();
  });
});
