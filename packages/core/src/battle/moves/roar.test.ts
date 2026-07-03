import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockBattle, MockPokemon } from "../../testing";

describe("roar", () => {
  it("ejects enemies caught in the cone back to their spawn zone without dealing damage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["roar"],
      currentPp: { roar: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const near = MockPokemon.fresh(MockPokemon.base, {
      id: "near",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      spawnPosition: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const far = MockPokemon.fresh(MockPokemon.base, {
      id: "far",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      spawnPosition: { x: 5, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });
    const { engine, state } = buildMoveTestEngine([user, near, far]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "roar",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const teleports = result.events.filter((event) => event.type === BattleEventType.Teleported);
    expect(teleports).toHaveLength(2);
    expect(result.events.map((event) => event.type)).not.toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(near.id)?.position).toEqual({ x: 5, y: 5 });
    expect(state.pokemon.get(far.id)?.position).toEqual({ x: 5, y: 4 });
    vi.restoreAllMocks();
  });

  it("is a sound move and phazes through a pillar (height 2)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      moveIds: ["roar"],
      currentPp: { roar: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foeBehindPillar = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-behind",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      spawnPosition: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([user, foeBehindPillar]);
    MockBattle.setTile(state, 1, 0, { height: 2 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: user.id,
      moveId: "roar",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get(foeBehindPillar.id)?.position).toEqual({ x: 5, y: 5 });
    vi.restoreAllMocks();
  });
});
