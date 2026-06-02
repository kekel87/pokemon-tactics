import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { createPrng } from "../../utils/prng";

describe("teleport", () => {
  it("relocates caster to target empty tile and emits Teleported, no damage", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["teleport"],
      currentPp: { teleport: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.charmander, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, enemy], {
      gridSize: 8,
      random: createPrng(1),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "teleport",
      targetPosition: { x: 3, y: 3 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.Teleported)).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.DamageDealt)).toBe(false);
    expect(state.pokemon.get("caster")?.position).toEqual({ x: 3, y: 3 });
  });

  it("fails when target tile is occupied by an enemy", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["teleport"],
      currentPp: { teleport: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const blocker = MockPokemon.fresh(MockPokemon.charmander, {
      id: "blocker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([caster, blocker], {
      gridSize: 8,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "teleport",
      targetPosition: { x: 3, y: 3 },
    });

    expect(result.success).toBe(false);
  });
});
